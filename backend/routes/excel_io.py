"""
Import / export Excel (.xlsx) pour les registres "Clients" et
"Fournisseurs" (collection 'tiersBancaires', type = "Fournisseur").

Deux operations generiques, parametrees par un schema de colonnes propre a
chaque registre (CLIENT_FIELDS / FOURNISSEUR_FIELDS) :

- Export (GET) : genere un classeur .xlsx avec une ligne d'en-tete (libelles
  humains) et une ligne par fiche existante, dans le meme ordre de colonnes
  que l'import sait relire - un export puis reimport sans aucune
  modification ne doit rien changer en base.
- Import, en deux temps (comme l'import CSV existant pour les clients,
  genneralise ici a l'Excel et aux deux registres) :
  1. POST /api/excel/parse : lit le fichier .xlsx envoye (openpyxl, cote
     serveur - un navigateur ne sait pas decoder un .xlsx lui-meme) et
     renvoie {headers, rows} en texte brut, pour que le frontend propose une
     correspondance de colonnes (et un apercu) avant tout enregistrement.
  2. Le frontend applique ensuite lui-meme la correspondance choisie et
     enregistre chaque ligne via l'API generique /api/doc/... existante,
     fiche par fiche - avec mise a jour de la fiche existante (correspondance
     par ICE, sinon par nom) plutot que creation systematique, pour permettre
     un cycle export -> correction dans Excel -> reimport sans creer de
     doublons (comportement valide avec l'utilisateur avant implementation).
"""

import io

import openpyxl
from flask import Blueprint, jsonify, request, send_file

from backend import db as dbmod

excel_io = Blueprint("excel_io", __name__, url_prefix="/api/excel")

# Schema de colonnes partage par l'export et l'import, dans l'ordre affiche -
# volontairement limite aux champs "fiche" (commerciaux/administratifs) :
# les champs techniques propres au rapprochement bancaire des fournisseurs
# (mot-cle, type, TVA) ne transitent jamais par cet aller-retour Excel, pour
# ne jamais risquer de casser silencieusement une reconnaissance de releve
# deja en place en reimportant une liste qui ne les mentionne pas.
CLIENT_FIELDS = [
    ("nom", "Raison sociale / Nom"),
    ("ice", "ICE"),
    ("identifiantFiscal", "Identifiant fiscal (IF)"),
    ("rc", "RC"),
    ("patente", "Patente"),
    ("adresse", "Adresse"),
    ("ville", "Ville"),
    ("telephone", "Téléphone"),
    ("email", "Email"),
    ("contact", "Contact"),
    ("notes", "Notes"),
]

FOURNISSEUR_FIELDS = [
    ("tiers", "Raison sociale / Nom"),
    ("ice", "ICE"),
    ("identifiantFiscal", "Identifiant fiscal (IF)"),
    ("rc", "RC"),
    ("patente", "Patente"),
    ("adresse", "Adresse"),
    ("ville", "Ville"),
    ("telephone", "Téléphone"),
    ("email", "Email"),
    ("contact", "Contact"),
    ("notes", "Notes"),
]


def _rows_for_collection(collection_name, fields, type_filter=None):
    conn = dbmod.get_connection()
    from backend import store
    rows = store.list_docs(conn, collection_name)
    conn.close()
    out = []
    for _, d in rows:
        if type_filter and (d.get("type") or "").strip().lower() != type_filter.lower():
            continue
        out.append([d.get(key, "") or "" for key, _ in fields])
    return out


def _build_xlsx(fields, rows, sheet_title):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title[:31] if sheet_title else "Feuille"
    ws.append([label for _, label in fields])
    for row in rows:
        ws.append(row)
    for col_cells in ws.columns:
        length = max((len(str(c.value)) for c in col_cells if c.value is not None), default=10)
        ws.column_dimensions[col_cells[0].column_letter].width = min(max(length + 2, 10), 48)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@excel_io.get("/clients/export")
def export_clients():
    rows = _rows_for_collection("clients", CLIENT_FIELDS)
    buf = _build_xlsx(CLIENT_FIELDS, rows, "Clients")
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="clients.xlsx",
    )


@excel_io.get("/fournisseurs/export")
def export_fournisseurs():
    rows = _rows_for_collection("tiersBancaires", FOURNISSEUR_FIELDS, type_filter="Fournisseur")
    buf = _build_xlsx(FOURNISSEUR_FIELDS, rows, "Fournisseurs")
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="fournisseurs.xlsx",
    )


@excel_io.post("/parse")
def parse_excel():
    """Lit un fichier .xlsx envoye (champ multipart 'file') et renvoie ses
    en-tetes (1ere ligne) et ses donnees (lignes suivantes) en texte brut,
    pour que le frontend construise son propre ecran de correspondance de
    colonnes - ce point d'entree ne connait aucun champ metier, il ne fait
    que decoder le classeur."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Aucun fichier sélectionné"}), 400
    data = file.read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
        ws = wb.worksheets[0]
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400

    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        return jsonify({"headers": [], "rows": []})
    headers = [("" if v is None else str(v).strip()) for v in header_row]
    # Ignore les colonnes d'en-tete totalement vides en fin de ligne (plage
    # Excel parfois plus large que les donnees reelles) pour ne pas proposer
    # de colonnes fantomes dans la correspondance.
    while headers and not headers[-1]:
        headers.pop()
    ncols = len(headers)

    rows = []
    for raw in rows_iter:
        if raw is None:
            continue
        vals = [("" if v is None else str(v).strip()) for v in raw[:ncols]]
        while len(vals) < ncols:
            vals.append("")
        if any(v for v in vals):
            rows.append(vals)
    wb.close()
    return jsonify({"headers": headers, "rows": rows})
