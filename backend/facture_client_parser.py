"""
Reconnaissance (best-effort) de factures CLIENTS deja emises par l'entreprise
(a enregistrer retroactivement dans l'ERP - voir module Factures > import),
a l'instar du module Factures fournisseurs (backend.facture_parser).

Reutilise au maximum les fonctions generiques deja eprouvees de
facture_parser.py (extraction de texte/OCR, numero, date, montants HT/TVA/
TTC, ICE) - ces heuristiques ne sont pas specifiques aux fournisseurs,
seules la devinette du NOM (client plutot que fournisseur, avec un label
"Client :" quasi toujours present contrairement aux factures fournisseurs
ou ce label manque une fois sur deux) et l'extraction des LIGNES d'articles
(tableau, absente du module fournisseurs) sont propres a ce module.
"""

import re

import pdfplumber

from backend.facture_parser import (  # noqa: F401 - reexportes pour l'appelant
    extract_pages, split_invoices, _norm, _extract_any_date, _guess_date,
    _guess_montants, _guess_ice, AMOUNT_RE, _parse_amount,
    _truncate_at_boundary, _looks_like_company_line, LEGAL_FORM_RE,
    _guess_numero, _guess_numero_from_content,
)

# Sur ces factures generees par outil, le titre "Facture" et son numero
# "N°: 2026_01" sont souvent sur deux lignes SEPAREES (la mise en page place
# le mot "Facture" et le numero l'un au-dessus de l'autre) - la regex
# generique FACTURE_TITLE_RE (facture_parser) exige les deux sur la MEME
# ligne et echoue donc ici, de meme que NUMERO_LABEL_HINTS qui ne reconnait
# que "numero"/"numéro" en toutes lettres, pas le symbole "N°" seul. Repli
# dedie : une ligne qui n'est QUE "N°: <valeur>" (ou "No :", "N :"), sans
# rien d'autre, pour rester un indice fiable.
_BARE_NUMERO_LINE_RE = re.compile(r"^\s*n[°o]?\s*:\s*([A-Za-z0-9][A-Za-z0-9/_\-\.]{1,})\s*$", re.IGNORECASE)
# "N°: <valeur>" au milieu d'une ligne fusionnee avec d'autres informations
# d'en-tete par l'extraction PDF (ex. "RC: 517563 ICE: 002891042000094 N°:
# 2026_01") - exclut les lignes "Référence : BC N°: ..." (c'est alors le
# numero de BON DE COMMANDE client, pas le numero de facture) en les
# ecartant entierement plutot que de tenter un lookbehind.
_INLINE_NUMERO_RE = re.compile(r"\bn[°o]\s*:\s*([A-Za-z0-9][A-Za-z0-9/_\-\.]{1,})", re.IGNORECASE)


def _guess_numero_client(lines, filename):
    n = _guess_numero_from_content(lines)
    if n:
        return n
    for line in lines[:20]:
        m = _BARE_NUMERO_LINE_RE.match(line)
        if m:
            return m.group(1).strip(" .#")
    for line in lines[:20]:
        low = _norm(line)
        if "référence" in low or "reference" in low or "bon de commande" in low:
            continue
        m = _INLINE_NUMERO_RE.search(line)
        if m and any(c.isdigit() for c in m.group(1)):
            return m.group(1).strip(" .#")
    return _guess_numero(lines, filename)

CLIENT_LABEL_RE = re.compile(
    r"(?:client|factur[ée]\s*[àa]|adress[ée]\s*[àa]|destinataire|bill\s*to|sold\s*to)\s*[:\-]\s*(.+)",
    re.IGNORECASE,
)
REFERENCE_LABEL_RE = re.compile(r"r[ée]f[ée]rence\s*[:\-]?\s*(.+)", re.IGNORECASE)


def _guess_reference(lines):
    """Reference BC/PO client (ex. "Référence: BC N°: 4500049453"), reprise
    telle quelle dans le champ "Référence" deja existant du formulaire
    Facture. Tronquee avant un eventuel "Client" fusionne sur la meme ligne
    par l'extraction PDF (mise en page a deux colonnes, cas frequent)."""
    for line in lines[:20]:
        m = REFERENCE_LABEL_RE.search(line)
        if m:
            rest = m.group(1)
            rest = re.split(r"\bclient\b", rest, flags=re.IGNORECASE)[0]
            rest = rest.strip(" .,-:")
            if rest:
                return rest[:120]
    return ""


def _guess_client_from_tables_impl(file_bytes, page_index):
    """Le label "Client :" est presque toujours present sur ces factures
    (contrairement au module fournisseurs), mais le texte brut (extract_text)
    le separe parfois de sa valeur sur une mise en page a deux colonnes (nom
    client long qui s'etale sur 2 lignes). Les CELLULES de tableau
    (extract_tables) gardent elles le bloc d'en-tete plus intact - on y
    cherche le label en repli quand la ligne de texte brut ne donne rien."""
    import io
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if page_index is None or page_index < 0 or page_index >= len(pdf.pages):
                return ""
            tables = pdf.pages[page_index].extract_tables() or []
            for table in tables:
                for row in table:
                    for cell in row:
                        if not cell:
                            continue
                        m = CLIENT_LABEL_RE.search(cell)
                        if not m:
                            continue
                        rest = m.group(1).split("\n", 1)[0].strip(" .,-:")
                        if rest:
                            return rest[:70]
    except Exception:
        return ""
    return ""


def _guess_client(lines, exclude_names=None, file_bytes=None, page_index=None):
    exclude_norm = [_norm(e) for e in (exclude_names or []) if e and len(_norm(e)) >= 3]

    # 1) ligne de texte brut explicitement etiquetee "Client :" (cas le plus
    # frequent - voir docstring ci-dessus pour la limite connue).
    for raw_line in lines[:25]:
        line = _truncate_at_boundary(raw_line, exclude_norm)
        if not line:
            continue
        m = CLIENT_LABEL_RE.search(line)
        if m:
            candidate = m.group(1).strip(" .,-:")
            if candidate:
                return candidate[:70]

    # 2) repli : cellules de tableau (mise en page a deux colonnes qui a
    # separe le label de sa valeur dans le texte brut).
    if file_bytes is not None:
        found = _guess_client_from_tables_impl(file_bytes, page_index)
        if found:
            return found

    # 3) dernier repli : meilleure ligne d'en-tete, meme heuristique
    # generique que la devinette de fournisseur (score forme juridique /
    # position / majuscules), a l'exclusion de sa propre societe.
    best, best_score = None, -1
    for idx, raw_line in enumerate(lines[:15]):
        line = _truncate_at_boundary(raw_line, exclude_norm)
        if not line or not _looks_like_company_line(line):
            continue
        score = 0
        if idx < 4:
            score += 2
        if LEGAL_FORM_RE.search(line):
            score += 3
        if line.strip().isupper() and len(line.strip()) <= 45:
            score += 1
        if score > best_score:
            best, best_score = line.strip(" .,-:"), score
    return (best or "")[:70]


_HT_CELL_HINTS = ("total ht", "montant ht", "sous total", "sous-total")
_TVA_CELL_HINTS = ("tva",)
_TTC_CELL_HINTS = ("total ttc", "net a payer", "net à payer", "montant ttc")


def _totals_from_tables(file_bytes, page_index):
    """Les factures generees par un outil (pas une mise en page libre/scan)
    presentent tres souvent un petit tableau recapitulatif propre
    [["TOTAL HT","250 000,00"],["TVA","50 000,00"],["TOTAL TTC","300 000,00"]]
    - bien plus fiable que la recherche generique par mots-cles sur le texte
    brut (qui doit composer avec des lignes fusionnees). Utilise en priorite,
    avec repli sur backend.facture_parser._guess_montants si aucun tableau de
    ce type n'est trouve (scan/OCR, mise en page differente...)."""
    if file_bytes is None:
        return None, None, None
    import io
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if page_index is None or page_index < 0 or page_index >= len(pdf.pages):
                return None, None, None
            tables = pdf.pages[page_index].extract_tables() or []
            for table in tables:
                ht = tva = ttc = None
                for row in table:
                    if not row or not row[0]:
                        continue
                    label = _norm(row[0])
                    amounts = [c for c in row[1:] if c]
                    val = None
                    for c in reversed(amounts):
                        m = AMOUNT_RE.search(c)
                        if m:
                            val = _parse_amount(m.group(0))
                            break
                    if val is None:
                        continue
                    if ht is None and any(h in label for h in _HT_CELL_HINTS):
                        ht = val
                    elif ttc is None and any(h in label for h in _TTC_CELL_HINTS):
                        ttc = val
                    elif tva is None and any(h in label for h in _TVA_CELL_HINTS):
                        tva = val
                if ht is not None and tva is not None and ttc is not None:
                    return ht, tva, ttc
    except Exception:
        return None, None, None
    return None, None, None


_ITEMS_HEADER_TOKENS = {
    "qte": ("qte", "qté", "quantite", "quantité", "qty"),
    "unite": ("u", "unite", "unité", "unit"),
    "designation": ("designation", "désignation", "description", "libelle", "libellé"),
    "pu": ("prix unit", "prix unitaire", "pu ht", "unit price"),
    "montant": ("montant ht", "montant", "amount", "total"),
}


def _find_items_header(table):
    for ridx, row in enumerate(table):
        cols = {}
        for cidx, cell in enumerate(row):
            norm = _norm(cell or "")
            if not norm:
                continue
            for key, tokens in _ITEMS_HEADER_TOKENS.items():
                if key in cols:
                    continue
                if any(norm == t or norm.startswith(t) for t in tokens):
                    cols[key] = cidx
        if "qte" in cols and "designation" in cols and ("montant" in cols or "pu" in cols):
            return ridx, cols
    return None, None


def _row_cell(row, cols, key):
    idx = cols.get(key)
    return (row[idx] or "").strip() if idx is not None and idx < len(row) else ""


def _cell_is_merged(raw):
    """Vrai si une cellule QTE/PU/MONTANT contient PLUSIEURS valeurs
    numeriques empilees par pdfplumber (separees par des retours a la ligne),
    signe que le tableau source n'a pas de ligne de separation horizontale
    entre chaque article et que pdfplumber a fusionne tout le bloc d'articles
    en une seule ligne de table (voir _extract_items_table)."""
    parts = [p.strip() for p in raw.split("\n") if p.strip()]
    if len(parts) < 2:
        return False
    nombres = sum(1 for p in parts if AMOUNT_RE.search(p))
    return nombres >= 2


def _table_looks_merged(rows, cols):
    for row in rows:
        for key in ("qte", "pu", "montant"):
            if _cell_is_merged(_row_cell(row, cols, key)):
                return True
    return False


def _rows_to_lignes(rows, cols, prefer_montant_qte=False):
    """Construit les lignes d'articles a partir d'une liste de lignes de
    table DEJA correctement decoupees (une ligne de table ~= un article) :
    une nouvelle ligne d'article commence des que la colonne Qte contient un
    nombre OU que la colonne Montant contient un chiffre (cas d'une
    quantite nulle/vide mais d'un montant "0,00" explicitement imprime -
    traite comme un article a part a quantite nulle, jamais fusionne avec
    l'article precedent) ; les lignes suivantes sans aucun chiffre (ex. code
    article imprime sur sa propre ligne) sont rattachees a la designation de
    l'article en cours, jusqu'a une ligne de pied de tableau
    ("total"/"conditions") qui arrete la collecte.

    prefer_montant_qte=True (utilise uniquement pour les tableaux fusionnes
    recuperes via horizontal_strategy="text", voir _extract_items_table) :
    la quantite imprimee est parfois arrondie a l'affichage (ex. "6,3")
    alors que le montant imprime correspond a une quantite plus precise
    (ex. 6,25) - dans ce cas on reconstitue la quantite depuis
    montant/prix-unitaire (qui redonne exactement le total de la facture)
    plutot que de garder la valeur affichee, arrondie."""
    lignes = []
    cur = None
    for row in rows:
        desig_raw = _row_cell(row, cols, "designation")
        if _norm(desig_raw).startswith("total") or "conditions" in _norm(desig_raw):
            break
        qte_raw = _row_cell(row, cols, "qte")
        qte_val = None
        m = re.match(r"^\s*(\d+(?:[.,]\d+)?)", qte_raw)
        if m:
            qte_val = _parse_amount(m.group(1))
        montant_raw = _row_cell(row, cols, "montant")
        m3 = AMOUNT_RE.search(montant_raw)
        montant = _parse_amount(m3.group(0)) if m3 else None
        if qte_val or (qte_val is None and montant is not None and desig_raw):
            pu = None
            m2 = AMOUNT_RE.search(_row_cell(row, cols, "pu"))
            if m2:
                pu = _parse_amount(m2.group(0))
            if qte_val is None:
                qte_val = 0
            elif prefer_montant_qte and montant is not None and pu:
                qte_val = round(montant / pu, 4)
            if pu is None and montant is not None and qte_val:
                pu = round(montant / qte_val, 2)
            cur = {
                "qte": qte_val, "unite": _row_cell(row, cols, "unite") or "u",
                "designation": desig_raw.split("\n")[0].strip(),
                "pu": pu if pu is not None else (montant or 0),
            }
            lignes.append(cur)
        elif cur is not None and desig_raw:
            extra = desig_raw.split("\n")[0].strip()
            if extra and len(cur["designation"]) < 180:
                cur["designation"] = (cur["designation"] + " " + extra).strip()
    return lignes


def _extract_items_table(file_bytes, page_index):
    """Extrait au mieux les lignes d'articles (qte/unite/designation/prix
    unitaire) d'une facture generee par un outil presentant un tableau bien
    forme (voir docstring _totals_from_tables). Renvoie une liste vide
    (jamais d'exception) si rien d'exploitable n'est trouve - l'appelant se
    replie alors sur une ligne unique synthetique.

    Cas particulier (factures a nombreux sous-articles, ex. decompte
    d'heures par intervenant) : quand le tableau source n'a AUCUNE ligne de
    separation horizontale entre les articles, la strategie de detection par
    defaut de pdfplumber ("lines") fusionne tous les articles en une SEULE
    ligne de table, chaque cellule contenant alors toutes les valeurs de sa
    colonne empilees (separees par des retours a la ligne) - l'ancienne
    version de cette fonction ne lisait que la toute premiere valeur de
    chaque colonne et perdait donc tous les articles suivants. On detecte ce
    cas (_table_looks_merged) et on relance l'extraction avec
    horizontal_strategy="text" (decoupage des lignes par position du texte
    plutot que par traits) qui retrouve alors une ligne de table par
    article ; si cette seconde passe ne resout pas la fusion, on garde
    l'extraction d'origine plutot que de renvoyer une liste vide."""
    if file_bytes is None:
        return []
    import io
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if page_index is None or page_index < 0 or page_index >= len(pdf.pages):
                return []
            page = pdf.pages[page_index]
            tables = page.extract_tables() or []
            for table in tables:
                header_idx, cols = _find_items_header(table)
                if header_idx is None:
                    continue
                data_rows = table[header_idx + 1:]
                if _table_looks_merged(data_rows, cols):
                    try:
                        alt_tables = page.extract_tables(table_settings={
                            "vertical_strategy": "lines",
                            "horizontal_strategy": "text",
                        }) or []
                    except Exception:
                        alt_tables = []
                    for alt_table in alt_tables:
                        alt_header_idx, alt_cols = _find_items_header(alt_table)
                        if alt_header_idx is None:
                            continue
                        alt_rows = alt_table[alt_header_idx + 1:]
                        if _table_looks_merged(alt_rows, alt_cols):
                            continue
                        alt_lignes = _rows_to_lignes(alt_rows, alt_cols, prefer_montant_qte=True)
                        if alt_lignes:
                            return alt_lignes
                lignes = _rows_to_lignes(data_rows, cols)
                if lignes:
                    return lignes
    except Exception:
        return []
    return []


def guess_fields_client(text, filename, file_bytes=None, page_index=None,
                         exclude_client_names=None, exclude_ice=None):
    lines = [l for l in text.split("\n") if l.strip()]
    date = _guess_date(lines, text)
    numero = _guess_numero_client(lines, filename)
    reference = _guess_reference(lines)
    client = _guess_client(lines, exclude_client_names, file_bytes, page_index)
    ice = _guess_ice(lines, exclude_ice)

    ht, tva, ttc = _totals_from_tables(file_bytes, page_index)
    if ht is None or tva is None or ttc is None:
        ht2, tva2, ttc2 = _guess_montants(text, lines)
        ht = ht if ht is not None else ht2
        tva = tva if tva is not None else tva2
        ttc = ttc if ttc is not None else ttc2

    lignes = _extract_items_table(file_bytes, page_index)
    if not lignes and ht is not None:
        lignes = [{"qte": 1, "unite": "u", "designation": "Prestations facturées", "pu": ht}]

    return {
        "numero": numero,
        "date": date,
        "reference": reference,
        "montantHT": ht,
        "montantTVA": tva,
        "montantTTC": ttc,
        "client": client,
        "ice": ice,
        "lignes": lignes,
    }
