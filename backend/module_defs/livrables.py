# -*- coding: utf-8 -*-
"""Description du module « livrables » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'livrables',
 'label': 'Livrables techniques',
 'depends': ['contrat'],
 'optional': ['personnel'],
 'sections': ['livrables'],
 'collections': ['livrables', 'bordereaux'],
 'tables': ['livrables',
            'livrable_segment_valeurs',
            'livrable_historique_indices',
            'livrable_affectations',
            'bordereaux',
            'bordereaux_lignes'],
 'routes': ['livrables_import']}
