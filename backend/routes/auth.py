"""
Routes de connexion/deconnexion (V1.55). Voir backend/auth.py pour la
logique, backend/access.py pour la verification de role appliquee a chaque
requete, et claude/architecture-cloud-securite.md pour la demarche complete.
"""

from flask import Blueprint, jsonify, request

from backend import access as accessmod
from backend import auth as authmod
from backend import db as dbmod
from backend import modules as modulesmod

auth = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth.get("/status")
def status():
    """Seule information exposee sans authentification sur l'etat de la
    base : permet au frontend de savoir s'il doit proposer l'ecran de
    creation du tout premier compte administrateur plutot que l'ecran de
    connexion.

    En usage local (V1.56) : toujours False - current_user() (voir
    backend/auth.py) fournit de toute facon un administrateur
    automatiquement, meme sur une base completement vide ; cet ecran de
    creation de compte n'a donc plus lieu d'etre tant que DATABASE_URL
    n'est pas definie."""
    if not dbmod.auth_required():
        return jsonify({"needsFirstUser": False})
    return jsonify({"needsFirstUser": authmod.users_collection_empty()})


@auth.post("/login")
def login():
    body = request.get_json(force=True, silent=True) or {}
    email = body.get("email", "")
    password = body.get("password", "")
    user = authmod.find_user_by_email(email)
    if (
        not user
        or not user.get("actif", True)
        or not authmod.verify_password(password, user.get("passwordHash"))
    ):
        return jsonify({"error": "Email ou mot de passe incorrect."}), 401
    authmod.log_in(user["id"])
    return jsonify({"ok": True, "user": authmod.strip_secrets(user)})


@auth.post("/logout")
def logout():
    authmod.log_out()
    return jsonify({"ok": True})


@auth.get("/me")
def me():
    user = authmod.current_user()
    return jsonify({"user": user})


@auth.get("/access-matrix")
def access_matrix():
    """Source canonique des droits par role (V1.55) : le frontend l'utilise
    desormais pour afficher/masquer les menus et boutons au lieu de coder la
    meme matrice en dur (static/js/app.js, boot()). Elle ne dispense
    jamais du controle reel : chaque requete de l'API est de toute facon
    revérifiée independamment cote serveur (voir backend/access.py),
    meme si cette reponse etait ignoree ou falsifiee cote client.

    V1.57 : les sections d'un module desactive sur ce poste (voir
    backend/modules.py) sont ramenees a 'none' pour tous les roles ici
    aussi, pour que le menu et les boutons correspondants disparaissent
    cote interface, coherent avec le refus reel applique cote serveur."""
    return jsonify({
        "access": modulesmod.filtrer_access(accessmod.build_matrix()),
        "profiles": [{"id": p["id"], "label": p["label"]} for p in accessmod.get_profils()],
    })


def _admin_requis():
    user = authmod.current_user()
    if not user or user.get("role") != "admin":
        return None, (jsonify({"error": "Reserve a l'administrateur."}), 403)
    return user, None


@auth.get("/access-profiles")
def access_profiles_get():
    """V3.54 : profils et niveaux complets, pour l'ecran Administration > Droits d'acces (admin)."""
    _, err = _admin_requis()
    if err:
        return err
    return jsonify({
        "profiles": accessmod.get_profils(),
        "sections": [{"id": a, "label": b, "group": c} for a, b, c in accessmod.SECTIONS_UI],
    })


@auth.put("/access-profiles")
def access_profiles_put():
    _, err = _admin_requis()
    if err:
        return err
    body = request.get_json(force=True, silent=True) or {}
    utilises = [u.get("role") for u in authmod._all_users() if u.get("role")]
    propres, erreur = accessmod.valider_profils(body.get("profiles"), utilises)
    if erreur:
        return jsonify({"error": erreur}), 400
    accessmod.sauver_profils(propres)
    return jsonify({"ok": True, "profiles": accessmod.get_profils()})


@auth.post("/access-profiles/reset")
def access_profiles_reset():
    _, err = _admin_requis()
    if err:
        return err
    utilises = [u.get("role") for u in authmod._all_users() if u.get("role")]
    defaut = accessmod.profils_par_defaut()
    manquants = [r for r in utilises if r not in {p["id"] for p in defaut}]
    if manquants:
        return jsonify({"error": "Des utilisateurs utilisent des profils personnalises : %s" % ", ".join(sorted(set(manquants)))}), 400
    accessmod.sauver_profils(defaut)
    return jsonify({"ok": True, "profiles": accessmod.get_profils()})
