"""
API REST generique imitant la semantique Firestore utilisee par le frontend
d'origine (window.claude.use('db') -> db.collection(path) / db.doc(path)).

Chaque "document" (collection, id) est lu/ecrit via backend/store.py, qui le range
dans les tables relationnelles V3 et le reconstitue en JSON a la lecture. Aucune route n'est specifique a un module
metier (clients, devis, factures...) : c'est le meme mecanisme generique pour
toutes les collections, cote client comme cote serveur.
"""

import datetime
import json

from flask import Blueprint, jsonify, request

from backend import auth as authmod
from backend import db as dbmod
from backend import store

api = Blueprint("api", __name__, url_prefix="/api")


def _now():
    return datetime.datetime.utcnow().isoformat() + "Z"


def _strip_user_secrets_if_needed(collection, doc):
    """La collection 'users' est la SEULE exception a l'agnosticisme de
    cette API generique (voir backend/auth.py) : le mot de passe hache ne
    doit jamais etre renvoye au client, meme hache - defense en profondeur,
    il n'a besoin d'exister que cote serveur."""
    if collection == "users":
        return authmod.strip_secrets(doc)
    return doc


def _hash_user_password_if_needed(collection, data):
    """Deuxieme exception volontaire (voir backend/auth.py) : si le client
    envoie un champ 'password' en clair pour la collection 'users' (creation
    ou changement de mot de passe), il est transforme ici en 'passwordHash'
    avant tout contact avec la base - le mot de passe en clair n'est jamais
    ecrit, meme temporairement. Un champ 'password' vide est simplement
    retire (cas du formulaire de modification d'un utilisateur quand on ne
    souhaite pas changer son mot de passe) sans toucher au hash existant."""
    if collection != "users":
        return data
    data = dict(data)
    plain = data.pop("password", None)
    if plain:
        data["passwordHash"] = authmod.hash_password(plain)
    data.pop("pin", None)  # champ retire (V1.55) : remplace par passwordHash
    return data


@api.get("/ping")
def ping():
    return jsonify({"ok": True})


@api.get("/personnel-light")
def personnel_light():
    """V1.65 : liste minimale et non sensible du registre Personnel (id, nom,
    fonction, actif - JAMAIS le salaire ni les autres champs RH), utilisee
    par le module de planification pour affecter des personnes aux livrables
    techniques. Route dediee plutot que GET /api/collection/personnel : elle
    reste accessible au Conducteur de travaux (role 'chantier'), qui a
    l'acces complet aux Livrables techniques mais aucun acces au registre
    Personnel complet (voir claude/module-personnel.md - le salaire y est
    une donnee sensible reservee a Administrateur/Comptable). Le controle
    d'acces de cette route suit la section 'livrables' (voir
    backend/access.py, SECTION_BY_EXACT_PATH), pas 'personnel'."""
    conn = dbmod.get_connection()
    docs = store.list_docs(conn, "personnel")
    conn.close()
    result = []
    for did, doc in docs:
        result.append({
            "id": did,
            "nom": doc.get("nom") or "",
            "fonction": doc.get("fonction") or "",
            "actif": doc.get("actif", True),
        })
    result.sort(key=lambda x: (x["nom"] or "").lower())
    return jsonify(result)


@api.get("/collection/<name>")
def list_collection(name):
    conn = dbmod.get_connection()
    docs = store.list_docs(conn, name)
    conn.close()
    result = []
    for did, doc in docs:
        doc["id"] = did
        result.append(_strip_user_secrets_if_needed(name, doc))
    return jsonify(result)


@api.get("/doc/<path:doc_path>")
def get_doc(doc_path):
    collection, doc_id = _split_path(doc_path)
    conn = dbmod.get_connection()
    doc = store.get_doc(conn, collection, doc_id) if collection in store.sm.MAIN else None
    conn.close()
    if doc is None:
        return jsonify({"exists": False, "data": None})
    return jsonify({"exists": True, "data": _strip_user_secrets_if_needed(collection, doc)})


def _ecrire(fonction):
    """Execute une ecriture dans une transaction ; refus de la base -> reponse JSON claire (409/400)."""
    conn = dbmod.get_connection()
    try:
        resultat = fonction(conn)
        conn.commit()
        return resultat, None
    except store.StoreError as e:
        conn.rollback()
        return None, (jsonify({"error": str(e)}), e.status)
    finally:
        conn.close()


@api.put("/doc/<path:doc_path>")
def set_doc(doc_path):
    """Remplace entierement le document (equivalent de ref.set())."""
    collection, doc_id = _split_path(doc_path)
    data = request.get_json(force=True, silent=True) or {}
    data = _hash_user_password_if_needed(collection, data)
    _, err = _ecrire(lambda c: store.set_doc(c, collection, doc_id, data))
    if err:
        return err
    return jsonify({"ok": True, "id": doc_id}), 201


@api.patch("/doc/<path:doc_path>")
def update_doc(doc_path):
    """Fusionne les champs fournis dans le document existant (ref.update())."""
    collection, doc_id = _split_path(doc_path)
    patch = request.get_json(force=True, silent=True) or {}
    patch = _hash_user_password_if_needed(collection, patch)
    _, err = _ecrire(lambda c: store.merge_doc(c, collection, doc_id, patch))
    if err:
        return err
    return jsonify({"ok": True, "id": doc_id})


@api.post("/increment/<path:doc_path>")
def increment_doc(doc_path):
    """Incremente un champ numerique du document en une seule transaction (generateur de sequence
    centralise, RG-001/002 du CDC de nomenclature). SQLite serialise les ecrivains : BEGIN IMMEDIATE
    prend la main avant de lire, donc deux appels concurrents ne lisent jamais la meme valeur."""
    collection, doc_id = _split_path(doc_path)
    body = request.get_json(force=True, silent=True) or {}
    field = body.get("field")
    step = int(body.get("step", 1))
    if not field:
        return jsonify({"error": "champ 'field' manquant"}), 400
    conn = dbmod.get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        value = store.increment(conn, collection, doc_id, field, step)
        conn.commit()
    except store.StoreError as e:
        conn.rollback()
        return jsonify({"error": str(e)}), e.status
    finally:
        conn.close()
    return jsonify({"ok": True, "value": value})


@api.delete("/doc/<path:doc_path>")
def delete_doc(doc_path):
    collection, doc_id = _split_path(doc_path)
    _, err = _ecrire(lambda c: store.delete_doc(c, collection, doc_id))
    if err:
        return err
    return jsonify({"ok": True})


def _split_path(doc_path):
    if "/" not in doc_path:
        raise ValueError("chemin de document invalide : " + doc_path)
    collection, doc_id = doc_path.split("/", 1)
    return collection, doc_id


@api.errorhandler(ValueError)
def handle_value_error(e):
    return jsonify({"error": str(e)}), 400
