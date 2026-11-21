# -*- coding: utf-8 -*-
"""Description du module « facturation » (V3.01) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).
"""

MODULE = {'id': 'facturation',
 'label': 'Facturation clients (Propositions, Factures, Avoirs, Encaissements)',
 'depends': ['contrat'],
 'optional': [],
 'sections': ['pfa', 'fac', 'avo', 'reg'],
 'collections': ['propositionsFacturation', 'factures', 'avoirs', 'reglements'],
 'tables': ['propositions_facturation',
            'propositions_facturation_lignes',
            'factures',
            'factures_lignes',
            'avoirs',
            'avoirs_lignes',
            'reglements'],
 'routes': ['facture_client']}
