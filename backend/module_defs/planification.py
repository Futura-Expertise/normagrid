# -*- coding: utf-8 -*-
"""Description du module « planification » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'planification',
 'label': 'Planification (Planning, Timesheet)',
 'depends': ['livrables'],
 'optional': ['personnel'],
 'sections': ['planification', 'timesheet'],
 'collections': ['planificationLignes', 'timesheetLignes'],
 'tables': ['grille_lignes', 'grille_jours'],
 'routes': []}
