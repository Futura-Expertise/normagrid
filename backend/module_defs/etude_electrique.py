# -*- coding: utf-8 -*-
"""Description du module « etude_electrique » (V3.03) : dépendances, menus, tables et routes.

depends  : modules OBLIGATOIRES (le module est inactif si l'un d'eux l'est).
optional : liens facultatifs (clé étrangère SET NULL) : le module fonctionne sans l'autre.
sections : sections de droits (matrice ACCESS de backend/access.py).
collections / tables / routes : ce que le module possède (contrôlé par scripts/verifier_modules.py).

Étude électrique : base de données des consommateurs (import / export Excel avec formules et listes déroulantes).
Chaque consommateur se rattache à un contrat ou à un devis (dépend de « contrat », qui dépend de « commercial »).
V3.04 : sous-menu « Liste des consommateurs » (document généré depuis la base, une section par Switchgear / MCC).
V3.05 : sous-menu « Bilan de puissance » (bilan par tableau + récap, calculé depuis la base).
V3.13 : Base matériel > « Câbles BT » : catalogue des câbles par famille (consultation + import Excel).
V3.29 : schéma unifilaire : navigation souris façon AutoCAD (molette, main, zoom fenêtre) et export par zone (étendue / affichage / fenêtre).
V3.28 : schéma unifilaire : symboles d'appareillage d'après la planche fournie (disjoncteur, sectionneur, interrupteur-sectionneur, interrupteur à fusibles).
V3.26 : schéma unifilaire : symbole disjoncteur corrigé, source avec transformateur et caractéristiques.
V3.25 : schéma unifilaire : récepteurs (moteurs M, charges C) en option.
V3.24 : sous-menu Schéma unifilaire (généré depuis la base, exports SVG / DXF / PDF).
V3.23 : « Départ type » (ex Special Reqts) par projet ; modèles d'appartement hérités dans la note de calcul.
V3.22 : catalogue Protections BT : interrupteurs (INS, iSW, iID), fusibles (Fupact INFC / INFD, gG, aM), iDT40, iDD40.
V3.19 : déclencheurs détaillés : une référence par ligne (série, In, plage Ir, seuil Im).
V3.16 : liens Caneco : constructeur > catégorie > gamme > variante.
V3.32 : éditeur de symboles : import DXF (dessin ou bloc) / SVG, export SVG, textes variables ({gamme}, {calibre}, {kVA}…) remplacés dans le schéma ; le bloc « Source » du schéma vient de la bibliothèque.
V3.31 : éditeur de symboles : déplacer / copier / rotation / symétrie, bornes in-out, symbole « utilisé dans le schéma » par catégorie (le schéma dessine la bibliothèque), BLOCK/INSERT en DXF ; import Caneco : le « Contenu » de la base fixe la composition du câble.
V3.30 : « Éditeur de symboles » (bibliothèque commune à tous les projets, etude_symboles) : dessin au millimètre type AutoCAD.
V3.15 : Calcul > « Importer note Caneco » (câbles et protections) avec liens Caneco <-> catalogues (etude_bt_liens_caneco).
V3.14 : sous-menu « Calcul » : arbre de distribution, détail du tableau, saisie des circuits (câble, longueur, protection).
V3.12 : Protections BT : catégorie de protection (Disj. Boîtier moulé, Disj. Ouvert, Disjonct. B/C/D..., Fusible gG), choix constructeur puis catégorie.
V3.11 : Base matériel > « Protections BT » : disjoncteurs et déclencheurs par constructeur (consultation + import Excel).
V3.10 : Bilan de puissance : coefficient de réserve (normal / secours), reprise en cascade avec ou sans réserve.
V3.09 : Bilan de puissance : choix d'un transformateur dans la base matériel (puissance, pertes calculées).
V3.08 : la base matériel gère les transformateurs sans ventilation (colonne « ONAF applicable » OUI / NON, ONAF grisé).
V3.06 : sous-menu « Base matériel » (transformateurs HT/MT : liste, explications, paramètres, sources ; import / export Excel).
"""

MODULE = {'id': 'etude_electrique',
 'label': 'Étude électrique',
 'depends': ['contrat'],
 'optional': [],
 'sections': ['etude_elec'],
 'collections': ['etudeConsommateurs', 'etudeListes', 'etudeListeDocs', 'etudeBilanTableaux',
                 'etudeMatTransfos', 'etudeMatParams', 'etudeMatSources',
                 'etudeMatConstructeurs', 'etudeMatDisj', 'etudeMatDecl', 'etudeMatAssoc', 'etudeMatReglages', 'etudeBtCables', 'etudeBtCircuits', 'etudeBtLiensCaneco', 'etudeSymboles', 'etudeMatDocs', 'etudeMatCourbes'],
 'tables': ['etude_consommateurs', 'etude_listes_valeurs', 'etude_liste_documents', 'etude_bilan_tableaux',
            'etude_mat_transfos', 'etude_mat_params', 'etude_mat_sources',
            'etude_mat_constructeurs', 'etude_mat_disjoncteurs', 'etude_mat_declencheurs', 'etude_mat_assoc_decl', 'etude_mat_reglages', 'etude_bt_cables', 'etude_bt_circuits', 'etude_bt_liens_caneco', 'etude_symboles', 'etude_mat_docs', 'etude_mat_courbes'],
 'routes': ['etude_electrique', 'etude_docs']}
