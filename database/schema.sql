-- =====================================================================
-- Chantier ERP — schéma relationnel PROPOSÉ (V3.00)  — À VALIDER
-- Remplace la table unique « documents » (JSON) par de vraies tables.
-- Compatible SQLite et PostgreSQL (types TEXT / INTEGER / NUMERIC).
--
-- Conventions
--  * id TEXT : les identifiants actuels sont conservés tels quels.
--  * Dates et heures : TEXT au format ISO 8601 (comme aujourd'hui).
--  * Booléens : INTEGER 0/1.
--  * Montants et quantités : NUMERIC.
--  * extra TEXT (JSON) : champs inconnus ou hérités, jamais perdus (présent dans toutes les tables sauf 3 tables clé/valeur).
--  * Listes d'objets (lignes…) : tables filles, ordre conservé par « rang ».
--  * Noms dénormalisés (client_nom, ctr_numero…) conservés en phase 1 pour
--    que l'application reste identique ; suppression possible en phase 2.
-- =====================================================================

-- ---------- Administration ----------
CREATE TABLE utilisateurs (
  id TEXT PRIMARY KEY, nom TEXT NOT NULL, role TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0,1)),
  email TEXT, mot_de_passe_hash TEXT, pin_herite TEXT,
  created_at TEXT, extra TEXT
);
CREATE TABLE parametres_societe (            -- ancien settings/company (1 seule ligne)
  id TEXT PRIMARY KEY CHECK (id = 'company'),
  nom TEXT, logo TEXT, ice TEXT, identifiant_fiscal TEXT, rc TEXT, cnss TEXT, patente TEXT,
  adresse TEXT, ville TEXT, telephone TEXT, email TEXT, rib TEXT, banque TEXT,
  devise TEXT, taux_tva NUMERIC, taux_rg NUMERIC,
  dossier_factures_fournisseurs TEXT, dossier_source_factures_fournisseurs TEXT,
  dossier_factures_clients TEXT, dossier_pieces_commandes TEXT, dossier_devis_importes TEXT,
  extra TEXT
);
CREATE TABLE numerotation_parametres (       -- ancien company.seqPrefixes / seqWidths
  type TEXT PRIMARY KEY,                     -- devis, ctr, pfa, fac, avo, enc
  prefixe TEXT NOT NULL, largeur INTEGER NOT NULL CHECK (largeur BETWEEN 1 AND 8)
);
CREATE TABLE compteurs (                     -- ancien meta/counters : « fac_2026 » → (fac, 2026)
  type TEXT NOT NULL, annee INTEGER NOT NULL, valeur INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (type, annee)
);
CREATE TABLE migrations_faites (nom TEXT PRIMARY KEY, fait INTEGER NOT NULL DEFAULT 1);
CREATE TABLE backlog (
  id TEXT PRIMARY KEY, priorite TEXT, titre TEXT NOT NULL, source TEXT, description TEXT,
  statut_implementation TEXT, statut_test TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, extra TEXT
);

-- ---------- Tiers, clients, personnel ----------
CREATE TABLE tiers (                         -- ancien tiersBancaires (fournisseurs, banques…)
  id TEXT PRIMARY KEY, mot_cle TEXT, nom TEXT NOT NULL, type TEXT, tva NUMERIC,
  ice TEXT, identifiant_fiscal TEXT, rc TEXT, patente TEXT, adresse TEXT, ville TEXT,
  telephone TEXT, email TEXT, contact TEXT, notes TEXT, created_at TEXT, extra TEXT
);
CREATE TABLE tiers_zones (                   -- modeleZones.zones[] : zones de lecture PDF
  tiers_id TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  champ TEXT, x0 NUMERIC, y0 NUMERIC, x1 NUMERIC, y1 NUMERIC,
  extra TEXT, PRIMARY KEY (tiers_id, rang));
CREATE TABLE clients (
  id TEXT PRIMARY KEY, nom TEXT NOT NULL, ice TEXT, identifiant_fiscal TEXT, rc TEXT, patente TEXT,
  adresse TEXT, ville TEXT, telephone TEXT, email TEXT, contact TEXT, notes TEXT,
  tiers_id TEXT REFERENCES tiers(id) ON DELETE SET NULL, tiers_auto INTEGER,
  created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE statuts_personnel (id TEXT PRIMARY KEY, nom TEXT NOT NULL, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE personnel (
  id TEXT PRIMARY KEY, nom TEXT NOT NULL, fonction TEXT, cin TEXT,
  actif INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0,1)),
  statut_id TEXT REFERENCES statuts_personnel(id) ON DELETE SET NULL,
  telephone TEXT, email TEXT, adresse TEXT, date_embauche TEXT, type_contrat TEXT,
  salaire NUMERIC,                           -- donnée sensible (accès restreint)
  notes TEXT, tiers_id TEXT REFERENCES tiers(id) ON DELETE SET NULL, tiers_auto INTEGER,
  created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE categories_competence (id TEXT PRIMARY KEY, nom TEXT NOT NULL, predefinie INTEGER, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE competences (id TEXT PRIMARY KEY, nom TEXT NOT NULL,
  categorie_id TEXT REFERENCES categories_competence(id) ON DELETE SET NULL, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE personnel_competences (         -- niveau actuel d'une personne sur une compétence
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  competence_id TEXT NOT NULL REFERENCES competences(id) ON DELETE CASCADE,
  niveau INTEGER, extra TEXT, rang INTEGER, PRIMARY KEY (personnel_id, competence_id));
CREATE TABLE personnel_competences_historique (
  personnel_id TEXT NOT NULL, competence_id TEXT NOT NULL, rang INTEGER NOT NULL,
  niveau INTEGER, date TEXT, par TEXT, extra TEXT, PRIMARY KEY (personnel_id, competence_id, rang),
  FOREIGN KEY (personnel_id, competence_id) REFERENCES personnel_competences ON DELETE CASCADE);
CREATE TABLE niveaux_attendus (              -- niveau cible par statut x compétence
  statut_id TEXT NOT NULL REFERENCES statuts_personnel(id) ON DELETE CASCADE,
  competence_id TEXT NOT NULL REFERENCES competences(id) ON DELETE CASCADE,
  niveau INTEGER, extra TEXT, rang INTEGER, PRIMARY KEY (statut_id, competence_id));
CREATE TABLE niveaux_attendus_historique (
  statut_id TEXT NOT NULL, competence_id TEXT NOT NULL, rang INTEGER NOT NULL,
  niveau INTEGER, date TEXT, par TEXT, extra TEXT, PRIMARY KEY (statut_id, competence_id, rang),
  FOREIGN KEY (statut_id, competence_id) REFERENCES niveaux_attendus ON DELETE CASCADE);
CREATE TABLE formations (
  id TEXT PRIMARY KEY, intitule TEXT NOT NULL, organisme TEXT, statut TEXT,
  date_debut TEXT, date_fin TEXT, cout NUMERIC, date_expiration TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE formation_personnes (
  formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  extra TEXT, rang INTEGER, PRIMARY KEY (formation_id, personnel_id));
CREATE TABLE formation_competences (
  formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  competence_id TEXT NOT NULL REFERENCES competences(id) ON DELETE CASCADE,
  extra TEXT, rang INTEGER, PRIMARY KEY (formation_id, competence_id));

-- ---------- Chaîne commerciale : devis → commande → contrat → avenant/attachement → PFA → facture ----------
CREATE TABLE devis (
  id TEXT PRIMARY KEY, numero TEXT, client_id TEXT NOT NULL REFERENCES clients(id), client_nom TEXT,
  date TEXT, statut TEXT, objet TEXT, reference TEXT, reference_historique TEXT, revision TEXT, validite_jours INTEGER,
  remise NUMERIC, net NUMERIC, taux_tva NUMERIC, version_seq INTEGER, av_seq INTEGER, att_seq INTEGER,
  liv_seq INTEGER, bordereau_seq INTEGER, segments_auto_depuis_reference_client INTEGER,  -- V3.02 : livrables liés à un devis (la configuration de codification du devis est dans extra)
  file_rel_path TEXT, file_name TEXT, ocr_utilise INTEGER, notes TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
-- Un même numéro de devis existe en plusieurs révisions (ex. DEV-2025-008 : 00, 02, 03, 04) : unicité sur (numéro, révision) (décision utilisateur).
CREATE UNIQUE INDEX ux_devis_numero_revision ON devis(numero, revision);
CREATE TABLE devis_lignes (
  devis_id TEXT NOT NULL REFERENCES devis(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte NUMERIC, pu NUMERIC, extra TEXT, PRIMARY KEY (devis_id, rang));
CREATE TABLE contrats (
  id TEXT PRIMARY KEY, numero TEXT NOT NULL, client_id TEXT NOT NULL REFERENCES clients(id), client_nom TEXT,
  devis_id TEXT REFERENCES devis(id) ON DELETE SET NULL, devis_numero TEXT,
  reference_contrat TEXT, origine_engagement TEXT, precisions TEXT, objet TEXT, revision TEXT,
  date TEXT, statut TEXT, net NUMERIC, taux_tva NUMERIC, notes TEXT,
  av_seq INTEGER, att_seq INTEGER, liv_seq INTEGER,
  bordereau_seq INTEGER, version_seq INTEGER,
  segments_auto_depuis_reference_client INTEGER,
  piece_jointe_nom TEXT, piece_jointe_rel_path TEXT, piece_jointe_data TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE UNIQUE INDEX ux_contrats_numero ON contrats(numero);
CREATE TABLE contrats_lignes (
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte NUMERIC, pu NUMERIC, extra TEXT, PRIMARY KEY (contrat_id, rang));
CREATE TABLE contrat_codes_retour (          -- codesRetourClient {statut: code client}
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  statut_retour TEXT NOT NULL, code_client TEXT, extra TEXT, PRIMARY KEY (contrat_id, statut_retour));
CREATE TABLE contrat_destinataires (
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE, id TEXT NOT NULL,
  rang INTEGER NOT NULL, nom TEXT NOT NULL, categorie TEXT, extra TEXT,
  PRIMARY KEY (contrat_id, id)
);
-- Codification des livrables, propre à chaque contrat
-- (les identifiants de segment comme « zone », « niveau » se répètent d'un contrat à l'autre : clé = contrat + id)
CREATE TABLE contrat_segments (              -- segmentsPersonnalises[]
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE, id TEXT NOT NULL,
  rang INTEGER NOT NULL, nom TEXT NOT NULL, extra TEXT,
  PRIMARY KEY (contrat_id, id)
);
CREATE TABLE contrat_segment_valeurs (
  contrat_id TEXT NOT NULL, segment_id TEXT NOT NULL,
  rang INTEGER NOT NULL, valeur TEXT NOT NULL, PRIMARY KEY (contrat_id, segment_id, rang),
  FOREIGN KEY (contrat_id, segment_id) REFERENCES contrat_segments(contrat_id, id) ON DELETE CASCADE
);
CREATE TABLE contrat_composition_code (      -- codificationSegments[] : ordre du code
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  segment_ref TEXT NOT NULL,                 -- id d'un segment du contrat OU ctr / type / seq / indice
  PRIMARY KEY (contrat_id, rang)
);
CREATE TABLE contrat_segments_fixes_retires (
  contrat_id TEXT NOT NULL REFERENCES contrats(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  segment_fixe TEXT NOT NULL CHECK (segment_fixe IN ('ctr','type','seq','indice')),
  PRIMARY KEY (contrat_id, segment_fixe)
);
CREATE TABLE avenants (
  id TEXT PRIMARY KEY, numero TEXT NOT NULL, contrat_id TEXT NOT NULL REFERENCES contrats(id),
  ctr_numero TEXT, client_id TEXT REFERENCES clients(id), client_nom TEXT,
  date TEXT, objet TEXT, montant_impact NUMERIC, delai_impact_jours INTEGER,
  statut TEXT, notes TEXT, created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE attachements (
  id TEXT PRIMARY KEY, numero TEXT NOT NULL, contrat_id TEXT NOT NULL REFERENCES contrats(id),
  ctr_numero TEXT, client_id TEXT REFERENCES clients(id), client_nom TEXT,
  date TEXT, periode_label TEXT, revision TEXT, taux_tva NUMERIC, statut TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE attachements_lignes (
  attachement_id TEXT NOT NULL REFERENCES attachements(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte_marche NUMERIC, pu NUMERIC, qte_anterieure NUMERIC, qte_periode NUMERIC,
  extra TEXT, PRIMARY KEY (attachement_id, rang));
CREATE TABLE propositions_facturation (
  id TEXT PRIMARY KEY, numero TEXT, client_id TEXT NOT NULL REFERENCES clients(id), client_nom TEXT,
  contrat_id TEXT REFERENCES contrats(id) ON DELETE SET NULL, ctr_numero TEXT,
  attachement_id TEXT REFERENCES attachements(id) ON DELETE SET NULL, attachement_numero TEXT,
  date TEXT, taux_tva NUMERIC, statut TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE propositions_facturation_lignes (
  pfa_id TEXT NOT NULL REFERENCES propositions_facturation(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte NUMERIC, pu NUMERIC, extra TEXT, PRIMARY KEY (pfa_id, rang));
CREATE TABLE factures (
  id TEXT PRIMARY KEY, numero TEXT, client_id TEXT NOT NULL REFERENCES clients(id), client_nom TEXT,
  contrat_id TEXT REFERENCES contrats(id) ON DELETE SET NULL,   -- facultatif, vide pour toutes les factures actuelles (réservé à une évolution future)
  attachement_id TEXT REFERENCES attachements(id) ON DELETE SET NULL, attachement_numero TEXT,
  pfa_id TEXT REFERENCES propositions_facturation(id) ON DELETE SET NULL, pfa_numero TEXT,
  date TEXT, echeance TEXT, reference TEXT, revision TEXT, reference_historique TEXT, statut TEXT,
  net NUMERIC, ht NUMERIC, taux_tva NUMERIC, montant_tva NUMERIC, taux_rg NUMERIC, montant_rg NUMERIC, ttc NUMERIC,
  verrouillee INTEGER, validee_par TEXT, validee_at TEXT, annule_par TEXT, annule_at TEXT,
  av_seq INTEGER, att_seq INTEGER, file_rel_path TEXT, file_name TEXT, ocr_utilise INTEGER, notes TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
-- Numéro unique pour toutes les factures (décision utilisateur) ; les brouillons sans numéro sont exclus.
-- Les 25 numéros historiques en double (« 2023 » ×23, « 2025_03-04 » ×2) doivent être corrigés avant la migration.
CREATE UNIQUE INDEX ux_factures_numero ON factures(numero) WHERE numero IS NOT NULL AND numero <> '';
CREATE TABLE factures_lignes (
  facture_id TEXT NOT NULL REFERENCES factures(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte NUMERIC, pu NUMERIC, extra TEXT, PRIMARY KEY (facture_id, rang));
CREATE TABLE avoirs (
  id TEXT PRIMARY KEY, numero TEXT, client_id TEXT NOT NULL REFERENCES clients(id), client_nom TEXT,
  facture_id TEXT REFERENCES factures(id) ON DELETE SET NULL, facture_numero TEXT,
  date TEXT, motif TEXT, taux_tva NUMERIC, statut TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE avoirs_lignes (
  avoir_id TEXT NOT NULL REFERENCES avoirs(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  designation TEXT, unite TEXT, qte NUMERIC, pu NUMERIC, extra TEXT, PRIMARY KEY (avoir_id, rang));
CREATE TABLE reglements (                    -- encaissements clients
  id TEXT PRIMARY KEY, numero TEXT, facture_id TEXT REFERENCES factures(id), facture_numero TEXT,
  client_id TEXT REFERENCES clients(id), client_nom TEXT,
  date TEXT, montant NUMERIC, mode TEXT, reference TEXT, banque TEXT, statut TEXT, notes TEXT,
  created_at TEXT, cree_par TEXT, extra TEXT
);

-- ---------- Livrables techniques ----------
CREATE TABLE livrables (
  id TEXT PRIMARY KEY, contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,   -- V3.02 : un livrable est lié à un contrat OU (marché pas encore gagné) à un devis
  client_id TEXT REFERENCES clients(id), client_nom TEXT,
  designation TEXT NOT NULL, type_document TEXT, categorie TEXT, indice_revision TEXT, statut TEXT,
  date_emission TEXT, destinataire TEXT, notes TEXT,
  numero_seq INTEGER, numero_seq_texte TEXT, code_complet TEXT, reference_client TEXT,
  date_planifiee_debut TEXT, date_planifiee_fin TEXT,
  zone TEXT, niveau TEXT, discipline TEXT,  -- anciens champs, lus en repli
  annule_par TEXT, annule_at TEXT, created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE INDEX ix_livrables_contrat ON livrables(contrat_id);
CREATE INDEX ix_livrables_devis ON livrables(devis_id);
CREATE TABLE livrable_segment_valeurs (      -- segmentsValeurs {idSegment: valeur}
  livrable_id TEXT NOT NULL REFERENCES livrables(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,                  -- pas de clé étrangère : id d'un segment du contrat, qui peut avoir été supprimé (la valeur est gardée en mémoire)
  valeur TEXT, extra TEXT, PRIMARY KEY (livrable_id, segment_id));
CREATE TABLE livrable_historique_indices (
  livrable_id TEXT NOT NULL REFERENCES livrables(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  indice TEXT, date TEXT, par TEXT, budget_heures NUMERIC, extra TEXT, PRIMARY KEY (livrable_id, rang));
CREATE TABLE livrable_affectations (
  livrable_id TEXT NOT NULL REFERENCES livrables(id) ON DELETE CASCADE,
  personnel_id TEXT NOT NULL, nom TEXT, fonction TEXT, extra TEXT, rang INTEGER NOT NULL, PRIMARY KEY (livrable_id, rang));
CREATE TABLE bordereaux (
  id TEXT PRIMARY KEY, numero TEXT NOT NULL, contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,   -- V3.02 : lié à un contrat OU à un devis
  client_id TEXT REFERENCES clients(id), client_nom TEXT,
  destinataire_id TEXT, destinataire_nom TEXT, destinataire_categorie TEXT,
  date TEXT, notes TEXT, created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE TABLE bordereaux_lignes (
  bordereau_id TEXT NOT NULL REFERENCES bordereaux(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  livrable_id TEXT REFERENCES livrables(id) ON DELETE RESTRICT, liv_code TEXT, liv_designation TEXT,
  indice TEXT, etat TEXT, date_retour TEXT, statut_retour TEXT, extra TEXT, PRIMARY KEY (bordereau_id, rang));
CREATE TABLE grille_lignes (                 -- planificationLignes (plan) + timesheetLignes (pointage)
  id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('plan','pointage')),
  contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT, client_nom TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,   -- V3.02 : planning / pointage possibles sur un devis   -- liens contrôlés (6 lignes actuelles à corriger avant migration)
  personnel_id TEXT REFERENCES personnel(id) ON DELETE SET NULL, personne_nom TEXT,
  livrable_id TEXT REFERENCES livrables(id) ON DELETE CASCADE, liv_designation TEXT, liv_code TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE grille_jours (                  -- heures et journée entière, par jour
  ligne_id TEXT NOT NULL REFERENCES grille_lignes(id) ON DELETE CASCADE,
  jour TEXT NOT NULL, heures NUMERIC, jour_plein INTEGER, extra TEXT, PRIMARY KEY (ligne_id, jour));

-- ---------- Comptabilité et banque ----------
CREATE TABLE plan_comptable (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, libelle TEXT, classe INTEGER, sens TEXT,
  actif INTEGER, note TEXT, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE ecritures (
  id TEXT PRIMARY KEY, date TEXT, journal TEXT, piece TEXT, libelle TEXT,
  generee_auto INTEGER, source_type TEXT, source_id TEXT, contre_piece_de TEXT,
  chiffre_affaires_exercice_cloture NUMERIC, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE INDEX ix_ecritures_source ON ecritures(source_type, source_id);
CREATE TABLE ecritures_lignes (
  ecriture_id TEXT NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  compte TEXT NOT NULL, libelle TEXT, debit NUMERIC, credit NUMERIC,
  extra TEXT, PRIMARY KEY (ecriture_id, rang));
CREATE TABLE exercices_archives (
  id TEXT PRIMARY KEY, nom_fichier TEXT, exercice_debut TEXT, exercice_fin TEXT,
  chiffre_affaires NUMERIC, chiffre_affaires_exercice_precedent NUMERIC, created_at TEXT, cree_par TEXT, extra TEXT
);
CREATE TABLE exercices_archives_lignes (
  exercice_id TEXT NOT NULL REFERENCES exercices_archives(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  label TEXT, compte TEXT, cote TEXT, sens TEXT, montant NUMERIC, compte_suggere TEXT, libelle_suggere TEXT,
  extra TEXT, PRIMARY KEY (exercice_id, rang));
CREATE TABLE factures_fournisseurs (
  id TEXT PRIMARY KEY, numero TEXT, fournisseur_id TEXT REFERENCES tiers(id), date TEXT,
  montant_ht NUMERIC, montant_tva NUMERIC, montant_ttc NUMERIC, devise TEXT,
  file_rel_path TEXT, file_name TEXT, ocr_utilise INTEGER, created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE factures_fournisseurs_reglements (
  facture_fournisseur_id TEXT NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
  rang INTEGER NOT NULL, id TEXT, date TEXT, mode TEXT, montant NUMERIC, reference TEXT, created_at TEXT, cree_par TEXT, extra TEXT,
  PRIMARY KEY (facture_fournisseur_id, rang)
);
CREATE TABLE releves (
  id TEXT PRIMARY KEY, nom_fichier TEXT, total_client NUMERIC, total_fournisseur NUMERIC,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE releves_lignes (
  releve_id TEXT NOT NULL REFERENCES releves(id) ON DELETE CASCADE, rang INTEGER NOT NULL,
  date_op TEXT, date_val TEXT, libelle1 TEXT, libelle2 TEXT, debit NUMERIC, credit NUMERIC,
  type TEXT, tiers TEXT, tva NUMERIC, inconnu INTEGER, facture TEXT,
  facture_fournisseur_id TEXT REFERENCES factures_fournisseurs(id) ON DELETE SET NULL,
  facture_client_id TEXT REFERENCES factures(id) ON DELETE SET NULL,
  fournisseur NUMERIC, client NUMERIC, reglement_cree INTEGER, encaissement_cree INTEGER,
  extra TEXT, PRIMARY KEY (releve_id, rang));

-- V3.03 : module « Étude électrique » (base de données des consommateurs) ----------------------------
-- Une ligne = un consommateur, rattaché à un contrat OU à un devis (marché pas encore gagné).
-- Les colonnes « formule » (puissance apparente, courant, puissances actives/réactives, K.Util, K.Simul, foisonnées)
-- sont recalculées à chaque enregistrement ; une valeur imposée à la main est signalée dans extra.forces.
CREATE TABLE etude_consommateurs (
  id TEXT PRIMARY KEY,
  contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,
  client_id TEXT REFERENCES clients(id), client_nom TEXT,
  ordre INTEGER,
  sr TEXT, rev TEXT, switchgear TEXT, system_area TEXT, tag TEXT, nom TEXT,
  puissance_kw REAL, puissance_absorbee REAL, tension REAL, phase_freq TEXT, special_reqts TEXT,
  ws TEXT, ci TEXT, e_ne TEXT, pct_e REAL, remarks TEXT,
  puissance_apparente REAL, puissance_installee REAL, unite TEXT, courant REAL, type_conso TEXT,
  vitesse TEXT, contenu TEXT, nombre REAL, cos_phi REAL, rend REAL,
  p_vfd REAL, cos_phi_vfd REAL, rend_vfd REAL, k_util REAL, k_simul REAL,
  p_active REAL, p_reactive REAL, longueur REAL, mode_pose TEXT,
  p_active_foisonnee REAL, p_reactive_foisonnee REAL,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE INDEX ix_etude_conso_contrat ON etude_consommateurs(contrat_id);
CREATE INDEX ix_etude_conso_devis ON etude_consommateurs(devis_id);
CREATE TABLE etude_listes_valeurs (          -- valeurs des listes déroulantes (tension, phase/fréquence, type...)
  id TEXT PRIMARY KEY, liste TEXT NOT NULL, valeur TEXT NOT NULL, rang INTEGER,
  created_at TEXT, updated_at TEXT, extra TEXT, UNIQUE (liste, valeur)
);

-- V3.04 : document « Liste des consommateurs » (un par contrat OU devis). Les sections et les lignes sont
-- générées depuis la base ; ne sont stockés que l'en-tête (affaire, compte, code document, révision, date)
-- et les saisies propres à la liste (type de câble, commentaire) par consommateur (extra.lignes).
CREATE TABLE etude_liste_documents (
  id TEXT PRIMARY KEY,
  contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,
  client_id TEXT, client_nom TEXT,
  affaire TEXT, compte TEXT, code_doc TEXT, revision TEXT, date_doc TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE INDEX ix_etude_liste_contrat ON etude_liste_documents(contrat_id);
CREATE INDEX ix_etude_liste_devis ON etude_liste_documents(devis_id);

-- V3.05 : bilan de puissance, un enregistrement par tableau (Switchgear / MCC) d'un contrat OU d'un devis.
-- Le bilan est calculé depuis la base ; ne sont stockés que l'en-tête, les K.Foisonnement, la puissance du
-- transformateur et les pertes (liste P/Q dans extra.pertes).
CREATE TABLE etude_bilan_tableaux (
  id TEXT PRIMARY KEY,
  contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,
  client_id TEXT, client_nom TEXT,
  tableau_cle TEXT NOT NULL, tableau TEXT,
  affaire TEXT, compte TEXT, code_doc TEXT, revision TEXT, date_doc TEXT,
  k_fois_normal REAL, k_fois_secours REAL, puissance_transfo REAL,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE INDEX ix_etude_bilan_contrat ON etude_bilan_tableaux(contrat_id);
CREATE INDEX ix_etude_bilan_devis ON etude_bilan_tableaux(devis_id);

-- V3.06 : bases « matériel » de l'étude électrique (réutilisables d'un projet à l'autre, non rattachées à un
-- contrat). Catégorie « transfo » : transformateurs HT/MT. Les colonnes calculées (ONAF, courants, impédances,
-- pertes retenues, court-circuit...) ne sont pas stockées : elles sont recalculées avec les paramètres.
CREATE TABLE etude_mat_transfos (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
  tension_primaire REAL, tension_secondaire REAL, s_onan REAL, onaf TEXT, serie TEXT, uk REAL, i0 REAL,
  pk_constructeur REAL, p0_constructeur REAL, couplage TEXT, statut TEXT, source TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE etude_mat_params (               -- paramètres de calcul (rapport ONAF/ONAN, point d'ancrage des pertes, tolérances...)
  id TEXT PRIMARY KEY, categorie TEXT NOT NULL, code TEXT NOT NULL, libelle TEXT, valeur REAL, unite TEXT,
  source TEXT, rang INTEGER, created_at TEXT, updated_at TEXT, extra TEXT, UNIQUE (categorie, code)
);
CREATE TABLE etude_mat_sources (              -- sources des informations, état de vérification et hypothèses
  id TEXT PRIMARY KEY, categorie TEXT NOT NULL, ref TEXT, document TEXT, elements TEXT, etat TEXT, lien TEXT,
  rang INTEGER, created_at TEXT, updated_at TEXT, extra TEXT
);

-- V3.11 : protections BT (disjoncteurs et déclencheurs) de la base matériel, organisées par constructeur.
-- Alimentées uniquement par import Excel (aucune valeur de départ dans le code). « constructeur » = code de etude_mat_constructeurs.
CREATE TABLE etude_mat_constructeurs (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, nom TEXT, site_web TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE TABLE etude_mat_disjoncteurs (          -- une ligne par gamme, variante (pouvoir de coupure), calibre et courbe
  id TEXT PRIMARY KEY, constructeur TEXT NOT NULL, famille TEXT, categorie TEXT, gamme TEXT NOT NULL, variante TEXT NOT NULL DEFAULT '—',
  calibre TEXT NOT NULL, calibre_a REAL, courbe TEXT NOT NULL DEFAULT '—', normes TEXT,
  icu_ka REAL, icu_origine TEXT, icn_ka REAL, ics_pct REAL, im_min REAL, im_max REAL, statut TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  UNIQUE (constructeur, gamme, variante, calibre, courbe)
);
CREATE INDEX ix_etude_mat_disj_constructeur ON etude_mat_disjoncteurs(constructeur, gamme);
CREATE TABLE etude_mat_declencheurs (
  id TEXT PRIMARY KEY, constructeur TEXT NOT NULL, code TEXT NOT NULL, famille TEXT, type TEXT, protections TEXT, statut TEXT,
  serie TEXT, calibre_a REAL, ir_min_a REAL, ir_max_a REAL, im_min_a REAL, im_max_a REAL,   -- V3.19 : une référence par ligne
  rang INTEGER, created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT, UNIQUE (constructeur, code)
);
CREATE TABLE etude_mat_assoc_decl (            -- déclencheurs pouvant équiper une gamme de disjoncteurs
  id TEXT PRIMARY KEY, constructeur TEXT NOT NULL, gamme TEXT NOT NULL, declencheur TEXT NOT NULL, calibres TEXT,
  calibre_min REAL, calibre_max REAL, note TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT, UNIQUE (constructeur, gamme, declencheur)
);
CREATE TABLE etude_mat_reglages (              -- crans de réglage (courant et temps) par déclencheur et par fonction
  id TEXT PRIMARY KEY, constructeur TEXT NOT NULL, declencheur TEXT NOT NULL, fonction TEXT NOT NULL, parametre TEXT NOT NULL,
  unite TEXT, crans TEXT, nb_crans INTEGER, cran_min TEXT, cran_max TEXT, reglable TEXT, remarque TEXT, statut TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT, UNIQUE (constructeur, declencheur, fonction, parametre)
);

-- V3.13 : catalogue des câbles BT (référentiel importé d'un classeur Excel ; une ligne par câble de chaque famille).
-- Clé d'unicité : id_caneco (la référence fabricant « ref » n'est pas unique dans l'export). Alimenté uniquement par import.
CREATE TABLE etude_bt_cables (
  id TEXT PRIMARY KEY, ref TEXT, id_caneco INTEGER NOT NULL UNIQUE, famille TEXT NOT NULL, section_txt TEXT, section_mm2 REAL,
  section_reduite_mm2 REAL, nb_conducteurs INTEGER, ame TEXT, isolant TEXT, temp_max_c REAL, temp_cc_max_c REAL, arme INTEGER,
  enterrable INTEGER, un_v REAL, un_max_v REAL, diametre_mm REAL, poids_kg_km REAL, pays TEXT, table_sections TEXT, autorise INTEGER,
  k_thermique REAL, r20_mohm_m REAL, r_chaud_mohm_m REAL, x_mohm_m REAL, statut TEXT, rang INTEGER,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
CREATE INDEX ix_etude_bt_cables_famille ON etude_bt_cables(famille);

-- V3.14 : circuits BT (données de saisie du sous-menu « Calcul »). Une ligne par départ (consommateur) d'un contrat / devis :
-- câble choisi dans le catalogue, longueur, protection choisie dans le catalogue (constructeur > catégorie > calibre).
-- conso_id = id du consommateur (etude_consommateurs) ; aucun résultat de calcul n'est stocké ici.
CREATE TABLE etude_bt_circuits (
  id TEXT PRIMARY KEY,
  contrat_id TEXT REFERENCES contrats(id), ctr_numero TEXT,
  devis_id TEXT REFERENCES devis(id), devis_numero TEXT,
  client_id TEXT, client_nom TEXT,
  conso_id TEXT NOT NULL, tag TEXT, tableau_cle TEXT,
  cable_famille TEXT, cable_id_caneco INTEGER, cable_section_txt TEXT, nb_cables INTEGER,
  longueur_m REAL, mode_pose TEXT,
  prot_constructeur TEXT, prot_categorie TEXT, prot_gamme TEXT, prot_variante TEXT, prot_calibre TEXT, prot_courbe TEXT, prot_declencheur TEXT,
  prot_ci TEXT, jdb TEXT, lieu TEXT, designation TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  CHECK (contrat_id IS NOT NULL OR devis_id IS NOT NULL)
);
CREATE INDEX ix_etude_bt_circuits_contrat ON etude_bt_circuits(contrat_id);
CREATE INDEX ix_etude_bt_circuits_devis ON etude_bt_circuits(devis_id);
CREATE INDEX ix_etude_bt_circuits_conso ON etude_bt_circuits(conso_id);

-- V3.15 : liens entre les libellés d'une note de calcul Caneco et nos catalogues (réutilisables d'un projet à l'autre).
-- type = 'cable' (cle = type de câble Caneco -> famille), 'protection' (cle = bloc de coupure -> constructeur / catégorie / gamme),
-- 'declencheur' (cle = bloc déclencheur -> code de déclencheur de etude_mat_declencheurs).
-- V3.30 : bibliothèque de symboles graphiques (éditeur de symboles), commune à tous les projets.
-- code = clé stable (ex. 'disjoncteur') ; les entités de dessin (mm, Y vers le haut) vivent dans extra.entites.
-- Un symbole « système » (livré avec l'application) n'existe en base qu'une fois modifié : il surcharge alors le dessin par défaut.
CREATE TABLE etude_symboles (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, nom TEXT, categorie TEXT, description TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);

-- V3.36 : fiches techniques des déclencheurs (fichier sur disque : data/etude_materiel_docs/ ; ou simple lien web).
-- Rattachée à un déclencheur (declencheur = code) ou à une famille / série (famille) ; un document peut viser plusieurs cibles (cibles = liste dans extra).
CREATE TABLE etude_mat_docs (
  id TEXT PRIMARY KEY, constructeur TEXT, declencheur TEXT, famille TEXT, type TEXT, titre TEXT NOT NULL,
  fichier TEXT, nom_fichier TEXT, url TEXT, mime TEXT, taille INTEGER, date_doc TEXT, remarque TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);
-- V3.36 : courbes de déclenchement (temps-courant) : une courbe = plusieurs séries de points [courant, temps] dans extra.series ;
-- abscisse = « × Ir », « × In » ou « A ». Saisie par points (ou CSV), tracé log-log dans la fenêtre du déclencheur.
CREATE TABLE etude_mat_courbes (
  id TEXT PRIMARY KEY, constructeur TEXT, declencheur TEXT, nom TEXT NOT NULL, abscisse TEXT, remarque TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT
);

CREATE TABLE etude_bt_liens_caneco (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, cle TEXT NOT NULL, libelle TEXT,
  constructeur TEXT, categorie TEXT, gamme TEXT, variante TEXT, famille TEXT, declencheur TEXT,
  created_at TEXT, cree_par TEXT, updated_at TEXT, extra TEXT,
  UNIQUE (type, cle)
);
