"""
Routes du module "Factures" (clients) : import direct d'un ou plusieurs
fichiers PDF/photos de factures CLIENTS deja emises par l'entreprise (a
enregistrer retroactivement dans le registre "Factures" - RG-009 du CDC de
nomenclature : "references historiques importees jamais renumerotees,
conservees dans un champ Reference historique dedie"), a l'instar du module
Factures fournisseurs (backend.routes.facture_fournisseur), dont la structure
est reprise ici en version simplifiee (pas de modele de zones, pas de
repertoire source "a traiter" - perimetre volontairement reduit au coeur du
besoin pour la premiere version, cf. echange avec l'utilisateur avant
implementation). Le repertoire de stockage, lui, est devenu configurable
depuis la V1.46 (voir get_storage_dir/set_storage_dir ci-dessous), meme
principe que pour les factures fournisseurs (V1.25).

Stockage des fichiers d'origine, memes deux zones que les factures
fournisseurs, sous le repertoire de stockage courant (get_storage_dir()) :
- <stockage>/_pending/<lot>/<fichier> : zone d'attente, le temps de l'ecran
  de relecture obligatoire.
- <stockage>/<annee>/<mois>/<fichier renomme> : zone definitive, un fichier
  y est deplace/renomme uniquement au moment ou la facture correspondante
  est reellement enregistree (deja validee/verrouillee a cet instant, voir
  static/js/app.js). Nommage DIFFERENT de celui des factures fournisseurs
  (demande explicite de l'utilisateur) : precede du mot "Facture" -
  Facture_AAAA_MM_JJ_NomClient_Reference.<ext> - pour distinguer au premier
  coup d'oeil un fichier de facture client d'un fichier de facture
  fournisseur.
"""

import datetime
import io
import json
import os
import re
import shutil
import unicodedata
import uuid

from flask import Blueprint, jsonify, request, send_file
from pypdf import PdfReader, PdfWriter

from backend import db as dbmod
from backend import store
from backend.facture_client_parser import split_invoices, guess_fields_client

facture_client = Blueprint("facture_client", __name__, url_prefix="/api/facture-client")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "data", "factures_clients")
os.makedirs(os.path.join(DEFAULT_STORAGE_DIR, "_pending"), exist_ok=True)

ALLOWED_EXT = ("pdf", "jpg", "jpeg", "png")


def get_storage_dir():
    """Repertoire racine de stockage des factures clients importees (fichiers
    d'origine et classement annee/mois) : par defaut data/factures_clients/
    sous l'installation de l'application, ou un repertoire choisi par
    l'utilisateur (Parametres > Stockage des factures clients, champ
    'facturesClientsDir' de la fiche settings/company) - meme principe que le
    repertoire de stockage configurable des factures fournisseurs (V1.25).
    Relu a chaque appel (pas mis en cache) : un changement de reglage prend
    effet immediatement, sans necessiter de relancer l'application."""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            custom = (row.get("facturesClientsDir") or "").strip()
            if custom:
                return custom
    except Exception:
        pass
    return DEFAULT_STORAGE_DIR


def get_pending_dir():
    d = os.path.join(get_storage_dir(), "_pending")
    os.makedirs(d, exist_ok=True)
    return d


def _merge_move_dir(src_dir, dst_dir):
    """Deplace tout le contenu de src_dir dans dst_dir, en fusionnant les
    sous-dossiers de meme nom plutot que de les ecraser (utilise lorsqu'on
    change le repertoire de stockage, pour ne jamais perdre une facture deja
    enregistree) ; renomme un fichier en cas de collision de nom plutot que
    de l'ecraser. Repris a l'identique du module Factures fournisseurs.
    src_dir est vide (mais pas supprime) a l'issue de l'appel."""
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


def _is_junk(filename):
    base = os.path.basename(filename)
    return not base or base.startswith(".")


def _extract_pdf_pages(file_bytes, page_indices):
    reader = PdfReader(io.BytesIO(file_bytes))
    writer = PdfWriter()
    for i in page_indices:
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _split_file_label(filename_only, idx, total):
    return "%s (facture %d/%d)" % (filename_only, idx + 1, total)


def _own_company_info():
    names, ice = [], ""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            data = row
            nom = (data.get("nom") or "").strip()
            if nom:
                names.append(nom)
            ice = (data.get("ice") or "").strip()
    except Exception:
        pass
    return names, ice


def _clients():
    try:
        conn = dbmod.get_connection()
        rows = store.list_docs(conn, "clients")
        conn.close()
        out = []
        for did, d in rows:
            d["id"] = did
            out.append(d)
        return out
    except Exception:
        return []


def _match_client_id(nom_devine, clients):
    """Correspondance par sous-chaine (insensible a la casse), meme logique
    que _match_fournisseur_id du module Factures fournisseurs : propose une
    fiche client existante sans jamais en imposer une (le choix final reste
    toujours a l'utilisateur sur l'ecran de relecture)."""
    if not nom_devine:
        return None
    low = nom_devine.strip().lower()
    if len(low) < 3:
        return None
    best_id, best_len = None, 0
    for c in clients:
        nom_c = (c.get("nom") or "").strip().lower()
        if not nom_c or len(nom_c) < 3:
            continue
        if nom_c in low or low in nom_c:
            matched_len = min(len(nom_c), len(low))
            if matched_len > best_len:
                best_id, best_len = c.get("id"), matched_len
    return best_id


def _process_invoice_file(filename_only, data, batch_id, batch_dir, used_names, own_names, own_ice, clients):
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
            piece_name = "%s_facture_%d_sur_%d.%s" % (base_label, idx + 1, len(invoices), extpart or "pdf")
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
            guess = guess_fields_client(
                inv.get("text") or "", filename_only, file_bytes=data, page_index=page_idx,
                exclude_client_names=own_names, exclude_ice=[own_ice],
            )
        except Exception:
            guess = {
                "numero": filename_only, "date": "", "reference": "",
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
            "montantHT": guess["montantHT"],
            "montantTVA": guess["montantTVA"],
            "montantTTC": guess["montantTTC"],
            "lignesGuess": guess.get("lignes") or [],
            "ocrUtilise": inv.get("ocrUtilise", False),
            "ocrDisponible": ocr_dispo,
        })
    return lignes


@facture_client.post("/import-files")
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
        lignes.extend(_process_invoice_file(filename_only, data, batch_id, batch_dir, used_names, own_names, own_ice, clients))

    if not lignes:
        shutil.rmtree(batch_dir, ignore_errors=True)
        return jsonify({"error": "Aucun fichier de facture reconnu (pdf/jpg/jpeg/png attendus)"}), 400

    return jsonify({
        "batchId": batch_id,
        "lignes": lignes,
        "skipped": skipped,
        "ocrDisponible": lignes[0]["ocrDisponible"],
    })


@facture_client.post("/cancel-batch")
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


def _strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _sanitize_path_component(s, fallback):
    s = _strip_accents(s or "")
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")
    return s or fallback


def build_final_rel_path(date_str, client_nom, reference, ext):
    """Construit le chemin de classement final (annee/mois/nom_fichier) d'une
    facture client importee. Nommage volontairement DIFFERENT de celui des
    factures fournisseurs (demande explicite de l'utilisateur) : precede du
    mot "Facture" - Facture_AAAA_MM_JJ_NomClient_Reference.ext - pour
    distinguer au premier coup d'oeil un fichier de facture CLIENT d'un
    fichier de facture FOURNISSEUR, meme classes dans des repertoires
    voisins ou melanges sur un meme support externe."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", (date_str or "").strip())
    if m:
        annee, mois, jour = m.group(1), m.group(2), m.group(3)
    else:
        annee, mois, jour = "AnneeInconnue", "MoisInconnu", "JJ"
    cnom = _sanitize_path_component(client_nom, "Client")
    cref = _sanitize_path_component(reference, "SansReference")
    filename = "Facture_%s_%s_%s_%s_%s.%s" % (annee, mois, jour, cnom, cref, ext.lower())
    return "/".join([annee, mois, filename])


def _resolve_under_storage(rel_path):
    storage_dir = get_storage_dir()
    target = os.path.realpath(os.path.join(storage_dir, rel_path))
    base = os.path.realpath(storage_dir)
    if target != base and not target.startswith(base + os.sep):
        return None
    return target


@facture_client.post("/finalize-file")
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


@facture_client.get("/file/<path:rel_path>")
def get_file(rel_path):
    target = _resolve_under_storage(rel_path)
    if not target:
        return jsonify({"error": "Chemin invalide"}), 400
    if not os.path.isfile(target):
        return jsonify({"error": "Fichier introuvable"}), 404
    return send_file(target)


@facture_client.post("/storage-dir")
def set_storage_dir():
    """Change le repertoire de stockage des factures clients importees
    (Parametres > Stockage des factures clients). Valide que le nouveau
    repertoire est accessible en ecriture (le cree si besoin), puis deplace
    tout le contenu deja present dans l'ancien repertoire (dossier d'attente
    '_pending' + classement annee/mois) vers le nouveau avant d'enregistrer
    le reglage - comportement valide avec l'utilisateur avant implementation
    (meme principe que le repertoire de stockage des factures fournisseurs,
    V1.25), pour ne jamais rendre une facture deja enregistree introuvable
    suite a ce changement. Un chemin vide reinitialise vers le repertoire
    par defaut de l'application."""
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
    data["facturesClientsDir"] = "" if new_dir == DEFAULT_STORAGE_DIR and not raw_dir else new_dir
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "dir": new_dir, "moved": moved})
