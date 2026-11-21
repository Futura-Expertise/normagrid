"""
Import du registre "Liste de suivi des livrables" depuis un classeur Excel
reel (V1.66) - voir claude/codification-livrables-futura-expertise.md, §16.

Point d'entree UNIQUEMENT EN LECTURE (meme principe que
backend/routes/excel_io.py, POST /api/excel/parse) : ce module decode le
classeur envoye et renvoie une structure JSON prete a etre revue/completee
par l'utilisateur (contrat, correspondance Personnel, destinataire) - aucune
ecriture en base n'a lieu ici. Le frontend (static/js/app.js) effectue
ensuite lui-meme toutes les creations/mises a jour via l'API generique
/api/doc/... deja protegee par role (backend/access.py), exactement comme
pour l'import Excel Clients/Fournisseurs.

Trois feuilles du classeur reel sont lues, chacune recherchee par ses
en-tetes (pas par un numero de ligne fixe, le classeur reel ayant plusieurs
lignes de titre/legende avant le vrai tableau) :

- "Liste de suivi des livrables" : un livrable par ligne (designation,
  categorie, statut/etat courant - memes abreviations que
  STATUT_RETOUR_REFERENTIEL depuis la V1.62 -, indice courant, budget
  planifie de la revision courante).
- "Gestion des versions" : une ligne par revision de chaque document
  (indice, date d'envoi, date de retour, statut de retour) - reconstitue
  l'historique des indices (V1.60) et, pour chaque envoi reellement
  transmis, un futur bordereau du Carnet d'envois.
- "Plan de charge <mois>" (nom variable, recherche par prefixe) : colonne
  "Ressources" (ex. "SAI", "YKA/MSR") donnant les initiales des personnes
  affectees a la revision courante de chaque document - matiere premiere de
  l'affectation V1.65, apres correspondance initiale -> fiche Personnel
  fournie par l'utilisateur au moment de l'import (cf. demarche validee).

Les dates de debut/fin planifiees (V1.65) ne sont PAS importees : ce champ
n'est simplement jamais rempli dans ce classeur reel (verifie : aucune des
172 lignes de "Gestion des versions" ne porte de date de debut/fin) -
laisser ce champ vide a l'import plutot que d'inventer une plage est un
choix delibere, documente a l'utilisateur.
"""

import datetime
import io

import openpyxl
from flask import Blueprint, jsonify, request

livrables_import = Blueprint("livrables_import", __name__, url_prefix="/api/livrables-import")

SHEET_LISTE = "Liste de suivi des livrables"
SHEET_VERSIONS = "Gestion des versions"


def _find_header_row(ws, must_contain, max_scan=60):
    """Cherche la 1ere ligne qui contient TOUTES les etiquettes de
    'must_contain' (comparaison exacte apres normalisation espaces/casse)
    parmi ses cellules. Renvoie (numero_ligne, {etiquette_normalisee: col})
    ou (None, {}) si aucune ligne ne convient dans les 'max_scan' premieres."""
    wanted = set(s.strip().lower() for s in must_contain)
    for r in range(1, min(max_scan, ws.max_row) + 1):
        cols = {}
        for c in range(1, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v is None:
                continue
            key = str(v).strip().lower()
            if key:
                cols[key] = c
        if wanted.issubset(cols.keys()):
            return r, cols
    return None, {}


def _cellstr(ws, r, c):
    if not c:
        return ""
    v = ws.cell(row=r, column=c).value
    if v is None:
        return ""
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    return str(v).strip()


def _cellnum(ws, r, c):
    if not c:
        return None
    v = ws.cell(row=r, column=c).value
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _celldate(ws, r, c):
    if not c:
        return None
    v = ws.cell(row=r, column=c).value
    if v is None or v == "":
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    return None


@livrables_import.post("/parse")
def parse_livrables_excel():
    """Lit le classeur .xlsx envoye (champ multipart 'file') et renvoie
    {livrables, historique, initiales} - voir le docstring du module pour le
    detail de chaque feuille lue. Ne touche a aucune donnee en base."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Aucun fichier sélectionné"}), 400
    data = file.read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400

    if SHEET_LISTE not in wb.sheetnames:
        wb.close()
        return jsonify({
            "error": "Feuille « %s » introuvable dans ce fichier." % SHEET_LISTE,
        }), 400
    ws = wb[SHEET_LISTE]
    hdr_row, cols = _find_header_row(
        ws, ["designation document", "code document", "catégorie", "indice", "etat"],
    )
    if hdr_row is None:
        wb.close()
        return jsonify({
            "error": "Les en-têtes attendus sont introuvables dans la feuille « %s ». "
                     "Ce fichier n'a probablement pas la même structure que le classeur "
                     "de référence." % SHEET_LISTE,
        }), 400

    c_design = cols["designation document"]
    c_code = cols["code document"]
    c_cat = cols["catégorie"]
    c_indice = cols["indice"]
    c_etat = cols["etat"]
    c_budget = cols.get("budget planifié")

    livrables = []
    seen_codes = set()
    for r in range(hdr_row + 1, ws.max_row + 1):
        code = _cellstr(ws, r, c_code)
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        livrables.append({
            "codeDocument": code,
            "designation": _cellstr(ws, r, c_design),
            "categorie": _cellstr(ws, r, c_cat),
            "statutAbr": _cellstr(ws, r, c_etat),
            "indiceCourant": _cellstr(ws, r, c_indice),
            "budgetHeures": _cellnum(ws, r, c_budget),
            "ressourcesTexte": "",
        })

    # --- Historique des indices (feuille "Gestion des versions") ----------
    historique = {}
    if SHEET_VERSIONS in wb.sheetnames:
        wsv = wb[SHEET_VERSIONS]
        hdr2, cols2 = _find_header_row(
            wsv, ["code document", "indice", "date d'envoi", "date de retour", "statut de retour"],
        )
        if hdr2 is not None:
            c2_code = cols2["code document"]
            c2_indice = cols2["indice"]
            c2_envoi = cols2["date d'envoi"]
            c2_retour = cols2["date de retour"]
            c2_statut = cols2["statut de retour"]
            for r in range(hdr2 + 1, wsv.max_row + 1):
                code = _cellstr(wsv, r, c2_code)
                if not code:
                    continue
                indice = _cellstr(wsv, r, c2_indice)
                if indice == "":
                    continue
                historique.setdefault(code, []).append({
                    "indice": indice,
                    "dateEnvoi": _celldate(wsv, r, c2_envoi),
                    "dateRetour": _celldate(wsv, r, c2_retour),
                    "statutRetour": _cellstr(wsv, r, c2_statut) or None,
                })

    # --- Ressources affectees (feuille "Plan de charge <mois>") -----------
    # Nom de feuille variable selon le mois couvert par le classeur (ex.
    # "Plan de charge Juillet") : recherchee par prefixe plutot que par nom
    # exact. Une seule feuille de ce type est prise en compte (c'est le cas
    # dans le classeur reel).
    ressources_par_code = {}
    initiales = set()
    for name in wb.sheetnames:
        if name.strip().lower().startswith("plan de charge"):
            wsc = wb[name]
            hdr3, cols3 = _find_header_row(
                wsc, ["code", "désignation du livrable", "ressources"],
            )
            if hdr3 is None:
                continue
            c3_code = cols3["code"]
            c3_ress = cols3["ressources"]
            for r in range(hdr3 + 1, wsc.max_row + 1):
                code = _cellstr(wsc, r, c3_code)
                if not code:
                    continue
                texte = _cellstr(wsc, r, c3_ress)
                if texte:
                    ressources_par_code[code] = texte
                    for part in texte.replace(",", "/").split("/"):
                        part = part.strip()
                        if part:
                            initiales.add(part)
            break

    for l in livrables:
        l["ressourcesTexte"] = ressources_par_code.get(l["codeDocument"], "")

    wb.close()
    return jsonify({
        "livrables": livrables,
        "historique": historique,
        "initiales": sorted(initiales),
    })


def _raw_cell(v):
    """Valeur de cellule en texte brut (V2.20) : dates en AAAA-MM-JJ, entiers
    sans '.0', chaines rognees ; None -> ''."""
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, bool):
        return "Oui" if v else "Non"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v).strip()


def _col_letter(idx):
    s = ""
    while idx > 0:
        idx, r = divmod(idx - 1, 26)
        s = chr(65 + r) + s
    return s


MAX_TABLE_ROWS = 5000


@livrables_import.post("/table")
def read_table():
    """V2.20 : lecture GENERIQUE d'une feuille, sans aucune hypothese sur le
    nom des colonnes - c'est l'utilisateur qui indique ensuite, a l'ecran,
    quelle colonne correspond a quel champ de l'application (correspondance
    des colonnes). Champs multipart : 'file' (obligatoire), 'sheet'
    (facultatif, 1re feuille par defaut), 'headerRow' (facultatif, ligne des
    en-tetes imposee ; detectee automatiquement sinon). Renvoie {sheets, sheet, headerRow,
    columns:[{idx, letter, name}], rows:[[texte,...]]} - rows alignees sur
    columns, lignes vides ignorees. Ne touche a aucune donnee en base."""
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    file = request.files["file"]
    data = file.read()
    if not data:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce fichier Excel (.xlsx) : " + str(e)}), 400
    sheets = [n for n in wb.sheetnames if wb[n].sheet_state == "visible"] or wb.sheetnames
    name = (request.form.get("sheet") or "").strip()
    if name not in wb.sheetnames:
        name = sheets[0]
    ws = wb[name]

    # Ligne d'en-tetes : 1re ligne (parmi les 40 premieres) qui contient au
    # moins 3 cellules non vides et au moins la moitie du maximum observe -
    # tolere les lignes de titre/legende avant le vrai tableau.
    counts = {}
    for r in range(1, min(40, ws.max_row) + 1):
        counts[r] = sum(1 for c in range(1, ws.max_column + 1) if _raw_cell(ws.cell(row=r, column=c).value) != "")
    mx = max(counts.values()) if counts else 0
    hdr = None
    for r in sorted(counts):
        if counts[r] >= 3 and counts[r] * 2 >= mx:
            hdr = r
            break
    # Ligne d'en-tetes imposee par l'utilisateur (V2.21) : les titres peuvent
    # etre en ligne 1 comme sur n'importe quelle autre ligne.
    forced = (request.form.get("headerRow") or "").strip()
    if forced.isdigit() and 1 <= int(forced) <= ws.max_row:
        hdr = int(forced)
    if hdr is None:
        wb.close()
        return jsonify({"error": "Aucune ligne d'en-têtes détectée dans la feuille « %s »." % name}), 400

    columns = []
    for c in range(1, ws.max_column + 1):
        nm = _raw_cell(ws.cell(row=hdr, column=c).value)
        if nm == "":
            # colonne sans titre : conservee seulement si elle contient des donnees
            if not any(_raw_cell(ws.cell(row=r, column=c).value) != "" for r in range(hdr + 1, min(ws.max_row, hdr + 200) + 1)):
                continue
            nm = "(colonne %s)" % _col_letter(c)
        columns.append({"idx": c, "letter": _col_letter(c), "name": nm})

    rows = []
    truncated = False
    for r in range(hdr + 1, ws.max_row + 1):
        vals = [_raw_cell(ws.cell(row=r, column=col["idx"]).value) for col in columns]
        if not any(vals):
            continue
        if len(rows) >= MAX_TABLE_ROWS:
            truncated = True
            break
        rows.append(vals)
    wb.close()
    return jsonify({
        "sheets": sheets, "sheet": name, "headerRow": hdr,
        "columns": columns, "rows": rows, "truncated": truncated,
    })
