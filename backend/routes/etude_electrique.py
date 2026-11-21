# -*- coding: utf-8 -*-
"""Module Étude électrique (V3.03) : classeur Excel de la base de données des consommateurs.

Deux points d'entrée, sans aucune écriture en base (l'enregistrement passe par /api/doc/etudeConsommateurs,
protégé par la section de droits « etude_elec ») :

- POST /api/etude-elec/export (JSON -> .xlsx) : fabrique le classeur avec
    * ligne 1 : nature de chaque colonne (Saisi / Formule / Liste), comme le fichier modèle ;
    * ligne 2 : titres ; données à partir de la ligne 3 ;
    * VRAIES FORMULES Excel dans les colonnes « Formule » (gabarit « {cle} » remplacé par la cellule de la même
      ligne), sauf si la valeur a été imposée à la main (constante, cellule teintée) ;
    * LISTES DÉROULANTES (validation de données) adossées à une feuille « Listes ».
- POST /api/etude-elec/table (multipart .xlsx -> JSON) : lecture générique d'une feuille (valeurs calculées en
  cache, pas les formules), avec détection de la ligne de titres en ignorant la ligne « Saisi/Formule/Liste » ;
  l'utilisateur fait ensuite la correspondance des colonnes à l'écran.
"""

import datetime
import io
import re

import openpyxl
from flask import Blueprint, jsonify, request, send_file
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

etude_electrique = Blueprint("etude_electrique", __name__, url_prefix="/api/etude-elec")

NATURES = ("Saisi", "Formule", "Liste")
EXTRA_ROWS = 300            # lignes vierges pré-validées sous les données
MAX_TABLE_ROWS = 20000
FILL = {
    "Saisi": PatternFill("solid", fgColor="1F3A5F"),
    "Formule": PatternFill("solid", fgColor="7F8C9B"),
    "Liste": PatternFill("solid", fgColor="2E7D6B"),
}
FILL_FORCE = PatternFill("solid", fgColor="FFF2CC")
FILL_NATURE = PatternFill("solid", fgColor="E7ECF2")
HEADER_FONT = Font(bold=True, color="FFFFFF")
_KEY = re.compile(r"\{(\w+)\}")
_NUM = re.compile(r"^-?\d+(\.\d+)?$")


def _num_ou_texte(v):
    """Valeur de liste : nombre si elle s'écrit comme un nombre (tension 525), texte sinon ('3/50')."""
    s = str(v)
    if _NUM.match(s):
        f = float(s)
        return int(f) if f == int(f) else f
    return s


def _feuille_base(wb, spec, titre=None):
    """Écrit la feuille « base de données » (natures, titres, données, formules, listes) dans le classeur wb.
    Renvoie (feuille, lettres des colonnes, première ligne, dernière ligne de données)."""
    cols = spec.get("columns") or []
    rows = spec.get("rows") or []
    lists = spec.get("lists") or {}
    if not cols:
        raise ValueError("Aucune colonne à exporter")
    letters = {c["key"]: get_column_letter(i) for i, c in enumerate(cols, start=1)}

    ws = wb.create_sheet(titre or "Consommateurs")
    first = 3
    last = first + max(len(rows), 0) - 1
    last_dv = last + EXTRA_ROWS if spec.get("extraRows", True) else max(last, first)

    for ci, c in enumerate(cols, start=1):
        nat = c.get("nature") if c.get("nature") in NATURES else "Saisi"
        n = ws.cell(row=1, column=ci, value=nat)
        n.fill = FILL_NATURE
        n.alignment = Alignment(horizontal="center")
        h = ws.cell(row=2, column=ci, value=c.get("title", ""))
        h.font = HEADER_FONT
        h.fill = FILL[nat]
        h.alignment = Alignment(wrap_text=True, vertical="center")
        if c.get("note"):
            h.comment = Comment(str(c["note"])[:600], "ERP")
        ws.column_dimensions[get_column_letter(ci)].width = c.get("width") or min(max(len(str(c.get("title", ""))) + 2, 11), 40)
    ws.row_dimensions[2].height = 42

    for ri, row in enumerate(rows, start=first):
        vals = row.get("v") or {}
        forces = row.get("forces") or {}
        for ci, c in enumerate(cols, start=1):
            key = c["key"]
            nat = c.get("nature")
            tpl = c.get("formula")
            if nat == "Formule" and tpl and not forces.get(key):
                f = "=" + _KEY.sub(lambda m: "%s%d" % (letters.get(m.group(1), "A"), ri), tpl)
                cell = ws.cell(row=ri, column=ci, value=f)
            else:
                v = vals.get(key)
                if v is None or v == "":
                    cell = ws.cell(row=ri, column=ci)
                else:
                    if c.get("list") and c.get("number"):
                        v = _num_ou_texte(v)
                    cell = ws.cell(row=ri, column=ci, value=v)
                    if isinstance(v, str):
                        cell.number_format = "@"
                if nat == "Formule" and forces.get(key):
                    cell.fill = FILL_FORCE
            if c.get("fmt") and not (isinstance(cell.value, str) and not str(cell.value).startswith("=")):
                cell.number_format = c["fmt"]
    # lignes vierges : format texte sur les colonnes de saisie texte
    for ci, c in enumerate(cols, start=1):
        if c.get("nature") != "Formule" and not c.get("number"):
            for r in range(last + 1, last_dv + 1):
                ws.cell(row=r, column=ci).number_format = "@"

    ws.freeze_panes = ws.cell(row=first, column=int(spec.get("freezeCols") or 6) + 1)
    ws.auto_filter.ref = "A2:%s%d" % (get_column_letter(len(cols)), max(last, first))

    # ligne 1 : liste déroulante de la nature (comme le modèle)
    dv_nat = DataValidation(type="list", formula1='"Saisi,Formule,Liste"', allow_blank=True)
    dv_nat.add("A1:%s1" % get_column_letter(len(cols)))
    ws.add_data_validation(dv_nat)

    # feuille Listes + validations
    ranges = {}
    noms = [n for n in lists.keys()]
    if noms:
        wl = wb.create_sheet("Listes")
        for ci, name in enumerate(noms, start=1):
            vals = [v for v in (lists[name] or []) if v is not None and str(v) != ""]
            h = wl.cell(row=1, column=ci, value=name)
            h.font = HEADER_FONT
            h.fill = FILL["Liste"]
            for ri, v in enumerate(vals, start=2):
                cell = wl.cell(row=ri, column=ci, value=_num_ou_texte(v))
                if isinstance(cell.value, str):
                    cell.number_format = "@"
            L = get_column_letter(ci)
            wl.column_dimensions[L].width = min(max([len(str(name))] + [len(str(v)) for v in vals]) + 2, 40)
            if vals:
                ranges[name] = "Listes!$%s$2:$%s$%d" % (L, L, len(vals) + 1)
    for ci, c in enumerate(cols, start=1):
        ln = c.get("list")
        if not ln or ln not in ranges:
            continue
        dv = DataValidation(type="list", formula1="=" + ranges[ln], allow_blank=True, showErrorMessage=True,
                            errorStyle="stop", errorTitle="Valeur non autorisée",
                            error="Choisissez une valeur dans la liste déroulante (colonne « %s »)." % c.get("title", ""))
        L = get_column_letter(ci)
        dv.add("%s%d:%s%d" % (L, first, L, last_dv))
        ws.add_data_validation(dv)

    return ws, letters, first, last


def _meta(wb, spec):
    meta = spec.get("meta")
    if isinstance(meta, dict) and meta:
        wm = wb.create_sheet("Meta")
        for i, (k, v) in enumerate(meta.items(), start=1):
            wm.cell(row=i, column=1, value=str(k))
            wm.cell(row=i, column=2, value="" if v is None else str(v))
        wm.sheet_state = "hidden"


def _envoyer(wb, spec, defaut):
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = re.sub(r"[^A-Za-z0-9._-]+", "_", spec.get("filename") or defaut)
    if not fname.lower().endswith(".xlsx"):
        fname += ".xlsx"
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     as_attachment=True, download_name=fname)


@etude_electrique.post("/export")
def export_xlsx():
    spec = request.get_json(silent=True) or {}
    if not (spec.get("columns") or []):
        return jsonify({"error": "Aucune colonne à exporter"}), 400
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    _feuille_base(wb, spec)
    _meta(wb, spec)
    return _envoyer(wb, spec, "etude_electrique.xlsx")


# ---------------------------------------------------------------------------------------------
# Liste des consommateurs (V3.04) : feuille documentaire dérivée de la base, une section par tableau
# ---------------------------------------------------------------------------------------------
FEUILLE_BASE = "Consumer List"
FEUILLE_LISTE = "Liste des consommateurs"
# (titre, clé de la base ou None, largeur) ; "calc:" = formule propre à la liste ; "saisi:" = valeur propre à la liste
LISTE_COLS = [
    ("Repère", "tag", 18), ("Désignation", "nom", 38), ("Source", "switchgear", 18),
    ("Puissance Installée (KW)", "calc:pinst", 14), ("Rendement", "rend", 11),
    ("Puissance unitaire (KW)", "pActive", 14), ("Cos ϕ", "cosPhi", 9),
    ("Puissance unitaire (KVA)", "puissanceApparente", 14), ("Nombre", "nombre", 9),
    ("Facteur d'utilisation", "kUtil", 12), ("Facteur de simultanéité", "kSimul", 13),
    ("Puissance totale (KVA)", "calc:total", 14), ("Type câble", "saisi:typeCable", 16),
    ("Alimentation", "calc:alim", 22), ("E/NE", "eNe", 8), ("Type Consommateur", "typeConso", 14),
    ("Départ type", "specialReqts", 12), ("Commentaire", "saisi:commentaire", 32),
]
FMT_LISTE = {"rend": "0.00", "pActive": "0.00", "cosPhi": "0.00", "puissanceApparente": "0.00", "nombre": "0",
             "kUtil": "0.00", "kSimul": "0.00", "calc:total": "0.00"}
FILL_SECTION = PatternFill("solid", fgColor="D9E2EF")
FILL_ENTETE = PatternFill("solid", fgColor="1F3A5F")


@etude_electrique.post("/export-liste")
def export_liste():
    """Classeur « Liste des consommateurs » : la feuille documentaire (formules INDEX/EQUIV vers la feuille
    « Consumer List » du même classeur, donc toujours cohérente avec la base) + la base elle-même."""
    spec = request.get_json(silent=True) or {}
    liste = spec.get("liste") or {}
    if not (spec.get("columns") or []):
        return jsonify({"error": "Aucune colonne de base à exporter"}), 400
    wb = openpyxl.Workbook()
    wl = wb.active
    wl.title = FEUILLE_LISTE
    wsb, letters, first, last = _feuille_base(wb, spec, FEUILLE_BASE)
    fin = max(last, first) + EXTRA_ROWS          # la recherche couvre aussi les lignes ajoutées plus tard
    q = "'%s'!" % FEUILLE_BASE

    def col(k):
        return "%s$%s$%d:$%s$%d" % (q, letters[k], first, letters[k], fin)

    def lookup(k, r):
        if k not in letters:
            return '""'
        idx = "INDEX(%s,MATCH($A%d,%s,0))" % (col(k), r, col("tag"))
        return 'IF(%s="","",%s)' % (idx, idx)

    def idx(k, r):
        return "INDEX(%s,MATCH($A%d,%s,0))" % (col(k), r, col("tag"))

    # bloc d'en-tête
    h = liste.get("header") or {}
    wl["A1"] = "Liste des consommateurs:"
    wl["A1"].font = Font(bold=True, size=14)
    for i, (lab, key) in enumerate((("Affaire:", "affaire"), ("Compte:", "compte"), ("Code doc.:", "codeDoc"),
                                    ("Révision:", "revision"), ("Date:", "date")), start=1):
        wl.cell(row=i, column=14, value=lab).font = Font(bold=True)
        wl.cell(row=i, column=15, value=h.get(key) or None)
    n = len(LISTE_COLS)
    r = 7
    sections = liste.get("sections") or []
    premiere = None
    for sec in sections:
        lignes = sec.get("lignes") or []
        t = wl.cell(row=r, column=1, value=sec.get("titre") or "")
        t.font = Font(bold=True, size=12)
        for c in range(1, n + 1):
            wl.cell(row=r, column=c).fill = FILL_SECTION
        r += 1
        for ci, (titre, _k, w) in enumerate(LISTE_COLS, start=1):
            c = wl.cell(row=r, column=ci, value=titre)
            c.font = HEADER_FONT
            c.fill = FILL_ENTETE
            c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        wl.row_dimensions[r].height = 32
        r += 1
        if premiere is None:
            premiere = r
        for lg in lignes:
            wl.cell(row=r, column=1, value=lg.get("tag") or None)
            for ci, (titre, k, w) in enumerate(LISTE_COLS, start=1):
                if ci == 1:
                    continue
                if k.startswith("saisi:"):
                    v = lg.get(k[6:])
                    cell = wl.cell(row=r, column=ci, value=v or None)
                elif k == "calc:pinst":
                    cell = wl.cell(row=r, column=ci, value='=IFERROR(IF(%s="","",ROUND(%s,1)&" "&%s),"")' % (idx("puissanceInstallee", r), idx("puissanceInstallee", r), idx("unite", r)))
                elif k == "calc:total":
                    cell = wl.cell(row=r, column=ci, value='=IFERROR(H%d*I%d*J%d*K%d,"")' % (r, r, r, r))
                elif k == "calc:alim":
                    cell = wl.cell(row=r, column=ci, value='=IFERROR(IF(%s="","",%s&" VAC / "&%s),"")' % (idx("tension", r), idx("tension", r), idx("contenu", r)))
                else:
                    cell = wl.cell(row=r, column=ci, value="=IFERROR(%s,\"\")" % lookup(k, r))
                if k in FMT_LISTE:
                    cell.number_format = FMT_LISTE[k]
            r += 1
        r += 1                                   # ligne blanche entre deux sections
    for ci, (_t, _k, w) in enumerate(LISTE_COLS, start=1):
        wl.column_dimensions[get_column_letter(ci)].width = w
    wl.column_dimensions["N"].width = max(wl.column_dimensions["N"].width or 0, 22)
    wl.column_dimensions["O"].width = 14
    # liste déroulante « Type câble » (valeurs gérées dans l'application) si la feuille Listes la contient
    if "Listes" in wb.sheetnames and premiere is not None:
        wli = wb["Listes"]
        for ci in range(1, wli.max_column + 1):
            if wli.cell(row=1, column=ci).value == "typeCable":
                nb = max([r2 for r2 in range(2, wli.max_row + 1) if wli.cell(row=r2, column=ci).value not in (None, "")] or [1])
                if nb >= 2:
                    L = get_column_letter(ci)
                    dv = DataValidation(type="list", formula1="=Listes!$%s$2:$%s$%d" % (L, L, nb), allow_blank=True,
                                        showErrorMessage=False)
                    dv.add("M%d:M%d" % (premiere, max(r, premiere)))
                    wl.add_data_validation(dv)
    wl.sheet_view.showGridLines = False
    wl.freeze_panes = "A7"
    _meta(wb, dict(spec, meta=dict(spec.get("meta") or {}, type="liste_consommateurs")))
    return _envoyer(wb, spec, "liste_des_consommateurs.xlsx")


def _raw(v):
    """Cellule en texte brut (dates AAAA-MM-JJ, entiers sans '.0', erreurs Excel -> vide)."""
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else repr(v)
    s = str(v).strip()
    return "" if s in ("#REF!", "#DIV/0!", "#VALUE!", "#N/A", "#NAME?", "#NUM!", "#NULL!") else s


def _lettre(idx):
    s = ""
    while idx > 0:
        idx, r = divmod(idx - 1, 26)
        s = chr(65 + r) + s
    return s


@etude_electrique.post("/table")
def lire_table():
    """Lecture générique d'une feuille : {sheets, sheet, headerRow, columns:[{idx, letter, name}], rows}."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    data = request.files["file"].read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    sheets = [n for n in wb.sheetnames if wb[n].sheet_state == "visible"] or wb.sheetnames
    name = (request.form.get("sheet") or "").strip()
    if name not in wb.sheetnames:
        # feuille par défaut : celle qui a le plus de cellules renseignées parmi les feuilles visibles
        name = max(sheets, key=lambda n: wb[n].max_row * wb[n].max_column)
    ws = wb[name]

    counts, natures = {}, set()
    for r in range(1, min(40, ws.max_row) + 1):
        vals = [_raw(ws.cell(row=r, column=c).value) for c in range(1, ws.max_column + 1)]
        non_vides = [v for v in vals if v != ""]
        counts[r] = len(non_vides)
        if non_vides and all(v in NATURES for v in non_vides):
            natures.add(r)          # ligne « Saisi / Formule / Liste » : jamais la ligne de titres
    candidats = {r: n for r, n in counts.items() if r not in natures}
    mx = max(candidats.values()) if candidats else 0
    hdr = next((r for r in sorted(candidats) if candidats[r] >= 3 and candidats[r] * 2 >= mx), None)
    forced = (request.form.get("headerRow") or "").strip()
    if forced.isdigit() and 1 <= int(forced) <= ws.max_row:
        hdr = int(forced)
    if hdr is None:
        wb.close()
        return jsonify({"error": "Aucune ligne de titres détectée dans la feuille « %s »." % name}), 400

    columns = []
    for c in range(1, ws.max_column + 1):
        nm = _raw(ws.cell(row=hdr, column=c).value)
        if nm == "":
            if not any(_raw(ws.cell(row=r, column=c).value) != "" for r in range(hdr + 1, min(ws.max_row, hdr + 200) + 1)):
                continue
            nm = "(colonne %s)" % _lettre(c)
        columns.append({"idx": c, "letter": _lettre(c), "name": nm})
    rows, truncated = [], False
    for r in range(hdr + 1, ws.max_row + 1):
        vals = [_raw(ws.cell(row=r, column=col["idx"]).value) for col in columns]
        if not any(vals):
            continue
        if len(rows) >= MAX_TABLE_ROWS:
            truncated = True
            break
        rows.append(vals)
    wb.close()
    return jsonify({"sheets": sheets, "sheet": name, "headerRow": hdr, "columns": columns, "rows": rows,
                    "truncated": truncated})


# ---------------------------------------------------------------------------------------------
# Bilan de puissance (V3.05) : un classeur avec « Récap puissance » + une feuille par tableau
# ---------------------------------------------------------------------------------------------
# (titre, clé de la base | "calc:..." | "casc:q"/"casc:r" (départ vers un tableau aval), largeur, format)
BIL_COLS = [
    ("Repère", "tag", 18, None), ("Désignation", "nom", 36, None), ("E/NE", "eNe", 7, None), ("% E", "pctE", 6, "0.00"),
    ("Type", "typeConso", 10, None), ("Service I/C", "ci", 8, None), ("W/S", "ws", 7, None),
    ("Puissance Apparente Unitaire (KVA)", "puissanceApparente", 13, "0.00"), ("Puissance Installée", "calc:pinst", 12, None),
    ("Rendement", "rend", 10, "0.00"), ("Puissance active (kw)", "pActive", 12, "0.00"), ("Nombre", "nombre", 8, "0"),
    ("Cos ϕ", "cosPhi", 8, "0.00"), ("Puissance Réactive Unitaire (kvar)", "pReactive", 13, "0.00"),
    ("K.Util", "kUtil", 8, "0.00"), ("K.Simul", "kSimul", 8, "0.00"),
    ("Puissance Active Foisonée (kw)", "pActiveFoisonnee", 14, "0.00"),
    ("Puissance Réactive Foisonée (kvar)", "pReactiveFoisonnee", 14, "0.00"),
    ("Alimentation", "calc:alim", 20, None), ("Départ type", "specialReqts", 11, None),
]


def _nom_feuille(titre, pris):
    base = re.sub(r"[\[\]:*?/\\]", "_", str(titre or "Tableau")).strip().strip("'") or "Tableau"
    base = base[:31]
    nom, i = base, 2
    while nom.lower() in pris:
        suf = " (%d)" % i
        nom = base[:31 - len(suf)] + suf
        i += 1
    pris.add(nom.lower())
    return nom


def _q(nom):
    return "'%s'" % nom.replace("'", "''")


def _dispo_bilan(n, npertes):
    """Lignes (1-based) des blocs d'une feuille de bilan : données 9..8+n ; blocs à partir de b."""
    e = 8 + max(n, 1)
    b = e + 3
    return {"e": e, "b": b, "pertes_tot": b + npertes + 1,
            "tot": b + 1, "kf": b + 2, "kres": b + 3, "ptot": b + 4, "kva": b + 5, "cos": b + 6,
            "stot": b + 9, "skf": b + 10, "skres": b + 11, "sptot": b + 12, "skva": b + 13, "scos": b + 14,
            "m_dol": b + 17, "m_norm": b + 20, "m_tot": b + 23, "m_pct": b + 26}


@etude_electrique.post("/export-bilan")
def export_bilan():
    """Classeur « Bilan de puissance » : Récap puissance + une feuille par tableau (formules INDEX/EQUIV vers la
    feuille « Consumer List », départs vers un tableau aval = renvoi vers la feuille de ce tableau)."""
    spec = request.get_json(silent=True) or {}
    bil = spec.get("bilan") or {}
    tabs = bil.get("tableaux") or []
    if not (spec.get("columns") or []):
        return jsonify({"error": "Aucune colonne de base à exporter"}), 400
    if not tabs:
        return jsonify({"error": "Aucun tableau à exporter"}), 400
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    wsb, letters, first, last = _feuille_base(wb, spec, FEUILLE_BASE)
    fin = max(last, first) + EXTRA_ROWS
    q = _q(FEUILLE_BASE) + "!"

    def col(k):
        return "%s$%s$%d:$%s$%d" % (q, letters[k], first, letters[k], fin)

    def idx(k, r):
        return "INDEX(%s,MATCH($A%d,%s,0))" % (col(k), r, col("tag")) if k in letters else '""'

    pris = set(n.lower() for n in wb.sheetnames) | {"récap puissance"}
    noms = {}
    lay = {}
    for t in tabs:
        noms[t["cle"]] = _nom_feuille(t.get("titre"), pris)
        lay[t["cle"]] = _dispo_bilan(len(t.get("lignes") or []), len(t.get("pertes") or []))

    cfg = {t["cle"]: t for t in tabs}
    feuilles = []
    for t in tabs:
        ws = wb.create_sheet(noms[t["cle"]])
        feuilles.append(ws)
        L = lay[t["cle"]]
        lignes = t.get("lignes") or []
        n = len(lignes)
        e = L["e"]
        h = t.get("header") or {}
        ws["A1"] = "Bilan de puissance"
        ws["A1"].font = Font(bold=True, size=14)
        ws["A4"] = "Switchgear / MCC: %s" % (t.get("titre") or "")
        ws["A4"].font = Font(bold=True, size=12)
        for i, (lab, key) in enumerate((("Affaire:", "affaire"), ("Compte:", "compte"), ("Code doc.:", "codeDoc"),
                                        ("Révision:", "revision"), ("Date:", "date")), start=1):
            ws.cell(row=i, column=14, value=lab).font = Font(bold=True)
            ws.cell(row=i, column=15, value=h.get(key) or None)
        for ci, (titre, k, w, fmt) in enumerate(BIL_COLS, start=1):
            c = ws.cell(row=8, column=ci, value=titre)
            c.font = HEADER_FONT
            c.fill = FILL_ENTETE
            c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
            ws.column_dimensions[get_column_letter(ci)].width = w
        ws.row_dimensions[8].height = 44
        for i, lg in enumerate(lignes):
            r = 9 + i
            ws.cell(row=r, column=1, value=lg.get("tag") or None)
            casc = lg.get("cascade")
            for ci, (titre, k, w, fmt) in enumerate(BIL_COLS, start=1):
                if ci == 1:
                    continue
                if k == "calc:pinst":
                    v = '=IFERROR(IF(%s="","",ROUND(%s,1)&" "&%s),"")' % (idx("puissanceInstallee", r), idx("puissanceInstallee", r), idx("unite", r))
                elif k == "calc:alim":
                    v = '=IFERROR(IF(%s="","",%s&" VAC / "&%s),"")' % (idx("tension", r), idx("tension", r), idx("contenu", r))
                elif casc and k == "specialReqts":
                    continue                    # un départ vers un tableau aval n'est jamais classé « DOL »
                elif casc and k in ("pActiveFoisonnee", "pReactiveFoisonnee") and casc in noms:
                    lc = "Q" if k == "pActiveFoisonnee" else "R"
                    if cfg.get(casc, {}).get("cascSans"):     # repris SANS le coefficient de réserve : total x K.Foisonnement
                        v = "=%s!%s%d*%s!Q%d" % (_q(noms[casc]), lc, lay[casc]["tot"], _q(noms[casc]), lay[casc]["kf"])
                    else:
                        v = "=%s!%s%d" % (_q(noms[casc]), lc, lay[casc]["ptot"])
                else:
                    v = '=IFERROR(IF(%s="","",%s),"")' % (idx(k, r), idx(k, r))
                cell = ws.cell(row=r, column=ci, value=v)
                if fmt:
                    cell.number_format = fmt
                if casc and k in ("pActiveFoisonnee", "pReactiveFoisonnee"):
                    cell.fill = FILL_FORCE
        rng = lambda c: "%s9:%s%d" % (c, c, e)
        b = L["b"]
        # --- pertes (à gauche) ---
        pertes = t.get("pertes") or []
        ws.cell(row=b, column=2, value="Pertes transformateurs").font = Font(bold=True)
        ws.cell(row=b, column=3, value="P(kW)").font = Font(bold=True)
        ws.cell(row=b, column=4, value="Q(kVAR)").font = Font(bold=True)
        for i, pt in enumerate(pertes, start=1):
            ws.cell(row=b + i, column=2, value=pt.get("nom") or None)
            ws.cell(row=b + i, column=3, value=pt.get("p") if pt.get("p") not in ("",) else None)
            ws.cell(row=b + i, column=4, value=pt.get("q") if pt.get("q") not in ("",) else None)
        pt_r = L["pertes_tot"]
        ws.cell(row=pt_r, column=2, value="Total pertes").font = Font(bold=True)
        if pertes:
            ws.cell(row=pt_r, column=3, value="=SUM(C%d:C%d)" % (b + 1, pt_r - 1))
            ws.cell(row=pt_r, column=4, value="=SUM(D%d:D%d)" % (b + 1, pt_r - 1))
        else:
            ws.cell(row=pt_r, column=3, value=0)
            ws.cell(row=pt_r, column=4, value=0)
        # --- transformateur et réserve (au milieu) ---
        ws.cell(row=b + 1, column=8, value="Puissance Transfo (kVA)")
        ws.cell(row=b + 1, column=10, value=t.get("transfo") if t.get("transfo") not in ("", None) else None)
        if t.get("transfoCode"):
            ws.cell(row=b + 1, column=11, value="Transformateur : %s" % t.get("transfoCode"))
        ws.cell(row=b + 2, column=8, value="Réserve réelle")
        c = ws.cell(row=b + 2, column=10, value='=IFERROR(1-Q%d/J%d,"")' % (L["kva"], b + 1))
        c.number_format = "0.0%"
        # --- bilans source normale et secours ---
        def bloc(r0, titre, somme_p, somme_q, kf, kr):
            ws.cell(row=r0, column=14, value=titre).font = Font(bold=True)
            ws.cell(row=r0 + 1, column=14, value="Total Tableau (kW,kVAR)")
            ws.cell(row=r0 + 1, column=17, value=somme_p)
            ws.cell(row=r0 + 1, column=18, value=somme_q)
            ws.cell(row=r0 + 2, column=14, value="K.Foisonnement")
            ws.cell(row=r0 + 2, column=17, value=kf if kf not in ("", None) else 1)
            ws.cell(row=r0 + 3, column=14, value="Coefficient de réserve")
            ws.cell(row=r0 + 3, column=17, value=kr if kr not in ("", None) else 1)
            ws.cell(row=r0 + 4, column=14, value="Puissance totale (kW , kVAR)")
            ws.cell(row=r0 + 4, column=17, value="=Q%d*Q%d*Q%d" % (r0 + 1, r0 + 2, r0 + 3))
            ws.cell(row=r0 + 4, column=18, value="=R%d*Q%d*Q%d" % (r0 + 1, r0 + 2, r0 + 3))
            ws.cell(row=r0 + 5, column=14, value="Puissance totale (kVA)")
            ws.cell(row=r0 + 5, column=17, value="=SQRT(Q%d^2+R%d^2)" % (r0 + 4, r0 + 4))
            ws.cell(row=r0 + 6, column=14, value="Cos ϕ")
            ws.cell(row=r0 + 6, column=17, value='=IFERROR(Q%d/Q%d,"")' % (r0 + 4, r0 + 5))
            for rr in (r0 + 1, r0 + 4, r0 + 5):
                for cc in (17, 18):
                    ws.cell(row=rr, column=cc).number_format = "0.00"
            ws.cell(row=r0 + 3, column=17).number_format = "0.00"
            ws.cell(row=r0 + 6, column=17).number_format = "0.000"
        bloc(b, "Bilan source normale:", "=SUM(%s)+C%d" % (rng("Q"), pt_r), "=SUM(%s)+D%d" % (rng("R"), pt_r), t.get("kfN"), t.get("krN"))
        bloc(b + 8, "Bilan source secours:", '=SUMIF(%s,"E",%s)' % (rng("C"), rng("Q")), '=SUMIF(%s,"E",%s)' % (rng("C"), rng("R")), t.get("kfS"), t.get("krS"))
        # --- charges motrices (DOL) / normales : NE = source normale, E = secours ---
        r0 = b + 16
        ws.cell(row=r0, column=14, value="Charges (hors pertes)").font = Font(bold=True)
        ws.cell(row=r0, column=16, value="NE").font = Font(bold=True)
        ws.cell(row=r0, column=17, value="E").font = Font(bold=True)
        enfants = [(i, lg["cascade"]) for i, lg in enumerate(lignes) if lg.get("cascade") in noms]

        def mot(lettre_src, ligne_enf):  # puissance active ; la réactive est calculée juste dessous
            ne = 'SUMIFS(%s,%s,"DOL")' % (rng(lettre_src), rng("T"))
            ee = 'SUMIFS(%s,%s,"DOL",%s,"E")' % (rng(lettre_src), rng("T"), rng("C"))
            for i, ch in enfants:
                ref = "%s!P%d" % (_q(noms[ch]), lay[ch][ligne_enf])
                ne += "+" + ref
                ee += '+IF(C%d="E",%s,0)' % (9 + i, ref)
            return "=" + ne, "=" + ee
        # lignes : DOL P / Q / S ; normales P / Q / S ; totales P / Q / S ; %
        mp = mot("Q", "m_dol")
        # réactive : même principe, sur la ligne « Q » du bloc enfant (m_dol + 1)
        ne_q = 'SUMIFS(%s,%s,"DOL")' % (rng("R"), rng("T"))
        e_q = 'SUMIFS(%s,%s,"DOL",%s,"E")' % (rng("R"), rng("T"), rng("C"))
        for i, ch in enfants:
            ref = "%s!P%d" % (_q(noms[ch]), lay[ch]["m_dol"] + 1)
            ne_q += "+" + ref
            e_q += '+IF(C%d="E",%s,0)' % (9 + i, ref)
        r = L["m_dol"]
        ws.cell(row=r, column=14, value="Charges motrices (DOL)")
        ws.cell(row=r, column=15, value="P"); ws.cell(row=r, column=16, value=mp[0]); ws.cell(row=r, column=17, value=mp[1])
        ws.cell(row=r + 1, column=15, value="Q"); ws.cell(row=r + 1, column=16, value="=" + ne_q); ws.cell(row=r + 1, column=17, value="=" + e_q)
        ws.cell(row=r + 2, column=15, value="S")
        ws.cell(row=r + 2, column=16, value="=SQRT(P%d^2+P%d^2)" % (r, r + 1)); ws.cell(row=r + 2, column=17, value="=SQRT(Q%d^2+Q%d^2)" % (r, r + 1))
        rn = L["m_norm"]
        ws.cell(row=rn, column=14, value="Charges normales (le reste)")
        ws.cell(row=rn, column=15, value="P")
        ws.cell(row=rn, column=16, value="=SUM(%s)-P%d" % (rng("Q"), r))
        ws.cell(row=rn, column=17, value='=SUMIF(%s,"E",%s)-Q%d' % (rng("C"), rng("Q"), r))
        ws.cell(row=rn + 1, column=15, value="Q")
        ws.cell(row=rn + 1, column=16, value="=SUM(%s)-P%d" % (rng("R"), r + 1))
        ws.cell(row=rn + 1, column=17, value='=SUMIF(%s,"E",%s)-Q%d' % (rng("C"), rng("R"), r + 1))
        ws.cell(row=rn + 2, column=15, value="S")
        ws.cell(row=rn + 2, column=16, value="=SQRT(P%d^2+P%d^2)" % (rn, rn + 1)); ws.cell(row=rn + 2, column=17, value="=SQRT(Q%d^2+Q%d^2)" % (rn, rn + 1))
        rt = L["m_tot"]
        ws.cell(row=rt, column=14, value="Totale")
        for k2, lab in enumerate(("P", "Q")):
            ws.cell(row=rt + k2, column=15, value=lab)
            ws.cell(row=rt + k2, column=16, value="=P%d+P%d" % (r + k2, rn + k2))
            ws.cell(row=rt + k2, column=17, value="=Q%d+Q%d" % (r + k2, rn + k2))
        ws.cell(row=rt + 2, column=15, value="S")
        ws.cell(row=rt + 2, column=16, value="=SQRT(P%d^2+P%d^2)" % (rt, rt + 1)); ws.cell(row=rt + 2, column=17, value="=SQRT(Q%d^2+Q%d^2)" % (rt, rt + 1))
        ws.cell(row=L["m_pct"], column=14, value="Part des charges motrices")
        ws.cell(row=L["m_pct"], column=15, value="%")
        ws.cell(row=L["m_pct"], column=16, value='=IFERROR(P%d/P%d,"")' % (r + 2, rt + 2)); ws.cell(row=L["m_pct"], column=17, value='=IFERROR(Q%d/Q%d,"")' % (r + 2, rt + 2))
        ws.cell(row=L["m_pct"], column=16).number_format = "0.0%"; ws.cell(row=L["m_pct"], column=17).number_format = "0.0%"
        for rr in range(r, rt + 3):
            for cc in (16, 17):
                if ws.cell(row=rr, column=cc).number_format == "General":
                    ws.cell(row=rr, column=cc).number_format = "0.00"
        ws.freeze_panes = "C9"
        ws.sheet_view.showGridLines = False

    # --- récap puissance ---
    wr = wb.create_sheet("Récap puissance")
    heads = ["Tableau", "Puissance Active Foisonée (kw)", "Puissance Réactive Foisonée (kvar)", "S (kva)", "K.Foisonnement",
             "Coef. de réserve", "S foisonnée avec réserve (kva)", "Cos ϕ", "Puissance Transfo (kVA)", "Réserve réelle"]
    wr["A1"] = "Récap puissance"
    wr["A1"].font = Font(bold=True, size=14)
    for ci, hh in enumerate(heads, start=1):
        c = wr.cell(row=3, column=ci, value=hh)
        c.font = HEADER_FONT
        c.fill = FILL_ENTETE
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    wr.row_dimensions[3].height = 40
    for i, t in enumerate(tabs):
        r = 4 + i
        L = lay[t["cle"]]
        sh = _q(noms[t["cle"]])
        wr.cell(row=r, column=1, value=t.get("titre"))
        wr.cell(row=r, column=2, value="=%s!Q%d" % (sh, L["tot"]))
        wr.cell(row=r, column=3, value="=%s!R%d" % (sh, L["tot"]))
        wr.cell(row=r, column=4, value="=SQRT(B%d^2+C%d^2)" % (r, r))
        wr.cell(row=r, column=5, value="=%s!Q%d" % (sh, L["kf"]))
        wr.cell(row=r, column=6, value="=%s!Q%d" % (sh, L["kres"]))
        wr.cell(row=r, column=7, value="=D%d*E%d*F%d" % (r, r, r))
        wr.cell(row=r, column=8, value='=IFERROR(B%d/D%d,"")' % (r, r))
        wr.cell(row=r, column=9, value='=IF(%s!J%d="","",%s!J%d)' % (sh, L["b"] + 1, sh, L["b"] + 1))
        wr.cell(row=r, column=10, value='=IFERROR(1-G%d/I%d,"")' % (r, r))
        for cc in (2, 3, 4, 7):
            wr.cell(row=r, column=cc).number_format = "0.00"
        wr.cell(row=r, column=6).number_format = "0.00"
        wr.cell(row=r, column=8).number_format = "0.000"
        wr.cell(row=r, column=10).number_format = "0.0%"
    for ci, w in enumerate((26, 16, 16, 12, 12, 12, 16, 9, 14, 12), start=1):
        wr.column_dimensions[get_column_letter(ci)].width = w
    wr.freeze_panes = "B4"
    ordre = [wr] + feuilles + [s for s in wb._sheets if s not in feuilles and s is not wr]
    wb._sheets = ordre
    wb.active = 0
    _meta(wb, dict(spec, meta=dict(spec.get("meta") or {}, type="bilan_puissance")))
    return _envoyer(wb, spec, "bilan_de_puissance.xlsx")


# ---------------------------------------------------------------------------------------------
# Base matériel (V3.06) : transformateurs HT/MT - explications, export Excel (4 feuilles), import
# ---------------------------------------------------------------------------------------------
import json as _json
import os as _os

_EXPL_FILE = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "materiel_transfos_explications.json")
MAT_FILL_IN = PatternFill("solid", fgColor="FFF2CC")
MAT_FILL_CALC = PatternFill("solid", fgColor="F2F2F2")
MAT_FILL_H = PatternFill("solid", fgColor="1F3A5F")
MAT_FILL_G = PatternFill("solid", fgColor="E7ECF2")
MAT_FILL_OK = PatternFill("solid", fgColor="E2F0D9")
MAT_FILL_GRIS = PatternFill("solid", fgColor="BFBFBF")
_MAT_THIN = openpyxl.styles.Side(style="thin", color="BFBFBF")
MAT_BORDER = openpyxl.styles.Border(left=_MAT_THIN, right=_MAT_THIN, top=_MAT_THIN, bottom=_MAT_THIN)
MAT_WRAP = Alignment(wrap_text=True, vertical="top")
MAT_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
# valeurs par défaut des paramètres si la base n'en contient pas (même valeurs que le fichier de départ)
MAT_DEFAUT = {"ratio_onaf_onan": 1.25, "pk_ancrage": 110, "p0_ancrage": 24, "s_ancrage": 40, "exp_pk": 0.85, "exp_p0": 0.70,
              "maj_225": 1.10, "i0_pct": 0.30, "tol_pertes_tot": 0.10, "tol_pertes_comp": 0.15,
              "tol_uk_sup10": 0.075, "tol_uk_inf10": 0.10}
# colonnes de la feuille « Transformateurs » : (titre, largeur)
MAT_COLS = [
    ("id", 14), ("tension_primaire_kV", 11), ("tension_secondaire_kV", 11), ("S_onan_MVA", 10),
    ("S_onaf_MVA = ONAN × rapport", 12), ("serie_puissance", 24), ("uk_pct (saisi)", 9),
    ("Pk_kW (estimé)", 10), ("P0_kW (estimé)", 10), ("I0_pct", 8),
    ("Pk_constructeur_kW (à saisir)", 13), ("P0_constructeur_kW (à saisir)", 13),
    ("Pk_retenu_kW", 10), ("P0_retenu_kW", 10),
    ("I_prim_ONAN_A", 10), ("I_prim_ONAF_A", 10), ("I_sec_ONAN_A", 10), ("I_sec_ONAF_A", 10),
    ("ur_pct = Pk/(S×10)", 10), ("ux_pct = √(uk²−ur²)", 10), ("Z_sec_ohm = uk/100·U²/S", 11),
    ("pouvoir_cc_infini_MVA = S/uk", 12), ("Ik_infini_sec_kA", 10),
    ("P0_max_kW (+tol.)", 10), ("Pk_max_kW (+tol.)", 10), ("couplage", 14), ("statut", 12), ("source / hypothèse", 60),
    ("ONAF_applicable (OUI/NON)", 13),
]


def _mat_num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _mat_en_tete(ws, row, titles, widths=None, height=None):
    for i, t in enumerate(titles, start=1):
        c = ws.cell(row=row, column=i, value=t)
        c.font = HEADER_FONT
        c.fill = MAT_FILL_H
        c.alignment = MAT_CENTER
        c.border = MAT_BORDER
        if widths:
            ws.column_dimensions[get_column_letter(i)].width = widths[i - 1]
    if height:
        ws.row_dimensions[row].height = height


def _mat_charger_explications():
    with open(_EXPL_FILE, encoding="utf-8") as f:
        return _json.load(f)


@etude_electrique.get("/materiel-explications")
def materiel_explications():
    """Explications des colonnes de la base « transformateurs » (signification + principe de calcul)."""
    return jsonify(_mat_charger_explications())


@etude_electrique.post("/export-materiel")
def export_materiel():
    """Classeur 4 feuilles (Transformateurs, Explications, Paramètres, Sources) avec de vraies formules.
    Corps JSON : {transfos:[...], params:[...], sources:[...], filename, meta}."""
    spec = request.get_json(silent=True) or {}
    transfos = spec.get("transfos") or []
    params = spec.get("params") or []
    sources = spec.get("sources") or []
    wb = openpyxl.Workbook()
    wt = wb.active
    wt.title = "Transformateurs"
    wx = wb.create_sheet("Explications")
    wp = wb.create_sheet("Paramètres")
    ws_ = wb.create_sheet("Sources")

    # ---- Paramètres (adresse de chaque paramètre par code)
    wp["A1"] = "Paramètres de la liste (cellules jaunes modifiables)"
    wp["A1"].font = Font(bold=True, size=13)
    _mat_en_tete(wp, 3, ["Code", "Paramètre", "Valeur", "Unité", "Hypothèse / source"], [18, 42, 10, 8, 100])
    P = {}
    lignes_p = list(params)
    codes = {p.get("code") for p in lignes_p}
    for k, v in MAT_DEFAUT.items():
        if k not in codes:
            lignes_p.append({"code": k, "libelle": k, "valeur": v, "unite": "", "source": "Valeur par défaut (absente de la base)"})
    for r, p in enumerate(lignes_p, start=4):
        for c, x in enumerate((p.get("code"), p.get("libelle"), _mat_num(p.get("valeur")), p.get("unite"), p.get("source")), start=1):
            cell = wp.cell(row=r, column=c, value=x)
            cell.border = MAT_BORDER
            if c == 5:
                cell.alignment = MAT_WRAP
        wp.cell(row=r, column=3).fill = MAT_FILL_IN
        wp.cell(row=r, column=3).font = Font(color="0000FF")
        P[p.get("code")] = "Paramètres!$C$%d" % r

    # ---- Transformateurs
    _mat_en_tete(wt, 1, [c[0] for c in MAT_COLS], [c[1] for c in MAT_COLS], 64)
    fmts = {5: "0.000", 8: "0.00", 9: "0.00", 10: "0.00", 13: "0.00", 14: "0.00", 15: "0.0", 16: "0.0", 17: "0.0", 18: "0.0", 19: "0.000",
            20: "0.00", 21: "0.000", 22: "0.0", 23: "0.00", 24: "0.00", 25: "0.00"}
    for i, t in enumerate(transfos):
        r = i + 2
        prim = _mat_num(t.get("tensionPrimaire")) or 0
        maj = P["maj_225"] if prim >= 225 else "1"
        i0 = _mat_num(t.get("i0"))
        f = {
            1: t.get("code"), 2: _mat_num(t.get("tensionPrimaire")), 3: _mat_num(t.get("tensionSecondaire")),
            4: _mat_num(t.get("sOnan")), 5: '=IF(AC%d="NON","",D%d*%s)' % (r, r, P["ratio_onaf_onan"]), 6: t.get("serie"),
            7: _mat_num(t.get("uk")),
            8: "=%s*(D%d/%s)^%s*%s" % (P["pk_ancrage"], r, P["s_ancrage"], P["exp_pk"], maj),
            9: "=%s*(D%d/%s)^%s*%s" % (P["p0_ancrage"], r, P["s_ancrage"], P["exp_p0"], maj),
            10: i0 if i0 is not None else "=%s" % P["i0_pct"],
            11: _mat_num(t.get("pkConstructeur")), 12: _mat_num(t.get("p0Constructeur")),
            13: '=IF(K%d="",H%d,K%d)' % (r, r, r), 14: '=IF(L%d="",I%d,L%d)' % (r, r, r),
            15: "=D%d*1000/(SQRT(3)*B%d)" % (r, r), 16: '=IF(E%d="","",E%d*1000/(SQRT(3)*B%d))' % (r, r, r),
            17: "=D%d*1000/(SQRT(3)*C%d)" % (r, r), 18: '=IF(E%d="","",E%d*1000/(SQRT(3)*C%d))' % (r, r, r),
            19: "=M%d/(D%d*10)" % (r, r), 20: "=SQRT(MAX(0,G%d^2-S%d^2))" % (r, r),
            21: "=G%d/100*C%d^2/D%d" % (r, r, r), 22: "=D%d/(G%d/100)" % (r, r), 23: "=V%d/(SQRT(3)*C%d)" % (r, r),
            24: "=N%d*(1+%s)" % (r, P["tol_pertes_comp"]), 25: "=M%d*(1+%s)" % (r, P["tol_pertes_comp"]),
            26: t.get("couplage"), 27: t.get("statut"), 28: t.get("source"),
            29: ("NON" if str(t.get("onaf") or "").strip().upper() == "NON" else "OUI"),
        }
        for c, v in f.items():
            cell = wt.cell(row=r, column=c, value=v)
            cell.border = MAT_BORDER
            if c in fmts:
                cell.number_format = fmts[c]
            if c in (5, 8, 9, 13, 14) or 15 <= c <= 25:
                cell.fill = MAT_FILL_CALC
            if c in (4, 7, 11, 12):
                cell.fill = MAT_FILL_IN
        wt.cell(row=r, column=28).alignment = MAT_WRAP
        wt.cell(row=r, column=29).fill = MAT_FILL_IN
        if str(t.get("onaf") or "").strip().upper() == "NON":
            for cn in (5, 16, 18):
                wt.cell(row=r, column=cn).fill = MAT_FILL_GRIS
        if i0 is None:
            wt.cell(row=r, column=10).fill = MAT_FILL_CALC
    wt.freeze_panes = "E2"
    if transfos:
        wt.auto_filter.ref = "A1:AC%d" % (len(transfos) + 1)
        dvo = DataValidation(type="list", formula1='"OUI,NON"', allow_blank=False)
        wt.add_data_validation(dvo)
        dvo.add("AC2:AC%d" % (len(transfos) + 300))
        # grisé automatique quand on passe ONAF_applicable à NON dans Excel
        from openpyxl.formatting.rule import FormulaRule
        for lettre in ("E", "P", "R"):
            wt.conditional_formatting.add("%s2:%s%d" % (lettre, lettre, len(transfos) + 300),
                                          FormulaRule(formula=['$AC2="NON"'], fill=MAT_FILL_GRIS))

    # ---- Explications
    ex = _mat_charger_explications()
    wx["A1"] = "Explication des colonnes et principe de calcul"
    wx["A1"].font = Font(bold=True, size=14)
    wx["A2"] = ex.get("intro") or ""
    wx["A2"].alignment = MAT_WRAP
    wx.merge_cells("A2:C2")
    wx.row_dimensions[2].height = 32
    r = 4
    for g in ex.get("groupes", []):
        wx.cell(row=r, column=1, value=g["groupe"]).font = Font(bold=True)
        for k in range(1, 4):
            wx.cell(row=r, column=k).fill = MAT_FILL_G
        r += 1
        for i, t in enumerate(("Colonne", "Signification", "Calcul / principe"), start=1):
            c = wx.cell(row=r, column=i, value=t)
            c.font = HEADER_FONT
            c.fill = MAT_FILL_H
        r += 1
        for col in g.get("colonnes", []):
            for i, v in enumerate((col.get("colonne"), col.get("signification"), col.get("calcul")), start=1):
                c = wx.cell(row=r, column=i, value=v)
                c.alignment = MAT_WRAP
                c.border = MAT_BORDER
            r += 1
        r += 1
    if ex.get("note"):
        wx.cell(row=r, column=1, value=ex["note"]).alignment = MAT_WRAP
        wx.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        wx.row_dimensions[r].height = 32
    for col, w in zip("ABC", (34, 70, 80)):
        wx.column_dimensions[col].width = w

    # ---- Sources
    _mat_en_tete(ws_, 1, ["Réf.", "Document", "Éléments utilisés", "État de vérification", "Lien / emplacement"], [7, 52, 70, 45, 60])
    for r, s in enumerate(sources, start=2):
        for c, v in enumerate((s.get("ref"), s.get("document"), s.get("elements"), s.get("etat"), s.get("lien")), start=1):
            cell = ws_.cell(row=r, column=c, value=v)
            cell.alignment = MAT_WRAP
            cell.border = MAT_BORDER
        etat = str(s.get("etat") or "")
        if "VÉRIFIÉ" in etat:
            ws_.cell(row=r, column=4).fill = MAT_FILL_OK
        elif "NON" in etat:
            ws_.cell(row=r, column=4).fill = MAT_FILL_IN
    _meta(wb, dict(spec, meta=dict(spec.get("meta") or {}, type="materiel_transformateurs")))
    return _envoyer(wb, spec, "Liste_transformateurs_HTMT.xlsx")


@etude_electrique.post("/import-materiel")
def import_materiel():
    """Lit un classeur au format de l'export (feuilles Transformateurs, Paramètres, Sources) et renvoie du JSON ;
    aucune écriture en base (l'écran applique ensuite le résultat). Les formules sont ignorées : seules les
    colonnes saisies sont lues (les colonnes calculées sont recalculées par l'application)."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    data = request.files["file"].read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    if "Transformateurs" not in wb.sheetnames:
        return jsonify({"error": "Feuille « Transformateurs » introuvable : utilisez un fichier exporté depuis « Base matériel »."}), 400

    def txt(v):
        s = _raw(v)
        return s if s != "" else None

    ws = wb["Transformateurs"]
    entetes = {str(ws.cell(row=1, column=c).value or "").strip(): c for c in range(1, ws.max_column + 1)}

    def col(*noms):
        for n in noms:
            for k, c in entetes.items():
                if k.lower().startswith(n.lower()):
                    return c
        return None
    cc = {"code": col("id"), "tensionPrimaire": col("tension_primaire"), "tensionSecondaire": col("tension_secondaire"),
          "sOnan": col("S_onan"), "serie": col("serie_puissance"), "uk": col("uk_pct"), "i0": col("I0_pct"),
          "pkConstructeur": col("Pk_constructeur"), "p0Constructeur": col("P0_constructeur"), "couplage": col("couplage"),
          "statut": col("statut"), "source": col("source"), "onaf": col("ONAF_applicable")}
    if not cc["code"] or not cc["sOnan"]:
        return jsonify({"error": "Colonnes « id » et « S_onan_MVA » introuvables dans la feuille Transformateurs."}), 400
    wbf = None
    try:
        wbf = openpyxl.load_workbook(io.BytesIO(data), data_only=False)["Transformateurs"]
    except Exception:
        wbf = None
    transfos = []
    for r in range(2, ws.max_row + 1):
        code = txt(ws.cell(row=r, column=cc["code"]).value)
        if not code:
            continue
        t = {"rang": len(transfos) + 1}
        for k, c in cc.items():
            if not c:
                continue
            v = ws.cell(row=r, column=c).value
            if k in ("code", "serie", "couplage", "statut", "source"):
                t[k] = txt(v)
            elif k == "onaf":
                t[k] = "NON" if str(txt(v) or "").strip().upper() == "NON" else "OUI"
            elif k == "i0":
                # I0 : valeur propre à la ligne seulement si la cellule n'est pas une formule (renvoi au paramètre)
                brut = wbf.cell(row=r, column=c).value if wbf is not None else v
                t[k] = None if (isinstance(brut, str) and brut.startswith("=")) else _mat_num(v)
            else:
                t[k] = _mat_num(v)
        transfos.append(t)
    params = []
    if "Paramètres" in wb.sheetnames:
        wp = wb["Paramètres"]
        for r in range(4, wp.max_row + 1):
            code = txt(wp.cell(row=r, column=1).value)
            if code:
                params.append({"categorie": "transfo", "code": code, "libelle": txt(wp.cell(row=r, column=2).value),
                               "valeur": _mat_num(wp.cell(row=r, column=3).value), "unite": txt(wp.cell(row=r, column=4).value),
                               "source": txt(wp.cell(row=r, column=5).value), "rang": len(params) + 1})
    sources = []
    if "Sources" in wb.sheetnames:
        wsr = wb["Sources"]
        for r in range(2, wsr.max_row + 1):
            ref = txt(wsr.cell(row=r, column=1).value)
            doc = txt(wsr.cell(row=r, column=2).value)
            if ref or doc:
                sources.append({"categorie": "transfo", "ref": ref, "document": doc, "elements": txt(wsr.cell(row=r, column=3).value),
                                "etat": txt(wsr.cell(row=r, column=4).value), "lien": txt(wsr.cell(row=r, column=5).value),
                                "rang": len(sources) + 1})
    return jsonify({"transfos": transfos, "params": params, "sources": sources})


# ---------------------------------------------------------------------------------------------
# Protections BT (V3.11) : disjoncteurs et déclencheurs par constructeur - import Excel en un seul lot
# ---------------------------------------------------------------------------------------------
import uuid as _uuid
from backend import db as _dbmod, store as _store

# collection -> (feuille Excel, clé d'unicité, colonnes : (en-tête Excel, champ, type), colonnes obligatoires)
PROT_FEUILLES = {
    "etudeMatConstructeurs": ("Constructeurs", ("code",), [("code", "code", "t"), ("nom", "nom", "t"), ("site_web", "siteWeb", "t")], ("code",)),
    "etudeMatDisj": ("Disjoncteurs", ("constructeur", "gamme", "variante", "calibre", "courbe"), [
        ("constructeur", "constructeur", "t"), ("famille", "famille", "t"), ("categorie", "categorie", "t"), ("gamme", "gamme", "t"), ("variante", "variante", "t"),
        ("calibre", "calibre", "t"), ("calibre_a", "calibreA", "n"), ("courbe", "courbe", "t"), ("normes", "normes", "t"),
        ("icu_ka", "icuKa", "n"), ("icu_origine", "icuOrigine", "t"), ("icn_ka", "icnKa", "n"), ("ics_pct", "icsPct", "n"),
        ("im_min_x_in", "imMin", "n"), ("im_max_x_in", "imMax", "n"), ("statut", "statut", "t")], ("constructeur", "categorie", "gamme", "calibre")),
    "etudeMatDecl": ("Declencheurs", ("constructeur", "code"), [
        ("constructeur", "constructeur", "t"), ("code", "code", "t"), ("famille", "famille", "t"), ("type", "type", "t"),
        ("protections", "protections", "t"), ("statut", "statut", "t"), ("serie", "serie", "t"), ("calibre_a", "calibreA", "n"),
        ("ir_min_a", "irMinA", "n"), ("ir_max_a", "irMaxA", "n"), ("im_min_a", "imMinA", "n"), ("im_max_a", "imMaxA", "n")], ("constructeur", "code")),
    "etudeMatAssoc": ("Associations", ("constructeur", "gamme", "declencheur"), [
        ("constructeur", "constructeur", "t"), ("gamme", "gamme", "t"), ("declencheur", "declencheur", "t"), ("calibres", "calibres", "t"),
        ("calibre_min", "calibreMin", "n"), ("calibre_max", "calibreMax", "n"), ("note", "note", "t")], ("constructeur", "gamme", "declencheur")),
    "etudeMatReglages": ("Reglages", ("constructeur", "declencheur", "fonction", "parametre"), [
        ("constructeur", "constructeur", "t"), ("declencheur", "declencheur", "t"), ("fonction", "fonction", "t"), ("parametre", "parametre", "t"),
        ("unite", "unite", "t"), ("crans", "crans", "t"), ("nb_crans", "nbCrans", "i"), ("cran_min", "cranMin", "t"), ("cran_max", "cranMax", "t"),
        ("reglable", "reglable", "t"), ("remarque", "remarque", "t"), ("statut", "statut", "t")], ("constructeur", "declencheur", "fonction", "parametre")),
}
PROT_ORDRE = ["etudeMatConstructeurs", "etudeMatDisj", "etudeMatDecl", "etudeMatAssoc", "etudeMatReglages"]
PROT_DEFAUT_TEXTE = {"variante": "\u2014", "courbe": "\u2014"}   # « — » quand la cellule est vide (clé d'unicité sans NULL)


def _prot_texte(v):
    if v is None:
        return None
    if isinstance(v, float) and v == int(v):
        v = int(v)
    s = str(v).strip()
    return s if s != "" else None


def _prot_lire(wb):
    """Lit les feuilles du classeur ; renvoie ({collection: [docs]}, [avertissements]). Lève ValueError si le fichier
    ne contient aucune feuille reconnue ou s'il manque une colonne obligatoire."""
    data, avert = {}, []
    trouve = False
    for coll in PROT_ORDRE:
        feuille, cle, colonnes, oblig = PROT_FEUILLES[coll]
        if feuille not in wb.sheetnames:
            continue
        trouve = True
        ws = wb[feuille]
        entetes = {}
        for c in range(1, ws.max_column + 1):
            h = _prot_texte(ws.cell(row=1, column=c).value)
            if h:
                entetes[h.strip().lower()] = c
        manque = [o for o in oblig if o not in entetes]
        if manque:
            raise ValueError("Feuille « %s » : colonne(s) obligatoire(s) manquante(s) : %s." % (feuille, ", ".join(manque)))
        docs, vus = [], set()
        for r in range(2, ws.max_row + 1):
            doc = {}
            for entete, champ, ty in colonnes:
                c = entetes.get(entete)
                v = ws.cell(row=r, column=c).value if c else None
                if ty == "n":
                    try:
                        doc[champ] = float(str(v).replace(",", ".")) if _prot_texte(v) is not None else None
                    except ValueError:
                        doc[champ] = None
                        avert.append("%s ligne %d : « %s » n'est pas un nombre (%s)." % (feuille, r, entete, v))
                elif ty == "i":
                    try:
                        doc[champ] = int(float(str(v).replace(",", "."))) if _prot_texte(v) is not None else None
                    except ValueError:
                        doc[champ] = None
                else:
                    doc[champ] = _prot_texte(v)
            if not any(v is not None for v in doc.values()):
                continue                                    # ligne vide
            for k, d in PROT_DEFAUT_TEXTE.items():
                if k in doc and doc[k] is None:
                    doc[k] = d
            if any(doc.get(o_champ) is None for o_champ in [dict((e, f) for e, f, _ in colonnes)[o] for o in oblig]):
                avert.append("%s ligne %d ignorée : champ obligatoire vide." % (feuille, r))
                continue
            if "constructeur" in doc and doc["constructeur"]:
                doc["constructeur"] = doc["constructeur"].upper()
            if coll == "etudeMatConstructeurs":
                doc["code"] = doc["code"].upper()
            k = tuple(doc.get(dict((e, f) for e, f, _ in colonnes)[x]) for x in cle)
            if k in vus:
                avert.append("%s ligne %d ignorée : doublon de la clé (%s)." % (feuille, r, " / ".join(str(x) for x in k)))
                continue
            vus.add(k)
            doc["rang"] = len(docs) + 1
            docs.append(doc)
        data[coll] = docs
    if not trouve:
        raise ValueError("Aucune feuille reconnue (Constructeurs, Disjoncteurs, Declencheurs, Associations, Reglages) : utilisez le fichier d'import « Protections BT ».")
    # Constructeurs référencés mais non déclarés : créés automatiquement (code = nom)
    declares = {d["code"] for d in data.get("etudeMatConstructeurs", [])}
    utilises = {d["constructeur"] for c in PROT_ORDRE[1:] for d in data.get(c, []) if d.get("constructeur")}
    for code in sorted(utilises - declares):
        data.setdefault("etudeMatConstructeurs", []).append({"code": code, "nom": code, "rang": len(data.get("etudeMatConstructeurs", [])) + 1})
        avert.append("Constructeur « %s » absent de la feuille Constructeurs : créé automatiquement." % code)
    # Cohérence : une association ou un réglage doit viser un déclencheur / une gamme connus du même constructeur
    decl = {(d["constructeur"], d["code"]) for d in data.get("etudeMatDecl", [])}
    gam = {(d["constructeur"], d["gamme"]) for d in data.get("etudeMatDisj", [])}
    if "etudeMatDecl" in data:
        for coll, lib in (("etudeMatAssoc", "Associations"), ("etudeMatReglages", "Reglages")):
            for d in data.get(coll, []):
                if (d["constructeur"], d["declencheur"]) not in decl:
                    avert.append("%s : déclencheur « %s » absent de la feuille Declencheurs (%s)." % (lib, d["declencheur"], d["constructeur"]))
    if "etudeMatDisj" in data:
        for d in data.get("etudeMatAssoc", []):
            if (d["constructeur"], d["gamme"]) not in gam:
                avert.append("Associations : gamme « %s » absente de la feuille Disjoncteurs (%s)." % (d["gamme"], d["constructeur"]))
    return data, avert


@etude_electrique.post("/protections/import")
def import_protections():
    """Import Excel des protections BT (Base matériel > Protections BT). Champs du formulaire : file (.xlsx),
    mode = « fusion » (met à jour les lignes de même clé, ajoute les nouvelles, ne supprime rien) ou « remplacer »
    (supprime d'abord, pour chaque constructeur du fichier, ses disjoncteurs, déclencheurs, associations et réglages),
    apercu = « 1 » (simple lecture : renvoie seulement les comptes et avertissements, n'écrit rien).
    Tout est écrit dans UNE transaction : si une ligne est refusée par la base, rien n'est modifié."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    contenu = request.files["file"].read()
    if not contenu:
        return jsonify({"error": "Fichier vide"}), 400
    mode = "remplacer" if request.form.get("mode") == "remplacer" else "fusion"
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    try:
        data, avert = _prot_lire(wb)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    comptes = {c: len(data.get(c, [])) for c in PROT_ORDRE}
    constructeurs = sorted({d["code"] for d in data.get("etudeMatConstructeurs", [])})
    if request.form.get("apercu") == "1":
        return jsonify({"apercu": True, "comptes": comptes, "constructeurs": constructeurs, "avertissements": avert[:50],
                        "nbAvertissements": len(avert)})
    maintenant = datetime.datetime.utcnow().isoformat() + "Z"
    conn = _dbmod.get_connection()
    ajoutes = modifies = supprimes = 0
    try:
        conn.execute("BEGIN IMMEDIATE")
        if mode == "remplacer":
            for coll in PROT_ORDRE[1:]:
                for did, doc in _store.list_docs(conn, coll):
                    if doc.get("constructeur") in constructeurs:
                        _store.delete_doc(conn, coll, did)
                        supprimes += 1
        for coll in PROT_ORDRE:
            _, cle, colonnes, _ = PROT_FEUILLES[coll]
            champs = dict((e, f) for e, f, _ in colonnes)
            cles = [champs[x] for x in cle]
            existants = {}
            for did, doc in _store.list_docs(conn, coll):
                existants[tuple(doc.get(x) for x in cles)] = (did, doc)
            for d in data.get(coll, []):
                k = tuple(d.get(x) for x in cles)
                if k in existants:
                    did, ancien = existants[k]
                    ancien.update(d)
                    ancien["updatedAt"] = maintenant
                    _store.set_doc(conn, coll, did, ancien)
                    modifies += 1
                else:
                    nouveau = dict(d, createdAt=maintenant)
                    _store.set_doc(conn, coll, _uuid.uuid4().hex[:20], nouveau)
                    ajoutes += 1
        conn.commit()
    except _store.StoreError as e:
        conn.rollback()
        return jsonify({"error": "Import annulé, rien n'a été modifié : " + str(e)}), e.status
    except Exception as e:      # noqa
        conn.rollback()
        return jsonify({"error": "Import annulé, rien n'a été modifié : " + str(e)}), 500
    finally:
        conn.close()
    return jsonify({"ok": True, "comptes": comptes, "constructeurs": constructeurs, "ajoutes": ajoutes, "modifies": modifies,
                    "supprimes": supprimes, "avertissements": avert[:50], "nbAvertissements": len(avert)})


# ---------------------------------------------------------------------------------------------
# Catalogue des câbles BT (V3.13) : consultation par famille + import Excel en un seul lot
# ---------------------------------------------------------------------------------------------
# (en-tête Excel, champ, type) ; types : t texte, n nombre, i entier, b booléen (stocké 0 / 1)
CAB_COLONNES = [
    ("ref", "ref", "t"), ("id_caneco", "idCaneco", "i"), ("famille", "famille", "t"), ("section_txt", "sectionTxt", "t"),
    ("section_mm2", "sectionMm2", "n"), ("section_reduite_mm2", "sectionReduiteMm2", "n"), ("nb_conducteurs", "nbConducteurs", "i"),
    ("ame", "ame", "t"), ("isolant", "isolant", "t"), ("temp_max_c", "tempMaxC", "n"), ("temp_cc_max_c", "tempCcMaxC", "n"),
    ("arme", "arme", "b"), ("enterrable", "enterrable", "b"), ("un_v", "unV", "n"), ("un_max_v", "unMaxV", "n"),
    ("diametre_mm", "diametreMm", "n"), ("poids_kg_km", "poidsKgKm", "n"), ("pays", "pays", "t"), ("table_sections", "tableSections", "t"),
    ("autorise", "autorise", "b"), ("k_thermique", "kThermique", "n"), ("r20_mohm_m", "r20MohmM", "n"),
    ("r_chaud_mohm_m", "rChaudMohmM", "n"), ("x_mohm_m", "xMohmM", "n"), ("statut", "statut", "t")]
CAB_OBLIG = ("id_caneco", "famille")


def _cab_bool(v):
    if v is None or str(v).strip() == "":
        return None
    return 1 if str(v).strip().lower() in ("1", "true", "vrai", "oui", "x") else 0


def _cab_lire(wb):
    """Lit la feuille « Données » (ou la première feuille) du catalogue des câbles ; renvoie (docs, avertissements)."""
    ws = wb["Données"] if "Données" in wb.sheetnames else wb[wb.sheetnames[0]]
    entetes = {}
    for c in range(1, ws.max_column + 1):
        h = _prot_texte(ws.cell(row=1, column=c).value)
        if h:
            entetes[h.strip().lower()] = c
    manque = [o for o in CAB_OBLIG if o not in entetes]
    if manque:
        raise ValueError("Colonne(s) obligatoire(s) manquante(s) en ligne 1 : %s." % ", ".join(manque))
    docs, avert, vus = [], [], set()
    for r in range(2, ws.max_row + 1):
        doc = {}
        for entete, champ, ty in CAB_COLONNES:
            c = entetes.get(entete)
            v = ws.cell(row=r, column=c).value if c else None
            if ty in ("n", "i"):
                try:
                    f = float(str(v).replace(",", ".")) if _prot_texte(v) is not None else None
                    doc[champ] = int(f) if (ty == "i" and f is not None) else f
                except ValueError:
                    doc[champ] = None
                    avert.append("Ligne %d : « %s » n'est pas un nombre (%s)." % (r, entete, v))
            elif ty == "b":
                doc[champ] = _cab_bool(v)
            else:
                doc[champ] = _prot_texte(v)
        if not any(v is not None for v in doc.values()):
            continue
        if doc.get("idCaneco") is None or not doc.get("famille"):
            avert.append("Ligne %d ignorée : id_caneco ou famille vide." % r)
            continue
        if doc["idCaneco"] in vus:
            avert.append("Ligne %d ignorée : doublon d'id_caneco (%s)." % (r, doc["idCaneco"]))
            continue
        vus.add(doc["idCaneco"])
        doc["rang"] = len(docs) + 1
        docs.append(doc)
    if not docs:
        raise ValueError("Aucun câble lu : utilisez le fichier « 01_Cables.xlsx » (feuille « Données », en-têtes en ligne 1).")
    return docs, avert


def _cab_ligne(row):
    """Ligne SQL -> dictionnaire aux clés camelCase (même nommage que les collections)."""
    return {_store.sm.to_key("etude_bt_cables", k): row[k] for k in row.keys() if k not in ("extra", "created_at", "cree_par", "updated_at")}


@etude_electrique.get("/cables/familles")
def cables_familles():
    """Familles de câbles avec leurs totaux (nombre de câbles, âme, isolant, sections min / max)."""
    conn = _dbmod.get_connection()
    try:
        rows = conn.execute("SELECT famille, COUNT(*) nb, MIN(section_mm2) smin, MAX(section_mm2) smax, "
                            "GROUP_CONCAT(DISTINCT ame) ames, GROUP_CONCAT(DISTINCT isolant) isolants "
                            "FROM etude_bt_cables GROUP BY famille ORDER BY famille").fetchall()
        total = conn.execute("SELECT COUNT(*) FROM etude_bt_cables").fetchone()[0]
    finally:
        conn.close()
    return jsonify({"total": total, "familles": [{"famille": r["famille"], "nb": r["nb"], "sectionMin": r["smin"], "sectionMax": r["smax"],
                                                   "ames": r["ames"], "isolants": r["isolants"]} for r in rows]})


@etude_electrique.get("/cables/famille")
def cables_famille():
    """Câbles d'UNE famille (paramètre nom) : jamais la liste complète du catalogue."""
    nom = request.args.get("nom", "")
    if not nom:
        return jsonify({"error": "Paramètre « nom » (famille) manquant"}), 400
    conn = _dbmod.get_connection()
    try:
        rows = conn.execute("SELECT * FROM etude_bt_cables WHERE famille=? ORDER BY section_mm2, rang", (nom,)).fetchall()
        return jsonify([dict(_cab_ligne(r), id=r["id"]) for r in rows])
    finally:
        conn.close()


@etude_electrique.post("/cables/import")
def import_cables():
    """Import Excel du catalogue des câbles BT. Formulaire : file (.xlsx), mode = « fusion » (met à jour par id_caneco, ajoute les
    nouveaux, ne supprime rien) ou « remplacer » (vide le catalogue d'abord), apercu = « 1 » (lecture seule : comptes et
    avertissements). Une seule transaction : en cas d'erreur, rien n'est modifié."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    contenu = request.files["file"].read()
    if not contenu:
        return jsonify({"error": "Fichier vide"}), 400
    mode = "remplacer" if request.form.get("mode") == "remplacer" else "fusion"
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
        docs, avert = _cab_lire(wb)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    familles = len({d["famille"] for d in docs})
    if request.form.get("apercu") == "1":
        return jsonify({"apercu": True, "cables": len(docs), "familles": familles, "avertissements": avert[:50], "nbAvertissements": len(avert)})
    maintenant = datetime.datetime.utcnow().isoformat() + "Z"
    conn = _dbmod.get_connection()
    ajoutes = modifies = supprimes = 0
    try:
        conn.execute("BEGIN IMMEDIATE")
        if mode == "remplacer":
            supprimes = conn.execute("SELECT COUNT(*) FROM etude_bt_cables").fetchone()[0]
            conn.execute("DELETE FROM etude_bt_cables")
        existants = {r["id_caneco"]: r["id"] for r in conn.execute("SELECT id, id_caneco FROM etude_bt_cables")}
        for d in docs:
            did = existants.get(d["idCaneco"])
            if did:
                _store.merge_doc(conn, "etudeBtCables", did, dict(d, updatedAt=maintenant))
                modifies += 1
            else:
                _store.set_doc(conn, "etudeBtCables", _uuid.uuid4().hex[:20], dict(d, createdAt=maintenant))
                ajoutes += 1
        conn.commit()
    except _store.StoreError as e:
        conn.rollback()
        return jsonify({"error": "Import annulé, rien n'a été modifié : " + str(e)}), e.status
    except Exception as e:      # noqa
        conn.rollback()
        return jsonify({"error": "Import annulé, rien n'a été modifié : " + str(e)}), 500
    finally:
        conn.close()
    return jsonify({"ok": True, "cables": len(docs), "familles": familles, "ajoutes": ajoutes, "modifies": modifies,
                    "supprimes": supprimes, "avertissements": avert[:50], "nbAvertissements": len(avert)})


# ---------------------------------------------------------------------------------------------------------------------
# V3.15 : lecture d'une note de calcul Caneco (exports « Circuits », « Tab_Tr »...) - AUCUNE écriture en base.
# ---------------------------------------------------------------------------------------------------------------------
CAN_CIRCUITS = {   # clé JSON -> en-tête de la colonne Caneco
    "repere": "Repère", "amont": "Amont", "style": "Style", "contenu": "Contenu", "consommation": "Consommation", "longueur": "Longueur",
    "calibre": "Calibre", "constructeurCode": "Constructeur", "fabricant": "ProtCodeConstCTM", "typeProtection": "Type Protection",
    "blocCoupure": "Bloc de coupure", "blocDecl": "Bloc déclencheur", "blocDiff": "Bloc différentiel", "contacteur": "Contacteur",
    "relais": "Relais thermique", "refInterne": "Réf. Interne", "icu": "Icu", "irTh": "IrTh / IN", "irMg": "IrMg / IN",
    "cable": "Câble", "typeCable": "Type de câble", "sectionPhase": "Section Phase", "sectionNeutre": "Section Neutre", "sectionPe": "Section PE",
    "nbCablesMulti": "Nb câbles multi", "nbPhase": "Nb Phase", "nbNeutre": "Nb Neutre", "nbPe": "Nb PE", "modePose": "Mode de pose", "ame": "Ame", "lieu": "Lieu géo.",
    "designation": "Désignation", "jdbAmont": "JdB Amont", "jdbAval": "Jdb Aval", "ib": "IB"}
CAN_TABLEAUX = {"repere": "Repère", "designation": "Désignation", "amont": "Amont (N)", "protection": "Protection 1 (N)", "calibre": "Calibre Protection (N)",
                "declencheur": "Type Déclencheur (N)", "constructeur": "Constructeur  (N)", "pdc": "PdC Nominal (N)", "ik3": "Ik3 Max (N)"}


def _can_valeur(v):
    """Cellule -> valeur JSON : vide -> None ; flottant entier -> entier ; texte nettoyé."""
    if v is None:
        return None
    if isinstance(v, float):
        if v != v:
            return None
        return int(v) if v == int(v) else round(v, 6)
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def _can_lignes(nom, contenu):
    """Lit la première feuille d'un export Caneco (.xls ancien, .xlsx) -> liste de dictionnaires {en-tête: valeur}.
    En cas d'en-têtes répétés (ex. « Calibre » et « Calibre.1 »), la première colonne est retenue."""
    bas = nom.lower()
    lignes = []
    if bas.endswith(".xls"):
        try:
            import xlrd
        except ImportError:
            raise ValueError("Lecture des fichiers .xls impossible : le module « xlrd » n'est pas installé (pip install xlrd).")
        wb = xlrd.open_workbook(file_contents=contenu)
        feuille = wb.sheet_by_index(0)
        for i in range(feuille.nrows):
            lignes.append([feuille.cell_value(i, j) for j in range(feuille.ncols)])
    else:
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
        for r in wb.worksheets[0].iter_rows(values_only=True):
            lignes.append(list(r))
    if not lignes:
        return []
    entetes = [str(c).strip() if c is not None else "" for c in lignes[0]]
    out = []
    for r in lignes[1:]:
        d = {}
        for h, v in zip(entetes, r):
            if h and h not in d:
                d[h] = _can_valeur(v)
        if any(x is not None for x in d.values()):
            out.append(d)
    return out


def _can_fichiers(upload):
    """Fichier reçu (.zip d'exports, .xls, .xlsx) -> {nom_minuscule: contenu}."""
    import zipfile
    nom = (upload.filename or "").lower()
    contenu = upload.read()
    if nom.endswith(".zip"):
        res = {}
        with zipfile.ZipFile(io.BytesIO(contenu)) as z:
            for n in z.namelist():
                base = n.rsplit("/", 1)[-1].lower()
                if base.endswith((".xls", ".xlsx")) and not base.startswith("~"):
                    res[base] = z.read(n)
        return res
    return {nom: contenu}


@etude_electrique.post("/caneco-lire")
def caneco_lire():
    """Lit une note de calcul Caneco (zip des exports, ou le seul fichier Circuits) et renvoie les circuits (câble, protection) et les
    protections de tableau. Aucune écriture en base : l'import réel est fait par l'écran, circuit par circuit."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    try:
        fichiers = _can_fichiers(request.files["file"])
    except Exception as e:
        return jsonify({"error": "Fichier illisible : %s" % e}), 400
    if not fichiers:
        return jsonify({"error": "Aucun classeur .xls / .xlsx trouvé dans le fichier"}), 400
    circuits_nom = next((n for n in fichiers if n.startswith("circuits")), None)
    if circuits_nom is None and len(fichiers) == 1:
        circuits_nom = next(iter(fichiers))
    if circuits_nom is None:
        return jsonify({"error": "Export « Circuits » introuvable (fichiers reçus : %s)" % ", ".join(sorted(fichiers))}), 400
    try:
        brut = _can_lignes(circuits_nom, fichiers[circuits_nom])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Export « Circuits » illisible : %s" % e}), 400
    if not brut or "Repère" not in brut[0] or "Câble" not in brut[0]:
        return jsonify({"error": "Ce fichier ne ressemble pas à l'export « Circuits » de Caneco (colonnes « Repère » et « Câble » absentes)"}), 400
    circuits = [{k: l.get(h) for k, h in CAN_CIRCUITS.items()} for l in brut if l.get("Repère")]
    tableaux = []
    nom_tab = next((n for n in fichiers if n.startswith("tab_tr")), None)
    if nom_tab:
        try:
            tableaux = [{k: l.get(h) for k, h in CAN_TABLEAUX.items()} for l in _can_lignes(nom_tab, fichiers[nom_tab]) if l.get("Repère")]
        except Exception:
            tableaux = []
    return jsonify({"fichier": circuits_nom, "circuits": circuits, "tableaux": tableaux, "autresFichiers": sorted(n for n in fichiers if n != circuits_nom)})
