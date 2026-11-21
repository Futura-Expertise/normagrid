"""
Routes specifiques au module "Releves bancaires" (import PDF -> rapprochement
TIERS -> export Excel). Separe de backend/routes/api.py car cette route traite
un fichier envoye en multipart (upload PDF, puis generation d'un .xlsx en
retour) : ce n'est plus du CRUD generique sur la collection de documents JSON,
mais un traitement metier a part entiere (pdfplumber, calculs, openpyxl).
"""

import datetime
import io
import json

import openpyxl
from flask import Blueprint, jsonify, request, send_file

from backend import db as dbmod
from backend.releve_parser import DEFAULT_TIERS, parse_statement

releve = Blueprint("releve", __name__, url_prefix="/api/releve")

XLSX_COLUMNS = [
    ("dateOp", "Date opération"),
    ("dateVal", "Date valeur"),
    ("libelle1", "Libellé (ligne 1)"),
    ("libelle2", "Libellé (ligne 2)"),
    ("debit", "Débit"),
    ("credit", "Crédit"),
    ("tiers", "TIERS"),
    ("type", "TYPE"),
    ("tva", "TVA"),
    ("client", "Client"),
    ("fournisseur", "Fournisseur"),
    ("facture", "Facture"),
]


def _current_tiers_list():
    conn = dbmod.get_connection()
    from backend import store
    rows = store.list_docs(conn, "tiersBancaires")
    conn.close()
    if not rows:
        return DEFAULT_TIERS
    return [d for _, d in rows]


@releve.post("/parse")
def parse_releve():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier PDF reçu (champ 'file' manquant)"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Aucun fichier PDF sélectionné"}), 400
    pdf_bytes = file.read()
    if not pdf_bytes:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        tiers_list = _current_tiers_list()
        lignes, total_client, total_fournisseur = parse_statement(pdf_bytes, tiers_list)
    except Exception as e:  # pdf illisible, format inattendu, etc.
        return jsonify({"error": "Impossible d'analyser ce PDF : " + str(e)}), 400
    return jsonify({
        "nomFichier": file.filename,
        "lignes": lignes,
        "totalClient": total_client,
        "totalFournisseur": total_fournisseur,
        "nbLignes": len(lignes),
        "nbInconnu": sum(1 for l in lignes if l.get("inconnu")),
    })


@releve.post("/export")
def export_releve():
    """Reconstruit le fichier Excel dans le MEME format que les fichiers
    produits manuellement jusqu'ici (12 colonnes + ligne de totaux Client/
    Fournisseur), a partir des lignes validees/corrigees par l'utilisateur
    dans l'application."""
    body = request.get_json(force=True, silent=True) or {}
    lignes = body.get("lignes") or []
    nom_fichier = body.get("nomFichier") or "releve.xlsx"
    if not nom_fichier.lower().endswith(".xlsx"):
        nom_fichier = nom_fichier.rsplit(".", 1)[0] + ".xlsx"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append([label for _, label in XLSX_COLUMNS])
    total_client = 0.0
    total_fournisseur = 0.0
    for l in lignes:
        row = []
        for key, _ in XLSX_COLUMNS:
            v = l.get(key)
            if key == "tva" and (v is None or v == ""):
                v = "NA"
            row.append(v if v not in (None, "") else None)
        ws.append(row)
        total_client += float(l.get("client") or 0)
        total_fournisseur += float(l.get("fournisseur") or 0)

    totals_row = [None] * len(XLSX_COLUMNS)
    client_idx = [k for k, _ in XLSX_COLUMNS].index("client")
    fourn_idx = [k for k, _ in XLSX_COLUMNS].index("fournisseur")
    totals_row[client_idx] = round(total_client, 2)
    totals_row[fourn_idx] = round(total_fournisseur, 2)
    ws.append(totals_row)

    for col_cells in ws.columns:
        length = max((len(str(c.value)) for c in col_cells if c.value is not None), default=10)
        ws.column_dimensions[col_cells[0].column_letter].width = min(max(length + 2, 10), 48)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=nom_fichier,
    )
