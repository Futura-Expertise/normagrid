# -*- coding: utf-8 -*-
"""Description du module « noyau » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'noyau',
 'label': 'Noyau (toujours actif)',
 'depends': [],
 'optional': [],
 'sections': ['dashboard', 'settings', 'tiersBancaires'],
 'collections': ['users', 'settings', 'meta', 'backlog', 'tiersBancaires'],
 'tables': ['utilisateurs',
            'parametres_societe',
            'numerotation_parametres',
            'compteurs',
            'migrations_faites',
            'backlog',
            'tiers',
            'tiers_zones'],
 'routes': ['api', 'auth', 'db_admin', 'modules', 'excel_io', 'xlsx_tools']}
