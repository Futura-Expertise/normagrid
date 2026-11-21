# -*- coding: utf-8 -*-
"""Description du module « personnel » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'personnel',
 'label': 'RH',
 'depends': [],
 'optional': [],
 'sections': ['personnel', 'competences', 'formations'],
 'collections': ['personnel',
                 'personnelStatuts',
                 'niveauxAttendusStatuts',
                 'competenceCategories',
                 'competencesReferentiel',
                 'formations'],
 'tables': ['statuts_personnel',
            'personnel',
            'categories_competence',
            'competences',
            'personnel_competences',
            'personnel_competences_historique',
            'niveaux_attendus',
            'niveaux_attendus_historique',
            'formations',
            'formation_personnes',
            'formation_competences'],
 'routes': []}
