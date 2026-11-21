"""
Analyse d'un bilan comptable au format CGNC "Modele simplifie" (Tableau n 1,
tel que produit par les logiciels de la plupart des fiduciaires marocaines,
en annexe de la declaration fiscale IS) pour en extraire les rubriques et
leurs montants, en vue de la saisie de l'ecriture d'ouverture (V1.34).

Principe : ce tableau est un formulaire officiel standard (meme libelles
quelle que soit l'entreprise), donc les libelles de rubriques sont stables
d'une annee et d'une entreprise a l'autre - on les recherche tels quels dans
le texte extrait de la page, plutot que de tenter une detection generique de
tableau (fragile sur un PDF genere par un logiciel comptable).

Regle d'extraction du montant "Exercice" (periode courante) : sur la ligne
logique d'une rubrique, les nombres apparaissent toujours dans l'ordre
[Brut, Amortissements] (optionnels, presents seulement pour les
immobilisations amorties), Net/Exercice, Exercice precedent. Le montant de
l'exercice courant est donc en general l'avant-dernier nombre trouve sur la
ligne (ou le seul, si un seul est present - cas d'un premier exercice sans
historique) - voir _montant_exercice() pour les deux exceptions reelles
corrigees en V1.38 (colonne "Exercice precedent" blanche sur une ligne
d'immobilisation a 3 nombres ; immobilisation en non-valeurs amortie a 100%
la meme annee). Les montants peuvent etre imprimes avec separateur decimal
virgule ou point selon l'annee d'export du meme logiciel de fiduciaire
(V1.38 : les deux formats sont acceptes).

Verifie et valide sur quatre bilans reels (FUTURA_EXPERTISE, exercices 2021,
2022, 2023 et 2025) : extraction exacte, total actif = total passif sur les
quatre, soit respectivement 101 566,67 DH (2021, premier exercice partiel),
257 194,64 DH (2022), 261 043,48 DH (2023) et 244 230,07 DH (2025).

Les rubriques "en-tete" qui ne sont que la somme de sous-rubriques detaillees
plus bas dans le formulaire (ex. IMMOBILISATIONS CORPORELLES (C), qui
agrege Terrains/Constructions/Installations.../Materiel de transport/
Immobilisations corporelles diverses) sont volontairement EXCLUES de la
liste de recherche ci-dessous, pour ne jamais compter deux fois le meme
montant - seules les sous-rubriques "feuilles" sont recherchees. Les
quelques rubriques qui n'ont structurellement aucune sous-rubrique dans ce
formulaire (ex. IMMOBILISATIONS EN NON VALEURS (A)) sont elles-memes
traitees comme des feuilles.

Chaque rubrique reconnue est associee a une suggestion de compte du CGNC
(code + libelle) : si ce compte n'existe pas encore dans le plan comptable
de l'installation, l'ecran de revue (V1.34) permet de le creer a la volee,
sur le meme principe que les suggestions de fournisseur a l'import de
factures fournisseurs.
"""

import re

import pdfplumber

NUM_RE = re.compile(r"-?\s?\d{1,3}(?:[\s ]\d{3})*[,.]\d{2}")

# (libelle exact tel qu'imprime dans le formulaire, cote, sens normal,
#  code compte CGNC suggere, libelle suggere pour ce compte)
LABELS = [
    ("IMMOBILISATIONS EN NON VALEURS", "actif", "debiteur", "2111", "Frais préliminaires"),
    ("Fonds commercial", "actif", "debiteur", "2230", "Fonds commercial"),
    ("Immobilisations incorporelles diverses", "actif", "debiteur", "2280", "Autres immobilisations incorporelles"),
    ("Terrains", "actif", "debiteur", "2311", "Terrains"),
    ("Constructions", "actif", "debiteur", "2321", "Constructions"),
    ("Installations techniques, matériel et outillage", "actif", "debiteur", "2332", "Matériel et outillage"),
    ("Matériel de transport", "actif", "debiteur", "2340", "Matériel de transport"),
    ("Immobilisations corporelles diverses", "actif", "debiteur", "2380", "Autres immobilisations corporelles"),
    ("IMMOBILISATIONS FINANCIERES", "actif", "debiteur", "2510", "Titres de participation"),
    ("Marchandises", "actif", "debiteur", "3111", "Marchandises"),
    ("Stocks divers", "actif", "debiteur", "3118", "Stocks divers"),
    ("Clients et comptes rattachés", "actif", "debiteur", "3421", "Clients"),
    ("Comptes d'associés", "actif", "debiteur", "3461", "Associés, comptes débiteurs"),
    ("Débiteurs divers", "actif", "debiteur", "3488", "Divers débiteurs"),
    ("Comptes de régularisation - actif", "actif", "debiteur", "3491", "Charges constatées d'avance"),
    ("TITRES ET VALEURS DE PLACEMENT", "actif", "debiteur", "3500", "Titres et valeurs de placement"),
    ("Chèques et valeurs à encaisser", "actif", "debiteur", "5112", "Chèques à encaisser"),
    ("Banque, T.G et C.C.P.", "actif", "debiteur", "5141", "Banques (comptes courants)"),
    ("Caisses, régies d'avances et accréditifs", "actif", "debiteur", "5161", "Caisses"),

    ("Capital social ou personnel", "passif", "crediteur", "1111", "Capital social"),
    ("Prime d'émission, de fusion, d'apport", "passif", "crediteur", "1130", "Primes d'émission, de fusion, d'apport"),
    ("Ecarts de réévaluation", "passif", "crediteur", "1140", "Écarts de réévaluation"),
    ("Réserves diverses", "passif", "crediteur", "1151", "Réserves diverses"),
    ("Report à nouveau et résultats nets en instance d'affectation", "passif", "crediteur", "1161", "Report à nouveau"),
    ("Résultat net de l'exercice", "passif", "crediteur", "1191", "Résultat net de l'exercice"),
    ("CAPITAUX PROPRES ASSIMILES", "passif", "crediteur", "1310", "Subventions d'investissement"),
    ("DETTES DE FINANCEMENT", "passif", "crediteur", "1481", "Emprunts auprès des établissements de crédit"),
    ("PROVISIONS DURABLES POUR RISQUES ET CHARGES", "passif", "crediteur", "1511", "Provisions pour risques"),
    ("Fournisseurs et comptes rattachés", "passif", "crediteur", "4411", "Fournisseurs"),
    ("Comptes d'associés", "passif", "crediteur", "4463", "Associés, comptes courants créditeurs"),
    ("Créanciers divers", "passif", "crediteur", "4468", "Divers créanciers"),
    ("Comptes de régularisation - passif", "passif", "crediteur", "4491", "Produits constatés d'avance"),
    ("AUTRES PROVISIONS POUR RISQUES ET CHARGES", "passif", "crediteur", "4501", "Autres provisions pour risques et charges"),
    ("Crédits d'escompte et de trésorerie", "passif", "crediteur", "5520", "Crédits d'escompte"),
    ("Banques (soldes créditeurs)", "passif", "crediteur", "5541", "Banques (soldes créditeurs)"),
]


def _parse_amount(tok):
    tok = tok.replace(" ", " ")
    neg = tok.strip().startswith("-")
    digits = tok.replace("-", "").replace(" ", "").replace(",", ".")
    val = float(digits)
    return -val if neg else val


def _montant_exercice(nums, compte=None):
    """Determine le montant "exercice courant" parmi les nombres bruts
    (chaines, telles que trouvees par NUM_RE) presents sur la ligne d'une
    rubrique.

    Regle generale (valable pour la plupart des lignes) : l'avant-dernier
    nombre trouve, le dernier etant toujours la colonne "Exercice
    precedent" (ou le seul nombre, si un seul est present - rubrique sans
    historique).

    Exception 1 (bug reel trouve sur un bilan d'exercice court, sans
    historique anterieur) : pour une ligne d'immobilisation (colonnes Brut /
    Amortissements et provisions / Net / Exercice precedent), quand la
    colonne "Exercice precedent" est totalement absente (blanche, pas meme
    un 0) plutot que la colonne "Amortissements", il ne reste que 3 nombres
    - [Brut, Amortissements, Net] - et la regle naive "avant-dernier
    nombre" prendrait a tort les Amortissements au lieu du Net. Detecte par
    coherence arithmetique (Brut - Amortissements = Net, a 0,015 pres pour
    l'arrondi) : si elle est verifiee sur trois nombres, le troisieme (le
    dernier, pas l'avant-dernier) est le bon montant.

    Exception 2 (bug reel trouve sur IMMOBILISATIONS EN NON VALEURS (compte
    2111), amorties a 100% la meme annee - pratique comptable courante au
    Maroc pour les frais preliminaires d'un exercice de creation) : la ligne
    n'affiche alors que Brut et Amortissements (identiques), le Net (= 0)
    et l'Exercice precedent (blanc, premier exercice) n'etant pas imprimes
    du tout - ce qui ne laisse que 2 nombres egaux, que la regle generale
    interpreterait a tort comme [Net, Precedent]. Restreint au seul compte
    2111 (et non a toutes les immobilisations) car une egalite Net =
    Precedent par simple coincidence (ex. Terrains inchanges d'une annee
    sur l'autre) reste plausible pour les autres rubriques d'immobilisation
    et ne doit pas etre ecrasee a 0."""
    vals = [_parse_amount(n) for n in nums]
    if len(vals) == 3 and abs((vals[0] - vals[1]) - vals[2]) < 0.015:
        return vals[2]
    if compte == "2111" and len(vals) == 2 and abs(vals[0] - vals[1]) < 0.015:
        return 0.0
    return vals[-2] if len(vals) >= 2 else vals[0]


def _find_bilan_page_text(pdf):
    for page in pdf.pages:
        text = page.extract_text() or ""
        if re.search(r"B\s*I\s*L\s*A\s*N", text) and re.search(r"A\s*C\s*T\s*I\s*F", text):
            return text
    return None


def _find_chiffre_affaires(pdf):
    """Cherche la ligne "Chiffre d'affaires" du Compte de Produits et
    Charges (Tableau n 2 du modele simplifie CGNC, page distincte du
    BILAN) et en extrait le montant de l'exercice en cours ainsi que celui
    de l'exercice precedent (purement informatif : les comptes de produits
    et charges ne font jamais partie d'une ecriture d'ouverture, seul leur
    effet net - deja integre au resultat net du bilan - est reporte).
    Meme regle d'extraction que pour le bilan (avant-dernier/dernier nombre
    de la ligne). Retourne (None, None) si la ligne n'est pas trouvee - le
    CPC peut manquer de certains PDF sans que cela bloque l'ecriture
    d'ouverture elle-meme, qui ne depend que de la page BILAN."""
    for page in pdf.pages:
        text = page.extract_text() or ""
        m = re.search(r"Chiffre d.affaires", text)
        if not m:
            continue
        rest = text[m.end():]
        nl = rest.find("\n")
        line_tail = rest if nl == -1 else rest[:nl]
        nums = NUM_RE.findall(line_tail)
        if not nums:
            continue
        current = _montant_exercice(nums)
        precedent = _parse_amount(nums[-1]) if len(nums) >= 2 else None
        return round(current, 2), (round(precedent, 2) if precedent is not None else None)
    return None, None


def parse_bilan(pdf_bytes):
    """Retourne (exercice_debut, exercice_fin, lignes, chiffre_affaires,
    chiffre_affaires_exercice_precedent) ou leve ValueError si la page
    BILAN est introuvable. Chaque ligne : {label, cote, sens, montant,
    compteSuggere, libelleSuggere}. Ne renvoie que les rubriques pour
    lesquelles un montant non nul a ete trouve. chiffre_affaires est le
    chiffre d'affaires de l'exercice cloture (page CPC du meme PDF, si
    presente) - fourni uniquement a titre informatif, jamais integre a
    l'ecriture d'ouverture elle-meme (voir _find_chiffre_affaires)."""
    import io
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = _find_bilan_page_text(pdf)
        chiffre_affaires, chiffre_affaires_precedent = _find_chiffre_affaires(pdf)
    if not text:
        raise ValueError(
            "Page BILAN introuvable dans ce PDF (recherché : un tableau "
            "intitulé « BILAN » avec les sections ACTIF/PASSIF, format "
            "CGNC modèle simplifié)."
        )

    m = re.search(r"Exercice du\s*:\s*(\d{2}/\d{2}/\d{4})\s*Au\s*(\d{2}/\d{2}/\d{4})", text)
    exercice_debut, exercice_fin = (m.group(1), m.group(2)) if m else (None, None)

    split = re.search(r"P\s*A\s*S\s*S\s*I\s*F", text)
    actif_text = text[:split.start()] if split else text
    passif_text = text[split.start():] if split else ""

    results = []
    for label, cote, sens, compte, libelle in LABELS:
        section = actif_text if cote == "actif" else passif_text
        pat = re.escape(label) + r"(?:\s*\(\d\))?"
        mm = re.search(pat, section)
        if not mm:
            continue
        rest_of_line = section[mm.end():]
        nl = rest_of_line.find("\n")
        line_tail = rest_of_line if nl == -1 else rest_of_line[:nl]
        nums = NUM_RE.findall(line_tail)
        if not nums:
            continue
        val = _montant_exercice(nums, compte=compte)
        if abs(val) < 0.005:
            continue
        results.append({
            "label": label, "cote": cote, "sens": sens,
            "compteSuggere": compte, "libelleSuggere": libelle,
            "montant": round(val, 2),
        })
    return exercice_debut, exercice_fin, results, chiffre_affaires, chiffre_affaires_precedent
