"""
Route specifique au module "Ecriture d'ouverture" (V1.34) : import du bilan
de cloture (PDF, format CGNC modele simplifie) pour en extraire les
rubriques et montants, en vue de la saisie en une fois de l'ecriture
d'ouverture (journal AN) au demarrage de la comptabilite dans l'application.
Separe de backend/routes/api.py pour la meme raison que releve.py : ce n'est
pas du CRUD generique, mais un traitement de fichier (pdfplumber).
"""

from flask import Blueprint, jsonify, request

from backend.bilan_parser import parse_bilan

ouverture = Blueprint("ouverture", __name__, url_prefix="/api/ouverture")


@ouverture.post("/parse-bilan")
def parse_bilan_route():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier PDF reçu (champ 'file' manquant)"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Aucun fichier PDF sélectionné"}), 400
    pdf_bytes = file.read()
    if not pdf_bytes:
        return jsonify({"error": "Fichier vide"}), 400
    try:
        exercice_debut, exercice_fin, lignes, chiffre_affaires, chiffre_affaires_precedent = parse_bilan(pdf_bytes)
    except Exception as e:
        return jsonify({"error": "Impossible d'analyser ce PDF : " + str(e)}), 400
    if not lignes:
        return jsonify({
            "error": "Aucune rubrique avec un montant n'a été reconnue dans ce bilan. "
                     "Vérifiez qu'il s'agit bien du Tableau n°1 BILAN (modèle simplifié)."
        }), 400
    return jsonify({
        "nomFichier": file.filename,
        "exerciceDebut": exercice_debut,
        "exerciceFin": exercice_fin,
        "lignes": lignes,
        # Chiffre d'affaires de l'exercice cloture, lu sur la page CPC du
        # meme PDF si presente (Tableau n 2) - purement informatif, jamais
        # comptabilise dans l'ecriture d'ouverture (voir bilan_parser.py).
        "chiffreAffaires": chiffre_affaires,
        "chiffreAffairesExercicePrecedent": chiffre_affaires_precedent,
    })
