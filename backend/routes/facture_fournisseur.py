"""
Routes du module "Factures fournisseurs" : import direct d'un ou plusieurs
fichiers (PDF/scans/photos) dans leur forme d'origine (plus d'etape de
compression en .zip), reconnaissance assistee (backend.facture_parser),
classement/renommage automatique des fichiers d'origine a l'enregistrement,
et mise a disposition de ces fichiers pour consultation ulterieure.

Stockage des fichiers : contrairement aux "documents" generiques (table SQL
unique), les fichiers originaux des factures sont conserves sur disque, sous
deux zones distinctes de data/factures_fournisseurs/ :

- data/factures_fournisseurs/_pending/<lot>/<fichier> : zone d'attente, le
  temps de l'ecran de relecture. Un "lot" (dossier horodate) est cree a
  chaque import ; si l'utilisateur annule l'import avant d'enregistrer, le
  lot est simplement supprime (aucune ecriture en base). Les fichiers geres
  mais non coches ("ne pas garder") a l'enregistrement restent aussi dans
  cette zone jusqu'au nettoyage du lot.
- data/factures_fournisseurs/<annee>/<mois>/<fichier renomme> : zone
  definitive. Un fichier y est deplace (et renomme selon le schema
  AAAA_MM_JJ_NomFournisseur_NumeroFacture.<ext>) uniquement au moment ou la
  ligne correspondante est reellement enregistree (POST /finalize-file),
  avec les valeurs finales (corrigees si besoin) de fournisseur/date/numero.
  Modifier ensuite une facture deja enregistree (fournisseur/date/numero)
  reappelle ce meme mecanisme, qui deplace/renomme le fichier en consequence
  si ces valeurs ont change entre-temps - le classement reste donc toujours
  coherent avec les donnees affichees.
"""

import datetime
import io
import json
import os
import re
import shutil
import unicodedata
import uuid

from flask import Blueprint, jsonify, request, send_file
from pypdf import PdfReader, PdfWriter

from backend import db as dbmod
from backend import store
from backend.facture_parser import split_invoices, guess_fields, render_page_png, apply_zone_template

facture_fournisseur = Blueprint("facture_fournisseur", __name__, url_prefix="/api/facture-fournisseur")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "data", "factures_fournisseurs")
os.makedirs(os.path.join(DEFAULT_STORAGE_DIR, "_pending"), exist_ok=True)

ALLOWED_EXT = ("pdf", "jpg", "jpeg", "png")


def get_storage_dir():
    """Repertoire racine de stockage des factures fournisseurs (fichiers
    d'origine et classement annee/mois) : par defaut data/factures_fournisseurs/
    sous l'installation de l'application, ou un repertoire choisi par
    l'utilisateur (Parametres > Stockage des factures fournisseurs, champ
    'facturesFournisseursDir' de la fiche settings/company) - typiquement un
    disque/partage reseau partage entre plusieurs postes. Relu a chaque appel
    (pas mis en cache) : un changement de reglage prend effet immediatement,
    sans necessiter de relancer l'application."""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            custom = (row.get("facturesFournisseursDir") or "").strip()
            if custom:
                return custom
    except Exception:
        pass
    return DEFAULT_STORAGE_DIR


def get_pending_dir():
    d = os.path.join(get_storage_dir(), "_pending")
    os.makedirs(d, exist_ok=True)
    return d


def get_source_dir():
    """Repertoire SOURCE ou l'utilisateur depose les factures fournisseurs
    'a traiter' (bouton Traitement, voir process_source_dir) - distinct du
    repertoire de STOCKAGE ci-dessus (classement apres validation, avec un
    repli par defaut sous l'installation). Ce repertoire source, lui, est
    vide par defaut : il doit etre explicitement configure (Parametres)
    avant de pouvoir utiliser le bouton Traitement, et n'est jamais ecrit
    par l'application entre deux traitements - seulement lu, puis purge
    fichier par fichier au fil des validations (voir delete_source_files)."""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            return (row.get("facturesFournisseursSourceDir") or "").strip()
    except Exception:
        pass
    return ""


def _dirs_overlap(a, b):
    """True si a et b designent le meme repertoire, ou si l'un est un
    sous-repertoire de l'autre. Utilise pour interdire que le dossier
    source "a traiter" chevauche le repertoire de STOCKAGE : depuis que
    process_source_dir parcourt aussi les sous-dossiers (V1.52), un
    chevauchement ferait retraiter indefiniment les fichiers deja classes
    par l'application ET, plus grave, supprimerait (delete_source_files)
    le fichier fraichement classe dans le Stockage des qu'il serait
    retrouve lors d'un traitement suivant - jamais une simple gene, un
    vrai risque de perte de donnees si l'utilisateur pointe les deux
    reglages vers (ou l'un dans) sa propre archive comptable."""
    if not a or not b:
        return False
    try:
        ra = os.path.realpath(a)
        rb = os.path.realpath(b)
    except Exception:
        return False
    return ra == rb or ra.startswith(rb + os.sep) or rb.startswith(ra + os.sep)


def _merge_move_dir(src_dir, dst_dir):
    """Deplace tout le contenu de src_dir dans dst_dir, en fusionnant les
    sous-dossiers de meme nom plutot que de les ecraser (utilise lorsqu'on
    change le repertoire de stockage, pour ne jamais perdre une facture deja
    enregistree) ; renomme un fichier en cas de collision de nom plutot que
    de l'ecraser. src_dir est vide (mais pas supprime) a l'issue de l'appel."""
    os.makedirs(dst_dir, exist_ok=True)
    for name in os.listdir(src_dir):
        s = os.path.join(src_dir, name)
        d = os.path.join(dst_dir, name)
        if os.path.isdir(s):
            if os.path.isdir(d):
                _merge_move_dir(s, d)
                try:
                    os.rmdir(s)
                except OSError:
                    pass
            elif os.path.exists(d):
                # Collision nom de dossier / fichier : tres improbable, mais
                # on ne doit jamais ecraser silencieusement.
                i = 2
                cand = d + "_%d" % i
                while os.path.exists(cand):
                    i += 1
                    cand = d + "_%d" % i
                shutil.move(s, cand)
            else:
                shutil.move(s, d)
        else:
            if os.path.exists(d):
                stem, dot, ext = name.rpartition(".")
                i = 2
                cand_name = (stem or name) + ("_%d" % i) + (("." + ext) if dot else "")
                cand = os.path.join(dst_dir, cand_name)
                while os.path.exists(cand):
                    i += 1
                    cand_name = (stem or name) + ("_%d" % i) + (("." + ext) if dot else "")
                    cand = os.path.join(dst_dir, cand_name)
                d = cand
            shutil.move(s, d)


def _is_junk(filename):
    base = os.path.basename(filename)
    return not base or base.startswith(".")


def _extract_pdf_pages(file_bytes, page_indices):
    """Extrait un sous-ensemble de pages (indices 0-based, dans l'ordre) d'un
    PDF en un nouveau PDF autonome, utilise lorsqu'un fichier importe
    regroupe plusieurs factures distinctes (voir split_invoices) : chaque
    facture detectee devient alors son propre fichier, decoupe a partir de
    l'original plutot que d'etre melangee avec les pages des autres."""
    reader = PdfReader(io.BytesIO(file_bytes))
    writer = PdfWriter()
    for i in page_indices:
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _split_file_label(filename_only, idx, total):
    """Libelle affiche pour une facture issue du decoupage d'un fichier en
    plusieurs factures (ex. "Facturation_FUTURA_2026.pdf (facture 2/5)")."""
    return "%s (facture %d/%d)" % (filename_only, idx + 1, total)


# Sur les factures reelles fournies pour les tests, plusieurs fournisseurs
# (IT Invent, Macro Mall, Assurance...) impriment en fait le nom de l'enseigne
# "Futura Market" (meme ICE que "Futura Expertise") comme client en haut de
# document - jamais le champ "nom" configure dans Parametres > Societe. Sans
# cet alias, ce nom se faisait parfois prendre a tort pour le fournisseur.
KNOWN_OWN_COMPANY_ALIASES = ("Futura Market",)


def _own_company_info():
    """Nom(s) et ICE de sa propre societe, a exclure des devinettes de
    fournisseur/ICE : ces valeurs apparaissent tres souvent sur la facture
    en tant que client, jamais en tant que fournisseur. Combine le nom
    configure dans Parametres > Societe avec les alias/enseignes connus
    (voir ci-dessus)."""
    names = list(KNOWN_OWN_COMPANY_ALIASES)
    ice = ""
    try:
        conn = dbmod.get_connection()
        row = store.get_doc(conn, "settings", "company")
        conn.close()
        if row:
            data = row
            nom = (data.get("nom") or "").strip()
            if nom:
                names.append(nom)
            ice = (data.get("ice") or "").strip()
    except Exception:
        pass
    return names, ice


def _tiers_bancaires():
    """Liste des tiers bancaires (fusionnes avec le registre Fournisseurs -
    cf. Parametres), utilisee pour proposer une correspondance automatique
    entre le nom devine dans le document et une fiche deja enregistree."""
    try:
        conn = dbmod.get_connection()
        rows = store.list_docs(conn, "tiersBancaires")
        conn.close()
        out = []
        for did, d in rows:
            d["id"] = did
            out.append(d)
        return out
    except Exception:
        return []


def _match_fournisseur_id(nom_devine, tiers):
    """Associe le nom de fournisseur devine depuis le contenu du document a
    une fiche existante (correspondance par sous-chaine, insensible a la
    casse, dans un sens ou dans l'autre). Renvoie l'id de la meilleure
    correspondance, ou None si rien d'assez proche.

    Ne considere que les fiches de type "Fournisseur" : le registre
    'tiersBancaires' est partage avec des mots-cles de rapprochement bancaire
    qui ne sont pas des fournisseurs (Salarie, Impot, Projet, Compte
    courant...), et une correspondance par sous-chaine pouvait a tort
    proposer l'une de ces fiches (ex. un nom de fichier/projet mentionne
    dans le texte de la facture correspondant par hasard a un tel mot-cle)."""
    if not nom_devine:
        return None
    low = nom_devine.strip().lower()
    if len(low) < 3:
        return None
    best_id, best_len = None, 0
    for t in tiers:
        if (t.get("type") or "").strip().lower() != "fournisseur":
            continue
        nom_t = (t.get("tiers") or "").strip().lower()
        if not nom_t or len(nom_t) < 3:
            continue
        if nom_t in low or low in nom_t:
            matched_len = min(len(nom_t), len(low))
            if matched_len > best_len:
                best_id, best_len = t.get("id"), matched_len
    return best_id


def _match_fournisseur_par_ice(ice_devine, tiers):
    """Associe l'ICE devine depuis le contenu du document a une fiche
    fournisseur existante par comparaison EXACTE (l'ICE est un identifiant
    officiel unique par entreprise au Maroc - un match par ICE est donc
    beaucoup plus fiable qu'un rapprochement par nom, qui ne fait que de la
    sous-chaine). Renvoie l'id de la fiche, ou None si l'ICE est vide ou ne
    correspond a aucune fiche "Fournisseur"."""
    ice_norm = (ice_devine or "").strip().lower()
    if not ice_norm:
        return None
    for t in tiers:
        if (t.get("type") or "").strip().lower() != "fournisseur":
            continue
        if (t.get("ice") or "").strip().lower() == ice_norm:
            return t.get("id")
    return None


def _process_invoice_file(filename_only, data, batch_id, batch_dir, used_names,
                           own_names, own_ice, tiers, tiers_by_id, source_original_path=None):
    """Decoupe (si multi-factures) et traite un seul fichier facture deja lu
    en memoire (`data`) : copie chaque piece dans batch_dir, devine ses
    champs, applique un modele de zones si disponible, et renvoie la liste
    des lignes resultantes (1 si fichier simple, N si PDF multi-factures).
    Partagee par import_files (fichiers recus du navigateur) et
    process_source_dir (fichiers lus directement depuis le dossier source
    "a traiter" sur le serveur) - seule la provenance des octets differe.

    `source_original_path`, quand fourni (cas process_source_dir), est
    recopie sur CHAQUE ligne resultante : il identifie le fichier d'origine
    dans le dossier source, et permet au front de le supprimer de ce dossier
    une fois TOUTES les lignes qui en proviennent validees (voir
    delete_source_files - jamais fait ici, cote back, qui ne fait que lire
    ce fichier, pas le modifier)."""
    try:
        invoices, ocr_dispo = split_invoices(filename_only, data)
    except Exception:
        invoices, ocr_dispo = [{
            "pageIndices": [0], "text": "", "ocrUtilise": False, "nbPages": 1,
        }], False
    if not invoices:
        invoices = [{"pageIndices": [0], "text": "", "ocrUtilise": False, "nbPages": 1}]

    ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
    # Un fichier ne contenant qu'une seule facture (le cas normal, de tres
    # loin le plus frequent) garde ses octets d'origine intacts, sans aucun
    # re-encodage : seul un fichier PDF regroupant PLUSIEURS factures
    # distinctes est reellement decoupe en fichiers separes.
    multi = len(invoices) > 1 and ext == "pdf"

    lignes = []
    for idx, inv in enumerate(invoices):
        if multi:
            try:
                piece_bytes = _extract_pdf_pages(data, inv["pageIndices"])
            except Exception:
                piece_bytes = data
            stem, dot, extpart = filename_only.rpartition(".")
            base_label = (stem or filename_only)
            piece_name = "%s_facture_%d_sur_%d.%s" % (base_label, idx + 1, len(invoices), extpart or "pdf")
            display_name = _split_file_label(filename_only, idx, len(invoices))
        else:
            piece_bytes = data
            piece_name = filename_only
            display_name = filename_only

        dest_name = piece_name
        i = 2
        while dest_name in used_names:
            stem, dot, extpart = piece_name.rpartition(".")
            dest_name = (stem or piece_name) + ("_%d" % i) + (("." + extpart) if dot else "")
            i += 1
        used_names.add(dest_name)
        dest_path = os.path.join(batch_dir, dest_name)
        with open(dest_path, "wb") as f:
            f.write(piece_bytes)

        try:
            guess = guess_fields(
                inv.get("text") or "", filename_only,
                exclude_fournisseur_names=own_names, exclude_ice=[own_ice],
                text_ordonne=inv.get("textOrdonne"),
            )
        except Exception:
            guess = {
                "numero": filename_only, "date": "", "montantHT": None,
                "montantTVA": None, "montantTTC": None, "devise": "MAD",
                "fournisseur": "", "ice": "",
            }

        # Auto-remplissage depuis une fiche fournisseur deja enregistree
        # (reprend le principe d'un outil externe d'extraction de factures
        # partage par l'utilisateur, qui maintient un "referentiel
        # fournisseurs" et prefere ses valeurs, une fois corrigees par
        # l'utilisateur, a une nouvelle lecture OCR) : on cherche d'abord un
        # match par ICE EXACT (identifiant officiel unique - la correspondance
        # la plus fiable possible), et si trouve, on remplace le nom/ICE
        # devines par ceux, deja verifies, de la fiche correspondante. Un
        # simple rapprochement par nom (sous-chaine, moins fiable - cf.
        # _match_fournisseur_id) ne sert lui qu'a proposer un id de
        # fournisseur (fournisseurIdGuess), SANS ecraser le texte devine :
        # une correspondance par sous-chaine peut rapprocher a tort deux
        # fournisseurs dont les noms se recoupent partiellement.
        fournisseur_id_ice = _match_fournisseur_par_ice(guess.get("ice"), tiers)
        reference_appliquee = False
        if fournisseur_id_ice:
            ref = tiers_by_id.get(fournisseur_id_ice) or {}
            if (ref.get("tiers") or "").strip():
                guess["fournisseur"] = ref["tiers"].strip()
            if (ref.get("ice") or "").strip():
                guess["ice"] = ref["ice"].strip()
            fournisseur_id_guess = fournisseur_id_ice
            reference_appliquee = True
        else:
            fournisseur_id_guess = _match_fournisseur_id(guess.get("fournisseur"), tiers)

        # Modele de zones ("apprentissage" par fournisseur, PDF natif
        # uniquement - voir backend.facture_parser) : si ce fichier est
        # rattache a un fournisseur qui a deja un modele enregistre, on
        # affine les champs devines a l'aide de ce modele plutot que de
        # s'en tenir uniquement a la devinette generique par mots-cles -
        # celle-ci restant le repli pour tout champ que la zone ne
        # donnerait pas.
        modele_applique = False
        if fournisseur_id_guess and ext == "pdf" and not inv.get("ocrUtilise"):
            modele = (tiers_by_id.get(fournisseur_id_guess) or {}).get("modeleZones")
            if modele and modele.get("zones"):
                try:
                    apply_zone_template(data, inv["pageIndices"][0], modele, guess)
                    modele_applique = True
                except Exception:
                    pass

        ligne = {
            "fileRelPath": "_pending/" + batch_id + "/" + dest_name,
            "fileName": display_name,
            "fournisseurNomGuess": guess.get("fournisseur") or "",
            "fournisseurIceGuess": guess.get("ice") or "",
            "fournisseurIdGuess": fournisseur_id_guess,
            "numero": guess["numero"],
            "date": guess["date"],
            "montantHT": guess["montantHT"],
            "montantTVA": guess["montantTVA"],
            "montantTTC": guess["montantTTC"],
            "devise": guess["devise"],
            "ocrUtilise": inv.get("ocrUtilise", False),
            "ocrDisponible": ocr_dispo,
            "apercu": (inv.get("text") or "").strip()[:400],
            "modeleApplique": modele_applique,
            "referenceFournisseurAppliquee": reference_appliquee,
        }
        if source_original_path is not None:
            ligne["sourceOriginalPath"] = source_original_path
        lignes.append(ligne)
    return lignes


@facture_fournisseur.post("/import-files")
def import_files():
    files = [f for f in request.files.getlist("files") if f and f.filename]
    if not files:
        return jsonify({"error": "Aucun fichier reçu"}), 400

    batch_id = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]
    batch_dir = os.path.join(get_pending_dir(), batch_id)
    os.makedirs(batch_dir, exist_ok=True)

    own_names, own_ice = _own_company_info()
    tiers = _tiers_bancaires()
    tiers_by_id = {t.get("id"): t for t in tiers}
    lignes = []
    skipped = 0
    used_names = set()

    for file in files:
        filename_only = os.path.basename(file.filename)
        if _is_junk(filename_only):
            continue
        ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
        if ext not in ALLOWED_EXT:
            skipped += 1
            continue

        data = file.read()
        lignes.extend(_process_invoice_file(
            filename_only, data, batch_id, batch_dir, used_names,
            own_names, own_ice, tiers, tiers_by_id,
        ))

    if not lignes:
        shutil.rmtree(batch_dir, ignore_errors=True)
        return jsonify({"error": "Aucun fichier de facture reconnu (pdf/jpg/jpeg/png attendus)"}), 400

    return jsonify({
        "batchId": batch_id,
        "lignes": lignes,
        "skipped": skipped,
        "ocrDisponible": lignes[0]["ocrDisponible"],
    })


@facture_fournisseur.post("/process-source-dir")
def process_source_dir():
    """Bouton "Traitement" (Parametres > dossier des factures a traiter) :
    lit directement, sur le disque du serveur, les fichiers presents dans le
    repertoire source configure ET dans la totalite de ses sous-dossiers, a
    n'importe quelle profondeur (depuis la V1.52 - demande explicite de
    l'utilisateur, son dossier reel etant organise par annee puis par
    fournisseur ; auparavant limite a la racine, V1.29), et les fait passer
    par le meme traitement (decoupage multi-factures, devinette des champs,
    modele de zones) que l'import classique - sans passer par le selecteur
    de fichiers du navigateur, qui reste disponible par ailleurs (bouton
    Importer, inchange). Chaque ligne resultante porte son
    "sourceOriginalPath" (chemin absolu du fichier d'origine dans ce
    dossier source), utilise ensuite par le front puis delete_source_files
    pour le supprimer de ce dossier une fois sa facture (ou, pour un
    fichier multi-factures, la totalite de ses factures) validee ; un
    fichier trouve dans un sous-dossier est alors, comme un fichier a la
    racine, deplace vers le classement annee/mois habituel du repertoire de
    Stockage puis supprime de son sous-dossier d'origine - c'est pourquoi le
    dossier source ne doit jamais chevaucher le repertoire de Stockage (voir
    _dirs_overlap, verifie aussi ici en plus de set_source_dir, au cas ou le
    reglage de Stockage aurait change depuis)."""
    source_dir = get_source_dir()
    if not source_dir:
        return jsonify({"error": "Aucun dossier « factures à traiter » n'est configuré (Paramètres)."}), 400
    if not os.path.isdir(source_dir):
        return jsonify({"error": "Le dossier configuré n'existe pas ou n'est plus accessible : " + source_dir}), 400
    if _dirs_overlap(source_dir, get_storage_dir()):
        return jsonify({"error": "Le dossier « à traiter » configuré est le même que (ou se trouve dans, ou contient) le répertoire de Stockage des factures fournisseurs — traitement refusé pour éviter de supprimer des factures déjà classées. Corrigez l'un des deux réglages dans Paramètres."}), 400

    try:
        fichiers = []
        for root, dirs, files in os.walk(source_dir):
            dirs.sort()
            for fn in sorted(files):
                fichiers.append(os.path.join(root, fn))
    except Exception as e:
        return jsonify({"error": "Impossible de lire ce dossier : " + str(e)}), 400

    batch_id = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]
    batch_dir = os.path.join(get_pending_dir(), batch_id)
    os.makedirs(batch_dir, exist_ok=True)

    own_names, own_ice = _own_company_info()
    tiers = _tiers_bancaires()
    tiers_by_id = {t.get("id"): t for t in tiers}
    lignes = []
    skipped = 0
    used_names = set()

    for chemin in fichiers:
        if not os.path.isfile(chemin):
            continue
        filename_only = os.path.basename(chemin)
        if _is_junk(filename_only):
            continue
        ext = filename_only.rsplit(".", 1)[-1].lower() if "." in filename_only else ""
        if ext not in ALLOWED_EXT:
            skipped += 1
            continue
        try:
            with open(chemin, "rb") as f:
                data = f.read()
        except Exception:
            skipped += 1
            continue
        nouvelles_lignes = _process_invoice_file(
            filename_only, data, batch_id, batch_dir, used_names,
            own_names, own_ice, tiers, tiers_by_id,
            source_original_path=os.path.realpath(chemin),
        )
        # Le sous-dossier d'origine (relatif au dossier source configure)
        # est prefixe au nom affiche, pour qu'on distingue a l'ecran deux
        # fichiers de meme nom venus de sous-dossiers differents (frequent
        # avec un classement annee/fournisseur) - sourceOriginalPath, lui,
        # reste le chemin absolu complet, deja sans ambiguite.
        rel_dir = os.path.relpath(os.path.dirname(chemin), source_dir)
        if rel_dir and rel_dir != ".":
            rel_dir_aff = rel_dir.replace(os.sep, "/")
            for l in nouvelles_lignes:
                l["fileName"] = rel_dir_aff + "/" + l["fileName"]
        lignes.extend(nouvelles_lignes)

    if not lignes:
        shutil.rmtree(batch_dir, ignore_errors=True)
        return jsonify({"error": "Aucun fichier de facture reconnu dans ce dossier (pdf/jpg/jpeg/png attendus)"}), 400

    return jsonify({
        "batchId": batch_id,
        "lignes": lignes,
        "skipped": skipped,
        "ocrDisponible": lignes[0]["ocrDisponible"],
        "sourceDir": source_dir,
    })


@facture_fournisseur.post("/delete-source-files")
def delete_source_files():
    """Supprime, du dossier source "a traiter", les fichiers d'origine dont
    la (ou les) facture(s) extraite(s) viennent d'etre validees - appele par
    le front uniquement APRES succes de l'enregistrement (voir
    process_source_dir et la fonction "Enregistrer" de l'ecran de relecture
    cote JS, qui ne transmet que les chemins dont TOUTES les lignes issues
    d'un meme fichier ont ete cochees "garder" et enregistrees avec succes).
    Chaque chemin recu est verifie comme etant bien a l'INTERIEUR du dossier
    source actuellement configure, pour ne jamais supprimer un fichier hors
    de ce dossier meme en cas de reglage change entre-temps ou de chemin
    invalide transmis par erreur."""
    body = request.get_json(force=True, silent=True) or {}
    chemins = body.get("paths") or []
    source_dir = get_source_dir()
    if not source_dir or not os.path.isdir(source_dir):
        return jsonify({"ok": True, "supprimes": 0})  # dossier change/disparu entre-temps : rien a faire, pas une erreur
    base = os.path.realpath(source_dir)
    supprimes = 0
    for chemin in chemins:
        if not isinstance(chemin, str) or not chemin:
            continue
        try:
            cible = os.path.realpath(chemin)
        except Exception:
            continue
        if cible == base or not cible.startswith(base + os.sep):
            continue  # hors du dossier source configure : ignore par securite
        try:
            if os.path.isfile(cible):
                os.remove(cible)
                supprimes += 1
        except Exception:
            pass
    return jsonify({"ok": True, "supprimes": supprimes})


@facture_fournisseur.post("/source-dir")
def set_source_dir():
    """Enregistre le repertoire source "a traiter" (Parametres). Contrairement
    au repertoire de STOCKAGE (set_storage_dir), aucun contenu existant n'a
    besoin d'etre deplace : ce repertoire n'est jamais gere/ecrit par
    l'application entre deux traitements, seulement lu puis purge fichier
    par fichier au fil des validations. On verifie juste qu'il existe (le
    cree si besoin) et qu'il est accessible en ecriture (necessaire pour
    pouvoir y supprimer les fichiers traites). Un chemin vide desactive le
    bouton Traitement (aucun dossier configure)."""
    body = request.get_json(force=True, silent=True) or {}
    raw_dir = (body.get("dir") or "").strip()
    new_dir = os.path.abspath(raw_dir) if raw_dir else ""

    if new_dir:
        if _dirs_overlap(new_dir, get_storage_dir()):
            return jsonify({"error": "Ce dossier ne peut pas être le même que (ni être situé dans, ni contenir) le répertoire de Stockage des factures fournisseurs — cela supprimerait des factures déjà classées dès qu'elles seraient retrouvées par le traitement suivant. Choisissez un dossier distinct pour le dépôt des factures « à traiter »."}), 400
        try:
            os.makedirs(new_dir, exist_ok=True)
        except Exception as e:
            return jsonify({"error": "Impossible de créer/accéder à ce répertoire : " + str(e)}), 400
        test_path = os.path.join(new_dir, ".ecriture_test.tmp")
        try:
            with open(test_path, "w") as f:
                f.write("test")
            os.remove(test_path)
        except Exception as e:
            return jsonify({"error": "Ce répertoire n'est pas accessible en écriture : " + str(e)}), 400

    conn = dbmod.get_connection()
    row = store.get_doc(conn, "settings", "company")
    data = dict(row) if row else {}
    data["facturesFournisseursSourceDir"] = new_dir
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "dir": new_dir})


@facture_fournisseur.post("/cancel-batch")
def cancel_batch():
    body = request.get_json(force=True, silent=True) or {}
    batch_id = body.get("batchId", "")
    if not re.match(r"^[0-9a-zA-Z\-]+$", batch_id):
        return jsonify({"error": "batchId invalide"}), 400
    pending_dir = get_pending_dir()
    batch_dir = os.path.join(pending_dir, batch_id)
    if os.path.isdir(batch_dir) and os.path.dirname(batch_dir) == pending_dir:
        shutil.rmtree(batch_dir, ignore_errors=True)
    return jsonify({"ok": True})


def _strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _sanitize_path_component(s, fallback):
    s = _strip_accents(s or "")
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")
    return s or fallback


def build_final_rel_path(date_str, fournisseur_nom, numero, ext):
    """Calcule le chemin cible <annee>/<mois>/AAAA_MM_JJ_NomFournisseur_Numero.ext
    a partir des valeurs finales (confirmees par l'utilisateur) d'une ligne.
    Une date absente/invalide est classee sous Annee_inconnue/Mois_inconnu
    plutot que de bloquer l'enregistrement."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", (date_str or "").strip())
    if m:
        annee, mois, jour = m.group(1), m.group(2), m.group(3)
    else:
        annee, mois, jour = "AnneeInconnue", "MoisInconnu", "JJ"
    fnom = _sanitize_path_component(fournisseur_nom, "Fournisseur")
    fnum = _sanitize_path_component(numero, "SansNumero")
    filename = "%s_%s_%s_%s_%s.%s" % (annee, mois, jour, fnom, fnum, ext.lower())
    return "/".join([annee, mois, filename])


def _resolve_under_storage(rel_path, storage_dir=None):
    storage_dir = storage_dir if storage_dir is not None else get_storage_dir()
    target = os.path.realpath(os.path.join(storage_dir, rel_path))
    base = os.path.realpath(storage_dir)
    if target != base and not target.startswith(base + os.sep):
        return None
    return target


@facture_fournisseur.post("/finalize-file")
def finalize_file():
    """Deplace (et renomme) le fichier d'une ligne de facture fournisseur
    vers son emplacement definitif <annee>/<mois>/..., a partir des valeurs
    finales saisies/corrigees par l'utilisateur. Appele a l'enregistrement
    d'une nouvelle facture, et de nouveau a chaque modification ulterieure
    d'une facture deja enregistree (si fournisseur/date/numero changent, le
    fichier est re-deplace/renomme en consequence)."""
    body = request.get_json(force=True, silent=True) or {}
    current_rel_path = (body.get("currentRelPath") or "").strip()
    fournisseur_nom = (body.get("fournisseurNom") or "").strip()
    date_str = (body.get("date") or "").strip()
    numero = (body.get("numero") or "").strip()

    if not current_rel_path:
        return jsonify({"error": "currentRelPath manquant"}), 400
    storage_dir = get_storage_dir()
    source = _resolve_under_storage(current_rel_path, storage_dir)
    if not source or not os.path.isfile(source):
        return jsonify({"error": "Fichier source introuvable"}), 404

    ext = current_rel_path.rsplit(".", 1)[-1].lower() if "." in current_rel_path else "pdf"
    target_rel = build_final_rel_path(date_str, fournisseur_nom, numero, ext)
    target = _resolve_under_storage(target_rel, storage_dir)
    if not target:
        return jsonify({"error": "Chemin cible invalide"}), 400

    if os.path.realpath(source) != os.path.realpath(target):
        os.makedirs(os.path.dirname(target), exist_ok=True)
        # Evite d'ecraser un autre fichier deja present au meme nom cible
        # (ex. deux factures du meme fournisseur, meme jour, meme numero).
        final_target, final_rel = target, target_rel
        i = 2
        while os.path.exists(final_target) and os.path.realpath(final_target) != os.path.realpath(source):
            stem, dot, extpart = target_rel.rpartition(".")
            final_rel = (stem or target_rel) + ("_%d" % i) + (("." + extpart) if dot else "")
            final_target = _resolve_under_storage(final_rel, storage_dir)
            i += 1
        shutil.move(source, final_target)
        target_rel = final_rel
        # Nettoie un dossier de lot en attente devenu vide apres le deplacement.
        src_dir = os.path.dirname(source)
        try:
            if os.path.realpath(src_dir).startswith(os.path.realpath(os.path.join(storage_dir, "_pending")) + os.sep) and not os.listdir(src_dir):
                os.rmdir(src_dir)
        except OSError:
            pass

    return jsonify({"fileRelPath": target_rel})


@facture_fournisseur.get("/file/<path:rel_path>")
def get_file(rel_path):
    target = _resolve_under_storage(rel_path)
    if not target:
        return jsonify({"error": "Chemin invalide"}), 400
    if not os.path.isfile(target):
        return jsonify({"error": "Fichier introuvable"}), 404
    return send_file(target)


@facture_fournisseur.get("/page-image")
def page_image():
    """Rend une page d'un fichier PDF (en attente ou deja classe) en image
    PNG, pour l'editeur de zones de lecture (modele par fournisseur) : la
    page sert de support pour dessiner les zones a la souris. Limite au PDF
    a texte natif - aucun support pour les images (jpg/png) dans cette
    version, le "modele de zones" ne s'appliquant qu'aux PDF."""
    rel_path = (request.args.get("relPath") or "").strip()
    try:
        page_index = int(request.args.get("page", "0"))
    except ValueError:
        page_index = 0
    if not rel_path:
        return jsonify({"error": "relPath manquant"}), 400
    target = _resolve_under_storage(rel_path)
    if not target or not os.path.isfile(target):
        return jsonify({"error": "Fichier introuvable"}), 404
    try:
        with open(target, "rb") as f:
            data = f.read()
        png_bytes = render_page_png(data, page_index)
    except Exception as e:
        return jsonify({"error": "Impossible de generer l’image : " + str(e)}), 400
    return send_file(io.BytesIO(png_bytes), mimetype="image/png")


@facture_fournisseur.post("/storage-dir")
def set_storage_dir():
    """Change le repertoire de stockage des factures fournisseurs
    (Parametres > Stockage des factures fournisseurs). Valide que le
    nouveau repertoire est accessible en ecriture (le cree si besoin), puis
    deplace tout le contenu deja present dans l'ancien repertoire (dossier
    d'attente '_pending' + classement annee/mois) vers le nouveau avant
    d'enregistrer le reglage - comportement valide avec l'utilisateur avant
    implementation, pour ne jamais rendre une facture deja enregistree
    introuvable suite a ce changement. Un chemin vide reinitialise vers le
    repertoire par defaut de l'application."""
    body = request.get_json(force=True, silent=True) or {}
    raw_dir = (body.get("dir") or "").strip()
    new_dir = os.path.abspath(raw_dir) if raw_dir else DEFAULT_STORAGE_DIR

    if _dirs_overlap(new_dir, get_source_dir()):
        return jsonify({"error": "Ce répertoire ne peut pas être le même que (ni être situé dans, ni contenir) le dossier « à traiter » déjà configuré (Paramètres > Factures fournisseurs à traiter) — le bouton Traitement supprime les fichiers qu'il y retrouve une fois validés. Choisissez un répertoire de Stockage distinct, ou videz d'abord le dossier « à traiter »."}), 400

    try:
        os.makedirs(new_dir, exist_ok=True)
    except Exception as e:
        return jsonify({"error": "Impossible de créer/accéder à ce répertoire : " + str(e)}), 400
    test_path = os.path.join(new_dir, ".ecriture_test.tmp")
    try:
        with open(test_path, "w") as f:
            f.write("test")
        os.remove(test_path)
    except Exception as e:
        return jsonify({"error": "Ce répertoire n'est pas accessible en écriture : " + str(e)}), 400

    old_dir = get_storage_dir()
    moved = False
    if os.path.isdir(old_dir) and os.path.realpath(old_dir) != os.path.realpath(new_dir):
        try:
            _merge_move_dir(old_dir, new_dir)
            moved = True
            if old_dir != DEFAULT_STORAGE_DIR:
                try:
                    os.rmdir(old_dir)
                except OSError:
                    pass  # dossier non vide (improbable) ou verrouille : laisse en place, sans erreur bloquante
        except Exception as e:
            return jsonify({"error": "Le nouveau répertoire a été préparé, mais le déplacement des fichiers déjà enregistrés a échoué : " + str(e)}), 400

    os.makedirs(os.path.join(new_dir, "_pending"), exist_ok=True)

    conn = dbmod.get_connection()
    row = store.get_doc(conn, "settings", "company")
    data = dict(row) if row else {}
    data["facturesFournisseursDir"] = "" if new_dir == DEFAULT_STORAGE_DIR and not raw_dir else new_dir
    store.set_doc(conn, "settings", "company", data)
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "dir": new_dir, "moved": moved})


def _fournisseurs_avec_modele():
    """Liste des fiches 'Fournisseur' du registre tiersBancaires qui ont
    effectivement un modele de zones (au moins une zone) deja enregistre."""
    out = []
    for t in _tiers_bancaires():
        if (t.get("type") or "").strip().lower() != "fournisseur":
            continue
        modele = t.get("modeleZones") or {}
        zones = modele.get("zones") or []
        if zones:
            out.append(t)
    return out


def _match_fournisseur_par_ice_ou_nom(ice, nom, tiers):
    """Associe une entree du fichier d'import de modeles de zones a une
    fiche fournisseur existante : d'abord par ICE (comparaison exacte,
    insensible a la casse/espaces - l'ICE etant normalement unique et fiable
    quand renseigne), sinon par nom (meme heuristique de sous-chaine que
    pour la reconnaissance a l'import de facture, cf. _match_fournisseur_id)."""
    ice_norm = (ice or "").strip().lower()
    if ice_norm:
        for t in tiers:
            if (t.get("type") or "").strip().lower() != "fournisseur":
                continue
            if (t.get("ice") or "").strip().lower() == ice_norm:
                return t.get("id")
    return _match_fournisseur_id(nom, tiers)


@facture_fournisseur.get("/zones-modeles/export")
def export_zones_modeles():
    """Exporte en un seul fichier JSON l'ensemble des modeles de zones deja
    configures (un par fournisseur), pour sauvegarde ou transfert vers une
    autre installation de l'application - cf. Parametres > Modeles de zones.
    Format volontairement technique (JSON, structure identique a celle
    stockee en base) plutot qu'un tableau Excel : un modele de zones n'est
    pas une donnee destinee a etre lue/modifiee a la main dans un tableur."""
    modeles = []
    for t in _fournisseurs_avec_modele():
        modeles.append({
            "fournisseur": t.get("tiers") or "",
            "ice": t.get("ice") or "",
            "zones": (t.get("modeleZones") or {}).get("zones") or [],
        })
    payload = {
        "export_modeles_zones_chantier_erp": True,
        "exporte_le": datetime.datetime.utcnow().isoformat() + "Z",
        "modeles": modeles,
    }
    buf = io.BytesIO(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"))
    return send_file(
        buf, mimetype="application/json", as_attachment=True,
        download_name="modeles_zones_factures_fournisseurs.json",
    )


@facture_fournisseur.post("/zones-modeles/import")
def import_zones_modeles():
    """Importe un fichier JSON precedemment exporte par export_zones_modeles
    (ou compatible avec ce format) : chaque entree est rattachee a une fiche
    fournisseur existante par ICE puis par nom (cf.
    _match_fournisseur_par_ice_ou_nom), et REMPLACE le modele de zones deja
    enregistre pour cette fiche le cas echeant (comportement valide avec
    l'utilisateur avant implementation - la fiche la plus recente importee
    fait foi). N'importe jamais de modele pour un fournisseur introuvable :
    cree uniquement une entree dans 'non_trouves' (aucune fiche fournisseur
    n'est creee a partir de ce seul import, contrairement a l'import Excel
    des registres Clients/Fournisseurs)."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    try:
        payload = json.loads(file.read().decode("utf-8"))
    except Exception as e:
        return jsonify({"error": "Fichier JSON illisible : " + str(e)}), 400

    modeles = payload.get("modeles")
    if not isinstance(modeles, list):
        return jsonify({"error": "Format de fichier non reconnu (clé 'modeles' manquante)"}), 400

    tiers = _tiers_bancaires()
    conn = dbmod.get_connection()
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    importes = 0
    non_trouves = []

    for entry in modeles:
        if not isinstance(entry, dict):
            continue
        nom = (entry.get("fournisseur") or "").strip()
        ice = (entry.get("ice") or "").strip()
        zones_brutes = entry.get("zones")
        zones = []
        if isinstance(zones_brutes, list):
            for z in zones_brutes:
                if not isinstance(z, dict):
                    continue
                try:
                    zones.append({
                        "champ": str(z.get("champ") or ""),
                        "x0": float(z.get("x0")), "y0": float(z.get("y0")),
                        "x1": float(z.get("x1")), "y1": float(z.get("y1")),
                    })
                except (TypeError, ValueError):
                    continue  # zone malformee : ignoree individuellement, le reste de l'entree est conserve
        if not zones:
            continue

        fournisseur_id = _match_fournisseur_par_ice_ou_nom(ice, nom, tiers)
        if not fournisseur_id:
            non_trouves.append(nom or ice or "(sans nom)")
            continue

        row = store.get_doc(conn, "tiersBancaires", fournisseur_id)
        if not row:
            non_trouves.append(nom or ice or "(sans nom)")
            continue
        data = row
        data["modeleZones"] = {"zones": zones}
        store.set_doc(conn, "tiersBancaires", fournisseur_id, data)
        importes += 1

    conn.commit()
    conn.close()
    return jsonify({"ok": True, "importes": importes, "non_trouves": non_trouves})
