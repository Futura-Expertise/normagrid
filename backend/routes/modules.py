"""
Modules desactivables par installation (V1.57). Voir backend/modules.py
pour la logique et claude/architecture-cloud-securite.md pour la demarche
complete. Pas de section ACCESS dediee ici par choix : un chemin qui ne
correspond a aucune regle connue de backend/access.py (_resolve_section)
est deja ferme par defaut a tout le monde SAUF l'administrateur
(enforce_request()) - exactement le niveau de protection voulu pour ces
deux routes, sans dupliquer cette regle.
"""

from flask import Blueprint, jsonify, request

from backend import modules as modulesmod

modules_bp = Blueprint("modules", __name__, url_prefix="/api/modules")


@modules_bp.get("")
def lister_modules():
    return jsonify({"modules": modulesmod.etat_modules()})


@modules_bp.post("")
def enregistrer_modules():
    """Corps attendu : {"modulesActifs": {"<id>": true/false, ...}} - un
    module absent du corps envoye garde son etat actuel (mise a jour
    partielle, jamais un remplacement total implicite qui desactiverait
    par erreur un module simplement non coche dans un formulaire
    incomplet)."""
    body = request.get_json(force=True, silent=True) or {}
    actifs = body.get("modulesActifs")
    if not isinstance(actifs, dict):
        return jsonify({"error": "Corps invalide : 'modulesActifs' (objet) attendu."}), 400
    desactives = modulesmod.modules_desactives_explicites()
    for mod_id, actif in actifs.items():
        if mod_id not in modulesmod.MODULES:
            continue
        if actif:
            desactives.discard(mod_id)
        else:
            desactives.add(mod_id)
    # Un module ne peut pas etre actif si un module dont il depend est inactif (V3.01) :
    # verifie AVANT d'enregistrer.
    for mod_id, actif in actifs.items():
        if actif and mod_id in modulesmod.MODULES:
            manquants = modulesmod.dependances_manquantes(mod_id, desactives)
            if manquants:
                manque = ", ".join("« %s »" % modulesmod.MODULES[d]["label"] for d in manquants)
                return jsonify({"error": "Impossible d'activer « %s » : il faut d'abord activer %s."
                                         % (modulesmod.MODULES[mod_id]["label"], manque)}), 400
    modulesmod.set_modules_desactives(desactives)
    return jsonify({"ok": True, "modules": modulesmod.etat_modules()})
