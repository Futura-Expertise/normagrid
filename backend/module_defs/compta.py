# -*- coding: utf-8 -*-
"""Description du module « compta » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'compta',
 'label': "Comptabilité (plan comptable, journal, écriture d'ouverture, exercices archivés, contrôle de "
          'gestion, relevés bancaires)',
 'depends': [],
 'optional': ['facturation', 'fournisseurs'],
 'sections': ['planComptable',
              'ecritures',
              'ecritureOuverture',
              'exercicesArchives',
              'controleGestion',
              'releves'],
 'collections': ['planComptable', 'ecritures', 'exercicesArchives', 'releves'],
 'tables': ['plan_comptable',
            'ecritures',
            'ecritures_lignes',
            'exercices_archives',
            'exercices_archives_lignes',
            'releves',
            'releves_lignes'],
 'routes': ['releve', 'ouverture']}
