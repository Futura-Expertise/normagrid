# -*- coding: utf-8 -*-
"""Description du module « contrat » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'contrat',
 'label': 'Contrat (Contrats, Avenants, Attachements)',
 'depends': ['commercial'],
 'optional': [],
 'sections': ['ctr', 'av', 'att'],
 'collections': ['contrats', 'avenants', 'attachements'],
 'tables': ['contrats',
            'contrats_lignes',
            'contrat_codes_retour',
            'contrat_destinataires',
            'contrat_segments',
            'contrat_segment_valeurs',
            'contrat_composition_code',
            'contrat_segments_fixes_retires',
            'avenants',
            'attachements',
            'attachements_lignes'],
 'routes': ['commande_client']}
