"""
Reconnaissance (best-effort) de factures fournisseurs : extraction du texte
d'un fichier PDF ou image (natif si possible, OCR Tesseract sinon/en plus
pour les scans et photos), puis devinette des champs usuels (numero, date,
montants HT/TVA/TTC) par recherche de mots-cles generiques.

A la difference du releve bancaire (un seul format fixe, une seule regex),
chaque fournisseur a sa propre mise en page : il n'existe pas de regle unique
fiable a 100%. Ce module ne vise donc PAS l'exactitude automatique mais une
*premiere estimation* presentee ensuite a l'utilisateur dans un ecran de
verification/correction avant tout enregistrement (meme logique que les
lignes "INCONNU" du module Releves bancaires).
"""

import io
import re

import pdfplumber
from PIL import Image, ImageOps

try:
    import pytesseract
    _TESSERACT_IMPORT_ERROR = None
except Exception as e:  # pytesseract non installe
    pytesseract = None
    _TESSERACT_IMPORT_ERROR = str(e)

# Sur Windows, l'installeur Tesseract (UB Mannheim) ne met pas toujours
# l'executable dans le PATH. On retente avec son emplacement par defaut avant
# de considerer l'OCR indisponible.
_WINDOWS_FALLBACK_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]

MOIS_FR = {
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12,
}
MOIS_EN = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
    "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
# Abreviations a 3 lettres (francais et anglais) pour le format jour/mois
# abrege/annee (ex. "27/Jul/26") - distinct de MOIS_FR/MOIS_EN (noms complets)
# pour ne pas risquer de confondre un nom complet tronque par erreur.
MOIS_ABBR = {
    "jan": 1, "fev": 2, "feb": 2, "mar": 3, "avr": 4, "apr": 4, "mai": 5, "may": 5,
    "jun": 6, "jui": 6, "jul": 7, "aou": 8, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

DATE_LABEL_HINTS = (
    "date de la facture", "date facturation", "date de facturation", "date d'émission",
    "date d'emission", "date du document", "date of issue", "invoice date", "date facture",
)
NUMERO_LABEL_HINTS = (
    "facture n", "n° facture", "numero de facture", "numéro de facture", "invoice number",
    "invoice n", "numero", "numéro",
)
TOTAL_LABEL_HINTS = ("total ttc", "montant total", "net à payer", "net a payer", "amount due", "total général", "total general", "total")
HT_LABEL_HINTS = ("total ht", "montant ht", "sous-total", "sous total", "subtotal")
TVA_LABEL_HINTS = ("total tva", "montant tva", "tva 20%", "tva a 20%")
# Ordre inverse "<taux>% TVA <montant>" (plutot que "TVA <taux>%"), observe
# sur certaines factures (ex. "20% TVA 5 000,00") : le taux (toujours suivi
# de "%") precede alors le libelle "TVA" au lieu de le suivre.
TVA_RATE_BEFORE_LABEL_RE = re.compile(r"\d+(?:[,.]\d+)?\s*%\s*tva\b", re.IGNORECASE)


def _ocr_available():
    return pytesseract is not None


def _otsu_threshold(gray_img):
    """Seuil de binarisation optimal (methode d'Otsu) : a partir de
    l'histogramme (256 niveaux) d'une image en niveaux de gris, choisit le
    seuil qui maximise la variance INTER-classe entre pixels "sombres" et
    "clairs" - plus robuste qu'un seuil fixe (ex. 128) face aux scans/photos
    de luminosite variable."""
    hist = gray_img.histogram()
    total = sum(hist)
    if not total:
        return 128
    sum_total = sum(i * h for i, h in enumerate(hist))
    sum_b = weight_b = 0.0
    best_thresh, best_var = 128, -1.0
    for t in range(256):
        weight_b += hist[t]
        if weight_b == 0:
            continue
        weight_f = total - weight_b
        if weight_f == 0:
            break
        sum_b += t * hist[t]
        mean_b = sum_b / weight_b
        mean_f = (sum_total - sum_b) / weight_f
        var_entre = weight_b * weight_f * (mean_b - mean_f) ** 2
        if var_entre > best_var:
            best_var, best_thresh = var_entre, t
    return best_thresh


def _preprocess_for_ocr(pil_image):
    """Pretraitement multi-etapes avant OCR - inspire d'un outil externe
    d'extraction de factures fournisseurs partage par l'utilisateur, dont les
    tests (76 factures reelles) montrent que la quasi-totalite des erreurs
    d'extraction viennent de scans/photos de mauvaise qualite (le texte PDF
    natif, lui, est "presque toujours juste" et ne passe pas par l'OCR) :
    redressement selon les metadonnees EXIF, recadrage sur le contenu (la
    marge blanche autour d'un scan/photo n'aide pas l'OCR), agrandissement
    des petites images (resolution insuffisante = 1ere cause d'erreur OCR),
    renforcement du contraste, puis binarisation par seuil d'Otsu. Renvoie
    (image_grise_contrastee, image_binarisee) : les deux sont fournies a
    l'OCR avec des modes de segmentation differents (voir _run_ocr), aucun
    des deux pretraitements n'etant systematiquement superieur a l'autre
    selon le type de document (texte dense vs. tableau/ticket)."""
    try:
        img = ImageOps.exif_transpose(pil_image)
    except Exception:
        img = pil_image
    gray = img.convert("L")
    try:
        bbox = ImageOps.invert(gray).getbbox()
        if bbox:
            gray = gray.crop(bbox)
    except Exception:
        pass
    if gray.width and gray.width < 2400:
        ratio = 2400 / gray.width
        try:
            gray = gray.resize((2400, max(1, round(gray.height * ratio))), Image.LANCZOS)
        except Exception:
            pass
    try:
        gray = ImageOps.autocontrast(gray)
    except Exception:
        pass
    try:
        seuil = _otsu_threshold(gray)
        binaire = gray.point(lambda p, s=seuil: 255 if p > s else 0)
    except Exception:
        binaire = gray
    return gray, binaire


def _ocr_passes(pil_image, lang):
    """3 passes OCR complementaires sur l'image pretraitee (meme principe
    qu'un outil externe d'extraction de factures partage par l'utilisateur) :
    chaque mode de segmentation de page (--psm) de Tesseract a ses propres
    angles morts, et les cumuler (plutot que de n'en garder qu'un) augmente
    les chances de capter chaque champ au moins une fois. --psm 6 (bloc de
    texte uniforme) sur l'image grise convient aux factures a mise en page
    "classique" ; --psm 11 (texte eparpille, sans ordre de lecture) et --psm
    3 (page complete, detection automatique) sur l'image binarisee aident sur
    les tableaux et tickets de caisse. Les echecs partiels n'interrompent pas
    les autres passes.

    Renvoie (texte_combine, texte_ordonne) : `texte_combine` concatene les 3
    passes (utilise pour toute recherche par mot-cle, ou l'ordre des lignes
    n'a pas d'importance - numero/montants/ICE/devise) ; `texte_ordonne` ne
    contient QUE la 1ere passe (--psm 6), la seule des 3 a conserver un ordre
    de lecture fiable de haut en bas - --psm 11 en particulier melange
    deliberement l'ordre des lignes ("sans ordre de lecture"). Necessaire
    pour les heuristiques qui supposent que "les premieres lignes du texte"
    = "le haut du document" (nom du fournisseur en en-tete, numero de
    facture pres du titre) : les y exposer telles quelles degraderait ces
    heuristiques plutot que de les ameliorer (constate sur plusieurs factures
    reelles ou le nom du fournisseur, correctement trouve en 1 seule passe,
    etait ecrase par une ligne de pub/tagline remontee depuis la passe
    --psm 11 une fois les textes simplement concatenes)."""
    gray, binaire = _preprocess_for_ocr(pil_image)
    textes = []
    for img, psm in ((gray, 6), (binaire, 11), (binaire, 3)):
        try:
            textes.append(pytesseract.image_to_string(img, lang=lang, config="--psm %d" % psm))
        except Exception:
            textes.append("")
    texte_ordonne = textes[0] if textes and textes[0].strip() else ""
    texte_combine = "\n".join(t for t in textes if t and t.strip())
    return texte_combine, texte_ordonne


def _run_ocr(pil_image):
    """Tente l'OCR en francais+anglais (3 passes pretraitees, voir
    _ocr_passes), se degrade vers l'anglais seul si le paquet de langue
    francais n'est pas installe, et signale clairement si Tesseract lui-meme
    n'est pas installe (plutot que de planter l'import). Renvoie (texte,
    ocr_utilise, texte_ordonne) - voir _ocr_passes pour le role de
    `texte_ordonne` (identique a `texte` quand la voie de repli simple,
    sans pretraitement, est utilisee : une seule passe = forcement ordonnee)."""
    if not _ocr_available():
        return "", False, ""
    langs_to_try = ["fra+eng", "fra", "eng"]
    last_err = None
    for lang in langs_to_try:
        try:
            texte, texte_ord = _ocr_passes(pil_image, lang)
            if texte.strip():
                return texte, True, texte_ord
            # Les 3 passes pretraitees n'ont rien donne (image atypique) :
            # retente une derniere fois en simple avant de changer de langue.
            simple = pytesseract.image_to_string(pil_image, lang=lang)
            return simple, True, simple
        except Exception as e:
            last_err = e
            continue
    # Tesseract absent du PATH (frequent sur Windows) : on tente les
    # emplacements d'installation par defaut avant d'abandonner.
    for path in _WINDOWS_FALLBACK_PATHS:
        try:
            pytesseract.pytesseract.tesseract_cmd = path
            simple = pytesseract.image_to_string(pil_image, lang="eng")
            return simple, True, simple
        except Exception as e:
            last_err = e
            continue
    return "", False, ""


def extract_pages(filename, file_bytes):
    """Renvoie (pages, ocr_disponible) ou `pages` est une liste de
    (texte, ocr_utilise, texte_ordonne), une entree par page du PDF (une
    seule entree pour une image, qui n'a qu'une seule "page"). Base de
    l'extraction ET du decoupage multi-factures (voir split_invoices
    ci-dessous) : contrairement a l'ancienne extract_text, ne se limite plus
    a la 1ere page d'un PDF.

    `texte_ordonne` (3e element) est identique a `texte` pour une page de
    texte PDF natif (deja dans l'ordre de lecture) ; pour une page passee a
    l'OCR, voir _ocr_passes - ce n'est QUE la 1ere des 3 passes, la seule a
    garder un ordre de lecture fiable, utilisee par les heuristiques
    sensibles a la position (haut de document) dans guess_fields."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext in ("jpg", "jpeg", "png"):
        try:
            img = Image.open(io.BytesIO(file_bytes))
            txt, used, txt_ord = _run_ocr(img)
            return [(txt, used, txt_ord)], _ocr_available()
        except Exception:
            return [("", False, "")], _ocr_available()

    if ext == "pdf":
        try:
            pages_out = []
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    txt = page.extract_text() or ""
                    if len(txt.strip()) >= 25:
                        pages_out.append((txt, False, txt))
                        continue
                    # Page scannee/image : on la rasterise et on passe a l'OCR.
                    img = page.to_image(resolution=300).original
                    ocr_txt, used, ocr_ord = _run_ocr(img)
                    # Garde le texte natif (meme court) si l'OCR n'a rien donne.
                    pages_out.append(((ocr_txt or txt), used, (ocr_ord or txt)))
            return (pages_out or [("", False, "")]), _ocr_available()
        except Exception:
            return [("", False, "")], _ocr_available()

    return [("", False, "")], _ocr_available()


def _norm(s):
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _parse_amount(token):
    token = token.strip().replace(" ", "").replace("\u202f", "")
    token = token.replace(",", ".")
    # Garde seulement le dernier point comme separateur decimal si plusieurs
    # (ex. "1.234.567,89" deja transforme en "1.234.567.89").
    parts = token.split(".")
    if len(parts) > 2:
        token = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return round(float(token), 2)
    except ValueError:
        return None


AMOUNT_RE = re.compile(r"(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+(?:[,.]\d{2}))")
# Ligne ne contenant QU'un montant isole, eventuellement accompagne d'un mot
# court incident (devise/TTC/HT...) avant ou apres - utilisee par le tout
# dernier repli de _guess_montants pour reperer des montants empiles chacun
# sur sa propre ligne (voir plus bas, cas Logamine).
_BARE_AMOUNT_LINE_RE = re.compile(
    r"^(?:(?:dhs?|mad|eur|usd|ttc|ht)\s*)*(?P<montant>" + AMOUNT_RE.pattern + r")"
    r"\s*(?:(?:dhs?|mad|eur|usd|ttc|ht|€|\$)\s*)*\.?$",
    re.IGNORECASE,
)
# Nombre "nu" en toute fin de ligne (pas de virgule/point decimal) qui n'est
# PAS la suite d'un montant deja reconnu juste avant (garde-fou : le
# caractere precedant immediatement le groupe ne doit etre ni chiffre ni
# virgule/point) - utilise par _guess_montants pour recuperer un montant
# dont la virgule decimale a ete perdue a l'OCR (ex. "615" au lieu de
# "6,15", vu sur une ligne de ventilation TVA Marjane reelle).
_TRAILING_BARE_INT_RE = re.compile(r"(?<![,.\d])(\d{2,6})\s*\.?$")
DATE_SLASH_RE = re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})")
DATE_TEXT_FR_RE = re.compile(
    r"(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})",
    re.IGNORECASE,
)
DATE_TEXT_EN_RE = re.compile(
    r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})",
    re.IGNORECASE,
)
# Format "27/Jul/26" ou "27-Jul-2026" (mois en abreviation de 3 lettres,
# francaise ou anglaise, entre deux separateurs date) - observe sur des
# factures generees par des outils anglophones utilisant ce format plutot
# qu'un mois tout en chiffres.
DATE_DMON_RE = re.compile(
    r"\b(\d{1,2})[/\-](jan|fev|feb|mar|avr|apr|mai|may|jun|jui|jul|aou|aug|sep|oct|nov|dec)[a-zéû]*[/\-](\d{2,4})\b",
    re.IGNORECASE,
)
# Date a 8 chiffres colles (separateurs perdus a l'OCR), reconnue seulement
# juste apres le mot "le" (ex. "Payé par virement le 18042026" pour
# 18/04/2026) pour rester un indice fiable et ne pas confondre avec un autre
# nombre a 8 chiffres (numero de facture, de compte...).
DATE_COLLEE_RE = re.compile(r"\ble\s+(\d{2})(\d{2})(\d{4})\b", re.IGNORECASE)


def _guess_date(lines, full_text):
    # 1) ligne contenant un indice de libelle de date
    for line in lines:
        low = _norm(line)
        if any(h in low for h in DATE_LABEL_HINTS):
            d = _extract_any_date(line)
            if d:
                return d
    # 2) sinon la premiere date plausible trouvee dans tout le texte
    return _extract_any_date(full_text)


def _extract_any_date(text):
    m = DATE_SLASH_RE.search(text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        y = int(y) if len(y) == 4 else 2000 + int(y)
        if 1 <= d <= 31 and 1 <= mo <= 12:
            return "%04d-%02d-%02d" % (y, mo, d)
    m = DATE_TEXT_FR_RE.search(text)
    if m:
        d = int(m.group(1)); mo = MOIS_FR.get(m.group(2).lower()); y = int(m.group(3))
        if mo:
            return "%04d-%02d-%02d" % (y, mo, d)
    m = DATE_TEXT_EN_RE.search(text)
    if m:
        mo = MOIS_EN.get(m.group(1).lower()); d = int(m.group(2)); y = int(m.group(3))
        if mo:
            return "%04d-%02d-%02d" % (y, mo, d)
    m = DATE_DMON_RE.search(text)
    if m:
        d = int(m.group(1)); mo = MOIS_ABBR.get(m.group(2).lower()[:3]); y = m.group(3)
        y = int(y) if len(y) == 4 else 2000 + int(y)
        if mo and 1 <= d <= 31:
            return "%04d-%02d-%02d" % (y, mo, d)
    m = DATE_COLLEE_RE.search(text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12:
            return "%04d-%02d-%02d" % (y, mo, d)
    return ""


NUMERO_EXCLUDE_HINTS = ("compte", "rib", "iban", "banque", "bancaire", "swift", "client")
# Le prefixe entre "Facture"/"Invoice" et le code peut s'ecrire "N°", "No",
# "n" tout court, ou en toutes lettres "numero"/"number" (ex. "Invoice number
# 42912B43 0025") : il faut consommer le mot ENTIER, sinon une alternative
# "n[°o]?" matcherait juste le "n" initial de "number" et laisserait "umber"
# comme capture (bug observe sur les factures OpenAI/Anthropic).
FACTURE_TITLE_RE = re.compile(
    r"(?:facture|invoice)\s*(?:n(?:°|o|umero|umber)?\.?)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/\-\._]{2,})",
    re.IGNORECASE,
)
# Variante pour un numero comportant un espace interne juste apres un court
# prefixe alphabetique (ex. "Facture N° : GG 018-2026") : voir le commentaire
# dans _guess_numero_from_content, qui l'utilise en repli quand
# FACTURE_TITLE_RE ne trouve aucune correspondance du tout sur la ligne.
FACTURE_TITLE_SPACED_RE = re.compile(
    r"(?:facture|invoice)\s*(?:n(?:°|o|umero|umber)?\.?)?\s*[:#]?\s*([A-Za-z]{1,4})\s+([A-Za-z0-9][A-Za-z0-9/\-\._]{2,})",
    re.IGNORECASE,
)
# Utilisee par _guess_numero_from_content pour verifier que le "facture"
# trouve par FACTURE_TITLE_RE n'est pas en fait la fin de "date de (la)
# facture"/"date facture" (un libelle de DATE) - tolere l'article "la"/"du"
# intercale, pas pris en compte par une simple comparaison de suffixe fixe.
_DATE_FACTURE_AVANT_RE = re.compile(r"\bdate(?:\s+d[eu])?(?:\s+la)?\s*$", re.IGNORECASE)


# Capture directement la valeur qui suit le libelle sur la meme ligne
# (plutot que d'ancrer en fin de ligne) : un tableau "Numero | <valeur>"
# fusionne avec une autre colonne sur la meme ligne par l'extraction PDF
# (ex. "Numéro FC2600056 ICE : 002891042000094") ferait sinon capter a tort
# la valeur de la colonne suivante (ici l'ICE) plutot que le vrai numero.
#
# NUMERO_LABEL_WORDS_RE repere seulement l'EMPLACEMENT du libelle (avec des
# limites de mots \b, pour ne pas matcher un simple sous-mot comme "numero"
# a l'interieur d'un autre terme). La valeur elle-meme est ensuite cherchee
# token par token APRES le libelle via value_after_label(), qui retient le
# premier token contenant au moins un chiffre : un simple re.search sur toute
# la ligne captait a tort un mot purement alphabetique situe juste apres le
# libelle (ex. "Numéro de facture fiscale G137453050 One Microsoft Place"
# capturait "fiscale" au lieu de "G137453050", bug observe sur les factures
# Microsoft multi-pages et qui faisait croire a tort qu'une page annexe etait
# le debut d'une nouvelle facture lors du decoupage multi-factures).
NUMERO_LABEL_WORDS_RE = re.compile(
    r"\b(?:facture\s*n|n°\s*facture|num[ée]ro\s*de\s*facture|invoice\s*number|invoice\s*n|num[ée]ro)\b",
    re.IGNORECASE,
)
_NUMERO_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9/\-\._#°]{1,}")


def _value_after_label(line):
    """Renvoie le premier token contenant au moins un chiffre apres le
    libelle "numero"/"facture n"/etc. sur cette ligne, ou None si le libelle
    n'est pas present ou si aucun token numerique ne suit."""
    m = NUMERO_LABEL_WORDS_RE.search(line)
    if not m:
        return None
    rest = line[m.end():].lstrip(" :#\t")
    for tok in _NUMERO_TOKEN_RE.findall(rest):
        if any(c.isdigit() for c in tok):
            return tok.strip(" .#")
    return None


def _guess_numero_from_content(lines):
    """Comme _guess_numero, mais sans le repli sur le nom de fichier : renvoie
    une chaine vide si rien n'est trouve dans le contenu du document. Utilise
    par le decoupage multi-factures (voir split_invoices) pour savoir si une
    page porte son PROPRE numero de facture, independamment du nom du
    fichier importe (qui ne peut de toute facon pas s'appliquer a une page
    particuliere)."""
    # 1) priorite forte : "Facture <code>" / "Invoice <code>" pres du haut du
    # document (titre habituel), sans mot-cle bancaire sur la meme ligne.
    for line in lines[:12]:
        if any(h in _norm(line) for h in NUMERO_EXCLUDE_HINTS):
            continue
        m = FACTURE_TITLE_RE.search(line)
        val = None
        if m:
            val = m.group(1)
        else:
            # Repli : un numero peut comporter un espace interne apres un
            # court prefixe alphabetique (ex. "Facture N° : GG 018-2026") -
            # la classe de caracteres de FACTURE_TITLE_RE ne peut pas
            # franchir cet espace (pour ne pas s'etendre trop loin par
            # erreur sur une ligne quelconque), et son quantificateur {2,}
            # exige au moins 3 caracteres d'un seul tenant : "GG" (2
            # caracteres) ne suffit alors pas et la recherche echoue sans
            # meme produire de correspondance partielle. Cette variante
            # dediee capture explicitement <prefixe court> + espace +
            # <suite>, le prefixe pouvant alors n'avoir que 1 caractere.
            m2 = FACTURE_TITLE_SPACED_RE.search(line)
            if m2 and any(c.isdigit() for c in m2.group(2)):
                m = m2
                val = m2.group(1) + " " + m2.group(2)
        if m is not None and val is not None:
            # Evite de confondre avec "date de facture"/"date de la
            # facture"/"date facture" (un libelle de DATE, pas de numero) :
            # le mot-cle "facture" y est bien present, mais juste apres
            # "date (de) (la)", jamais apres un vrai "Facture N°". Verifie
            # les quelques caracteres juste avant la correspondance pour
            # ecarter ce cas precis (bug observe : "El Oulfa Date de
            # facture : 27/Jul/26" captait a tort la date comme numero de
            # facture, la vraie ligne "Facture N° : GG 018-2026" ayant
            # echoue juste avant a cause de l'espace ; puis, variante avec
            # article ("Date de la facture : 12-04-2026", cas Marjane
            # reel), non reconnue par une simple comparaison de suffixe
            # fixe - d'ou le passage a une regex tolerant l'article).
            before = _norm(line[:m.start()])
            if _DATE_FACTURE_AVANT_RE.search(before):
                continue
            if val.isdigit():
                continue  # evite de capter un simple numero de page/date
            if not any(c.isdigit() for c in val):
                # evite de capter un mot purement alphabetique situe juste
                # apres "facture"/"invoice" (ex. "facture fiscale ...") :
                # un vrai numero de facture contient quasi toujours un
                # chiffre (bug observe sur les factures Microsoft multi-pages,
                # ou "Numéro de facture fiscale G137453050 ..." captait a
                # tort "fiscale" au lieu du vrai numero).
                continue
            return val.strip(" .#")
    # 2) sinon, une ligne avec un indice "numero/invoice number", en excluant
    # les lignes qui parlent manifestement d'un compte bancaire.
    for line in lines:
        low = _norm(line)
        if any(h in low for h in NUMERO_EXCLUDE_HINTS):
            continue
        if any(h in low for h in NUMERO_LABEL_HINTS):
            v = _value_after_label(line)
            if v:
                return v
            # repli : libelle et valeur sur la meme ligne, rien d'autre apres.
            m = re.search(r"([A-Z0-9][A-Z0-9/\-\._#°]{2,})\s*$", line.strip())
            if m:
                return m.group(1).strip(" .#")
    return ""


def _guess_numero(lines, filename):
    n = _guess_numero_from_content(lines)
    if n:
        return n
    # repli : le nom de fichier contient souvent deja une reference utile
    base = filename.rsplit("/", 1)[-1]
    base = re.sub(r"\.(pdf|png|jpe?g)$", "", base, flags=re.IGNORECASE)
    return base.strip()


def _best_amount_on_lines(lines, hints):
    candidates = []
    for line in lines:
        low = _norm(line)
        if any(h in low for h in hints):
            amounts = [a for a in AMOUNT_RE.findall(line) if _parse_amount(a) is not None]
            if amounts:
                candidates.append(_parse_amount(amounts[-1]))
    if not candidates:
        return None
    return max(candidates)


# Taux de TVA marocains standards (loi de finances). Utilise comme garde-fou
# supplementaire sur les replis les plus generiques de _guess_montants (ceux
# qui cherchent une triplette HT/TVA/TTC n'importe ou dans le document, sans
# aucun libelle "TVA"/"total" a proximite) : en plus de la coherence
# arithmetique HT+TVA=TTC - necessaire mais pas suffisante, de nombreux
# triplets de nombres sans lien entre eux la verifient par hasard sur une
# facture dense en chiffres - on verifie que le ratio TVA/HT correspond a peu
# de choses pres a un taux reellement en vigueur, ce qui elimine une bonne
# partie des faux positifs de ces replis. Inspire d'un outil externe
# d'extraction de factures fournisseurs partage par l'utilisateur (meme
# principe, meme liste de taux).
_TAUX_TVA_USUELS = (0.20, 0.14, 0.10, 0.07)


def _taux_tva_plausible(ht, tva, strict=True):
    """strict=True : tolere un ecart de +/-1% autour d'un taux usuel (cas ou
    on a une bonne confiance dans les 2 valeurs). strict=False : bande large
    3%-21% (replis les plus risques, ou seule l'ordre de grandeur compte -
    ecarte surtout les ratios absurdes comme une TVA superieure a son HT)."""
    if tva == 0:
        return True
    if ht is None or ht <= 0:
        return False
    ratio = tva / ht
    if strict:
        return any(abs(ratio - r) < 0.01 for r in _TAUX_TVA_USUELS)
    return 0.03 <= ratio <= 0.21


def _guess_montants(full_text, lines):
    ht = tva = ttc = None

    # Cas frequent sur les tableaux a deux colonnes fusionnees par
    # l'extraction PDF : un en-tete ("Total HT | Total TTC | NET A PAYER")
    # sans aucun montant sur sa PROPRE ligne, les valeurs se retrouvant sur
    # la ligne suivante - parfois fusionnee avec un AUTRE tableau (ex.
    # Code/Base/Taux/Taxe) place juste a cote dans la mise en page d'origine.
    # On aligne les valeurs sur les libelles reconnus dans l'en-tete, en
    # prenant les N DERNIERS montants de la ligne suivante (N = nombre de
    # libelles) : les eventuelles colonnes d'un autre tableau fusionne se
    # retrouvent alors avant, et sont ignorees.
    for idx, line in enumerate(lines):
        low = _norm(line)
        labels = []
        if "total ht" in low:
            labels.append("ht")
        if "total ttc" in low:
            labels.append("ttc")
        if "net à payer" in low or "net a payer" in low or "amount due" in low:
            labels.append("ttc")
        if len(labels) < 2 or AMOUNT_RE.search(line) or idx + 1 >= len(lines):
            continue
        nxt_nums = [_parse_amount(a) for a in AMOUNT_RE.findall(lines[idx + 1])]
        nxt_nums = [n for n in nxt_nums if n is not None]
        if len(nxt_nums) >= len(labels):
            vals = nxt_nums[-len(labels):]
            for lbl, v in zip(labels, vals):
                if lbl == "ht" and ht is None:
                    ht = v
                if lbl == "ttc" and ttc is None:
                    ttc = v
        break

    # Cas d'une mise en page a 3 colonnes (Montant HT / Montant TVA /
    # Montant TTC) ou l'OCR a totalement disloque l'alignement horizontal :
    # les LIBELLES se retrouvent regroupes sur plusieurs lignes consecutives
    # (une ligne = un libelle isole, ex. "TOTAL HT" / "TOTAL TVA" /
    # "TOTAL TTC"), suivies PLUS LOIN d'autant de lignes consecutives
    # contenant chacune un seul montant isole, dans le MEME ordre. Reconnu
    # seulement si au moins 2 libelles distincts se suivent (pour rester un
    # indice fiable) et si le nombre de lignes-montant qui suivent correspond
    # exactement.
    if ht is None or tva is None or ttc is None:
        _BARE_LABEL_FIELD = {
            "total ht": "ht", "montant ht": "ht",
            "total tva": "tva", "montant tva": "tva",
            "total ttc": "ttc", "montant ttc": "ttc",
            "net à payer": "ttc", "net a payer": "ttc", "amount due": "ttc",
        }
        n = len(lines)
        i = 0
        while i < n:
            field = _BARE_LABEL_FIELD.get(_norm(lines[i]))
            if not field:
                i += 1
                continue
            seq_fields = []
            j = i
            while j < n and _norm(lines[j]) in _BARE_LABEL_FIELD:
                seq_fields.append(_BARE_LABEL_FIELD[_norm(lines[j])])
                j += 1
            if len(seq_fields) < 2:
                i = j + 1
                continue
            vals = []
            k = j
            while k < n and len(vals) < len(seq_fields):
                m = re.fullmatch(AMOUNT_RE.pattern, lines[k].strip())
                if not m:
                    break
                v = _parse_amount(m.group(0))
                if v is None:
                    break
                vals.append(v)
                k += 1
            if len(vals) == len(seq_fields):
                for fld, v in zip(seq_fields, vals):
                    if fld == "ht" and ht is None:
                        ht = v
                    elif fld == "tva" and tva is None:
                        tva = v
                    elif fld == "ttc" and ttc is None:
                        ttc = v
                break
            i = j + 1

    # Ligne(s) de "ventilation TVA" tabulaire (ex. OCR Electroplanet/Marjane) :
    # "TVA A 20% 20,00 % 4 690,00 938,00 5 628,00" -> HT, TVA, TTC dans l'ordre,
    # reconnue si les 3 derniers nombres de la ligne verifient HT+TVA=TTC.
    # Volontairement place AVANT le repli generique ci-dessous : cette meme
    # ligne de ventilation contient a la fois un libelle du type "TVA A 20%"
    # (qui matcherait aussi TVA_LABEL_HINTS) ET plusieurs montants (taux en
    # pourcentage, HT, TVA, TTC) - le repli generique, qui se contente de
    # prendre le DERNIER montant de la ligne, y lirait alors a tort le TTC
    # a la place de la TVA (bug trouve sur une facture Marjane reelle, ou
    # "44,1667 8,8333 53,00" donnait tva=53,00 au lieu de 8,83). La
    # verification HT+TVA=TTC rend ce repli strictement plus fiable des
    # qu'une telle ligne existe.
    #
    # Facture a PLUSIEURS taux de TVA (vente a taux mixtes, ex. 20% ET 10%
    # sur la meme facture - cas Marjane reel) : il existe alors plusieurs
    # lignes "TVA A X%" candidates, chacune ne portant que le sous-total de
    # SON taux. En prendre naivement la premiere (comportement d'origine,
    # ci-dessus avant correction) renvoie un sous-total partiel au lieu du
    # total de la facture. On privilegie donc, dans l'ordre :
    #   1) une ligne "TOTAL" du tableau de ventilation, elle-meme coherente
    #      HT+TVA=TTC (le vrai total de la facture, quand l'OCR l'a
    #      correctement lue) ;
    #   2) a defaut, la SOMME de toutes les lignes de taux ("TVA A X%")
    #      individuellement coherentes - couvre le cas d'une ligne TOTAL
    #      absente/illisible a l'OCR, avec au moins 2 taux retrouves ;
    #   3) a defaut (une seule ligne de taux exploitable, notamment le cas
    #      le plus frequent d'un taux unique sur toute la facture), le
    #      comportement d'origine : cette unique ligne.
    # Sur une ligne de taux (pas "TOTAL"), si les 3 derniers montants ne
    # verifient pas HT+TVA=TTC, on tente aussi un repli specifique : le TTC
    # de la ligne a parfois perdu sa virgule decimale a l'OCR (ex. "615" au
    # lieu de "6,15", vu sur une facture Marjane reelle) - on ne l'accepte
    # que si la reinterpretation en centimes retombe juste sur HT+TVA.
    if ht is None or tva is None or ttc is None:
        candidats_total = []
        candidats_taux = []
        for line in lines:
            norm_line = _norm(line)
            est_total = "total" in norm_line and "sous total" not in norm_line and "sous-total" not in norm_line
            est_taux = "tva" in norm_line
            if not est_total and not est_taux:
                continue
            nums = [_parse_amount(a) for a in AMOUNT_RE.findall(line)]
            nums = [n for n in nums if n is not None]
            triplette_ligne = None
            if len(nums) >= 3:
                a, b, c = nums[-3], nums[-2], nums[-1]
                if abs(a + b - c) < 0.05 and c > 0:
                    triplette_ligne = (a, b, c)
            if triplette_ligne is None and est_taux and not est_total and len(nums) >= 2:
                m_bare = _TRAILING_BARE_INT_RE.search(line.strip())
                if m_bare and len(m_bare.group(1)) > 2:
                    digits = m_bare.group(1)
                    c = _parse_amount(digits[:-2] + "," + digits[-2:])
                    a, b = nums[-2], nums[-1]
                    if c is not None and c > 0 and abs(a + b - c) < 0.05:
                        triplette_ligne = (a, b, c)
            if triplette_ligne is None:
                continue
            if est_total:
                candidats_total.append(triplette_ligne)
            elif est_taux:
                candidats_taux.append(triplette_ligne)
        triplette = None
        if candidats_total:
            triplette = candidats_total[0]
        elif len(candidats_taux) >= 2:
            triplette = (
                round(sum(c[0] for c in candidats_taux), 2),
                round(sum(c[1] for c in candidats_taux), 2),
                round(sum(c[2] for c in candidats_taux), 2),
            )
        elif candidats_taux:
            triplette = candidats_taux[0]
        if triplette:
            a, b, c = triplette
            ht, tva, ttc = ht or a, tva or b, ttc or c

    # Repli generique : montant le plus proche d'un libelle usuel, quand
    # libelle et valeur sont deja sur la meme ligne (cas le plus courant).
    #
    # Le libelle generique "total" (dernier de TOTAL_LABEL_HINTS, pour
    # capter un simple "Total" non qualifie) matcherait aussi par sous-
    # chaine une ligne "Sous Total"/"Sous-total" - qui est sans ambiguite
    # le montant HT, jamais le TTC. On exclut donc ces lignes des
    # candidats TTC pour ne jamais confondre les deux.
    if ttc is None:
        ttc_lines = [l for l in lines if "sous total" not in _norm(l) and "sous-total" not in _norm(l)]
        ttc = _best_amount_on_lines(ttc_lines, TOTAL_LABEL_HINTS)
    if ht is None:
        ht = _best_amount_on_lines(lines, HT_LABEL_HINTS)
    if tva is None:
        tva = _best_amount_on_lines(lines, TVA_LABEL_HINTS)
    if tva is None:
        # Ordre inverse "<taux>% TVA <montant>" (voir TVA_RATE_BEFORE_LABEL_RE).
        for line in lines:
            if TVA_RATE_BEFORE_LABEL_RE.search(line):
                amounts = [a for a in AMOUNT_RE.findall(line) if _parse_amount(a) is not None]
                if amounts:
                    tva = _parse_amount(amounts[-1])
                    break

    # Dernier repli, sans condition sur le mot "tva" present sur la ligne :
    # n'importe quelle ligne ou 3 nombres consecutifs verifient HT+TVA=TTC
    # (ex. une ligne de total de tableau "90,00 18,00 108,00" sans aucun
    # libelle reconnu par l'OCR autour). Volontairement le DERNIER recours
    # (risque de faux positif sur une ligne d'article dont le HT+TVA
    # coincide par hasard avec son propre TTC) : utilise seulement si ni le
    # HT ni la TVA n'ont ete trouves par une methode plus fiable, et
    # seulement la PREMIERE triplette valide de chaque ligne (une TVA
    # exactement nulle est ignoree, trop souvent un faux positif du type
    # "a, 0, a"). Si le TTC est DEJA connu (trouve par ailleurs), on exige en
    # plus que le "c" de la triplette lui corresponde (coherence) avant d'en
    # deduire HT/TVA - evite d'accepter une triplette sans rapport avec la
    # facture ; sinon on ne contraint pas le TTC trouve ici (il complete
    # alors les 3 valeurs). Necessaire pour ne pas perdre HT/TVA quand le
    # TTC seul a ete trouve plus haut par un libelle "Total" generique,
    # sans que ce dernier ait pu egalement reperer HT/TVA (cas Logamine reel,
    # ou les 3 montants figurent aussi, chacun isole sur sa propre ligne -
    # voir le repli supplementaire juste apres).
    if ht is None and tva is None:
        best = None
        for line in lines:
            nums = [_parse_amount(a) for a in AMOUNT_RE.findall(line)]
            nums = [v for v in nums if v is not None]
            for idx2 in range(len(nums) - 2):
                a, b, c = nums[idx2], nums[idx2 + 1], nums[idx2 + 2]
                if b == 0:
                    continue
                if c <= 0 or abs(a + b - c) >= 0.05 or not _taux_tva_plausible(a, b, strict=False):
                    continue
                if ttc is not None and abs(c - ttc) >= 0.05:
                    continue
                best = (a, b, c)
                break
        if best:
            ht, tva, ttc = best[0], best[1], (ttc if ttc is not None else best[2])

    # Dernier repli supplementaire : 3 lignes consecutives contenant chacune
    # un SEUL montant isole (eventuellement accompagne d'un mot court comme
    # "DH"/"TTC"/"MAD"), dans l'ordre HT puis TVA puis TTC, sans que leurs
    # libelles ("TOTAL Hors Taxe", "TVA à 20%"...) apparaissent sur la meme
    # ligne qu'eux (ex. facture Logamine reelle, ou les 3 montants sont
    # imprimes d'abord, chacun sur sa propre ligne, et les libelles
    # seulement APRES - l'inverse de l'hypothese du bloc "libelles groupes"
    # plus haut, qui suppose les libelles avant leurs valeurs). Memes garde-
    # fous que le repli precedent (TVA non nulle, coherence HT+TVA=TTC,
    # coherence avec un TTC deja connu le cas echeant) ; utilise seulement
    # si rien de plus fiable n'a donne HT/TVA.
    if ht is None and tva is None:
        bare_vals = []
        for line in lines:
            m = _BARE_AMOUNT_LINE_RE.match(line.strip())
            if not m:
                bare_vals = []  # une ligne non conforme rompt la sequence en cours
                continue
            v = _parse_amount(m.group("montant"))
            if v is None:
                bare_vals = []
                continue
            bare_vals.append(v)
            if len(bare_vals) > 3:
                bare_vals = bare_vals[-3:]
            if len(bare_vals) == 3:
                a, b, c = bare_vals
                if b == 0 or c <= 0 or abs(a + b - c) >= 0.05 or not _taux_tva_plausible(a, b, strict=False):
                    continue
                if ttc is not None and abs(c - ttc) >= 0.05:
                    continue
                ht, tva = a, b
                if ttc is None:
                    ttc = c
                break

    # Coherence minimale : si on a HT+TVA mais pas TTC, on le deduit (et
    # inversement) - seulement quand ca tombe juste.
    if ttc is None and ht is not None and tva is not None:
        ttc = round(ht + tva, 2)
    elif ht is None and ttc is not None and tva is not None:
        ht = round(ttc - tva, 2)
    elif tva is None and ttc is not None and ht is not None:
        tva = round(ttc - ht, 2)

    return ht, tva, ttc


_DEVISE_RE = {
    # Le symbole "$" (comme "€" ci-dessous) n'est retenu seul que s'il est
    # directement accole a un montant plausible : un "$" isole, loin de tout
    # nombre, est le plus souvent un artefact d'OCR (signe trouve par erreur
    # dans un logo/tampon/texte degrade d'un scan ou d'une photo) plutot
    # qu'une vraie mention de devise - risque accru depuis l'ajout du
    # pretraitement/multi-passes OCR (voir _run_ocr), qui lit davantage de
    # texte, y compris du bruit, sur les documents de mauvaise qualite
    # (observe sur plusieurs factures marocaines reelles, ou un "$" isole
    # issu du bruit de l'image faisait passer a tort la devise en USD).
    "USD": re.compile(
        r"\bUSD\b|\$\s*\d{1,3}(?:[ .]\d{3})*[,.]\d{2}|\d{1,3}(?:[ .]\d{3})*[,.]\d{2}\s*\$"
    ),
    # Le symbole "€" seul (sans le mot "EUR") n'est retenu que s'il est
    # directement accole a un montant plausible (ex. "€ 123,45" ou
    # "123,45 €") : un "€" isole, loin de tout nombre, est presque toujours
    # un artefact d'OCR sur un document marocain (observe sur une facture
    # Brico Mondial reelle, un "€" isole fausement detecte comme devise EUR
    # alors que le document est en MAD - RC/IF/Patente/CNSS/ICE marocains et
    # montant en DH explicitement ecrit en toutes lettres).
    "EUR": re.compile(
        r"\bEUR\b|€\s*\d{1,3}(?:[ .]\d{3})*[,.]\d{2}|\d{1,3}(?:[ .]\d{3})*[,.]\d{2}\s*€"
    ),
    "MAD": re.compile(r"\bMAD\b|\bDHS?\b|DIRHAM", re.IGNORECASE),
}


def _guess_devise(text):
    # Mots entiers uniquement : "EUR" en sous-chaine de "FOURNISSEUR",
    # "INGENIEUR", etc. donnait de nombreux faux positifs.
    for code in ("USD", "EUR", "MAD"):
        if _DEVISE_RE[code].search(text):
            return code
    return "MAD"


FOURNISSEUR_LABEL_RE = re.compile(
    r"(?:fournisseur|vendu\s*par|vendeur|émis\s*par|emis\s*par|émetteur|emetteur|"
    r"raison\s*sociale|vendor|seller|bill\s*from|sold\s*by)\s*[:\-]\s*(.+)",
    re.IGNORECASE,
)
LEGAL_FORM_RE = re.compile(
    r"\b(SARL(?:\s*AU)?|SAS(?:U)?|EURL|SNC|GIE|ETS|STE|SOCIETE|SOCI[ÉE]T[ÉE]|"
    r"GROUPE|GROUP|INC|LLC|LTD|LIMITED|COMPANY|LTEE|CORP|GMBH|SRL)\b",
    re.IGNORECASE,
)
# Lignes qu'on ne veut jamais prendre pour un nom de fournisseur (titres,
# libelles de champs, mentions legales/contact...). Des mots-cles courts
# ("ice", "rc", "if", "tva"...) doivent etre delimites par des frontieres de
# mot (\b) pour ne pas matcher a l'interieur d'un autre mot (ex. "if" dans
# "récapitulatif").
FOURNISSEUR_EXCLUDE_PHRASES = ("bon de commande", "purchase order", "bill to", "ship to")
FOURNISSEUR_EXCLUDE_WORDS_RE = re.compile(
    r"\b(facture|invoice|devis|quote|date|page|tel|t[ée]l|fax|e[\s\-]?mail|www|http|"
    r"ice|rc|if|patente|cnss|adresse|address|client|destinataire|objet|"
    r"r[ée]f[ée]rence|num|num[ée]ro|total|montant|tva|"
    r"rue|avenue|boulevard|bd|lot|lotissement|imm|immeuble|r[ée]sidence|"
    r"quartier|angle|appt|appartement|[ée]tage|hay|km|route|"
    r"projet|project|chantier|affaire|dossier)\b",
    re.IGNORECASE,
)


def _looks_like_company_line(line):
    low = _norm(line)
    if not low or len(low) < 3 or len(low) > 70:
        return False
    if any(h in low for h in FOURNISSEUR_EXCLUDE_PHRASES):
        return False
    if FOURNISSEUR_EXCLUDE_WORDS_RE.search(low):
        return False
    if _extract_any_date(line):
        return False
    if "@" in line:
        return False
    digits = sum(c.isdigit() for c in line)
    if digits >= 4:
        return False
    letters = sum(c.isalpha() for c in line)
    if letters < 3:
        return False
    return True


BOUNDARY_PHRASES_RE = re.compile(
    r"\b(bill to|ship to|sold to|deliver to|adress[ée]\s*[àa]|facturer\s*[àa]|"
    r"vendu\s*[àa])\b",
    re.IGNORECASE,
)


def _truncate_at_boundary(line, exclude_norm):
    """Beaucoup de factures presentent emetteur/destinataire sur une seule
    ligne fusionnee par l'extraction PDF (mise en page deux colonnes,
    ex. 'CEJELEG ENGINEERING Futura Expertise' ou 'OpenAI OpCo, LLC Bill
    to'). Plutot que de rejeter toute la ligne, on la coupe juste avant le
    premier de ces reperes (son propre nom de societe, ou un libelle de
    colonne type 'Bill to'/'Adressé à') pour garder la partie utile."""
    cut = len(line)
    for name in exclude_norm:
        m = re.search(re.escape(name), line, re.IGNORECASE)
        if m and m.start() < cut:
            cut = m.start()
    m2 = BOUNDARY_PHRASES_RE.search(line)
    if m2 and m2.start() < cut:
        cut = m2.start()
    result = line[:cut].strip(" .,-:")
    return result or None


def _guess_fournisseur(lines, exclude_names=None):
    """Devine le nom du fournisseur a partir du contenu du document (en-tete/
    logo, ou ligne explicitement etiquetee), en excluant (ou en tronquant)
    les lignes qui correspondent au nom de sa propre societe (champ
    Parametres > Societe) - celui-ci apparait tres souvent sur la facture en
    tant que client, et ne doit jamais etre pris pour le fournisseur."""
    exclude_norm = [_norm(e) for e in (exclude_names or []) if e and len(_norm(e)) >= 3]

    # 1) ligne explicitement etiquetee ("Fournisseur :", "Vendu par", ...)
    for raw_line in lines[:25]:
        line = _truncate_at_boundary(raw_line, exclude_norm)
        if not line:
            continue
        m = FOURNISSEUR_LABEL_RE.search(line)
        if m:
            candidate = m.group(1).strip(" .,-:")
            if candidate:
                return candidate[:70]

    # 2) sinon, meilleure ligne d'en-tete (logo/raison sociale en haut du
    # document) parmi les premieres lignes, a l'exclusion de sa propre societe.
    # best_score demarre a -1 (et non 0) : une ligne candidate legitime peut
    # tres bien ne marquer aucun bonus (pas dans les 4 premieres lignes, pas
    # de forme juridique reconnue, pas tout en majuscules) et scorer 0 - avec
    # un depart a 0, "score > best_score" rejetait alors systematiquement le
    # tout premier candidat valide au lieu de l'adopter.
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


# L'ICE (Identifiant Commun de l'Entreprise) marocain est un code numerique
# a 15 chiffres, quasi toujours imprime sous la forme "ICE: <15 chiffres>"
# pres de l'en-tete d'une des deux parties (fournisseur ou client - parfois
# les deux sur la meme facture). On exclut l'ICE de sa propre societe (si
# connu, voir Parametres > Societe) pour ne jamais le prendre par erreur
# pour celui du fournisseur.
ICE_LABEL_RE = re.compile(r"\bice\b\s*[:\-]?\s*([0-9][0-9\s]{13,20}[0-9])", re.IGNORECASE)


def _ice_near_equal(a, b):
    """Vrai si deux ICE (chaines de 15 chiffres) ne different que par au plus
    UN caractere insere/supprime/substitue (distance de Levenshtein <= 1) -
    tolere un seul chiffre mal lu par l'OCR. Inspire d'un outil externe
    d'extraction de factures fournisseurs partage par l'utilisateur, utilise
    la meme tolerance pour decider si un ICE detecte est en fait, a une
    erreur de lecture pres, l'ICE de la propre societe (et doit donc etre
    ecarte) plutot qu'un ICE different (celui du fournisseur)."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    # Substitution (meme longueur) : au plus 1 position differente.
    if la == lb:
        return sum(1 for x, y in zip(a, b) if x != y) <= 1
    # Insertion/suppression (longueurs differant de 1) : la plus courte doit
    # etre une sous-sequence obtenue en retirant exactement 1 caractere de
    # la plus longue.
    longue, courte = (a, b) if la > lb else (b, a)
    i = j = 0
    skipped = False
    while i < len(longue) and j < len(courte):
        if longue[i] == courte[j]:
            i += 1
            j += 1
        elif not skipped:
            skipped = True
            i += 1
        else:
            return False
    return True


def _guess_ice(lines, exclude_ice=None):
    """Devine l'ICE du fournisseur (aide a la saisie, a verifier comme le
    reste) : premiere occurrence a 15 chiffres d'un libelle "ICE" dans le
    document, en ecartant l'ICE de sa propre societe si on le connait (match
    exact, ou a 1 chiffre pres pour tolerer une erreur de lecture OCR)."""
    exclude_norm = set(re.sub(r"\D", "", e) for e in (exclude_ice or []) if e)
    for raw_line in lines:
        for m in ICE_LABEL_RE.finditer(raw_line):
            digits = re.sub(r"\s", "", m.group(1))
            if len(digits) != 15:
                continue
            if any(_ice_near_equal(digits, exc) for exc in exclude_norm):
                continue
            return digits
    return ""


def guess_fields(text, filename, exclude_fournisseur_names=None, exclude_ice=None, text_ordonne=None):
    """`text_ordonne`, quand fourni (voir split_invoices), est utilise de
    preference a `text` par les deux SEULES heuristiques qui supposent un
    ordre de lecture fiable de haut en bas (nom du fournisseur en en-tete,
    numero de facture pres du titre) : `text` lui-meme (3 passes OCR
    concatenees, voir _ocr_passes) n'a pas cette garantie. Toutes les autres
    heuristiques (montants, devise, ICE - recherche par mot-cle, l'ordre des
    lignes n'important pas) continuent d'utiliser `text`/`lines`, qui couvre
    une surface de recherche plus large."""
    lines = [l for l in text.split("\n") if l.strip()]
    lines_ord = [l for l in (text_ordonne or text).split("\n") if l.strip()] or lines
    date = _guess_date(lines, text)
    numero = _guess_numero(lines_ord, filename)
    ht, tva, ttc = _guess_montants(text, lines)
    devise = _guess_devise(text)
    fournisseur = _guess_fournisseur(lines_ord, exclude_fournisseur_names)
    ice = _guess_ice(lines, exclude_ice)
    return {
        "numero": numero,
        "date": date,
        "montantHT": ht,
        "montantTVA": tva,
        "montantTTC": ttc,
        "devise": devise,
        "fournisseur": fournisseur,
        "ice": ice,
    }


def _guess_numero_and_ttc(text):
    lines = [l for l in text.split("\n") if l.strip()]
    numero = _guess_numero_from_content(lines)
    _, _, ttc = _guess_montants(text, lines)
    return numero, ttc


def _page_is_own_invoice_start(numero, ttc, current_numero):
    """Une page "demarre sa propre facture" si elle porte A LA FOIS son
    propre numero de facture ET ses propres totaux (montant final detecte),
    ET que ce numero differe du numero de la facture en cours.

    Les deux premieres conditions evitent de decouper a tort une facture
    dont les articles debordent simplement sur la page suivante (qui peut
    tres bien porter un numero de page ou une reference sans etre une AUTRE
    facture). La 3e condition est necessaire car une page de suite d'une
    facture multi-pages REPETE generalement le MEME numero de facture (dans
    son en-tete ou son recapitulatif) tout en affichant aussi un total
    (souvent le meme montant final, rappele en pied de page) : sans cette
    comparaison, une telle page de suite serait prise a tort pour le debut
    d'une nouvelle facture (bug observe sur des factures Microsoft
    multi-pages, dont la 2e page affiche "Numéro de facture fiscale
    <meme numero qu'en page 1>" et rappelle le montant total)."""
    if not numero or ttc is None:
        return False
    if current_numero and numero == current_numero:
        return False
    return True


def group_pages_into_invoices(pages_texts):
    """Regroupe les pages d'un PDF en une ou plusieurs factures distinctes.

    `pages_texts` : liste de textes de page (dans l'ordre du document).
    Renvoie une liste de groupes, chaque groupe etant la liste des INDEX de
    page qui composent une meme facture, dans l'ordre. Une page demarre un
    nouveau groupe uniquement si _page_is_own_invoice_start() la reconnait
    comme le debut d'une facture a part entiere (son propre numero, DIFFERENT
    de celui de la facture en cours, ET ses propres totaux) ; sinon elle est
    rattachee a la facture precedente - c'est le cas normal d'une facture
    dont la liste d'articles s'etale sur plusieurs pages, les totaux
    n'apparaissant que sur la derniere (ou etant simplement repetes).

    Cas particulier important : si une SEULE page (la 1ere) est jamais
    reconnue comme "debut de facture" (le cas le plus frequent, une facture
    normale d'une ou plusieurs pages), tout le document forme un seul
    groupe - comportement strictement identique a avant l'introduction du
    decoupage multi-factures."""
    if not pages_texts:
        return []
    infos = [_guess_numero_and_ttc(t) for t in pages_texts]
    groups = [[0]]
    current_numero = infos[0][0]
    for i in range(1, len(pages_texts)):
        numero, ttc = infos[i]
        if _page_is_own_invoice_start(numero, ttc, current_numero):
            groups.append([i])
            current_numero = numero
        else:
            groups[-1].append(i)
    return groups


def split_invoices(filename, file_bytes):
    """Point d'entree pour l'import : decoupe un fichier en une ou plusieurs
    factures distinctes (cas d'un PDF regroupant plusieurs factures, ex. un
    recapitulatif mensuel d'un fournisseur - une facture complete et
    autonome par page). Renvoie (invoices, ocr_disponible) ou `invoices` est
    une liste de dicts {"pageIndices": [...], "text": <texte concatene des
    pages du groupe>, "textOrdonne": <idem, en ordre de lecture fiable - voir
    extract_pages>, "ocrUtilise": bool, "nbPages": int}, toujours au moins
    un element (meme pour une image ou un PDF a une seule facture)."""
    pages, ocr_dispo = extract_pages(filename, file_bytes)
    pages_texts = [p[0] for p in pages]
    pages_textes_ordonnes = [p[2] for p in pages]
    groups = group_pages_into_invoices(pages_texts)
    invoices = []
    for group in groups:
        invoices.append({
            "pageIndices": group,
            "text": "\n".join(pages_texts[i] for i in group),
            "textOrdonne": "\n".join(pages_textes_ordonnes[i] for i in group),
            "ocrUtilise": any(pages[i][1] for i in group),
            "nbPages": len(group),
        })
    return invoices, ocr_dispo


# =============================================================
# Modele de zones par fournisseur ("apprentissage" de mise en page) :
# plutot que de deviner les champs par mots-cles, l'utilisateur peut, pour
# un fournisseur dont la facture est mal reconnue, dessiner sur une facture
# d'exemple les zones ou se trouvent numero/date/montants/ICE. Ce modele
# (une fois enregistre sur la fiche du fournisseur) est ensuite applique
# automatiquement a toute nouvelle facture reconnue comme venant de ce
# meme fournisseur, en repli sur la devinette generique pour tout champ
# que la zone ne donnerait pas. Limite a la version actuelle aux PDF a
# texte natif (pas de support OCR par zone) : les coordonnees sont des
# fractions 0..1 de la largeur/hauteur de PAGE (pas des pixels d'une image
# de rendu particuliere), pour rester valables quelle que soit la
# resolution utilisee pour les dessiner ou pour les relire.
# =============================================================

ZONE_CHAMPS = ("numero", "date", "montantHT", "montantTVA", "montantTTC", "devise", "ice")


def render_page_png(file_bytes, page_index, resolution=150):
    """Rend une page d'un PDF en image PNG (pour l'editeur de zones de
    lecture). Leve une exception si le fichier n'est pas un PDF valide ou
    si la page demandee n'existe pas."""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        if page_index < 0 or page_index >= len(pdf.pages):
            raise ValueError("page invalide")
        img = pdf.pages[page_index].to_image(resolution=resolution).original
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def extract_fields_from_zones(file_bytes, page_index, zones):
    """Extrait le texte brut contenu dans chaque zone (liste de dicts
    {"champ":..., "x0":frac,"y0":frac,"x1":frac,"y1":frac}, fractions 0..1
    de la page) sur la page `page_index` d'un PDF a texte natif. Renvoie un
    dict {champ: texte_brut_ou_chaine_vide} ; ne leve pas d'exception (une
    zone illisible ou un fichier non-PDF renvoie simplement un dict vide ou
    incomplet, pour que l'appelant puisse se replier sur la devinette
    generique sans jamais faire echouer tout l'import)."""
    out = {}
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if page_index < 0 or page_index >= len(pdf.pages):
                return out
            page = pdf.pages[page_index]
            w, h = page.width, page.height
            for z in zones or []:
                champ = z.get("champ")
                if champ not in ZONE_CHAMPS:
                    continue
                try:
                    x0 = max(0.0, min(1.0, float(z["x0"]))) * w
                    y0 = max(0.0, min(1.0, float(z["y0"]))) * h
                    x1 = max(0.0, min(1.0, float(z["x1"]))) * w
                    y1 = max(0.0, min(1.0, float(z["y1"]))) * h
                    if x1 <= x0 or y1 <= y0:
                        continue
                    out[champ] = (page.crop((x0, y0, x1, y1)).extract_text() or "").strip()
                except Exception:
                    continue
    except Exception:
        return {}
    return out


_ZONE_NUMERO_LABEL_STRIP_RE = re.compile(
    r"^(?:facture|invoice)\s*(?:number|num[ée]ro|n[°o]?\.?)?\s*[:#]?\s*",
    re.IGNORECASE,
)


def _parse_zone_value(champ, raw_text):
    """Interprete le texte brut d'une zone selon le type du champ vise
    (montant, date, ICE...). Renvoie None si rien d'exploitable n'en
    ressort, pour que l'appelant conserve alors la devinette generique
    deja calculee plutot que d'ecraser une valeur correcte par du vide."""
    raw_text = (raw_text or "").strip()
    if not raw_text:
        return None
    if champ in ("montantHT", "montantTVA", "montantTTC"):
        m = AMOUNT_RE.search(raw_text)
        return _parse_amount(m.group(0)) if m else None
    if champ == "date":
        return _extract_any_date(raw_text) or None
    if champ == "devise":
        return _guess_devise(raw_text) or None
    if champ == "ice":
        digits = re.sub(r"\D", "", raw_text)
        return digits if len(digits) == 15 else None
    if champ == "numero":
        # Tolere une zone dessinee un peu large englobant le libelle
        # ("Facture IN2603-0032" au lieu de juste "IN2603-0032") : on
        # retire ce prefixe habituel s'il est present, plutot que d'exiger
        # un cadrage pixel-parfait de la part de l'utilisateur.
        cleaned = _ZONE_NUMERO_LABEL_STRIP_RE.sub("", raw_text, count=1).strip()
        return cleaned or raw_text or None
    return raw_text or None


def apply_zone_template(file_bytes, page_index, modele, guess):
    """Affine en place le dict `guess` (renvoye par guess_fields) a l'aide
    d'un modele de zones ({"zones": [...]}, voir ci-dessus) defini pour le
    fournisseur reconnu sur cette facture. Un champ n'est ecrase que si sa
    zone donne une valeur exploitable - toute zone vide/illisible laisse la
    devinette generique deja en place (repli), comme demande."""
    zones = (modele or {}).get("zones") or []
    if not zones:
        return guess
    raw = extract_fields_from_zones(file_bytes, page_index, zones)
    for champ, txt in raw.items():
        val = _parse_zone_value(champ, txt)
        if val is not None and val != "":
            guess[champ] = val
    return guess
