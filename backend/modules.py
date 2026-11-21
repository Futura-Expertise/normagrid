"""
Modules desactivables par installation (V1.57, voir
claude/architecture-cloud-securite.md) : jusqu'ici, l'application ne
pouvait etre installee qu'en bloc, tous modules metier confondus (Clients,
Livrables techniques, Comptabilite...), avec simplement les menus et
l'acces masques selon le role connecte. Demande explicite de
l'utilisateur : pouvoir, par exemple, installer Chantier ERP avec
uniquement le module Livrables techniques, sans le module Comptabilite -
pour un autre poste ou un autre usage que celui-ci.

Choix retenu (le plus leger a mettre en oeuvre, suffisant pour le besoin
exprime) : les modules desactives pour UNE installation donnee sont
consignes dans le meme fichier de bootstrap que l'emplacement de la base
(LOCATION_CONFIG_PATH, voir backend/db.py) - une information propre a ce
poste/ce serveur, pas aux donnees elles-memes, donc elle survit a une
reprise de base d'une autre version ou d'un autre poste (backend/routes/db_admin.py,
adopter_version_precedente()) plutot que de "revenir" avec les donnees
adoptees. Le code de chaque module reste present dans le meme paquet
(pas de paquets separes a fabriquer) : un module desactive devient
simplement invisible et inaccessible a l'usage, y compris pour
l'administrateur, cote serveur ET cote interface - jamais une simple
cosmetique qu'un appel direct a l'API contournerait (voir
backend/access.py, enforce_request(), ou chaque section de l'ACCESS
existant est deja revérifiee independamment du role).

Dashboard et Parametres ne font partie d'aucun module : toujours actifs,
pour que l'administrateur puisse toujours revenir reactiver un module
desactive par erreur.

V1.76 : nouveau decoupage demande par l'utilisateur (capture annotee du
menu + "ajouter module contrat / ajouter module RH y integrer personnel"),
avec, au fil de l'echange, les relevés bancaires finalement rattaches a
Comptabilite plutot qu'a Contrat comme d'abord propose :
  - "commercial" ne garde que Clients/Devis - Commandes clients, Contrats,
    Avenants et Attachements en sont retires pour former leur propre
    module "contrat" (nouveau) ;
  - "fournisseurs" perd les relevés bancaires (releves), qui rejoignent
    "compta" ;
  - "personnel" est rebaptise "RH" dans son libelle (id interne inchange,
    pour ne pas invalider un reglage modulesDesactives deja enregistre
    sur un poste existant qui contiendrait "personnel").
Cote frontend (static/js/app.js, NAV_GROUPS), le meme decoupage est
applique en parallele, contrairement a la V1.74 qui n'avait touche que
l'affichage sans ce fichier.
"""

from backend import db as dbmod
from backend.module_defs import DEFS, NOYAU

# V3.01 : la liste des modules n'est plus ecrite ici mais lue dans backend/module_defs/<module>.py
# (un fichier de description par module : dependances, sections, tables, routes).
MODULES = {mod_id: {"label": d["label"], "sections": list(d["sections"])} for mod_id, d in DEFS.items()}

_SECTION_TO_MODULE = {
    section: mod_id
    for mod_id, info in MODULES.items()
    for section in info["sections"]
}


def modules_desactives_explicites():
    """Modules decoches par l'administrateur sur CE poste (fichier de bootstrap, voir docstring
    ci-dessus) - vide par defaut (tous actifs), pour une compatibilite totale avec les
    installations existantes qui n'ont jamais touche a ce reglage."""
    valeurs = dbmod.read_location_config().get("modulesDesactives") or []
    return {m for m in valeurs if m in MODULES}


def modules_desactives(explicites=None):
    """Modules INACTIFS : ceux decoches, plus ceux qui dependent (obligatoirement, directement ou
    non) d'un module inactif - ex. sans Contrat, ni Facturation ni Livrables ni Planification.
    'explicites' permet de simuler un reglage avant de l'enregistrer."""
    inactifs = set(modules_desactives_explicites() if explicites is None else explicites)
    change = True
    while change:
        change = False
        for mod_id, d in DEFS.items():
            if mod_id not in inactifs and any(dep in inactifs for dep in d["depends"]):
                inactifs.add(mod_id)
                change = True
    return inactifs


def dependances_manquantes(mod_id, explicites=None):
    """Modules obligatoires de mod_id qui sont inactifs (liste vide = activable)."""
    inactifs = modules_desactives(explicites)
    return [dep for dep in DEFS[mod_id]["depends"] if dep in inactifs]


def set_modules_desactives(liste):
    """Enregistre la liste des modules desactives (valeurs inconnues
    silencieusement ignorees, par securite si l'appelant envoie un
    identifiant invalide)."""
    valides = sorted({m for m in (liste or []) if m in MODULES})
    dbmod.write_location_config({"modulesDesactives": valides})


def is_section_active(section):
    """False si 'section' appartient a un module desactive sur ce poste -
    True pour toute section hors module (dashboard, settings) ou dont le
    module est actif. Utilise aussi bien par l'enforcement serveur
    (backend/access.py) que par le filtrage de la matrice envoyee au
    frontend (voir filtrer_access ci-dessous)."""
    mod_id = _SECTION_TO_MODULE.get(section)
    if mod_id is None:
        return True
    return mod_id not in modules_desactives()


def filtrer_access(access_matrix):
    """Copie de la matrice ACCESS (backend/access.py) ou chaque section
    d'un module desactive est ramenee a 'none' pour TOUS les roles, y
    compris l'administrateur - c'est ce qui fait disparaitre le menu et
    les boutons correspondants cote interface (voir static/js/app.js,
    canSee()/canWrite()), de maniere coherente avec le refus reel applique
    cote serveur sur les memes sections."""
    desactives = modules_desactives()
    resultat = {}
    for section, roles in access_matrix.items():
        mod_id = _SECTION_TO_MODULE.get(section)
        if mod_id and mod_id in desactives:
            resultat[section] = {role: "none" for role in roles}
        else:
            resultat[section] = dict(roles)
    return resultat


def etat_modules():
    """Liste des modules avec leur etat actif/inactif, pour l'ecran
    Parametres > Modules installes. 'requiert' = modules obligatoires ;
    'bloquePar' = modules obligatoires inactifs qui empechent l'activation."""
    desactives = modules_desactives()
    explicites = modules_desactives_explicites()
    return [
        {"id": mod_id, "label": info["label"], "actif": mod_id not in desactives,
         "requiert": [{"id": d, "label": MODULES[d]["label"]} for d in DEFS[mod_id]["depends"]],
         "bloquePar": [d for d in DEFS[mod_id]["depends"] if d in desactives],
         "decoche": mod_id in explicites}
        for mod_id, info in MODULES.items()
    ]
