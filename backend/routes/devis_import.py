"""
Routes du module "Devis" : import direct d'un ou plusieurs fichiers
PDF/photos de devis DEJA EMIS par l'entreprise (a enregistrer
retroactivement dans le registre "Devis"), a l'identique du module
Factures clients (backend.routes.facture_client), dont la structure est
reprise ici telle quelle - demande explicite de l'utilisateur ("ajouter la
possibilite d'importer les devis a l'identique des factures client").

Reutilise directement les fonctions generiques deja eprouvees du module
Factures clients (societe/ICE propre, liste des clients, correspondance
client par sous-chaine, fusion de repertoires, nettoyage de nom de
fichier...) plutot que de les dupliquer.

Stockage des fichiers d'origine, memes deux zones que les factures
clients, sous le repertoire de stockage courant (get_storage_dir()) :
- <stockage>/_pending/<lot>/<fichier> : zone d'attente, le temps de l'ecran
  de relecture obligatoire.
- <stockage>/<annee>/<mois>/<fichier renomme> : zone definitive, un fichier
  y est deplace/renomme uniquement au moment ou le devis correspondant est
  reellement enregistre. Nommage precede du mot "Devis" -
  Devis_AAAA_MM_JJ_NomClient_Reference.<ext> - pour distinguer au premier
  coup d'oeil un fichier de devis importe d'une facture/commande importee.
"""

import datetime
import io
import json
import os
import re
import shutil
import uuid

from flask import Blueprint, jsonify, request, send_file
from pypdf import PdfReader, PdfWriter

from backend import db as dbmod
from backend import store
from backend.devis_parser import guess_fields_devis
from backend.facture_client_parser import split_invoices
from backend.routes.facture_client import (
    _own_company_info, _clients, _match_client_id, _merge_move_dir,
    _is_junk, _split_file_label, _strip_accents, _sanitize_path_component,
)

devis_import = Blueprint("devis_import", __name__, url_prefix="/api/devis-import")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "data", "devis_importes")
os.makedirs(os.path.join(DEFAULT_STORAGE_DIR, "_pending"), exist_ok=True)

ALLOWED_EXT = ("pdf", "jpg", "jpeg", "png")


def get_storage_dir():
    """Repertoire racine de stockage des devis importes (fichiers d'origine
    et classement annee/mois) : par defaut data/devis_importes/ sous
    l'installation de l'application, ou un repertoire choisi par
    l'utilisateur (Parametres > Stockage des devis importes, champ
    'devisImportesDir' de la fiche settings/company) - meme principe que le
    repertoire de stockage configurable des factures clients (V1.46).
    Relu a chaque appel (pas mis en cache) : un changement de reglage prend
    effet immediatement, sans necessiter de relancer l'application."""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            custom = (row.get("devisImportesDir") or "").strip()
            if custom:
                return custom
    except Exception:
        pass
    return DEFAULT_STORAGE_DIR


def get_pending_dir():
    d = os.path.join(get_storage_dir(), "_pending")
    os.makedirs(d, exist_ok=True)
    return d


def _extract_pdf_pages(file_bytes, page_indices):
    reader = PdfReader(io.BytesIO(file_bytes))
    writer = PdfWriter()
    for i in page_indices:
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _process_devis_file(filename_only, data, batch_id, batch_dir, used_names, own_names, own_ice, clients):
    try:
        invoices, ocr_dispo = split_invoices(filename_only, data)
    except Exception:
        invoices, ocr_dispo = [{"pageIndices": [0], "text": "", "ocrUtilise": False, "nbPages": 1}], False
    if not invoices:
        invoices = [{"pageIndices": [0], "text": "", "ocrUtilise": False, "nbPages": 1}]

    ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
    multi = len(invoices) > 1 and ext == "pdf"

    lignes = []
    for idx, inv in enumerate(invoices):
        if multi:
            try:
                piece_bytes = _extract_pdf_pages(data, inv["pageIndices"])
            except Exception:
                piece_bytes = data
            stem, dot, extpart = filename_only.rpartition(".")
            base_label = stem or filename_only
            piece_name = "%s_devis_%d_sur_%d.%s" % (base_label, idx + 1, len(invoices), extpart or "pdf")
            display_name = _split_file_label(filename_only, idx, len(invoices))
        else:
            piece_bytes = data
            piece_name = filename_only
            display_name = filename_only

        dest_name = piece_name
        i = 2
        while dest_name in used_names:
            stem, dot, extpart = piece_name.rpartition(".")
            dest_name = (stem or piece_name) + ("_%d" % i) + (("." + extpart) if dot else "")
            i += 1
        used_names.add(dest_name)
        dest_path = os.path.join(batch_dir, dest_name)
        with open(dest_path, "wb") as f:
            f.write(piece_bytes)

        page_idx = inv["pageIndices"][0] if inv.get("pageIndices") else 0
        try:
            guess = guess_fields_devis(
                inv.get("text") or "", filename_only, file_bytes=data, page_index=page_idx,
                exclude_client_names=own_names, exclude_ice=[own_ice],
            )
        except Exception:
            guess = {
                "numero": filename_only, "date": "", "reference": "", "revision": "00",
                "montantHT": None, "montantTVA": None, "montantTTC": None,
                "client": "", "ice": "", "lignes": [],
            }

        client_id_guess = _match_client_id(guess.get("client"), clients)

        lignes.append({
            "fileRelPath": "_pending/" + batch_id + "/" + dest_name,
            "fileName": display_name,
            "clientNomGuess": guess.get("client") or "",
            "clientIceGuess": guess.get("ice") or "",
            "clientIdGuess": client_id_guess,
            "numero": guess["numero"],
            "date": guess["date"],
            "reference": guess.get("reference") or "",
            "revision": guess.get("revision") or "00",
            "montantHT": guess["montantHT"],
            "montantTVA": guess["montantTVA"],
            "montantTTC": guess["montantTTC"],
            "lignesGuess": guess.get("lignes") or [],
            "ocrUtilise": inv.get("ocrUtilise", False),
            "ocrDisponible": ocr_dispo,
        })
    return lignes


@devis_import.post("/import-files")
def import_files():
    files = [f for f in request.files.getlist("files") if f and f.filename]
    if not files:
        return jsonify({"error": "Aucun fichier reçu"}), 400

    batch_id = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]
    batch_dir = os.path.join(get_pending_dir(), batch_id)
    os.makedirs(batch_dir, exist_ok=True)

    own_names, own_ice = _own_company_info()
    clients = _clients()
    lignes = []
    skipped = 0
    used_names = set()

    for file in files:
        filename_only = os.path.basename(file.filename)
        if _is_junk(filename_only):
            continue
        ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
        if ext not in ALLOWED_EXT:
            skipped += 1
            continue
        data = file.read()
        lignes.extend(_process_devis_file(filename_only, data, batch_id, batch_dir, used_names, own_names, own_ice, clients))

    if not lignes:
        shutil.rmtree(batch_dir, ignore_errors=True)
        return jsonify({"error": "Aucun fichier de devis reconnu (pdf/jpg/jpeg/png attendus)"}), 400

    return jsonify({
        "batchId": batch_id,
        "lignes": lignes,
        "skipped": skipped,
        "ocrDisponible": lignes[0]["ocrDisponible"],
    })


@devis_import.post("/cancel-batch")
def cancel_batch():
    body = request.get_json(force=True, silent=True) or {}
    batch_id = body.get("batchId", "")
    if not re.match(r"^[0-9a-zA-Z\-]+$", batch_id):
        return jsonify({"error": "batchId invalide"}), 400
    pending_dir = get_pending_dir()
    batch_dir = os.path.join(pending_dir, batch_id)
    if os.path.isdir(batch_dir) and os.path.dirname(batch_dir) == pending_dir:
        shutil.rmtree(batch_dir, ignore_errors=True)
    return jsonify({"ok": True})


def build_final_rel_path(date_str, client_nom, reference, ext):
    """Construit le chemin de classement final (annee/mois/nom_fichier) d'un
    devis importe. Nommage precede du mot "Devis" -
    Devis_AAAA_MM_JJ_NomClient_Reference.ext - meme principe que
    build_final_rel_path du module Factures clients."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", (date_str or "").strip())
    if m:
        annee, mois, jour = m.group(1), m.group(2), m.group(3)
    else:
        annee, mois, jour = "AnneeInconnue", "MoisInconnu", "JJ"
    cnom = _sanitize_path_component(client_nom, "Client")
    cref = _sanitize_path_component(reference, "SansReference")
    filename = "Devis_%s_%s_%s_%s_%s.%s" % (annee, mois, jour, cnom, cref, ext.lower())
    return "/".join([annee, mois, filename])


def _resolve_under_storage(rel_path):
    storage_dir = get_storage_dir()
    target = os.path.realpath(os.path.join(storage_dir, rel_path))
    base = os.path.realpath(storage_dir)
    if target != base and not target.startswith(base + os.sep):
        return None
    return target


@devis_import.post("/finalize-file")
def finalize_file():
    body = request.get_json(force=True, silent=True) or {}
    current_rel_path = (body.get("currentRelPath") or "").strip()
    client_nom = (body.get("clientNom") or "").strip()
    date_str = (body.get("date") or "").strip()
    reference = (body.get("reference") or "").strip()

    if not current_rel_path:
        return jsonify({"error": "currentRelPath manquant"}), 400
    source = _resolve_under_storage(current_rel_path)
    if not source or not os.path.isfile(source):
        return jsonify({"error": "Fichier source introuvable"}), 404

    ext = current_rel_path.rsplit(".", 1)[-1].lower() if "." in current_rel_path else "pdf"
    target_rel = build_final_rel_path(date_str, client_nom, reference, ext)
    target = _resolve_under_storage(target_rel)
    if not target:
        return jsonify({"error": "Chemin cible invalide"}), 400

    if os.path.realpath(source) != os.path.realpath(target):
        os.makedirs(os.path.dirname(target), exist_ok=True)
        final_target, final_rel = target, target_rel
        i = 2
        while os.path.exists(final_target) and os.path.realpath(final_target) != os.path.realpath(source):
            stem, dot, extpart = target_rel.rpartition(".")
            final_rel = (stem or target_rel) + ("_%d" % i) + (("." + extpart) if dot else "")
            final_target = _resolve_under_storage(final_rel)
            i += 1
        shutil.move(source, final_target)
        target_rel = final_rel
        src_dir = os.path.dirname(source)
        try:
            if os.path.realpath(src_dir).startswith(os.path.realpath(os.path.join(get_storage_dir(), "_pending")) + os.sep) and not os.listdir(src_dir):
                os.rmdir(src_dir)
        except OSError:
            pass

    return jsonify({"fileRelPath": target_rel})


@devis_import.get("/file/<path:rel_path>")
def get_file(rel_path):
    target = _resolve_under_storage(rel_path)
    if not target:
        return jsonify({"error": "Chemin invalide"}), 400
    if not os.path.isfile(target):
        return jsonify({"error": "Fichier introuvable"}), 404
    return send_file(target)


@devis_import.post("/storage-dir")
def set_storage_dir():
    """Change le repertoire de stockage des devis importes (Parametres >
    Stockage des devis importes). Meme comportement que le repertoire de
    stockage des factures clients (V1.46) : deplace tout le contenu deja
    present dans l'ancien repertoire avant d'enregistrer le reglage, pour
    ne jamais rendre un devis deja enregistre introuvable."""
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
    moved = False
    if os.path.isdir(old_dir) and os.path.realpath(old_dir) != os.path.realpath(new_dir):
        try:
            _merge_move_dir(old_dir, new_dir)
            moved = True
            if old_dir != DEFAULT_STORAGE_DIR:
                try:
                    os.rmdir(old_dir)
                except OSError:
                    pass  # dossier non vide (improbable) ou verrouille : laisse en place, sans erreur bloquante
        except Exception as e:
            return jsonify({"error": "Le nouveau répertoire a été préparé, mais le déplacement des fichiers déjà enregistrés a échoué : " + str(e)}), 400

    os.makedirs(os.path.join(new_dir, "_pending"), exist_ok=True)

    conn = dbmod.get_connection()
    row = store.get_doc(conn, "settings", "company")
    data = dict(row) if row else {}
    data["devisImportesDir"] = "" if new_dir == DEFAULT_STORAGE_DIR and not raw_dir else new_dir
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "dir": new_dir, "moved": moved})
