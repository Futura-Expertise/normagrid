"""
Conversion d'un releve bancaire PDF en lignes de transactions exploitables,
port direct de la logique du script fourni par l'utilisateur (001_Conversion7.py)
qui tournait jusqu'ici en tache manuelle sur le poste de travail (tkinter +
pdfplumber + pandas, lecture d'un fichier TIERS externe, export .xlsx).

Ce module ne fait QUE l'extraction + le rapprochement TIERS/TYPE/TVA et le
calcul des montants de TVA (RG bancaire interne : le montant de TVA contenu
dans un montant TTC a 20% = montant / 6). Il ne touche pas a la base de
donnees : les routes Flask (backend/routes/releve.py) se chargent de lire la
liste TIERS courante (collection 'tiersBancaires') et de persister le resultat
une fois valide par l'utilisateur dans l'application.

Fidelite au script d'origine : la regex, l'heuristique Debit/Credit et le
rattachement de la 2e ligne de libelle sont repris a l'identique (verifie par
rejeu sur les 3 releves PDF reels fournis - meme nombre de lignes, memes
montants, aux mots-cles TIERS pres qui proviennent desormais de la base au
lieu du fichier 001_Tiers.xlsx).
"""

import io
import re

import pdfplumber

# =====================================================
# Regex ligne principale du releve (identique au script d'origine)
# =====================================================
LINE_PATTERN = re.compile(
    r"(?P<date_op>\d{2}\s\d{2})\s+"
    r"(?P<label>.+?)\s+"
    r"(?P<date_val>\d{2}\s\d{2})\s+"
    r"(?P<amount>[\d\s]+,\d{2})"
)

# Mots-cles qui font basculer une ligne en Credit plutot qu'en Debit.
CREDIT_KEYWORDS = ("CREDIT", "VIREMENT RECU", "REGLEMENT DE VOTRE REMISE CHEQUES")

# =====================================================
# Liste TIERS par defaut (reprise de 001_Tiers.xlsx), utilisee uniquement pour
# amorcer la collection 'tiersBancaires' au premier demarrage de l'application
# (ensuite entierement editable dans Parametres, voir backend/db.py).
# TVA : None = non assujetti (colonne "NA" du fichier d'origine), 0.2 = 20%.
# =====================================================
DEFAULT_TIERS = [
    {"motCle": "Yassine KARIM", "tiers": "Yassine KARIM", "type": "Salarié", "tva": None},
    {"motCle": "Azzeddine ELL", "tiers": "Azzeddine ELL", "type": "Salarié", "tva": None},
    {"motCle": "Hamza DEROUI", "tiers": "Hamza DEROUI", "type": "Salarié", "tva": None},
    {"motCle": "Mohammed SERM", "tiers": "Mohammed SERM", "type": "Salarié", "tva": None},
    {"motCle": "Abdallah BUKH", "tiers": "Abdallah BUKH", "type": "Salarié", "tva": None},
    {"motCle": "Taha RHZIF", "tiers": "Taha RHZIF", "type": "Salarié", "tva": None},
    {"motCle": "DGI", "tiers": "DGI", "type": "Impôt", "tva": None},
    {"motCle": "PACK", "tiers": "PACK", "type": "Frais compte bancaire", "tva": None},
    {"motCle": "SHELL", "tiers": "SHELL", "type": "Gazoil", "tva": None},
    {"motCle": "IT INVENT", "tiers": "IT INVENT", "type": "Fournisseur", "tva": 0.2},
    {"motCle": "011780000 092200000439412", "tiers": "011780000 092200000439412", "type": "Compte courant", "tva": None},
    {"motCle": "Cegeleg", "tiers": "Cegeleg", "type": "Fournisseur", "tva": 0.2},
    {"motCle": "Autoroutes du Maroc", "tiers": "Autoroutes du Maroc", "type": "Autoroute", "tva": 0.2},
    {"motCle": "IAM", "tiers": "IAM", "type": "Téléphone", "tva": 0.2},
    {"motCle": "SRM", "tiers": "SRM", "type": "Eau_Electricité", "tva": 0.2},
    {"motCle": "LYDEC", "tiers": "LYDEC", "type": "Eau_Electricité", "tva": 0.2},
    {"motCle": "Amine Meftah", "tiers": "Amine Meftah", "type": "Loyer", "tva": None},
    {"motCle": "Assurance", "tiers": "Assurance", "type": "Assurance", "tva": 0.2},
    {"motCle": "CNSS", "tiers": "CNSS", "type": "Caisse sociale", "tva": None},
    {"motCle": "b n ficiaire 04", "tiers": "b n ficiaire 04", "type": "Compte courant", "tva": None},
    {"motCle": "RETRAIT GAB", "tiers": "RETRAIT GAB", "type": "Compte courant", "tva": None},
    {"motCle": "JESA", "tiers": "JESA", "type": "Client", "tva": 0.2},
    {"motCle": "VIVALIS", "tiers": "VIVALIS", "type": "Crédit voiture", "tva": None},
    {"motCle": "CegeleC", "tiers": "CegeleC", "type": "Client", "tva": 0.2},
    {"motCle": "Butec", "tiers": "Butec", "type": "Client", "tva": 0.2},
    {"motCle": "AGIOS", "tiers": "AGIOS", "type": "Frais Financier", "tva": None},
    {"motCle": "COMMISSION", "tiers": "COMMISSION", "type": "Frais Financier", "tva": None},
    {"motCle": "TVA", "tiers": "TVA", "type": "Frais Financier", "tva": None},
    {"motCle": "BIM", "tiers": "BIM", "type": "Fournisseur", "tva": 0.2},
    {"motCle": "PETRO", "tiers": "PETRO", "type": "Gazoil", "tva": None},
    {"motCle": "LHOUT", "tiers": "LHOUT", "type": "Restauration", "tva": 0.2},
    {"motCle": "ONCF", "tiers": "ONCF", "type": "Transport", "tva": 0.2},
    {"motCle": "Robobat", "tiers": "Robobat", "type": "Fournisseur Logiciel", "tva": 0.2},
    {"motCle": "Mecanicien", "tiers": "Mecanicien", "type": "Réparation de voiture", "tva": 0.2},
    {"motCle": "SAV", "tiers": "SAV", "type": "Service après vente voiture", "tva": 0.2},
    {"motCle": "EL YOUSS EFI", "tiers": "EL YOUSS EFI", "type": "Compte courant", "tva": None},
    {"motCle": "KASPE RSKY", "tiers": "KASPE RSKY", "type": "Fournisseur Logiciel", "tva": 0.2},
    {"motCle": "BRICO MA", "tiers": "BRICO MA", "type": "Fournisseur", "tva": 0.2},
    {"motCle": "Syndic", "tiers": "Syndic", "type": "Syndic", "tva": None},
]


def extract_raw_rows(pdf_bytes):
    """Extrait les lignes brutes (date_op, date_val, libelle1, libelle2,
    debit, credit) d'un releve PDF, exactement comme le script d'origine :
    une ligne principale reconnue par LINE_PATTERN, suivie le cas echeant
    d'une ligne de libelle complementaire (rejetee si elle ressemble elle
    aussi a une nouvelle ligne de transaction, ex. "28 09")."""
    rows = []
    pending_second_label = False
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.split("\n"):
                match = LINE_PATTERN.search(line)
                if match:
                    label1 = match.group("label").strip()
                    label_full = label1.upper()
                    amount = float(match.group("amount").replace(" ", "").replace(",", "."))
                    if any(k in label_full for k in CREDIT_KEYWORDS):
                        debit, credit = None, amount
                    else:
                        debit, credit = amount, None
                    rows.append({
                        "dateOp": match.group("date_op"),
                        "dateVal": match.group("date_val"),
                        "libelle1": label1,
                        "libelle2": "",
                        "debit": debit,
                        "credit": credit,
                    })
                    pending_second_label = True
                    continue
                if pending_second_label and rows:
                    clean = line.strip()
                    if clean and not re.match(r"^\d{2}\s\d{2}", clean):
                        rows[-1]["libelle2"] = clean
                    pending_second_label = False
    return rows


def match_tiers(libelle1, libelle2, tiers_list):
    """Recherche du tiers correspondant, meme priorite que le script
    d'origine : 1) mot-cle contenant 'TVA', 2) mot-cle contenant 'COMMISSION',
    3) les autres mots-cles, par simple inclusion (motCle dans le texte,
    insensible a la casse)."""
    text = (str(libelle1 or "") + " " + str(libelle2 or "")).upper()

    for t in tiers_list:
        mc = str(t.get("motCle") or "").upper()
        if "TVA" in mc and "TVA" in text:
            return t
    for t in tiers_list:
        mc = str(t.get("motCle") or "").upper()
        if "COMMISSION" in mc and "COMMISSION" in text:
            return t
    for t in tiers_list:
        mc = str(t.get("motCle") or "").upper()
        if mc and mc in text:
            return t
    return None


def _is_vat_applicable(tva):
    """Le flag TVA du fichier d'origine vaut soit 'NA' (texte), soit un taux
    numerique (0.2 pour 20%). On ne calcule le rapprochement que si un taux
    numerique strictement positif est present."""
    if tva is None:
        return False
    if isinstance(tva, str):
        try:
            tva = float(tva.replace(",", "."))
        except ValueError:
            return False
    try:
        return float(tva) > 0
    except (TypeError, ValueError):
        return False


def build_lignes(raw_rows, tiers_list):
    """Enrichit chaque ligne brute avec TIERS/TYPE/TVA (rapprochement) puis
    Client/Fournisseur (montant de TVA = montant / 6 quand la TVA a 20% est
    applicable - montage deja fait a la main par l'utilisateur dans Excel,
    ici automatise) : Client si la ligne est au Credit (encaissement client),
    Fournisseur si elle est au Debit (paiement a un fournisseur)."""
    lignes = []
    for row in raw_rows:
        found = match_tiers(row["libelle1"], row["libelle2"], tiers_list)
        tiers_nom = found["tiers"] if found else "INCONNU"
        type_val = found.get("type", "") if found else ""
        tva_val = found.get("tva") if found else None

        client = fournisseur = None
        if _is_vat_applicable(tva_val):
            montant = row["credit"] if row["credit"] is not None else row["debit"]
            vat_amount = round((montant or 0) / 6, 2)
            if row["credit"] is not None:
                client = vat_amount
            else:
                fournisseur = vat_amount

        lignes.append({
            "dateOp": row["dateOp"],
            "dateVal": row["dateVal"],
            "libelle1": row["libelle1"],
            "libelle2": row["libelle2"],
            "debit": row["debit"],
            "credit": row["credit"],
            "tiers": tiers_nom,
            "type": type_val,
            "tva": tva_val,
            "client": client,
            "fournisseur": fournisseur,
            "facture": "",
            "inconnu": found is None,
        })
    return lignes


def parse_statement(pdf_bytes, tiers_list):
    raw_rows = extract_raw_rows(pdf_bytes)
    lignes = build_lignes(raw_rows, tiers_list)
    total_client = round(sum(l["client"] or 0 for l in lignes), 2)
    total_fournisseur = round(sum(l["fournisseur"] or 0 for l in lignes), 2)
    return lignes, total_client, total_fournisseur
