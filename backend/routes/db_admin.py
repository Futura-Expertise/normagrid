"""
Administration de l'emplacement de la base de donnees : Parametres >
Emplacement de la base de donnees (V1.38), assistant de premier demarrage
(V1.40) qui propose les deux memes choix AVANT que l'utilisateur ne
commence a se servir de l'application, boites de dialogue NATIVES
(Explorateur Windows / Finder Mac, V1.42, voir _dialogue_natif() et
/choisir-dossier, /choisir-fichier plus bas) declenchees par le bouton
"Parcourir...", et navigateur de dossiers/fichiers maison (V1.41, voir
/parcourir plus bas) conserve comme repli automatique si jamais la boite
de dialogue native n'est pas disponible sur un poste donne (composant
tkinter manquant). Permet de choisir ou stocker le fichier de base de
donnees (par exemple un disque/partage reseau commun a plusieurs postes,
comme pour le repertoire de stockage des factures fournisseurs), et de
reprendre explicitement la base d'une version precedente de l'application
- puisque chaque version ecrit dans un fichier qui porte son propre
numero de version en suffixe (voir backend/db.py, db_filename()), une
mise a jour vers une nouvelle version ne doit jamais faire croire que les
donnees ont disparu : elles sont toujours la, sous l'ancien nom de
fichier (dans le meme repertoire, ou ailleurs - ex. une copie recuperee
d'un autre poste), et ces ecrans permettent de les "adopter" en un clic.
"""

import datetime
import os
import platform
import re
import shutil
import sqlite3
import string
import subprocess
import sys

from flask import Blueprint, jsonify, request

from backend import db as dbmod
from backend import migration_v3

db_admin = Blueprint("db_admin", __name__, url_prefix="/api/db")


@db_admin.before_request
def _bloquer_en_mode_postgres():
    """Toutes les routes de ce blueprint gerent un fichier SQLite LOCAL
    (emplacement, sauvegardes, reprise d'une version precedente) - notion
    qui n'existe pas en mode PostgreSQL/cloud (V1.55, voir
    claude/architecture-cloud-securite.md) : la base est alors geree par
    l'hebergeur (sauvegardes automatiques), pas par l'application. On
    renvoie un message explicite plutot que de laisser ces routes echouer
    de maniere confuse en tentant d'agir sur un fichier qui n'existe pas."""
    if dbmod.is_postgres() and request.path != "/api/db/assistant-initial":
        return jsonify({
            "ok": False,
            "error": "Non applicable en mode PostgreSQL (hebergement cloud) : "
                     "la base est geree par l'hebergeur, voir ses sauvegardes automatiques.",
        }), 409

_VERSION_FILE_RE = re.compile(r"^chantier_erp_(V[\d.]+)\.db$")


def _scan_db_files(directory):
    """Liste tous les fichiers chantier_erp_V*.db presents dans
    'directory' (nom de fichier reconnu uniquement - jamais un fichier
    quelconque), avec leur version, taille et date de derniere
    modification. Repertoire absent ou inaccessible -> liste vide (jamais
    d'erreur bloquante, ce scan n'est qu'informatif)."""
    out = []
    try:
        names = sorted(os.listdir(directory))
    except Exception:
        return out
    for name in names:
        m = _VERSION_FILE_RE.match(name)
        if not m:
            continue
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        try:
            st = os.stat(path)
        except OSError:
            continue
        out.append({
            "fichier": name,
            "version": m.group(1),
            "taille": st.st_size,
            "modifie": datetime.datetime.utcfromtimestamp(st.st_mtime).isoformat() + "Z",
        })
    # V3.49 : tri decroissant par version (la plus recente en premier),
    # comparaison numerique (V3.10 > V3.9).
    def _cle(f):
        return tuple(int(x) if x.isdigit() else 0 for x in f["version"].lstrip("Vv").split("."))
    out.sort(key=_cle, reverse=True)
    return out


@db_admin.get("/info")
def db_info():
    """Etat actuel de l'emplacement de la base de donnees, pour l'ecran
    Parametres : repertoire courant, fichier de CETTE version (existe
    deja ou sera cree au premier enregistrement), et fichiers d'AUTRES
    versions deja presents dans ce meme repertoire (typiquement la base
    d'une version precedente, juste apres une mise a jour).

    Parametre optionnel '?dir=' : previsualise un AUTRE repertoire que
    celui actuellement configure (ex. pendant la saisie, dans l'assistant
    de premier demarrage, avant toute validation) - lecture seule, ne
    cree ni ne modifie rien, meme si ce repertoire n'existe pas encore."""
    data_dir = (request.args.get("dir") or "").strip() or dbmod.get_data_dir()
    current_name = dbmod.db_filename()
    fichiers = _scan_db_files(data_dir)
    actuel = next((f for f in fichiers if f["fichier"] == current_name), None)
    autres = [f for f in fichiers if f["fichier"] != current_name]
    rap = ""
    try:
        with open(os.path.join(data_dir, migration_v3.RAPPORT_COURANT), encoding="utf-8") as f:
            rap = f.read()
    except Exception:
        pass
    return jsonify({
        "rapportMigration": rap,
        "repertoire": data_dir,
        "parDefaut": os.path.realpath(data_dir) == os.path.realpath(dbmod.DEFAULT_DATA_DIR),
        "fichierActuel": current_name,
        "version": dbmod.APP_VERSION,
        "existeDeja": actuel is not None,
        "taille": actuel["taille"] if actuel else 0,
        "modifie": actuel["modifie"] if actuel else None,
        "versionsPrecedentesDisponibles": autres,
    })


@db_admin.post("/location")
def set_db_location():
    """Change le repertoire contenant le fichier de base de donnees.
    Valide que le nouveau repertoire est accessible en ecriture (le cree
    si besoin), deplace le fichier de CETTE version (s'il existe deja)
    vers le nouveau repertoire, puis met a jour le pointeur de bootstrap
    (db_location.json). Les fichiers d'AUTRES versions restant dans
    l'ancien repertoire ne sont jamais deplaces automatiquement - rien
    n'est perdu, mais ils ne seront plus proposes a l'adoption que si l'on
    revient a cet ancien repertoire. Un chemin vide reinitialise vers le
    repertoire par defaut de l'application."""
    body = request.get_json(force=True, silent=True) or {}
    raw_dir = (body.get("dir") or "").strip()
    new_dir = os.path.abspath(raw_dir) if raw_dir else dbmod.DEFAULT_DATA_DIR

    try:
        os.makedirs(new_dir, exist_ok=True)
    except Exception as e:
        return jsonify({"error": "Impossible de créer/accéder à ce répertoire : " + str(e)}), 400
    test_path = os.path.join(new_dir, ".ecriture_test.tmp")
    try:
        with open(test_path, "w") as f:
            f.write("test")
        os.remove(test_path)
    except Exception as e:
        return jsonify({"error": "Ce répertoire n'est pas accessible en écriture : " + str(e)}), 400

    old_dir = dbmod.get_data_dir()
    old_path = os.path.join(old_dir, dbmod.db_filename())
    new_path = os.path.join(new_dir, dbmod.db_filename())
    moved = False
    if os.path.realpath(old_dir) != os.path.realpath(new_dir) and os.path.isfile(old_path):
        if os.path.exists(new_path):
            return jsonify({
                "error": "Un fichier de base de données de cette version existe déjà dans le "
                         "répertoire de destination : opération annulée pour ne rien perdre. "
                         "Supprimez-le ou choisissez un autre répertoire."
            }), 400
        try:
            shutil.move(old_path, new_path)
            moved = True
        except Exception as e:
            return jsonify({
                "error": "Le nouveau répertoire a été préparé, mais le déplacement du fichier "
                         "de base de données a échoué : " + str(e)
            }), 400

    try:
        dbmod.write_location_config({"dataDir": "" if (new_dir == dbmod.DEFAULT_DATA_DIR and not raw_dir) else new_dir})
    except Exception as e:
        return jsonify({
            "error": "Le fichier a été déplacé, mais l’enregistrement du nouvel emplacement a "
                     "échoué : " + str(e)
        }), 400

    return jsonify({"ok": True, "dir": new_dir, "moved": moved})


def _verifier_base_valide(path):
    """Verification minimale qu'un fichier .db est bien une base
    Chantier ERP exploitable (presence de la table 'documents' du schema
    generique) - evite d'adopter par erreur un fichier quelconque qui
    porterait un nom ressemblant, ou un fichier corrompu. Retourne un
    message d'erreur (str) si invalide, None si valide."""
    try:
        test_conn = sqlite3.connect(path)
        test_conn.execute("SELECT COUNT(*) FROM documents" if sqlite3.connect(path).execute("SELECT 1 FROM sqlite_master WHERE name='documents'").fetchone() else "SELECT COUNT(*) FROM factures")
        test_conn.close()
    except Exception as e:
        return "Ce fichier ne semble pas être une base de données Chantier ERP valide : " + str(e)
    return None


@db_admin.post("/adopter")
def adopter_version_precedente():
    """Reprend un fichier de base de donnees d'une version precedente de
    l'application comme base active de la version COURANTE - typiquement
    apres une mise a jour de version pointee sur le meme repertoire
    partage (sans cette action, l'application repartirait silencieusement
    d'une base vide sous le nouveau nom de fichier, alors que toutes les
    donnees existent toujours sous l'ancien nom), ou apres recuperation
    manuelle d'une copie de l'ancienne base depuis un autre poste/support.

    Deux facons de designer la base a reprendre (mutuellement exclusives) :
    - 'fichier' : nom (pas un chemin) d'un fichier chantier_erp_V*.db deja
      present dans le repertoire courant de la base de donnees (detecte
      par /api/db/info) ;
    - 'cheminSource' : chemin complet vers n'importe quel autre fichier
      .db, ou qu'il se trouve (ex. copie recuperee d'un ancien poste) -
      verifie qu'il s'agit bien d'une base Chantier ERP exploitable avant
      de l'adopter.

    Securite : si un fichier existe deja sous le nom de la version
    courante (ex. quelques donnees deja saisies depuis la mise a jour,
    avant de se rendre compte que l'ancienne base devait etre reprise), il
    est renomme de cote (suffixe .avant_adoption_<horodatage>.bak) plutot
    que supprime ou ecrase - jamais perdu silencieusement. Le fichier
    source, lui, n'est jamais deplace ni modifie : une COPIE en est faite
    sous le nom de la version courante, afin qu'il reste disponible pour
    une eventuelle nouvelle tentative."""
    body = request.get_json(force=True, silent=True) or {}
    fichier = (body.get("fichier") or "").strip()
    chemin_source = (body.get("cheminSource") or "").strip()
    data_dir = dbmod.get_data_dir()

    if chemin_source:
        source = os.path.abspath(chemin_source)
        if not os.path.isfile(source):
            return jsonify({"error": "Ce fichier est introuvable : " + source}), 404
        if not source.lower().endswith(".db"):
            return jsonify({"error": "Le fichier indiqué ne semble pas être une base de données (extension .db attendue)."}), 400
        erreur = _verifier_base_valide(source)
        if erreur:
            return jsonify({"error": erreur}), 400
    else:
        if not fichier or not _VERSION_FILE_RE.match(fichier):
            return jsonify({"error": "Nom de fichier de base de données invalide."}), 400
        source = os.path.join(data_dir, fichier)
        if not os.path.isfile(source):
            return jsonify({"error": "Ce fichier n’existe plus dans le répertoire courant."}), 404

    dest = os.path.join(data_dir, dbmod.db_filename())
    if os.path.realpath(source) == os.path.realpath(dest):
        return jsonify({"error": "Ce fichier est déjà la base active de cette version."}), 400
    sauvegarde = None
    if os.path.isfile(dest):
        horodatage = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        sauvegarde = dest + ".avant_adoption_" + horodatage + ".bak"
        try:
            shutil.move(dest, sauvegarde)
        except Exception as e:
            return jsonify({
                "error": "Impossible de mettre de côté la base actuelle avant adoption : " + str(e)
            }), 400

    try:
        shutil.copy2(source, dest)
    except Exception as e:
        # Echec de la copie : on restaure la base active mise de cote, pour ne jamais
        # laisser l'application sans base de donnees du tout.
        if sauvegarde:
            try:
                shutil.move(sauvegarde, dest)
            except Exception:
                pass
        return jsonify({"error": "La copie a échoué : " + str(e)}), 400

    # V3.00 : si la base adoptee est une base JSON (V2.x), elle est migree vers les tables SQL et
    # verifiee tout de suite. En cas d'ecart, on annule l'adoption : la copie est retiree, la base
    # precedemment active est remise en place, et le rapport est renvoye.
    migre = False
    try:
        migre = migration_v3.est_base_json(dest)
        dbmod.init_db()
    except migration_v3.MigrationRefusee as e:
        try:
            if os.path.exists(dest):
                os.remove(dest)
            if sauvegarde:
                shutil.move(sauvegarde, dest)
        except Exception:
            pass
        return jsonify({"error": "La reprise des données n'est pas complète : l'adoption est annulée.",
                        "rapport": str(e)}), 400
    except Exception:
        pass

    return jsonify({
        "ok": True,
        "fichier": dbmod.db_filename(),
        "sauvegardeAncienne": os.path.basename(sauvegarde) if sauvegarde else None,
        "migre": migre,
    })


@db_admin.get("/rapport-migration")
def rapport_migration():
    """Dernier rapport de migration JSON -> SQL (affiche dans Parametres)."""
    chemin = os.path.join(dbmod.get_data_dir(), migration_v3.RAPPORT_COURANT)
    if not os.path.isfile(chemin):
        return jsonify({"existe": False, "rapport": ""})
    with open(chemin, encoding="utf-8") as f:
        return jsonify({"existe": True, "rapport": f.read(),
                        "date": datetime.datetime.fromtimestamp(os.path.getmtime(chemin)).isoformat()})


@db_admin.get("/assistant-initial")
def assistant_initial_statut():
    """Etat de l'assistant de premier demarrage (V1.40) : tant qu'il n'a
    pas ete marque termine (champ 'assistantInitialTermine' du fichier de
    bootstrap, voir backend/db.py), le frontend l'affiche A LA PLACE de
    l'ecran de connexion habituel, AVANT tout acces aux donnees - pour que
    l'utilisateur choisisse l'emplacement de la base de donnees, et
    recupere eventuellement une base d'une version precedente, avant de
    commencer a se servir de l'application (plutot que de devoir aller le
    faire ensuite dans Parametres, une fois une base vide deja en place).
    Ne cree et ne modifie rien ; inclut les fichiers d'autres versions deja
    detectes dans le repertoire par defaut, pour un premier affichage utile
    sans attendre une saisie de l'utilisateur.

    En mode PostgreSQL (V1.55, hebergement cloud), la notion d'emplacement
    de fichier local n'existe pas : cet assistant est toujours considere
    termine, le frontend passe directement a l'ecran de connexion."""
    if dbmod.is_postgres():
        return jsonify({"termine": True, "repertoireParDefaut": None, "repertoireActuel": None, "versionsPrecedentesDetectees": []})
    cfg = dbmod.read_location_config()
    data_dir = dbmod.get_data_dir()
    current_name = dbmod.db_filename()
    fichiers = _scan_db_files(data_dir)
    autres = [f for f in fichiers if f["fichier"] != current_name]
    return jsonify({
        "termine": bool(cfg.get("assistantInitialTermine")),
        "repertoireParDefaut": dbmod.DEFAULT_DATA_DIR,
        "repertoireActuel": data_dir,
        "versionsPrecedentesDetectees": autres,
    })


@db_admin.post("/assistant-initial/terminer")
def assistant_initial_terminer():
    """Marque l'assistant de premier demarrage comme termine, pour qu'il
    ne soit plus jamais propose automatiquement ensuite (que l'utilisateur
    ait choisi un repertoire personnalise, repris une ancienne base, ou
    simplement demarre avec une base vide) - l'ecran Parametres reste
    disponible a tout moment pour revenir sur ces choix par la suite."""
    dbmod.write_location_config({"assistantInitialTermine": True})
    return jsonify({"ok": True})


def _lister_racines():
    """Points de depart pour la navigation quand aucun chemin n'est
    encore choisi : lettres de disque existantes sous Windows (C:\\,
    D:\\...), racine unique "/" sous Unix/Mac."""
    if platform.system() == "Windows":
        racines = []
        for lettre in string.ascii_uppercase:
            chemin = lettre + ":\\"
            if os.path.exists(chemin):
                racines.append(chemin)
        return racines
    return ["/"]


def _lister_raccourcis():
    """Quelques raccourcis pratiques (dossier personnel, Bureau,
    Documents) pour ne pas forcer l'utilisateur a naviguer depuis la
    racine du disque a chaque fois - uniquement ceux qui existent
    reellement sur ce poste."""
    out = []
    home = os.path.expanduser("~")
    if os.path.isdir(home):
        out.append({"nom": "Dossier personnel", "chemin": home})
    for nom_affiche, sous_dossier in (("Bureau", "Desktop"), ("Documents", "Documents")):
        chemin = os.path.join(home, sous_dossier)
        if os.path.isdir(chemin):
            out.append({"nom": nom_affiche, "chemin": chemin})
    return out


@db_admin.get("/parcourir")
def parcourir():
    """Navigateur de dossiers/fichiers integre (V1.41) : permet de choisir
    un repertoire ou un fichier .db en cliquant, sans jamais taper de
    chemin a la main - les navigateurs web, par securite, ne donnent
    jamais a une page le chemin reel d'un fichier choisi via leur propre
    fenetre native, d'ou ce petit navigateur maison, cote serveur (qui
    tourne sur le poste de l'utilisateur).

    Sans parametre 'chemin' : renvoie les raccourcis (dossier personnel,
    Bureau, Documents) et les racines (disques Windows, ou "/" sous
    Unix/Mac), point de depart de la navigation.

    Avec 'chemin' : liste les sous-dossiers (cliquables pour y entrer) et
    les fichiers .db presents (avec leur version detectee si le nom suit
    la convention chantier_erp_V*.db), plus le chemin du dossier parent
    (pour "Remonter"). Lecture seule - ne cree et ne modifie jamais rien.
    Un element isole illisible (permission refusee, lien casse) est
    simplement ignore plutot que de faire echouer tout l'affichage."""
    chemin = (request.args.get("chemin") or "").strip()

    if not chemin:
        return jsonify({
            "chemin": None,
            "parent": None,
            "raccourcis": _lister_raccourcis(),
            "racines": [{"nom": r, "chemin": r} for r in _lister_racines()],
            "dossiers": [],
            "fichiersDb": [],
        })

    chemin = os.path.abspath(chemin)
    if not os.path.isdir(chemin):
        return jsonify({"error": "Ce dossier n'existe pas ou n'est plus accessible : " + chemin}), 404

    try:
        noms = os.listdir(chemin)
    except PermissionError:
        return jsonify({"error": "Accès refusé à ce dossier."}), 403
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce dossier : " + str(e)}), 400

    dossiers = []
    fichiers_db = []
    for nom in sorted(noms, key=lambda s: s.lower()):
        complet = os.path.join(chemin, nom)
        try:
            if os.path.isdir(complet):
                dossiers.append({"nom": nom, "chemin": complet})
            elif nom.lower().endswith(".db"):
                m = _VERSION_FILE_RE.match(nom)
                try:
                    st = os.stat(complet)
                    taille = st.st_size
                    modifie = datetime.datetime.utcfromtimestamp(st.st_mtime).isoformat() + "Z"
                except OSError:
                    taille = None
                    modifie = None
                fichiers_db.append({
                    "nom": nom,
                    "chemin": complet,
                    "version": m.group(1) if m else None,
                    "taille": taille,
                    "modifie": modifie,
                })
        except OSError:
            continue

    parent = os.path.dirname(chemin)
    if os.path.realpath(parent) == os.path.realpath(chemin):
        parent = None

    return jsonify({
        "chemin": chemin,
        "parent": parent,
        "raccourcis": [],
        "racines": [],
        "dossiers": dossiers,
        "fichiersDb": fichiers_db,
    })


def _dialogue_natif(mode, initial_dir):
    """Affiche la VRAIE boite de dialogue native du systeme d'exploitation
    (Explorateur Windows, Finder Mac, selecteur de fichiers Linux) pour
    choisir un dossier ('mode'=="dossier") ou un fichier .db
    ('mode'=="fichier") - plutot que de recreer un ecran de navigation a
    l'interieur de l'application (V1.41, conserve comme repli ci-dessous).

    Execute dans un SOUS-PROCESSUS Python independant et jetable (jamais
    directement dans le thread de la requete Flask) : la boite de dialogue
    (tkinter) a alors toujours son propre thread principal, quel que soit
    le thread/contexte depuis lequel ce code est appele - important en
    particulier en mode "application de bureau" (desktop.py, fenetre
    pywebview) ou Flask tourne dans un thread secondaire, et sous macOS ou
    les composants graphiques doivent imperativement s'executer sur le
    thread principal d'un processus.

    Retourne (chemin, erreur) : chemin est le chemin choisi (str), ou None
    si l'utilisateur a annule ; erreur est None en cas de succes (dialogue
    affiche normalement, qu'il y ait eu annulation ou non), ou un message
    si la boite de dialogue native n'a pas pu s'afficher du tout (ex.
    tkinter absent de cette installation Python, ou aucun environnement
    graphique disponible) - dans ce cas, l'appelant doit basculer sur le
    navigateur de dossiers maison (V1.41) plutot que d'echouer."""
    titre = "Choisir un répertoire" if mode == "dossier" else "Choisir un fichier de base de données"
    code = (
        "import sys, tkinter, tkinter.filedialog as fd\n"
        "r = tkinter.Tk(); r.withdraw(); r.attributes('-topmost', True)\n"
        "initial = sys.argv[1] or None\n"
        + ("p = fd.askdirectory(initialdir=initial, title=" + repr(titre) + ")\n"
           if mode == "dossier" else
           "p = fd.askopenfilename(initialdir=initial, title=" + repr(titre) +
           ", filetypes=[('Base de données Chantier ERP', '*.db'), ('Tous les fichiers', '*.*')])\n")
        + "r.destroy()\n"
        "sys.stdout.write(p or '')\n"
    )
    try:
        resultat = subprocess.run(
            [sys.executable, "-c", code, initial_dir or ""],
            capture_output=True, text=True, timeout=300,
        )
    except Exception as e:
        return None, "Boîte de dialogue native indisponible : " + str(e)
    if resultat.returncode != 0:
        detail = (resultat.stderr or "").strip().splitlines()[-1] if resultat.stderr else "erreur inconnue"
        return None, "Boîte de dialogue native indisponible : " + detail
    chemin = (resultat.stdout or "").strip()
    return (chemin or None), None


@db_admin.get("/choisir-dossier")
def choisir_dossier():
    """Ouvre l'Explorateur Windows (ou equivalent Mac/Linux) pour choisir
    un repertoire. 'disponible':false => la boite de dialogue native n'a
    pas pu s'afficher sur ce poste, le frontend doit alors utiliser le
    navigateur de dossiers maison (/parcourir) a la place. 'chemin':null
    (avec 'disponible':true) => dialogue affiche normalement mais
    l'utilisateur a clique sur Annuler - ne rien faire dans ce cas."""
    initial = (request.args.get("initial") or "").strip() or None
    chemin, erreur = _dialogue_natif("dossier", initial)
    if erreur:
        return jsonify({"disponible": False, "erreur": erreur})
    return jsonify({"disponible": True, "chemin": chemin})


@db_admin.get("/choisir-fichier")
def choisir_fichier():
    """Ouvre l'Explorateur Windows (ou equivalent Mac/Linux) pour choisir
    un fichier de base de donnees (.db). Memes conventions de reponse que
    /choisir-dossier ci-dessus."""
    initial = (request.args.get("initial") or "").strip() or None
    chemin, erreur = _dialogue_natif("fichier", initial)
    if erreur:
        return jsonify({"disponible": False, "erreur": erreur})
    return jsonify({"disponible": True, "chemin": chemin})
