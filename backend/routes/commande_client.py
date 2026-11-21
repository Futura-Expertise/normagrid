"""
Routes dediees a la piece jointe (scan BC / contrat client) du formulaire
"Commande client" (V2.04). Jusqu'a cette version, ce fichier etait stocke
en base64 directement dans l'enregistrement de la commande (champ
pieceJointeData, voir static/js/app.js, openBCFormModal) - aucun fichier
reel sur le disque, aucun emplacement configurable. Demande explicite de
l'utilisateur : l'enregistrer "de la meme maniere que les autres
documents", c'est-a-dire comme un vrai fichier sur le disque, dans un
repertoire de stockage configurable - meme principe que le repertoire de
stockage des factures clients (backend/routes/facture_client.py, V1.46)
et des factures fournisseurs (V1.25), dont la structure (get_storage_dir/
set_storage_dir/_merge_move_dir) est reprise ici en version simplifiee :
pas de dossier d'attente "_pending" ni de traitement par lot/OCR (perimetre
volontairement reduit, decide avec l'utilisateur avant implementation) -
un seul fichier, deja choisi par l'utilisateur dans le formulaire, est
envoye et classe directement a son emplacement final.

Nommage du fichier classe, pour le distinguer au premier coup d'oeil des
fichiers de Factures clients ("Facture_...") ou fournisseurs :
Contrat_AAAA_MM_JJ_NomClient_NumeroContrat.ext  (V2.14 ; avant : Commande_...)
"""

import datetime
import json
import os
import re
import shutil
import unicodedata

from flask import Blueprint, jsonify, request, send_file

from backend import db as dbmod
from backend import store

commande_client = Blueprint("commande_client", __name__, url_prefix="/api/commande-client")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "data", "commandes_pieces_jointes")
os.makedirs(DEFAULT_STORAGE_DIR, exist_ok=True)

ALLOWED_EXT = ("pdf", "jpg", "jpeg", "png")


def get_storage_dir():
    """Repertoire racine de stockage des pieces jointes de commandes client :
    par defaut data/commandes_pieces_jointes/ sous l'installation, ou un
    repertoire choisi par l'utilisateur (Parametres > Stockage des pieces
    jointes de commandes, champ 'commandesPiecesJointesDir' de la fiche
    settings/company) - meme principe que get_storage_dir() des modules
    Factures clients/fournisseurs. Relu a chaque appel (pas mis en cache)."""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            custom = (row.get("commandesPiecesJointesDir") or "").strip()
            if custom:
                return custom
    except Exception:
        pass
    return DEFAULT_STORAGE_DIR


def _merge_move_dir(src_dir, dst_dir):
    """Repris a l'identique de backend/routes/facture_client.py : deplace
    tout le contenu de src_dir dans dst_dir, en fusionnant les sous-dossiers
    de meme nom et en renommant en cas de collision de fichier plutot que
    d'ecraser quoi que ce soit."""
    os.makedirs(dst_dir, exist_ok=True)
    for name in os.listdir(src_dir):
        s = os.path.join(src_dir, name)
        d = os.path.join(dst_dir, name)
        if os.path.isdir(s):
            if os.path.isdir(d):
                _merge_move_dir(s, d)
                try:
                    os.rmdir(s)
                except OSError:
                    pass
            elif os.path.exists(d):
                i = 2
                cand = d + "_%d" % i
                while os.path.exists(cand):
                    i += 1
                    cand = d + "_%d" % i
                shutil.move(s, cand)
            else:
                shutil.move(s, d)
        else:
            if os.path.exists(d):
                stem, dot, ext = name.rpartition(".")
                i = 2
                cand_name = (stem or name) + ("_%d" % i) + (("." + ext) if dot else "")
                cand = os.path.join(dst_dir, cand_name)
                while os.path.exists(cand):
                    i += 1
                    cand_name = (stem or name) + ("_%d" % i) + (("." + ext) if dot else "")
                    cand = os.path.join(dst_dir, cand_name)
                d = cand
            shutil.move(s, d)


def _strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _sanitize_path_component(s, fallback):
    s = _strip_accents(s or "")
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")
    return s or fallback


def build_rel_path(date_str, client_nom, numero, ext):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", (date_str or "").strip())
    if m:
        annee, mois = m.group(1), m.group(2)
    else:
        annee, mois = "AnneeInconnue", "MoisInconnu"
    cnom = _sanitize_path_component(client_nom, "Client")
    cnum = _sanitize_path_component(numero, "SansNumero")
    filename = "Contrat_%s_%s_%s_%s.%s" % (annee, mois, cnom, cnum, ext.lower())
    return "/".join([annee, mois, filename])


def _resolve_under_storage(rel_path):
    storage_dir = get_storage_dir()
    target = os.path.realpath(os.path.join(storage_dir, rel_path))
    base = os.path.realpath(storage_dir)
    if target != base and not target.startswith(base + os.sep):
        return None
    return target


@commande_client.post("/piece-jointe")
def upload_piece_jointe():
    """Recoit le fichier choisi dans le formulaire (multipart/form-data,
    champ 'file') et les quelques infos de classement (numero/clientNom/
    date de la commande), l'ecrit directement a son emplacement final
    classe (annee/mois) sous le repertoire de stockage courant. Un seul
    fichier a la fois (pas de lot/pending) : contrairement aux imports de
    factures, ce fichier est deja choisi/confirme par l'utilisateur dans un
    formulaire existant, il n'y a pas d'ecran de relecture intermediaire."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    filename_only = os.path.basename(file.filename)
    ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
    if ext not in ALLOWED_EXT:
        return jsonify({"error": "Type de fichier non autorisé (pdf/jpg/jpeg/png attendus)"}), 400

    numero = (request.form.get("numero") or "").strip()
    client_nom = (request.form.get("clientNom") or "").strip()
    date_str = (request.form.get("date") or "").strip()

    rel_path = build_rel_path(date_str, client_nom, numero, ext)
    target = _resolve_under_storage(rel_path)
    if not target:
        return jsonify({"error": "Chemin cible invalide"}), 400

    if os.path.exists(target):
        stem, dot, extpart = rel_path.rpartition(".")
        i = 2
        candidate_rel, candidate_target = rel_path, target
        while os.path.exists(candidate_target):
            candidate_rel = (stem or rel_path) + ("_%d" % i) + (("." + extpart) if dot else "")
            candidate_target = _resolve_under_storage(candidate_rel)
            i += 1
        rel_path, target = candidate_rel, candidate_target

    os.makedirs(os.path.dirname(target), exist_ok=True)
    file.save(target)
    return jsonify({"fileRelPath": rel_path, "fileName": filename_only})


@commande_client.get("/piece-jointe/<path:rel_path>")
def get_piece_jointe(rel_path):
    """V2.06 : servie en telechargement explicite (as_attachment=True),
    demande directe de l'utilisateur ("la piece jointe au bon de commande
    doit etre telechargeable") - avant cette version, send_file() sans
    as_attachment laissait le navigateur decider (le plus souvent un
    simple apercu dans un nouvel onglet pour un PDF/image, pas un
    telechargement reel). Le nom propose au telechargement est le nom
    d'ORIGINE du fichier (parametre 'name', voir commandePieceJointeUrl()
    cote frontend) plutot que le nom classe sur disque (illisible pour
    l'utilisateur, ex. 'Commande_2026_01_Client_X_CMD-2026-0001.pdf') -
    a defaut (lien direct sans ce parametre), replie sur le nom de fichier
    sur disque."""
    target = _resolve_under_storage(rel_path)
    if not target:
        return jsonify({"error": "Chemin invalide"}), 400
    if not os.path.isfile(target):
        return jsonify({"error": "Fichier introuvable"}), 404
    download_name = (request.args.get("name") or "").strip() or os.path.basename(target)
    return send_file(target, as_attachment=True, download_name=download_name)


@commande_client.post("/piece-jointe-storage-dir")
def set_storage_dir():
    """Change le repertoire de stockage des pieces jointes de commandes
    client (Parametres > Stockage des pieces jointes de commandes). Meme
    principe que set_storage_dir() des modules Factures clients/
    fournisseurs : valide l'ecriture, deplace tout le contenu deja present
    vers le nouveau repertoire avant d'enregistrer le reglage, pour ne
    jamais rendre une piece jointe deja enregistree introuvable. Un chemin
    vide reinitialise vers le repertoire par defaut de l'application."""
    body = request.get_json(force=True, silent=True) or {}
    raw_dir = (body.get("dir") or "").strip()
    new_dir = os.path.abspath(raw_dir) if raw_dir else DEFAULT_STORAGE_DIR

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

    old_dir = get_storage_dir()
    if os.path.isdir(old_dir) and os.path.realpath(old_dir) != os.path.realpath(new_dir):
        try:
            _merge_move_dir(old_dir, new_dir)
            if old_dir != DEFAULT_STORAGE_DIR:
                try:
                    os.rmdir(old_dir)
                except OSError:
                    pass
        except Exception as e:
            return jsonify({"error": "Le nouveau répertoire a été préparé, mais le déplacement des fichiers déjà enregistrés a échoué : " + str(e)}), 400

    conn = dbmod.get_connection()
    row = store.get_doc(conn, "settings", "company")
    data = dict(row) if row else {}
    data["commandesPiecesJointesDir"] = "" if new_dir == DEFAULT_STORAGE_DIR and not raw_dir else new_dir
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()
    return jsonify({"dir": data["commandesPiecesJointesDir"] or DEFAULT_STORAGE_DIR})
