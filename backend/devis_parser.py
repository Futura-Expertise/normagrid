"""
Reconnaissance (best-effort) de devis deja emis par l'entreprise (a
enregistrer retroactivement dans l'ERP - voir module Devis > import), a
l'identique du module Factures clients (backend.facture_client_parser),
demande explicite de l'utilisateur.

Reutilise integralement le moteur generique deja eprouve de
facture_client_parser.py (client, numero, date, reference, montants
HT/TVA/TTC, lignes d'articles - ces devis sont generes par le meme
gabarit d'impression que les factures de cette application, voir
static/js/app.js buildPrintHTML/printLetterhead, donc par le meme type
d'outil : le moteur d'extraction deja regle pour reconnaitre ces mises en
page fonctionne sans adaptation). Seule la reconnaissance du champ
"Rev." (specifique au Devis - voir CDC nomenclature, P-08 "version du
devis distincte du numero racine"), absent des factures, est ajoutee ici.
"""

import io
import re

import pdfplumber

from backend.facture_client_parser import (
    guess_fields_client, _find_items_header, _row_cell, _table_looks_merged,
    _norm, _parse_amount, AMOUNT_RE,
)

# "Rev: 00" / "Rev. 01" (toujours pres du haut du document, a cote du
# numero) - meme principe de repli (ligne isolee d'abord, puis motif
# incruste dans une ligne d'en-tete fusionnee par l'extraction PDF) que
# _guess_numero_client dans facture_client_parser.py.
_REVISION_LINE_RE = re.compile(r"^\s*r[ée]v\.?\s*:?\s*([0-9]{1,2})\s*$", re.IGNORECASE)
_REVISION_INLINE_RE = re.compile(r"\br[ée]v\.?\s*:?\s*([0-9]{1,2})\b", re.IGNORECASE)


# "Rév 01" / "R_v_01" / "Rev01" dans le NOM DU FICHIER (la revision n'est pas
# toujours imprimee dans le corps du devis, mais presque toujours dans le
# nom du fichier, ex. "2026-08 Devis_Etude Supp S2G_Butec_Rév 01.pdf").
_REVISION_FILENAME_RE = re.compile(r"(?<![a-z])r(?:[ée]|_)?v[\s_.\-]*0*(\d{1,2})(?!\d)", re.IGNORECASE)


def _guess_revision(lines, filename=""):
    for line in lines[:15]:
        m = _REVISION_LINE_RE.match(line)
        if m:
            return m.group(1).zfill(2)
    for line in lines[:15]:
        m = _REVISION_INLINE_RE.search(line)
        if m:
            return m.group(1).zfill(2)
    base = (filename or "").rsplit(".", 1)[0]
    m = _REVISION_FILENAME_RE.search(base)
    if m:
        return m.group(1).zfill(2)
    return "00"


# ICE de la societe emettrice, imprime dans l'en-tete de chaque devis
# ("RC: 517563 ICE: 002891042000094") : exclu de la recherche de l'ICE du
# CLIENT meme quand l'ICE de la societe n'est pas (encore) renseigne dans
# Parametres - sinon il etait devine, a tort, comme ICE du client.
_OWN_ICE_LETTERHEAD_RE = re.compile(r"\bRC\s*:?\s*\w+\s+ICE\s*:?\s*(\d{10,})", re.IGNORECASE)


def _own_ice_from_letterhead(lines):
    for line in lines[:15]:
        m = _OWN_ICE_LETTERHEAD_RE.search(line)
        if m:
            return m.group(1)
    return ""


def _extract_lignes_full(file_bytes, page_index):
    """Lignes d'articles du devis AVEC leur designation COMPLETE (toutes les
    lignes de texte de la cellule, y compris le texte imprime au-dessus de la
    ligne portant la quantite - pdfplumber coupe parfois une designation
    longue en deux lignes de table). Le moteur partage des factures
    (_rows_to_lignes) ne garde que la PREMIERE ligne de la cellule, ce qui
    suffit pour une facture mais tronquait les devis a designation detaillee.
    Renvoie [] (jamais d'exception) si rien d'exploitable : l'appelant garde
    alors le resultat du moteur partage."""
    if file_bytes is None:
        return []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if page_index is None or page_index < 0 or page_index >= len(pdf.pages):
                return []
            for table in (pdf.pages[page_index].extract_tables() or []):
                header_idx, cols = _find_items_header(table)
                if header_idx is None:
                    continue
                rows = table[header_idx + 1:]
                if _table_looks_merged(rows, cols):
                    return []
                lignes, cur, pending = [], None, []
                for row in rows:
                    desig_raw = _row_cell(row, cols, "designation")
                    if _norm(desig_raw).startswith("total") or "conditions" in _norm(desig_raw):
                        break
                    desig = "\n".join(x.strip() for x in desig_raw.split("\n") if x.strip())
                    m = re.match(r"^\s*(\d+(?:[.,]\d+)?)", _row_cell(row, cols, "qte"))
                    qte_val = _parse_amount(m.group(1)) if m else None
                    m3 = AMOUNT_RE.search(_row_cell(row, cols, "montant"))
                    montant = _parse_amount(m3.group(0)) if m3 else None
                    if qte_val or (qte_val is None and montant is not None and desig):
                        m2 = AMOUNT_RE.search(_row_cell(row, cols, "pu"))
                        pu = _parse_amount(m2.group(0)) if m2 else None
                        qte_val = qte_val or 0
                        if pu is None and montant is not None and qte_val:
                            pu = round(montant / qte_val, 2)
                        cur = {
                            "qte": qte_val, "unite": _row_cell(row, cols, "unite") or "u",
                            "designation": "\n".join(pending + ([desig] if desig else [])),
                            "pu": pu if pu is not None else (montant or 0),
                        }
                        pending = []
                        lignes.append(cur)
                    elif desig:
                        if cur is None:
                            pending.append(desig)
                        else:
                            cur["designation"] = (cur["designation"] + "\n" + desig) if cur["designation"] else desig
                if lignes:
                    return lignes
    except Exception:
        return []
    return []


# Format specifique aux devis "ancien style" generes par cette application
# elle-meme avant la mise en conformite CDC du 2026-09-17 : "Numero: 2026
# 19" - annee et sequence separees par un ESPACE (contrairement aux
# factures, ou _value_after_label partage dans facture_parser.py s'attend a
# un numero en un seul "mot" sans espace, ex. "2026_01"). Ce tokenizeur
# generique couperait donc au premier espace et ne renverrait que "2026" -
# verifie ICI EN PREMIER (avant le moteur generique partage, inchange) pour
# capturer l'annee ET la sequence ensemble, verbatim (RG-009 : une
# reference historique importee n'est jamais reformatee).
_NUMERO_DEVIS_SPACED_RE = re.compile(r"num[ée]ro\s*:?\s*(\d{4}\s+\d{1,6})\b", re.IGNORECASE)


def _guess_numero_devis_spaced(lines):
    for line in lines[:15]:
        m = _NUMERO_DEVIS_SPACED_RE.search(line)
        if m:
            return re.sub(r"\s+", " ", m.group(1).strip())
    return ""


def guess_fields_devis(text, filename, file_bytes=None, page_index=None,
                        exclude_client_names=None, exclude_ice=None):
    lines = [l for l in text.split("\n") if l.strip()]
    own_ice = _own_ice_from_letterhead(lines)
    if own_ice:
        exclude_ice = list(exclude_ice or []) + [own_ice]
    fields = guess_fields_client(
        text, filename, file_bytes=file_bytes, page_index=page_index,
        exclude_client_names=exclude_client_names, exclude_ice=exclude_ice,
    )
    fields["revision"] = _guess_revision(lines, filename)
    numero_spaced = _guess_numero_devis_spaced(lines)
    if numero_spaced:
        fields["numero"] = numero_spaced
    # Designations completes (voir _extract_lignes_full) : on ne remplace
    # que si le nombre de lignes et leurs quantites/prix concordent avec le
    # resultat du moteur partage, pour ne jamais en alterer les montants.
    full = _extract_lignes_full(file_bytes, page_index)
    shared = fields.get("lignes") or []
    if full:
        if not shared:
            fields["lignes"] = full
        elif len(full) == len(shared) and all(
            abs((f["pu"] or 0) - (s_["pu"] or 0)) < 0.01 and (f["qte"] or 0) == (s_["qte"] or 0)
            for f, s_ in zip(full, shared)
        ):
            for f, s_ in zip(full, shared):
                if f["designation"]:
                    s_["designation"] = f["designation"]
    return fields
