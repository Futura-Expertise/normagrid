"""
Outils Excel generiques (V2.16) : export / import des Livrables et des
Bordereaux d'envoi avec LISTES DEROULANTES.

Ce module ne connait AUCUN champ metier. Deux points d'entree seulement :

- POST /api/xlsx-tools/build (JSON -> .xlsx) : le frontend decrit le
  classeur (feuilles, colonnes, lignes, listes de choix, couleurs) ; le
  serveur le fabrique avec openpyxl. Les colonnes "a liste" recoivent une
  validation de donnees Excel (menu deroulant + refus de toute valeur hors
  liste) adossee a une feuille "Listes" - plus fiable qu'une liste en ligne,
  limitee par Excel a 255 caracteres.
- POST /api/xlsx-tools/read (multipart .xlsx -> JSON) : decode TOUTES les
  feuilles en texte brut (dates converties en AAAA-MM-JJ), avec le numero
  de ligne Excel d'origine, pour que le frontend compare, valide et
  presente l'ecran de relecture colore.

Aucune ecriture en base ici : l'enregistrement effectif passe ensuite par
les routes generiques /api/doc/..., deja protegees par role (meme principe
que /api/excel/parse et /api/livrables-import/parse).
"""

import datetime
import io
import re

import openpyxl
from flask import Blueprint, jsonify, request, send_file
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

xlsx_tools = Blueprint("xlsx_tools", __name__, url_prefix="/api/xlsx-tools")

# Lignes pre-validees sous les donnees (liste deroulante disponible aussi
# sur les lignes que l'utilisateur ajoutera lui-meme).
EXTRA_ROWS = 400

HEADER_FILL = PatternFill("solid", fgColor="1F3A5F")
HEADER_FONT = Font(bold=True, color="FFFFFF")
INFO_HEADER_FILL = PatternFill("solid", fgColor="7F8C9B")
LIST_HEADER_FILL = PatternFill("solid", fgColor="2E7D6B")
THIN = Side(style="thin", color="D0D5DB")

_COLOR_RE = re.compile(r"^[0-9A-Fa-f]{6}$")


def _color(c, default=None):
    if isinstance(c, str):
        c = c.lstrip("#")
        if _COLOR_RE.match(c):
            return c.upper()
    return default


def _safe_title(name, fallback):
    name = re.sub(r"[\[\]\*\?/\\:]", " ", str(name or "")).strip() or fallback
    return name[:31]


def _to_date(s):
    if isinstance(s, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        try:
            return datetime.date.fromisoformat(s)
        except ValueError:
            return None
    return None


def _style_cell(cell, spec):
    fill = _color(spec.get("fill"))
    if fill:
        cell.fill = PatternFill("solid", fgColor=fill)
    font_kw = {}
    if spec.get("bold"):
        font_kw["bold"] = True
    if spec.get("strike"):
        font_kw["strike"] = True
    fc = _color(spec.get("color"))
    if fc:
        font_kw["color"] = fc
    if font_kw:
        cell.font = Font(**font_kw)
    if spec.get("comment"):
        from openpyxl.comments import Comment
        cell.comment = Comment(str(spec["comment"])[:600], "ERP")


@xlsx_tools.post("/build")
def build():
    spec = request.get_json(silent=True) or {}
    sheets = spec.get("sheets") or []
    if not sheets:
        return jsonify({"error": "Aucune feuille à générer"}), 400
    lists = spec.get("lists") or {}

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # --- Feuille "Listes" (creee d'abord pour connaitre les plages) -----
    list_ranges = {}
    list_names = list(lists.keys())
    used_titles = set()
    sheet_titles = []
    for sh in sheets:
        t = _safe_title(sh.get("name"), "Feuille")
        base, i = t, 2
        while t.lower() in used_titles or t.lower() in ("listes",):
            t = (base[:28] + " " + str(i))[:31]
            i += 1
        used_titles.add(t.lower())
        sheet_titles.append(t)

    for idx, sh in enumerate(sheets):
        ws = wb.create_sheet(sheet_titles[idx])
        cols = sh.get("columns") or []
        rows = sh.get("rows") or []
        for ci, col in enumerate(cols, start=1):
            c = ws.cell(row=1, column=ci, value=col.get("header", ""))
            c.font = HEADER_FONT
            c.alignment = Alignment(wrap_text=True, vertical="center")
            if col.get("info"):
                c.fill = INFO_HEADER_FILL
            elif col.get("list"):
                c.fill = LIST_HEADER_FILL
            else:
                c.fill = HEADER_FILL
            if col.get("note"):
                from openpyxl.comments import Comment
                c.comment = Comment(str(col["note"])[:600], "ERP")
        ws.row_dimensions[1].height = 32
        for ri, row in enumerate(rows, start=2):
            for ci, col in enumerate(cols, start=1):
                v = row[ci - 1] if ci - 1 < len(row) else None
                style = None
                if isinstance(v, dict):
                    style = v
                    v = v.get("v")
                if v is None or v == "":
                    cell = ws.cell(row=ri, column=ci)
                else:
                    d = _to_date(v) if col.get("date") else None
                    if d is not None:
                        cell = ws.cell(row=ri, column=ci, value=d)
                        cell.number_format = "DD/MM/YYYY"
                    else:
                        cell = ws.cell(row=ri, column=ci, value=v)
                        if col.get("text") or isinstance(v, str):
                            # Texte force : "00" ne devient jamais 0.
                            if isinstance(v, str):
                                cell.number_format = "@"
                if style:
                    _style_cell(cell, style)
        # Format texte / date sur les lignes vierges pre-validees
        last = len(rows) + 1 + (EXTRA_ROWS if sh.get("extraRows", True) else 0)
        for ci, col in enumerate(cols, start=1):
            letter = get_column_letter(ci)
            width = col.get("width")
            if not width:
                longest = max([len(str(col.get("header", "")))] +
                              [len(str((r[ci - 1].get("v") if isinstance(r[ci - 1], dict) else r[ci - 1]) or ""))
                               for r in rows if ci - 1 < len(r)])
                width = min(max(longest + 2, 10), 48)
            ws.column_dimensions[letter].width = width
            if col.get("hidden"):
                ws.column_dimensions[letter].hidden = True
            if sh.get("extraRows", True):
                for r in range(len(rows) + 2, last + 1):
                    if col.get("date"):
                        ws.cell(row=r, column=ci).number_format = "DD/MM/YYYY"
                    elif not col.get("number"):
                        ws.cell(row=r, column=ci).number_format = "@"
            if col.get("date") and last >= 2:
                dv = DataValidation(
                    type="date", operator="greaterThan", formula1="36526",
                    allow_blank=True, showErrorMessage=True, errorStyle="stop",
                    errorTitle="Date invalide",
                    error="Saisissez une date valide (JJ/MM/AAAA).",
                )
                dv.add("%s2:%s%d" % (letter, letter, last))
                ws.add_data_validation(dv)
            if col.get("number") and last >= 2:
                dv = DataValidation(
                    type="decimal", operator="greaterThanOrEqual", formula1="0",
                    allow_blank=True, showErrorMessage=True, errorStyle="stop",
                    errorTitle="Nombre invalide",
                    error="Saisissez un nombre positif.",
                )
                dv.add("%s2:%s%d" % (letter, letter, last))
                ws.add_data_validation(dv)
        if sh.get("freeze", True):
            ws.freeze_panes = "A2"
        if cols:
            ws.auto_filter.ref = "A1:%s%d" % (get_column_letter(len(cols)), max(len(rows) + 1, 2))
        sh["_ws"] = ws
        sh["_last"] = last

    # --- Feuille Listes -------------------------------------------------
    if list_names:
        wl = wb.create_sheet("Listes")
        for ci, name in enumerate(list_names, start=1):
            vals = [v for v in (lists[name] or []) if v is not None and str(v) != ""]
            c = wl.cell(row=1, column=ci, value=name)
            c.font = HEADER_FONT
            c.fill = LIST_HEADER_FILL
            for ri, v in enumerate(vals, start=2):
                cell = wl.cell(row=ri, column=ci, value=str(v))
                cell.number_format = "@"
            letter = get_column_letter(ci)
            wl.column_dimensions[letter].width = min(max([len(str(name))] + [len(str(v)) for v in vals]) + 2, 50)
            n = max(len(vals), 1)
            list_ranges[name] = "Listes!$%s$2:$%s$%d" % (letter, letter, n + 1)
        wl.sheet_state = "visible"

        for idx, sh in enumerate(sheets):
            ws = sh["_ws"]
            for ci, col in enumerate(sh.get("columns") or [], start=1):
                lname = col.get("list")
                if not lname or lname not in list_ranges:
                    continue
                letter = get_column_letter(ci)
                dv = DataValidation(
                    type="list", formula1="=" + list_ranges[lname],
                    allow_blank=True, showErrorMessage=True, showInputMessage=False,
                    errorStyle="stop",
                    errorTitle="Valeur non autorisée",
                    error="Choisissez une valeur dans la liste déroulante (colonne « %s »)." % col.get("header", ""),
                )
                dv.add("%s2:%s%d" % (letter, letter, sh["_last"]))
                ws.add_data_validation(dv)

    # --- Feuille de guide -------------------------------------------------
    guide = spec.get("guide") or {}
    if guide.get("lines"):
        wg = wb.create_sheet(_safe_title(guide.get("name") or "Mode d'emploi", "Mode d'emploi"))
        wg.column_dimensions["A"].width = 110
        wg.cell(row=1, column=1, value=guide.get("title") or "Mode d'emploi").font = Font(bold=True, size=14)
        for i, line in enumerate(guide["lines"], start=3):
            c = wg.cell(row=i, column=1, value=line)
            c.alignment = Alignment(wrap_text=True, vertical="top")

    # --- Feuille technique (meta) : identifie le contrat, etc. ---------
    meta = spec.get("meta")
    if isinstance(meta, dict) and meta:
        wm = wb.create_sheet("Meta")
        for i, (k, v) in enumerate(meta.items(), start=1):
            wm.cell(row=i, column=1, value=str(k))
            wm.cell(row=i, column=2, value="" if v is None else str(v))
        wm.sheet_state = "hidden"

    # Les feuilles de donnees d'abord, puis Mode d'emploi, Listes, Meta
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = re.sub(r"[^A-Za-z0-9._-]+", "_", spec.get("filename") or "export.xlsx")
    if not fname.lower().endswith(".xlsx"):
        fname += ".xlsx"
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=fname,
    )


def _cell_text(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return repr(v)
    return str(v).strip()


@xlsx_tools.post("/read")
def read():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    f = request.files["file"]
    data = f.read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=False)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    out = {}
    order = []
    for ws in wb.worksheets:
        name = ws.title
        order.append(name)
        header_row = None
        for row in ws.iter_rows(min_row=1, max_row=1, values_only=True):
            header_row = row
        headers = [_cell_text(v) for v in (header_row or [])]
        while headers and not headers[-1]:
            headers.pop()
        n = len(headers)
        rows, nums = [], []
        if n and name.lower() != "meta":
            for rn, raw in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                vals = [_cell_text(v) for v in list(raw)[:n]]
                while len(vals) < n:
                    vals.append("")
                if any(vals):
                    rows.append(vals)
                    nums.append(rn)
                if len(rows) > 20000:
                    break
        out[name] = {"headers": headers, "rows": rows, "rowNumbers": nums, "hidden": ws.sheet_state != "visible"}
    meta = {}
    if "Meta" in wb.sheetnames:
        for row in wb["Meta"].iter_rows(values_only=True):
            if row and row[0]:
                meta[str(row[0])] = _cell_text(row[1] if len(row) > 1 else "")
    wb.close()
    return jsonify({"sheets": out, "order": order, "meta": meta})
