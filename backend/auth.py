"""
Authentification par email + mot de passe, avec session serveur (V1.55).

Remplace l'ancien systeme "choix de profil + code PIN" (V1.1 a V1.54), qui
n'etait jamais verifie que cote navigateur - voir
claude/architecture-cloud-securite.md pour le diagnostic complet. Desormais
chaque requete de l'API est reellement authentifiee cote serveur (voir
backend/access.py, enforce_request()).

Le mot de passe (hache, jamais stocke en clair) est conserve DANS le
document JSON generique de la collection 'users', au champ 'passwordHash' -
pas de nouvelle table, par fidelite au modele "documents generiques"
existant (voir backend/db.py). Deux exceptions volontaires a l'agnosticisme
de l'API generique, toutes deux necessaires a une securite reelle (voir
backend/routes/api.py, set_doc/update_doc/list_collection/get_doc) :

  1. un champ 'password' (en clair) envoye par le client pour la collection
     'users' est transforme ici en 'passwordHash' avant d'etre persiste, et
     le champ en clair n'est jamais ecrit en base ;
  2. 'passwordHash' n'est jamais renvoye au client, meme hache - defense en
     profondeur, il n'a besoin d'exister que cote serveur.
"""

import json

from flask import g, session
from werkzeug.security import check_password_hash, generate_password_hash

from backend import db as dbmod

SESSION_KEY = "user_id"


def hash_password(plain):
    return generate_password_hash(plain)


def verify_password(plain, hashed):
    if not hashed or not plain:
        return False
    try:
        return check_password_hash(hashed, plain)
    except Exception:
        return False


def strip_secrets(user_doc):
    """Copie du document utilisateur sans les champs qui ne doivent jamais
    etre renvoyes au client (passwordHash, et l'ancien champ pin qu'il
    remplace)."""
    safe = dict(user_doc)
    safe.pop("passwordHash", None)
    safe.pop("pin", None)
    return safe


def _all_users():
    conn = dbmod.get_connection()
    from backend import store
    rows = store.list_docs(conn, "users")
    conn.close()
    result = []
    for did, doc in rows:
        doc["id"] = did
        result.append(doc)
    return result


def users_collection_empty():
    return len(_all_users()) == 0


def find_user_by_email(email):
    email_norm = (email or "").strip().lower()
    if not email_norm:
        return None
    for u in _all_users():
        if (u.get("email") or "").strip().lower() == email_norm:
            return u
    return None


def get_user_by_id(user_id):
    if not user_id:
        return None
    conn = dbmod.get_connection()
    from backend import store
    doc = store.get_doc(conn, "users", user_id)
    conn.close()
    if not doc:
        return None
    doc["id"] = user_id
    return doc


def _local_mode_admin_user():
    """Utilisateur administrateur automatique pour l'usage local (V1.56,
    voir claude/architecture-cloud-securite.md) : demande explicite de
    l'utilisateur, pour ne plus jamais avoir d'ecran de connexion a
    franchir tant que l'application tourne en local (SQLite, un seul
    poste) - exactement le comportement d'avant la V1.55 (acces complet
    immediat), choisi consciemment en echange de la simplicite, sur la
    base que ce mode n'est de toute facon pas expose au reseau. Repris sur
    le PREMIER compte de role admin trouve dans la base (ses informations
    reelles : nom, email...), pour que les traces createdAt/creePar
    restent lisibles ; a defaut (base locale completement vide, aucun
    compte encore cree), un administrateur "virtuel" minimal est fourni
    pour que l'application reste utilisable sans rien demander, y compris
    au tout premier demarrage."""
    try:
        admins = [u for u in _all_users() if u.get("role") == "admin" and u.get("actif", True)]
    except Exception:
        admins = []
    if admins:
        return strip_secrets(admins[0])
    return {"id": "local-admin", "nom": "Administrateur", "role": "admin", "email": None, "actif": True}


def current_user():
    """Utilisateur courant (dict, sans passwordHash/pin).

    En usage local (sans DATABASE_URL, voir backend/db.py is_postgres()) :
    renvoie TOUJOURS un administrateur, sans jamais consulter la session -
    aucun ecran de connexion, aucune authentification requise (V1.56,
    demande explicite de l'utilisateur). La verification reelle par
    mot de passe (V1.55) reste strictement appliquee des que DATABASE_URL
    est definie (hebergement cloud, plusieurs employes a distance) :
    jamais contournee dans ce cas.

    En mode PostgreSQL/cloud : comportement V1.55 inchange - None si
    personne n'est connecte ou si le compte a ete desactive/supprime
    depuis la connexion, re-verifie a chaque requete."""
    if "current_user" in g:
        return g.current_user
    if not dbmod.auth_required():
        result = _local_mode_admin_user()
        g.current_user = result
        return result
    user_id = session.get(SESSION_KEY)
    user = get_user_by_id(user_id) if user_id else None
    if user and not user.get("actif", True):
        user = None
    result = strip_secrets(user) if user else None
    g.current_user = result
    return result


def log_in(user_id):
    session.clear()
    session[SESSION_KEY] = user_id
    session.permanent = True


def log_out():
    session.clear()
