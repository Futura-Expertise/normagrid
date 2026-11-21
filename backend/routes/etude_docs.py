# -*- coding: utf-8 -*-
"""V3.36 — Fiches techniques des déclencheurs (documents joints au catalogue du matériel).

Les fichiers (PDF, images) sont de vrais fichiers sur le disque, dans data/etude_materiel_docs/ ; la collection
etudeMatDocs (table etude_mat_docs) ne garde que leurs métadonnées (constructeur, déclencheur ou famille, type, titre, nom de fichier).
  POST /api/etude-elec/docs/upload  (multipart, champ « file ») -> {fichier, nom, taille, mime}
  GET  /api/etude-elec/docs/file/<fichier>[?name=...&dl=1]       -> le fichier (aperçu dans le navigateur, ou téléchargement avec dl=1)
Droits : section « etude_elec » (lecture pour GET, complet pour l'envoi), voir backend/access.py."""

import os
import re
import unicodedata
import uuid

from flask import Blueprint, jsonify, request, send_file

etude_docs = Blueprint("etude_docs", __name__, url_prefix="/api/etude-elec/docs")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DOCS_DIR = os.path.join(BASE_DIR, "data", "etude_materiel_docs")


def docs_dir():
    """V3.43 : répertoire des fiches techniques — par défaut data/etude_materiel_docs/, ou celui choisi dans
    Paramètres (champ « fichesTechniquesDir » de la fiche settings/company). Relu à chaque appel."""
    try:
        from backend import db as dbmod, store
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        custom = ((row or {}).get("fichesTechniquesDir") or "").strip()
        if custom:
            return custom
    except Exception:
        pass
    return DEFAULT_DOCS_DIR
ALLOWED_EXT = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "webp": "image/webp"}
MAX_OCTETS = 60 * 1024 * 1024


def _nettoie(nom):
    s = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s).strip("._")
    return s[:80] or "document"


@etude_docs.post("/upload")
def upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    nom = os.path.basename(f.filename)
    ext = nom.rsplit(".", 1)[-1].lower() if "." in nom else ""
    if ext not in ALLOWED_EXT:
        return jsonify({"error": "Type de fichier non autorisé (pdf, png, jpg, svg, webp attendus)"}), 400
    os.makedirs(docs_dir(), exist_ok=True)
    stem = _nettoie(nom.rsplit(".", 1)[0])
    fichier = "%s_%s.%s" % (uuid.uuid4().hex[:10], stem, ext)
    cible = os.path.join(docs_dir(), fichier)
    f.save(cible)
    taille = os.path.getsize(cible)
    if taille > MAX_OCTETS:
        os.remove(cible)
        return jsonify({"error": "Fichier trop volumineux (60 Mo maximum)"}), 400
    return jsonify({"fichier": fichier, "nom": nom, "taille": taille, "mime": ALLOWED_EXT[ext]})


@etude_docs.get("/file/<path:fichier>")
def lire(fichier):
    if fichier != os.path.basename(fichier):
        return jsonify({"error": "Chemin invalide"}), 400
    cible = os.path.join(docs_dir(), fichier)
    if not os.path.isfile(cible):
        return jsonify({"error": "Fichier introuvable"}), 404
    ext = fichier.rsplit(".", 1)[-1].lower()
    tel = request.args.get("dl") == "1"
    rep = send_file(cible, mimetype=ALLOWED_EXT.get(ext), as_attachment=tel, download_name=(request.args.get("name") or fichier))
    rep.headers["X-Content-Type-Options"] = "nosniff"
    if ext == "svg":
        rep.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'"
    return rep


@etude_docs.delete("/file/<path:fichier>")
def supprimer(fichier):
    """Supprime le fichier du disque (la fiche en base est supprimée par l'écran, via /api/doc)."""
    if fichier != os.path.basename(fichier):
        return jsonify({"error": "Chemin invalide"}), 400
    cible = os.path.join(docs_dir(), fichier)
    if os.path.isfile(cible):
        os.remove(cible)
    return jsonify({"ok": True})


@etude_docs.post("/unzip")
def depouiller_zip():
    """V3.37 : import en masse — reçoit un .zip, en extrait les fichiers autorisés (pdf, images) dans le dossier des fiches
    et renvoie la liste {fichier, nom, taille, mime}. Chemins internes ignorés (seul le nom de base est gardé)."""
    import zipfile
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    os.makedirs(docs_dir(), exist_ok=True)
    sortie, total = [], 0
    try:
        z = zipfile.ZipFile(f.stream)
    except zipfile.BadZipFile:
        return jsonify({"error": "Archive ZIP illisible"}), 400
    for info in z.infolist():
        if info.is_dir():
            continue
        nom = os.path.basename(info.filename.replace("\\", "/"))
        ext = nom.rsplit(".", 1)[-1].lower() if "." in nom else ""
        if not nom or nom.startswith(".") or ext not in ALLOWED_EXT or info.file_size > MAX_OCTETS:
            continue
        total += info.file_size
        if len(sortie) >= 400 or total > 600 * 1024 * 1024:
            break
        fichier = "%s_%s.%s" % (uuid.uuid4().hex[:10], _nettoie(nom.rsplit(".", 1)[0]), ext)
        with z.open(info) as src, open(os.path.join(docs_dir(), fichier), "wb") as dst:
            while True:
                bloc = src.read(1024 * 1024)
                if not bloc:
                    break
                dst.write(bloc)
        sortie.append({"fichier": fichier, "nom": nom, "taille": os.path.getsize(os.path.join(docs_dir(), fichier)), "mime": ALLOWED_EXT[ext]})
    return jsonify({"fichiers": sortie})


# ----------------------------------------------------------------------------------------------------------------------
# V3.38 — téléchargement d'une fiche à partir d'un lien (le serveur récupère le fichier et le range comme un envoi manuel).
# Garde-fous : http / https seulement ; domaines autorisés uniquement (constructeurs ci-dessous + data/etude_docs_domaines.txt,
# un domaine par ligne) ; adresses internes refusées (réseau local, boucle locale) à chaque redirection ; 60 Mo, 60 s maximum ;
# le contenu doit être réellement un PDF ou une image (une page web — conditions à accepter, connexion — est refusée).
# ----------------------------------------------------------------------------------------------------------------------
import ipaddress
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

DOMAINES_PAR_DEFAUT = [
    # Schneider Electric
    "se.com", "schneider-electric.com", "schneider-electric.fr",
    # Siemens
    "siemens.com", "siemens-info.com",
]
DELAI_S = 60
FICHIER_DOMAINES = os.path.join(BASE_DIR, "data", "etude_docs_domaines.txt")


def domaines_autorises():
    liste = list(DOMAINES_PAR_DEFAUT)
    try:
        with open(FICHIER_DOMAINES, encoding="utf-8") as f:
            for l in f:
                l = l.split("#")[0].strip().lower()
                if l and l not in liste:
                    liste.append(l)
    except OSError:
        pass
    return liste


def _hote_autorise(hote):
    hote = (hote or "").lower().rstrip(".")
    return any(hote == d or hote.endswith("." + d) for d in domaines_autorises())


def _ip_publique(hote):
    """Vrai si toutes les adresses de l'hôte sont publiques (refuse réseau local, boucle locale, lien-local, réservées)."""
    try:
        infos = socket.getaddrinfo(hote, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return bool(infos)


def _verifie_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ValueError("Le lien doit commencer par http:// ou https://")
    if not _hote_autorise(p.hostname):
        raise ValueError("Domaine non autorisé : %s (domaines autorisés : %s ; d'autres peuvent être ajoutés dans data/etude_docs_domaines.txt)" % (p.hostname, ", ".join(domaines_autorises())))
    if not _ip_publique(p.hostname):
        raise ValueError("Adresse refusée (réseau interne)")
    return p


class _Redirection(urllib.request.HTTPRedirectHandler):
    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _verifie_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _nom_depuis(entetes, url):
    cd = entetes.get("Content-Disposition") or ""
    m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?", cd, re.I)
    nom = urllib.parse.unquote(m.group(1)) if m else urllib.parse.unquote(os.path.basename(urllib.parse.urlparse(url).path))
    return os.path.basename(nom) or "document"


def _type_reel(debut):
    """Détecte le vrai type d'après les premiers octets : retourne l'extension ou None."""
    if debut.startswith(b"%PDF"):
        return "pdf"
    if debut.startswith(b"\x89PNG"):
        return "png"
    if debut[:3] == b"\xff\xd8\xff":
        return "jpg"
    if debut[:4] == b"RIFF" and debut[8:12] == b"WEBP":
        return "webp"
    return None


@etude_docs.get("/domaines")
def liste_domaines():
    return jsonify({"domaines": domaines_autorises()})


# Anciens noms d'hôtes qui renvoient parfois 404 alors que le document existe sur le nouvel hôte du même constructeur.
HOTES_DE_REPLI = {"productinfo.schneider-electric.com": "productinfo.se.com", "productinfo.schneider-electric.fr": "productinfo.se.com"}


def _variantes(url):
    """Adresse demandée puis variantes plausibles du même document : avec / sans « www. », ancien -> nouvel hôte (voir HOTES_DE_REPLI)."""
    p = urllib.parse.urlparse(url)
    hote = (p.hostname or "").lower()
    port = (":%d" % p.port) if p.port else ""
    hotes = []
    sans = hote[4:] if hote.startswith("www.") else hote
    for h in (("www." + sans) if not hote.startswith("www.") else sans, HOTES_DE_REPLI.get(sans), ("www." + HOTES_DE_REPLI[sans]) if sans in HOTES_DE_REPLI else None):
        if h and h != hote and h not in hotes:
            hotes.append(h)
    return [url] + [urllib.parse.urlunparse(p._replace(netloc=h + port)) for h in hotes]


@etude_docs.post("/fetch")
def telecharger():
    donnees = request.get_json(silent=True) or {}
    url = (donnees.get("url") or "").strip()
    reponse = telecharger_un(url)
    if reponse[1] == 400 and "erreur HTTP 404" in (reponse[0].get_json() or {}).get("error", ""):
        essais = [url]
        for autre in _variantes(url)[1:]:
            try:
                _verifie_url(autre)
            except ValueError:
                continue
            essais.append(autre)
            essai = telecharger_un(autre)
            if essai[1] == 200:
                return essai
        return jsonify({"error": "Le site a répondu : erreur HTTP 404 (adresses essayées : %s). Le document a peut-être changé d'adresse : ouvrez-le dans votre navigateur, téléchargez-le puis déposez-le dans « Importer en masse »." % " ; ".join(essais)}), 400
    return reponse


def telecharger_un(url):
    try:
        _verifie_url(url)
    except ValueError as e:
        return (jsonify({"error": str(e)}), 400)
    os.makedirs(docs_dir(), exist_ok=True)
    tmp = os.path.join(docs_dir(), ".tmp_%s" % uuid.uuid4().hex)
    ouvreur = urllib.request.build_opener(_Redirection())
    origine = "%s://%s/" % (urllib.parse.urlparse(url).scheme, urllib.parse.urlparse(url).netloc)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/pdf,application/octet-stream;q=0.9,image/*;q=0.8,*/*;q=0.5", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8", "Referer": origine})
    debut_t, taille = time.time(), 0
    try:
        with ouvreur.open(req, timeout=DELAI_S) as rep, open(tmp, "wb") as out:
            entetes, url_finale = rep.headers, rep.geturl()
            premier = b""
            while True:
                bloc = rep.read(256 * 1024)
                if not bloc:
                    break
                if not premier:
                    premier = bloc[:16]
                    if _type_reel(premier) is None:
                        raise ValueError("Le lien ne mène pas à un fichier PDF ou image (page web, conditions à accepter ou connexion requise). Téléchargez le fichier à la main puis ajoutez-le.")
                taille += len(bloc)
                if taille > MAX_OCTETS:
                    raise ValueError("Fichier trop volumineux (60 Mo maximum)")
                if time.time() - debut_t > DELAI_S * 2:
                    raise ValueError("Téléchargement trop long")
                out.write(bloc)
    except ValueError as e:
        _efface(tmp)
        return (jsonify({"error": str(e)}), 400)
    except urllib.error.HTTPError as e:
        _efface(tmp)
        return (jsonify({"error": "Le site a répondu : erreur HTTP %s" % e.code}), 400)
    except (urllib.error.URLError, OSError) as e:
        _efface(tmp)
        return (jsonify({"error": "Téléchargement impossible : %s" % (getattr(e, "reason", None) or e)}), 400)
    if taille == 0:
        _efface(tmp)
        return (jsonify({"error": "Fichier vide"}), 400)
    ext = _type_reel(premier)
    nom = _nom_depuis(entetes, url_finale)
    if "." not in nom or nom.rsplit(".", 1)[-1].lower() not in ALLOWED_EXT:
        nom = nom.rsplit(".", 1)[0] + "." + ext if "." in nom else nom + "." + ext
    fichier = "%s_%s.%s" % (uuid.uuid4().hex[:10], _nettoie(nom.rsplit(".", 1)[0]), ext)
    os.replace(tmp, os.path.join(docs_dir(), fichier))
    return (jsonify({"fichier": fichier, "nom": nom, "taille": taille, "mime": ALLOWED_EXT[ext], "source": url}), 200)


def _efface(chemin):
    try:
        os.remove(chemin)
    except OSError:
        pass


# ----------------------------------------------------------------------------------------------------------------------
# V3.43 — répertoire des fiches (réglable dans Paramètres), découpage d'un PDF page par page, renommage selon la nomenclature
#   Constructeur_Categorie_Gamme_DonneesSpecifiques.pdf  (ASCII, sans espace ni accent)
#   GET  /dir                -> {dir, defaut, personnalise}
#   POST /dir {dir}          -> change le répertoire (valide l'écriture, déplace/fusionne les fichiers déjà présents)
#   POST /pages/analyse      -> multipart « file » ou JSON {fichier} : lit chaque page (type, gamme, courbes, calibres, norme)
#                               et prépare les pages dans un dossier temporaire ; renvoie {jeton, pages:[…]}
#   POST /existe {noms}      -> liste des noms déjà présents dans le répertoire
#   POST /pages/enregistrer  -> {jeton, pages:[{page, nom}], origine:{nom}|null, remplacer:[noms]} : écrit les pages choisies
#   POST /renommer {fichier, nouveau, remplacer} -> renomme un fichier du répertoire
# ----------------------------------------------------------------------------------------------------------------------
import shutil

NOM_VALIDE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+-]{0,150}\.(pdf|png|jpg|jpeg|svg|webp)$")


def _tmp_split():
    return os.path.join(docs_dir(), ".tmp_split")


def _purge_tmp():
    """Supprime les dossiers temporaires de plus d'une heure."""
    base = _tmp_split()
    if not os.path.isdir(base):
        return
    for n in os.listdir(base):
        c = os.path.join(base, n)
        try:
            if time.time() - os.path.getmtime(c) > 3600:
                shutil.rmtree(c, ignore_errors=True)
        except OSError:
            pass


@etude_docs.get("/dir")
def lire_dir():
    d = docs_dir()
    return jsonify({"dir": d, "defaut": DEFAULT_DOCS_DIR, "personnalise": os.path.abspath(d) != os.path.abspath(DEFAULT_DOCS_DIR)})


@etude_docs.post("/dir")
def changer_dir():
    from backend import db as dbmod, store
    from backend.routes.commande_client import _merge_move_dir
    body = request.get_json(force=True, silent=True) or {}
    brut = (body.get("dir") or "").strip()
    nouveau = os.path.abspath(brut) if brut else DEFAULT_DOCS_DIR
    try:
        os.makedirs(nouveau, exist_ok=True)
        test = os.path.join(nouveau, ".ecriture_test.tmp")
        with open(test, "w") as f:
            f.write("test")
        os.remove(test)
    except Exception as e:
        return jsonify({"error": "Répertoire inaccessible en écriture : " + str(e)}), 400
    ancien = docs_dir()
    if os.path.isdir(ancien) and os.path.realpath(ancien) != os.path.realpath(nouveau):
        try:
            _merge_move_dir(ancien, nouveau)
            if os.path.abspath(ancien) != os.path.abspath(DEFAULT_DOCS_DIR):
                try:
                    os.rmdir(ancien)
                except OSError:
                    pass
        except Exception as e:
            return jsonify({"error": "Déplacement des fichiers déjà enregistrés impossible : " + str(e)}), 400
    conn = dbmod.get_connection()
    row = store.get_doc(conn, "settings", "company")
    data = dict(row) if row else {}
    data["fichesTechniquesDir"] = "" if (nouveau == DEFAULT_DOCS_DIR and not brut) else nouveau
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()
    return jsonify({"dir": data["fichesTechniquesDir"] or DEFAULT_DOCS_DIR})


def _lit_page(texte):
    """Titre d'une page Acti9 : ligne 1 = type de courant, ligne 2 = gamme, ligne 3 = « courbes · calibres | norme · température »."""
    lignes = [l.strip() for l in (texte or "").split("\n") if l.strip()]
    r = {"type": "", "gamme": "", "courbes": [], "calMin": None, "calMax": None, "norme": "", "temp": None, "magnetique": False, "version": "", "titre": " | ".join(lignes[:3])}
    if not lignes:
        return r
    t = lignes[0].upper()
    r["type"] = "continu" if "CONTINU" in t else ("moteur" if "MOTEUR" in t else ("alternatif" if "ALTERNATIF" in t else ""))
    if len(lignes) > 1:
        r["gamme"] = lignes[1]
    if len(lignes) > 2:
        gauche, _, droite = lignes[2].partition("|")
        m = re.match(r"^(?:Courbes?\s+)?((?:MA|[A-Z])(?:\s*,\s*(?:MA|[A-Z]))*)\b", gauche.strip())
        if m:
            r["courbes"] = [c.strip() for c in m.group(1).split(",")]
        m = re.search(r"jusqu\S*\s*à\s*(\d+(?:[.,]\d+)?)\s*A", gauche)
        if m:
            r["calMin"], r["calMax"] = 0, float(m.group(1).replace(",", "."))
        else:
            m = re.search(r"(\d+(?:[.,]\d+)?)\s*à\s*(\d+(?:[.,]\d+)?)\s*A", gauche)
            if m:
                r["calMin"], r["calMax"] = float(m.group(1).replace(",", ".")), float(m.group(2).replace(",", "."))
        r["magnetique"] = "magn" in lignes[2].lower()
        m = re.search(r"(?:IEC/EN|CEI|EN|IEC)\s*(\d{5}(?:-\d+)*)", droite or gauche)
        if m:
            r["norme"] = m.group(1)
        m = re.search(r"(\d+)\s*°C", droite)
        if m:
            r["temp"] = int(m.group(1))
    for l in lignes:
        m = re.search(r"Version\s*:\s*([\d.]+)", l)
        if m:
            r["version"] = m.group(1)
            break
    return r


@etude_docs.post("/pages/analyse")
def analyser_pages():
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return jsonify({"error": "Le module pypdf n'est pas installé sur le serveur."}), 500
    _purge_tmp()
    jeton = uuid.uuid4().hex[:16]
    dossier = os.path.join(_tmp_split(), jeton)
    os.makedirs(dossier, exist_ok=True)
    source = os.path.join(dossier, "source.pdf")
    f = request.files.get("file")
    if f and f.filename:
        nom = os.path.basename(f.filename)
        f.save(source)
    else:
        body = request.get_json(force=True, silent=True) or {}
        nom = os.path.basename(body.get("fichier") or "")
        src = os.path.join(docs_dir(), nom)
        if not nom or not os.path.isfile(src):
            shutil.rmtree(dossier, ignore_errors=True)
            return jsonify({"error": "Fichier introuvable"}), 404
        shutil.copyfile(src, source)
    if os.path.getsize(source) > MAX_OCTETS:
        shutil.rmtree(dossier, ignore_errors=True)
        return jsonify({"error": "Fichier trop volumineux (60 Mo maximum)"}), 400
    try:
        lecteur = PdfReader(source)
        n = len(lecteur.pages)
    except Exception:
        shutil.rmtree(dossier, ignore_errors=True)
        return jsonify({"error": "PDF illisible : " + nom}), 400
    if n > 400:
        shutil.rmtree(dossier, ignore_errors=True)
        return jsonify({"error": "Trop de pages (400 maximum)"}), 400
    pages = []
    for i, pg in enumerate(lecteur.pages):
        try:
            texte = pg.extract_text() or ""
        except Exception:
            texte = ""
        info = _lit_page(texte)
        info["page"] = i + 1
        w = PdfWriter()
        w.add_page(pg)
        with open(os.path.join(dossier, "p%d.pdf" % (i + 1)), "wb") as out:
            w.write(out)
        pages.append(info)
    return jsonify({"jeton": jeton, "nom": nom, "nbPages": n, "pages": pages})


@etude_docs.post("/existe")
def noms_existants():
    body = request.get_json(force=True, silent=True) or {}
    d = docs_dir()
    return jsonify({"existants": [n for n in (body.get("noms") or []) if isinstance(n, str) and n == os.path.basename(n) and os.path.isfile(os.path.join(d, n))]})


@etude_docs.post("/pages/enregistrer")
def enregistrer_pages():
    body = request.get_json(force=True, silent=True) or {}
    jeton = re.sub(r"[^0-9a-f]", "", str(body.get("jeton") or ""))
    dossier = os.path.join(_tmp_split(), jeton)
    if not jeton or not os.path.isdir(dossier):
        return jsonify({"error": "Analyse expirée : relancez l'analyse du fichier."}), 400
    remplacer = set(body.get("remplacer") or [])
    d = docs_dir()
    os.makedirs(d, exist_ok=True)
    sortie, refus = [], []
    elements = [{"page": p.get("page"), "nom": p.get("nom")} for p in (body.get("pages") or [])]
    org = body.get("origine")
    if isinstance(org, dict) and org.get("nom"):
        elements.append({"page": 0, "nom": org["nom"]})
    for e in elements:
        nom = str(e.get("nom") or "")
        if not NOM_VALIDE.match(nom) or nom.startswith("."):
            refus.append({"nom": nom, "raison": "nom invalide"})
            continue
        src = os.path.join(dossier, "source.pdf" if e["page"] == 0 else "p%d.pdf" % int(e["page"]))
        if not os.path.isfile(src):
            refus.append({"nom": nom, "raison": "page introuvable"})
            continue
        cible = os.path.join(d, nom)
        if os.path.isfile(cible) and nom not in remplacer:
            refus.append({"nom": nom, "raison": "existe déjà"})
            continue
        shutil.copyfile(src, cible)
        sortie.append({"page": e["page"], "nom": nom, "taille": os.path.getsize(cible)})
    shutil.rmtree(dossier, ignore_errors=True)
    return jsonify({"enregistres": sortie, "refuses": refus})


@etude_docs.post("/renommer")
def renommer():
    body = request.get_json(force=True, silent=True) or {}
    ancien, nouveau = str(body.get("fichier") or ""), str(body.get("nouveau") or "")
    d = docs_dir()
    if ancien != os.path.basename(ancien) or not NOM_VALIDE.match(nouveau):
        return jsonify({"error": "Nom invalide"}), 400
    a, n = os.path.join(d, ancien), os.path.join(d, nouveau)
    if not os.path.isfile(a):
        return jsonify({"error": "Fichier introuvable"}), 404
    if ancien == nouveau:
        return jsonify({"fichier": nouveau})
    if os.path.isfile(n) and not body.get("remplacer"):
        return jsonify({"error": "Un fichier porte déjà ce nom"}), 409
    os.replace(a, n)
    return jsonify({"fichier": nouveau, "taille": os.path.getsize(n)})


# ----------------------------------------------------------------------------------------------------------------------
# V3.45 — image d'une page de PDF (numérisation des courbes de déclenchement : l'écran affiche la page et relève les points)
#   GET /page-image/<fichier>?page=1&scale=2.5  -> PNG
# Moteur : pypdfium2 (pip) ; à défaut, pdftoppm (poppler) s'il est installé.
# ----------------------------------------------------------------------------------------------------------------------
@etude_docs.get("/page-image/<path:fichier>")
def image_page(fichier):
    import io
    import subprocess
    if fichier != os.path.basename(fichier) or not fichier.lower().endswith(".pdf"):
        return jsonify({"error": "Fichier PDF attendu"}), 400
    cible = os.path.join(docs_dir(), fichier)
    if not os.path.isfile(cible):
        return jsonify({"error": "Fichier introuvable"}), 404
    try:
        page = max(1, int(request.args.get("page", "1")))
        scale = min(5.0, max(0.8, float(request.args.get("scale", "2.5"))))
    except ValueError:
        return jsonify({"error": "Paramètres invalides"}), 400
    png = None
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(cible)
        if page > len(pdf):
            return jsonify({"error": "Page inexistante (%d pages)" % len(pdf)}), 400
        buf = io.BytesIO()
        pdf[page - 1].render(scale=scale).to_pil().save(buf, format="PNG")
        png = buf.getvalue()
    except ImportError:
        try:
            out = subprocess.run(["pdftoppm", "-r", str(int(72 * scale)), "-f", str(page), "-l", str(page), "-png", "-singlefile", cible, "-"], capture_output=True, timeout=60)
            if out.returncode == 0 and out.stdout:
                png = out.stdout
        except (OSError, subprocess.SubprocessError):
            png = None
    except Exception as e:
        return jsonify({"error": "Page illisible : " + str(e)}), 400
    if not png:
        return jsonify({"error": "Aucun moteur d'affichage PDF disponible : installez pypdfium2 (pip install pypdfium2) puis relancez l'application."}), 501
    rep = send_file(io.BytesIO(png), mimetype="image/png")
    rep.headers["Cache-Control"] = "private, max-age=300"
    return rep
