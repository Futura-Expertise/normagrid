"""
Autorisation par role, appliquee cote SERVEUR sur chaque requete (V1.55).

Avant cette version, la matrice ACCESS ci-dessous n'existait qu'en
JavaScript (static/js/app.js) et ne servait qu'a masquer des menus et des
boutons dans l'interface : aucune route de l'API ne verifiait quoi que ce
soit, donc un appel direct a l'API (hors interface, par exemple avec curl)
pouvait lire ou ecrire n'importe quelle donnee, quel que soit le role
affiche cote client. Voir claude/architecture-cloud-securite.md pour le
diagnostic complet et la demarche validee avec l'utilisateur.

Ce module porte desormais la version qui FAIT FOI : c'est elle qui est
appliquee a chaque requete par enforce_request() (cable comme
app.before_request dans app.py), independamment de ce que montre
l'interface. Le frontend ne la code plus en dur : il la recupere via
GET /api/access-matrix (voir backend/routes/api.py) pour n'avoir plus
qu'une seule source de verite, meme si en pratique chaque appel API est de
toute facon revérifié ici, meme si le JS avait ete trompe ou contourne.

Principe de securite par defaut : toute section ou toute collection non
explicitement listee ci-dessous est FERMEE a tout le monde sauf
l'administrateur - jamais ouverte par defaut. Garder cette matrice et les
mises en correspondance (COLLECTION_SECTION, etc.) synchronisees avec
l'usage reel : un nouveau module de donnees doit y ajouter son entree.
"""

import re

from flask import g, jsonify, request

from backend import auth as authmod
from backend import db as dbmod
from backend import modules as modulesmod

ACCESS = {
    # V1.85 : nouveau role "rh" (Ressources humaines), voir
    # claude/module-personnel.md - acces complet au Tableau de bord comme
    # tous les autres roles metier.
    "dashboard": {"admin": "full", "commercial": "full", "chantier": "full", "comptable": "full", "rh": "full"},
    "clients": {"admin": "full", "commercial": "full", "chantier": "none", "comptable": "read"},
    "devis": {"admin": "full", "commercial": "full", "chantier": "none", "comptable": "read"},
    "ctr": {"admin": "full", "commercial": "full", "chantier": "read", "comptable": "read"},
    "av": {"admin": "full", "commercial": "full", "chantier": "read", "comptable": "read"},
    "att": {"admin": "full", "commercial": "read", "chantier": "full", "comptable": "read"},
    # Gestion de projet d'ingenierie, V1.54 : Administrateur et Conducteur de
    # travaux uniquement - voir claude/module-projets-ingenierie.md.
    "livrables": {"admin": "full", "commercial": "none", "chantier": "full", "comptable": "none"},
    # V3.01 : le module Planification (planning + timesheet) a ses propres sections de droits.
    # Au depart : exactement les droits de "livrables" (aucun changement visible a la bascule) ;
    # ils peuvent desormais evoluer sans toucher aux Livrables.
    "planification": {"admin": "full", "commercial": "none", "chantier": "full", "comptable": "none"},
    "timesheet": {"admin": "full", "commercial": "none", "chantier": "full", "comptable": "none"},
    # V3.03 : module « Étude électrique » (base de données des consommateurs) - section dediee.
    "etude_elec": {"admin": "full", "commercial": "none", "chantier": "full", "comptable": "none"},
    "pfa": {"admin": "full", "commercial": "read", "chantier": "none", "comptable": "full"},
    "fac": {"admin": "full", "commercial": "read", "chantier": "none", "comptable": "full"},
    "avo": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "reg": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "fournisseurs": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    # Section distincte de 'fournisseurs' ci-dessus (qui ne gere que la
    # visibilite de la PAGE Fournisseurs) : le registre partage
    # 'tiersBancaires' (V1.55) doit aussi rester accessible en lecture et en
    # ecriture a quiconque peut creer un Client (Commercial) ou un membre du
    # Personnel (Comptable/Admin, deja couverts par 'fournisseurs'/'releves')
    # - c'est un effet de bord necessaire de syncTiersPourFiche() (voir
    # static/js/app.js), qui lie/cree automatiquement une fiche Tiers a
    # chaque client ou employe (V1.53). Sans cette section plus large,
    # Commercial ne pourrait plus creer de client du tout une fois
    # l'autorisation serveur appliquee.
    "tiersBancaires": {"admin": "full", "commercial": "full", "chantier": "none", "comptable": "full"},
    "releves": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "facturesF": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    # V1.85 : le nouveau role "rh" (dedie, voir claude/module-personnel.md)
    # recoit le meme acces complet que Comptable sur le registre Personnel -
    # Comptable le garde egalement (inchange), pour ne pas retirer un acces
    # existant a une installation deja en service.
    "personnel": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full", "rh": "full"},
    # V1.85 : referentiel des competences (catalogue + niveaux par personne)
    # et gestion des formations - nouvelles sections dediees, reservees a
    # l'Administrateur et au nouveau role "RH" (decision explicite de
    # l'utilisateur : Comptable n'y a PAS automatiquement acces, a la
    # difference de 'personnel' ci-dessus). Voir claude/module-personnel.md.
    "competences": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "none", "rh": "full"},
    "formations": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "none", "rh": "full"},
    "planComptable": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "ecritures": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "ecritureOuverture": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "exercicesArchives": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "controleGestion": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "full"},
    "settings": {"admin": "full", "commercial": "none", "chantier": "none", "comptable": "none"},
}

# Nom de collection (tel qu'utilise par l'API generique /api/collection/<x>,
# /api/doc/<x>/<id>, /api/increment/<x>/<id>) -> section ACCESS ci-dessus.
# 'users' est rattachee a 'settings' (gestion des comptes = reserve a
# l'administrateur, jamais au Comptable malgre son acces complet par
# ailleurs aux donnees financieres).
COLLECTION_SECTION = {
    "clients": "clients",
    "devis": "devis",
    "bonsCommande": "ctr",
    "contrats": "ctr",
    "avenants": "av",
    "attachements": "att",
    "livrables": "livrables",
    # Bordereaux de transmission (V1.60) : rattaches a la meme section que
    # les livrables techniques (memes droits, meme toggle de module), sans
    # entree ACCESS dediee ni route dediee.
    "bordereaux": "livrables",
    "propositionsFacturation": "pfa",
    "factures": "fac",
    "avoirs": "avo",
    "reglements": "reg",
    "tiersBancaires": "tiersBancaires",
    "releves": "releves",
    "facturesFournisseurs": "facturesF",
    "personnel": "personnel",
    "planComptable": "planComptable",
    "ecritures": "ecritures",
    "exercicesArchives": "exercicesArchives",
    "settings": "settings",
    "users": "settings",
    # Backlog de developpement de l'application elle-meme (V1.64) : reserve
    # a l'Administrateur, comme Parametres - voir static/js/app.js, NAV et
    # access() (accessKey/redirection 'backlog' -> 'settings').
    "backlog": "settings",
    # Lignes du module de planification manuelle (V1.70) : remplace le Plan
    # de charge automatique (V1.65), rattachees a la meme section que les
    # livrables techniques (memes droits, meme toggle de module), sans
    # entree ACCESS dediee ni route dediee - meme mecanisme que "bordereaux".
    "planificationLignes": "planification",
    # Lignes du Timesheet / pointage reel (V1.71) : totalement independantes
    # de "planificationLignes" ci-dessus, memes droits/memes mecanisme.
    "timesheetLignes": "timesheet",
    # V3.03 : module Etude electrique (consommateurs + valeurs des listes deroulantes).
    "etudeConsommateurs": "etude_elec",
    "etudeListes": "etude_elec",
    "etudeListeDocs": "etude_elec",
    "etudeBilanTableaux": "etude_elec",
    "etudeMatTransfos": "etude_elec",
    "etudeMatParams": "etude_elec",
    "etudeMatSources": "etude_elec",
    "etudeMatConstructeurs": "etude_elec",
    "etudeMatDisj": "etude_elec",
    "etudeMatDecl": "etude_elec",
    "etudeMatAssoc": "etude_elec",
    "etudeMatReglages": "etude_elec",
    "etudeBtCables": "etude_elec",
    "etudeBtCircuits": "etude_elec",
    "etudeBtLiensCaneco": "etude_elec",
    "etudeSymboles": "etude_elec",
    "etudeMatDocs": "etude_elec",
    "etudeMatCourbes": "etude_elec",
    # Referentiel des competences et gestion des formations (V1.85) :
    # chacune a sa propre section ACCESS dediee (voir ci-dessus), pas
    # rattachee a "personnel" - voir claude/module-personnel.md.
    "competencesReferentiel": "competences",
    "formations": "formations",
    # V1.86 : categories de competences personnalisables - rattachee a la
    # meme section ACCESS que le referentiel lui-meme (pas de section
    # dediee), meme mecanisme que "bordereaux"/"livrables".
    "competenceCategories": "competences",
    # V1.88 : statuts du personnel personnalisables (ex. Actif, En conge,
    # Suspendu...) - rattaches a la section "personnel" elle-meme (memes
    # droits que le registre Personnel : admin/comptable/rh), pas de
    # section ACCESS dediee - meme mecanisme que "competenceCategories"
    # ci-dessus. Voir claude/module-personnel.md.
    "personnelStatuts": "personnel",
    # V1.90 : niveaux attendus (cible, 1 a 5) par statut du personnel x
    # competence du referentiel - DELIBEREMENT rattachee a "competences" et
    # NON a "personnel" malgre le lien avec "personnelStatuts" ci-dessus :
    # cette matrice est geree depuis l'ecran "Gestion des competences"
    # (memes droits que le reste du module competences, Admin/RH
    # uniquement). La rattacher a "personnel" aurait donne a Comptable un
    # acces en ecriture a ces niveaux cibles (il a 'full' sur "personnel"
    # mais explicitement PAS sur "competences" depuis la V1.85) - voir
    # claude/module-personnel.md, Ajout V1.90.
    "niveauxAttendusStatuts": "competences",
}

# Chemins exacts hors du mecanisme generique "documents", rattaches a une
# section ACCESS existante (export Excel : lecture uniquement).
SECTION_BY_EXACT_PATH = {
    "/api/excel/clients/export": "clients",
    "/api/excel/fournisseurs/export": "fournisseurs",
    # Module de planification (V1.65) : liste minimale et non sensible du
    # Personnel (id/nom/fonction/actif, jamais le salaire), utilisee pour
    # affecter des personnes aux livrables techniques. Rattachee a la
    # section 'livrables' (pas a 'personnel') afin que le Conducteur de
    # travaux (role 'chantier', full sur 'livrables' mais 'none' sur
    # 'personnel' - voir claude/module-personnel.md) puisse l'utiliser sans
    # qu'on lui ouvre le registre Personnel complet (salaire inclus). Voir
    # backend/routes/api.py, personnel_light().
    "/api/personnel-light": "livrables",
}

# Prefixes des blueprints dedies (routes metier specifiques, pas le
# mecanisme generique "documents") -> section ACCESS. Le niveau requis
# (lecture suffit vs ecriture complete necessaire) suit la meme regle que
# pour les collections generiques : GET => lecture, tout le reste => complet.
SECTION_BY_PREFIX = {
    "/api/releve/": "releves",
    "/api/facture-fournisseur/": "facturesF",
    "/api/facture-client/": "fac",
    "/api/ouverture/": "ecritureOuverture",
    # V2.04 : piece jointe (scan BC/contrat client), stockee comme un vrai
    # fichier sur disque (voir backend/routes/commande_client.py) plutot
    # qu'en base64 en base. V2.14 : la Commande client ayant fusionne dans le
    # Contrat, cette piece jointe appartient desormais au Contrat - section
    # 'ctr' (le nom de la route reste inchange pour ne pas casser les
    # fichiers deja classes).
    "/api/commande-client/": "ctr",
    # V3.36 : fiches techniques des déclencheurs (fichiers du catalogue matériel).
    "/api/etude-elec/docs/": "etude_elec",
    # V2.11 : import de devis deja emis (PDF), a l'identique du module
    # Factures clients (voir backend/routes/devis_import.py) - rattachee a
    # la section 'devis' (memes droits que le reste de l'ecran Devis).
    "/api/devis-import/": "devis",
    # V3.11 : import Excel des protections BT (ECRIT en base, en un seul lot) - section 'etude_elec', droit complet requis.
    "/api/etude-elec/protections/": "etude_elec",
    # V3.13 : catalogue des câbles BT (lecture par famille + import Excel en un seul lot).
    "/api/etude-elec/cables/": "etude_elec",
}

# Routes necessitant seulement une session valide, sans controle de role
# supplementaire : utilitaire d'analyse d'un fichier uploade, sans aucune
# ecriture en base (l'ecriture effective passe ensuite par les routes
# generiques /api/doc, deja protegees par section ci-dessus).
LOGIN_ONLY_EXACT_PATHS = {
    "/api/events",   # V4.2 : flux SSE des modifications (voir backend/changes.py)
    "/api/excel/parse",
    # Import du registre des livrables depuis un classeur Excel reel
    # (V1.66) : meme principe que /api/excel/parse ci-dessus - lecture
    # seule du fichier envoye, aucune ecriture en base ici. L'ecriture
    # effective (creation/mise a jour des livrables, de l'historique des
    # indices, des affectations, du Personnel et des bordereaux) passe
    # ensuite par les routes generiques /api/doc/..., deja protegees par
    # role (sections 'livrables'/'personnel'/'ctr' ci-dessus) - voir
    # claude/codification-livrables-futura-expertise.md, §16.
    "/api/livrables-import/parse",
    "/api/livrables-import/table",
    # Export / import Excel des Livrables et des Bordereaux avec listes
    # deroulantes (V2.16) : fabrication et lecture d'un classeur uniquement,
    # AUCUNE ecriture en base ici - l'enregistrement passe par /api/doc/...,
    # protege par role (sections 'livrables' / 'ctr').
    "/api/xlsx-tools/build",
    "/api/xlsx-tools/read",
    # V3.03 : Etude electrique - fabrication / lecture d'un classeur uniquement (aucune ecriture en base ;
    # l'enregistrement passe par /api/doc/etudeConsommateurs, protege par la section 'etude_elec').
    "/api/etude-elec/export",
    "/api/etude-elec/export-liste",
    "/api/etude-elec/export-bilan",
    "/api/etude-elec/export-materiel",
    "/api/etude-elec/import-materiel",
    "/api/etude-elec/materiel-explications",
    "/api/etude-elec/table",
    # V3.15 : lecture (sans ecriture) d'un export Caneco (.xls / .xlsx / .zip) ; l'enregistrement passe par /api/doc/etudeBtCircuits.
    "/api/etude-elec/caneco-lire",
}

# Administration de l'infrastructure locale (emplacement de la base,
# navigation dans le systeme de fichiers du serveur, sauvegardes...) :
# reserve a l'administrateur de maniere fixe, independamment de la matrice
# ACCESS (ce n'est pas une donnee metier). Non applicable en mode
# PostgreSQL (voir backend/routes/db_admin.py).
ADMIN_ONLY_PREFIX = "/api/db/"

# "/api/db/assistant-initial" (lecture) est appele par le frontend a CHAQUE
# demarrage de page, pour tout le monde, y compris avant la creation du
# tout premier compte - il doit donc rester public comme /api/ping, meme
# une fois l'application en usage courant (il ne fait que lire un indicateur
# et quelques chemins de fichiers locaux, rien de sensible cote donnees
# metier). Tout le reste de /api/db/ (choix du repertoire, navigation dans
# le systeme de fichiers du serveur, reprise d'une version precedente)
# reste strictement reserve a l'administrateur une fois le premier compte
# cree - voir ADMIN_ONLY_PREFIX ci-dessous.
PUBLIC_EXACT_PATHS = {"/api/ping", "/api/db/assistant-initial"}
PUBLIC_PREFIX = "/api/auth/"

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_COLLECTION_RE = re.compile(r"^/api/(?:collection|doc|increment)/([^/]+)")


# ---------------------------------------------------------------------------------------------
# V3.54 : PROFILS D'ACCES MODIFIABLES (Administration > Droits d'accès).
# Les droits ne sont plus figes dans ce fichier : la matrice ACCESS ci-dessus ne sert plus que de
# VALEURS PAR DEFAUT des profils d'origine. La configuration reelle (profils, libelles, niveau de
# chaque section : none / read / full) est lue dans settings/company.accessProfiles. Le profil
# « admin » est fixe : toujours « full » partout (impossible de se verrouiller soi-meme).
# ---------------------------------------------------------------------------------------------
import copy
import time

NIVEAUX = ("none", "read", "full")

# Sections presentees dans l'ecran de la matrice, par groupe de menu (ordre d'affichage).
SECTIONS_UI = [
    ("dashboard", "Tableau de bord", "Général"),
    ("clients", "Clients", "Commercial"),
    ("devis", "Devis", "Commercial"),
    ("ctr", "Contrats", "Contrat"),
    ("av", "Avenants", "Contrat"),
    ("att", "Attachements", "Contrat"),
    ("livrables", "Livrables techniques et bordereaux", "Projets d'ingénierie"),
    ("planification", "Plan de charge", "Projets d'ingénierie"),
    ("timesheet", "Timesheet", "Projets d'ingénierie"),
    ("etude_elec", "Étude électrique (tout le module)", "Étude électrique"),
    ("pfa", "Propositions de facturation", "Facturation clients"),
    ("fac", "Factures clients", "Facturation clients"),
    ("avo", "Avoirs", "Facturation clients"),
    ("reg", "Encaissements", "Facturation clients"),
    ("fournisseurs", "Fournisseurs", "Fournisseurs"),
    ("facturesF", "Factures fournisseurs", "Fournisseurs"),
    ("personnel", "Personnel (fiches, salaires)", "RH"),
    ("competences", "Compétences et évaluation", "RH"),
    ("formations", "Formations", "RH"),
    ("planComptable", "Plan comptable", "Comptabilité"),
    ("ecritures", "Écritures comptables", "Comptabilité"),
    ("ecritureOuverture", "Écriture d'ouverture", "Comptabilité"),
    ("exercicesArchives", "Exercices archivés", "Comptabilité"),
    ("controleGestion", "Contrôle de gestion", "Comptabilité"),
    ("releves", "Relevés bancaires", "Comptabilité"),
    ("settings", "Paramètres, utilisateurs, droits, backlog", "Administration"),
]
SECTIONS_UI_IDS = [x[0] for x in SECTIONS_UI]

PROFILS_ORIGINE = [
    {"id": "admin", "label": "Administrateur", "builtin": True},
    {"id": "commercial", "label": "Commercial", "builtin": True},
    {"id": "chantier", "label": "Conducteur de travaux", "builtin": True},
    {"id": "comptable", "label": "Comptable", "builtin": True},
    {"id": "rh", "label": "RH", "builtin": True},
]

# Profils proposes d'office (V3.54) en plus des 5 d'origine ; modifiables ou supprimables.
PROFILS_PROPOSES = {
    "ingenieur": {
        "label": "Ingénieur / BET",
        "levels": {"dashboard": "read", "livrables": "full", "planification": "full", "timesheet": "full",
                   "etude_elec": "full"},
    },
    "chef_projet": {
        "label": "Chef de projet",
        "levels": {"dashboard": "read", "devis": "read", "ctr": "read", "av": "read", "att": "full",
                   "livrables": "full", "planification": "full", "timesheet": "full", "etude_elec": "full",
                   "clients": "read"},
    },
    "direction": {
        "label": "Direction (lecture seule)",
        "levels": {s: "read" for s in SECTIONS_UI_IDS if s != "settings"},
    },
}


def _niveaux_defaut(role):
    out = {}
    for sec in SECTIONS_UI_IDS:
        out[sec] = ACCESS.get(sec, {}).get(role, "none")
    return out


def profils_par_defaut():
    profils = []
    for p in PROFILS_ORIGINE:
        q = dict(p)
        q["levels"] = _niveaux_defaut(p["id"]) if p["id"] != "admin" else {s: "full" for s in SECTIONS_UI_IDS}
        profils.append(q)
    for pid, d in PROFILS_PROPOSES.items():
        levels = {s: d["levels"].get(s, "none") for s in SECTIONS_UI_IDS}
        profils.append({"id": pid, "label": d["label"], "builtin": False, "levels": levels})
    return profils


_CACHE = {"t": 0.0, "profils": None}


def invalider_cache():
    _CACHE["t"] = 0.0
    _CACHE["profils"] = None


def _lire_profils_stockes():
    try:
        from backend import store
        conn = dbmod.get_connection()
        doc = store.get_doc(conn, "settings", "company") or {}
        conn.close()
    except Exception:
        return None
    lst = doc.get("accessProfiles")
    return lst if isinstance(lst, list) and lst else None


def get_profils():
    """Profils effectifs (liste de dicts id/label/builtin/levels). Mise en cache 3 s, invalidee a l'enregistrement."""
    now = time.time()
    if _CACHE["profils"] is not None and now - _CACHE["t"] < 3.0:
        return _CACHE["profils"]
    stock = _lire_profils_stockes()
    profils = stock if stock else profils_par_defaut()
    # le profil admin est toujours present et complet
    profils = [p for p in profils if isinstance(p, dict) and p.get("id")]
    if not any(p["id"] == "admin" for p in profils):
        profils.insert(0, {"id": "admin", "label": "Administrateur", "builtin": True})
    for p in profils:
        if p["id"] == "admin":
            p["levels"] = {s: "full" for s in SECTIONS_UI_IDS}
            p["builtin"] = True
    _CACHE["profils"] = profils
    _CACHE["t"] = now
    return profils


def _niveau_section(profil, section):
    lv = profil.get("levels", {})
    if section == "tiersBancaires":
        # registre technique cree/lie automatiquement avec un client, un employe ou un fournisseur
        liees = ("clients", "personnel", "fournisseurs", "releves", "facturesF")
        niv = [lv.get(x, "none") for x in liees]
        if "full" in niv:
            return "full"
        return "read" if "read" in niv else "none"
    if section in lv:
        return lv[section] if lv[section] in NIVEAUX else "none"
    return "none"


def access_level(role, section):
    if not role:
        return "none"
    if role == "admin":
        return "full"
    for p in get_profils():
        if p["id"] == role:
            return _niveau_section(p, section)
    return "none"


def build_matrix():
    """Meme forme que l'ancienne ACCESS : {section: {profil: niveau}} (consommee par le frontend et filtrer_access)."""
    sections = set(ACCESS.keys()) | set(SECTIONS_UI_IDS)
    out = {}
    for sec in sections:
        out[sec] = {p["id"]: ("full" if p["id"] == "admin" else _niveau_section(p, sec)) for p in get_profils()}
    return out


def valider_profils(profils, ids_utilises):
    """Controle un lot de profils avant enregistrement ; retourne (profils_propres, erreur)."""
    if not isinstance(profils, list) or not profils:
        return None, "Liste de profils invalide."
    propres, vus = [], set()
    for p in profils:
        if not isinstance(p, dict):
            return None, "Profil invalide."
        pid = str(p.get("id") or "").strip()
        label = str(p.get("label") or "").strip()
        if not re.match(r"^[a-z0-9_]{2,40}$", pid):
            return None, "Identifiant de profil invalide : %s" % pid
        if pid in vus:
            return None, "Profil en double : %s" % pid
        if not label:
            return None, "Le nom du profil %s est obligatoire." % pid
        vus.add(pid)
        levels = p.get("levels") if isinstance(p.get("levels"), dict) else {}
        propres.append({
            "id": pid, "label": label, "builtin": pid in {x["id"] for x in PROFILS_ORIGINE},
            "levels": {s: (levels.get(s) if levels.get(s) in NIVEAUX else "none") for s in SECTIONS_UI_IDS},
        })
    if "admin" not in vus:
        return None, "Le profil Administrateur est obligatoire."
    manquants = [r for r in ids_utilises if r not in vus]
    if manquants:
        return None, "Des utilisateurs utilisent encore ces profils : %s" % ", ".join(sorted(set(manquants)))
    return propres, None


def sauver_profils(profils):
    from backend import store
    conn = dbmod.get_connection()
    doc = store.get_doc(conn, "settings", "company") or {}
    doc["accessProfiles"] = profils
    store.set_doc(conn, "settings", "company", doc)
    conn.commit()
    conn.close()
    invalider_cache()


def _resolve_section(path):
    """Renvoie (section, trouvee) : 'trouvee' vaut False si le chemin ne
    correspond a aucune regle connue (cas qui ne devrait jamais arriver en
    pratique, voir enforce_request - traite comme reserve a
    l'administrateur par securite)."""
    m = _COLLECTION_RE.match(path)
    if m:
        collection = m.group(1)
        return COLLECTION_SECTION.get(collection), True
    if path in SECTION_BY_EXACT_PATH:
        return SECTION_BY_EXACT_PATH[path], True
    for prefix, section in SECTION_BY_PREFIX.items():
        if path.startswith(prefix):
            return section, True
    return None, False


# V2.05 : le numero officiel (DEV-/CMD-/CTR-AAAA-NNNN) d'un devis, d'une
# commande client ou d'un contrat n'est normalement attribue qu'une seule
# fois et jamais modifie ensuite (RG-003, voir
# claude/cdc-nomenclature-numerotation-analyse.md). A la demande explicite
# de l'utilisateur, une correction manuelle reste possible (erreur de
# frappe, reprise d'historique...) mais reservee a l'administrateur, quel
# que soit le role qui a normalement le droit d'ecriture sur ces documents
# (ex : commercial sur les devis/commandes). Controle ici plutot que dans
# update_doc() (backend/routes/api.py) pour garder TOUS les controles
# d'acces au meme endroit, meme si c'est le seul qui inspecte le corps de
# la requete plutot que seulement le chemin/la methode.
NUMERO_LOCKED_COLLECTIONS = {"devis", "bonsCommande", "contrats"}


def _is_numero_edit_request(path):
    if request.method != "PATCH":
        return False
    m = _COLLECTION_RE.match(path)
    if not m or m.group(1) not in NUMERO_LOCKED_COLLECTIONS:
        return False
    body = request.get_json(force=True, silent=True)
    return bool(body) and "numero" in body


def _is_bootstrap_first_user_request(path):
    """Autorise, SANS authentification, la creation du tout premier
    utilisateur (forcement role admin, cree par l'assistant de premier
    demarrage) - mais seulement si la collection users est encore
    completement vide. Une fois ce premier compte cree, cette porte se
    referme definitivement : toute ecriture ulterieure sur 'users' exige une
    session administrateur (voir COLLECTION_SECTION['users'] = 'settings')."""
    if request.method != "PUT":
        return False
    if not path.startswith("/api/doc/users/"):
        return False
    return authmod.users_collection_empty()


def enforce_request():
    """Cablee comme app.before_request (voir app.py). Renvoie None pour
    laisser la requete continuer normalement, ou un tuple (reponse, code)
    Flask pour la refuser immediatement."""
    path = request.path
    if not path.startswith("/api/"):
        return None  # page HTML / fichiers statiques : aucune donnee ici

    if path in PUBLIC_EXACT_PATHS or path.startswith(PUBLIC_PREFIX):
        return None

    if path.startswith(ADMIN_ONLY_PREFIX):
        user = authmod.current_user()
        if not user:
            # Avant la creation du tout premier compte (choix du
            # repertoire de la base, reprise eventuelle d'une version
            # precedente), ces routes sont utilisees par l'assistant de
            # premier demarrage, donc forcement sans session encore
            # ouverte. On s'appuie sur DEUX conditions (l'une ou l'autre
            # suffit) plutot que sur la seule absence d'utilisateurs :
            # "adopter" une base d'une version precedente (voir
            # backend/routes/db_admin.py) copie justement des utilisateurs
            # DEJA existants dans la base active, en plein milieu de cet
            # assistant (entre le choix du repertoire et l'appel final a
            # /assistant-initial/terminer) - un bug corrige le 2026-11-05
            # faisait alors echouer cet appel final avec "Authentification
            # requise." (base plus vide, mais ecran de connexion pas encore
            # propose non plus : aucune session ne pouvait exister). Tant
            # que l'assistant n'est pas marque termine sur ce poste, aucun
            # ecran de connexion n'est encore affiche cote frontend : exiger
            # une session ici serait donc un blocage sans issue.
            if authmod.users_collection_empty() or not dbmod.assistant_initial_termine():
                return None
            return jsonify({"error": "Authentification requise."}), 401
        g.current_user = user
        if user.get("role") != "admin":
            return jsonify({"error": "Reserve a l'administrateur."}), 403
        return None

    if path in LOGIN_ONLY_EXACT_PATHS:
        user = authmod.current_user()
        if not user:
            return jsonify({"error": "Authentification requise."}), 401
        g.current_user = user
        return None

    user = authmod.current_user()
    if not user and _is_bootstrap_first_user_request(path):
        return None
    if not user:
        return jsonify({"error": "Authentification requise."}), 401
    g.current_user = user

    if _is_numero_edit_request(path) and user.get("role") != "admin":
        return jsonify({"error": "La modification du numero officiel d'un document est reservee a l'administrateur."}), 403

    section, trouvee = _resolve_section(path)
    if trouvee and section and not modulesmod.is_section_active(section):
        # Module desactive sur ce poste (V1.57, voir backend/modules.py) :
        # inaccessible a TOUT LE MONDE, y compris l'administrateur - ce
        # n'est pas une question de droit, mais d'absence du module sur
        # cette installation. Verifie avant toute logique de role.
        return jsonify({"error": "Ce module n'est pas active sur cette installation."}), 404
    if not trouvee or section is None:
        # Soit la route n'est reconnue par aucune regle de ce module (ne
        # devrait pas arriver, voir les commentaires en tete de fichier),
        # soit c'est bien une collection de l'API generique mais absente de
        # COLLECTION_SECTION (nouvelle collection ajoutee sans mettre a jour
        # cette matrice) : dans les deux cas, ferme par defaut a tout le
        # monde SAUF l'administrateur, plutot que silencieusement laisse
        # passer ou (pire) refuse a l'administrateur lui-meme.
        if user.get("role") != "admin":
            return jsonify({"error": "Acces refuse."}), 403
        return None

    required_write = request.method in WRITE_METHODS
    level = access_level(user.get("role"), section)
    if (required_write and level != "full") or (not required_write and level == "none"):
        return jsonify({"error": "Acces refuse pour ce role."}), 403
    return None
