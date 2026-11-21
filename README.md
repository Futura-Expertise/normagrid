# Chantier ERP — version locale (Flask + SQLite)

> **V3.13 — Base matériel : catalogue des câbles BT (import Excel).** Nouvelle catégorie **« Câbles BT (catalogue) »** : 2 917 câbles en 381 familles (export Caneco, fichier
> `01_Cables.xlsx`). On choisit d'abord une **famille** (avec un champ pour filtrer les noms), puis l'écran affiche ses câbles : section, section réduite, nombre de
> conducteurs, âme, isolant, températures, armé, enterrable, tension, diamètre, poids, pays, k thermique, R à 20 °C et à chaud, X. **La liste complète n'est jamais affichée.**
> Import Excel (feuille « Données », en-têtes en ligne 1) avec aperçu puis **Fusionner** (par `id_caneco`) ou **Remplacer**, en une seule transaction
> (`POST /api/etude-elec/cables/import`) ; lecture à la demande par `GET /api/etude-elec/cables/familles` et `/cables/famille?nom=…` (le catalogue n'est pas chargé en continu
> dans l'écran). Nouvelle table `etude_bt_cables` (étape `etudeCablesBtV313`, sans données de départ). La colonne `ref` n'est pas unique dans l'export : la clé est `id_caneco`.

> **V3.12 — Protections BT : catégories de protection.** Chaque ligne de disjoncteur reçoit une **catégorie** (colonne `categorie` de la feuille Disjoncteurs de l'import) :
> *Disj. Boîtier moulé* (ComPacT NSXm, NSX, NS), *Disj. Ouvert* (MasterPact), *Disjonct. C / B / D / K / Z* (disjoncteurs modulaires selon la courbe), *Disjonct. Mot* (TeSys GV
> thermique-magnétique), *Disjonct. +Th* (magnétique seul, avec relais thermique), *Fusible gG*. À l'écran, on choisit d'abord le **constructeur**, puis la **catégorie** :
> **la liste complète n'est jamais affichée** (pas de « Tous »). Les onglets Déclencheurs, Associations et Réglages se limitent aux gammes de la catégorie choisie ;
> l'onglet Constructeurs ne montre que les totaux. Colonne `categorie` obligatoire à l'import : les fichiers V3.11 doivent être remplacés par le fichier V3.12 (importer en
> « Fusionner » met à jour les lignes existantes). Étape `etudeMaterielCategorieV312` (colonne ajoutée automatiquement). 26 lignes de fusibles gG (2 à 1 250 A) ajoutées au fichier.

> **V3.11 — Base matériel : protections BT par constructeur (import Excel).** Nouvelle catégorie **« Protections BT (disjoncteurs et déclencheurs) »** dans
> Étude électrique > Base matériel, organisée **par constructeur** (Schneider Electric en premier, d'autres constructeurs ajoutables par le même fichier).
> Cinq onglets en consultation : **Disjoncteurs** (une ligne par gamme, variante / pouvoir de coupure, calibre et courbe : Icu, Icn, Ics, Im), **Déclencheurs**
> (famille, type, protections L / S / I / G / V), **Associations** (déclencheurs compatibles par gamme et plage de calibres), **Réglages** (crans de courant et de temps
> par déclencheur : long retard, court retard, instantané) et **Constructeurs**. Filtres constructeur / gamme et recherche. **Aucune donnée dans le code** : tout vient de
> l'**import Excel** (fichier à 5 feuilles Constructeurs, Disjoncteurs, Declencheurs, Associations, Reglages ; colonne `constructeur` sur chaque ligne). L'import affiche
> d'abord un aperçu (comptes, avertissements) puis **fusionne** (met à jour les lignes de même clé) ou **remplace** (par constructeur du fichier). Il est fait par le serveur
> en **une seule transaction** (`POST /api/etude-elec/protections/import`, droit « etude_elec » complet) : en cas d'erreur, rien n'est modifié.
> Nouvelles tables `etude_mat_constructeurs`, `etude_mat_disjoncteurs`, `etude_mat_declencheurs`, `etude_mat_assoc_decl`, `etude_mat_reglages` (étape `etudeMaterielProtectionsV311`,
> automatique, sans valeur de départ). Les valeurs du fichier Schneider fourni sont marquées « à vérifier catalogue » (pouvoirs de coupure « estimé » à confirmer).
> Hors périmètre : choix automatique de la protection dans le calcul du circuit (étape 10 du manuel de calcul BT).

> **V3.10 — Bilan de puissance : coefficient de réserve.** Chaque bloc (source normale et source secours) reçoit un champ **Coefficient de réserve** (défaut 1,
> par exemple 1,2 pour 20 % de marge) sous K.Foisonnement : Puissance totale (kW, kvar) = Total tableau × K.Foisonnement × coefficient de réserve ; le kVA, le cos φ
> et la réserve réelle du transformateur en tiennent compte. Pour un tableau alimentant un autre tableau (cascade), l'option **« Total repris par le tableau amont :
> avec / sans le coefficient de réserve »** évite d'appliquer la marge deux fois. Le « Récap puissance » (écran et Excel) gagne les colonnes
> « Coef. de réserve » et « S foisonnée avec réserve ». Les charges motrices (DOL) / normales restent hors coefficient. Export Excel : ligne
> « Coefficient de réserve » dans les deux blocs, formules mises à jour. Valeurs conservées dans le bilan du tableau (aucune nouvelle table).

> **V3.09 — Bilan de puissance : choix d'un transformateur dans la base matériel.** Dans la carte « Transformateur et réserve », une liste déroulante
> (groupée par niveau de tension) propose les transformateurs de « Base matériel ». Le choix renseigne la **Puissance Transfo (kVA)** : ONAF si elle existe,
> sinon ONAN (plus haute puissance, IEC 60076-1 art. 5.1.1). Le bouton **« Insérer les pertes calculées »** crée les lignes de pertes (P = P0 + ℓ²·Pk,
> Q = Q0 + ℓ²·Qk, ℓ = charge du tableau hors pertes / (n · puissance ONAN)) pour le **nombre de transformateurs** indiqué. La saisie manuelle reste possible ;
> le code du transformateur est exporté dans Excel. Aucune nouvelle table (le code est conservé dans le bilan du tableau).

> **V3.08 — Base matériel : transformateurs sans ventilation.** Nouvelle colonne **« ONAF applicable »** (OUI / NON, vide = OUI). Quand elle vaut NON
> (transformateurs de distribution MT/BT : pas de ventilateurs), la puissance ONAF et les courants ONAF sont **grisés** (« — ») et ne sont pas calculés ;
> même comportement dans l'export Excel. L'import accepte la colonne `ONAF_applicable`. Étape `etudeMaterielOnafV308` (colonne ajoutée automatiquement).
> Les données des petites puissances (100 à 3 150 kVA, 20 / 22 kV, 380 / 400 V) ne sont PAS dans le code : elles sont fournies dans un classeur Excel à importer.

> **V3.06 — Étude électrique > Base matériel.** Nouveau sous-menu : bases de données « matériel » **réutilisables d'un projet à l'autre**
> (non rattachées à un contrat). Première catégorie : **transformateurs HT/MT** (60/10 et 225/10 kV, 13 puissances chacun). Quatre onglets, comme le
> classeur Excel de départ : **Transformateurs** (saisies + colonnes calculées : ONAF, pertes estimées / retenues, courants, ur, ux, Z, pouvoir de
> court-circuit, tolérances), **Explications** (signification et principe de calcul de chaque colonne), **Paramètres** (rapport ONAF/ONAN, point d'ancrage
> des pertes, exposants, tolérances IEC) et **Sources** (documents, état de vérification, hypothèses). Tout est modifiable ; les valeurs du constructeur
> priment sur les estimations. **Export Excel** (4 feuilles, vraies formules) et **import Excel** (fusion ou remplacement).
> Nouvelles tables `etude_mat_transfos`, `etude_mat_params`, `etude_mat_sources` (étape `etudeMaterielV306`, automatique, valeurs de départ dans
> `backend/seed_materiel_transfos.json`). Explications : `backend/materiel_transfos_explications.json`.
> Pk, P0, uk et I0 de départ sont des **estimations d'avant-projet** à remplacer par les valeurs de l'ONEE ou du constructeur.

> **V3.05 — Étude électrique > Bilan de puissance.** Nouveau sous-menu : un bilan par tableau (Switchgear / MCC) + un « Récap puissance »,
> calculés depuis la base. Chaque bilan reprend la forme des feuilles du classeur de référence : en-tête (Affaire, Compte, Code doc., Révision, Date),
> liste des départs, bilan **source normale** et **source secours** (lignes E) avec K.Foisonnement, puissance du **transformateur** et réserve réelle,
> **pertes** des transformateurs (P/Q), répartition **charges motrices (DOL) / normales**. **Cascade automatique** : un départ qui alimente un autre
> tableau reprend la puissance totale de ce tableau. Export Excel : une feuille par tableau + récap + base, avec formules (renvois entre feuilles).
> Nouvelle table `etude_bilan_tableaux` (étape `etudeBilanV305`, automatique).

> **V3.04 — Étude électrique > Liste des consommateurs.** Nouveau sous-menu : document **généré depuis la base de données**
> (jamais saisi tag par tag), structuré comme la feuille « Liste des consommateurs » du modèle : une section par
> « Switchgear / MCC », **de l'amont vers l'aval** (un tableau alimenté par un départ d'un autre tableau suit celui-ci), chaque
> section listant les équipements alimentés depuis ce tableau. **Tous** les consommateurs apparaissent (les consommateurs sans
> tableau forment une dernière section). 18 colonnes dérivées de la base ; seuls l'en-tête (Affaire, Compte, Code doc., Révision,
> Date), le **Type câble** (liste gérable) et le **Commentaire** se saisissent. Export Excel : feuille « Liste des consommateurs »
> avec formules INDEX/EQUIV vers la feuille « Consumer List » (la base) du même classeur. Nouvelle table `etude_liste_documents`
> (étape de mise à niveau `etudeListeV304`, appliquée automatiquement). Le « Bilan de puissance » reste à faire.

> **V3.03 — module Étude électrique (Base de données).** Nouveau module `etude_electrique` (menu « Étude électrique > Base de données »,
> section de droits `etude_elec`) : base des consommateurs électriques rattachée à un **contrat ou à un devis**, 37 colonnes
> reprises du modèle « Liste des consommateurs » (Saisi / Liste / Formule). Colonnes Formule calculées comme dans Excel (valeur
> imposable à la main), colonnes Liste en listes déroulantes gérables, **import Excel avec correspondance des colonnes**, **export
> Excel avec les formules et les listes déroulantes**. Les sous-menus « Liste des consommateurs » et « Bilan de puissance » viendront ensuite.
> Correctif : la migration V2.x -> V3 ne refuse plus la base à cause des marqueurs d'étapes de mise à niveau.

> **V3.02 — livrables liés à un devis.** Le registre des livrables, les bordereaux d'envoi, le planning et le timesheet peuvent
> se rattacher à un **contrat** (marché gagné) **ou à un devis**. La codification se configure sur le devis (mêmes segments que
> le contrat) ; le compteur de numéros est celui du devis. Quand le contrat existe, le bouton « Rattacher au contrat » de l'écran
> Livrables déplace tout vers le contrat (livrables renumérotés à la suite, codes recalculés, numéros de bordereaux conservés).
> Un devis qui porte des éléments ne peut être ni supprimé ni renuméroté (bordereaux). Base V3.01 copiée automatiquement en V3.02,
> schéma mis à niveau (`backend/schema_upgrades.py`).

> **V3.01 — modules déclarés.** Un fichier de description par module dans `backend/module_defs/` (dépendances, menus, tables,
> collections, routes) ; `modules.py` les lit. Un module est inactif si un module dont il dépend l'est (cascade).
> Nouveau module **Planification** (planning + timesheet) avec ses propres sections de droits (`planification`, `timesheet`),
> identiques à celles de Livrables au départ. Contrôle de cohérence : `python3 scripts/verifier_modules.py`.
> Une base V3.00 présente dans le dossier de données est copiée automatiquement sous le nom V3.01 (l'ancienne reste intacte).

> **V3.00 — base relationnelle.** Les données sont maintenant dans de vraies tables SQL (57 tables, schéma dans
> `database/schema.sql`) au lieu de la table unique « documents ». Au premier démarrage, si une base V2.x
> (`chantier_erp_V*.db`) se trouve dans le dossier de données, elle est migrée automatiquement : sauvegarde intacte,
> vérification document par document, rapport dans Paramètres > Emplacement de la base. En cas d'écart,
> l'application refuse de démarrer (la base V2 n'est jamais modifiée). PostgreSQL n'est pas pris en charge en V3.00.
> Accès aux données : `backend/store.py` (routes génériques inchangées) ; moteur : `backend/sql_migration.py`,
> `backend/migration_v3.py`.


Application de gestion BTP (devis → contrat → attachement de
chantier → facture → règlement) pour tourner directement sur votre PC, avec
la même architecture technique que NormaGrid : **Flask + SQLite**, servie en
HTML/CSS/JS vanilla, et une **fenêtre native** via `pywebview` au lieu d'un
onglet de navigateur.

## Structure

```
chantier_erp_flask/
├── app.py                      # Point d'entree Flask (mode navigateur, port 5001)
├── desktop.py                  # Point d'entree "application de bureau" (fenetre native pywebview)
├── requirements.txt
├── database/
│   └── schema.sql              # DDL V3 : 57 tables relationnelles
├── data/
│   └── chantier_erp.db         # Base SQLite, creee automatiquement au premier lancement
├── backend/
│   ├── db.py                    # Connexion SQLite + initialisation du schema (+ amorçage Tiers bancaires)
│   ├── releve_parser.py          # Extraction PDF releve bancaire -> rapprochement TIERS (pdfplumber)
│   ├── facture_parser.py         # Extraction factures fournisseurs (texte PDF + OCR Tesseract si besoin)
│   └── routes/
│       ├── api.py               # Routes /api/... generiques (collections/documents)
│       ├── releve.py             # Routes /api/releve/parse (upload PDF) et /api/releve/export (telechargement .xlsx)
│       └── facture_fournisseur.py # Routes /api/facture-fournisseur/... (import multi-fichiers, finalisation/classement, annulation, acces au fichier)
├── static/
│   ├── css/style.css            # Habillage visuel (identique a l'application d'origine)
│   └── js/
│       ├── local-db.js          # Couche de stockage : reproduit l'API Firestore-like via l'API Flask
│       └── app.js               # Toute la logique metier et l'interface (quasi inchangee)
└── templates/
    └── index.html               # Page unique
```

## Lancer l'application

- **Windows** : double-cliquez sur `lancer_windows.bat`
- **Mac / Linux** : `./lancer_mac_linux.sh`

Ces scripts installent automatiquement les dépendances (`pip install -r
requirements.txt`) puis démarrent l'application dans une **fenêtre native**
(comme NormaGrid). Au premier lancement, un fichier `data/chantier_erp.db`
est créé automatiquement et l'écran de création du premier compte
administrateur s'affiche.

**Prérequis natifs pour la fenêtre pywebview** (installés automatiquement par
pip dans la plupart des cas) :
- Windows : runtime **Microsoft Edge WebView2** (déjà présent sur la plupart
  des Windows 10/11 récents ; sinon téléchargeable sur le site de Microsoft)
- Mac : `pyobjc` (installé automatiquement avec pywebview)
- Linux : bibliothèques système GTK+WebKit2 (`sudo apt install
  gir1.2-webkit2-4.1` ou équivalent) ou Qt (`pip install pywebview[qt]`)

Si la fenêtre native ne démarre pas (bibliothèque manquante), vous pouvez
toujours lancer le mode navigateur classique en secours :
```bash
python3 app.py
```
puis ouvrir manuellement `http://127.0.0.1:5001`.

## Partage sur un réseau local

Comme la version précédente, plusieurs postes du même bureau/chantier
peuvent accéder à la même base en pointant leur navigateur vers l'adresse IP
locale du PC hôte (mode `python3 app.py`, affiché au démarrage du serveur),
port `5001`. Le "temps réel" est simulé par un rafraîchissement automatique
toutes les 2 secondes.

## Stockage des données : modèle "document" dans SQLite

Contrairement à NormaGrid (un schéma relationnel avec une table par type
d'équipement), Chantier ERP réutilise ici son modèle de données d'origine —
document-oriented, façon Firestore (`collection('clients').add(...)`,
`doc('settings/company').update(...)`, etc.). Pour éviter de réécrire toute
l'interface (2000+ lignes de logique métier déjà testées : calculs de
totaux, numérotation automatique, avancement de chantier, statut des
factures, montants en lettres...), la base SQLite stocke une seule table
générique :

```sql
documents(collection TEXT, id TEXT, data TEXT /* JSON */, created_at, updated_at)
```

et `static/js/local-db.js` reproduit l'API `db.collection()/db.doc()`
attendue par `app.js` en parlant à l'API REST générique de Flask
(`backend/routes/api.py` : `GET/PUT/PATCH/DELETE /api/doc/<collection>/<id>`,
`GET /api/collection/<nom>`). Résultat : vraie persistance SQLite (fichier
unique, sauvegardable, interrogeable en SQL si besoin), sans rien changer à
la logique métier de l'application.

## Fonctionnement général

- **Devis** → peut être transformé en **Contrat** une fois accepté (V2.14 : la Commande client a été fusionnée dans le Contrat).
- **Contrat** (lignes, TVA, origine de l'engagement, réf. BC/contrat client, pièce jointe) → sert de base aux **Attachements** (situations de
  travaux successives, avec quantités antérieures/période/cumulées et calcul
  d'avancement).
- **Attachement validé** → peut être transformé en **Facture** (reprise des
  quantités de la période, calcul TVA et retenue de garantie).
- **Facture** → suivie par les **Règlements** (encaissements partiels ou
  totaux, statut Émise / Partielle / Réglée / En retard calculé
  automatiquement).
- Numérotation automatique par type de document et par année
  (`DEV-2026-0001`, `BC-2026-0001`, ...), préfixes configurables dans
  Paramètres.
- Impression de chaque document (devis, BC, attachement, facture) via
  l'impression navigateur, avec montant en lettres et bloc signatures.
- Sélection de profil (Administrateur / Commercial / Conducteur de travaux /
  Comptable) avec droits d'accès par section, et code PIN optionnel — une
  simple convivialité, **pas une authentification sécurisée** (identique à
  l'application d'origine).

## Module Relevés bancaires

Reprend le script `001_Conversion7.py` fourni par l'utilisateur (tkinter +
pdfplumber + pandas, fichier `001_Tiers.xlsx` externe), désormais intégré à
l'application :

- **Import** : dans *Relevés bancaires*, « Importer un relevé PDF » envoie le
  fichier au serveur Flask (`POST /api/releve/parse`), qui extrait les
  transactions (même expression régulière que le script d'origine) et les
  rapproche avec la liste de mots-clés **Tiers bancaires**.
- **Tiers bancaires** : liste de mots-clés éditable dans *Paramètres*
  (collection `tiersBancaires`), amorcée une seule fois au premier lancement
  avec le contenu de `001_Tiers.xlsx`. Le fichier Excel externe n'est plus
  jamais relu ensuite.
- **Lignes non reconnues (« INCONNU »)** : se corrigent directement dans le
  tableau de résultat (choix d'un tiers existant ou saisie d'un nouveau nom) ;
  à l'enregistrement, tout nouveau nom saisi est mémorisé dans Tiers
  bancaires pour être reconnu automatiquement sur les prochains relevés.
- **Rapprochement TVA automatique** : le montant de TVA contenu dans un
  montant TTC à 20 % (`montant / 6`) et les totaux Client/Fournisseur,
  calculés à la main dans Excel jusqu'ici, sont désormais automatiques dès
  qu'un tiers est marqué « Soumis à la TVA à 20 % ».
- **Case « Facture OK »** : pour une ligne au débit avec un tiers
  « Fournisseur », l'application propose un bouton « Associer… » qui ouvre le
  registre **Factures fournisseurs** (voir module ci-dessous) et suggère les
  factures les plus proches (nom du tiers + montant TTC — la date n'est pas
  comparée, le relevé ne portant que le jour et le mois, sans année). Une
  fois associée, la case affiche le numéro de la facture liée et peut être
  dissociée. S'il n'y a pas de facture correspondante (ou pour les lignes
  Client), la case à cocher manuelle d'origine reste disponible (« sans
  facture »).
- **Export** : « Exporter en Excel » (`POST /api/releve/export`) régénère un
  fichier `.xlsx` dans le même format que les fichiers produits manuellement
  jusqu'ici (12 colonnes + ligne de totaux), téléchargeable à tout moment,
  y compris depuis l'historique des relevés déjà enregistrés.

## Module Factures fournisseurs

Registre des factures fournisseurs, alimenté par **sélection directe d'un ou
plusieurs fichiers dans leur forme d'origine** (PDF ou photos/scans
JPG/PNG — plus besoin de les compresser en .zip au préalable), avec
reconnaissance automatique des champs assistée par OCR, classement
automatique des documents d'origine sur le disque, et utilisé pour
automatiser le rapprochement bancaire décrit ci-dessus.

- **Registre Fournisseurs = Tiers bancaires** : plutôt qu'un second
  registre séparé, la liste des fournisseurs est **fusionnée avec celle des
  Tiers bancaires** : une même fiche sert à la fois au rapprochement des
  relevés (mot-clé, type, TVA) et de fiche fournisseur pour ce module
  (raison sociale, ICE, identifiant fiscal, RC, patente, adresse, ville,
  téléphone, email, contact, notes — tous facultatifs). Ce registre se gère
  à deux endroits équivalents (les deux lisent/écrivent les mêmes fiches) :
  un menu principal **« Fournisseurs »**, à l'instar de « Clients »
  (ajouter/modifier/supprimer, limité aux fiches de type « Fournisseur »),
  et *Paramètres > Tiers bancaires / Fournisseurs* (toutes les fiches, y
  compris les mots-clés non-fournisseurs utilisés pour les relevés
  bancaires — salarié, impôts, frais bancaires...).
- **Plusieurs factures dans un même fichier** : un fichier PDF importé peut
  regrouper **plusieurs factures distinctes** (ex. un récapitulatif mensuel
  d'un fournisseur, une page par facture). L'import détecte automatiquement
  ce cas : une page démarre une **nouvelle** facture seulement si elle porte
  à la fois son propre numéro de facture ET ses propres montants, ET que ce
  numéro diffère de celui de la facture en cours (une page de suite d'une
  facture multi-pages répète en général le même numéro, ce n'est pas une
  nouvelle facture). Chaque facture ainsi détectée devient sa **propre ligne**
  sur l'écran de relecture et son **propre fichier PDF** (découpé à partir de
  l'original), classé/renommé indépendamment des autres à l'enregistrement.
  Un fichier ne contenant qu'une seule facture (le cas normal, de très loin
  le plus fréquent) n'est jamais re-découpé : ses octets d'origine restent
  inchangés.
- **Import** : dans *Factures fournisseurs*, « Importer des fichiers »
  ouvre un sélecteur multi-fichiers natif et envoie les fichiers choisis au
  serveur (`POST /api/facture-fournisseur/import-files`), qui tente
  d'extraire pour chacun numéro de facture, date, montants HT/TVA/TTC et
  devise par repérage de mots-clés, ainsi qu'une suggestion de fournisseur et
  d'ICE (déduites du contenu du document, en excluant automatiquement votre
  propre société et son ICE). Sur l'écran de relecture, un menu déroulant
  « Fournisseur » propose de choisir une fiche existante — **limité aux
  fiches de type « Fournisseur »** (les mots-clés non-fournisseurs du
  registre partagé, type « Salarié », « Projet », « Compte courant »...,
  n'y apparaissent jamais, pas plus qu'ils ne sont proposés comme
  suggestion automatique) ; **si aucune fiche
  ne correspond, un bouton « + Ajouter ce fournisseur »** apparaît sous le
  menu (en plus de l'option « + Nouveau fournisseur… » du menu lui-même) et
  ouvre directement le formulaire de création, pré-rempli avec le nom et
  l'ICE relevés sur la facture — à vérifier/compléter avant d'enregistrer,
  sans quitter l'import. Fournisseur et date sont obligatoires pour chaque
  ligne cochée avant de pouvoir enregistrer.
- **Classement et renommage automatiques** : à l'enregistrement, chaque
  fichier d'origine est déplacé et renommé sous
  `data/factures_fournisseurs/<année>/<mois>/AAAA_MM_JJ_NomFournisseur_Numéro.ext`
  (`POST /api/facture-fournisseur/finalize-file`), pour rester classé et
  retrouvable facilement sur le disque indépendamment de l'application.
- **Modification possible après enregistrement** : un bouton « Modifier »
  dans l'historique permet de corriger fournisseur, numéro, date ou
  montants d'une facture déjà enregistrée ; si fournisseur/date/numéro
  changent, le fichier d'origine est automatiquement re-déplacé/renommé pour
  rester cohérent avec le classement par année/mois.
- **OCR (Tesseract)** : les factures sans texte natif détectable (scans,
  photos — environ 4 sur 10 dans les échantillons réels testés) sont
  converties en image et passées à l'OCR. Cela nécessite d'installer
  séparément le programme **Tesseract OCR** (le paquet Python `pytesseract`
  n'est qu'un connecteur, il ne fonctionne pas seul) :
  - **Windows** : télécharger l'installeur **UB Mannheim**
    (`https://github.com/UB-Mannheim/tesseract/wiki`), et **cocher la langue
    « French »** dans les options d'installation. Si l'application ne
    détecte pas automatiquement le programme après l'installation, vérifier
    qu'il se trouve à `C:\Program Files\Tesseract-OCR\tesseract.exe` (chemin
    par défaut déjà prévu par l'application) ou l'ajouter au `PATH` système.
  - **Mac** : `brew install tesseract tesseract-lang`
  - **Linux** : `sudo apt install tesseract-ocr tesseract-ocr-fra`
  - Si Tesseract n'est pas installé, l'import fonctionne quand même pour les
    PDF à texte natif ; les scans/photos restent simplement à saisir à la
    main (un message prévient l'utilisateur dans ce cas).
- **Vérification obligatoire avant enregistrement** : chaque facture ayant sa
  propre mise en page, l'extraction automatique est une **aide à la saisie,
  pas une garantie** — l'écran de relecture affiche chaque fichier détecté
  (avec lien pour l'ouvrir) et permet de corriger fournisseur/numéro/date/
  montants/devise, ou de décocher les fichiers qui ne sont pas des factures,
  avant de cliquer « Enregistrer les factures cochées ». Les heuristiques de
  reconnaissance des montants (HT/TVA/TTC) et de la date couvrent plusieurs
  mises en page courantes (libellés sur la même ligne que le montant,
  tableaux à en-tête/valeurs sur deux lignes, libellés et montants empilés
  chacun sur leur propre ligne, taux affiché avant le libellé « TVA »,
  dates avec mois abrégé type « 27/Jul/26 »...) ; plus une facture a de
  texte reconnaissable (PDF natif plutôt que photo/scan de mauvaise
  qualité), plus la reconnaissance est fiable.
- **Modèle de zones par fournisseur (apprentissage visuel)** : pour un
  fournisseur dont la mise en page de facture pose problème aux
  heuristiques génériques, un éditeur graphique permet de **dessiner un
  rectangle** sur un exemplaire de sa facture pour chaque champ à retrouver
  (n° de facture, date, HT, TVA, TTC, devise, ICE). Ce modèle est enregistré
  **sur la fiche du fournisseur** (champ `modeleZones`) et appliqué
  **automatiquement** à toute future facture importée que l'application
  reconnaît comme venant de ce même fournisseur — aucune action
  supplémentaire requise à l'import une fois le modèle défini. Un champ dont
  la zone ne donne rien (zone vide, facture dont la mise en page a changé)
  **retombe sur la reconnaissance heuristique habituelle** pour ce champ
  uniquement, le reste du modèle restant appliqué. Limites de cette première
  version : uniquement pour les **PDF à texte natif** (pas les scans/photos,
  qui continuent d'utiliser l'OCR générique), une seule zone par champ (la
  plus récente remplace l'ancienne), et le fournisseur doit déjà être
  reconnu (automatiquement ou choisi manuellement) sur la ligne pour que le
  bouton apparaisse. Accès : bouton **« Définir/Modifier un modèle de
  zones »** sous le sélecteur de fournisseur, sur l'écran de relecture
  d'import (visible dès qu'un fournisseur PDF est choisi sur la ligne) ; une
  pastille **« Modèle appliqué »** indique, après import, qu'une ligne a
  bénéficié de son modèle. Accès direct supplémentaire : si le fournisseur
  n'existe pas encore dans la base, la fenêtre de création (bouton « +
  Ajouter » / « + Nouveau fournisseur… ») propose aussi un bouton
  **« Enregistrer et définir un modèle de zones »**, qui enregistre la
  fiche puis ouvre directement l'éditeur sur la facture en cours d'import —
  sans avoir à fermer la fenêtre d'abord.
- **Consulter un modèle de zones depuis la fiche fournisseur** : pour
  revoir à tout moment (hors import) les zones définies pour un
  fournisseur, le menu **« Fournisseurs »** affiche une icône règle
  **« Consulter le modèle de zones »** sur chaque ligne dont la fiche
  possède un `modeleZones` ; un clic ouvre le même éditeur graphique,
  pré-chargé avec l'aperçu de sa facture déjà enregistrée la plus récente
  (y compris une facture classée depuis longtemps, pas seulement celles en
  cours d'import) et les zones existantes dessinées dessus, pour les
  consulter ou les corriger. Si le modèle existe mais qu'aucune facture de
  ce fournisseur n'a encore été enregistrée (aperçu indisponible), un
  message l'indique à la place d'ouvrir une fenêtre vide.
- **Annulation** : « Annuler l'import » supprime du disque les fichiers en
  attente non encore enregistrés (`POST /api/facture-fournisseur/cancel-batch`)
  sans rien enregistrer dans le registre.
- **Rapprochement bancaire** : une fois enregistrées, les factures du
  registre sont proposées automatiquement en face des lignes « Fournisseur »
  des relevés bancaires (voir ci-dessus).
- **Mise à niveau automatique des anciennes données** : les factures déjà
  enregistrées avec l'ancien schéma (lot .zip, fournisseur en texte libre)
  sont automatiquement migrées vers le nouveau schéma (fiche fournisseur +
  classement année/mois) au premier démarrage suivant la mise à jour ; cette
  migration est silencieuse, sans action requise.
- **Répertoire de stockage configurable** (*Paramètres > Stockage des
  factures fournisseurs*) : par défaut, les fichiers d'origine des factures
  (dossier d'attente `_pending` + classement `<année>/<mois>/`) sont
  enregistrés sous `data/factures_fournisseurs/` de l'installation de
  l'application ; un autre répertoire peut être indiqué (par exemple un
  disque ou un partage réseau commun à plusieurs postes). Changer ce réglage
  **déplace automatiquement** tout le contenu déjà présent dans l'ancien
  répertoire vers le nouveau (rien n'est perdu, aucune facture déjà
  enregistrée ne devient introuvable) ; le nouveau répertoire est créé s'il
  n'existe pas encore, et sa capacité d'écriture est vérifiée avant tout
  déplacement. Pris en compte immédiatement, sans redémarrage. Les
  **modèles de zones**, eux, restent toujours enregistrés dans la base de
  données (sur la fiche de chaque fournisseur) : ce réglage ne concerne que
  les fichiers de factures eux-mêmes, pas les modèles.
- **Export / import des modèles de zones** (*Paramètres > Modèles de
  zones*) : un bouton **« Exporter les modèles de zones »** télécharge un
  fichier `.json` unique reprenant tous les modèles déjà dessinés (un par
  fournisseur — uniquement ceux qui en ont au moins un) ; **« Importer les
  modèles de zones »** permet de recharger un tel fichier, par exemple pour
  transférer les modèles déjà calibrés vers une autre installation de
  l'application, ou en conserver une sauvegarde. Format volontairement
  technique (JSON, structure identique à celle enregistrée en base) plutôt
  qu'Excel : un modèle de zones n'est pas une donnée destinée à être lue ou
  modifiée à la main dans un tableur. À l'import, chaque modèle est
  rattaché à une fiche fournisseur existante par ICE, puis par nom si
  l'ICE est vide ou absent ; **le modèle importé remplace celui déjà
  enregistré** pour ce fournisseur le cas échéant (une confirmation est
  demandée avant tout import, car ce remplacement est irréversible). Aucune
  fiche fournisseur n'est créée à partir de ce fichier : un fournisseur du
  fichier introuvable dans le registre est simplement signalé dans le
  résultat de l'import (nom listé), sans rien enregistrer pour lui.

## Export / import Excel (Clients et Fournisseurs)

Les registres **Clients** et **Fournisseurs** proposent chacun, dans leur
menu principal, deux boutons **« Exporter Excel »** et **« Importer
Excel »** (fichiers `.xlsx`, lus et générés côté serveur via `openpyxl`) :

- **Export** : télécharge un classeur `.xlsx` avec une ligne d'en-tête et
  une ligne par fiche existante (raison sociale, ICE, identifiant fiscal,
  RC, patente, adresse, ville, téléphone, email, contact, notes) —
  uniquement les champs « fiche » ; les champs techniques propres au
  rapprochement bancaire des fournisseurs (mot-clé, type, TVA) n'y figurent
  jamais.
- **Import** : après sélection du fichier `.xlsx`, un écran de
  correspondance de colonnes (avec détection automatique et aperçu) permet
  de vérifier/corriger le mappage avant tout enregistrement — même principe
  que l'ancien import CSV des clients, désormais généralisé à l'Excel et
  étendu aux fournisseurs. **Une ligne dont le nom ou l'ICE correspond déjà
  à une fiche existante met à jour cette fiche plutôt que d'en créer une
  nouvelle** (correspondance par ICE, sinon par nom) : un cycle export →
  correction dans Excel → réimport permet donc une mise à jour en masse sans
  jamais créer de doublon. Une fiche fournisseur nouvellement créée par cet
  import reçoit les mêmes valeurs par défaut que le formulaire habituel
  (type « Fournisseur », TVA 20 %, mot-clé = nom) ; une fiche fournisseur
  mise à jour garde ces champs techniques inchangés, qu'ils aient ou non une
  colonne dans le fichier importé.

## Amélioration V1.27 : correctifs de fiabilité sur la reconnaissance des montants/devise

Trois correctifs ciblés dans `backend/facture_parser.py`, trouvés en
analysant des factures réelles signalées par l'utilisateur comme mal
reconnues (BRICO, Microsoft, MARJANE, LOGAMINE) :

- **TVA confondue avec le TTC sur une ligne de « ventilation TVA »** (ex.
  `"TVA A 20% 20,00 % 44,1667 8,8333 53,00"`) : cette ligne contient à la
  fois un libellé générique (« TVA A 20% ») ET plusieurs montants (taux,
  HT, TVA, TTC) ; l'ancien repli générique y lisait à tort le DERNIER
  montant de la ligne (le TTC) comme étant la TVA. Corrigé en donnant
  priorité à la vérification HT+TVA=TTC déjà existante sur ce type de
  ligne, plus fiable qu'une simple proximité de libellé.
- **Montants imprimés avant leurs libellés, chacun sur sa propre ligne**
  (ex. `"3333.33 DH"` / `"666.67 DH"` / `"4000.00 DH TTC"` suivis, plus
  loin, de `"TOTAL Hors Taxe"` / `"TVA à 20%"` / `"TOTAL"`) : aucun repli
  existant ne couvrait cet ordre inversé (valeurs avant libellés). Nouveau
  repli dédié, qui reste un dernier recours (vérification HT+TVA=TTC
  identique aux autres replis de dernier recours).
- **Devise EUR détectée à tort sur un symbole « € » isolé, artefact d'OCR**
  sur un document par ailleurs clairement marocain (ICE/RC/Patente/CNSS,
  montant en toutes lettres en DH) : le symbole seul n'est plus retenu que
  s'il est directement accolé à un montant plausible (`"€ 123,45"` ou
  `"123,45 €"`) ; le mot entier `"EUR"` reste détecté normalement.

Revalidé sur l'ensemble des 76 fichiers réels déjà utilisés pour ce module
(aucune régression, taux de champs manquants strictement meilleur ou
identique à la V1.25/V1.26 pour HT/TVA/TTC, inchangé pour les autres
champs) et sur plusieurs cas déjà validés individuellement par le passé
(Electro Bousfiha, GG 018-2026, Mecanicien) pour confirmer qu'aucune valeur
auparavant correcte n'a changé.

**Limite non corrigée, pour information** : sur certains scans de très
mauvaise qualité (ex. une des factures BRICO), le numéro de facture n'est
simplement pas lisible dans le texte reconnu par l'OCR (aucune suite de
caractères plausible) — l'application retombe alors sur le nom du fichier
importé comme numéro provisoire, à corriger manuellement sur l'écran de
relecture. Ce n'est pas un défaut de l'heuristique mais une limite de la
qualité du scan/de l'OCR lui-même ; l'écran de relecture reste donc
obligatoire avant tout enregistrement, quelle que soit la qualité du
document.

## Amélioration V1.28 : factures à plusieurs taux de TVA et numéro confondu avec la date

Signalé par l'utilisateur sur deux nouvelles factures MARJANE (toujours mal
reconnues malgré la V1.27), avec le même modèle de zones que celui déjà
utilisé pour BRICO/Microsoft/MARJANE/LOGAMINE. Deux nouveaux correctifs
dans `backend/facture_parser.py` :

- **Facture à PLUSIEURS taux de TVA (vente à taux mixtes, ex. 20 % et
  10 % sur la même facture)** : le tableau « Ventilation des TVA » comporte
  alors une ligne par taux, chacune ne portant que le sous-total de SON
  taux. L'ancien repli prenait naïvement la PREMIÈRE ligne de taux
  rencontrée comme s'il s'agissait du total de la facture (ex. MARJANE,
  une ligne à 20 % lue seule donnait TVA = 94,25 / HT = 12,30 au lieu du
  vrai total HT = 89,72 / TVA = 16,83). Corrigé en donnant la priorité,
  dans l'ordre : (1) à une ligne « TOTAL » du tableau de ventilation
  elle-même cohérente HT+TVA=TTC (le vrai total, quand l'OCR l'a
  correctement lue) ; (2) à défaut, à la SOMME de toutes les lignes de
  taux individuellement cohérentes, pour couvrir le cas où la ligne TOTAL
  est absente ou illisible à l'OCR (ex. deuxième facture MARJANE, où un
  des montants de la ligne à 10 % avait perdu sa virgule décimale à l'OCR
  — repli supplémentaire qui réinterprète ce nombre « nu » en centimes,
  seulement s'il retombe juste sur HT+TVA de sa propre ligne) ; (3) à
  défaut, le comportement d'origine (une seule ligne de taux exploitable,
  cas le plus fréquent d'un taux unique).
- **Numéro de facture confondu avec la date, quand le libellé français
  utilise l'article** : la ligne « Date de la facture : 12-04-2026 »
  contient elle aussi le mot « facture », et le garde-fou censé l'exclure
  (déjà présent de longue date) ne reconnaissait que « Date de facture »
  ou « Date facture », sans l'article « la ». Résultat : le numéro
  affiché était la date (`"12-04-2026"`) au lieu du vrai numéro
  (`"157/12-04-2026/006/73444"`), trouvé juste après mais jamais atteint
  puisque la fonction s'arrêtait dès la première ligne. Corrigé en
  généralisant ce garde-fou (regex tolérant l'article « la »/« du » entre
  « date » et « de »).

Revalidé sur les deux factures signalées (désormais entièrement correctes :
numéro, HT, TVA, TTC) et sur l'ensemble des 76 fichiers réels déjà utilisés
pour ce module (aucune régression ; taux de champs manquants strictement
meilleur ou identique à la V1.27 pour HT/TVA, inchangé pour les autres
champs), ainsi que sur les cas déjà validés individuellement par le passé
(BRICO, Microsoft, LOGAMINE, Electro Bousfiha, GG 018-2026, Mecanicien)
pour confirmer qu'aucune valeur auparavant correcte n'a changé.

**Rappel sur les modèles de zones et les factures scannées** : les deux
factures MARJANE signalées ici sont des scans/photos (reconnaissance par
OCR), pas des PDF à texte natif. Les modèles de zones (dessiner une zone
sur une facture pour en extraire un champ, module Paramètres) ne
s'appliquent, par conception depuis la V1.22, qu'aux PDF à texte natif —
jamais à une facture scannée. Sur ce type de facture, c'est donc bien la
reconnaissance automatique générale (corrigée ci-dessus) qui s'applique,
et non le modèle de zones éventuellement enregistré pour ce fournisseur.

## Amélioration V1.29 : traitement direct d'un dossier de factures à traiter

Nouveau mode d'alimentation du module Factures fournisseurs, en complément
(pas en remplacement) de l'import classique par sélection de fichiers dans
le navigateur :

- **Paramètres > « Factures fournisseurs à traiter »** : nouveau champ pour
  indiquer un répertoire du serveur (ex. la sortie d'un scanner réseau) où
  sont déposées les factures en attente de reconnaissance. Distinct du
  répertoire de **stockage** déjà existant (qui reste la destination où les
  factures validées sont classées par année/mois) ; vide par défaut, tant
  qu'il n'est pas configuré le nouveau bouton reste visible mais inactif
  (message explicite au clic).
- **Bouton « Traitement »**, sur l'écran Factures fournisseurs, à côté du
  bouton « Importer des fichiers » habituel — **qui reste disponible et
  inchangé**. « Traitement » lit directement les fichiers déjà présents à
  la racine du dossier configuré (pas les sous-dossiers), sans passer par
  le sélecteur de fichiers du navigateur, et les fait passer par le même
  écran de relecture (reconnaissance, modèle de zones, décision
  fournisseur/date) que l'import classique.
- **Suppression du fichier source après validation** : une fois qu'une
  facture issue de ce dossier est enregistrée, son fichier d'origine est
  d'abord classé normalement dans le répertoire de stockage (comme pour un
  import classique), PUIS supprimé du dossier « à traiter » — pour que ce
  dossier ne contienne, au fil du temps, que les factures pas encore
  traitées. Pour un fichier PDF regroupant plusieurs factures (découpage
  multi-factures), la suppression n'intervient que lorsque TOUTES les
  factures qu'il contient ont été validées ; si l'une d'elles est
  volontairement décochée (« ne pas garder »), le fichier reste dans le
  dossier source, pour ne jamais perdre une facture laissée de côté sans
  décision explicite.

Validé par des tests automatisés dédiés : traitement d'un dossier contenant
plusieurs fichiers (suppression des deux après validation, classement
inchangé dans le répertoire de stockage), et cas d'un fichier
multi-factures avec une facture décochée (fichier source conservé, les
autres factures bien enregistrées) — ainsi que par l'ensemble de la suite
de régression existante (import classique par sélecteur de fichiers,
modèles de zones, export/import Excel, changement de répertoire de
stockage), pour confirmer qu'aucun comportement existant n'a été modifié.

## Ajout V1.30 : unicité des fournisseurs et des factures fournisseurs

Demande explicite : « un fournisseur doit être unique et une facture de
même ». Jusqu'ici, ni la création d'un fournisseur ni l'enregistrement
d'une facture fournisseur ne vérifiaient l'existence d'un doublon — risque
réel maintenant que les mêmes factures peuvent arriver à la fois par
« Importer » et par le nouveau bouton « Traitement » (V1.29).

- **Fournisseur unique** : à la création ou à la modification d'un
  fournisseur (bouton « Nouveau fournisseur », création à la volée pendant
  la validation d'une facture importée, ou édition d'une fiche existante),
  le nom est comparé à ceux des fournisseurs déjà enregistrés en ignorant
  la casse et les accents (« Marjane Market » = « MARJANE MARKET » =
  « Marjané  Market »). En cas de doublon, l'enregistrement est refusé avec
  un message explicite nommant le fournisseur existant ; la fenêtre reste
  ouverte pour corriger. Seules les fiches de type « Fournisseur » sont
  comparées entre elles (une fiche « Client » homonyme, utilisée pour le
  rapprochement des relevés bancaires, n'est pas concernée).
- **Facture fournisseur unique** : la clé retenue est « même fournisseur +
  même numéro de facture » (numéro comparé sans tenir compte de la casse ni
  des espaces superflus ; un numéro vide n'est jamais considéré comme un
  doublon, faute de signification). Vérifié :
  - à l'enregistrement d'un lot (bouton « Enregistrer les factures
    cochées ») : chaque ligne est comparée à la fois aux factures déjà
    enregistrées et aux autres lignes du même lot. Seules les lignes en
    double sont écartées (avec un message les listant par nom de fichier
    et numéro) ; **les lignes qui ne sont pas en double s'enregistrent
    normalement**, comme demandé. Pour un fichier provenant du dossier «
    à traiter » (V1.29), le fichier source n'est supprimé que si TOUTES ses
    factures ont réellement été enregistrées avec succès (une ligne écartée
    pour doublon est traitée comme une ligne non validée : le fichier
    source est conservé, exactement comme pour une ligne volontairement
    décochée) ;
  - à la modification d'une facture déjà enregistrée (bouton « Modifier ») :
    le nouveau numéro est comparé aux autres factures du même fournisseur,
    en excluant la facture en cours de modification elle-même (on peut donc
    la réenregistrer sans changer son numéro, ou changer n'importe quel
    autre champ, sans déclencher de faux positif).
- **Doublons déjà présents avant ce contrôle** : comme ce contrôle ne peut
  agir que sur les nouvelles saisies, un bandeau d'avertissement liste
  désormais automatiquement, sur l'écran Fournisseurs et sur l'écran
  Factures fournisseurs, les doublons déjà existants dans les données (le
  cas échéant), avec une indication de ce qu'il reste à faire (fusionner
  les fiches fournisseurs en double, ou vérifier/supprimer les factures en
  double) — la décision de fusion/suppression reste manuelle, aucune donnée
  n'est modifiée ou supprimée automatiquement.

Validé par des tests automatisés dédiés (création de fournisseur en
double bloquée, lot de factures avec une ligne en double bloquée et les
autres enregistrées normalement, vérification en base qu'aucun doublon
n'est créé, modification d'une facture vers un numéro déjà pris bloquée
avec exclusion correcte d'elle-même, bandeaux de doublons pré-existants
affichés avec des données injectées directement en base) et par la suite
de régression existante (import classique, dossier « à traiter » — y
compris le cas d'un fichier multi-factures partiellement décoché —,
fournisseurs, tiers bancaires), pour confirmer qu'aucun comportement
existant n'a été modifié.

## Ajout V1.31 : registre du Personnel

Demande explicite : « ajouter la possibilité d'ajouter / modifier /
supprimer le personnel de la société ». Nouveau menu **Personnel**, qui
tient un registre des employés de l'entreprise, construit sur le même
modèle que Clients/Fournisseurs (liste avec recherche, fiche en modale,
suppression physique avec confirmation).

- **Un registre indépendant.** Le Personnel n'est ni les « Tiers
  bancaires » (qui servent au rapprochement des relevés et à la liste des
  fournisseurs), ni les « Utilisateurs » (comptes qui se connectent à
  l'application). Un membre du personnel n'a par défaut **aucun accès à
  l'application** — c'est un simple répertoire RH, sans lien avec un
  chantier pour l'instant.
- **Champs de la fiche** : nom complet (obligatoire), fonction/poste, CIN,
  statut actif/inactif, téléphone, email, adresse, date d'embauche, type
  de contrat (CDI, CDD, Intérim, Journalier, Autre), salaire mensuel et
  notes libres.
- **Accès restreint** : contrairement à Clients/Fournisseurs, ce menu
  n'est visible que par l'**Administrateur** et le **Comptable** (lecture
  et écriture complètes) — masqué pour les rôles Commercial et Chantier —
  car la fiche contient une donnée sensible (le salaire).
- **Suppression** : suppression physique après confirmation, comme pour
  les clients/fournisseurs/utilisateurs (il n'y a pas de notion
  d'annulation CDC applicable au personnel).

Validé par des tests automatisés dédiés (création d'une fiche complète,
recherche par nom/fonction/CIN, modification, vérification en base que
tous les champs — y compris salaire, date d'embauche, type de contrat —
sont bien persistés, suppression avec confirmation) et par la suite de
régression existante (fournisseurs, tiers bancaires, bandeaux de doublons
V1.30, import/traitement des factures fournisseurs), pour confirmer
qu'aucun comportement existant n'a été modifié. Un test dédié confirme
également que le menu Personnel est bien masqué pour un rôle Commercial
et bien accessible en écriture complète pour un rôle Comptable.

## Ajout V1.32 : plan comptable et écritures comptables automatiques (comptabilité marocaine, étape 1)

Demande explicite : « intégrer la compta marocaine ». Après clarification
avec l'utilisateur, le périmètre retenu pour cette première étape est un
**outil de pré-comptabilité interne** — organiser les données déjà
présentes dans l'ERP selon les normes marocaines pour faciliter le travail
du comptable/de la fiduciaire — et **non** une comptabilité légale au sens
du Code de Commerce ni un remplacement des télédéclarations officielles
(TVA, IS) sur le portail de la DGI.

- **Plan comptable** (nouveau menu « Plan comptable », Administrateur et
  Comptable uniquement) : sous-ensemble du Code Général de Normalisation
  Comptable (CGNC) marocain adapté au BTP (~30 comptes : clients,
  fournisseurs, TVA facturée/récupérable, banque, caisse, achats/ventes,
  charges de personnel...), amorcé automatiquement au premier démarrage et
  entièrement modifiable ensuite (ajout/modification/suppression, avec
  unicité du code vérifiée comme pour les fournisseurs/factures en V1.30).
- **Écritures comptables automatiques** (nouveau menu « Journal
  comptable ») : chaque facture client validée, avoir validé, encaissement
  et facture fournisseur enregistrés génère automatiquement une écriture
  en partie double (débit = crédit), tracée vers son document source —
  sans aucune ressaisie. Les écritures sont en lecture seule (pas de saisie
  manuelle dans cette version) et ne sont jamais modifiées ni supprimées :
  l'annulation d'un document déjà comptabilisé génère une **contre-écriture**
  (lignes inversées), jamais une suppression — même principe que le reste
  de l'application (RG-004/005).
- **Garde-fous** : une facture fournisseur dont les montants HT/TVA/TTC
  sont manquants ou incohérents (HT + TVA ≠ TTC, au-delà d'une tolérance
  de 0,5 pour les écarts d'arrondi/OCR) ne génère pas d'écriture — elle est
  signalée dans un bandeau d'avertissement sur le Journal comptable, à
  corriger puis régénérer.
- **Génération rétroactive à la demande** : un bouton « Générer les
  écritures manquantes » sur le Journal comptable permet de comptabiliser
  les documents déjà validés/enregistrés avant l'arrivée de ce module
  (jamais déclenché automatiquement).
- **Limite assumée pour cette version** : si un avoir déjà validé est
  modifié par la suite (l'application ne verrouille pas les avoirs comme
  elle verrouille les factures), son écriture n'est pas resynchronisée
  automatiquement — en cas de correction nécessaire après validation,
  annuler puis recréer l'avoir. Le règlement des factures fournisseurs
  (paiement au fournisseur) n'est pas encore suivi par l'application et ne
  génère donc pas d'écriture de trésorerie côté achats ; seul
  l'enregistrement de la facture fournisseur (achat) est comptabilisé.

Les étapes suivantes envisagées (grand livre, balance générale, aide au
calcul de la déclaration de TVA, paie, bilan/CPC) ont été volontairement
reportées à une prochaine version, à la demande explicite de l'utilisateur
qui a choisi de livrer cette étape 1 seule dans un premier temps.

Validé par des tests automatisés dédiés (unicité du code compte, équilibre
débit/crédit systématique des écritures générées, génération à la
validation d'une facture/d'un avoir/à l'enregistrement d'un encaissement et
d'une facture fournisseur à montants cohérents, non-génération si montants
manquants/incohérents, contre-écriture correcte à l'annulation avec lignes
bien inversées, garde anti-doublon même en cas de double-déclenchement
rapproché, génération rétroactive via le bouton dédié, accès restreint à
Administrateur/Comptable) et par la suite de régression existante
(personnel, fournisseurs, tiers bancaires, dédoublonnage V1.30, factures
fournisseurs), pour confirmer qu'aucun comportement existant n'a été
modifié.

## Ajout V1.33 : règlements fournisseurs et intégration des relevés bancaires à la comptabilité

Fait suite à une question de l'utilisateur (« est-ce que l'import des
relevés bancaires a été intégré au plan comptable ? ») : la réponse était
non — l'association d'une ligne de relevé à une facture (bouton
« Associer… ») était purement visuelle, sans aucune génération de document
ni d'écriture. Ce module corrige ce point dans les deux sens (fournisseurs
et clients), avec l'accord explicite de l'utilisateur, et lève la limite
signalée en V1.32 sur le suivi des règlements fournisseurs.

- **Suivi des règlements fournisseurs** : chaque facture fournisseur
  affiche désormais un statut (Non payée / Partielle / Payée) et un bouton
  « Régler » ouvrant l'historique des règlements avec ajout (date,
  montant, mode, référence) et suppression. Les paiements partiels sont
  possibles (plusieurs règlements sur une même facture). *Choix de
  conception* : l'utilisateur a demandé à la fois « un statut simple
  payée/non payée sur la facture » et « la possibilité de paiements
  partiels » — deux réponses qui semblaient a priori contradictoires dans
  la question posée. La solution retenue, pour satisfaire les deux à la
  fois : les règlements sont stockés dans un tableau directement sur la
  fiche de la facture fournisseur (pas de registre séparé), et le statut
  affiché reste une simple étiquette calculée à partir de ce tableau. Ce
  choix n'a pas été revalidé explicitement avec l'utilisateur après coup ;
  à ajuster sur simple demande si ce n'est pas ce qui était attendu.
- **Écriture comptable à chaque règlement** : un règlement fournisseur
  génère une écriture (débit 4411 Fournisseurs / crédit 5141 Banque ou
  5161 Caisse selon le mode) ; la suppression d'un règlement génère une
  contre-écriture (jamais de suppression d'écriture), au même principe que
  le reste du module Comptabilité.
- **Relevé bancaire → règlement/encaissement automatique** : lorsqu'une
  ligne de relevé est associée à une facture (fournisseur ou, nouveauté,
  également côté client via un nouveau bouton « Associer à une facture
  client ») et que le relevé est enregistré, l'application crée
  automatiquement le règlement fournisseur ou l'encaissement client
  correspondant, et son écriture comptable — sans ressaisie. Une
  protection empêche la création en double si le même relevé est rouvert
  et réenregistré.
- **L'association reste optionnelle**, comme demandé explicitement : une
  ligne de relevé peut rester « sans facture » et le relevé s'enregistre
  normalement ; seules les lignes associées déclenchent un règlement ou un
  encaissement.

Validé par des tests automatisés dédiés (paiement partiel puis solde,
écritures équilibrées sur le bon journal/comptes, suppression d'un
règlement avec contre-écriture et retour du statut à « Partielle »,
génération automatique du règlement fournisseur et de l'encaissement
client depuis un relevé, absence de doublon en cas de réenregistrement du
même relevé) et par la suite de régression existante (personnel,
fournisseurs, tiers bancaires, dédoublonnage V1.30, factures fournisseurs,
comptabilité V1.32), pour confirmer qu'aucun comportement existant n'a été
modifié.

## Ajout V1.34 : écriture d'ouverture (report du bilan de clôture d'un exercice précédent)

Permet de démarrer le suivi comptable dans l'application à une date donnée
(ex. 01/01/2026) avec le solde de clôture de l'exercice précédent (arrêté
par le comptable/la fiduciaire) déjà intégré, plutôt que de repartir de
zéro. Nouveau menu « Écriture d'ouverture » (Administrateur et Comptable).

- **Import du bilan de clôture au format PDF** : reconnaît automatiquement
  le Tableau n°1 « BILAN » (modèle simplifié CGNC, tel que produit en
  annexe de la déclaration fiscale IS par la plupart des fiduciaires
  marocaines) et en extrait chaque rubrique ayant un montant (Clients et
  comptes rattachés, Fournisseurs et comptes rattachés, Banque, Caisses,
  Capital social, Report à nouveau, Résultat net de l'exercice, Comptes
  d'associés, Créanciers/Débiteurs divers, immobilisations…), avec une
  suggestion de compte du plan comptable pour chacune.
- **Écran de revue avant tout enregistrement** (même principe que l'import
  de factures fournisseurs) : chaque rubrique est associable à un compte
  existant ou à un nouveau compte créé à la volée (« + Nouveau compte… »,
  préremplissant un code/libellé CGNC suggéré) ; les rubriques non
  pertinentes peuvent être décochées, et des lignes manuelles peuvent être
  ajoutées pour tout ce que le bilan ne détaille pas assez. La date de
  l'écriture est éditable (proposée par défaut au lendemain de la date de
  clôture détectée).
- **Contrôle d'équilibre bloquant** : le bouton d'enregistrement reste
  désactivé tant que le total débit ne correspond pas exactement au total
  crédit (tolérance 0,01) ou qu'une ligne conservée n'a pas de compte
  assigné — une balance de clôture doit s'équilibrer par construction.
- **Une seule écriture, journal « AN »** (À Nouveaux), générée à
  l'enregistrement, jamais modifiée ni supprimée ensuite : une correction
  se fait en l'annulant (contre-écriture, bouton dédié sur l'écran
  récapitulatif) puis en resaisissant une nouvelle écriture d'ouverture.
- **Limite assumée** : le bilan « modèle simplifié » ne détaille pas
  certaines masses au niveau du compte individuel (ex. la trésorerie-actif
  ne distingue pas toujours plusieurs comptes bancaires) — dans ce cas,
  l'écriture d'ouverture reporte un solde global par compte, à charge pour
  l'utilisateur de corriger manuellement si un détail plus fin est
  nécessaire. Comme pour le reste du module, ceci reste un outil de
  pré-comptabilité interne : la responsabilité de la justesse des montants
  reportés (arrêtés par le comptable/la fiduciaire) reste à l'utilisateur.

Validé par un test automatisé dédié sur un bilan réel (extraction exacte
des rubriques et montants, total débit = total crédit au centime près),
complété par un test de bout en bout en UI (import, décochage/recochage
d'une ligne avec contrôle d'équilibre, création de plusieurs comptes à la
volée, enregistrement, annulation avec contre-écriture et retour à l'écran
vide). À cette occasion, une garde anti-doublon des écritures
(`creerEcriture`) a été corrigée : elle ne tenait pas compte d'une écriture
déjà annulée (contre-écriture existante) lors de la vérification d'unicité,
ce qui empêchait à tort la resaisie d'une nouvelle écriture d'ouverture
après annulation de la précédente — sans impact sur les autres types de
documents (facture, avoir, encaissement, facture fournisseur, règlement),
dont l'identifiant source n'est jamais réutilisé après annulation. Suite de
régression complète rejouée sans casse (personnel, fournisseurs, tiers
bancaires, dédoublonnage V1.30, factures fournisseurs, comptabilité
V1.32/V1.33).

## Ajout V1.35 : création de compte en un clic depuis une suggestion du bilan

Petite amélioration d'ergonomie de l'écran « Écriture d'ouverture » (V1.34),
demandée après un premier essai : sur l'écran de revue, chaque rubrique sans
compte existant affichait déjà une suggestion de code/libellé CGNC, mais il
fallait ouvrir le menu déroulant « Compte » et y choisir « + Nouveau
compte… » pour la créer — pas toujours visible au premier regard. Un lien
« créer ce compte » est maintenant affiché directement sous la suggestion ;
un clic ouvre le formulaire de création de compte déjà prérempli (code,
libellé, sens normal), et le compte créé est automatiquement affecté à la
ligne correspondante dès l'enregistrement — sans passer par le menu
déroulant. Le menu déroulant « + Nouveau compte… » reste disponible en
parallèle (par exemple pour créer un compte différent de la suggestion).

Validé par un test automatisé dédié (clic sur le lien, vérification du
préremplissage du formulaire, affectation automatique du compte créé à la
ligne, compte bien enregistré en base), complété par un nouveau passage de
la suite de régression comptabilité/écriture d'ouverture au complet.

## Ajout V1.36 : affichage du chiffre d'affaires de l'exercice clôturé

Demande explicite après la livraison de V1.34 : « le chiffre d'affaire est
associe a quel compte » puis « je souhaite voir le chiffre d'affaire de
l'exercice precedent ». Réponse d'abord pédagogique (le chiffre d'affaires
est un compte de produits — classe 7, ex. 7121 — qui ne fait jamais partie
d'une écriture d'ouverture : seuls les comptes de bilan sont reportés, les
comptes de produits/charges repartant toujours à zéro à chaque exercice ;
seul leur effet net, déjà calculé, apparaît dans le résultat net du bilan,
compte 1191), puis ajout d'une fonctionnalité pour répondre au besoin réel
de l'utilisateur : voir ce chiffre, à titre de référence, au moment de
l'écriture d'ouverture.

- **`backend/bilan_parser.py`** sait désormais aussi repérer, sur la page
  distincte « Tableau n°2 — Compte de Produits et Charges » du même PDF
  (quand elle est présente), la ligne « Chiffre d'affaires » et en extrait
  le montant de l'exercice clôturé (même règle d'extraction que pour le
  bilan : avant-dernier nombre trouvé sur la ligne). Validé sur le PDF réel
  (327 455,00 DH, exercice 2023 — vérifié par une lecture manuelle de la
  page CPC).
- La route `/api/ouverture/parse-bilan` renvoie ce montant
  (`chiffreAffaires`) en plus des rubriques du bilan. Absence de la page
  CPC dans le PDF : champ `null`, sans bloquer l'import du bilan.
- **Écran de revue** : le montant est affiché dans un encadré
  informatif au-dessus du tableau, avec un rappel explicite qu'il s'agit
  d'une information et non d'une ligne comptabilisée.
- **Écran récapitulatif** (après enregistrement) : le même montant reste
  visible, car conservé comme un champ informatif supplémentaire sur le
  document de l'écriture elle-même (`chiffreAffairesExerciceCloture` —
  jamais une ligne de débit/crédit, seulement une donnée de référence
  attachée au document).

Validé par un test de bout en bout dédié (montant affiché sur l'écran de
revue, mention « pour information » visible, montant retrouvé sur l'écran
récapitulatif après enregistrement, champ bien persisté en base), suivi
d'un nouveau passage de la suite de régression comptabilité complète sans
casse.

## Ajout V1.37 : archive et suivi comparatif des exercices antérieurs

Demande explicite : « je souhaite avoir la possibilite d importer les
anciens exercice comptable un a un ». Deux clarifications via
`AskUserQuestion` avant implémentation :

- **Objectif** : suivi comparatif pluriannuel (pas seulement une archive
  de référence passive — un tableau comparant les exercices entre eux).
- **Contenu conservé par exercice** : le bilan complet (toutes les
  rubriques) + le chiffre d'affaires, comme pour l'écriture d'ouverture.

Nouveau menu **« Exercices archivés »** (Administrateur et Comptable),
indépendant de l'écriture d'ouverture (aucun lien entre les deux — importer
le même PDF dans les deux écrans n'a aucun effet secondaire sur l'autre) :

- **Import PDF un exercice à la fois**, en réutilisant telle quelle la
  route déjà en place `/api/ouverture/parse-bilan` (même parseur, même
  format CGNC modèle simplifié — aucun changement côté backend). Écran de
  revue léger avant archivage : chiffre d'affaires, résultat net, total du
  bilan et trésorerie (banque + caisse) de l'exercice détecté, plus le
  détail des rubriques du bilan pour vérification — **pas de
  rapprochement avec le plan comptable** (contrairement à l'écriture
  d'ouverture) puisqu'aucune écriture n'est générée ici.
- **Doublon bloqué** : un exercice déjà archivé pour la même date de
  clôture ne peut pas être réimporté tant qu'il n'a pas été supprimé de la
  liste.
- **Suppression directe** (pas de contre-écriture) : il ne s'agit jamais
  d'un document comptable officiel, seulement d'une archive de référence.
- **Tableau comparatif pluriannuel** : liste de tous les exercices
  archivés, triés chronologiquement, avec pour chacun le chiffre
  d'affaires, son évolution par rapport à l'exercice précédent archivé
  (delta, coloré vert/rouge), le résultat net, le total du bilan et la
  trésorerie — permet de voir d'un coup d'œil la tendance d'une année sur
  l'autre.

Validé par un test de bout en bout (import réel, contenu de l'écran de
revue, enregistrement, doublon bloqué, suppression) complété par
l'injection directe d'un second exercice fictif via l'API (faute d'un
second PDF réel disponible) pour valider le tableau comparatif à plusieurs
lignes et le calcul de l'évolution du chiffre d'affaires, ainsi qu'un test
dédié de contrôle d'accès par rôle. Suite de régression comptabilité
complète rejouée sans casse.

## Ajout V1.38 : fiabilisation de l'import de bilan et complétion du plan comptable

Demande explicite : « merci de tester la fiabilite des imports avec les
bilans ci joint ajouter egalement les comptes comptables necessaires »,
avec quatre bilans réels fournis en pièce jointe (FUTURA_EXPERTISE,
exercices 2021, 2022, 2023 et 2025 — **2025 est le tout premier exercice
réel fourni dans ce projet**, les tests précédents n'ayant utilisé que
2023, explicitement comme gabarit structurel).

**Deux bugs réels trouvés et corrigés dans `backend/bilan_parser.py`** (le
parseur partagé par l'écriture d'ouverture V1.34 et les exercices archivés
V1.37) :

1. **Séparateur décimal virgule ou point selon l'année d'export** : les
   bilans 2022/2023 utilisent la virgule (« 138 213,99 ») mais 2021/2025
   utilisent le point (« 138 213.99 »), selon le paramétrage régional du
   poste ayant généré le PDF chez le même fiduciaire. L'expression
   régulière `NUM_RE` ne reconnaissait que la virgule : sur 2021 et 2025,
   aucun montant n'était extrait (0 ligne). Corrigée pour accepter les deux
   formats.
2. **Colonne « Exercice précédent » totalement absente** (pas même un 0)
   sur une ligne d'immobilisation d'un exercice sans historique antérieur
   (2022, premier exercice complet de l'entreprise) : il ne reste alors que
   3 nombres [Brut, Amortissements, Net] au lieu de 4, et la règle
   « avant-dernier nombre » prenait à tort les Amortissements au lieu du
   Net — déséquilibre de 61 439,90 DH sur le bilan 2022 (5 850,00 DH sur
   « Installations techniques... » + 55 589,90 DH sur « Immobilisations
   corporelles diverses »). Corrigée par une vérification de cohérence
   arithmétique (Brut − Amortissements ≈ Net) qui bascule sur le bon
   montant quand elle est vérifiée sur 3 nombres.
   Variante du même problème sur le premier exercice 2021 (partiel, 5 mois) :
   la ligne « IMMOBILISATIONS EN NON VALEURS », amortie à 100 % la même
   année (pratique courante au Maroc pour les frais préliminaires d'un
   exercice de création), n'affiche que Brut et Amortissements (identiques,
   Net = 0 et Précédent blancs, non imprimés) — seulement 2 nombres égaux,
   que la règle générale interprétait à tort comme [Net, Précédent].
   Corrigée (restreinte au seul compte 2111, pour ne jamais écraser à 0 une
   coïncidence légitime Net = Précédent sur une autre immobilisation, par
   exemple un Terrain inchangé d'une année sur l'autre).

Après correction, les quatre bilans réels s'équilibrent exactement (total
actif = total passif) : 101 566,67 DH (2021), 257 194,64 DH (2022),
261 043,48 DH (2023, inchangé — aucune régression), 244 230,07 DH (2025).
Chaque montant a été recontrôlé à la main contre le texte brut de la page
BILAN de chaque PDF.

**Complétion du plan comptable** (`backend/db.py`) : seuls 8 des 36 comptes
CGNC suggérés par `bilan_parser.py` étaient pré-amorcés ; les 27 comptes
manquants (ex. 2111, 2311, 2380, 1161, 1191, 4463, 5541...) ont été ajoutés
à `DEFAULT_PLAN_COMPTABLE`. Pour qu'une installation déjà en service (donc
déjà amorcée avec l'ancienne liste plus restreinte) en bénéficie également
sans attendre une réinitialisation, une migration ponctuelle
`_migrate_comptes_bilan_if_needed()` complète le plan comptable existant
avec les comptes manquants, une seule fois (marqueur
`settings/migrations.comptesBilanV138`), sans jamais recréer un compte que
l'utilisateur aurait déjà supprimé délibérément après cette migration.
Résultat concret : une installation neuve démarre désormais avec 59
comptes pré-amorcés (contre 32 avant), et un import de bilan typique ne
nécessite plus aucune création manuelle de compte via le lien « créer ce
compte » (V1.35) — celui-ci reste disponible pour tout compte réellement
absent (compte supprimé par l'utilisateur, ou rubrique hors de cette
liste).

Validé par : ré-exécution directe du parseur sur les quatre PDF réels
(équilibre exact, confronté au texte brut de chaque page BILAN) ; script de
migration testé sur trois scénarios (installation neuve → 59 comptes,
installation existante amorcée avec l'ancienne liste → complétée à 59 sans
doublon, compte migré puis supprimé manuellement → non ressuscité au
redémarrage suivant) ; re-test du lien « créer ce compte » après
suppression manuelle d'un compte pré-amorcé (toujours fonctionnel). Suite
de régression complète (écriture d'ouverture, suggestion de compte,
chiffre d'affaires, exercices archivés, contrôle d'accès, plan comptable,
écritures automatiques, fournisseurs, personnel) rejouée sans casse.

## Ajout V1.39 : emplacement choisi de la base de données + reprise d'une version précédente

Demande explicite : « donner a l utilisateur de choisir ou stocker la base
de donnee le nom de la bdd portera en extion la version du software V1.38
par exemple a ajouter aussi la possibilite de lire la base de donnees de
la version precedente ».

Jusqu'ici, le fichier de base de données (`chantier_erp.db`) avait un nom
fixe et un emplacement fixe (`data/` sous l'installation de l'application,
jamais configurable), à la différence du répertoire de stockage des
factures fournisseurs (déjà configurable depuis Paramètres, V1.16+). Trois
changements, dans `backend/db.py` et un nouveau blueprint
`backend/routes/db_admin.py` :

1. **Nom de fichier versionné** : `chantier_erp_V1.39.db` (au lieu de
   `chantier_erp.db`) — chaque version de l'application écrit dans un
   fichier qui porte son propre numéro de version en suffixe
   (`db_filename()`), afin qu'une mise à jour vers une nouvelle version ne
   puisse jamais écraser silencieusement le fichier d'une version
   précédente situé dans le même répertoire.
2. **Répertoire configurable** (Paramètres > Emplacement de la base de
   données, Administrateur uniquement) : texte libre comme pour le
   stockage des factures fournisseurs, avec déplacement automatique du
   fichier de la version courante vers le nouveau répertoire choisi
   (jamais de copie orpheline). **Différence technique importante avec les
   autres réglages de l'application** : ce choix ne peut pas être stocké
   dans la base de données elle-même (il faudrait déjà savoir où elle se
   trouve pour pouvoir l'y lire) — il est donc conservé dans un petit
   fichier de bootstrap à part, `db_location.json`, toujours au même
   endroit fixe à côté de l'application, qui ne contient que ce chemin,
   jamais les données elles-mêmes.
3. **Reprise explicite de la base d'une version précédente** : si
   l'utilisateur installe une nouvelle version de l'application en la
   pointant sur le même répertoire qu'une version antérieure, celle-ci
   démarrerait normalement avec une base neuve et vide sous son propre nom
   de fichier — alors que les données existent toujours, simplement sous
   l'ancien nom. L'écran Paramètres détecte automatiquement tout fichier
   `chantier_erp_V*.db` présent dans le répertoire courant autre que celui
   de la version active, et propose un bouton « Utiliser cette base » par
   fichier trouvé. Sécurité appliquée : le fichier de la version
   précédente n'est jamais déplacé ni modifié (une **copie** en est faite
   sous le nom de la version courante) ; si un fichier existe déjà sous ce
   nom (quelques données déjà saisies depuis la mise à jour, par exemple),
   il est renommé de côté (suffixe `.avant_adoption_<horodatage>.bak`)
   plutôt que supprimé ou écrasé — jamais de perte silencieuse de données.

Nouvelles routes : `GET /api/db/info` (répertoire courant, fichier actif,
taille, date de modification, liste des fichiers d'autres versions
détectés), `POST /api/db/location` (changement de répertoire),
`POST /api/db/adopter` (reprise d'un fichier d'une version précédente).

Validé : changement de répertoire en conditions réelles (fichier
effectivement déplacé, application toujours fonctionnelle sans
redémarrage, reglage persistant après redémarrage) ; détection d'un faux
fichier `chantier_erp_V1.37.db` déposé manuellement dans le répertoire ;
reprise de ce fichier via le bouton dédié — données de la version
« précédente » (y compris les utilisateurs) effectivement retrouvées dans
l'application après le rechargement automatique de la page, fichier
`V1.38` alors actif mis de côté en `.bak` plutôt que perdu ; rejet propre
des cas limites (nom de fichier invalide, fichier inexistant, tentative de
« reprendre » le fichier déjà actif, répertoire de destination contenant
déjà un fichier de la version courante). Suite de régression comptabilité
et modules associés rejouée sans casse après le passage au chemin de base
de données dynamique (`get_db_path()`, relu à chaque connexion au lieu
d'une constante figée au démarrage).

## Ajout V1.40 : assistant de premier démarrage (choix de l'emplacement et reprise d'une ancienne base avant toute utilisation)

Demande explicite : « AVANT LE PREMIER DEMARRAGE DEMANDER DE SPECIFIER
L EMPLACEMENT DE LA NOUVELLE BDD ET L ANCIENNE A RECUPERER ».

La V1.39 avait ajouté le choix de l'emplacement de la base et la reprise
d'une version précédente, mais uniquement depuis l'écran Paramètres —
c'est-à-dire après avoir déjà créé un compte et commencé à se servir de
l'application avec la base par défaut. La V1.40 déplace ce choix tout au
début : désormais, au tout premier lancement (avant même l'écran de
connexion), un écran dédié demande à l'utilisateur où stocker la base et
s'il a une ancienne base à récupérer, avant qu'aucune donnée n'ait pu être
saisie dans la base par défaut.

1. **Indicateur de premier démarrage** : un nouveau champ
   `assistantInitialTermine` dans le fichier de bootstrap
   `db_location.json` (le même fichier qui stocke déjà le répertoire
   choisi en V1.39). Tant qu'il n'est pas à `true`, l'écran d'assistant
   s'affiche avant tout le reste ; une fois terminé (quel que soit le choix
   fait), il ne réapparaît plus jamais, et l'écran Paramètres reste
   disponible pour les mêmes réglages a posteriori.
2. **Écran d'assistant** (nouvelle fonction `renderAssistantInitial()`
   dans `static/js/app.js`, appelée par `boot()` avant tout chargement de
   données) : un champ pour choisir le répertoire de stockage (avec
   nouvelle détection automatique des bases d'anciennes versions dès que
   ce champ est modifié), un tableau listant les bases d'anciennes
   versions trouvées dans ce répertoire avec un bouton « Récupérer cette
   base » par fichier, un champ texte libre pour indiquer le chemin complet
   d'une ancienne base située n'importe où ailleurs sur le poste (clé/disque
   externe, autre dossier, copie reçue d'un collègue), et un bouton
   « Démarrer avec une base vide » pour les installations réellement
   neuves.
3. **Reprise par chemin complet, pas seulement par détection automatique**
   dans le même répertoire : généralisation de `POST /api/db/adopter` (V1.39)
   qui acceptait uniquement un nom de fichier du répertoire courant, pour
   accepter aussi un chemin absolu quelconque (`cheminSource`). Une
   vérification minimale (`SELECT COUNT(*) FROM documents`) confirme qu'il
   s'agit bien d'un fichier de base Chantier ERP avant toute copie, pour
   éviter de « récupérer » un fichier quelconque par erreur.
4. **Mêmes garanties anti-perte de données que la V1.39** : la base source
   n'est jamais déplacée ni modifiée (toujours une copie) ; si un fichier
   existe déjà sous le nom de la version courante, il est mis de côté
   (suffixe `.avant_adoption_<horodatage>.bak`) plutôt qu'écrasé.

Nouvelles routes : `GET /api/db/assistant-initial` (l'assistant a-t-il déjà
été terminé, répertoire courant, bases d'autres versions détectées),
`POST /api/db/assistant-initial/terminer` (marque l'assistant comme
terminé, pour qu'il ne réapparaisse plus). `GET /api/db/info` accepte
désormais un paramètre `?dir=` optionnel pour prévisualiser un répertoire
différent de celui actif, sans le changer (utilisé par le champ de
répertoire de l'assistant pour l'analyse à la volée).

Note technique assumée : `init_db()` continue de créer/amorcer la base par
défaut dès le démarrage du serveur Flask, avant même que l'assistant ne
puisse s'exécuter côté navigateur (aucune dépendance de séquencement entre
les deux n'a été introduite). Ce n'est pas un problème : les actions de
l'assistant (déplacement de répertoire, reprise d'une ancienne base)
absorbent proprement tout fichier déjà créé entre-temps à l'emplacement par
défaut, exactement comme un changement fait plus tard depuis Paramètres.

Validé : l'assistant s'affiche bien à la place de l'écran de connexion sur
une base totalement neuve (répertoire et fichier de bootstrap absents) ;
aucune ancienne base détectée au départ dans le répertoire par défaut ;
changement de répertoire dans le champ de l'assistant suivi d'une
détection automatique d'une ancienne base fabriquée pour le test ;
reprise via le bouton de la liste — utilisateur et client de cette ancienne
base effectivement retrouvés après le rechargement automatique, assistant
marqué comme terminé et ne réapparaissant plus aux lancements suivants ;
reprise via le champ de chemin complet (base située dans un tout autre
répertoire) — même résultat ; choix « Démarrer avec une base vide » —
affichage correct de l'écran normal de création du premier compte
administrateur (comportement préexistant et inchangé d'une base
réellement vide, non confondu avec l'écran de sélection d'utilisateur).
Ensemble de la suite de régression (comptabilité, fournisseurs, personnel,
emplacement de stockage, écriture d'ouverture, relevés bancaires, accès par
rôle, exercices archivés) rejouée sans casse après mise en place de
l'assistant, en marquant systématiquement `assistant-initial` comme
terminé juste après chaque redémarrage de serveur avec base neuve (sans
quoi les anciens scripts de test, écrits avant cet assistant, se
heurteraient à son écran au lieu de l'écran de connexion qu'ils
attendent) — aucune modification des scripts de test existants n'a été
nécessaire pour cela.

## Ajout V1.41 : navigateur de dossiers/fichiers intégré (plus besoin de taper un chemin à la main)

Demande explicite : « pour specifier les repertoires donner la main a
l utilisateur d aller chercher lui meme ces repretoire ».

Jusqu'ici (assistant de premier démarrage V1.40, écran Paramètres V1.38/39),
indiquer un répertoire ou un fichier de base de données antérieure
nécessitait de taper son chemin complet à la main dans un champ de texte.
La V1.41 ajoute un bouton « Parcourir… » à côté de chaque champ concerné,
qui ouvre une fenêtre de navigation au clic, dossier par dossier, comme
l'Explorateur Windows ou le Finder Mac — sans jamais avoir à taper de
chemin.

**Point technique important** : un navigateur web, par sécurité, ne donne
jamais à une page le chemin réel d'un fichier choisi via sa propre fenêtre
native « Parcourir » (vrai pour n'importe quel site, pas une limite de
cette application). Impossible donc de s'appuyer sur `<input
type="file">` et d'en récupérer un chemin exploitable côté serveur. La
solution retenue est un navigateur de dossiers/fichiers **maison**, dont
l'affichage est fourni par le serveur de l'application lui-même (qui
tourne sur le poste de l'utilisateur) :

1. **Nouvel endpoint** `GET /api/db/parcourir` (lecture seule, ne crée et
   ne modifie jamais rien) : sans paramètre, renvoie les raccourcis
   (Dossier personnel, Bureau, Documents) et les racines (lettres de
   disque sous Windows, `/` sous Unix/Mac) ; avec `?chemin=...`, liste les
   sous-dossiers de ce chemin (cliquables pour y entrer) et les fichiers
   `.db` qu'il contient (avec leur version détectée), plus le chemin du
   dossier parent pour « Remonter ». Un élément isolé illisible
   (permission refusée, lien cassé) est simplement ignoré plutôt que de
   faire échouer tout l'affichage.
2. **Composant JS réutilisable** `ouvrirNavigateurFichiers(options)`
   (`static/js/app.js`) : une fenêtre modale listant dossiers et fichiers,
   avec deux modes — `'dossier'` (un bouton « Choisir ce dossier » valide
   le répertoire affiché) et `'fichier'` (les fichiers `.db` du dossier
   courant sont eux-mêmes cliquables, pour désigner directement un fichier
   précis — utile par exemple pour un fichier renommé, comme une
   sauvegarde, que la détection automatique par nom ne reconnaîtrait pas).
3. **Branché partout où un chemin était saisi à la main** : le champ de
   répertoire de stockage et le champ de récupération par chemin complet
   de l'assistant de premier démarrage (V1.40) ; le champ de répertoire de
   stockage de l'écran Paramètres (V1.38). **Nouveauté associée dans
   Paramètres** : un champ « Reprendre une base située ailleurs » (chemin
   complet + bouton Parcourir + bouton de récupération) a été ajouté à cet
   écran, pour y retrouver la même possibilité que dans l'assistant de
   premier démarrage — auparavant réservée au tout premier lancement.

Aucun changement sur les règles de sécurité déjà en place (copie, jamais
déplacement, du fichier source ; fichier existant mis de côté en `.bak`
plutôt qu'écrasé) : le navigateur ne fait que désigner un chemin par
clic, les actions de récupération elles-mêmes passent toujours par les
mêmes points d'entrée (`POST /api/db/location`, `POST /api/db/adopter`).

Validé via Playwright, dans l'assistant de premier démarrage ET dans
Paramètres : ouverture du navigateur, navigation par clic à travers
plusieurs niveaux de sous-dossiers, sélection d'un dossier qui met à jour
le champ et relance la détection automatique des anciennes bases, sélection
directe d'un fichier `.db` qui remplit le champ de chemin complet,
affichage propre d'un message d'erreur suivi d'un retour à l'écran de
départ pour un chemin saisi manuellement qui n'existe pas, et chaîne
complète de reprise d'une ancienne base jusqu'au bout (utilisateur et
client de cette base retrouvés après rechargement) à la fois en passant
par la sélection de dossier et par la sélection directe de fichier.
Ensemble de la suite de régression existante rejouée sans casse.

## Ajout V1.42 : vraie boîte de dialogue native (Explorateur Windows / Finder Mac) au clic sur « Parcourir… »

Demande explicite, en réaction directe à la V1.41 : « la facon n est pas
bonne merci d utiliser l explorateur windws apres avoir cliquer sur
parcourir ». Le navigateur de dossiers maison construit en V1.41 (un
écran dessiné par l'application elle-même) ne convenait pas : l'attente
était que le clic sur « Parcourir… » ouvre la **vraie** fenêtre de
l'Explorateur Windows (ou du Finder sur Mac), celle que l'on obtient dans
n'importe quel logiciel du système.

C'est possible car l'application tourne directement sur le poste de
l'utilisateur (`lancer_windows.bat` / `lancer_mac_linux.sh`, ou la fenêtre
de bureau `desktop.py`) : le serveur peut donc demander au système
d'exploitation lui-même d'afficher sa boîte de dialogue native, au lieu
d'en reconstruire une.

1. **Nouvelle fonction `_dialogue_natif()`** (`backend/routes/db_admin.py`)
   : affiche la boîte de dialogue native (`tkinter.filedialog`,
   `askdirectory`/`askopenfilename`) — exécutée dans un **sous-processus
   Python dédié et jetable**, jamais directement dans le thread de la
   requête Flask. Ce choix technique évite deux pièges : sous macOS, les
   composants graphiques doivent impérativement s'exécuter sur le thread
   principal d'un processus ; et en mode « application de bureau »
   (`desktop.py`, fenêtre pywebview), Flask tourne déjà dans un thread
   secondaire pendant que le thread principal est occupé par la fenêtre
   native de l'application elle-même. Un sous-processus séparé a toujours
   son propre thread principal, quel que soit le contexte d'où il est
   lancé.
2. **Nouvelles routes** `GET /api/db/choisir-dossier` et
   `GET /api/db/choisir-fichier` : renvoient soit `{disponible:true,
   chemin:...}` (chemin choisi, ou `null` si l'utilisateur a cliqué sur
   Annuler — dans ce cas, rien ne se passe), soit `{disponible:false}` si
   la boîte de dialogue native n'a pas pu s'afficher du tout sur ce poste
   (composant `tkinter` absent de cette installation Python, ou aucun
   environnement graphique disponible).
3. **Repli automatique, sans aucune intervention de l'utilisateur** : si
   `disponible` est `false`, l'application bascule silencieusement sur le
   navigateur de dossiers maison de la V1.41 (conservé tel quel, jamais
   supprimé) — l'utilisateur garde donc toujours un moyen de choisir un
   chemin, même sur un poste où `tkinter` viendrait à manquer (cas rare :
   ce composant est installé par défaut avec Python sur Windows dans
   l'immense majorité des cas).
4. **Un seul point d'entrée côté interface** (`parcourirChemin()` dans
   `static/js/app.js`) appelé par les 4 boutons « Parcourir… » existants
   (répertoire + récupération par chemin, dans l'assistant de premier
   démarrage ET dans Paramètres) : tente la boîte de dialogue native,
   puis se replie sur `ouvrirNavigateurFichiers()` (V1.41) si besoin —
   aucun changement visible pour l'utilisateur entre les deux cas, à part
   la fenêtre affichée.

Limite assumée et explicitée à l'utilisateur : la vérification visuelle
de l'affichage réel de l'Explorateur Windows n'a pas pu être faite depuis
l'environnement de développement (pas de poste Windows ni d'environnement
graphique disponible ici) — seul le mécanisme et le repli automatique ont
pu être vérifiés de bout en bout. Confirmation du bon affichage de la
fenêtre native laissée à l'utilisateur sur son propre poste.

Validé (ce qui est vérifiable depuis cet environnement) : l'appel à
`GET /api/db/choisir-dossier` renvoie correctement `{disponible:false,
erreur:"...tkinter..."}` en l'absence de `tkinter` (cas de cet
environnement de développement, sans affichage graphique) ; dans ce cas,
les 4 boutons « Parcourir… » basculent bien, de façon transparente, sur le
navigateur de dossiers maison de la V1.41, dont l'ensemble des scénarios
déjà testés (navigation par clic, sélection de dossier, sélection directe
d'un fichier, chemin invalide, chaîne complète de récupération) continue
de fonctionner sans régression par ce chemin de repli. Ensemble de la
suite de régression existante rejoué sans casse.

## Ajout V1.43 : comparatif des bilans (exercices archivés + situation courante) et indicateurs de contrôle de gestion

Demande explicite : « merci d ajouter un comparatif comptable entre les
differents bilan ainsi que la situation courant. Ajouter des indicateurs
de controle de gestion ». Trois choix ont été validés avec l'utilisateur
avant implémentation : la « situation courante » est un **bilan
reconstruit en direct** à partir des soldes actuels du plan comptable
(et non des chiffres simplifiés isolés) ; les indicateurs retenus sont la
**trésorerie**, le **chiffre d'affaires cumulé**, le **résultat net
estimé** et la **marge brute** (taux de marge inclus) ; l'ensemble est
regroupé sur un **nouvel écran dédié**.

1. **Nouvel écran « Contrôle de gestion »** (`static/js/app.js`,
   `renderControleGestion()`), visible dans le menu pour les profils
   Admin et Comptable (même règle d'accès que « Exercices archivés »,
   invisible pour Commercial et Chantier). *Remarque sur le nom* : le
   menu contient déjà un écran « Tableau de bord » (vue commerciale et
   opérationnelle, sans rapport avec la comptabilité) — pour éviter toute
   confusion entre les deux, ce nouvel écran a été nommé « Contrôle de
   gestion » plutôt que « Tableau de bord ». À signaler si un
   rattachement à l'écran existant était en fait souhaité.
2. **Bilan de la situation courante reconstruit en direct**
   (`bilanSituationCourante()`) : reprend très exactement la même table
   de correspondance rubrique CGNC ↔ compte que celle utilisée pour lire
   un bilan PDF importé (`backend/bilan_parser.py`, dupliquée côté
   client dans `RUBRIQUES_BILAN_CGNC` pour rester cohérent avec
   l'architecture existante où tous les calculs comptables sont déjà
   faits côté navigateur), appliquée aux soldes **actuels** de chaque
   compte (toutes écritures confondues). Comptes de classes 1 à 5
   uniquement : ils portent l'état cumulé depuis toujours (l'écriture
   d'ouverture y reporte déjà l'état de clôture précédent), donc aucun
   filtrage par date n'est nécessaire. Le résultat a exactement la même
   forme qu'un bilan archivé, et réutilise sans aucune modification les
   fonctions existantes (`totalBilanMontant`, `tresorerieMontant`,
   `resultatNetMontant`), ce qui permet de l'afficher dans le même
   tableau comparatif que les exercices archivés, en toute dernière
   ligne « EN COURS ».
3. **Quatre indicateurs de pilotage**, calculés depuis la date de
   l'écriture d'ouverture active (ou depuis le début si aucune n'existe
   encore) :
   - **Trésorerie actuelle** : banque + caisse + chèques à encaisser,
     lue directement sur le bilan reconstruit en direct.
   - **Chiffre d'affaires cumulé** de l'exercice en cours : solde du
     compte Ventes/Travaux facturés (7121) depuis l'ouverture.
   - **Résultat net estimé** : produits (classe 7) moins charges
     (classe 6) déjà comptabilisés depuis l'ouverture — une
     **estimation**, explicitement signalée comme telle à l'écran,
     puisqu'aucune écriture de clôture automatique n'existe dans
     l'application ; le résultat définitif ne sera connu qu'à la
     clôture réelle de l'exercice (import du bilan officiel).
   - **Marge brute** (montant + taux) : chiffre d'affaires (7121) moins
     achats/sous-traitance (6125) uniquement — volontairement plus
     étroit que le résultat net estimé (qui déduit toutes les charges
     de classe 6), pour isoler la rentabilité directe des travaux.
     Coïncide aujourd'hui en pratique avec le résultat net estimé (6125
     et 7121 sont pour l'instant les seuls comptes de charges/produits
     alimentés automatiquement par l'application), mais les deux
     indicateurs resteront distincts et pourront diverger si d'autres
     comptes de charges/produits sont un jour utilisés via une écriture
     manuelle.
4. **Tableau comparatif** : reprend la liste des exercices archivés
   (triés chronologiquement, avec leur évolution de CA d'un exercice à
   l'autre comme déjà affiché dans l'écran « Exercices archivés »), et y
   ajoute la ligne « EN COURS — Situation courante » avec les mêmes
   colonnes (CA, évolution, résultat net marqué « estimé », total du
   bilan, trésorerie). Un détail dépliable, rubrique par rubrique,
   affiche la composition complète du bilan reconstruit en direct.
5. **Purement informatif** : aucune écriture comptable n'est générée,
   modifiée ou supprimée par ce nouvel écran — il ne fait que lire et
   recalculer des données déjà existantes.

Validé : l'écran a été vérifié de bout en bout (fixture : import du
bilan d'ouverture FUTURA EXPERTISE 2023, une facture client de 10 000
HT validée, une facture fournisseur de 4 000 HT intégrée au journal) —
le CA cumulé affiché (10 000,00), la marge brute (6 000,00, soit 60 % du
CA) et le résultat net estimé (6 000,00, cohérent puisque seuls les
comptes 7121/6125 sont mouvementés) correspondent exactement aux calculs
attendus ; le détail rubrique par rubrique et le bandeau « EN COURS »
s'affichent correctement ; aucune erreur JavaScript. Ensemble de la
suite de régression comptabilité existante (plan comptable, journal,
écriture d'ouverture, exercices archivés, accès par rôle, relevés
bancaires liés à la comptabilité) rejoué sans casse sur une base
fraîche.

## Ajout V1.44 : saisie manuelle des comptes sans PDF + détail des bilans archivés

Demande explicite, en suite directe de la V1.43 : « AJOUTER LA POSSIBILITE DE SAISIR LES DIFFERRENTS COMPTES DONT ON A LES MONTANTS MAIS ON A PAS LE PDF DU BLIAN soit d ouverture soit archive. Ajouter la possibilite de voir le detail des bilans archives ». Deux questions posées via AskUserQuestion avant implémentation, toutes deux confirmées : (1) la saisie manuelle se fait **par compte du plan comptable** (comme pour une écriture normale), avec déduction automatique de la rubrique de bilan et du côté (actif/passif) ; (2) le détail d'un bilan archivé s'affiche en **ligne dépliable dans le tableau** (même principe que le détail de la situation courante dans Contrôle de gestion).

**Saisie manuelle, sans PDF** : jusqu'ici, l'écriture d'ouverture et les exercices archivés ne pouvaient démarrer que par l'import d'un PDF de bilan. Un nouveau bouton « Saisir manuellement » apparaît désormais à côté de « Importer un bilan (PDF) » sur les deux écrans.
- **Écriture d'ouverture** : le bouton ouvre directement l'écran de revue déjà existant, vide au départ — l'utilisateur ajoute ses lignes une à une via « Ajouter une ligne manuelle » (ce mécanisme existait déjà pour *compléter* un import PDF ; il sert maintenant aussi à construire l'écriture dans son ensemble). Le contrôle d'équilibre débit = crédit avant enregistrement reste inchangé (obligatoire pour toute écriture comptable). **Correctif au passage** : avec zéro ligne, l'écriture était auparavant considérée « équilibrée » par défaut (0 = 0) et le bouton Enregistrer restait actif à tort — un garde-fou (« au moins une ligne conservée ») a été ajouté, utile dès qu'on démarre une saisie manuelle vide.
- **Exercices archivés** : le bouton ouvre un formulaire éditable (période de l'exercice, chiffre d'affaires optionnel) où l'on ajoute ses comptes un à un (« Ajouter un compte », limité aux comptes de classes 1 à 5, comme un vrai bilan). Pour chaque compte choisi, le libellé de rubrique et le côté (actif/passif) sont déduits automatiquement de la même table de correspondance CGNC que celle utilisée pour la « situation courante » de Contrôle de gestion (`RUBRIQUES_BILAN_CGNC`) — avec un repli sur le libellé et le sens normal du compte si celui-ci n'est pas un compte de bilan standard. Comme ce n'est pas une écriture comptable (juste une archive de référence), aucune contrainte d'équilibre : on peut renseigner seulement les comptes dont on dispose, pas besoin d'un bilan complet.

**Détail des bilans archivés** : dans le tableau de la page « Exercices archivés », chaque ligne d'exercice a désormais un bouton de bascule qui déplie, directement en dessous, le détail complet rubrique par rubrique (comme pour un import PDF) — qu'il s'agisse d'un exercice importé en PDF ou saisi manuellement.

Validé de bout en bout via Playwright (nouveau script `e2e_saisie_manuelle_bilans.py`) : écriture d'ouverture saisie manuellement (comptes 1111 Capital social au crédit et 5141 Banque au débit, 50 000 chacun) équilibrée et enregistrée correctement en base ; bouton Enregistrer désactivé tant qu'aucune ligne n'est ajoutée ; exercice archivé saisi manuellement (comptes 3421 Clients et 1111 Capital social, 15 000 chacun, période et CA renseignés à la main) correctement enregistré avec rubriques et côtés déduits automatiquement ; détail dépliable testé (affichage/masquage, contenu correct) sur l'exercice nouvellement archivé. Suite de régression comptabilité existante (import PDF de l'écriture d'ouverture, import PDF d'un exercice archivé, accès par rôle, Contrôle de gestion, journal et écritures, test de fumée général) rejouée sans casse sur base fraîche — un script de régression existant (`e2e_exercices_archives.py`) comptait jusqu'ici toutes les lignes `<tr>` du tableau sans distinction ; ses lignes de détail désormais cachées (ajoutées par cette version) faussaient ce comptage, corrigé pour ne compter que les lignes visibles.

## Ajout V1.45 : import de factures clients déjà émises (PDF), à l'instar des factures fournisseurs

Demande explicite : « ajouter la possibilite d import de facture client a
l instar des factures fournisseurs, si un client n existe pas dans la base
donner la possibilite de l ajouter au moment de l import des factures ci
joint des exemples » (9 vraies factures PDF fournies en exemple : Futura
Expertise facturant Butec, Jesa et Cegelec). Quatre questions posées via
AskUserQuestion avant implémentation, toutes confirmées avec l'option
recommandée : (1) intégration dans l'écran « Factures » existant plutôt
qu'un registre séparé comme pour les fournisseurs ; (2) aucun numéro
officiel FAC-AAAA-NNNNN attribué aux imports — seule la référence
d'origine du document est utilisée ; (3) enregistrement direct en
« Validée » et verrouillée, puisqu'il s'agit de documents déjà émis dans
la réalité ; (4) périmètre limité au cœur du besoin (import multi-fichiers,
reconnaissance texte/OCR, écran de relecture obligatoire, création de
client à la volée, classement des fichiers) — sans reprendre l'ensemble
des fonctionnalités avancées du module fournisseurs (éditeur de zones,
import/export Excel, détection de doublons, dossiers configurables).

**Respect du principe RG-009 (cf. `cdc-nomenclature-numerotation-analyse.md`)** :
le cahier des charges prévoyait déjà ce cas — « Références historiques
importées jamais renumérotées, conservées dans un champ "Référence
historique" dédié » — mais ce principe n'avait jamais été implémenté
jusqu'ici. Une facture importée reçoit donc `numero` = référence
d'origine du document (ex. `2026_01`) **et** `referenceHistorique` = la
même valeur, qui sert de marqueur distinctif pour ne jamais confondre
cette référence avec une vraie séquence `FAC-AAAA-NNNNN`. Ce choix de
renseigner `numero` (plutôt que de le laisser vide) était nécessaire car
`genererEcritureFacture()` n'écrit l'écriture comptable en vente que si
`f.numero` est renseigné — le mécanisme existant reste ainsi inchangé.

1. **Nouveau parseur** `backend/facture_client_parser.py`, qui réutilise
   toutes les fonctions génériques déjà existantes du parseur fournisseurs
   (`backend/facture_parser.py` : découpage multi-factures par PDF,
   détection de date, ICE, montants par heuristique texte). Deux ajouts
   spécifiques aux factures clients :
   - **Extraction HT/TVA/TTC et lignes de prestations via les tableaux
     pdfplumber** (`page.extract_tables()`) plutôt que par heuristique
     texte : le tableau récapitulatif (« TOTAL HT / TVA / TOTAL TTC ») et
     le tableau des prestations (colonnes Qté/Unité/Désignation/Prix
     unitaire/Montant) de ce modèle de facture s'avèrent directement et
     fiablement exploitables sous forme de tableau, avec fusion des
     lignes de désignation sur plusieurs lignes. L'heuristique texte
     générique reste utilisée en repli pour les factures scannées ou de
     mise en page différente.
   - **Reconnaissance du numéro de facture** : ce modèle écrit parfois
     « Facture » et « N° : 2026_01 » sur deux lignes séparées, ou fusionne
     « N° : 2026_01 » au milieu d'une ligne contenant aussi le RC/ICE — ni
     la détection générique (même ligne obligatoire) ni les indices
     existants (« numéro »/« numero » littéral) ne couvraient ce cas.
     Deux nouvelles expressions régulières ont été ajoutées en repli, en
     excluant explicitement les lignes « référence »/« bon de commande »
     pour ne pas capturer par erreur le numéro de bon de commande du
     client à la place du numéro de facture.
   - **Reconnaissance du nom du client** par repli à trois niveaux :
     ligne d'étiquette (« Client : », « Facturé à », etc.) → recherche
     dans les cellules de tableau (plus robuste quand la mise en page
     fusionne des colonnes) → scoring générique de ligne d'en-tête
     d'entreprise (réutilisé du module fournisseurs).
2. **Nouvelles routes backend** `backend/routes/facture_client.py`
   (blueprint `facture_client`, enregistré dans `app.py`), miroir
   simplifié des routes fournisseurs : import multi-fichiers avec
   reconnaissance immédiate de chaque facture, annulation d'un lot en
   cours, finalisation d'un fichier (renommage/classement sur disque),
   téléchargement d'un fichier déjà classé. Dossier de stockage fixe
   `data/factures_clients/<année>/<mois>/`, nommé
   `AAAA_MM_JJ_NomClient_Référence.pdf` (non configurable, hors périmètre
   retenu).
3. **Écran « Factures »** (`static/js/app.js`) : nouveau bouton
   « Importer des factures (PDF) », qui ouvre un **écran de relecture
   obligatoire** avant tout enregistrement — une ligne par facture
   reconnue, avec pour chacune : fichier, client (menu déroulant +
   bouton « + Ajouter ce client » si le nom deviné ne correspond à
   aucun client existant, ouvrant directement la fiche client pré-remplie
   et re-sélectionnant automatiquement la fiche créée), numéro, date,
   référence, désignation et montants HT/TVA/TTC — tous modifiables avant
   validation. Chaque ligne peut aussi être écartée de l'import. À
   l'enregistrement, chaque ligne conservée est sauvegardée directement
   en statut `validee`/verrouillée (en contournant le flux normal
   brouillon→validation, puisqu'il s'agit de documents déjà émis) puis
   déclenche la génération de l'écriture comptable de vente, exactement
   comme une facture validée normalement. Dans la liste des factures, une
   pastille « import » distingue visuellement ces lignes des factures
   créées normalement dans l'application.

Validé de bout en bout via Playwright, avec les 9 vraies factures PDF
fournies par l'utilisateur (pas de données synthétiques) :
reconnaissance correcte des 9 numéros, dates, montants HT/TVA/TTC et
noms de client ; création à la volée des 3 clients distincts (Butec,
Jesa, Cegelec) réutilisés correctement entre les lignes d'un même
client ; les 9 lignes enregistrées avec succès (`statut:'validee'`,
`verrouillee:true`, `referenceHistorique` renseignée, aucun numéro
FAC-AAAA-NNNNN officiel attribué) ; 9 écritures comptables de vente
générées ; fichiers correctement classés sur disque par année/mois et
renommés ; affichage en lecture seule/verrouillée après import ;
pastille « import » visible dans la liste ; aucune erreur JavaScript.
Suite de régression (création normale d'un client, création normale
d'une facture hors import) rejouée sans casse sur base fraîche.

## Ajout V1.46 : répertoire de stockage configurable pour les factures clients + nommage distinctif des fichiers

Demande explicite, en suite directe de la V1.45 : « donner la possibilite
de specifier le repertoire de sauvegarde des factures / la nomination des
factures client sera differente de celle des facture fournisseur:
Preceder le nom par le mot Facture ». Deux questions posées via
AskUserQuestion avant implémentation, toutes deux confirmées avec l'option
recommandée : (1) lors d'un changement de répertoire, les fichiers déjà
classés dans l'ancien répertoire sont **déplacés automatiquement** vers le
nouveau (même comportement que pour les factures fournisseurs, V1.25) ;
(2) format de nom retenu : `Facture_AAAA_MM_JJ_NomClient_Référence.ext`.

1. **Répertoire de stockage configurable** (`backend/routes/facture_client.py`) :
   la constante fixe `STORAGE_DIR` est remplacée par `get_storage_dir()`
   (relit à chaque appel le champ `facturesClientsDir` de la fiche
   `settings/company` ; vide ou absent → repli sur le répertoire par défaut
   de l'installation), exactement le même principe que
   `get_storage_dir()` du module Factures fournisseurs. Nouvelle route
   `POST /api/facture-client/storage-dir` : valide que le nouveau
   répertoire est accessible en écriture (le crée si besoin), **déplace
   tout le contenu déjà présent** (dossier d'attente `_pending` + classement
   année/mois) vers le nouveau via `_merge_move_dir` (fusion des
   sous-dossiers de même nom, renommage en cas de collision — jamais
   d'écrasement silencieux, fonction reprise à l'identique du module
   fournisseurs), puis enregistre le réglage. Un chemin vide réinitialise
   vers le répertoire par défaut.
2. **Nouvelle carte Paramètres « Stockage des factures clients »**
   (`static/js/app.js`), juste après celle des factures fournisseurs :
   champ de saisie du chemin, affichage du répertoire actuellement utilisé,
   bouton « Enregistrer » avec confirmation obligatoire (`confirmDialog`,
   le déplacement physique de fichiers n'étant pas à déclencher par
   erreur) avant d'appeler la nouvelle route.
3. **Nommage distinctif** : `build_final_rel_path` produit désormais
   `Facture_AAAA_MM_JJ_NomClient_Référence.ext` (préfixe `Facture_` ajouté),
   alors que les factures fournisseurs restent nommées sans ce préfixe
   (`AAAA_MM_JJ_NomFournisseur_Numéro.ext`, inchangé) — pour distinguer au
   premier coup d'œil un fichier de facture client d'un fichier de facture
   fournisseur, utile en particulier si les deux répertoires venaient à
   être rapprochés sur un même support (disque externe, partage réseau).

Validé via l'API puis via Playwright, sur base fraîche : import et
classement d'une facture client réelle (nom de fichier vérifié préfixé
`Facture_`) ; changement du répertoire de stockage vers un nouveau dossier
— fichier retrouvé au nouveau chemin, absent de l'ancien, réglage persistant
après rechargement complet de la page ; nouvel import après le changement
confirmé classé dans le nouveau répertoire, toujours préfixé `Facture_` ;
remise au répertoire par défaut (chemin vide) — fichiers de nouveau
déplacés correctement. Suite de régression rejouée sans casse sur base
fraîche : import des 9 vraies factures clients (V1.45, toujours 9/9
correctes), module Factures fournisseurs (import, création de fournisseur,
changement de son propre répertoire de stockage, numérotation des
fichiers inchangée sans préfixe) — aucune fonction partagée n'a été
modifiée au-delà de l'ajout strictement localisé au module Factures
clients. Aucune erreur JavaScript sur l'ensemble des scénarios.

## Ajout V1.47 : bouton « Parcourir… » (Explorateur Windows) pour les répertoires de factures fournisseurs et clients

Demande explicite : « lors de specfication des repertoire factures
fourtnisseurs et client ajouter un bouton parcourir faire appel a l
explorateur windows ».

Une boîte de dialogue native de sélection de dossier (Explorateur Windows,
Finder Mac, sélecteur Linux — exécutée côté serveur via `tkinter`,
`backend/routes/db_admin.py` : `_dialogue_natif`/`GET /api/db/choisir-dossier`)
existait déjà depuis la V1.41, mais uniquement pour l'emplacement de la
base de données (*Paramètres > Base de données*). Cette route et la
fonction frontend associée (`parcourirChemin`, `static/js/app.js`) sont
totalement génériques — aucune dépendance au contexte « base de
données » — et ont donc pu être **réutilisées sans aucun changement
backend**, en ajoutant simplement un bouton **« Parcourir… »** à côté de
chacun des deux champs de répertoire concernés :

- *Paramètres > Stockage des factures fournisseurs* (`#sf-stockage-dir`).
- *Paramètres > Stockage des factures clients* (`#sf-stockage-dir-clients`,
  V1.46).

Chaque bouton ouvre l'Explorateur natif du système (titré distinctement
selon le champ : « ... des factures fournisseurs » / « ... des factures
clients ») et remplit le champ texte avec le dossier choisi — le bouton
« Enregistrer » existant (avec sa confirmation et son déplacement
automatique des fichiers déjà classés, V1.25/V1.46) reste ensuite
inchangé. Sur un poste sans environnement graphique disponible (ou sans
`tkinter`), le même repli déjà en place pour la base de données
s'applique automatiquement : le navigateur de dossiers « maison » intégré
à l'application s'ouvre à la place, sans aucune différence de
comportement pour l'utilisateur au-delà de l'apparence.

Validé via Playwright (environnement de développement sans interface
graphique, donc repli sur le navigateur maison systématiquement
exercé) : les deux boutons sont présents, chacun ouvre la bonne fenêtre
avec le titre attendu, la sélection d'un dossier remplit correctement le
champ correspondant (fournisseurs et clients testés séparément, sans
interférence entre les deux). Revalidé sans régression : le navigateur de
dossiers existant pour la base de données (sélection de répertoire,
sélection de fichier `.db`, reprise d'une ancienne base), ainsi que le
flux complet d'import des 9 vraies factures clients. Aucun changement
backend, aucune erreur JavaScript.

## Ajout V1.48 : accès direct au PDF d'origine des factures clients importées + liste organisée par année

Demande explicite, à partir d'une capture d'écran de la liste des factures
(plusieurs dizaines de factures importées à plat) : « pour chaque facture
client donner acces aux factures pdf deja sauvegarde dans le repertoire
specifi / Garder la possibilite de l impression en pdf pour eventuel
changement / Au niveau affichage sur l application organiser par annee ».
Compréhension présentée avant implémentation, deux questions posées via
AskUserQuestion, toutes deux confirmées avec l'option recommandée : le
regroupement par année se présente sous forme de **sections repliables**
(comme l'écran « Exercices archivés ») et s'applique à **toutes les
factures** (créées normalement dans l'application ET importées), pas
seulement à ces dernières.

1. **Accès direct au PDF d'origine** (`static/js/app.js`) : nouvelle
   fonction `factureClientFileUrl(f)`, reprise à l'identique du principe
   déjà existant pour les factures fournisseurs (`factureFournisseurFileUrl`,
   V1.16) — construit l'URL `GET /api/facture-client/file/<chemin>` à
   partir du `fileRelPath` déjà enregistré sur chaque facture importée
   depuis la V1.45. Un nouveau lien (icône document, ouverture dans un
   nouvel onglet) apparaît dans la liste, uniquement sur les lignes qui en
   disposent — c'est-à-dire les factures importées ; les factures créées
   normalement dans l'application n'ont pas de PDF d'origine et n'affichent
   donc pas ce lien, sans aucun changement de comportement pour elles.
2. **Impression PDF conservée à l'identique** : le bouton « Imprimer »
   existant (génère un PDF depuis le modèle de l'application) n'a pas été
   touché — il reste disponible sur toutes les factures, à côté du nouveau
   lien vers le PDF d'origine quand il existe.
3. **Liste organisée par année** : la liste des factures (auparavant un
   seul grand tableau à plat) est désormais découpée en **sections
   repliables par année** (la plus récente en premier), chacune affichant
   le nombre de factures et le total net de l'année dans son bandeau
   d'en-tête. L'état replié/déplié de chaque année est conservé en mémoire
   côté application (variable `facAnneesRepliees`) : sans cela, le cycle de
   synchronisation automatique de l'application (reconstruction complète de
   l'écran toutes les 2 secondes) aurait rouvert silencieusement toute
   année que l'utilisateur vient de replier. Le filtre de recherche
   existant (numéro/client) continue de fonctionner normalement à travers
   les sections : seules les années contenant au moins un résultat
   s'affichent.

Validé via Playwright, sur base fraîche comportant les 9 vraies factures
clients importées (toutes en 2026) : un seul lien de PDF d'origine par
facture importée (9/9), fichier effectivement accessible et servi en
`application/pdf` ; une seule section « 2026 » affichée ; repliage d'une
section vérifié persistant après un cycle complet de synchronisation
(2,5 s d'attente) ; redéploiement correct. Testé ensuite avec deux
factures supplémentaires créées directement en base sur 2024 et 2025 :
trois sections affichées, correctement triées par année décroissante
(2026, 2025, 2024) ; le filtre de recherche restreint bien l'affichage à
la seule année contenant une correspondance. Suite de régression rejouée
sans casse : création normale d'un client et d'une facture (hors import),
import complet des 9 factures clients réelles. Aucune erreur JavaScript.

## Ajout V1.49 : correction de l'import — récupération des tableaux d'articles sans lignes de séparation + sauvegarde du détail complet (plus d'une seule ligne de synthèse)

Signalement, à partir de deux captures d'écran (le PDF imprimé par l'application montrant une seule ligne consolidée Qté 6,3 / Montant 31 510,08, comparé au vrai PDF d'origine montrant ~22 sous-lignes détaillées par intervenant) : « Lors de l import tous les item ne sont pas repris / Expliquer ce que vous avez compris ? ». Le vrai fichier a été demandé et fourni (`Facture_2025_10_13_JESA_2025_10_25.pdf`) avant toute correction, conformément à la pratique déjà suivie dans ce projet.

Deux causes distinctes identifiées par inspection directe du fichier réel, l'une corrigeant l'extraction, l'autre un choix d'architecture confirmé par l'utilisateur via AskUserQuestion :

1. **Extraction (`backend/facture_client_parser.py`)** : sur cette facture, le tableau d'articles n'a aucune ligne de séparation horizontale entre chaque article (seulement un cadre extérieur). L'outil d'extraction de tableaux (pdfplumber), avec sa détection par défaut basée sur les traits, fusionnait alors tout le bloc d'articles en une seule « ligne de tableau », chaque colonne (Qté/Unité/Désignation/PU/Montant) contenant toutes les valeurs des ~22 articles réels empilées et séparées par des retours à la ligne — l'ancienne logique ne lisait que la toute première valeur de chaque colonne, d'où la ligne unique consolidée observée. Nouvelles fonctions `_cell_is_merged`/`_table_looks_merged` : détectent ce cas de fusion (colonne numérique contenant plusieurs valeurs empilées) ; quand il est détecté, `_extract_items_table` relance l'extraction du même tableau avec `horizontal_strategy="text"` (découpage des lignes par position du texte plutôt que par les traits), ce qui retrouve une ligne de tableau par article. Nouvelle fonction `_rows_to_lignes` (logique de construction des articles extraite de l'ancienne `_extract_items_table`, réutilisée pour les deux passes d'extraction) : gère en plus le cas d'une ligne à quantité vide/nulle mais à montant explicitement imprimé (ex. « 0,00 ») comme un article à part entière à quantité nulle, plutôt que de la perdre ou de la fusionner avec l'article précédent ; et, uniquement sur le chemin de récupération (`prefer_montant_qte=True`), reconstitue la quantité depuis Montant ÷ Prix unitaire plutôt que de garder la quantité telle qu'imprimée, qui peut être arrondie à l'affichage (ex. « 6,3 » alors que le montant correspond à une quantité réelle de 6,25) — ceci afin que la somme des lignes retombe exactement sur le total HT de la facture.
2. **Sauvegarde limitée à une seule ligne (`static/js/app.js`)** : repéré en creusant le sujet, indépendamment du bug ci-dessus — même quand le moteur d'extraction détectait correctement plusieurs lignes, l'écran de relecture avant import et l'enregistrement final ne gardaient jusqu'alors qu'une seule ligne de synthèse par facture importée (quantité et désignation du tout premier article détecté, prix unitaire recalculé HT ÷ quantité), quel que soit le nombre d'articles réellement détectés. Question posée via AskUserQuestion sur la façon de gérer ces lignes multiples : option recommandée confirmée — **enregistrement automatique du détail complet tel que détecté**, sans nouvel écran de correction ligne par ligne à l'import (écarté : ajouter un tableau détaillé par article directement sur l'écran d'import, jugé trop lourd quand plusieurs factures sont importées en même temps). `wireFactureClientEnCours` : quand plus d'une ligne est détectée (`lignesGuess.length > 1`), la facture est enregistrée avec le tableau complet des lignes détectées (designation/unité/qté/PU de chacune) au lieu d'une ligne de synthèse ; comportement inchangé dans le cas usuel (une seule ligne détectée). Sur l'écran de relecture, le champ Désignation éditable est alors remplacé par une pastille « N lignes détectées » (pour ne pas laisser croire qu'éditer un seul champ de désignation affecterait le détail) ; la correction d'une ligne individuelle après enregistrement se fait via le bouton Modifier (crayon) déjà existant, qui ouvre le même éditeur de lignes complet que pour une facture normale.

Validé directement sur le fichier réel fourni par l'utilisateur (`Facture_2025_10_13_JESA_2025_10_25.pdf`) : 22 lignes extraites (18 avec un montant réel, 4 à quantité nulle correctement conservées comme lignes à part), total recalculé 31 510,08 DH identique au Total HT de la facture au centime près. Import complet rejoué via l'interface réelle (pas seulement en appel direct du moteur d'extraction) : pastille « 22 lignes détectées » affichée sur l'écran de relecture, facture enregistrée avec ses 22 lignes, rouverture via le bouton Modifier confirmant l'affichage correct du détail complet (désignations, quantités, prix unitaires et montants individuels conformes au PDF d'origine). Suite de régression rejouée sur les 9 vraies factures déjà importées avec succès (toutes à une seule ligne légitime) : comportement strictement identique à l'avant-correction, aucune ligne supplémentaire ni perdue, aucun montant modifié.

## Ajout V1.50 : numéro modifiable pour les factures clients déjà importées (contrôle d'unicité)

Demande de l'utilisateur (verbatim) : « donner la possibilite de changer le numero de factures importees / Il doit etre unique ».

Les factures clients importées sont enregistrées « Validées » et verrouillées dès l'import (RG-003) ; leur `numero` est la référence d'origine du document (RG-009), pas un numéro `FAC-AAAA-NNNNN` officiel. Jusqu'ici, aucune erreur de transcription sur cette seule référence (faute de frappe, confusion entre deux factures proches...) ne pouvait être corrigée sans tout réimporter, puisque l'écran « Modifier » verrouille tous les champs pour une facture verrouillée.

1. **Nouveau bouton « N° »** (`static/js/app.js`, `facRowHtml`) dans la liste des factures : visible uniquement sur les factures portant un `referenceHistorique` (donc uniquement les factures importées — jamais sur les factures créées normalement dans l'application, dont le numéro est attribué et verrouillé de façon atomique par `validateFacture()`, P-09, et ne doit jamais être modifié à la main). Ouvre un petit modal dédié (`openFactureClientNumeroEditModal`) qui ne permet de modifier QUE ce champ — montants, lignes, client restent verrouillés (RG-003 inchangé par ailleurs).
2. **Contrôle d'unicité** (`findFactureClientDoublon`) : avant tout enregistrement, vérifie qu'aucune AUTRE facture cliente (tous clients confondus, tous statuts) ne porte déjà le même numéro (comparaison insensible à la casse et aux espaces superflus, via `normNumeroFacture` déjà existant). Différent du contrôle équivalent côté factures fournisseurs (unicité vérifiée uniquement par fournisseur, puisque ce sont alors des numéros attribués indépendamment par chacun des fournisseurs) : ici le numéro est celui que notre propre société a attribué à sa facture — il doit donc rester unique sur l'ensemble des factures clients, tous clients confondus. En cas de doublon, message d'erreur explicite nommant le client déjà titulaire de ce numéro ; le modal reste ouvert.
3. **Fichier d'origine renommé en conséquence** : si la facture dispose d'un PDF déjà classé sur disque, il est re-déplacé/renommé via la route `POST /api/facture-client/finalize-file` existante (même principe que la modification d'une facture fournisseur, `openFactureFournisseurEditModal`), pour que le nom de fichier reste cohérent avec le nouveau numéro affiché.
4. **Écriture comptable déjà générée non retouchée** : comme pour la correction du numéro d'une facture fournisseur existante (comportement déjà en place, inchangé), l'écriture de vente déjà comptabilisée pour cette facture (RG-004/005 : jamais modifiée, seule une contre-écriture peut la corriger) n'est pas régénérée — elle conserve le numéro qui était le sien au moment de sa création. Point à garder à l'esprit si le numéro est corrigé après coup : la pièce comptable gardera l'ancienne référence.

Validé via Playwright, sur base fraîche avec deux factures réellement importées (Butec, Jesa) : tentative de donner à l'une le numéro déjà utilisé par l'autre — correctement refusée avec message nommant le client en conflit, modal resté ouvert ; changement vers un numéro unique — accepté, modal fermé, fichier sur disque effectivement renommé (`...TEST_UNIQUE_999.pdf`), `referenceHistorique` mis à jour en conséquence, nouveau numéro visible dans la liste après le prochain cycle de synchronisation. Suite de régression rejouée sans casse : les 9 vraies factures clients (toujours 1 ligne chacune, montants inchangés) et l'import complet de la facture JESA à 22 lignes (V1.49, toujours exact). Aucune erreur JavaScript.

## Ajout V1.51 : amélioration de la reconnaissance des factures fournisseurs (OCR, ICE, TVA, fournisseur reconnu)

Signalement de l'utilisateur (verbatim) : « l outil relatif a la lecture des factures fournisseur N A PAS TROP FONCTIONNE / J AI DEMANDE A UNE AUTRE DE PERSONNE DE DEVELOPPER UN AUTRE OUTIL / C EST JOINT LE CODE PYTHON AINSI QUE LE GUIDE UTILISATEUR », accompagné du code source complet (`extract_factures.py`) et du guide utilisateur d'un outil externe, développé séparément, qui lit un lot de factures fournisseurs et produit un récapitulatif Excel.

Deux questions posées via AskUserQuestion avant toute modification, toutes deux confirmées avec l'option recommandée :

1. Que faire de cet outil externe : **intégrer sa logique dans le module existant** (`backend/facture_parser.py`) plutôt que de le garder comme outil séparé, d'en faire un pont d'import Excel, ou de se contenter d'une analyse.
2. Parmi les techniques de cet outil qui changent le modèle de données ou l'écran d'import (extraction du RIB, détection « ceci n'est peut-être pas une facture », auto-remplissage depuis un fournisseur déjà reconnu), seule la dernière a été retenue pour cette livraison — RIB et détection de type de document écartés (nécessitent un nouveau champ/une nouvelle alerte à l'écran, non demandés).

Quatre améliorations apportées à `backend/facture_parser.py` / `backend/routes/facture_fournisseur.py`, chacune inspirée d'une technique de l'outil externe partagé mais adaptée au module existant plutôt que copiée telle quelle :

1. **Pipeline OCR multi-passes avec prétraitement** (`_preprocess_for_ocr`, `_ocr_passes`, `_run_ocr`) : jusqu'ici, une page scannée/photographiée ne recevait qu'un seul appel brut à Tesseract, sans aucun traitement d'image. Désormais : redressement selon les métadonnées EXIF, recadrage sur le contenu (la marge blanche d'un scan n'aide pas l'OCR), agrandissement des petites images à 2400px de large (résolution insuffisante = 1ère cause d'erreur OCR d'après les tests de l'outil externe sur 76 factures réelles), renforcement du contraste, puis binarisation par seuil d'Otsu (`_otsu_threshold`, calculé à partir de l'histogramme de l'image plutôt qu'un seuil fixe). 3 passes Tesseract complémentaires sont ensuite effectuées (`--psm 6` sur l'image grise contrastée, `--psm 11` et `--psm 3` sur l'image binarisée) et leurs textes concatenés, chaque mode de segmentation ayant ses propres angles morts. Un texte « ordonné » (la seule des 3 passes, `--psm 6`, à conserver un ordre de lecture fiable de haut en bas — `--psm 11` en particulier lit le texte « sans ordre de lecture ») est conservé séparément (`extract_pages`/`split_invoices`, nouveau champ `textOrdonne`) et utilisé de préférence par les deux seules heuristiques qui supposent que « les premières lignes du texte » = « le haut du document » (nom du fournisseur en en-tête, numéro de facture près du titre) : les y exposer mélangées aux passes à l'ordre non garanti dégradait ces heuristiques plutôt que de les améliorer, constaté sur plusieurs factures réelles lors des tests.
2. **Tolérance d'un chiffre mal lu sur l'ICE de sa propre société** (`_ice_near_equal`, utilisée par `_guess_ice`) : un ICE détecté qui ne diffère que d'un chiffre inséré/supprimé/substitué par rapport à l'ICE de sa propre société (connu via Paramètres > Société) est maintenant écarté comme avant (match exact uniquement jusqu'ici), au lieu de risquer d'être pris à tort pour celui du fournisseur.
3. **Filtre de plausibilité du taux de TVA** (`_taux_tva_plausible`, taux usuels marocains 20/14/10/7 %) : appliqué aux deux replis les plus génériques de `_guess_montants` (recherche d'une triplette HT/TVA/TTC n'importe où dans le document, sans aucun libellé « TVA »/« total » à proximité) — en plus de la cohérence arithmétique HT+TVA=TTC, déjà vérifiée mais insuffisante à elle seule (de nombreux triplets de nombres sans lien entre eux la vérifient par hasard), le ratio TVA/HT doit maintenant correspondre à peu de choses près à un taux réellement en vigueur.
4. **Auto-remplissage depuis une fiche fournisseur déjà enregistrée, par ICE exact** (`_match_fournisseur_par_ice`, `_process_invoice_file`) : quand l'ICE détecté sur la facture correspond EXACTEMENT à celui d'une fiche fournisseur déjà enregistrée (identifiant officiel unique — la correspondance la plus fiable possible), le nom et l'ICE devinés sont remplacés par ceux, déjà vérifiés, de cette fiche plutôt que la lecture OCR fraîche ; pastille « Fournisseur reconnu (ICE) » affichée sur l'écran de relecture. Un simple rapprochement par nom (sous-chaine, déjà existant depuis une version antérieure) continue, lui, à seulement proposer un id de fournisseur sans écraser le texte deviné — une correspondance par sous-chaîne restant trop peu fiable pour ça.

Deux corrections supplémentaires, découvertes pendant les tests de régression ci-dessous et directement causées par l'ajout du pipeline OCR multi-passes (donc corrigées avant toute livraison, pas après) :

- La détection de la devise USD reconnaissait jusqu'ici un simple symbole « $ » isolé n'importe où dans le texte, sans exiger qu'il soit accolé à un montant (seul « € » avait déjà ce garde-fou, suite à un bug similaire constaté en V1.x antérieure) — avec 3 passes OCR au lieu d'une, un « $ » isolé issu du bruit de l'image (logo, tampon, texte dégradé) devenait nettement plus probable sur les factures de mauvaise qualité. Même garde-fou appliqué à « $ » : désormais exigé collé à un montant plausible.
- Sur une facture où seul le TTC était trouvé par un libellé générique (« Total » suivi d'un montant) mais pas le HT/TVA, le repli dédié aux 3 montants isolés chacun sur leur propre ligne (cas réel Logamine, déjà documenté) ne se déclenchait plus dès qu'UN SEUL des 3 montants était déjà connu — perdant alors HT/TVA alors qu'ils restaient présents, isolés, plus loin dans le texte. Repli assoupli pour se déclencher dès que HT ET TVA (pas forcément TTC) sont encore inconnus, avec une vérification de cohérence supplémentaire quand le TTC est déjà connu (le TTC retrouvé par le repli doit alors lui correspondre, pour ne pas accepter une triplette sans rapport).

Validé par une campagne de régression sur les 76 vraies factures fournisseurs déjà rassemblées dans ce projet (PDF natifs, scans et photos, plusieurs dizaines nécessitant l'OCR) : comparaison champ par champ avant/après sur l'ensemble du lot. Améliorations nettes et répétées, notamment sur le numéro de facture (plusieurs factures Marjane retrouvent leur vraie référence, ex. « 157/18-02-2026/002/14723 », au lieu du nom de fichier utilisé en dernier repli jusqu'ici) et sur des montants HT/TVA/TTC auparavant non trouvés du tout ; aucune régression résiduelle après les deux corrections ci-dessus (vérifié explicitement sur les deux cas qui en avaient révélé le besoin : facture Logamine, qui retrouve ses HT/TVA/TTC exacts, 3333,33/666,67/4000,00 DH ; plus plusieurs factures auparavant correctement reconnues en MAD qui étaient temporairement passées à tort en USD). Tests unitaires dédiés sur `_ice_near_equal`/`_guess_ice` (tolérance à 1 chiffre, rejet au-delà) et `_taux_tva_plausible`/`_guess_montants` (triplette à ratio TVA absurde rejetée, triplette à ratio plausible toujours acceptée). Test de bout en bout (appel direct à la route d'import, serveur réel) pour l'auto-remplissage : fiche fournisseur créée avec un ICE connu, import d'une facture réelle portant cet ICE → nom et id de fournisseur correctement repris de la fiche existante, pastille affichée ; import d'une facture sans fiche correspondante → comportement par défaut inchangé, aucun auto-remplissage.

Limite assumée pour cette version : le nom de fournisseur deviné (heuristique de score par ligne d'en-tête, inchangée par ailleurs) reste parfois moins bon qu'avant sur une minorité de photos de mauvaise qualité, quand les 3 passes OCR lisent différemment un mot déterminant pour le score (ex. « GROUP » correctement lu par l'ancien OCR à passe unique, mais dégradé en un mot sans majuscule par le nouveau prétraitement sur une facture Bugshan réelle, faisant perdre au score de cette ligne son bonus et laissant gagner par erreur une ligne de slogan publicitaire) — ce champ reste, comme tout le module, une estimation à vérifier/corriger sur l'écran de relecture avant tout enregistrement, jamais une donnée validée automatiquement. L'OCR étant désormais exécuté en 3 passes au lieu d'une sur toute page scannée/photographiée, l'import d'un lot de factures nécessitant l'OCR est sensiblement plus lent qu'avant (environ 2 fois, mesuré sur le lot de test) ; aucun impact sur les factures en PDF natif (texte déjà présent, jamais passées à l'OCR).

## Ajout V1.52 : le bouton « Traitement » explore aussi les sous-dossiers du dossier « à traiter »

Origine : une discussion de clarification sur les emplacements de factures côté application (suite à des captures d'écran des réglages *Paramètres > Stockage des factures fournisseurs* et de l'écran d'import), au cours de laquelle l'utilisateur a précisé sa demande : « ce que je veux dire lors de l'import des factures fournisseurs on recherche egalement les factures dans les sous repertoires du repertoire specifie par l'utilisateur ».

Deux questions posées via AskUserQuestion avant toute modification :

1. Quel réglage est concerné : le dossier « à traiter » (bouton Traitement, *Paramètres > Factures fournisseurs à traiter*, lit déjà un dossier pour y trouver des factures à importer, mais seulement à sa racine depuis la V1.29) ou le répertoire de Stockage (qui est, lui, une simple destination d'archivage après validation, jamais scanné) ? **Réponse retenue : le dossier « à traiter » devient récursif** — le répertoire de Stockage reste une destination, inchangé.
2. Une fois une facture trouvée dans un sous-dossier validée à l'écran de relecture, que doit devenir le fichier d'origine à son emplacement trouvé ? **Réponse retenue : il est déplacé/renommé vers le classement année/mois habituel** — comportement strictement identique à celui déjà en vigueur aujourd'hui pour un fichier trouvé à la racine (classement normal dans le répertoire de Stockage, puis suppression de son emplacement d'origine dans le dossier « à traiter » une fois toutes ses factures validées).

Ce qui a été construit (`backend/routes/facture_fournisseur.py`) :

- `process_source_dir` (bouton Traitement) parcourt désormais le dossier source configuré **et la totalité de ses sous-dossiers, à n'importe quelle profondeur** (`os.walk`, tri déterministe), au lieu de se limiter à sa racine. Les fichiers trouvés dans un sous-dossier suivent exactement le même circuit que ceux de la racine (découpage multi-factures, devinette des champs, modèle de zones, puis classement et suppression du fichier d'origine à la validation) — aucun changement de comportement pour les fichiers déjà à la racine.
- Le nom affiché à l'écran de relecture (`fileName`) est préfixé du sous-dossier d'origine relatif au dossier source configuré (ex. `2025/006_Logamine/Fact Logamine.pdf`) quand le fichier vient d'un sous-dossier, pour distinguer d'un coup d'œil deux fichiers de même nom provenant de sous-dossiers différents (cas réel avec un classement année/fournisseur) — un dossier source organisé comme l'archive comptable réelle de l'utilisateur (année puis fournisseur) en bénéficie directement.
- **Garde-fou de sécurité ajouté** (`_dirs_overlap`), dans les deux sens : le dossier « à traiter » et le répertoire de Stockage ne doivent jamais se chevaucher (être identiques, ou l'un contenu dans l'autre). Un chevauchement aurait, avec la recherche désormais récursive, un vrai risque de perte de données : un fichier tout juste classé dans le Stockage serait retrouvé au traitement suivant comme s'il s'agissait d'une nouvelle facture à traiter, puis supprimé de son emplacement par `delete_source_files` une fois « validé » une seconde fois. Ce garde-fou est vérifié à l'enregistrement de CHAQUE réglage (`set_source_dir` ET, nouveauté symétrique, `set_storage_dir`) ET de nouveau juste avant de lancer un Traitement (`process_source_dir`), au cas où l'un des deux réglages aurait changé après coup — un message d'erreur explicite est renvoyé dans les trois cas, sans qu'aucun fichier ne soit touché.
- Correction annexe, trouvée en creusant la confusion initiale de l'utilisateur entre Stockage et dossier « à traiter » : le message d'erreur affiché quand on clique sur « Traitement » sans avoir configuré ce dossier renvoyait par erreur vers *Paramètres > Stockage des factures fournisseurs* (mauvais réglage) au lieu de *Paramètres > Factures fournisseurs à traiter* — corrigé. Le texte d'aide de la carte *Paramètres > Factures fournisseurs à traiter* a aussi été mis à jour pour mentionner la recherche récursive et le garde-fou anti-chevauchement.

Validation effectuée : reproduction d'une arborescence réaliste à 3 niveaux (racine + deux sous-dossiers `<année>/<fournisseur>`, avec un fichier à chaque niveau, sur un serveur réel démarré pour l'occasion) — les 3 fichiers sont bien retrouvés par le bouton Traitement, avec le nom préfixé du sous-dossier pour les deux fichiers imbriqués ; après validation des deux factures issues des sous-dossiers, leurs fichiers sont bien déplacés/renommés dans le répertoire de Stockage (classement année/mois habituel) ET supprimés de leur sous-dossier d'origine, le fichier de la racine (pas encore validé) restant lui intact à son emplacement. Garde-fou testé dans les 4 configurations possibles (dossier « à traiter » = Stockage, dossier « à traiter » parent de Stockage, Stockage = dossier « à traiter », Stockage parent de dossier « à traiter ») : chacune refusée avec un message explicite, à l'enregistrement du réglage ET lors d'une tentative de Traitement après un changement de réglage ultérieur ; confirmé qu'un répertoire de Stockage peut toujours être changé librement tant qu'aucun dossier « à traiter » n'est configuré (cas par défaut, le plus fréquent). Import classique par sélecteur de fichiers du navigateur (`import_files`, code non touché par ce changement) revérifié sans régression.

## Ajout V1.53 : tout nouveau client ou membre du personnel est aussi ajouté au registre Tiers bancaires / Fournisseurs

Origine : capture d'écran de la carte *Paramètres > Tiers bancaires / Fournisseurs* envoyée par l'utilisateur, avec la demande (verbatim) : « TOUT AJOUT DE CLIENT FOURNISSEUR OU MEMBRE DU PERSONNEL DOIT ETRE AJOUTE A CETTE LISTE ».

Un point vérifié avant toute implémentation : le **Fournisseur** l'était déjà depuis la V1.16 — la page « Fournisseurs » n'est qu'une vue filtrée de ce même registre partagé (collection `tiersBancaires`, type = « Fournisseur »), donc aucun développement n'était nécessaire de ce côté. **Client** et **Personnel** sont en revanche deux registres totalement séparés (`clients`, `personnel`), jamais liés à `tiersBancaires` jusqu'ici — c'est ce lien qui a été construit.

Quatre questions posées via AskUserQuestion avant toute implémentation (le registre Personnel contenant une donnée sensible — le salaire — volontairement tenue à l'écart de `tiersBancaires` depuis la V1.31) :

1. Informations copiées dans la fiche Tiers : **le nom uniquement (retenu)** — jamais le salaire ni aucune autre coordonnée, pour ne pas dupliquer de données à maintenir à deux endroits.
2. Personnel malgré la donnée sensible : **confirmé, une fiche Tiers par employé (nom seul, type « Salarié »)** — pour pouvoir reconnaître les virements de salaire dans les relevés bancaires.
3. Nom en double avec une fiche déjà existante (ex. un fournisseur homonyme) : **réutiliser la fiche existante (retenu)** — jamais de nouvelle fiche créée dans ce cas, même logique que la détection de doublons déjà en place pour les fournisseurs.
4. Renommage/suppression ultérieur du client ou de l'employé : **la fiche Tiers liée suit automatiquement (retenu)**, sauf si elle est encore utilisée ailleurs, auquel cas elle est conservée avec un avertissement.

Ce qui a été construit :

- **`static/js/app.js`**, nouvelle fonction `syncTiersPourFiche(col, type, id, nom, existing)`, appelée par `saveClient` et `savePersonnel` à chaque création ou modification (jamais bloquante : une erreur de synchronisation est seulement loguée en console, la sauvegarde du client/employé réussit toujours). Logique : si un homonyme existe déjà dans `tiersBancaires` (n'importe quel type), la fiche du client/employé est liée à cette fiche existante (`tiersAuto:false`, jamais modifiée ni supprimée automatiquement par la suite) ; sinon une nouvelle fiche est créée (`tiersAuto:true`, type `Client` ou `Salarié`, nom seul — aucun autre champ copié) et suivie automatiquement (renommée si le client/employé est renommé, y compris en re-détectant un homonyme apparu entre-temps).
- Nouvelle fonction `supprimerTiersAutoSiOrphelin(record)` : supprime la fiche Tiers auto-créée liée à un client/personnel supprimé, uniquement si elle a bien été créée par ce mécanisme (`tiersAuto:true`, jamais une fiche réutilisée) ET que plus aucun autre client, personnel ou facture fournisseur enregistrée ne la référence ; sinon elle est conservée et un avertissement (`toast`) en informe l'utilisateur. Câblée sur les boutons Supprimer des pages Clients et Personnel.
- **Migration de démarrage** (`backend/db.py`, `_migrate_clients_personnel_tiers_if_needed`, idempotente comme les migrations existantes) : relie au registre `tiersBancaires` chaque fiche Client ou Personnel déjà présente avant cette version (champ `tiersId` absent), avec exactement la même règle de réutilisation d'homonyme qu'en JS (comparaison de nom normalisée à l'identique — accents/casse/espaces ignorés — jamais une correspondance floue par sous-chaîne comme celle utilisée pour deviner un fournisseur depuis le texte OCR d'une facture).
- Texte d'aide de la carte *Paramètres > Tiers bancaires / Fournisseurs* mis à jour pour mentionner ce nouveau comportement.

Validation effectuée (test de bout en bout avec un navigateur piloté, sur un serveur réel démarré pour l'occasion) :

- Création d'un client → fiche Tiers créée automatiquement (type « Client », nom seul, `tiersAuto:true`) ; renommage du client → la fiche Tiers suit.
- Création d'un membre du personnel avec salaire renseigné → fiche Tiers créée (type « Salarié ») **sans aucun champ salaire**.
- Création d'un fournisseur « Omnium Logistique » puis d'un client du même nom exact → le client est lié à la fiche fournisseur existante (`tiersAuto:false`), aucun doublon créé, type de la fiche fournisseur inchangé.
- Suppression du client homonyme → la fiche fournisseur réutilisée survit intacte. Suppression du client dont la fiche Tiers avait été créée spécifiquement pour lui (non partagée) → sa fiche Tiers est bien supprimée avec lui.
- Migration de démarrage testée sur des données « legacy » insérées directement en base (un client ordinaire, un client homonyme exact d'un fournisseur déjà existant, un membre du personnel avec salaire) : les trois sont correctement rattachés au redémarrage (le client homonyme réutilise la fiche fournisseur sans la dupliquer ni en changer le type, le salaire n'est jamais copié) ; idempotence vérifiée par un second redémarrage sans effet (aucune fiche supplémentaire créée).

## Ajout V1.54 : module Livrables techniques (première étape d'une gestion de projet d'ingénierie)

Origine : demande (verbatim) « je souhaite ajouter un module de gestion de projet ingenierie / quelle est la demarche que vs me proposez? », sur le même modèle que la demande ayant initié le module Comptabilité — une démarche a été proposée (clarifier le périmètre par questions, proposer un plan en étapes, implémenter uniquement la première étape validée, tester, documenter, livrer) avant toute ligne de code.

Trois séries de questions posées via AskUserQuestion :

1. (4 questions) Un « projet d'ingénierie » correspond au chantier vu sous l'angle technique (confirmé) ; les quatre besoins proposés (suivi des livrables techniques, planning/avancement, charge de travail par ingénieur, suivi budgétaire) ont tous été cochés comme manquants ; le périmètre de cette première version devait rester restreint (retenu) ; les droits d'accès ont été laissés ouverts à ce stade.
2. (2 questions, le périmètre restreint et les quatre besoins cochés étant contradictoires) Le socle de cette V1 devait être le **suivi des livrables techniques** (retenu) ; les droits d'accès par défaut devaient être **Administrateur + Conducteur de travaux** (retenu).
3. (4 questions de conception) Le livrable se rattache **au Contrat** (déjà l'ancrage des Attachements) plutôt qu'au Devis (retenu) ; pas de fichier joint dans cette version, **informations seules** (retenu) ; l'indice de révision est en **lettres (A, B, C…)** (retenu) ; le cycle de statuts retenu est **À faire / En cours / Émis / Validé client / Remarques à intégrer / Annulé**.

Ce qui a été construit :

- Nouveau registre indépendant **`livrables`** (collection générique « documents », comme Clients/Fournisseurs/Personnel) : un livrable technique n'entre pas dans le périmètre des 10 documents commerciaux et de facturation régis par le CDC de nomenclature/numérotation (devis, commande, contrat, avenant, attachement, PFA, facture, avoir, encaissement) — pas de numéro officiel attribué, suppression physique autorisée (pas de règle d'annulation obligatoire comme pour les documents du CDC). Zéro changement de route côté serveur Python : le module repose entièrement sur l'API générique « documents » déjà existante (`backend/routes/api.py`), seul `APP_VERSION` a été mis à jour (`backend/db.py`).
- Champs de la fiche : Contrat (sélection obligatoire, parmi les contrats déjà existants), type de document (Plan / Note de calcul / Rapport / Autre), désignation, indice de révision (lettre), statut, date d'émission, destinataire, notes. Le client est automatiquement dénormalisé depuis le contrat choisi (`clientId`/`clientNom`), suivant la même convention que les autres documents du pipeline. Le contrat n'est plus modifiable une fois le livrable créé (même principe que le champ Commande des Avenants/Attachements).
- **Choix d'architecture non explicitement demandé à l'utilisateur, à valider ou corriger si besoin** : à la différence des Avenants et Attachements, qui créent automatiquement un Contrat à partir d'une Commande qui n'en a pas encore (`ensureContratForCmd`), un Livrable ne crée jamais de contrat lui-même — il ne peut se rattacher qu'à un contrat déjà existant, à créer au préalable depuis le menu « Contrats » si besoin. Raison : éviter de générer un document commercial officiel, numéroté et soumis aux règles du CDC, comme simple effet de bord de la saisie d'un suivi technique léger.
- Accès restreint via la matrice `ACCESS` (`livrables:{admin:'full', commercial:'none', chantier:'full', comptable:'none'}`) : seuls Administrateur et Conducteur de travaux voient l'entrée de menu « Livrables techniques » et peuvent créer/modifier/supprimer ; Commercial et Comptable ne voient même pas l'entrée.
- Page avec recherche (désignation, contrat, client, destinataire), état vide dédié, et un texte d'aide rappelant explicitement que le planning/avancement, la charge de travail par ingénieur et le suivi budgétaire du projet sont reportés à de prochaines versions.

Validation effectuée (test de bout en bout avec un navigateur piloté, sur un serveur réel démarré pour l'occasion) :

- Préparation du pipeline Client → Commande → Contrat, puis création d'un livrable rattaché à ce contrat : tous les champs correctement enregistrés, y compris la dénormalisation du client depuis le contrat.
- Modification du livrable (indice de révision, statut) : le contrat reste inchangé et son sélecteur est bien désactivé une fois le livrable créé.
- Recherche dans la liste des livrables : filtre correctement sur un terme présent.
- Contrôle d'accès par rôle (utilisateurs Commercial, Comptable et Conducteur de travaux créés pour le test) : le menu « Livrables techniques » est absent pour Commercial et Comptable, présent avec accès complet (création comprise) pour Conducteur de travaux.
- Suppression d'un livrable : bien supprimé du registre après confirmation.
- **Non-régression** : rejeu du pipeline classique Client → Commande → Avenant (création automatique du contrat via `ensureContratForCmd`, toujours intacte) → Attachement (réutilisation du même contrat, sans doublon) en parallèle du nouveau module, page Contrats toujours fonctionnelle, navigation entre Livrables techniques et les autres écrans sans collision — aucune régression constatée, aucune erreur JavaScript détectée dans la console sur l'ensemble des scénarios testés.

## Ajout V1.55 : sécurité réelle des accès (email + mot de passe, rôles côté serveur) + option PostgreSQL pour un hébergement dans le cloud

Origine : question posée (verbatim) « est ce que l application est organisee en micro service? », qui a amené à constater et expliquer que l'application est un monolithe (un seul processus Flask + un seul fichier SQLite) — choix adapté à l'usage local actuel. L'utilisateur a alors formulé la demande (verbatim) : « oui l objectif est de monter en puissance en plus de la securite d acces aux donnes. Merci de faire une proposition dans ce sens / C est une application qui est destinee a eter heberge dans le cloud avec multi utilisateurs et multi niveau d acces que nous allons deployer pas a pas ».

**Constat fait avant toute proposition** (voir `claude/architecture-cloud-securite.md`) : contrairement à ce que laissait croire le sélecteur de profil avec PIN, il n'existait **aucune vérification côté serveur** — le PIN n'était qu'une convenance d'affichage côté navigateur, et l'API générique de documents (`backend/routes/api.py`) ne faisait strictement aucun contrôle de rôle. N'importe qui connaissant ou devinant l'URL d'un poste pouvait lire et modifier toutes les données (y compris les salaires) par un simple appel direct à l'API, quel que soit le profil affiché à l'écran. C'est ce constat, et non une simple préférence, qui a justifié de traiter la sécurité des accès comme un préalable à tout hébergement dans le cloud.

Une proposition en paliers a été écrite (Palier 0 : authentification et autorisation réelles ; Palier 1 : migration SQLite → PostgreSQL ; Palier 2 : hébergement cloud ; Palier 3 : montée en charge future), puis quatre questions posées via AskUserQuestion avant implémentation :

1. Sens de « multi-utilisateurs » : **une seule société, plusieurs employés** (retenu) — pas une plateforme multi-clients (SaaS multi-tenant).
2. Méthode d'authentification : **email + mot de passe classique** (retenu) — abandon du PIN.
3. Choix de l'hébergeur : **laisser Claude proposer une option adaptée** (retenu) — voir recommandation ci-dessous.
4. Périmètre de cette version : **Palier 0 + migration PostgreSQL réunis dans la même livraison** (choix explicite de l'utilisateur, plus large que l'option resserrée initialement présentée comme recommandée).

Ce qui a été construit :

- **Authentification réelle** (`backend/auth.py`, `backend/routes/auth.py`) : chaque utilisateur a désormais un email et un mot de passe, stocké **haché** (`werkzeug.security`, PBKDF2/scrypt — jamais en clair, jamais renvoyé au navigateur même haché). Session serveur signée (cookie `HttpOnly`, `SameSite=Lax`, cookie sécurisé automatiquement dès qu'un hébergement PostgreSQL/cloud est détecté). Écrans de connexion/déconnexion réels (`#lf-email`/`#lf-password`), création du tout premier compte administrateur toujours proposée tant qu'aucun utilisateur n'existe.
- **Autorisation réelle côté serveur** (`backend/access.py`), appliquée de façon centralisée à **chaque** appel API (`app.before_request`) plutôt que dispersée route par route — une matrice unique (`ACCESS`) associe chaque section de l'application à ce que peut faire chaque rôle (aucun accès / lecture seule / lecture-écriture), avec un principe de **refus par défaut** : toute section non explicitement listée est refusée à tous sauf à l'administrateur. Un appel direct à l'API hors du périmètre d'un rôle renvoie désormais un vrai 403 (refusé) ; un appel sans session valide renvoie un vrai 401 (non connecté) — vérifié par appel direct, pas seulement par ce que montre l'écran.
- **Le navigateur ne charge plus que les données que le rôle connecté peut voir** (`static/js/app.js`, `subscribeCollection`) : jusqu'ici, tous les rôles chargeaient en mémoire la totalité des données (salaires compris), seul l'affichage à l'écran étant filtré. Cette fuite de confidentialité est corrigée : les sections hors du périmètre d'un rôle ne sont tout simplement plus interrogées.
- **Option PostgreSQL pour un hébergement cloud** (`backend/db.py`) : le fonctionnement local actuel (fichier SQLite) reste le comportement par défaut, strictement inchangé. En définissant la variable d'environnement `DATABASE_URL`, le serveur bascule automatiquement sur une base PostgreSQL — même code applicatif, aucune réécriture des quelque 53 endroits du code qui lisent/écrivent en base, à trois ajustements près (identifiants de requête, remplacement de la numérotation implicite propre à SQLite, verrou d'écriture adapté pour la numérotation transactionnelle des documents — toujours testé sans collision sous 50 requêtes concurrentes).
- **Outils de bascule fournis** : `scripts/migrate_sqlite_to_postgres.py` (copie unique, sans risque, de la base SQLite locale vers une base PostgreSQL — ne modifie jamais le fichier SQLite source, peut être relancé sans créer de doublons) et `scripts/set_user_password.py` (pour donner un email/mot de passe aux comptes existants d'une installation locale mise à niveau, qui n'avaient jusqu'ici qu'un PIN).
- **Dépendance PostgreSQL séparée** : `psycopg2-binary` (nécessaire uniquement au mode PostgreSQL/cloud) est fourni dans un fichier à part, `requirements-postgres.txt`, à installer en plus de `requirements.txt` **uniquement sur le serveur d'hébergement cloud** (`pip install -r requirements.txt -r requirements-postgres.txt`) — voir le correctif ci-dessous, qui explique pourquoi ce paquet ne doit surtout pas être dans `requirements.txt`.

**Correctif du jour même (1/2)** : la toute première version de ce paquet plaçait `psycopg2-binary` directement dans `requirements.txt`, installé par défaut par `lancer_windows.bat`/`lancer_mac_linux.sh` même pour un usage local sans PostgreSQL. Or `psycopg2-binary` ne publie pas de wheel précompilée pour toutes les plateformes — en particulier **Windows sur processeur ARM64** (Copilot+ PC), exactement le même cas que `cryptography` déjà rencontré et épinglé plus haut dans ce fichier. Sur ces postes, l'installation tentait alors de compiler le paquet depuis les sources, ce qui exige les outils de développement PostgreSQL (`pg_config`) — absents de l'immense majorité des postes — et l'installation échouait entièrement, y compris pour l'usage local normal (SQLite) qui n'a pourtant aucun besoin de ce paquet. Repéré par l'utilisateur lui-même sur son propre poste (Windows ARM64), dès la première installation de ce paquet. Corrigé en sortant `psycopg2-binary` de `requirements.txt` vers `requirements-postgres.txt`, installé séparément et seulement là où il sert réellement (le serveur cloud PostgreSQL).

**Correctif du jour même (2/2)** : une fois l'installation corrigée, l'utilisateur a signalé un second incident, propre à l'assistant de premier démarrage (V1.40, choix de l'emplacement de la base + reprise d'une version antérieure) : un message « Erreur : Authentification requise. » apparaissait en cliquant sur « Récupérer cette base » pour reprendre l'une de ses anciennes bases (V1.46 à V1.54), alors qu'aucun écran de connexion n'avait encore été proposé. Cause : la nouvelle autorisation serveur (V1.55, voir `backend/access.py`) n'ouvrait les routes `/api/db/*` sans session que tant que la collection `users` de la base active était **vide**. Or adopter une ancienne base copie justement des utilisateurs **déjà existants** dans la base active, en plein milieu de cet assistant (entre le choix du répertoire et l'appel final qui marque l'assistant comme terminé) — cet appel final se retrouvait donc à tort soumis à authentification, sans qu'aucune session n'ait pu exister, bloquant l'utilisateur dans une boucle sans issue. Corrigé (`backend/db.py`, nouvelle fonction `assistant_initial_termine()`, et `backend/access.py`) en se basant plutôt sur l'indicateur « assistant de premier démarrage terminé » : tant qu'il ne l'est pas sur ce poste, aucun écran de connexion n'est encore affiché côté frontend, donc `/api/db/*` reste ouvert sans session — et se referme normalement, comme avant, dès que l'assistant est marqué terminé. Reproduit puis vérifié avec un test dédié (adoption d'une base contenant déjà un utilisateur, en zéro session) qui échouait avant le correctif (401) et réussit après, sans ouvrir la porte plus longtemps que nécessaire (un appel sans session après la fin de l'assistant reste bien refusé).

**Deux choix techniques faits sans question explicite à l'utilisateur, à valider ou corriger si besoin** :

- La matrice d'accès distingue volontairement deux sections pour le même registre `tiersBancaires` : une section large (lecture-écriture pour Administrateur, Commercial et Comptable) nécessaire au bon fonctionnement du lien automatique Client ↔ Tiers bancaire introduit en V1.53 (sinon un Commercial ne pourrait plus créer de client), distincte de la section plus étroite qui gère la visibilité de la page « Fournisseurs » elle-même (Administrateur et Comptable uniquement).
- La fonction `supprimerTiersAutoSiOrphelin` (V1.53), qui vérifie qu'une fiche Tiers n'est plus utilisée ailleurs avant de la supprimer automatiquement, a été rendue délibérément prudente : si le rôle connecté n'a pas accès à toutes les sections concernées (Personnel, Factures fournisseurs), la fiche est systématiquement conservée plutôt que supprimée à tort sur la base d'une vue incomplète.

**Recommandation d'hébergement** (l'utilisateur ayant laissé le choix à Claude, en précisant que l'application contient des données sensibles — salaires, données bancaires — ce qui oriente vers un hébergement en France/UE) : **Scalingo**, hébergeur français (Paris), certifié ISO 27001, conforme RGPD, avec une offre HDS (Hébergeurs de Données de Santé) si jamais pertinent plus tard. Choisi plutôt qu'une infrastructure brute (type OVHcloud Public Cloud) parce qu'il correspond directement à la façon dont l'utilisateur souhaite avancer : un déploiement progressif, « pas à pas », sans équipe d'exploitation dédiée — le déploiement se fait par un simple `git push`, la détection de l'application Flask est automatique, et une base PostgreSQL managée (sauvegardes incluses) se provisionne en quelques secondes. Coût de départ pour un tout petit volume (1 conteneur d'application + 1 base PostgreSQL, tailles d'entrée de gamme) : de l'ordre de **15 € HT/mois**, avec une montée en gamme progressive strictement à la demande si l'usage grandit (ce qui correspond au Palier 3, non traité dans cette version). Alternative équivalente à considérer si un besoin de souveraineté renforcée apparaissait : Clever Cloud (également français).

Validation effectuée :

- Suite de non-régression complète rejouée avec une vraie connexion pour chaque rôle (et non plus un simple changement de profil sans mot de passe) : création du premier compte administrateur, création des rôles Commercial / Conducteur de travaux / Comptable, pipeline Client → Commande → Contrat, Avenant (création automatique de contrat toujours intacte), Attachement (réutilisation du même contrat), module Livrables techniques (V1.54) complet (création, modification, suppression) — aucune régression, aucune erreur JavaScript.
- Contrôle d'accès vérifié par **appel direct à l'API** (pas seulement par ce qui s'affiche à l'écran) : 403 réel pour Commercial sur `/api/collection/personnel`, 403 réel pour Comptable sur `/api/collection/livrables`, 401 réel sans aucune session.
- Même suite de non-régression rejouée **à l'identique contre un vrai serveur PostgreSQL local** (installé pour l'occasion) : résultat strictement identique à SQLite, y compris la numérotation transactionnelle des documents.
- Script de migration testé de bout en bout : données réelles créées en SQLite (clients, commandes, contrats, livrables, 4 utilisateurs) migrées vers une base PostgreSQL neuve, puis serveur redémarré sur cette base migrée — connexion avec le mot de passe migré fonctionnelle à l'identique, données intactes, mots de passe toujours masqués dans les réponses de l'API.

## Ajout V1.56 : connexion automatique en administrateur, mais uniquement en usage local

### Origine

Après la V1.55, en essayant de récupérer les données d'une ancienne installation (V1.54 et antérieures, jamais passées par la nouvelle authentification), l'utilisateur s'est retrouvé bloqué à plusieurs reprises par des mots de passe absents sur les comptes adoptés — la V1.55 exige désormais une vraie connexion pour tout, y compris en usage strictement local sur un seul poste. Demande formulée (verbatim) après plusieurs tentatives infructueuses : « merci de regenerer une nouvelle version de code qui s allance directement en compte admin sans rien demander / Apres le premier lancement l admin reconfigure les acces ».

Avant d'implémenter, question posée : cette connexion automatique devait-elle rester active en permanence, y compris si l'application est un jour hébergée dans le cloud avec plusieurs employés à distance (ce qui annulerait alors toute protection d'accès pour tout le monde), ou seulement tant que l'application tourne en local ? Réponse retenue : **permanent, mais uniquement en usage local (recommandé)** — dès que `DATABASE_URL` est définie (hébergement cloud PostgreSQL, palier 2 de `claude/architecture-cloud-securite.md`), la vraie authentification par mot de passe reste strictement obligatoire, sans aucune régression possible sur ce point au moment de l'hébergement réel.

### Ce qui a été construit

- `backend/auth.py`, `current_user()` : en usage local (pas de `DATABASE_URL`), renvoie désormais toujours un administrateur, sans jamais consulter la session ni demander la moindre connexion — repris sur le premier compte de rôle admin réellement présent en base (nom, email réels, pour que les traces `createdAt`/`creePar` restent lisibles), ou un administrateur « virtuel » minimal si la base est totalement vide (aucun compte encore créé). En mode PostgreSQL/cloud, comportement V1.55 strictement inchangé (session réelle requise, revérifiée à chaque requête).
- `backend/routes/auth.py`, `GET /api/auth/status` : `needsFirstUser` renvoie désormais toujours `false` en usage local (puisque `current_user()` fournit de toute façon un administrateur automatiquement) — l'écran de création du tout premier compte n'apparaît donc plus jamais en local, pas plus que l'écran de connexion. Toujours basé sur l'état réel de la base en mode PostgreSQL/cloud.
- **Effet concret, vérifié** : en local, l'application s'ouvre directement sur le tableau de bord, sans aucun écran de connexion ni de création de compte, même sur une base neuve — conséquence directe : récupérer une ancienne base (V1.54 et antérieures, voir Paramètres > Emplacement de la base de données) rend ses données immédiatement consultables, sans plus jamais avoir besoin de définir un mot de passe après coup. L'écran de connexion/déconnexion de l'application reste présent dans le code pour le mode cloud, mais n'a plus d'effet observable en usage local (se déconnecter ne fait rien, puisque l'accès administrateur est de toute façon automatique).
- **Conséquence assumée, à connaître** : en usage local, la distinction entre rôles (admin/commercial/chantier/comptable) ne protège plus rien — strictement comme avant la V1.55 en local (le code source de l'ancien système le documentait déjà : « simple convivialité, pas un mécanisme de sécurité »). La séparation réelle des accès par rôle ne redevient active que si l'application est hébergée en mode PostgreSQL/cloud (`DATABASE_URL` définie), conformément à l'objectif initial de montée en puissance exprimé par l'utilisateur.

### Validation effectuée

- Nouveau test dédié (Playwright) : ouverture de l'application sur une base locale totalement neuve — aucun écran de connexion ni de création de compte, `/api/auth/me` renvoie directement un administrateur, création d'un client et accès à des sections normalement réservées (Personnel, Écritures) sans la moindre session ni cookie.
- Scénario réel reproduit de bout en bout : adoption d'une ancienne base (V1.54) contenant un compte réel sans mot de passe — les données de cette ancienne base (client historique inclus) sont immédiatement visibles après adoption, sans aucune étape de mot de passe supplémentaire.
- **Suite de régression complète V1.55 (rôles, 401/403, connexion par mot de passe) rejouée à l'identique contre un vrai serveur PostgreSQL** : tous les tests toujours au vert, aucune régression — confirme que l'authentification réelle reste strictement intacte dès que l'application tourne en mode cloud, exactement comme avant ce changement.
- Base de données renommée en conséquence (`chantier_erp_V1.56.db`) : une mise à jour depuis la V1.55 ne perd aucune donnée (la V1.55 reste disponible pour adoption explicite, comme pour toute montée de version).

## Ajout V1.57 : modules installables/désactivables par poste (sans toucher aux rôles)

### Origine

Question posée (verbatim) : « mais si je veu installer un module et ne pas installer d autre: par exemple Gestion des livrables sans le module de Compta / Comment je peux faire? ». Deux questions de clarification posées avant implémentation :

1. Motivation : masquer des modules à certains rôles, ou alléger une installation en retirant du code inutilisé ? Réponse retenue : **les deux** (verbatim : « 1 et 2 »).
2. Profondeur de séparation souhaitée : vraie séparation physique du code en paquets distincts, ou simple interrupteur de configuration ? Réponse retenue : **« Modules désactivables par configuration (recommandé) »** — pas de séparation physique du code.

### Ce qui a été construit

- `backend/modules.py` (nouveau) : 6 modules logiques (Commercial, Livrables techniques, Facturation clients, Fournisseurs, Personnel, Comptabilité), chacun regroupant les sections déjà existantes de la matrice d'accès (`backend/access.py`, `ACCESS`) — aucune nouvelle notion de permission créée, les modules ne font que regrouper ce qui existait déjà. État (actif/inactif par module) stocké au niveau du poste, dans `db_location.json` (comme le répertoire de la base de données), donc indépendant des données elles-mêmes : il survit à une adoption de base d'une autre version, et peut différer d'un poste à l'autre.
- `backend/routes/modules.py` (nouveau), `GET/POST /api/modules` : liste l'état des modules et permet de les activer/désactiver (mise à jour partielle — un module absent du corps envoyé garde son état actuel, pour éviter qu'un oubli dans le corps envoyé ne désactive un module par erreur). Comme ce chemin ne correspond à aucune section connue de la matrice d'accès, il reste par construction fermé par défaut à tout le monde sauf l'administrateur, sans avoir à dupliquer cette règle.
- **Désactivation réellement appliquée, pas seulement cachée à l'écran** (`backend/access.py`, `enforce_request()`) : un module désactivé sur ce poste renvoie un vrai 404 sur **chaque** appel API de ses sections, y compris pour l'administrateur, y compris par un appel direct à l'API en contournant l'interface — aussi strict qu'un refus de rôle (403) ou qu'une absence de session (401). Rien n'est supprimé : les données déjà saisies restent en base, simplement inaccessibles tant que le module reste désactivé — réactiver le module rend tout immédiatement visible à nouveau, sans aucune perte.
- **Menus et appels réseau cohérents côté interface** (`backend/routes/auth.py`, `access_matrix()`) : la matrice d'accès renvoyée au navigateur ramène à « aucun accès » les sections d'un module désactivé, pour tous les rôles y compris administrateur — le mécanisme déjà existant côté frontend (`subscribeCollection`, qui ne charge que ce qu'un rôle peut voir) s'applique donc sans aucune modification supplémentaire : le menu du module disparaît, et ses données ne sont même plus demandées au serveur.
- **Nouvelle carte dans Paramètres** (« Modules installés sur ce poste », `static/js/app.js`) : une case à cocher par module, avec un bouton « Enregistrer » qui recharge la page après mise à jour — accessible uniquement à l'administrateur, comme les autres réglages de ce poste (emplacement de la base, stockage des factures).
- Tableau de bord et Paramètres restent toujours accessibles quel que soit l'état des modules, pour pouvoir revenir à tout moment réactiver un module désactivé par erreur.

### Validation effectuée

- Scénario exact de la demande initiale reproduit via un navigateur piloté (Playwright) : module Comptabilité désactivé, module Livrables techniques laissé actif — le menu Comptabilité disparaît, Livrables techniques reste entièrement fonctionnel (liste, création), et aucune erreur n'apparaît dans la console du navigateur une fois la page stabilisée.
- Vérifié par appel direct à l'API (contournant l'interface) : module désactivé → 404 réel sur sa collection (`/api/collection/ecritures` par exemple), module resté actif → 200 inchangé ; matrice d'accès (`/api/auth/access-matrix`) ramenée à « aucun accès » sur les sections du module désactivé, pour tous les rôles sans exception.
- **Suite de régression complète V1.55 (rôles, 401/403, connexion par mot de passe, pipeline métier complet) rejouée à l'identique contre un vrai serveur PostgreSQL**, tous modules actifs par défaut : tous les tests toujours au vert, aucune régression — confirme que l'ajout des modules n'affecte ni l'authentification ni la séparation des rôles en mode cloud.
- Test dédié au contournement local (V1.56) rejoué également en SQLite : l'administrateur automatique local reste inchangé, les modules se désactivent/réactivent de la même façon qu'en mode cloud.
- Correction apportée en cours de test : un module tout juste désactivé pendant qu'une page encore ouverte interroge sa collection (fenêtre de quelques secondes avant le rechargement automatique après « Enregistrer ») renvoyait un vrai 404, correctement journalisé en console mais déclenchait aussi un message visible (« Synchronisation indisponible ») — corrigé (`static/js/app.js`, `subscribeCollection`) pour traiter ce cas exactement comme un refus de rôle (403) déjà silencieux : pas de message inutile pour une situation transitoire et sans conséquence.

## Ajout V1.58 : codification des livrables techniques (métier électrique) + passage de la suppression à l'annulation

### Origine

Suite directe de la démarche de codification étudiée précédemment (voir `claude/codification-livrables-futura-expertise.md`, analyse d'une convention professionnelle du secteur BTP/AEC — notice de gestion documentaire du projet Podium d'Anfa — adaptée au périmètre propre de Futura Expertise), à l'époque gardée comme simple document de référence (un document Word et un classeur Excel) sans implémentation. Demande de mise en œuvre effective, accompagnée de ces deux mêmes documents (verbatim) : « excellent maintenant integrer les modifications contenu les documents ci joint ».

### Ce qui a été construit

- **Code à 6 segments, calculé automatiquement, jamais saisi à la main** (`static/js/app.js`) : `[Numéro de contrat]-[Zone]-[Niveau]-[Discipline]-[Type de document]-[Numéro séquentiel]-[Indice]`, par exemple `CTR-2026-0001-BATA-N02-CFO-PLA-001-A`. Affiché en aperçu live dans le formulaire (mis à jour à chaque changement de segment) et dans une nouvelle colonne « Code » de la liste des livrables.
- **Trois nouveaux champs sur la fiche livrable** : Zone/bâtiment (`LIVRABLE_ZONES` : Bâtiment A à D, Extérieur/VRD, Général), Niveau (`LIVRABLE_NIVEAUX` : Fondations, Sous-sol, RDC, Étage 1 à 10, Toiture, Terrasse, Général) et Discipline (`LIVRABLE_DISCIPLINES` : Courant fort / Courant faible / Autre — le périmètre métier électrique de Futura Expertise). Trois listes préconfigurées, pas de texte libre, conformément à la décision retenue dans la démarche de référence. La liste des types de document (Plan / Note de calcul / Rapport / Autre) reste inchangée depuis la V1.54.
- **Numéro séquentiel propre à chaque contrat** (`numeroSeq`), recommençant à 001 pour chaque nouveau contrat, jamais remis à zéro ni réutilisé — même mécanisme transactionnel que pour les avenants/attachements (`nextLocalSeq`, champ dédié `livSeq` sur le contrat, `POST /api/increment/<doc>` déjà existant) : **aucune route serveur nouvelle**, le module Livrables reste entièrement porté par l'API générique de documents, comme depuis la V1.54.
- **De la suppression à l'annulation** : le bouton « Supprimer » du module Livrables est remplacé par « Annuler » (`cancelDoc()`, même mécanique que pour les contrats/avenants/attachements) — un livrable annulé (statut « Annulé », déjà présent dans la liste des statuts depuis la V1.54) reste visible dans l'historique avec son code, mais **ne peut plus être modifié** : le bouton « Modifier » disparaît pour tout livrable annulé (règle plus stricte que celle des contrats/avenants/attachements, par alignement explicite sur la discipline documentaire du cahier des charges de nomenclature, conformément à la décision retenue dans la démarche de référence).
- **Aucune migration de données nécessaire** : un livrable créé avant cette version n'a pas encore de numéro séquentiel ni de code — il lui en est attribué un automatiquement à sa première modification suivant la mise à niveau (zone/niveau par défaut « Général », discipline par défaut « Courant fort », modifiables avant d'enregistrer), sans étape de migration dédiée à exécuter.

### Validation effectuée

- Scénario complet rejoué par un navigateur piloté (Playwright) : pipeline Client → Commande → Contrat, création de deux livrables sur le même contrat (combinaisons Zone/Niveau/Discipline/Type différentes) — numéros séquentiels 001 puis 002 corrects, codes complets conformes à la démarche de référence (ex. `CTR-2026-0001-BATA-N02-CFO-PLA-001-A`), aperçu live du code dans le formulaire cohérent avant et après enregistrement.
- Modification d'un livrable existant (changement d'indice de A à B) : code recalculé avec le nouvel indice, numéro séquentiel strictement inchangé.
- Annulation d'un livrable : statut « Annulé » appliqué, bouton « Modifier » disparu (verrouillage confirmé), aucune suppression physique de la fiche ni de son historique.
- Compatibilité ascendante vérifiée avec un livrable simulé « d'avant la V1.58 » (sans zone/niveau/discipline/numéro séquentiel) : à l'ouverture du formulaire, valeurs par défaut appliquées sans erreur ; à l'enregistrement, numéro séquentiel attribué à la suite de ceux déjà utilisés sur ce contrat (003, après 001 et 002), code complet correctement composé.
- **Suite de régression complète V1.55 (rôles, 401/403, connexion par mot de passe, pipeline métier complet) rejouée à l'identique contre un vrai serveur PostgreSQL**, mise à jour pour refléter le nouveau comportement (annulation au lieu de suppression du livrable, verrouillage vérifié) : tous les tests toujours au vert, aucune régression sur l'authentification ni la séparation des rôles.
- Test dédié au contournement local (V1.56) et suite du module-toggle (V1.57) rejoués en SQLite après ce changement : aucune régression constatée.

## Ajout V1.59 : Catégorie des livrables techniques (liste métier à 38 valeurs)

### Origine

Demande directe (verbatim), accompagnée de la liste complète des catégories utilisées par Futura Expertise pour ses livrables (Liste des plans, Note de Calcul BT/MT/DC/Batterie/CDC…, Synoptiques CFO/CFA, Carnet des câbles, Système sécurité incendie, Vidéosurveillance, GTC, TBE, etc., 38 valeurs au total) : « Ajouter pour chaque li[v]rable sa categorie ». Deux questions posées avant implémentation, pour trancher l'articulation avec le Type de document et la codification (V1.58), toutes deux déjà en place :

1. La Catégorie doit-elle s'ajouter au champ « Type de document » existant (Plan/Note de calcul/Rapport/Autre), ou le remplacer ? → **S'ajouter en plus (retenu)** — le Type de document reste inchangé, y compris dans le code à 6 segments.
2. La Catégorie doit-elle entrer dans le code calculé automatiquement, ou rester une simple information affichée/filtrable ? → **Rester hors du code (retenu)** — le format du code validé en V1.58 n'est pas modifié.

### Ce qui a été construit

- `LIVRABLE_CATEGORIES` (`static/js/app.js`) : nouvelle liste de référence à 38 valeurs, fournie telle quelle par l'utilisateur (accents normalisés pour rester cohérent avec le reste de l'application — ex. « Éclairage », « Photovoltaïque »). Même esprit que `LIVRABLE_TYPES` : liste « vivante », aucune validation stricte côté serveur.
- Nouveau champ **Catégorie** sur la fiche livrable (`openLivrableFormModal`), menu déroulant avec option vide (facultatif, comme le Type de document), affiché juste sous la Désignation.
- Affichage : la catégorie apparaît en sous-titre discret sous la désignation dans la liste des livrables, et entre dans la recherche (en plus de désignation/contrat/client/destinataire) — pas de nouvelle colonne dédiée, pour ne pas alourdir un tableau déjà dense.
- **Aucun changement du code à 6 segments** (`livrableCode`, Contrat-Zone-Niveau-Discipline-Type-Numéro-Indice) ni de la logique de numérotation séquentielle (V1.58) : la Catégorie est un champ indépendant, purement informatif/filtrable.
- **Zéro changement de route côté serveur** : comme pour le reste du module Livrables depuis la V1.54, la Catégorie est portée par l'API générique de documents déjà existante.

### Validation effectuée

- Scénario Playwright dédié : création d'un livrable avec Catégorie « Note de Calcul BT » et Type de document « Note de calcul » — vérifié que la catégorie est bien enregistrée, que le code complet généré reste strictement à 6 segments et ne contient pas la catégorie, que la catégorie s'affiche dans la liste et qu'elle est trouvée par la recherche.
- **Suite de régression complète V1.55 rejouée à l'identique contre un vrai serveur PostgreSQL** : tous les tests toujours au vert, aucune régression sur l'authentification, les rôles ni la codification/annulation des livrables (V1.58).
- Suite du contournement local (V1.56) rejouée en SQLite : aucune régression.

## Ajout V1.60 : historique des indices, destinataires par contrat et bordereaux de transmission (« Carnet d'envois »)

### Origine

Demande en deux temps, portant sur la circulation réelle des livrables techniques une fois émis — point déjà identifié dans la démarche de référence (matrice Visa/Commentaire/Information du projet Podium d'Anfa) mais non repris lors de la codification (V1.58), qui n'en avait retenu que le format du code.

Message 1 (verbatim) : « chaque document pourrait evoluer en plusieurs indice / chaque indice pourrait etre transmis a un tier (client, Bureau Etude, Bureau de Controle, Architecte et autres) soit Pour Information, soit Pour Approbation, soit pour Exécution soit Telque construit) / Une liste a etabir par destinataire avant chaque envoie pour les documents a transmettre leurs indices respectifs et l etat de transmission (...) / expliquer moi ce que vs avez compris » — demande explicite de reformulation avant toute implémentation.

Message 2, une fois la compréhension confirmée (verbatim) : « Bien saisi / voir tous les indices avec de possibilite d indiquer uniquement les derniers indices transmis / Destinatiare: liste configurable par projet / Bordereau : une sorte de « carnet d'envois » listant toutes les transmissions passées, consultable indépendamment et imprimable ».

### Ce qui a été construit

- **Historique des indices** (`historiqueIndices` sur chaque livrable, `static/js/app.js`) : une entrée `{indice, date, par}` est ajoutée chaque fois que l'indice de révision change (y compris à la création) — `indiceRevision` reste le champ « indice courant », déjà utilisé par le code à 6 segments (V1.58) et par les listes existantes. Visible depuis la fiche du livrable : mis en avant, le dernier indice **réellement transmis** (calculé depuis les bordereaux, pas depuis l'historique brut), avec un repli « Voir tous les indices » pour l'historique complet — conformément à la demande (« voir tous les indices avec [la] possibilité d'indiquer uniquement les derniers indices transmis »). Rétro-compatible sans migration : un livrable antérieur à cette version n'a pas d'historique ; sa première modification l'initialise avec son indice du moment comme première entrée.
- **Destinataires configurables par contrat** (champ `destinataires` — tableau `{id, nom, catégorie}` — sur le document Contrat) : pas d'écran de gestion séparé, la liste se construit directement depuis le formulaire de création d'un bordereau (« + Nouveau destinataire… »), catégorie au choix parmi Client / Bureau d'Études / Bureau de Contrôle / Architecte / Autre. Portée par le contrat parce que, dans cette application, « projet » désigne le contrat/chantier — exactement la portée demandée (« liste configurable par projet »).
- **Carnet d'envois** (nouvelle collection générique `bordereaux`, nouvel écran de navigation) : chaque bordereau regroupe un contrat, un destinataire et une ou plusieurs lignes (un livrable, son indice au moment de l'envoi, son état de transmission — Pour information / Pour approbation / Pour exécution / Tel que construit). Numérotation séquentielle propre à chaque contrat (`bordereauSeq`, même mécanisme transactionnel que `avSeq`/`attSeq`/`livSeq` depuis la V1.54/V1.58 — `CTR-2026-0001-BOR01`, `-BOR02`, etc.). Consultable et imprimable indépendamment de la fiche des livrables (gabarit d'impression dédié, réutilisant l'en-tête/le tableau/le bloc notes communs à tous les documents de l'application) — exactement le « carnet d'envois » demandé. **Un bordereau, une fois créé, est définitif** : création, consultation et impression uniquement en V1.60, pas de modification ni d'annulation (un envoi réellement effectué ne se « retire » pas a posteriori) — point porté à la connaissance de l'utilisateur, à faire évoluer si le besoin s'en présente.
- **Zéro section d'autorisation ni route serveur dédiées** : le Carnet d'envois est rattaché à la même section d'accès que Livrables techniques (`backend/access.py`, `COLLECTION_SECTION["bordereaux"] = "livrables"`) — mêmes droits par rôle, et il hérite automatiquement du même bouton d'activation/désactivation par poste (V1.57, `backend/modules.py`) sans aucun code supplémentaire. Comme le reste de l'application depuis la V1.54, entièrement porté par l'API générique de documents déjà existante.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : historique des indices après plusieurs changements successifs (A → B → C) sans duplication lors d'un enregistrement sans changement d'indice ; création d'un destinataire depuis l'écran du bordereau, persisté sur le contrat et immédiatement réutilisable ; création de deux bordereaux successifs sur le même contrat avec numérotation continue (`-BOR01`, `-BOR02`) ; impression d'un bordereau (contenu vérifié : titre, numéro, état de transmission) ; colonne « Dernier envoi » de la liste des livrables et détail « Voir tous les indices » de la fiche cohérents avec les bordereaux réellement créés.
- **Suite de régression complète V1.55 rejouée à l'identique contre un vrai serveur PostgreSQL** : tous les tests toujours au vert, aucune régression sur l'authentification ni la séparation des rôles.
- Test d'accès dédié au Carnet d'envois (PostgreSQL, vraie authentification) : menu masqué et 403 réel pour Commercial et Comptable, accès complet pour Conducteur de travaux et Administrateur — exactement l'héritage des droits de Livrables techniques attendu.
- Bouton d'activation/désactivation par poste (V1.57) vérifié directement sur la nouvelle collection : désactiver le module « Livrables techniques » rend aussi `/api/collection/bordereaux` inaccessible (404), sans code supplémentaire ; réactivation confirmée.
- Suites dédiées à la codification (V1.58) et à la catégorie (V1.59) rejouées après ce changement : aucune régression constatée.

## Ajout V1.61 : bouton « Historique » dédié pour les indices des livrables

### Origine

Retour direct de l'utilisateur après livraison de la V1.60 (verbatim) : « CE N EST PAS TROP CONVIVIALE COMME GESTION DES ANCIENS INDICES / PROPOSER MOIS UNE AUTRES METHODE ». Le bloc repliable « Voir tous les indices », intégré dans le formulaire de modification du livrable, demandait d'entrer en mode édition pour consulter un simple historique, et restait de toute façon inaccessible pour un livrable déjà annulé (formulaire verrouillé). Trois approches alternatives proposées à l'utilisateur ; celle retenue : **un bouton « Historique » dédié**, séparé du formulaire.

### Ce qui a changé

- **Nouveau bouton icône « Historique »** (`static/js/app.js`, `renderLivrables`) dans la liste des livrables, à côté de Modifier/Annuler — **toujours visible, y compris pour un livrable annulé** (contrairement à Modifier/Annuler, qui disparaissent après annulation).
- **`openLivrableHistoriqueModal(l)`** : nouvelle fenêtre de consultation à part, en lecture seule, qui fusionne pour chaque indice successif sa date d'enregistrement, son auteur, et la liste de ses transmissions réelles (date, destinataire, catégorie, état, numéro de bordereau) — calculée via la nouvelle fonction `transmissionsPourLivrableIndice(livId, indice)`. Un même indice envoyé à plusieurs destinataires (ex. Pour information au client, puis Pour approbation au bureau de contrôle) affiche toutes ses transmissions, pas seulement la dernière.
- **Retrait du bloc repliable** du formulaire de modification (`openLivrableFormModal`), remplacé par une simple phrase d'orientation vers le nouveau bouton.
- Aucun changement de donnée ni de route : seule la présentation change.

### Validation effectuée

- Scénario Playwright mis à jour : consultation de l'historique (indices A/B/C et leurs transmissions) via le nouveau bouton, y compris **après annulation du livrable** (bouton Historique toujours présent, bouton Modifier bien absent).
- Suite de régression complète V1.55 et test d'accès dédié au Carnet d'envois rejoués contre PostgreSQL, suite de codification (V1.58) rejouée en SQLite : aucune régression.

## Ajout V1.62 : statut de retour par destinataire, et codification client des statuts

### Origine

Demande faite à partir d'une capture d'écran d'un tableau Excel (colonnes Statut / Code Interne / Code Client), verbatim : « CHAQUE INDICE TRANSMI DOIT AVOIR UN CHAMP DE DATE DE RETOUR ET statut DE RETOUR PAR DESTINATAIRE / expliquer ce que vs avez compris? » — même démarche de reformulation préalable que pour la V1.60. Compréhension confirmée, puis quatre précisions apportées par l'utilisateur (verbatim) : « est-il le même pour tous vos clients Non / seules la date et le statut de retour deviennent modifiables après coup oui / statut global du livrable doit rester et renseigner manuellement meme denomination que les statuts des revisions / Visibilité des retours en attente oui », et un dernier choix (« Sur chaque Contrat ») pour l'emplacement de la codification client.

### Ce qui a été construit

- **Nouveau référentiel unique, repris du tableau Excel fourni** (`STATUT_RETOUR_REFERENTIEL`, `static/js/app.js`) : 10 valeurs (« As built » accepté/proposé, Bloquée, Non encore entamé, Document entamé, Transmis pour validation, Non validé, Validé avec/sans commentaires, Sans Objet). Utilisé à deux endroits distincts, avec la même dénomination (demande explicite) : le statut global du livrable (`LIVRABLE_STATUTS` = ce référentiel + « Annulé », saisi **manuellement**, jamais recalculé depuis les retours — confirmé explicitement par l'utilisateur) et, nouveau, le statut de retour de chaque transmission. Rétro-compatible sans migration, comme pour les autres référentiels de l'application (V1.58/V1.59) : un livrable portant un ancien statut (« à faire », « en cours »…) continue de s'afficher tel quel jusqu'à sa prochaine modification.
- **Date et statut de retour par ligne de bordereau** (`dateRetour`/`statutRetour`, sur chaque ligne de `bordereaux`) : chaque indice transmis à un destinataire peut désormais recevoir, après coup, sa date de retour et son statut (ce dernier choisi dans le référentiel ci-dessus) — **propre à cette transmission précise**, pas au livrable dans son ensemble, puisqu'un même indice peut être transmis à plusieurs destinataires avec des retours différents.
- **Assouplissement ciblé de l'immutabilité du bordereau (V1.60)** : un bordereau reste figé sur tout le reste (contrat, destinataire, documents transmis, indice, état de transmission initial — aucune de ces règles n'a changé) ; seules la date et le statut de retour de chaque ligne deviennent modifiables après la création, depuis un nouveau bouton « Enregistrer les retours » dans la fenêtre de détail du bordereau (`viewBordereauModal`), réservé à qui a le droit d'écriture sur Livrables techniques (lecture seule sinon).
- **Codification client des statuts, par Contrat** (`codesRetourClient` — objet `{codeInterne: codeClient}` — sur le document Contrat, choix explicite de l'utilisateur plutôt que sur la fiche Client, pour permettre des codes différents selon le contrat) : nouvelle section repliable « Codification des statuts de retour (codes client) » dans le formulaire du contrat, un champ texte facultatif par statut du référentiel. Le code client correspondant, une fois configuré, s'affiche en regard du statut de retour choisi sur une ligne de bordereau (mis à jour en direct au changement de sélection, sans attendre l'enregistrement).
- **Visibilité des retours en attente** : une pastille « x/y » (verte si tous les retours sont arrivés, orange sinon) dans la liste du Carnet d'envois, et le détail complet (date, statut, code client) par transmission désormais affiché dans la fenêtre « Historique » du livrable (V1.61), aux côtés de l'état de transmission déjà présent.
- **Zéro changement de route ni de schéma côté serveur** : comme pour les ajouts précédents, entièrement porté par l'API générique de documents déjà existante (`PATCH` fusionnant les champs modifiés, sans toucher au reste du document).

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : codification client enregistrée sur un contrat ; livrable créé avec le nouveau référentiel de statut (ancien référentiel absent du sélecteur) ; bordereau créé puis retour saisi après coup sur sa ligne (date + statut + code client affiché en direct puis persisté après rechargement) ; pastille de la liste du Carnet d'envois reflétant le retour saisi ; fenêtre Historique du livrable affichant ce même retour.
- Suite de régression complète V1.55 (mise à jour pour le nouveau référentiel de statut) et test d'accès dédié au Carnet d'envois rejoués contre un vrai serveur PostgreSQL : tous verts, aucune régression sur l'authentification ni la séparation des rôles.
- Suites dédiées à la codification (V1.58) et à la catégorie (V1.59) rejouées en SQLite, ainsi que le scénario complet bordereaux/historique des indices (V1.60) : aucune régression, y compris sur le verrouillage d'un livrable annulé.

## Ajout V1.63 : budget horaire par révision et avancement pondéré des livrables

### Origine

Demande faite à partir du même tableau Excel que la V1.62, complété d'une colonne « Avancement » (verbatim) : « chaque revision doit avoir un budget horaire / a chaque statut correspond un pourcentage d'avancement / le calcul de l'avancement global est le suivant: avancement global = (avancement de chaque document *somme des budget des differentes revision de ce document)/somme total de tout les budget / le statut retenu de chaque est celui de la derniere revision / expliquer ce que vs avez compris », avec la même demande de reformulation préalable. Compréhension confirmée puis quatre précisions apportées par l'utilisateur : le statut utilisé pour ce calcul est le statut global du livrable déjà existant (pas un champ distinct par révision) ; les trois statuts sans pourcentage dans le tableau (« As built » accepté/proposé, Bloquée) n'ont effectivement aucun avancement pour ce calcul ; l'avancement global s'affiche à la fois par contrat et pour toute l'entreprise ; le budget horaire se saisit dans la fiche du livrable, à chaque indice.

### Ce qui a été construit

- **Pourcentage d'avancement par statut** (`avancement`, ajouté à chaque entrée de `STATUT_RETOUR_REFERENTIEL`/`LIVRABLE_STATUTS`) : Non encore entamé 0 %, Document entamé 40 %, Transmis pour validation 70 %, Non validé 70 %, Validé avec commentaires 90 %, Validé sans commentaires 100 %, Sans Objet 0 % — repris du tableau fourni. « As built » accepté, « As built » proposé, Bloquée et Annulé n'ont **aucun** pourcentage (`avancement:null`) : un livrable dans l'un de ces statuts est **exclu** du calcul pondéré (ni au numérateur, ni au dénominateur), confirmé explicitement par l'utilisateur.
- **Budget horaire par révision** (`budgetHeures`, ajouté à chaque entrée de `historiqueIndices` — l'historique des indices, V1.60) : un champ dans la fiche du livrable porte le budget de la révision **courante** (celle de l'indice affiché) ; passer à un nouvel indice démarre une nouvelle entrée d'historique avec son propre budget, rester sur le même indice permet de corriger le budget déjà saisi pour cette révision — rien d'autre n'est modifiable sur une entrée d'historique passée.
- **Avancement d'un livrable** : lu sur son statut global actuel (`livrableAvancement()`), en partant du principe que ce statut, déjà manuel depuis la V1.62, est tenu à jour par l'utilisateur à chaque nouvelle révision — donc qu'il reflète déjà, comme demandé, « le statut de la dernière révision ». Affiché dans une nouvelle colonne « Avancement » de la liste des livrables, et rappelé (avec le budget total cumulé de toutes ses révisions) dans la fenêtre « Historique » (V1.61), qui gagne aussi une colonne « Budget (h) » par révision.
- **Avancement global pondéré par les heures** (`avancementPondere()`) : `Σ(avancement du document × budget total de ses révisions) / Σ(budget total de toutes les révisions)`, sur un ensemble de livrables donné. Affiché par contrat (nouvelle colonne dans la liste des Contrats) et pour toute l'entreprise (nouvelle carte sur le Tableau de bord) — les deux échelles demandées.
- **Zéro changement de route ni de schéma côté serveur**, comme pour tous les ajouts précédents à ce module : entièrement porté par l'API générique de documents déjà existante.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : un livrable passant de l'indice A (statut Validé sans commentaires, 100 %, budget 10 h) à l'indice B (statut Document entamé, 40 %, budget 5 h) — aperçu d'avancement en direct vérifié à chaque changement de statut ; un second livrable en statut Bloquée (budget 20 h) correctement **exclu** du calcul (aperçu « sans avancement défini ») ; colonne Avancement de la liste, détail budget/avancement de la fenêtre Historique, avancement du contrat et carte du Tableau de bord tous cohérents avec le même résultat attendu (40 %, seul le premier livrable contribuant).
- Suite de régression complète V1.55 et test d'accès dédié au Carnet d'envois rejoués contre un vrai serveur PostgreSQL : tous verts, aucune régression sur l'authentification ni les rôles.
- Suites dédiées à la codification (V1.58), à la catégorie (V1.59) et au scénario complet bordereaux/historique des indices (V1.60) rejouées en SQLite : aucune régression, y compris sur le verrouillage d'un livrable annulé.

## Ajout V1.64 : Backlog de développement intégré à l'application

### Origine

Suite directe de l'analyse du classeur Excel de suivi des livrables d'un contrat (feuilles « Etat », « Registre des blocages », « Pointage heures (AC) », « Gestion des versions », « Pilotage mensuel EVM », « Vue par discipline », « Liste des jalons », « Plan de charge Juillet »…), qui a fait ressortir 12 pistes de développement pour l'application elle-même, d'abord livrées comme document d'analyse puis comme page de suivi autonome (priorité, statut d'implémentation, statut de test). Demande explicite de l'utilisateur ensuite (verbatim) : « intergrer ceci dans l'application elle meme ».

### Ce qui a été construit

- **Nouvelle collection générique `backlog`** (même mécanisme que les autres modules — aucune route serveur dédiée) : titre, source, description, priorité, statut d'implémentation, statut de test, notes. Suppression physique autorisée (ce n'est pas un document du périmètre CDC), comme Personnel/Clients — pas d'annulation.
- **Réservé à l'Administrateur** : pas de section ACCESS dédiée, rattaché à `settings` (comme Paramètres et Utilisateurs) — `backend/access.py`, `COLLECTION_SECTION["backlog"]="settings"`, et redirection symétrique côté client (`access()`, comme `bordereaux`→`livrables`).
- **Référentiels** `BACKLOG_PRIORITES` (P1 à P5 + « À confirmer »), `BACKLOG_IMPL_STATUTS` et `BACKLOG_TEST_STATUTS` (À faire / En cours / Fait ou Validé).
- **Import en un clic des 12 pistes identifiées** (`BACKLOG_SEED`, `importerBacklogDefauts()`) depuis l'état vide de l'écran — pas une migration silencieuse, un geste explicite de l'utilisateur.
- **Écran « Backlog de développement »** (`renderBacklog`) : cartes KPI (total, implémentées, en cours, à faire, tests validés), recherche + filtres par priorité/statut, tableau avec **édition en direct** du statut d'implémentation et du statut de test (menus déroulants dans la ligne, enregistrement immédiat), et un formulaire complet (`openBacklogFormModal`) pour le titre/la source/la description/la priorité/les notes — ainsi que l'ajout de nouvelles pistes au fil de l'eau, au-delà des 12 importées.
- Version applicative renommée `V1.64`.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : état vide puis import des 12 pistes, KPI initiaux corrects, édition en direct du statut d'implémentation et de test (KPI recalculés), persistance après navigation, filtre par priorité, édition complète via le formulaire, ajout manuel d'une 13ᵉ piste, suppression (retour à 12).
- **Test d'accès dédié contre un vrai serveur PostgreSQL** (authentification réelle) : Administrateur voit le menu et accède à l'API (200) ; Commercial, Conducteur de travaux et Comptable n'ont ni le menu ni l'accès (403 réel), et une tentative de navigation directe vers la route retombe sur le Tableau de bord.
- Suites de régression V1.60 (bordereaux/historique), V1.62 (statut de retour) et V1.63 (budget horaire/avancement pondéré) rejouées en SQLite : aucune régression.

## Ajout V1.65 : module de planification (personnes affectées, dates planifiées, plan de charge)

### Origine

Prolonge deux pistes de `claude/pistes-developpement-futura.md` restées en suspens après la V1.64 (« Dates de début/fin planifiées par révision » et « Ressources affectées et plan de charge »). Demande explicite de l'utilisateur (verbatim) : « ON COMMENCE PAR LE MODULE DE PLANIFICATION / PERSONNES AFFECTEES A CHAQUE LIVRABLES (dernier revision) les anciennes ne sont plus concernee / Date debute / Date Fin / ce va nous generer egalement le plan de charge ». Clarifiée par trois questions (plusieurs personnes possibles par livrable, plan de charge en grille jour par jour, vue par contrat ET globale), puis par un point d'architecture supplémentaire apparu à l'analyse (voir ci-dessous).

### Ce qui a été construit

- **Deux champs plats sur le livrable, sur la RÉVISION COURANTE uniquement** : `affectations` (tableau `{id, nom, fonction}`, plusieurs personnes possibles) et `datePlanifieeDebut`/`datePlanifieeFin` — à la différence du budget horaire (V1.63), **aucun historique par révision** : ces champs sont simplement remplacés à chaque nouvel indice, conformément à la demande (« les anciennes ne sont plus concernée »).
- **Point d'architecture résolu avec l'utilisateur** : le Conducteur de travaux (rôle « chantier »), qui a l'accès complet aux Livrables techniques, n'avait jusqu'ici aucun accès au registre Personnel (qui porte le salaire, réservé à Administrateur/Comptable depuis la V1.31). Plutôt que d'ouvrir ce registre sensible, une route dédiée `GET /api/personnel-light` renvoie une liste minimale (id/nom/fonction/actif, **jamais le salaire**), rattachée à la section ACCESS `livrables` (pas `personnel`) — le Conducteur de travaux peut ainsi affecter des personnes aux livrables et consulter le plan de charge sans accès au registre complet.
- **Plan de charge généré automatiquement, sans saisie ni collection propre** (`repartitionChargeLivrable()`, `calculerPlanDeCharge()`) : le budget horaire de la révision courante de chaque livrable est réparti également sur ses jours ouvrés (lundi-vendredi) planifiés et ses personnes affectées — règle de répartition uniforme choisie par Claude (l'énoncé ne précisait pas comment répartir une charge d'équipe), dans l'esprit de la « répartition du budget sur les mois » déjà présente dans le classeur source de cette piste.
- **Écran « Plan de charge »** (`renderPlanDeCharge`) : grille jour par jour par personne sur un mois (navigation mois précédent/suivant), filtrable par contrat ou tous contrats confondus (« Les deux », décision explicite de l'utilisateur), cartes KPI (personnes chargées, charge totale, livrables sans planification complète) et liste des livrables actifs sans dates et/ou sans affectation (sinon ignorés silencieusement par la grille). Pas de section ACCESS ni de route serveur dédiées — mêmes droits que Livrables techniques (comme Carnet d'envois en V1.60).
- **Formulaire du livrable** (`openLivrableFormModal`) : nouvelle case à cocher par personne du registre (issu de `/api/personnel-light`) et deux champs de date — validation : les deux dates ensemble ou aucune, fin jamais avant début.
- **Liste des livrables** : nouvelle colonne « Planification » (dates + noms des personnes affectées, révision courante).
- Version applicative renommée `V1.65`.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : création de 2 fiches Personnel, affectation des deux à un livrable avec budget 10 h et une semaine ouvrée planifiée (5 jours), vérification de la colonne Planification dans la liste, blocage d'une date de fin manquante, puis vérification du Plan de charge (KPI, grille à 1 h/jour/personne, 10 h au total, filtre par contrat).
- **Test d'accès dédié contre un vrai serveur PostgreSQL** (authentification réelle, 4 comptes) : Administrateur et Conducteur de travaux voient le menu « Plan de charge » et obtiennent 200 sur `/api/personnel-light` ; Commercial et Comptable n'ont ni le menu ni l'accès (403 réel), et une navigation directe vers la route retombe sur le Tableau de bord.
- Suites de régression V1.60 (bordereaux/historique), V1.63 (budget horaire/avancement pondéré) et V1.64 (Backlog) rejouées en SQLite : aucune régression.

## Ajout V1.66 : import du registre des livrables depuis un classeur Excel réel

### Origine

L'utilisateur a fourni le même classeur réel que celui à l'origine du Backlog de développement (V1.64, `claude/pistes-developpement-futura.md`) — « Liste de suivi des livrables » (projet QW2245) — avec la demande (verbatim) : « je souhaite importer le contenu du fichier excel dans l'application avec un bouton import / quelle demarche vous propozez ». Une analyse détaillée du classeur (24 feuilles, dont 2 portent de la donnée primaire exploitable — les autres sont des vues calculées, à l'image du Plan de charge de la V1.65) a permis de proposer une démarche, confirmée par l'utilisateur via 3 clarifications : le contrat de rattachement, la correspondance initiales → fiche Personnel et le destinataire générique des bordereaux reconstitués se décident tous **au moment de l'import**, dans l'assistant lui-même, plutôt qu'en amont.

### Ce qui a été construit

- **`backend/routes/livrables_import.py`** (nouveau blueprint `/api/livrables-import`, route unique `POST /parse`) : lecture seule d'un classeur `.xlsx` envoyé (comme `/api/excel/parse`, V1.25 — aucune écriture en base ici), qui retrouve ses tableaux par en-têtes plutôt que par numéro de ligne fixe : désignation/catégorie/statut/indice courant/budget planifié depuis « Liste de suivi des livrables » ; indice/date d'envoi/date de retour/statut de retour de **chaque révision** depuis « Gestion des versions » (reconstitue l'historique des indices, V1.60, et les transmissions réellement effectuées) ; initiales de ressources affectées à la révision courante depuis la feuille « Plan de charge … » (recherchée par préfixe, le nom exact variant selon le mois couvert).
- **Nouveau champ `referenceClient`** sur la fiche du livrable (`openLivrableFormModal`, saisissable aussi à la main) : conserve le code propre au client/projet (ex. `QW2245-000-00-SOG-24925024-EL-C102-00035`), **distinct** du code interne à 6 segments de la codification V1.58 — les colonnes Zone/Discipline/Type de ce classeur codent en réalité le découpage du client (sites, lots), pas les axes internes de Futura Expertise ; les livrables importés reçoivent donc Zone/Niveau/Discipline/Type par défaut (Général/Général/Autre/Autre) plutôt que des valeurs forcées à tort.
- **Assistant d'import** (`openImportLivrablesExcelModal`, bouton « Importer depuis Excel » sur l'écran Livrables techniques, visible seulement avec l'accès complet à cette section) : après lecture du fichier, un écran de correspondance demande le contrat de rattachement, une correspondance par initiale avec le registre Personnel (fiche existante, **nouvelle fiche minimale créée à la volée** id/nom/fonction sans salaire, ou ignorée), et le destinataire générique (existant ou nouveau) + l'état de transmission par défaut des bordereaux reconstitués — le classeur ne précisant jamais à qui un envoi a été fait, seulement qu'il a eu lieu.
- **Import/mise à jour, pas de doublon** (`runImportLivrablesExcel`, `importerLivrablesEtBordereaux`) : un livrable est retrouvé par (contrat + `referenceClient`) et **mis à jour** plutôt que recréé — un second import du même fichier sur le même contrat est donc sans effet destructeur, et peut servir à rafraîchir les données. Les transmissions reconstituées (une entrée par révision envoyée) sont regroupées **par date d'envoi** en un bordereau par date (plutôt qu'un par document), pour refléter un envoi groupé réaliste plutôt qu'une multitude de bordereaux d'une seule ligne. **Le même principe de mise à jour plutôt que de duplication s'applique aussi aux bordereaux reconstitués** (`creerBordereaux`) : un bordereau déjà créé par un import précédent pour ce contrat et cette date d'envoi (repéré via `creePar==='Import Excel'`) est mis à jour en place (lignes, destinataire, état) plutôt que recréé à l'identique — sans quoi chaque réimport aurait dupliqué indéfiniment le Carnet d'envois, alors même que les livrables, eux, restaient correctement dédupliqués. Ce point a été découvert et corrigé lors de la vérification finale du paquet livré (zip reconstruit à partir fraîche, testé de bout en bout jusqu'à confirmer l'absence de doublon des deux côtés).
- **Dates planifiées (V1.65) non importées** : ce classeur réel ne les renseigne jamais (vérifié : aucune des 172 lignes de « Gestion des versions » n'a de date de début/fin) — laissées vides plutôt qu'une plage inventée ; à compléter manuellement par la suite si besoin.
- Version applicative renommée `V1.66`.

### Validation effectuée

- Test de bout en bout avec le **classeur réel fourni** (SQLite, contournement local) : 82 livrables détectés, 5 initiales de ressources, création à la volée de 5 fiches Personnel, import complet (82 créés), vérification d'un livrable réel dans la liste (référence client correcte), historique à 3 révisions reconstitué avec le bon budget sur la révision courante, 81 bordereaux reconstitués dans le Carnet d'envois, Plan de charge correctement vide (dates planifiées absentes de la source) avec la liste des livrables non planifiés affichée. **Réimport du même fichier** sur le même contrat : 0 nouveau livrable créé (82 mis à jour) ET 0 nouveau bordereau créé (81 mis à jour) — toujours 82 livrables et 81 bordereaux après réimport, aucun doublon d'aucun côté, confirmant l'idempotence complète de l'import.
- **Test d'accès dédié contre un vrai serveur PostgreSQL** (authentification réelle, 4 comptes) : la lecture du fichier (`/parse`) reste accessible à tout utilisateur authentifié, quel que soit son rôle (aucune écriture n'y a lieu, même principe que l'import Excel Clients/Fournisseurs) ; l'écriture effective d'un livrable reste, elle, strictement réservée à l'Administrateur et au Conducteur de travaux (403 réel pour Commercial/Comptable), et le bouton d'import n'apparaît que pour les rôles ayant cet accès complet.
- Suites de régression V1.60 (bordereaux/historique), V1.64 (Backlog) et V1.65 (module de planification) rejouées en SQLite : aucune régression.

## Ajout V1.67 : filtre par contrat sur la liste des Livrables techniques

### Origine

Retour direct de l'utilisateur après livraison de la V1.66 (capture d'écran de la liste des livrables mélangeant plusieurs contrats) : « POUVOIR LES AFFICHER PAR CONTART » — l'import massif de la V1.66 (82 livrables d'un coup sur un contrat) a rendu ce besoin concret, la liste n'offrant jusqu'ici que la recherche texte libre (V1.54) pour s'y retrouver entre plusieurs contrats.

### Ce qui a été construit

- **`livrablesFilter.ctrId`** (nouveau champ sur le filtre déjà existant de l'écran, `static/js/app.js`) : un menu déroulant « Tous les contrats » ajouté dans la barre d'outils de `renderLivrables`, juste à côté de la recherche texte — même construction que le filtre déjà en place sur le Plan de charge (`planChargeFiltre.ctrId`, V1.65) : liste des contrats non annulés triée par numéro décroissant, « Tous les contrats » comme valeur vide.
- **Se combine avec la recherche texte existante** : les deux filtres (contrat + texte libre) s'appliquent ensemble, pas l'un à l'exclusion de l'autre — un utilisateur peut par exemple chercher une désignation à l'intérieur d'un seul contrat.
- Purement un filtre d'affichage côté client, sans changement de route ni de schéma serveur — comme tous les ajouts à ce module depuis la V1.54.
- Version applicative renommée `V1.67`.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : deux clients, deux contrats, un livrable créé sur chacun ; sans filtre, les 2 apparaissent ; filtré sur le premier contrat, un seul livrable affiché (celui du bon contrat, l'autre absent de la table) ; filtré sur le second, inversement ; retour à « Tous les contrats », les 2 réapparaissent ; combinaison avec la recherche texte vérifiée.
- Suites de régression V1.60 (bordereaux/historique), V1.64 (Backlog), V1.65 (module de planification, y compris son propre filtre par contrat sur le Plan de charge) et V1.66 (import Excel réel, y compris l'idempotence du réimport côté livrables et bordereaux) rejouées en SQLite : aucune régression.
- Test d'accès V1.66 (PostgreSQL, authentification réelle, 4 comptes) rejoué après ce changement : aucune régression sur les droits par rôle.

## Ajout V1.68 : affichage simplifié de la référence client et du statut sur la liste des Livrables techniques

### Origine

Retour direct de l'utilisateur après livraison de la V1.67, portant sur deux colonnes de la même liste (verbatim) : « Code : afficher uniquement l'increment :00001 pour le code suivant: QW2245-000-00-SOG-24925024-EL-B102-00001 / Pour le statut afficher uniquement l'abreviation ». La référence client importée depuis le classeur Excel (V1.66) est une codification longue propre au client, illisible dans une colonne déjà dense ; le statut, lui, était affiché avec son libellé complet (ex. « Validé sans commentaires ») alors que le référentiel porte déjà une abréviation courte (V1.62, ex. « VSC »).

### Ce qui a été construit

- **`referenceClientIncrement(ref)`** (nouvelle fonction, `static/js/app.js`) : découpe la référence client sur les tirets et n'en retient que le dernier segment — pour `QW2245-000-00-SOG-24925024-EL-B102-00001`, retourne `00001`. Purement un formatage d'affichage : la valeur complète reste stockée telle quelle dans `referenceClient` (champ du formulaire, logique d'import V1.66) et reste consultable via l'attribut `title` porté par la cellule dans `renderLivrables`.
- **Statut affiché en abréviation** : la colonne Statut de la liste des Livrables techniques affiche désormais `sm.id.toUpperCase()` (ex. `VSC`, `TPV`, `ANNULE`) au lieu de `sm.label` (ex. « Validé sans commentaires »), avec le libellé complet toujours disponible via l'attribut `title` de la pastille.
- Changement strictement limité à cette colonne de cet écran (liste des Livrables techniques) : les autres affichages du statut dans l'application (fenêtre Historique du livrable, Carnet d'envois, saisie des retours) continuent de montrer le libellé complet, aucun besoin exprimé à leur sujet.
- Version applicative renommée `V1.68`.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local) : un livrable créé avec la référence client `QW2245-000-00-SOG-24925024-EL-B102-00001` et le statut `VSC` — la cellule Référence affiche `00001` avec la valeur complète dans son `title`, la pastille Statut affiche `VSC` avec « Validé sans commentaires » dans son `title` ; après annulation du même livrable, la pastille affiche `ANNULE` avec « Annulé » dans son `title`.
- Test V1.66 (import Excel réel) mis à jour en conséquence (la cellule Référence du livrable réel importé affiche `00035` au lieu du code complet, vérifié via son `title`) et rejoué : toujours au vert, y compris l'idempotence du réimport.
- Suites de régression V1.60 (bordereaux/historique), V1.62 (statut de retour — déjà tolérant à l'abréviation dans ses propres assertions), V1.64 (Backlog) et V1.65 (planification) rejouées en SQLite : aucune régression.

## Ajout V1.69 : le code interne de la liste des Livrables techniques n'affiche lui aussi que son numéro séquentiel

### Origine

Retour direct de l'utilisateur après livraison de la V1.68, accompagné d'une capture d'écran de la liste : « le code est encore affiche en entier ». La V1.68 n'avait raccourci que la référence client (deuxième ligne de la cellule Code) ; le code interne à 6 segments lui-même (`codeComplet`, V1.58, ex. `CTR-2026-0003-G-G-AUT-AUT-019-01`) restait affiché en entier au-dessus, et occupait l'essentiel de la cellule une fois replié sur plusieurs lignes dans une colonne étroite.

### Ce qui a été construit

- **`codeCompletIncrement(l)`** (nouvelle fonction, `static/js/app.js`, juste après `referenceClientIncrement`) : affiche le numéro séquentiel du livrable (`l.numeroSeq`, zéro-complété sur 3 chiffres, le « numéro séquentiel » du § 5e de la démarche de codification) — l'équivalent, pour le code interne, du dernier segment déjà retenu pour la référence client en V1.68. Ce champ est déjà stocké tel quel sur le livrable (attribué à la création via `nextLocalSeq`), donc lu directement plutôt que reparsé depuis la chaîne `codeComplet` — un découpage par tiret aurait été ambigu, le numéro de contrat lui-même en contenant (`CTR-2026-0003`).
- Le code complet reste consultable via l'attribut `title` de la cellule (même mécanisme que pour la référence client) ; l'indice de révision, lui, n'a jamais été retiré de l'affichage : il garde sa propre colonne « Indice », inchangée.
- Changement limité à cette seule cellule de cet écran, comme en V1.68.
- Version applicative renommée `V1.69`.

### Validation effectuée

- Scénario Playwright dédié (SQLite, contournement local), étendu : pour un livrable fraîchement créé sur un nouveau contrat, la cellule Code affiche `001` (son numéro séquentiel) avec le code complet (`CTR-2026-0001-G-G-CFO-AUT-001-A`) dans son `title`.
- Suites de régression V1.58 (codification — vérifie `codeComplet` via les données de l'API, pas via l'affichage, donc non affectée), V1.60 (bordereaux/historique), V1.62 (statut de retour), V1.64 (Backlog), V1.65 (planification) et V1.67 (filtre par contrat) rejouées en SQLite : aucune régression.
- Test V1.66 (import Excel réel) rejoué sur le paquet livré : toujours au vert, y compris l'idempotence du réimport côté livrables et bordereaux.

## Ajout V1.70 : module de planification manuelle (remplace le Plan de charge automatique de la V1.65)

### Origine

Demande explicite de l'utilisateur, accompagnée d'une capture d'écran de l'écran « Plan de charge » (V1.65) : « ce que je propose c'est d'ajouter un module de planification du même genre du tableau ci joint avec la possibilité d'ajouter des lignes, pour chaque ligne on doit choisir le projet (le contrat), la personne, le livrable et le nombre d'heures par jour — merci d'indiquer les samedi dimanche d'une couleur différente ». Trois points d'architecture ont été clarifiés avant tout développement (outil de questions à choix multiples, trois questions, les trois réponses « Recommandé » retenues par l'utilisateur) :

- ce nouveau module **remplace** l'écran « Plan de charge » existant (pas un second écran en plus) ;
- les heures sont saisies **directement dans chaque case de la grille** (pas de valeur unique répétée sur une période) ;
- les heures saisies sont **totalement indépendantes** du budget horaire déjà existant sur le livrable (V1.63) — aucune comparaison, aucune alerte de dépassement.

### Ce qui a été construit

- Jusqu'à la V1.69, le Plan de charge était une vue **dérivée, en lecture seule**, reconstituée automatiquement depuis les personnes affectées et les dates planifiées de chaque livrable, en répartissant également son budget horaire sur ses jours ouvrés (voir § « Limite assumée » des versions précédentes). Cette logique (`repartitionChargeLivrable()`/`calculerPlanDeCharge()`) a été retirée.
- Nouvelle collection générique **`planificationLignes`** (même mécanisme que `bordereaux`/`backlog` : une entrée dans `COLLECTION_SECTION`, `backend/access.py`, aucune route ni schéma dédié nécessaire) : un document = une ligne = un contrat + une personne (issue du registre Personnel) + un livrable + une carte `{jour (aaaa-mm-jj): heures}`.
- Bouton « Ajouter une ligne » : formulaire en trois étapes (Contrat → Personne → Livrable, ce dernier filtré sur les livrables actifs du contrat choisi), sur le même principe que le formulaire de bordereau (V1.60).
- Grille mensuelle : une ligne par ligne de planification, une colonne par jour **calendaire** du mois (tous les jours, samedis et dimanches inclus — à la différence de l'ancienne vue qui ne comptait que les jours ouvrés) ; les colonnes de week-end sont mises en évidence par un fond grisé différent, demande explicite de l'utilisateur, mais restent normalement modifiables. Chaque case est un champ numérique saisi directement ; la saisie (évènement `change`, donc à la perte du focus) met à jour localement la ligne (totaux recalculés immédiatement) puis enregistre côté serveur (`PATCH`) la carte `heures` complète de la ligne — le magasin de documents générique ne fusionnant que les champs de premier niveau, il n'existe pas de notation pointée pour ne mettre à jour qu'un seul jour côté serveur.
- Totaux par ligne, par jour (tous les contrats confondus) et total général ; filtre par contrat et navigation mois précédent/suivant conservés, sur le même principe que l'ancien écran.
- Suppression d'une ligne (bouton avec confirmation), sans mécanisme d'annulation réversible (ce ne sont pas des documents numérotés du périmètre CDC — RG-004/RG-005 ne s'appliquent pas ici).
- Version applicative renommée `V1.70`.

### Validation effectuée

- Nouveau scénario Playwright dédié (SQLite, contournement local) : création d'une ligne (contrat + personne + livrable), saisie d'heures sur un jour ouvré et un jour de week-end (acceptée sur les deux), vérification du fond différent des colonnes week-end, recalcul immédiat du total de la ligne, persistance après rechargement complet de la page, absence de toute comparaison/alerte liée au budget horaire, puis suppression de la ligne.
- Suites de régression V1.58 (codification), V1.60 (bordereaux/historique), V1.62 (statut de retour), V1.63 (budget/avancement), V1.64 (Backlog) et V1.67 (filtre par contrat) rejouées en SQLite : aucune régression.
- Test V1.66 (import Excel réel) rejoué, adapté sur son seul passage concernant l'ancien Plan de charge automatique (qui n'existe plus) : l'import ne crée aucune ligne de planification, l'écran reste donc simplement vide après import — confirmé.
- Test V1.68/V1.69 (affichage simplifié) rejoué sur le paquet livré : toujours au vert, écran sans rapport avec ce changement.
- Les tests dédiés à l'ancien Plan de charge automatique (`test_planification_v165.py`, `test_planification_access_v165.py`) sont désormais obsolètes — ils vérifiaient un comportement (répartition automatique du budget sur les jours ouvrés) volontairement retiré — et sont remplacés par le nouveau scénario V1.70 ci-dessus.

## Ajout V1.71 : case « journée entière », filtre par personne, et nouvel écran Timesheet (séparé du Plan de charge)

### Origine

Demande explicite de l'utilisateur, juste après la livraison de la V1.70, en quatre points : « ajouter la possibilite de cocher une journee entiere ce qui implique 8h / ajouter un filtre par personne a l identique des contrats / maintenant ajouter un timesheet par personne a l identique du planning mais separe du planning / expliquer ce que vous avez compris ». Trois questions ont été posées avant tout développement (outil de questions à choix multiples, les trois réponses « Recommandé » retenues par l'utilisateur) :

- quand la case « journée entière » d'une case-jour est cochée, elle **remplit 8h et verrouille** le champ heures correspondant (il faut décocher pour corriger une valeur) ;
- le Timesheet représente les heures **réellement passées** (pointage réel), par opposition au Plan de charge qui reste **prévisionnel** (heures prévues) — deux registres indépendants, sans calcul automatique d'écart entre les deux pour l'instant ;
- le Timesheet est **totalement indépendant** du Plan de charge : aucune ligne n'y est reprise ou pré-remplie automatiquement — chaque ligne de Timesheet est créée à part, avec son propre contrat + personne + livrable + heures.

### Ce qui a été construit

- **Case « journée entière »** sur chaque case-jour de la grille (Plan de charge et Timesheet), en plus du champ heures existant. La cocher met la case à 8h et désactive (verrouille) le champ heures ; la décocher réactive le champ heures tout en conservant la valeur 8h comme point de départ pour une correction manuelle. Stockage : une nouvelle carte parallèle `joursPleins: {jour (aaaa-mm-jj): true}` sur chaque ligne, à côté de la carte `heures` existante — même principe de ré-envoi intégral de la carte complète à chaque case modifiée (`PATCH`), le magasin de documents générique ne fusionnant que les champs de premier niveau (voir V1.70).
- **Filtre par personne**, à l'identique du filtre par contrat déjà existant : un second menu déroulant listant tout le registre Personnel (pas seulement les personnes ayant déjà une ligne, même logique que le filtre contrat), combinable avec le filtre par contrat.
- **Nouvel écran « Timesheet »**, entrée de menu séparée, mécaniquement identique au Plan de charge (même grille mensuelle, même case « journée entière », mêmes filtres contrat/personne, même formulaire d'ajout de ligne en trois étapes Contrat → Personne → Livrable), mais adossé à sa **propre collection générique** `timesheetLignes` (même mécanisme `COLLECTION_SECTION` que `planificationLignes`), totalement indépendante : aucune ligne du Plan de charge n'apparaît dans le Timesheet, et inversement, et aucune reprise/pré-remplissage automatique n'existe entre les deux écrans.
- Refactorisation interne : le moteur de rendu de la grille et le formulaire d'ajout de ligne, auparavant propres au seul Plan de charge, ont été généralisés en deux fonctions partagées (`renderLignesHeuresEcran`, `openLigneGrilleFormModal`), paramétrées par la collection cible — chaque écran garde ses propres libellés et ses propres identifiants DOM (préfixe `pdc`/`plc` pour le Plan de charge, inchangé depuis la V1.70 pour ne pas casser son test dédié existant ; préfixe `tms` pour le Timesheet, nouveau).
- Version applicative renommée `V1.71`.

### Validation effectuée

- Nouveau scénario Playwright dédié (SQLite, contournement local) couvrant les trois ajouts : cocher/décocher la case « journée entière » (verrouillage à 8h puis déverrouillage avec correction manuelle à une autre valeur) ; filtre par personne combiné à deux lignes de personnes différentes (seule la personne filtrée reste visible dans le tableau, retour à « Toutes les personnes » affiche à nouveau les deux) ; navigation vers l'écran Timesheet (vide au départ), ajout d'une ligne, utilisation de la case « journée entière » sur cet écran également, puis vérification explicite de l'indépendance dans les deux sens (la ligne de Timesheet n'apparaît pas dans le Plan de charge, et la ligne de Plan de charge n'apparaît pas dans le Timesheet), et suppression de la ligne de Timesheet.
- Le scénario V1.70 existant (`test_planification_v170.py`) a été rejoué sans modification de comportement attendu : une seule assertion a dû être corrigée (elle vérifiait l'absence du nom d'une personne supprimée sur la page entière ; or le nouveau filtre par personne liste toujours tout le registre Personnel dans son menu déroulant, donc ce nom reste légitimement présent comme option de filtre — l'assertion vérifie désormais l'absence dans les lignes du tableau uniquement) — toutes les autres assertions (saisie d'heures, fond week-end, total, persistance, indépendance du budget, suppression) sont passées sans changement, confirmant que la généralisation du moteur de rendu ne modifie pas le comportement du Plan de charge.
- Suites de régression V1.58 (codification), V1.60 (bordereaux/historique), V1.62 (statut de retour), V1.63 (budget/avancement), V1.64 (Backlog), V1.66 (import Excel), V1.67 (filtre par contrat) et V1.68/V1.69 (affichage simplifié) rejouées en SQLite, chacune avec réinitialisation complète de la base avant son exécution : aucune régression.

## Ajout V1.72 : codification des livrables configurable par contrat (configurateur libre, recalculée en direct)

### Origine

Retour direct de l'utilisateur, revenant sur la codification des livrables (V1.58) (verbatim) : « Ok maintenant on revient à la codification des livrables chaque Contrat a sa propre ça peut un increment comme ça peut être une composition de plusieurs champs qu est ce que vous me recommandez ». J'ai proposé une recommandation (un choix binaire simple par contrat, fixé à la création, verrouillé ensuite) et posé deux séries de questions à choix multiples avant toute implémentation — l'utilisateur a choisi, à chaque fois, l'option la plus souple plutôt que celle recommandée :

- **Nature du choix** : un configurateur libre (pas un simple choix binaire incrément/composition) — chaque contrat choisit librement quels segments entrent dans son code et dans quel ordre.
- **Verrouillage** : modifiable à tout moment (pas fixé à la création du contrat, pas verrouillé ensuite).
- **Format minimal** : un numéro autonome, sans préfixe de contrat ni indice imposés — confirmant que même le numéro de contrat et l'indice de révision deviennent des segments optionnels comme les autres dans le configurateur.
- **Place du numéro séquentiel** (deuxième série de questions, une fois le configurateur libre acté) : toujours inclus (seul lui garantit l'unicité du code), mais sa position dans la composition est libre, comme les autres segments.
- **Recalcul des codes existants** : recalculés en direct, à chaque affichage, à partir de la configuration courante du contrat — pas de valeur figée à l'enregistrement du livrable, pas de migration/recalcul en masse à faire à la main quand la configuration change.

### Ce qui a été construit

- Le code à 6 segments fixe de la V1.58 (`[Numéro de contrat]-[Zone]-[Niveau]-[Discipline]-[Type de document]-[Numéro séquentiel]-[Indice]`) n'est plus un format unique imposé à toute l'application : chaque **contrat** porte désormais son propre champ `codificationSegments` (tableau ordonné de segments), configurable depuis sa fiche (nouvelle section « Codification des livrables de ce contrat », repliable, sur le même principe que la codification des statuts de retour par contrat de la V1.62). Une case à cocher par segment (Numéro de contrat / Zone / Niveau / Discipline / Type de document / Numéro séquentiel / Indice de révision) et deux flèches pour faire monter/descendre chaque segment dans l'ordre de composition — seuls les segments cochés entrent dans le code, dans l'ordre où ils apparaissent. Le segment « Numéro séquentiel » est toujours coché et verrouillé (case désactivée : impossible de le décocher) mais sa position reste libre comme les autres. Un aperçu du code obtenu (avec des valeurs d'exemple) se recalcule en direct à chaque case cochée/décochée ou chaque déplacement.
- Un contrat sans configuration propre (tout contrat créé avant cette version, ou simplement non personnalisé) retombe automatiquement sur l'ordre par défaut — strictement identique au format fixe de la V1.58 — sans aucune migration de données : exactement le même principe de compatibilité ascendante paresseuse que le reste de l'application.
- **Le code n'est plus une valeur figée enregistrée sur le livrable** : il est désormais recalculé **en direct**, à chaque affichage, à partir de la configuration **courante** du contrat et des champs du livrable (même principe que l'avancement pondéré ou le dernier envoi, déjà calculés à la volée depuis la V1.63/V1.60) — partout où le code est affiché à l'utilisateur (liste des Livrables techniques, fenêtre Historique, formulaire d'ajout de livrable, formulaire du Carnet d'envois, lignes du Plan de charge/Timesheet). Conséquence directe de la demande « modifiable à tout moment » : changer la configuration d'un contrat met instantanément à jour l'affichage du code de **tous** ses livrables, y compris ceux codifiés avant ce changement — sans avoir à les rouvrir ni à les réenregistrer. Le champ `codeComplet` reste malgré tout écrit sur le livrable à chaque enregistrement (secours si le contrat n'est plus trouvable, et valeur figée dénormalisée sur les lignes de bordereau et de Plan de charge/Timesheet au moment de leur création — ces snapshots historiques restent, eux, volontairement immuables, comme le reste des documents déjà figés de l'application).
- L'affichage « n'afficher que le numéro séquentiel, le code complet dans le `title` » (V1.69) reste inchangé : la cellule Code de la liste des livrables continue de n'afficher que le numéro séquentiel seul, indépendamment de la composition choisie par le contrat.
- Version applicative renommée `V1.72`.

### Validation effectuée

- Nouveau scénario Playwright dédié (SQLite, contournement local) : deux contrats, un livrable identique sur chacun (même zone/niveau/discipline/type) — le format par défaut (6 segments, identique à la V1.58) est vérifié sur les deux avant toute personnalisation. La codification du premier contrat est ensuite personnalisée (segments « Numéro de contrat » et « Zone » décochés, segment « Discipline » déplacé en tête des segments restants) **sans toucher au livrable lui-même** : son code affiché change immédiatement pour refléter la nouvelle composition, confirmant le recalcul en direct demandé. Le second contrat, non modifié, conserve le format par défaut inchangé, confirmant l'absence de toute contamination entre contrats. La case « Numéro séquentiel » est vérifiée cochée et verrouillée (désactivée) dans le configurateur. La fenêtre Historique du livrable est vérifiée affichant elle aussi le code recalculé en direct, et la cellule Code de la liste continue de n'afficher que le numéro séquentiel seul (V1.69, inchangé).
- Suites de régression V1.58 (codification), V1.60 (bordereaux/historique), V1.62 (statut de retour), V1.63 (budget/avancement), V1.64 (Backlog), V1.66 (import Excel), V1.67 (filtre par contrat), V1.68/V1.69 (affichage simplifié), V1.70 (planification manuelle) et V1.71 (journée entière/filtre personne/Timesheet) rejouées en SQLite, chacune avec réinitialisation complète de la base avant son exécution : aucune régression — notamment confirmé que l'import Excel (V1.66) et le Carnet d'envois (V1.60) continuent de composer des codes cohérents pour les contrats n'ayant pas de configuration personnalisée.

## Ajout V1.73 : configurateur de codification déplacé vers les Livrables, et segments personnalisés configurables par contrat

### Origine

Retour direct de l'utilisateur, revenant sur l'emplacement et la portée du configurateur de codification livré en V1.72 (verbatim) :

« mettre cette configuration au niveau de la gestion des livrables et non au niveau contrat
Donner la possibiliote par contrat d ajouter des segment (batiment niveau ....) leurs noms et leurs contenu (liste deroulante) doivent resrter configurable par contrat »

Trois questions à choix multiples posées avant toute implémentation, les trois réponses « Recommandé » retenues par l'utilisateur :

- **Emplacement** : un bouton dédié dans la barre d'outils de l'écran Livrables techniques (pas un bloc toujours visible).
- **Zone/Niveau/Discipline** : deviennent eux-mêmes personnalisables par contrat, au même titre que n'importe quel nouveau segment ajouté — plus de distinction entre « 3 axes historiques figés » et « nouveaux segments configurables ».
- **Rien de bloqué** : renommer/supprimer un segment personnalisé ou une valeur de sa liste, même si des livrables l'utilisent déjà, ne bloque jamais l'opération — les anciennes codifications reprennent simplement la nouvelle façon de codifier, recalculées en direct à chaque affichage (extension du principe déjà posé en V1.72).

### Ce qui a été construit

- Le configurateur de codification quitte intégralement la fiche Contrat (la section « Codification des livrables de ce contrat » ajoutée en V1.72 en est retirée — la section voisine « Codification des statuts de retour », V1.62, n'est pas concernée) et s'ouvre désormais depuis un nouveau bouton « Codification » dans la barre d'outils de l'écran Livrables techniques, actif seulement quand un contrat précis est choisi dans le filtre par contrat déjà existant (V1.67).
- Zone/Niveau/Discipline perdent leur statut de listes fixes universelles : ce sont désormais trois **segments personnalisés** ordinaires, préchargés par défaut avec les noms et listes de valeurs exactes de la V1.58 pour tout contrat non encore personnalisé, mais renommables, modifiables ou supprimables comme n'importe quel segment ajouté ensuite.
- **Ajout de segments personnalisés illimité par contrat** : chaque contrat peut ajouter autant de segments qu'il le souhaite (ex. « Bâtiment », « Lot »), chacun avec son propre nom et sa propre liste de valeurs en texte séparé par des virgules — totalement indépendant d'un contrat à l'autre. Un nouveau segment est ajouté par défaut en fin de composition du code (repositionnable immédiatement via les flèches Monter/Descendre, comme en V1.72).
- **Rien de bloqué** : supprimer un segment le retire simplement de la composition du code (le livrable continue de s'afficher, sans ce segment) ; retirer une valeur de la liste d'un segment ne touche à aucun livrable déjà enregistré avec cette valeur (elle reste affichée, réinjectée dans le menu déroulant du formulaire plutôt que silencieusement perdue) ; renommer un segment conserve son identifiant technique interne, donc toutes les valeurs déjà saisies. Dans tous les cas, le code affiché de chaque livrable est recalculé **en direct** à partir de la configuration actuelle du contrat, jamais figé.
- Le formulaire du livrable n'affiche plus trois champs fixes Zone/Niveau/Discipline, mais un bloc de champs dynamiques, reconstruit à partir des segments personnalisés actuels du contrat choisi — un menu déroulant par segment configuré.
- L'import Excel (V1.66) ne pose plus de valeurs par défaut arbitraires (« Général »/« Général »/« Autre ») sur les segments personnalisés d'un livrable nouvellement importé, le fichier source n'ayant aucune valeur fiable à proposer pour ces axes propres à Futura Expertise — le code affiche simplement « — » pour ces positions jusqu'à ce qu'un humain les renseigne.
- Un contrat non personnalisé (créé avant cette version, ou simplement jamais configuré) continue de retomber sur les 3 segments par défaut (Zone/Niveau/Discipline) et l'ordre fixe de la V1.58/V1.72 — compatibilité ascendante totale, sans aucune migration de données.
- Version applicative renommée `V1.73`.

### Validation effectuée

- Nouveau scénario Playwright dédié (SQLite, contournement local) : bouton « Codification » désactivé sans contrat filtré, activé une fois un contrat choisi ; segments par défaut préchargés à l'ouverture ; renommage « Zone » → « Bâtiment » (valeur déjà stockée sur un livrable existant conservée) ; suppression du segment « Niveau » (rien de bloqué) ; ajout d'un segment « Lot » (valeurs « Lot 1, Lot 2 ») ; recalcul en direct du code d'un livrable existant après l'enregistrement de cette configuration, **sans réenregistrer le livrable** ; second contrat non touché, toujours au format par défaut (aucune contamination) ; nouveau livrable créé ensuite, utilisant correctement le champ dynamique « Lot ».
- Suites de régression V1.58 (bordereaux/historique, budget/avancement, Backlog, import Excel réel, filtre par contrat), V1.70 (planification manuelle) et V1.71 (Timesheet, filtre par personne) rejouées en SQLite : aucune régression.
- `test_livrables_codif.py` (test d'origine V1.58, ciblant les `<select>` fixes Zone/Niveau/Discipline retirés par cette version) devenu obsolète et remplacé par le nouveau scénario ci-dessus — même précédent que `test_planification_v165.py` en V1.70. `test_import_livrables_v166.py` non rejoué (fichier source Excel toujours indisponible dans cet environnement) : relecture de son contenu confirmant qu'aucune de ses assertions ne dépend des anciens placeholders zone/niveau/discipline retirés de l'import par cette version.

## Ajout V1.74 : regroupement visuel du menu en modules métier

### Origine

Demande directe de l'utilisateur (verbatim) : « Je souhaite maintenant réorganiser l application en plusieurs modules qu Est-ce que vs proposez comme modules ». J'ai proposé un découpage en 6 modules métier, repris quasiment tel quel des modules installables/désactivables par poste déjà existants depuis la V1.57 (`backend/modules.py`) — Commercial, Projets d'ingénierie (renommage du module « Livrables techniques » de la V1.57, pour refléter tout ce qu'il couvre désormais : Carnet d'envois, Plan de charge, Timesheet), Facturation clients, Fournisseurs, Personnel, Comptabilité — plus Tableau de bord/Backlog/Paramètres toujours hors de tout module, comme aujourd'hui. Deux questions à choix multiples posées avant toute implémentation :

- **Portée de la réorganisation** : regrouper visuellement le menu (le menu latéral passe d'une liste plate de 20 entrées à des groupes dépliables/repliables), affiner les modules installables existants, ou autre chose ? → **Regrouper visuellement le menu (retenu)** — aucun changement au mécanisme d'installation/désactivation par poste de la V1.57.
- **Le découpage en 6 modules proposé convient-il, ou faut-il ajuster certaines frontières ?** → **Ce découpage convient (retenu)**, sans aucun ajustement.

### Ce qui a été construit

Implémenté intégralement dans `static/js/app.js` et `static/css/style.css`, sans aucun changement de route ni de schéma côté serveur — purement une réorganisation de l'affichage du menu existant, strictement décorative :

- **`NAV_GROUPS`** (nouvelle constante) : les 6 modules proposés, chacun avec un libellé, une icône et la liste des identifiants `NAV` qui lui appartiennent — repris très précisément de `backend/modules.py` (V1.57), à un renommage de libellé près (« Livrables techniques » → « Projets d'ingénierie », cosmétique uniquement : le module backend garde son id et son libellé d'origine dans l'écran Paramètres > Modules installés, aucun changement là-bas). `NAV_STANDALONE_TOP`/`NAV_STANDALONE_BOTTOM` gardent Tableau de bord, Backlog et Paramètres hors de tout groupe, exactement comme ils restent hors de tout module désactivable.
- **`renderShell()` réécrite** pour construire le menu en 3 temps : les items autonomes du haut (Tableau de bord), puis chaque groupe (en-tête cliquable avec chevron + ses items, repliable), puis les items autonomes du bas (Backlog, Paramètres) — au lieu d'une simple liste à plat de `NAV.filter(...).map(...)`. Un groupe sans aucun item visible pour le rôle connecté, ou dont le module V1.57 est entièrement désactivé sur ce poste, ne s'affiche plus du tout (ni en-tête vide ni items) — exactement le même comportement qu'avant pour les items individuels.
- **Groupe à un seul item aplati automatiquement** : le module « Personnel » ne contient qu'un seul écran (« Personnel » lui-même) — l'afficher comme un groupe repliable avec un en-tête au libellé identique à son unique item aurait été redondant et source de confusion (y compris pour un futur test Playwright ciblant le texte exact « Personnel », qui aurait pu cliquer sur l'en-tête au lieu du lien). Un groupe réduit à un seul item visible s'affiche donc comme un lien direct, sans wrapper.
- **État replié/déplié géré en mémoire pour la session en cours** (`navGroupesRepliees`, même principe que `facAnneesRepliees` pour les factures groupées par année) — tous les groupes sont dépliés par défaut, et le groupe contenant la route actuellement affichée reste (ou redevient) toujours déplié, même s'il avait été replié manuellement juste avant, pour que l'écran actif ne disparaisse jamais du menu. Pas de persistance entre deux sessions (choix de simplicité, cohérent avec l'absence de persistance de ce type d'état ailleurs dans l'application).
- **Affichage mobile (largeur réduite) inchangé** : en dessous de 820px, le menu redevient une seule rangée horizontale d'icônes comme avant cette version — les en-têtes de groupe et le repli/dépli n'ont pas de sens dans ce format, ils sont donc neutralisés par CSS (`display:contents`) plutôt qu'adaptés, pour que tous les écrans restent directement accessibles.
- Version applicative renommée `V1.74`.

### Validation effectuée

- Nouveau scénario Playwright dédié (SQLite, contournement local, `test_nav_groupes_v174.py`) : les 5 en-têtes de groupe à plusieurs items sont bien présents (Personnel reste un lien direct, aplati) ; Tableau de bord/Backlog/Paramètres/Personnel restent hors de tout groupe ; un clic sur l'en-tête « Commercial » replie bien ses items (attribut `hidden` + rotation du chevron) ; la navigation via un lien à l'intérieur d'un groupe fonctionne toujours ; naviguer vers une route d'un groupe replié le force à redevenir déplié automatiquement ; désactiver le module Comptabilité (V1.57, via `/api/modules`) fait disparaître tout le groupe du menu, pas seulement ses items.
- **Collision de libellé découverte et documentée (pas corrigée, car hors de la demande)** : le module « Fournisseurs » (3 écrans) a un libellé de groupe identique à l'un de ses propres items (« Fournisseurs »), ce qui rend `page.click('text="Fournisseurs"')` ambigu dans un futur test Playwright (résolution silencieuse sur le premier élément trouvé — l'en-tête de groupe, qui replie/déplie au lieu de naviguer — sans lever d'erreur) : un commentaire dédié a été ajouté dans `static/js/app.js` juste au-dessus de `NAV_GROUPS` pour qu'un futur test cible toujours `a.navlink[data-nav="fournisseurs"]` plutôt que le texte brut.
- Suite de régression rejouée (9 tests, base réinitialisée avant chaque exécution) : V1.58 (bordereaux/historique, statut de retour, budget/avancement, Backlog, filtre par contrat), V1.70, V1.71 et V1.73 (codification par segments personnalisés) — aucune régression. `test_livrables_codif.py` (V1.58, déjà obsolète depuis la V1.73) échoue toujours pour la même raison déjà documentée, sans rapport avec ce changement.
- **Non rejoué dans cet environnement** : les deux tests d'accès dédiés nécessitant un vrai serveur PostgreSQL (`test_backlog_access_v164.py`, `test_bordereaux_access_v160.py`) — le service PostgreSQL local n'était pas démarré lors de cette session. Risque jugé minime : ce changement ne touche ni `backend/access.py` ni aucune route serveur, uniquement le rendu du menu côté client (`canSee()`, qui décide quelles entrées `NAV` sont visibles par rôle, est totalement inchangé) — à rejouer malgré tout dès qu'un environnement PostgreSQL est disponible, par précaution.

## Ajout V1.75 : groupes de menu repliés par défaut + libellés plus visibles

### Origine

Demande directe de l'utilisateur (verbatim), accompagnée d'une capture d'écran montrant les 5 groupes affichés fermés (chevron fermé, aucun écran enfant visible) : « merci d afficher au depart uniquement les noms des modules comme indique ci joint / Les noms des modules doivent etre plus visibles / expliquer moi ce que vous avez compris ». Compréhension exposée à l'utilisateur avant toute implémentation (pas de question à choix multiples nécessaire, la demande et la capture étant suffisamment précises) :

- Au chargement de l'application, les 5 groupes de la V1.74 doivent être **repliés par défaut** (seul le nom du module est visible, pas ses écrans) — jusqu'ici, c'était l'inverse (tous dépliés par défaut). Tableau de bord/Personnel/Backlog/Paramètres restent des liens directs, inchangés.
- Le libellé de chaque module doit être **plus visible** : jusqu'ici affiché en gris clair (`--ink-faint`) et petite taille (11,5px), pensé comme un simple sous-titre discret.
- Un groupe contenant la route actuellement affichée reste (ou redevient) toujours déplié, exactement comme en V1.74 — seuls les *autres* groupes restent repliés par défaut.

### Ce qui a été construit

Modifications ciblées dans `static/js/app.js` et `static/css/style.css`, sans toucher à la structure des groupes (`NAV_GROUPS`) ni à aucune route serveur :

- **Inversion de la polarité de l'état de repli** : l'ancienne variable `navGroupesRepliees` (vide = tout déplié par défaut) est remplacée par `navGroupesDepliees` (vide = tout **replié** par défaut). `navGroupeEstReplie()` retourne désormais `!navGroupesDepliees[g.id]` au lieu de `!!navGroupesRepliees[g.id]`, et le gestionnaire de clic sur l'en-tête bascule `navGroupesDepliees[gid]`. Le comportement de priorité reste inchangé : un groupe contenant la route active est toujours forcé déplié, quel que soit cet état.
- **Libellés de groupe plus contrastés** (`.nav-group-header` dans `style.css`) : couleur portée de `var(--ink-faint)` (gris clair, la plus discrète de la palette) à `var(--ink)` (contraste plein, la même utilisée pour le texte normal) ; taille de police portée de 11,5px à 13px (proche des 13,5px des liens d'écran) ; l'icône du groupe passe d'une opacité de 0,8 à 1 ; au survol, la couleur passe à `var(--primary-strong)` (au lieu d'un simple `--ink-soft`) pour mieux signaler l'interactivité. La convention majuscules + gras est conservée, pour continuer à distinguer visuellement un en-tête de groupe d'un lien d'écran.
- Version applicative renommée `V1.75`.

### Validation effectuée

- `test_nav_groupes_v175.py` (nouveau, remplace `test_nav_groupes_v174.py` dont la base attendait l'ancien comportement par défaut) : les 5 en-têtes de groupe sont bien présents, Tableau de bord/Backlog/Paramètres/Personnel restent hors de tout groupe, **tous les groupes sont bien repliés (`hidden`) au chargement initial** (nouvelle assertion V1.75), un clic sur « Commercial » le déplie puis un second clic le replie à nouveau, la navigation standalone fonctionne toujours, naviguer vers une route d'un groupe replié le force à se déplier **sans affecter les autres groupes** (qui restent repliés), et désactiver le module Comptabilité (V1.57) fait toujours disparaître tout le groupe.
- Vérification visuelle via capture d'écran Playwright : l'état initial de la barre latérale correspond très exactement à la capture fournie par l'utilisateur (5 groupes fermés, noms seuls visibles, Personnel/Backlog/Paramètres en liens directs) ; un clic sur un en-tête déplie bien le groupe concerné sans affecter les autres.
- **Suite de régression des 9 tests déjà rejoués pour la V1.74 adaptée et rejouée** : chacun des tests qui cliquait directement sur un lien de groupe (« Clients », « Contrats », « Livrables techniques », « Carnet d'envois », « Plan de charge », « Timesheet ») a reçu un appel préalable à une petite fonction `ouvrir_groupe(page, nom)` (ajoutée à chaque fichier) qui déplie le bon groupe une seule fois avant d'y cliquer un lien pour la première fois — ce n'est pas un simple contournement de test : cela reflète fidèlement le nouveau parcours réel d'un utilisateur, qui doit désormais ouvrir un module avant d'accéder à l'un de ses écrans. Rejoués avec succès après adaptation : V1.60 (bordereaux/historique), V1.62 (statut de retour), V1.63 (budget/avancement), V1.64 (Backlog, sans impact car aucun lien groupé), V1.67 (filtre par contrat), V1.70 (planification manuelle — y compris après un rechargement complet de page en cours de test, qui réinitialise l'état replié/déplié en mémoire et nécessite donc un second appel à `ouvrir_groupe`), V1.71 (Timesheet), V1.73 (codification par segments). `test_livrables_codif.py` (V1.58, déjà obsolète depuis la V1.73) échoue toujours pour la même raison déjà documentée, sans rapport avec ce changement.
- **Non rejoué dans cet environnement** : les deux tests d'accès nécessitant un vrai serveur PostgreSQL (`test_backlog_access_v164.py`, `test_bordereaux_access_v160.py`) — service toujours indisponible dans cet environnement. `test_bordereaux_access_v160.py` a tout de même été adapté (ajout de `ouvrir_groupe` avant son unique clic sur un lien de groupe) pour rester cohérent dès qu'un environnement PostgreSQL sera disponible. Risque jugé minime, pour la même raison qu'en V1.74 : ce changement ne touche que le rendu du menu côté client, pas `backend/access.py` ni `canSee()`.

## Ajout V1.76 : nouveau découpage des modules — Contrat, RH, relevés bancaires vers Comptabilité

### Origine

Demande directe de l'utilisateur, accompagnée d'une capture d'écran annotée à la main (flèches rouges « MODULE » et « CONTRAT » pointant sur la liste Commandes clients/Contrats/Avenants/Attachements du module Commercial), avec trois instructions verbatim : « ajouter module contrat / ajouter module RH y integrer personnel / releve bancaire dans contrat ». Quatre questions à choix multiples posées avant toute implémentation, la demande touchant à la fois l'affichage du menu et, potentiellement, le système d'installation/désactivation par poste (V1.57) :

- **Périmètre du nouveau module « Contrat »** : exactement les écrans Commandes clients, Contrats, Avenants et Attachements (ceux de la capture), sortis du module Commercial qui ne garde alors que Clients et Devis → **Oui, exactement ça (retenu)**.
- **Destination des Relevés bancaires** : la demande initiale disait « dans Contrat », mais la réponse donnée en cours d'échange a corrigé ce choix → **« en fait a deplacer dans le module comtabilite »** — c'est donc vers Comptabilité, pas vers Contrat, que ce module a été déplacé.
- **Portée du module « RH »** : simple renommage de l'affichage du module Personnel existant, ou regroupement avec d'autres écrans ? → **Sans préférence exprimée** : retenu l'option recommandée, un renommage simple (aucun autre écran RH n'existe encore à y intégrer).
- **Portée du changement (affichage seul, comme la V1.74, ou aussi le système d'installation/désactivation par poste V1.57)** → **Sans préférence exprimée** : retenu l'option recommandée, les deux couches mises à jour ensemble — à la différence de la V1.74/V1.75, qui ne touchaient que l'affichage.

### Ce qui a été construit

Contrairement à la V1.74/V1.75 (purement décoratives), ce changement touche **à la fois** `backend/modules.py` (système d'installation/désactivation par poste, V1.57) **et** `static/js/app.js` (`NAV_GROUPS`, affichage du menu), en parallèle :

- **Nouveau module « Contrat »** (`backend/modules.py`, id `contrat`) : regroupe les sections `bc` (Commandes clients), `ctr` (Contrats), `av` (Avenants), `att` (Attachements) — retirées du module `commercial`, qui ne garde plus que `clients` et `devis`. Installable/désactivable indépendamment via *Paramètres > Modules installés*, exactement comme les autres modules.
- **Relevés bancaires déplacés vers Comptabilité** : la section `releves` quitte le module `fournisseurs` (qui ne garde que `fournisseurs` et `facturesF`) pour rejoindre le module `compta`. Aucun changement à `backend/access.py` : ce sont les mêmes sections ACCESS existantes qui sont simplement regroupées différemment par module — les droits par rôle sur chaque écran restent strictement identiques.
- **Module « Personnel » rebaptisé « RH »** : seul le libellé change (`backend/modules.py`), l'id interne reste `personnel` pour ne pas invalider un réglage `modulesDesactives` déjà enregistré sur un poste existant.
- **Côté affichage (`static/js/app.js`, `NAV_GROUPS`)** : même redécoupage appliqué au menu — nouveau groupe « Contrat », Commercial allégé, Fournisseurs sans Relevés bancaires, Comptabilité avec Relevés bancaires, groupe « RH ».
- **Correctif de la règle d'aplatissement des groupes à un seul item (V1.74)** : jusqu'ici, un groupe réduit à un seul écran visible s'affichait toujours comme un lien direct, sans en-tête (pour éviter la redondance quand le libellé du groupe était identique à celui de son unique item, cas de « Personnel »). Le module « RH » s'est heurté à l'inverse : son libellé de groupe (« RH ») diffère désormais de celui de son unique écran (« Personnel ») — il n'y a donc plus aucune redondance ni ambiguïté à l'aplatir. La règle a été affinée (`navGroupHtml`, `static/js/app.js`) : un groupe à un seul item ne s'aplatit plus que si son libellé de groupe est **identique** à celui de cet item ; sinon il s'affiche comme un vrai groupe repliable (« RH » ▸ « Personnel »), cohérent avec tous les autres modules du menu.
- *Paramètres > Modules installés* reflète automatiquement ce nouveau découpage (code déjà générique, boucle sur `etat_modules()`) : aucune modification de ce code n'a été nécessaire.
- Version applicative renommée `V1.76`.

### Validation effectuée

- `test_nav_groupes_v176.py` (nouveau) : les 7 en-têtes de groupe attendus sont présents (Commercial, Contrat, Projets d'ingénierie, Facturation clients, Fournisseurs, RH, Comptabilité) ; Personnel n'est plus un lien standalone ni un libellé de groupe — il est bien à l'intérieur du groupe RH ; répartition exacte des écrans vérifiée (Clients/Devis → Commercial, Commandes clients/Contrats/Avenants/Attachements → Contrat, Relevés bancaires → Comptabilité et non Fournisseurs, Fournisseurs/Factures fournisseurs → Fournisseurs, Personnel → RH) ; tous les groupes (y compris les deux nouveaux) restent repliés par défaut (comportement V1.75 inchangé) ; le groupe RH se déplie au clic et la navigation vers Personnel fonctionne sans ambiguïté ; désactiver le nouveau module `contrat` via `/api/modules` fait disparaître tout le groupe correspondant.
- Vérification visuelle (captures d'écran Playwright) : le menu replié puis entièrement déplié correspond exactement au découpage voulu ; l'écran *Paramètres > Modules installés* affiche bien les nouveaux libellés (« Contrat (Commandes clients, Contrats, Avenants, Attachements) », « Fournisseurs (fiches, factures fournisseurs OCR) », « RH », « Comptabilité (…, relevés bancaires) »).
- **Suite de régression des 9 tests déjà rejoués pour la V1.74/V1.75, adaptée et rejouée à nouveau** : chaque clic direct sur « Contrats » (désormais dans le groupe Contrat et non plus Commercial), « Commandes clients » et « Personnel » (désormais dans le groupe RH et non plus standalone) a reçu un appel préalable à `ouvrir_groupe(page, ...)` ciblant le bon groupe. Rejoués avec succès : V1.60, V1.62 (voir aussi correctif ci-dessous), V1.63, V1.64 (sans impact), V1.67, V1.70, V1.71, V1.73. `test_livrables_codif.py` échoue toujours pour la même raison déjà documentée, sans rapport avec ce changement.
- **Correctif mineur découvert en cours de rejeu (`test_retour_v162.py`)** : l'attente de 500 ms après la création du livrable (avant d'ouvrir le Carnet d'envois) s'est révélée insuffisante pour laisser le polling local (2 s, `local-db.js`) rattraper `STATE.livrables` — un livrable réellement enregistré en base (confirmé par appel direct à l'API) mais pas encore reflété côté client, faisant échouer la suite du scénario (aucune ligne à cocher dans le formulaire de bordereau). Cette fragilité préexistait (un simple décalage de timing, sans lien avec ce changement de modules) mais n'avait jamais été débusquée jusqu'ici par chance de timing ; portée à 2300 ms, comme déjà fait ailleurs dans ce même test après chaque création de client/contrat.
- **Non rejoué dans cet environnement** : les deux tests d'accès PostgreSQL (`test_backlog_access_v164.py`, `test_bordereaux_access_v160.py`) — service toujours indisponible ; aucun des deux ne référence les écrans déplacés par ce changement, donc aucune adaptation n'a été nécessaire de ce côté. Risque jugé minime : les sections ACCESS elles-mêmes (`backend/access.py`) sont strictement inchangées, seul leur regroupement par module l'est.

## Limite assumée

La sécurité des accès est réelle en mode cloud/PostgreSQL (email + mot de passe, rôles vérifiés côté serveur, voir V1.55 ci-dessus) — inchangé par la V1.56 à la V1.76 — voir aussi le paragraphe « L'import Excel du registre des livrables (V1.66)… » ci-après pour les limites propres à cette version. Le regroupement du menu en modules (V1.74, affiné en V1.75 avec repli par défaut et libellés plus visibles, puis redécoupé en V1.76 — nouveau module Contrat, Relevés bancaires rattachés à Comptabilité, Personnel rebaptisé RH) ne change à aucun moment les sections ACCESS elles-mêmes ni les droits par rôle qui leur sont attachés (`backend/access.py` strictement inchangé depuis la V1.55) — seul leur regroupement en modules affichés/installables change ; l'état replié/déplié de chaque groupe n'est, par ailleurs, pas conservé entre deux sessions (il repart replié par défaut à chaque rechargement). La codification des livrables (V1.58) devient, depuis la V1.72, configurable par contrat plutôt qu'un format unique imposé à toute l'application, puis, depuis la V1.73, ce configurateur vit au niveau des Livrables techniques (pas du Contrat) et porte aussi sur des **segments personnalisés** librement ajoutables par contrat (Zone/Niveau/Discipline n'étant plus qu'un jeu de 3 segments par défaut) : un contrat non personnalisé garde le format par défaut (6 segments, identique à la V1.58), mais rien n'empêche un contrat d'être configuré avec une composition ou des segments qui ne garantiraient pas, à eux seuls, un code lisible ou cohérent avec les autres contrats de l'application (seul le numéro séquentiel reste garanti présent, pour l'unicité) — c'est un choix délibérément laissé à l'appréciation de l'Administrateur/Conducteur de travaux qui configure le contrat, l'application ne l'empêche pas de faire un choix peu pratique. **En usage local, en revanche, depuis la V1.56, l'application s'ouvre directement en administrateur sans aucune authentification, par choix explicite de l'utilisateur** (voir ci-dessus) : la séparation des rôles n'y protège plus rien, ce qui est acceptable tant que ce mode reste local, sur un poste non exposé au réseau. Les modules désactivables (V1.57) sont un découpage par installation, pas un mécanisme de sécurité par utilisateur : en local, où tout le monde est automatiquement administrateur, désactiver un module le cache pour tout le poste, pas pour certaines personnes seulement. La codification des livrables (V1.58) couvre pour l'instant le seul périmètre métier électrique (courant fort/faible) de Futura Expertise ; les listes Zone/Niveau/Discipline/Catégorie (V1.59) restent, comme dans la démarche de référence, des référentiels « vivants » à compléter selon le besoin réel, pas des valeurs figées. Le Carnet d'envois (V1.60) ne permet, volontairement, que la création et la consultation/impression d'un bordereau — seules la date et le statut de retour de chaque ligne sont modifiables après coup depuis la V1.62, tout le reste restant définitif. Le statut global du livrable (V1.62) est saisi manuellement et n'est jamais recalculé automatiquement depuis les retours de bordereau, par choix explicite de l'utilisateur — les deux peuvent donc diverger si le statut global n'est pas mis à jour à la main, et c'est justement ce statut manuel qui sert de base à l'avancement pondéré de la V1.63 : si l'utilisateur oublie de le mettre à jour à chaque nouvelle révision, l'avancement affiché sera inexact. Le budget horaire (V1.63) est une donnée de planification purement déclarative, saisie manuellement, jamais comparée à des heures réellement passées (aucun pointage horaire dans l'application à ce stade) ; un livrable sans aucun budget saisi n'apporte aucun poids au calcul pondéré, sans provoquer d'erreur. Le Backlog de développement (V1.64) est un outil de suivi interne, pas un document métier : il ne porte aucune numérotation ni codification, et les 12 pistes importées restent celles identifiées au moment de l'analyse — libre à l'Administrateur d'en ajouter, en modifier ou en supprimer d'autres au fil de l'eau. Le plan de charge est, depuis la V1.70, un module de **saisie manuelle** (voir ci-dessus) : les heures entrées ligne par ligne, jour par jour, sont une déclaration libre, jamais vérifiée ni comparée à quoi que ce soit — ni au budget horaire du livrable (V1.63), ni aux dates planifiées/affectations de sa fiche (restées des champs purement informatifs, V1.65), ni à la durée du contrat, ni aux congés/indisponibilités d'une personne (aucun module de congés dans l'application à ce stade) ; une même personne peut ainsi se retrouver, sans aucun avertissement, chargée sur plusieurs lignes/contrats le même jour pour un total dépassant largement une journée de travail. Les lignes de planification ne sont pas des documents numérotés du périmètre CDC : leur suppression est physique et définitive (pas d'annulation réversible, RG-004/RG-005 ne s'appliquant qu'aux documents cités dans ces règles). Les personnes affectées et les dates planifiées d'un livrable (V1.65) restent, elles, un champ informatif sur sa fiche (qui l'a planifié, pour quelle période), désormais sans aucun lien avec le plan de charge. Depuis la V1.71, un second écran « Timesheet » existe en plus du Plan de charge, mécaniquement identique (même grille, même case « journée entière » qui remplit 8h et verrouille la case tant qu'elle reste cochée, même filtre par personne en plus du filtre par contrat) mais adossé à sa propre collection, totalement indépendante : il représente les heures réellement passées (pointage réel) par opposition au Plan de charge qui reste prévisionnel, et aucune ligne n'est reprise automatiquement de l'un vers l'autre — à l'utilisateur de saisir, le cas échéant, la même information deux fois s'il souhaite comparer prévisionnel et réel, aucun calcul d'écart n'étant fait automatiquement par l'application à ce stade. L'import Excel du registre des livrables (V1.66) attribue le budget horaire uniquement à la révision courante de chaque document (les révisions antérieures reçoivent 0h, faute de donnée par révision dans le classeur source), force Zone/Niveau/Discipline/Type aux valeurs par défaut (ces axes du classeur codant le découpage propre au client, pas celui de Futura Expertise), et regroupe les transmissions reconstituées par date d'envoi plutôt que par document, avec un destinataire et un état de transmission génériques faute de mieux dans la source. Restent par ailleurs hors périmètre, à traiter dans une version ultérieure si le besoin se confirme : pas de journal d'audit des actions, pas de limitation du nombre de tentatives de connexion, pas de double authentification (2FA), et le chiffrement du trafic réseau (HTTPS) dépend de la configuration de l'hébergeur choisi — le serveur de développement fourni ici n'en fait pas lui-même.

## Suite de tests automatiques

Un test de fumée de bout en bout est fourni (`e2e_smoke_test.py`), qui
vérifie via un navigateur piloté (Playwright) le parcours principal :
création du compte administrateur, création d'un client, création d'un
devis avec numérotation automatique, puis persistance des données après
rechargement de la page. Lancement :

```bash
pip install playwright --break-system-packages
playwright install chromium
python3 app.py &        # démarrer le serveur dans un terminal
python3 e2e_smoke_test.py
```

## V3.14 — Étude électrique > Calcul
Nouveau sous-menu « Calcul » : à gauche la hiérarchie de la distribution (SOURCE > tableaux > sous-tableaux, déduite de la base de données des consommateurs), à droite le détail du tableau sélectionné (Repère, Style, Contenu, Nb, Consommation, Longueur, Protection, Prot CI, JdB, D. Origine, Alimentation, Lieu, Désignation). Un clic sur un départ ouvre la saisie du circuit : câble (catalogue des câbles, famille puis section), nombre de câbles, longueur, protection (constructeur > catégorie > gamme > calibre > déclencheur), Prot CI, JdB, lieu, désignation. Stockage : table `etude_bt_circuits` (collection `etudeBtCircuits`, étape `etudeCircuitsBtV314`). Aucun résultat de calcul (IB, section, ΔU, Ik) à ce stade.

## V3.15 — Calcul > Importer note Caneco (câbles et protections)
Bouton « Importer note Caneco » dans l'écran Calcul. Fichier accepté : le zip des exports Caneco, ou le seul `Circuits.XLS` (.xls / .xlsx ; le module `xlrd` lit l'ancien format .xls). Le serveur lit le fichier (`POST /api/etude-elec/caneco-lire`, sans écriture) ; le rapprochement se fait à l'écran : circuit Caneco <-> départ de la base par le repère ; type de câble Caneco -> famille du catalogue des câbles (+ section de phase) ; bloc de coupure -> constructeur / catégorie / gamme ; bloc déclencheur -> déclencheur. Ce qui n'est pas trouvé par son nom se relie à la main dans la fenêtre d'import ; les liens sont mémorisés (table `etude_bt_liens_caneco`, collection `etudeBtLiensCaneco`, étape `etudeLiensCanecoV315`) et réutilisés. Le libellé d'origine de Caneco est toujours conservé dans le circuit (champs `caneco*`). Seuls le câble et la protection sont importés ; la protection de tête du tableau (Tab_Tr) est lue mais pas enregistrée.

## V3.16 — liens Caneco : variante
Le lien d'une protection Caneco porte maintenant sur constructeur > catégorie > gamme > variante (pouvoir de coupure, facultative : vide = choix automatique selon l'Icu de Caneco). Colonne `variante` ajoutée à `etude_bt_liens_caneco` (étape `etudeLiensVarianteV316`). Mise en page de la fenêtre d'import corrigée (sélecteurs sur deux colonnes).

## V3.17 — Liens Caneco : suggestions automatiques
La fenêtre d'import propose elle-même la correspondance (rien n'est enregistré avant « Enregistrer les liens et suggestions ») : bloc de coupure -> gamme et variante déduites du nom (NSX250HB1 -> ComPacT NSX250, variante H ; GV2 L16 -> GV2 L), bloc déclencheur -> déclencheur de nos catalogues (TM160D -> TM-D, Micrologic 2.3 -> Micrologic 2.x, MA100 -> MA ; en cas de plusieurs candidats on retient ceux associés à la gamme), type de câble -> famille. Si plusieurs candidats subsistent ils sont listés ; sinon « aucune suggestion » et le choix reste manuel. Nouveau bouton « Liens Caneco » dans Calcul : rouvre la fenêtre sur les circuits déjà importés (sans le fichier) et applique les liens à ces circuits.

## V3.18 — suggestions appliquées à l'import
Les liens suggérés dans la fenêtre sont désormais enregistrés puis appliqués quand on clique sur « Importer » / « Appliquer » (avant, il fallait penser à cliquer « Enregistrer les liens » : sinon les circuits restaient « non reliés »). Bandeau jaune : « N lien(s) suggéré(s)… ».

## V3.19 — Déclencheurs : une référence par ligne
Base matériel > Protections BT > onglet Déclencheurs : une ligne par référence (TM40D, TM80D, MA50, MA100, Micrologic 2.2, GV2 L16…) avec série, In, plage Ir, seuil Im (colonnes `serie`, `calibre_a`, `ir_min_a`, `ir_max_a`, `im_min_a`, `im_max_a`, étape `etudeDeclencheursReferencesV319`). Associations : une ligne par gamme et par référence compatible (TM / MA / GV : calibre = In). Réglages : par référence. Fichier d'import : `Protections_Schneider_Import_V3.19.xlsx` (à importer en mode « Remplacer » pour remplacer les déclencheurs de famille). Les références Caneco (TM160D, MA100, Micrologic 2.3…) sont retrouvées par leur nom exact.

## V3.20 — Représentation du câble façon Caneco
Calcul : le câble est représenté en trois lignes Câble / Neutre / PE ou PEN. Multipolaire : `3x120` (sans PE), `5G4` (G = PE dans le câble) ; unipolaires : `3X(1x240)` + Neutre `1x240` + PE `1x70` ; plusieurs câbles par phase : `2 Câbles 3x120`. Colonne « Alimentation » de la grille : `3X(1x240) + N 1x240 + PE 1x70 · U1000R2V`. Fiche circuit : structure (multipolaire / unipolaires), nombre de conducteurs ou de phases (défaut déduit du « Contenu » : 3P+N+PE = 5G), PE dans le câble, neutre et PE (nombre × section) et aperçu en direct. Import Caneco : la structure est lue dans le libellé « Câble » de la note, le neutre et le PE dans « Section Neutre / Section PE ». Champs stockés dans l'extra du circuit (aucune migration).

## V3.21 — grille : même représentation que la fiche
Un circuit saisi ou importé avant la V3.20 (sans structure mémorisée) affiche dans la colonne Alimentation la même représentation que la fiche (valeur par défaut déduite du « Contenu » du consommateur : 3P+PE = 4G120, 3P+N+PE = 5G120, 3P = 3x120) au lieu de « U1000R2V 120 mm² ».

## V3.22 — Protections BT : interrupteurs, fusibles et modulaires vus dans les notes Caneco
Nouvelles gammes dans le catalogue (fichier d'import `Protections_Schneider_Import_V3.22.xlsx`) : Acti9 **iDT40 / DT40** (K, N, T, courbes B/C/D), **iDD40** (différentiel), **iID**, **iSW**, Interpact **INS40 à INS630**, Fupact **INFC** (10x38, 14x51, 22x58) et **INFD** (NH 40 à 630), plus les classes de fusibles **gG** et **aM** (déclencheurs, associées aux gammes à fusibles). Quatre catégories nouvelles : *Interrupt. sectionneur*, *Interrupt. différentiel*, *Interrupt. à fusibles*, *Disjonct. différentiel*. Les noms Caneco (INS80, IDT40K, INFC 63 14x51, INFD 160, gG…) sont reliés automatiquement à l'import. Valeurs « à vérifier catalogue ». Aucune migration (importer en mode « Fusionner »).

## V3.23 — « Départ type » par projet et modèles d'appartement dans la note de calcul
**Base de données** : la colonne « Special Reqts » devient **« Départ type »** (tableau, import et export Excel ; l'import reconnaît toujours l'ancien titre). Sa liste de valeurs est **propre à chaque contrat / devis** : par défaut DOL, VFD, DD, FEEDER, NA, N/A ; à la première modification (Gérer les listes ou nouvelle valeur), la liste du projet est créée en copiant les valeurs par défaut, puis modifiée librement (ex. « Appart type 12 »). Stockage : mêmes lignes `etude_listes_valeurs`, liste nommée `specialReqts@<id du projet>` (aucune migration).
**Note de calcul** : un consommateur de type Tableau dont le « Départ type » est le nom d'un tableau (ex. IMM A1-01 → « Appart type 12 ») **hérite des départs de ce tableau modèle**. Les modèles sont rangés sous la rubrique **« Modèles (sans calcul) »** avant SOURCE, avec le nombre d'appartements ; chaque appartement reste un tableau réel sous son amont, ses départs hérités s'affichent en lecture seule (italique). Cliquer un départ hérité propose **Personnaliser** (circuit propre à l'appartement, champ `instanceCle` dans `etude_bt_circuits.extra`, marqué ✎) ou **Ouvrir le modèle** ; **Revenir au modèle** supprime la personnalisation. Un appartement qui a ses propres départs dans la base garde les siens.

## V3.24 — Schéma unifilaire (Étude électrique > Schéma unifilaire)
Schéma unifilaire **généré par projet** (contrat ou devis), de la source (réseau amont) aux tableaux, **sans les départs terminaux ni les tableaux modèles** (Appart type N). Les appartements d'un même modèle sous un même tableau sont regroupés (« 7 × IMM A1-01 … IMM A1-08 »). Disposition automatique de haut en bas, symboles CEI 60617 (source, transformateur, disjoncteur, interrupteur-sectionneur, interrupteur à fusibles, jeu de barres). Sur chaque liaison : protection de départ (gamme, variante, calibre, déclencheur) et câble (représentation 4G120 · U1000R2V, longueur) saisis dans « Calcul » ; sur chaque tableau : tension, S foisonnée du bilan (kVA), nombre de départs terminaux ; transformateur(s) choisi(s) dans le bilan. Exports : **SVG**, **DXF** (AutoCAD R12, calques BARRES / LIAISONS / SYMBOLES / TEXTES / CARTOUCHE, 1 px = 0,3 mm, vérifié sans erreur avec ezdxf) et **PDF** (fenêtre d'impression A3 paysage). Rien n'est stocké : le schéma se recalcule depuis la base, le bilan et le calcul (aucune migration). Fichier `static/js/etude-unifilaire.js`. Prochaine étape possible : déplacement manuel des blocs avec enregistrement de la mise en page.

## V3.25 — Schéma unifilaire : récepteurs
Le schéma unifilaire représente maintenant aussi les **récepteurs** (départs terminaux) de chaque tableau : un départ par colonne sous le jeu de barres, avec le symbole de protection (si le circuit est saisi dans « Calcul »), la protection et le câble + longueur en texte vertical, le symbole du récepteur (**M** cerclé pour un moteur, rectangle **C** pour une charge), son repère, sa puissance et « ×n » si le nombre est supérieur à 1. Récepteurs et tableaux fils sont placés dans l'ordre de la base. Case **Récepteurs** pour les masquer ; bouton **Ajuster** (zoom à la largeur de l'écran, appliqué automatiquement à l'ouverture si le schéma est plus large). Les tableaux modèles et les départs des appartements regroupés restent non représentés. Exports SVG / DXF (texte vertical : angle 90°) / PDF inchangés. Aucune migration.

## V3.26 — Schéma unifilaire : symbole du disjoncteur et bloc source avec transformateur
**Disjoncteur** : symbole redessiné (interrupteur ouvert vertical : conducteurs haut et bas, lame articulée en bas et inclinée, croix « × » sur le bout de la lame) ; le sectionneur reprend la même lame avec une barre transversale au contact haut. **Source** : le bloc « Source » reçoit le **symbole du transformateur** (deux cercles, conducteur interrompu de part et d'autre) avec ses **caractéristiques** : code, nombre × puissance ONAN (et ONAF), tensions primaire / secondaire, uk et Pk (lus dans le transformateur choisi dans le bilan de puissance, base matériel). Sans transformateur choisi, un tableau de tête dont le nom contient « transfo » (ex. TRANSFORMATEUR 1000 kVA) reçoit le symbole et son nom. Même représentation pour un transformateur situé entre deux tableaux. Aucune migration.

## V3.27 — Schéma unifilaire : symbole de charge
Le récepteur qui n'est pas un moteur (charge) est dessiné par un **rectangle sans lettre** (symbole CEI de récepteur) ; le **M** cerclé reste pour les moteurs ; la légende figure dans le cartouche. Aucune migration.

## V3.28 — Schéma unifilaire : symboles d'appareillage selon la planche fournie
Symboles de l'appareillage redessinés d'après la planche « Appareillage d'installation » : conducteur du haut sur l'axe, **lame articulée en bas** montant vers la droite, bout de lame sous l'extrémité du conducteur (contact ouvert), petit décrochement ramenant le conducteur du bas sur l'axe. **Disjoncteur** = lame + **croix** sur le contact ; **sectionneur** = lame + barre ; **interrupteur-sectionneur** (INS, iSW…) = lame + barre + petit rond ; **interrupteur à fusibles** (INFC, INFD) = sectionneur + fusible posé sur la lame. Aucune migration.

## V3.29 — Schéma unifilaire : navigation façon AutoCAD et export par zone
**Navigation à la souris** (le schéma est un cadre fixe piloté par `viewBox`, plus de barres de défilement) : **molette** = zoom centré sur le curseur ; **molette enfoncée + glisser** = déplacement ; **double-clic molette** (ou bouton « Tout afficher », touche 0 / Début) = zoom étendue ; **« Zoom fenêtre »** = on clique deux coins ou on glisse un cadre (cadre bleu pointillé) ; **« Main »** ou barre d'espace maintenue + glisser pour les souris sans molette ; **Échap** annule l'outil. Tactile : un doigt déplace, deux doigts pincent. Pourcentage de zoom affiché ; la vue est conservée quand la base se rafraîchit. 
**Export** (bouton « Exporter… », comme les options Étendue / Affichage / Fenêtre de la commande TRACER d'AutoCAD) : **Vue entière** (tout le schéma), **Affichage** (ce qui est à l'écran) ou **Fenêtre** (cadre tracé à la souris), au format **DXF**, **SVG** ou **PDF** (impression A3, paysage ou portrait selon la zone). Pour une zone partielle, le SVG est cadré sur la zone et le DXF ne contient que la zone (traits coupés à la fenêtre, cercles et textes conservés s'ils la touchent, origine au coin bas-gauche de la zone). Le nom du fichier porte le suffixe _affichage ou _fenetre. Aucune migration.

## V3.30 — Éditeur de symboles (Étude électrique > Éditeur de symboles)
Éditeur graphique **type AutoCAD** de la **bibliothèque de symboles**, **commune à tous les projets** (collection `etudeSymboles`, table `etude_symboles`, droits « etude_elec »). Unités : **millimètres**, axe Y vers le haut, origine (0,0) = point d'insertion du symbole dans le schéma.
**Fond** : quadrillage fin au millimètre, **traits des centimètres plus foncés** (le niveau de détail s'adapte au zoom : 1 mm / 1 cm / 10 cm), axes X (rouge) et Y (vert) à l'origine.
**Dessin** : Ligne (L, enchaînée, longueur tapée + Entrée), Polyligne (PL, C = fermer, U = retirer le dernier point), Rectangle (REC), Cercle (C, rayon cliqué ou tapé), Arc par 3 points (A), Texte centré (T / DT, hauteur réglable), Effacer (E / Suppr). **Sans ligne de commande** : on tape l'alias au clavier puis Espace/Entrée ; Entrée seule répète la dernière commande ; le clic droit vaut Entrée.
**Sélection** : clic (ajoute), Maj+clic (retire), glisser vers la droite = **fenêtre** (objets entièrement inclus), vers la gauche = **capture** (objets touchés), Ctrl+A.
**Accrochages** : grille (F9, pas 0,5 / 1 / 2 / 2,5 / 5 mm / 1 cm), ortho (F8), objets OSNAP (F3) : extrémité, milieu, centre, quadrant, intersection (marqueurs façon AutoCAD) ; grille visible F7.
**Navigation** : molette = zoom au curseur, molette enfoncée = déplacer, double-clic molette ou ZE = étendue, ZW = zoom fenêtre, P = main. Annuler/Rétablir : U, Ctrl+Z, Ctrl+Y ; Échap annule la commande ; Ctrl+S enregistre.
**Bibliothèque** : 9 symboles « système » livrés (disjoncteur, sectionneur, interrupteur-sectionneur, interrupteur à fusibles, fusible, transformateur, source, moteur, charge — géométrie du schéma V3.28) ; ils n'existent en base qu'une fois modifiés, et « **Rétablir le symbole par défaut** » supprime la modification. Nouveau / Dupliquer / Supprimer pour les symboles de l'utilisateur ; confirmation si des modifications ne sont pas enregistrées.
Le schéma unifilaire continue pour l'instant d'utiliser ses symboles intégrés : leur **branchement sur la bibliothèque** (association catégorie → symbole, bornes de raccordement, outils déplacer/copier/rotation/miroir, export DXF en BLOCK/INSERT) est prévu en **V3.31**, puis variables de texte, import/export DXF/SVG d'un symbole en **V3.32**.

## V3.31 — Éditeur de symboles : modification, bornes, branchement sur le schéma ; import Caneco « la base l'emporte »
**Import Caneco** : la composition du câble (3x / 4G / 5G…) est toujours celle du « Contenu » du consommateur ; Caneco ne fournit plus que la famille, la section, le nombre de câbles par phase et la longueur (toute structure mémorisée auparavant est effacée à la réimportation).
**Outils de modification** : **M** déplacer, **CO** copier (répétable, Entrée pour finir), **RO** rotation (angle cliqué ou tapé en degrés), **MI** symétrie (axe de deux points ; **O** + Entrée pour effacer la source). Objets présélectionnés ou choisis puis Entrée ; aperçu en pointillés bleus.
**Bornes de raccordement** : **BE** borne d'entrée « in » (haut), **BS** borne de sortie « out » (bas), un point chacune (replacer remplace). Le schéma raccorde le conducteur sur ces bornes.
**Symbole utilisé dans le schéma** : case « Utilisé dans le schéma » ; un seul symbole par catégorie (à défaut : le symbole système du même nom). Le **schéma unifilaire dessine maintenant les symboles de la bibliothèque** : protections (disjoncteur, sectionneur, interrupteur-sectionneur, interrupteur à fusibles, fusible), transformateur, moteur, charge. Le bloc « Source » garde son dessin propre. Les conducteurs sont interrompus sous les symboles ; un fil de liaison est ajouté si les bornes ne tombent pas sur les points de raccordement.
**DXF** : dans le schéma exporté, chaque symbole est un **BLOCK** `SYM_<CODE>` (en mm) inséré par INSERT sur le calque SYMBOLES ; dans l'éditeur, **Exporter DXF** écrit toute la bibliothèque (un BLOCK par symbole, bornes sur le calque BORNES). Code d'un symbole : 2 à 26 caractères. Le SVG et le PDF reprennent les mêmes symboles.

## V3.32 — Éditeur de symboles : import DXF/SVG, export SVG, textes variables, bloc Source
**Importer…** (barre d'outils) : fichier **DXF** (dessin ou un bloc au choix ; LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, TEXT/MTEXT, INSERT développés ; unité lue dans $INSUNITS, facteur → mm modifiable) ou **SVG** (line, polyline, polygon, rect, circle, ellipse, path avec courbes et arcs convertis en segments, text, transformations ; unité lue dans width/viewBox, sinon 96 ppp). Option « Centrer sur l'origine ». Les objets importés s'ajoutent au dessin et restent sélectionnés (M pour les placer, Ctrl+Z pour annuler). **Exporter SVG** : le symbole affiché, en millimètres.
**Textes variables** : dans un texte du symbole, **{gamme}**, **{calibre}**, **{declencheur}**, **{kVA}**, **{code}**, **{tension}**, **{repere}**, **{puissance}** sont remplacés dans le schéma par les données du circuit, du transformateur ou du récepteur (affichés en violet dans l'éditeur ; variable inconnue = vide). Dans le DXF du schéma, ces textes sont de simples TEXT (le BLOCK ne contient que les parties fixes).
**Bloc Source du schéma** : dessiné avec le symbole « source » de la bibliothèque (catégorie Source, modifiable et choisissable comme les autres), titre et sous-titre à droite ; la borne de sortie (bas) se raccorde au conducteur.

## V3.33 — Correctif : éditeur de symboles tronqué au premier affichage
Le bouton « Exporter SVG » (V3.32) portait le même identifiant que la zone de dessin (`esy-svg`) : l'éditeur dessinait dans le bouton et la zone restait à la taille par défaut (grille tronquée, symbole invisible). Identifiant du bouton renommé (`esy-exsvg`) ; la zone de dessin suit désormais sa taille réelle (ResizeObserver, remesure après la mise en page) et se recadre au premier affichage.

## V3.34 — Fiche de protection depuis le schéma unifilaire
- Clic sur un appareil de protection du schéma (départ ou protection de tête d'un tableau) : fenêtre de paramétrage (constructeur, catégorie : disjoncteur / sectionneur / interrupteur / interrupteur à fusibles / fusible / différentiel, gamme, calibre, déclencheur, réglages Ir / Im / temporisation avec crans du catalogue).
- Mêmes champs circuit que l'écran Calcul (cohérence des deux vues) ; bouton « Retirer la protection ».
- Protection de tête stockée dans le document du tableau (champs tete*), cliquable via le jeu de barres ; récepteurs sans circuit : disjoncteur repère cliquable.
- Réglages affichés sur le schéma ; textes de tête décalés pour éviter les chevauchements.
- Nouveau fichier : static/js/etude-prot-fiche.js.

## V3.35 — Fenêtre de protection à deux onglets
- Onglet « Protection » : constructeur, catégorie, gamme, calibre / courbe / variante / pouvoir de coupure, Prot CI (départs), caractéristiques de l'appareil.
- Onglet « Déclencheur » (toujours visible ; « Fusible » pour un fusible) : choix du déclencheur compatible, caractéristiques, réglages groupés par fonction (L, S, I, G…) : courant et temps selon le type (TM, MA, Micrologic, STR, GV…), saisie parmi les crans du catalogue ou libre, valeur en ampères (× In, × Ir), alerte « hors plage du catalogue » (compteur ⚠ sur l'onglet) et « valeur intermédiaire ». Boutons « Valeurs usuelles » (point de départ à ajuster) et « Effacer les réglages ». Déclencheur intégré sans association : affiché en lecture seule.
- Même stockage que V3.34 ; aucune migration.

## V3.36 — Fiches techniques et courbes de déclenchement
- Onglet « Déclencheur » de la fenêtre de protection : bloc « Fiches techniques » (PDF, PNG, JPG, SVG, WebP ou lien web ; aperçu intégré, téléchargement, suppression en deux clics) et bloc « Courbes de déclenchement » (points « courant ; temps », plusieurs séries min / max, tracé log-log).
- Portée d'une fiche : ce déclencheur ou toute sa famille (colonne « série » du catalogue).
- Catalogue des protections : bouton « Fiches techniques » (toutes les fiches d'un constructeur, par déclencheur).
- Schéma unifilaire : case « Repère fiches » (désactivée par défaut) : ajoute « (fiche technique ×n) » sous les protections dont le déclencheur a une fiche.
- Stockage : tables etude_mat_docs et etude_mat_courbes (étape etudeMatDocsV336) ; fichiers dans data/etude_materiel_docs/ (à inclure dans les sauvegardes du dossier data). Routes : /api/etude-elec/docs/ (droit etude_elec).

## V3.37 — Import en masse des fiches techniques
- Catalogue des protections > « Fiches techniques » > « Importer en masse… » : glisser-déposer de plusieurs fichiers, choix d'un dossier entier, ou d'un ZIP (extraction côté serveur, POST /api/etude-elec/docs/unzip).
- Rattachement automatique d'après le nom du fichier : code de déclencheur reconnu en priorité (« TM160D fiche.pdf », « Micrologic_5.0_A_courbes.pdf »), sinon famille ; type deviné (courbe / notice / fiche) ; titre tiré du nom.
- Tableau de contrôle : cocher / décocher, corriger type, titre et cible ligne par ligne, ou « Appliquer aux cochés » / « Type pour tous ». Fichiers déjà importés (même nom et même taille) décochés par défaut.
- Import séquentiel avec compteur ; un échec n'arrête pas les autres.

## V3.38 — Téléchargement des fiches à partir d'un lien
- Fiche unique : case « Télécharger et stocker le fichier » sous le champ lien (cochée par défaut) ; en masse : « Télécharger à partir de liens » dans l'import en masse (une ligne « lien ; titre ; cible »), bouton « Remplir avec la liste fournie » (Schneider, Siemens).
- Le serveur récupère le fichier (POST /api/etude-elec/docs/fetch) : http / https, domaines autorisés uniquement (Schneider : se.com, schneider-electric.com / .fr ; Siemens : siemens.com, siemens-info.com ; autres : un domaine par ligne dans data/etude_docs_domaines.txt), adresses internes refusées à chaque redirection, 60 Mo et 60 s maximum, contenu vérifié (PDF ou image réels). Une page web (conditions, connexion) est refusée avec un message clair.
- Constructeur « Siemens » proposé dans la bibliothèque même sans catalogue Siemens importé.
- Le serveur doit avoir un accès internet sortant.

## V3.39 — Correctifs du téléchargement par lien
- Les lignes vides et les lignes commençant par # sont ignorées dans la zone « Télécharger à partir de liens » (on peut coller tout le fichier de liens).
- Repli automatique d'hôte : un lien productinfo.schneider-electric.com qui renvoie 404 est réessayé sur productinfo.se.com.
- La liste fournie ne contient plus que des liens directs vers un PDF ; les pages se.com/download/document/… (page web, pas de PDF) sont à télécharger à la main puis à déposer dans l'import en masse.

## V3.40 — Téléchargement par lien : variantes d'adresse et en-têtes de navigateur
- Sur une erreur 404, l'application essaie les variantes du même lien (avec / sans « www. », ancien hôte productinfo.schneider-electric.com -> productinfo.se.com) et affiche la liste des adresses essayées.
- Requête avec en-têtes de navigateur (User-Agent, Accept-Language, Referer).
- Si un document reste introuvable, le télécharger à la main dans le navigateur puis le déposer dans « Importer en masse ».

## V3.41 — Modifier une fiche technique ; plusieurs cibles
- Bouton « Modifier » sur chaque fiche (bibliothèque et onglet Déclencheur) : titre, type, date, remarque et cibles.
- Une fiche peut viser plusieurs déclencheurs et familles à la fois (liste à cocher avec filtre, « Cocher les affichés » / « Décocher les affichés »). Stockage : champ cibles (« d:code » / « f:famille »). Aucune case cochée = fiche du constructeur en général (visible dans la bibliothèque, pas dans la fenêtre d'une protection).
- Exemple : le document Acti9 « Tripping curves » (CA908024E) se rattache en une fois à « Intégré B/C/D », « Intégré B/C/D/K/Z », « Intégré C ».

## V3.42 — Rattachement des fiches par gamme, en une fois pour tout un lot
- Une fiche peut viser une gamme (cible « g:… »), en plus des familles et des déclencheurs : elle apparaît dans la fenêtre de toutes les protections de cette gamme, quel que soit le déclencheur ; l'onglet Déclencheur fonctionne dès qu'une gamme est choisie (déclencheur facultatif) ; le repère « fiche technique » du schéma en tient compte.
- Import en masse : chaque ligne a un bouton « Cibles… » (liste à cocher filtrable) et « Rattacher les cochés… » applique une même liste à tous les fichiers cochés. Boutons prédéfinis : « Acti9 — disjoncteurs modulaires » (iC60, iC40, iK60, iDPN, iC120 / C120, NG125, iDT40, iDD40, iID), « ComPacT NSX », « MasterPact / ComPacT NS », « TeSys (GV2, GV3, GV4) ».
- Reconnaissance automatique dans le nom du fichier : déclencheur, sinon famille, sinon gamme (ex. « iC60 courbes.pdf ») ; le numéro de tri en début de nom (« 01_ ») est retiré du titre.
- « Modifier » une fiche utilise la même liste (gammes, familles, déclencheurs).

## V3.43 — Fiches techniques page par page, répertoire dédié, nomenclature
- Nouveau réglage **Paramètres > Répertoire des fiches techniques (Étude électrique)** (par défaut `data/etude_materiel_docs/`) ; le changer déplace / fusionne les fiches déjà enregistrées (POST /api/etude-elec/docs/dir).
- **Nomenclature** : `CONSTRUCTEUR_Categorie_Gamme_Données.pdf`, sans espace ni accent — ex. `SCHNEIDER_Disjonct-B-C-D_iC60_Alternatif-60898-1-6a63A.pdf` (catégorie = catégories du catalogue réunies ; données = type de courant, norme, plage de calibres, « Magnetique » le cas échéant).
- **Découper un PDF par pages** (Base matériel > Protections, ou Fiches techniques > « Découper un PDF par pages… ») : le serveur (pypdf) lit le titre de chaque page (type alternatif / continu / moteur, gamme, courbes, calibres, norme), un tableau de contrôle s'affiche avant tout enregistrement.
  - Gamme ou courbe **absente du catalogue** (Reflex, C60H-DC, iC60L-MA, NG125L-MA, et les anciennes gammes C60 / DPN, qui ne figurent pas telles quelles au catalogue) : page **non importée**.
  - Nom déjà présent dans le répertoire : choix **Remplacer / Ignorer** par ligne ; le nom reste modifiable avant enregistrement. Le PDF d'origine peut être conservé (case à cocher).
- Chaque page est une fiche rattachée à sa gamme avec ses courbes, sa plage de calibres, sa norme et son type de courant. Dans l'onglet « Déclencheur » d'une protection, la page qui correspond au calibre / à la courbe choisis vient en premier (✔), les autres sont marquées ≠.
- **Base matériel** : colonne « Fiche » devant chaque référence (disjoncteurs et déclencheurs) avec le nombre de fiches ; un clic ouvre l'aperçu / le téléchargement.
- **Nomenclature…** (bibliothèque) : renomme les fiches déjà importées selon la nouvelle méthode (tableau de contrôle, doublons : remplacer / ignorer) ; un PDF de plusieurs pages peut être découpé depuis cette liste (« Découper… »).
- Nouvelles routes : /dir, /pages/analyse, /pages/enregistrer, /existe, /renommer ; nouveau fichier `static/js/etude-mat-fiches.js`.

## V3.44 — Fiches : seulement pour les déclencheurs montés séparément (ou intégrés, par courbe et calibre)
- Protection à **déclencheur monté séparément** (ComPacT NSX : TM-D, TM-G, MA, MicroLogic ; GV ; MasterPact…) : **aucune fiche n'est liée à la protection ni à la gamme**. Dans la fenêtre de protection, onglet Déclencheur, rien ne s'affiche tant qu'aucun déclencheur n'est choisi ; ensuite seules les fiches de ce déclencheur apparaissent.
- Les fiches rattachées à la gamme sont retenues pour un déclencheur d'après son nom dans le titre / le nom de fichier : TM80D dans « TM80D-a-TM250D », MA50 dans « Moteurs-MA », « Micrologic 2.2 » dans « MicroLogic-2.2-4.2 » (fiches déjà importées : rien à refaire).
- Protection à **déclencheur intégré** (association « Intégré … » : iC60, iK60, NG125, C120…) : inchangé, fiches par gamme + courbe + calibre.
- Base matériel : colonne « Fiche » vide pour les disjoncteurs à déclencheur monté séparément ; elle reste renseignée pour chaque déclencheur (TM50D…) et pour les disjoncteurs à déclencheur intégré.

## V3.45 — Courbes de déclenchement : calcul à partir des réglages + numérisation des fiches
- **Courbe calculée** d'un déclencheur à partir de ses réglages du catalogue (bande « plus rapide / plus lente », log-log, en ampères) :
  - électronique (MicroLogic) : long retard I²t (Ir, tr à 6 Ir) ou classe moteur (2.2 M…), court retard (Isd, tsd, I²t on/off), instantané (Ii) ;
  - thermique-magnétique (TM-D, TM-G) : thermique CEI 60947-2 (1,05 / 1,30 Ir) + magnétique ±20 % ; magnétique seul (MA) ;
  - disjoncteur à déclencheur intégré (iC60, iK60, NG125…) : thermique CEI 60898-1 (1,13 / 1,45 In) + seuils magnétiques Im min / max du catalogue.
  Un réglage non choisi prend sa valeur usuelle (indiquée sous le graphique). **Modèle générique et indicatif** : à confirmer avec la fiche constructeur.
- **Où la voir** : Base matériel > Protections, colonne « Courbe » (déclencheurs et disjoncteurs à déclencheur intégré) : fenêtre avec calibre et réglages modifiables, tracé en direct ; fenêtre de protection du schéma unifilaire (onglet Déclencheur) : courbe avec les réglages en cours, mise à jour à chaque modification. Sans déclencheur choisi sur un appareil à déclencheur séparé : aucune courbe.
- **Courbes numérisées** (collection etudeMatCourbes) tracées en pointillés par-dessus la bande calculée (conversion × Ir / × In / A en ampères).
- **Numériser une courbe sur une fiche PDF** : dans « Courbes de déclenchement » d'un déclencheur > Nouvelle courbe > « Numériser depuis une fiche… » : la page de la fiche s'affiche, on cale les axes log-log (2 valeurs de repère par axe, 4 clics), puis on clique sur une courbe (suivi automatique du trait, tolérance de couleur réglable) ou on pointe les points un à un ; les points sont repris dans le formulaire de la courbe (courant, temps).
- Nouvelle route GET /api/etude-elec/docs/page-image/<fichier>?page=&scale= (image PNG d'une page). **Nouvelle dépendance : pypdfium2** (voir requirements.txt ; `pip install -r requirements.txt` après la mise à jour). Sans elle, le calcul des courbes fonctionne mais pas l'affichage de la page à numériser (pdftoppm est utilisé s'il est installé).
- Nouveau fichier static/js/etude-courbes.js.

## V3.46 — Courbe de la protection amont superposée (schéma unifilaire)
- Dans la fenêtre d'une protection du schéma (onglet Déclencheur), la courbe de la protection elle-même (bleu) est accompagnée de celle de la **protection en amont** (rouge), avec une case **« Superposer la courbe de la protection en amont »** à décocher (choix mémorisé tant que la page reste ouverte).
- Protection amont = la plus proche vers la source dont la protection est saisie : pour un départ, la protection de tête du tableau, sinon le départ qui alimente ce tableau, et ainsi de suite ; pour une tête de tableau, le départ qui l'alimente, puis la tête du tableau parent… Aucune case si aucune protection amont n'est saisie.
- La légende des courbes est maintenant en bas à gauche du graphique ; les repères Ir / Isd / Ii / Im de la protection amont sont suffixés « amont ».
- Un appareil à déclencheur séparé sans déclencheur choisi n'a pas de courbe (ni en propre, ni comme protection amont).

## V3.47 — Livrables techniques : un seul code, selon la codification du projet
- Correctif : pour un livrable rattaché à un **devis**, la liste, la recherche, le tri et l'historique ne retrouvaient pas la configuration de codification (recherche limitée aux contrats) → code par défaut `DEV-…-----…-RevA`. Ils utilisent maintenant `projetParId(projetIdDe(l))`.
- Un livrable sans valeur propre de discipline/zone/niveau retombe désormais sur la découpe de la « Référence / code client » (case de récupération automatique) au lieu d'afficher « — ».
- La référence client n'est plus affichée en 2e ligne : un seul code par livrable, celui de la codification du contrat/devis.
- Si la codification du projet ne peut pas être complétée (segments sans valeur) et que le livrable a une référence client importée, celle-ci est affichée comme code unique (plus de code à trous « —-ATO-… »). Pour que le code suive la codification du contrat, cocher « Récupérer automatiquement les valeurs des segments depuis la Référence / code client » dans Codification des livrables.

## V3.48 — Plan de charge / Timesheet : filtres = valeurs par défaut
« Ajouter une ligne » ne redemande plus le contrat/devis ni la personne dès qu'ils sont choisis dans les filtres de l'écran, chacun indépendamment (avant : seulement si les deux l'étaient). Seuls les champs restés sur « Tous » sont demandés, puis le livrable.

## V3.49 — Bases de données détectées : tri décroissant
La liste « Base(s) de données détectée(s) dans ce répertoire » (Paramètres et assistant initial) est triée par version décroissante, la plus récente en premier.

## V3.50 — Import des livrables : une seule fois, comparaison avant mise à jour, code unique
- L'écran final de l'import affiche, pour le contrat/devis choisi, une comparaison avec l'existant : nouveaux, modifiés (champ : ancien → nouveau), inchangés, absents du fichier, doublons du fichier (ignorés) et doublons déjà en base.
- Dès que des livrables existent déjà, l'import exige la case « J'ai vérifié les changements et je confirme ». Options : supprimer les doublons en base (coché, on garde la fiche la plus ancienne) et supprimer les livrables absents du fichier (décoché).
- Comparaison des codes insensible à la casse, aux espaces et aux variantes d'apostrophe (SP1' / SP1’ / SP1′) : un même code n'est plus créé deux fois.
- Création/modification manuelle d'un livrable : refusée si le code existe déjà dans le contrat/devis.

## V3.51 — Plan de charge / Timesheet
- La colonne « Total » est à gauche, juste avant le premier jour du mois (lignes et ligne Total).
- Bouton « Modifier » (crayon) à côté de « Supprimer » : change contrat/devis, personne ou livrable d'une ligne sans toucher aux heures saisies.
- Dans le choix du livrable, le code complet précède la désignation (« CODE — Désignation »).

## V3.52 — Import des livrables : décompte avant d'importer
Dès que le contrat/devis et les colonnes désignation, code et indice sont choisis, l'écran de correspondance affiche : nombre de lignes qui seront importées sur le total du fichier, ajoutées / modifiées / inchangées, lignes ignorées, doublons, et livrables existants absents du fichier (à supprimer ?). Le même résumé est rappelé en tête de l'écran final, avant la confirmation.

## V3.53 — Import des livrables : cases de confirmation alignées (largeur automatique) à gauche de leur libellé.

## V3.54 — Droits d'accès : profils et matrice modifiables
- **Administration > Droits d'accès** : matrice profils × menus/données avec trois niveaux — Aucun (menu invisible, accès serveur refusé), Lecture (boutons de modification masqués, écriture refusée par le serveur), Écriture. Profils d'origine (Commercial, Conducteur de travaux, Comptable, RH) + nouveaux profils proposés (Ingénieur / BET, Chef de projet, Direction en lecture seule), renommables ; création de profils personnalisés (avec copie des droits d'un profil existant), suppression d'un profil non utilisé, « Valeurs par défaut ».
- Le profil Administrateur est fixe (tous les droits, impossible de se verrouiller). Un profil encore attribué à un utilisateur ne peut pas être supprimé.
- Stockage : `settings/company.accessProfiles`. Application côté serveur à chaque requête (`backend/access.py`, `get_profils()` / `access_level()`), cache de 3 s invalidé à l'enregistrement. L'ancienne matrice `ACCESS` ne sert plus que de valeurs de départ.
- Écran Utilisateurs : la colonne « Rôle » devient « Profil » (liste issue des profils configurés).
- **Mise en production — connexion obligatoire** : en usage mono-poste local, l'application ouvre toujours une session administrateur (aucun droit appliqué). Pour appliquer les droits : variable d'environnement `ERP_AUTH=1`, ou `"authRequired": true` dans `db_location.json` (ou PostgreSQL via `DATABASE_URL`). Derrière HTTPS, ajouter `ERP_COOKIE_SECURE=1`. Créer d'abord les comptes (email + mot de passe ≥ 8 caractères) pour chaque utilisateur.
- À venir (V3.55) : périmètre par projet affecté et masquage des montants par profil ; (V3.56) journal des modifications et droits d'action.

## V4.1 — Renommage de la V3.54 + filtre des anciennes bases par version
- La V3.54 (droits d'accès par profil) est renommée **V4.1** ; contenu inchangé. La V3.55 (périmètre par projet, masquage des montants) est reportée.
- Récupération d'une ancienne base (assistant de premier démarrage) : boutons de filtre **V2 / V3 / V4** (avec le nombre de bases) au-dessus de la liste ; le clic affiche toutes les bases de cette version majeure, la plus récente d'abord ; la plus haute version présente est sélectionnée par défaut.
- Reprise automatique au premier lancement : la base précédente la plus récente parmi les versions V3 à V9 est copiée sous le nom de la nouvelle version (avant : V3 uniquement).

## V4.2 — Fin du polling : le serveur ne sollicite le navigateur que lorsqu'une donnée change

**Avant :** chaque collection (environ 39) était relue toutes les 2 secondes, en permanence, même sans action de l'utilisateur.

**Maintenant :**
- `backend/changes.py` : chaque connexion à la base détecte les tables réellement modifiées et, au commit, publie les collections concernées (toutes les écritures sont détectées : routes génériques, imports, étude électrique, factures…). Une table inconnue déclenche par sécurité un rechargement complet.
- `GET /api/events` (Server-Sent Events) : le navigateur y reste abonné ; le serveur n'envoie un message que lorsqu'il y a une modification, filtré selon les droits du profil.
- `static/js/local-db.js` : à la réception, seules les collections citées sont relues (une seule requête, regroupée si plusieurs messages arrivent d'affilée).
- Reconnexion automatique avec rattrapage ; repli sur un rafraîchissement toutes les 5 s uniquement pendant une coupure du flux (proxy, navigateur ancien).
- Restauration / changement de base (`/api/db/*`) : tous les navigateurs sont prévenus.

Mesures (base de 1 107 disjoncteurs) : 0 requête en 12 s d'inactivité ; une modification externe apparaît en ~150 ms avec 1 seule requête.

Limite : l'état des notifications est en mémoire du processus serveur (un processus, plusieurs threads : lancement standard). Un déploiement multi-processus (gunicorn -w N) nécessiterait un relais commun (Redis ou table de versions).
