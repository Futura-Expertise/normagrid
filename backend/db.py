"""
Acces a la base SQLite unique de Chantier ERP.

Contrairement a NormaGrid (un fichier .db par "projet" d'ingenierie), Chantier
ERP est une base de gestion continue de l'entreprise : un seul fichier,
cree automatiquement au premier lancement.
"""

import datetime
import json
import re
import secrets
import shutil
import sqlite3
import os
import unicodedata
import uuid

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # psycopg2 n'est necessaire qu'en hebergement cloud
    psycopg2 = None

APP_VERSION = "V4.1"  # source unique : voir app.py, qui l'importe d'ici.

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATA_DIR = os.path.join(BASE_DIR, "data")
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "schema.sql")

# Petit fichier de "bootstrap" (JAMAIS les donnees elles-memes) qui retient
# le repertoire choisi par l'utilisateur pour la base de donnees (V1.38,
# Parametres > Emplacement de la base de donnees). Toujours au meme endroit
# fixe, a cote de l'application - contrairement aux autres reglages de
# l'appli (ex. repertoire de stockage des factures fournisseurs), ce choix
# ne peut pas etre stocke DANS la base elle-meme : il faudrait deja savoir
# ou elle se trouve pour pouvoir l'y lire.
LOCATION_CONFIG_PATH = os.path.join(BASE_DIR, "db_location.json")

# V1.55 (voir claude/architecture-cloud-securite.md) : si DATABASE_URL est
# definie (ex. "postgresql://user:pwd@hote/base"), l'application se connecte
# a ce serveur PostgreSQL au lieu du fichier SQLite local - c'est le mode
# attendu pour un hebergement cloud multi-utilisateurs. Sans cette variable
# (cas par defaut), rien ne change : l'application continue de fonctionner
# exactement comme avant avec son fichier SQLite local (usage poste unique,
# voir claude/chantier-erp-version-locale.md). Les deux modes partagent le
# meme schema generique "documents" (table a 5 colonnes) ; voir
# _PgConnWrapper ci-dessous pour l'adaptation entre les deux moteurs.
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


def auth_required():
    """V3.54 : connexion obligatoire (email + mot de passe) et droits par profil appliques.
    Vrai en mode PostgreSQL (hebergement), ou en SQLite si la variable d'environnement ERP_AUTH=1
    est definie, ou si db_location.json contient "authRequired": true. Faux par defaut en usage
    local mono-poste (administrateur automatique, comportement V1.56)."""
    if is_postgres():
        return True
    if os.environ.get("ERP_AUTH", "").strip().lower() in ("1", "true", "oui", "yes"):
        return True
    try:
        return bool(read_location_config().get("authRequired"))
    except Exception:
        return False


def read_location_config():
    """Lit le fichier de bootstrap (LOCATION_CONFIG_PATH) en entier :
    {dataDir, assistantInitialTermine, ...}. Dictionnaire vide si le
    fichier est absent ou invalide (premiere utilisation de
    l'application)."""
    try:
        with open(LOCATION_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_location_config(patch):
    """Fusionne 'patch' dans le fichier de bootstrap existant et le
    reecrit - jamais un simple remplacement total, pour ne pas perdre un
    champ non concerne par cet appel (ex. assistantInitialTermine lors
    d'un simple changement de repertoire depuis Parametres)."""
    current = read_location_config()
    current.update(patch)
    with open(LOCATION_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f)


def assistant_initial_termine():
    """True si l'assistant de premier demarrage (V1.40, voir
    backend/routes/db_admin.py) a deja ete marque termine sur ce poste - ou
    s'il est sans objet (mode PostgreSQL/cloud, ou le fichier de bootstrap
    n'existe pas encore). Utilise par backend/access.py pour determiner la
    fenetre pendant laquelle /api/db/* reste ouvert sans authentification
    (voir le commentaire au-dessus d'ADMIN_ONLY_PREFIX dans ce module) :
    tant que cet assistant n'est pas termine, aucun ecran de connexion n'est
    encore propose cote frontend, donc exiger une session y serait un
    blocage sans issue - meme apres qu'une 'adoption' de base precedente
    (voir adopter_version_precedente()) ait fait apparaitre des utilisateurs
    dans la base active avant la fin de cet assistant."""
    if is_postgres():
        return True
    return bool(read_location_config().get("assistantInitialTermine"))


def get_data_dir():
    """Repertoire contenant le fichier de base de donnees : par defaut
    DEFAULT_DATA_DIR (data/ sous l'installation de l'application), ou un
    repertoire choisi par l'utilisateur - typiquement un disque/partage
    reseau commun a plusieurs postes. Relu a chaque appel (pas mis en
    cache) pour qu'un changement cote Parametres prenne effet
    immediatement, sans necessiter de relancer l'application."""
    custom = (read_location_config().get("dataDir") or "").strip()
    return custom or DEFAULT_DATA_DIR


def db_filename():
    """Nom du fichier de base de donnees de cette version de
    l'application : porte le numero de version en suffixe (V1.38, ex.
    'chantier_erp_V1.38.db') plutot qu'un nom fixe, afin qu'une mise a
    jour vers une nouvelle version pointee sur le meme repertoire ne
    puisse jamais ecraser silencieusement la base d'une version
    precedente - celle-ci reste intacte, sous son propre nom, disponible
    pour une reprise explicite (voir backend/routes/db_admin.py,
    'adopter' une base de version precedente)."""
    return "chantier_erp_{}.db".format(APP_VERSION)


def get_db_path():
    d = get_data_dir()
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, db_filename())


def is_postgres():
    """V3.00 : base relationnelle SQLite uniquement (PostgreSQL non pris en charge)."""
    return False


def get_connection():
    conn = sqlite3.connect(get_db_path(), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_secret_key():
    """Cle secrete utilisee par Flask pour signer les cookies de session de
    connexion (voir backend/auth.py). En hebergement cloud, fournir SECRET_KEY
    par variable d'environnement (obligatoire dans ce mode : plusieurs
    instances du serveur doivent partager la meme cle pour reconnaitre les
    memes sessions, une cle generee localement par chaque instance ne
    fonctionnerait pas). En local, une cle est generee une seule fois et
    conservee dans le fichier de bootstrap (jamais les donnees elles-memes)
    pour que les sessions ne soient pas perdues a chaque redemarrage."""
    env_key = os.environ.get("SECRET_KEY", "").strip()
    if env_key:
        return env_key
    cfg = read_location_config()
    key = cfg.get("secretKey")
    if not key:
        key = secrets.token_hex(32)
        write_location_config({"secretKey": key})
    return key


def init_db():
    """A appeler au demarrage : cree le fichier de base et ses tables si absents."""
    from backend import migration_v3
    os.makedirs(get_data_dir(), exist_ok=True)
    # Reprise automatique d'une base JSON V2.x (jamais modifiee) ; leve MigrationRefusee si non verifiee.
    migration_v3.preparer(get_db_path(), SCHEMA_PATH)
    conn = get_connection()
    # Le schema V3 n'est pas rejouable (CREATE TABLE sans IF NOT EXISTS) : on ne l'applique
    # que sur une base vide. Une base deja creee n'est jamais modifiee ici.
    base_neuve = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='utilisateurs'").fetchone() is None
    if base_neuve:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
    # Mises a niveau du schema d'une base V3 existante (reconstruction de tables, etapes enregistrees).
    from backend import schema_upgrades
    schema_upgrades.appliquer(conn, SCHEMA_PATH, base_neuve)
    migration_v3.nettoyer_extra_factures(conn)
    conn.commit()
    conn.close()
    _seed_tiers_bancaires_if_empty()
    _seed_plan_comptable_if_empty()


def _seed_tiers_bancaires_if_empty():
    """Amorce la collection 'tiersBancaires' (mots-cles de rapprochement des
    releves bancaires, module Releves bancaires) avec la liste fournie par
    l'utilisateur (001_Tiers.xlsx) au tout premier demarrage de l'application.
    Ensuite, cette liste est entierement geree depuis Parametres > Tiers
    bancaires : ce fichier externe n'est plus jamais relu."""
    from backend.releve_parser import DEFAULT_TIERS  # import tardif : evite tout cycle

    conn = get_connection()
    from backend import store
    existing = conn.execute("SELECT COUNT(*) AS n FROM tiers").fetchone()
    if existing["n"] == 0:
        for entry in DEFAULT_TIERS:
            store.set_doc(conn, "tiersBancaires", uuid.uuid4().hex, dict(entry))
        conn.commit()
    conn.close()


# Sous-ensemble du Plan Comptable General des Entreprises marocain (CGNC),
# limite aux comptes reellement utiles a une entreprise de BTP de cette
# taille plutot que les ~400 comptes du plan complet. Module Comptabilite
# (V1.32, etape 1 : outil de pre-comptabilite interne, PAS une comptabilite
# legale au sens du Code de Commerce - voir claude/module-comptabilite.md).
# Entierement editable ensuite depuis l'ecran "Plan comptable" : cette liste
# n'est qu'un point de depart raisonnable, jamais relue une fois amorcee.
DEFAULT_PLAN_COMPTABLE = [
    # Classe 1 - Comptes de financement permanent
    {"code": "1111", "libelle": "Capital social", "classe": 1, "sens": "crediteur"},
    {"code": "1481", "libelle": "Emprunts auprès des établissements de crédit", "classe": 1, "sens": "crediteur"},
    # Classe 2 - Comptes d'actif immobilisé
    {"code": "2332", "libelle": "Matériel et outillage", "classe": 2, "sens": "debiteur"},
    {"code": "2340", "libelle": "Matériel de transport", "classe": 2, "sens": "debiteur"},
    {"code": "2351", "libelle": "Mobilier de bureau", "classe": 2, "sens": "debiteur"},
    {"code": "2355", "libelle": "Matériel informatique", "classe": 2, "sens": "debiteur"},
    {"code": "28332", "libelle": "Amortissements du matériel et outillage", "classe": 2, "sens": "crediteur"},
    # Classe 3 - Comptes d'actif circulant (hors trésorerie)
    {"code": "3421", "libelle": "Clients", "classe": 3, "sens": "debiteur",
     "note": "Utilisé automatiquement par les factures et avoirs clients."},
    {"code": "3425", "libelle": "Clients douteux ou litigieux", "classe": 3, "sens": "debiteur"},
    {"code": "3455", "libelle": "État - TVA récupérable", "classe": 3, "sens": "debiteur",
     "note": "Utilisé automatiquement par les factures fournisseurs."},
    {"code": "3458", "libelle": "État - autres comptes débiteurs", "classe": 3, "sens": "debiteur"},
    # Classe 4 - Comptes de passif circulant (hors trésorerie)
    {"code": "4411", "libelle": "Fournisseurs", "classe": 4, "sens": "crediteur",
     "note": "Utilisé automatiquement par les factures fournisseurs et leurs règlements."},
    {"code": "4432", "libelle": "Clients - avances et acomptes reçus", "classe": 4, "sens": "crediteur"},
    {"code": "4441", "libelle": "Personnel - rémunérations dues", "classe": 4, "sens": "crediteur"},
    {"code": "4443", "libelle": "Caisse nationale de sécurité sociale (CNSS)", "classe": 4, "sens": "crediteur"},
    {"code": "4452", "libelle": "État - impôts sur les salaires", "classe": 4, "sens": "crediteur"},
    {"code": "4455", "libelle": "État - TVA facturée", "classe": 4, "sens": "crediteur",
     "note": "Utilisé automatiquement par les factures et avoirs clients."},
    {"code": "4458", "libelle": "État - autres comptes créditeurs", "classe": 4, "sens": "crediteur"},
    # Classe 5 - Comptes de trésorerie
    {"code": "5141", "libelle": "Banques (comptes courants)", "classe": 5, "sens": "debiteur",
     "note": "Utilisé automatiquement par les encaissements et règlements fournisseurs par virement, chèque ou effet."},
    {"code": "5161", "libelle": "Caisses", "classe": 5, "sens": "debiteur",
     "note": "Utilisé automatiquement par les encaissements et règlements fournisseurs en espèces."},
    # Classe 6 - Comptes de charges
    {"code": "6125", "libelle": "Achats de travaux, matières et fournitures (sous-traitance)", "classe": 6, "sens": "debiteur",
     "note": "Utilisé automatiquement par les factures fournisseurs."},
    {"code": "6131", "libelle": "Locations et charges locatives", "classe": 6, "sens": "debiteur"},
    {"code": "6134", "libelle": "Entretien et réparations", "classe": 6, "sens": "debiteur"},
    {"code": "6136", "libelle": "Rémunérations d'intermédiaires et honoraires", "classe": 6, "sens": "debiteur"},
    {"code": "6145", "libelle": "Frais postaux et de télécommunications", "classe": 6, "sens": "debiteur"},
    {"code": "6167", "libelle": "Primes d'assurances", "classe": 6, "sens": "debiteur"},
    {"code": "6171", "libelle": "Rémunérations du personnel", "classe": 6, "sens": "debiteur"},
    {"code": "6174", "libelle": "Charges sociales (CNSS, mutuelle...)", "classe": 6, "sens": "debiteur"},
    {"code": "6311", "libelle": "Impôts et taxes directs (patente...)", "classe": 6, "sens": "debiteur"},
    {"code": "6391", "libelle": "Dotations d'exploitation aux amortissements", "classe": 6, "sens": "debiteur"},
    # Classe 7 - Comptes de produits
    {"code": "7121", "libelle": "Ventes de biens et services produits — Travaux facturés", "classe": 7, "sens": "crediteur",
     "note": "Utilisé automatiquement par les factures et avoirs clients."},
    {"code": "7197", "libelle": "Transferts de charges d'exploitation", "classe": 7, "sens": "crediteur"},

    # Comptes CGNC supplementaires (V1.38) correspondant aux rubriques du
    # bilan (Tableau n°1 CGNC modele simplifie) reconnues par
    # backend/bilan_parser.py (import de l'ecriture d'ouverture et des
    # exercices archives), afin qu'un import de bilan n'oblige plus a
    # creer manuellement chaque compte suggere un par un. Voir
    # _migrate_comptes_bilan_if_needed() ci-dessous pour les installations
    # deja en service.
    {"code": "2111", "libelle": "Frais préliminaires", "classe": 2, "sens": "debiteur"},
    {"code": "2230", "libelle": "Fonds commercial", "classe": 2, "sens": "debiteur"},
    {"code": "2280", "libelle": "Autres immobilisations incorporelles", "classe": 2, "sens": "debiteur"},
    {"code": "2311", "libelle": "Terrains", "classe": 2, "sens": "debiteur"},
    {"code": "2321", "libelle": "Constructions", "classe": 2, "sens": "debiteur"},
    {"code": "2380", "libelle": "Autres immobilisations corporelles", "classe": 2, "sens": "debiteur"},
    {"code": "2510", "libelle": "Titres de participation", "classe": 2, "sens": "debiteur"},
    {"code": "3111", "libelle": "Marchandises", "classe": 3, "sens": "debiteur"},
    {"code": "3118", "libelle": "Stocks divers", "classe": 3, "sens": "debiteur"},
    {"code": "3461", "libelle": "Associés, comptes débiteurs", "classe": 3, "sens": "debiteur"},
    {"code": "3488", "libelle": "Divers débiteurs", "classe": 3, "sens": "debiteur"},
    {"code": "3491", "libelle": "Charges constatées d'avance", "classe": 3, "sens": "debiteur"},
    {"code": "3500", "libelle": "Titres et valeurs de placement", "classe": 3, "sens": "debiteur"},
    {"code": "5112", "libelle": "Chèques à encaisser", "classe": 5, "sens": "debiteur"},
    {"code": "1130", "libelle": "Primes d'émission, de fusion, d'apport", "classe": 1, "sens": "crediteur"},
    {"code": "1140", "libelle": "Écarts de réévaluation", "classe": 1, "sens": "crediteur"},
    {"code": "1151", "libelle": "Réserves diverses", "classe": 1, "sens": "crediteur"},
    {"code": "1161", "libelle": "Report à nouveau", "classe": 1, "sens": "crediteur"},
    {"code": "1191", "libelle": "Résultat net de l'exercice", "classe": 1, "sens": "crediteur"},
    {"code": "1310", "libelle": "Subventions d'investissement", "classe": 1, "sens": "crediteur"},
    {"code": "1511", "libelle": "Provisions pour risques", "classe": 1, "sens": "crediteur"},
    {"code": "4463", "libelle": "Associés, comptes courants créditeurs", "classe": 4, "sens": "crediteur"},
    {"code": "4468", "libelle": "Divers créanciers", "classe": 4, "sens": "crediteur"},
    {"code": "4491", "libelle": "Produits constatés d'avance", "classe": 4, "sens": "crediteur"},
    {"code": "4501", "libelle": "Autres provisions pour risques et charges", "classe": 4, "sens": "crediteur"},
    {"code": "5520", "libelle": "Crédits d'escompte", "classe": 5, "sens": "crediteur"},
    {"code": "5541", "libelle": "Banques (soldes créditeurs)", "classe": 5, "sens": "crediteur"},
]


def _seed_plan_comptable_if_empty():
    """Amorce la collection 'planComptable' avec un sous-ensemble du CGNC
    adapte au BTP (DEFAULT_PLAN_COMPTABLE ci-dessus) au tout premier
    demarrage de l'application. Ensuite, entierement gere depuis l'ecran
    Plan comptable : cette liste par defaut n'est plus jamais relue."""
    conn = get_connection()
    from backend import store
    existing = conn.execute("SELECT COUNT(*) AS n FROM plan_comptable").fetchone()
    if existing["n"] == 0:
        for entry in DEFAULT_PLAN_COMPTABLE:
            data = dict(entry)
            data["actif"] = True
            store.set_doc(conn, "planComptable", uuid.uuid4().hex, data)
        conn.commit()
    conn.close()
