# -*- coding: utf-8 -*-
"""Migration JSON (table « documents ») -> tables SQL relationnelles (V3).

Deux fonctions publiques :
    migrer(src, dst)        copie tous les documents de `src` (base V2.x) dans `dst`
                            (base V3, schéma schema_v3_relationnel.sql déjà créé).
    verifier(src, dst)      reconstitue chaque document depuis les tables et le compare
                            à l'original (aucun écart toléré hors noms recopiés).

`rebuild_doc(dst, collection, id)` reconstitue le JSON d'un document : c'est la brique
que le serveur utilisera pour garder les routes /api/collection et /api/doc inchangées.

Aucune donnée n'est perdue : tout champ inconnu ou non scalaire est conservé dans la
colonne `extra` (JSON) de la table concernée.
"""
import json
import re

SCALAR = (str, int, float, bool, type(None))

# --- Nommage -----------------------------------------------------------------
REN = {
    'creePar': 'cree_par', 'clientNom': 'client_nom', 'ctrId': 'contrat_id', 'ctrNumero': 'ctr_numero',
    'devisId': 'devis_id', 'devisNumero': 'devis_numero', 'attachementId': 'attachement_id',
    'attachementNumero': 'attachement_numero', 'pfaId': 'pfa_id', 'pfaNumero': 'pfa_numero',
    'factureId': 'facture_id', 'factureNumero': 'facture_numero', 'fournisseurId': 'fournisseur_id',
    'livId': 'livrable_id', 'personneId': 'personnel_id', 'personneNom': 'personne_nom',
    'livDesignation': 'liv_designation', 'livCode': 'liv_code', 'destId': 'destinataire_id',
    'destNom': 'destinataire_nom', 'destCategorie': 'destinataire_categorie', 'motCle': 'mot_cle',
    'referenceContrat': 'reference_contrat', 'statutImplementation': 'statut_implementation',
    'statutTest': 'statut_test', 'sourceType': 'source_type', 'sourceId': 'source_id',
    'genereeAuto': 'generee_auto', 'contrePieceDe': 'contre_piece_de', 'numeroSeqTexte': 'numero_seq_texte',
    'segmentsAutoDepuisReferenceClient': 'segments_auto_depuis_reference_client',
    'referenceClient': 'reference_client', 'identifiantFiscal': 'identifiant_fiscal',
    'createdAt': 'created_at', 'updatedAt': 'updated_at', 'passwordHash': 'mot_de_passe_hash',
    'pin': 'pin_herite', 'tiersAuto': 'tiers_auto', 'tiersId': 'tiers_id', 'dateEmbauche': 'date_embauche',
    'typeContrat': 'type_contrat', 'clientId': 'client_id', 'pieceJointeRelPath': 'piece_jointe_rel_path',
    'pieceJointeNom': 'piece_jointe_nom', 'pieceJointeData': 'piece_jointe_data', 'periodeLabel': 'periode_label',
    'nomFichier': 'nom_fichier', 'exerciceDebut': 'exercice_debut', 'exerciceFin': 'exercice_fin',
    'chiffreAffairesExerciceCloture': 'chiffre_affaires_exercice_cloture', 'totalClient': 'total_client',
    'totalFournisseur': 'total_fournisseur', 'fileRelPath': 'file_rel_path', 'fileName': 'file_name',
    'ocrUtilise': 'ocr_utilise', 'origineEngagement': 'origine_engagement', 'validiteJours': 'validite_jours',
    'montantImpact': 'montant_impact', 'delaiImpactJours': 'delai_impact_jours', 'dateRetour': 'date_retour',
    'statutRetour': 'statut_retour', 'qteMarche': 'qte_marche', 'qteAnterieure': 'qte_anterieure',
    'qtePeriode': 'qte_periode', 'indiceRevision': 'indice_revision', 'typeDocument': 'type_document',
    'dateEmission': 'date_emission', 'datePlanifieeDebut': 'date_planifiee_debut',
    'datePlanifieeFin': 'date_planifiee_fin', 'codeComplet': 'code_complet', 'numeroSeq': 'numero_seq',
    'avSeq': 'av_seq', 'attSeq': 'att_seq', 'livSeq': 'liv_seq', 'bordereauSeq': 'bordereau_seq',
    'versionSeq': 'version_seq', 'annulePar': 'annule_par', 'annuleAt': 'annule_at', 'valideePar': 'validee_par',
    'valideeAt': 'validee_at', 'montantTVA': 'montant_tva', 'montantRG': 'montant_rg', 'tauxTVA': 'taux_tva',
    'tauxRG': 'taux_rg', 'referenceHistorique': 'reference_historique', 'montantHT': 'montant_ht',
    'montantTTC': 'montant_ttc', 'dateOp': 'date_op', 'dateVal': 'date_val',
    'factureFournisseurId': 'facture_fournisseur_id', 'factureClientId': 'facture_client_id',
    '_reglementCree': 'reglement_cree', '_encaissementCree': 'encaissement_cree',
    'chiffreAffaires': 'chiffre_affaires', 'chiffreAffairesExercicePrecedent': 'chiffre_affaires_exercice_precedent',
    'dateDebut': 'date_debut', 'dateFin': 'date_fin', 'dateExpiration': 'date_expiration',
    'budgetHeures': 'budget_heures', 'competenceId': 'competence_id',
}
# surcharges par table (clé JSON -> colonne)
TREN = {
    'tiers': {'tiers': 'nom'},
    'personnel': {'statut': 'statut_id'},
    'competences': {'categorie': 'categorie_id'},
    'livrable_affectations': {'id': 'personnel_id'},
    'parametres_societe': {
        'facturesFournisseursDir': 'dossier_factures_fournisseurs',
        'facturesFournisseursSourceDir': 'dossier_source_factures_fournisseurs',
        'facturesClientsDir': 'dossier_factures_clients',
        'commandesPiecesJointesDir': 'dossier_pieces_commandes',
        'devisImportesDir': 'dossier_devis_importes'},
}
BOOLCOLS = {'actif', 'tiers_auto', 'verrouillee', 'ocr_utilise', 'generee_auto', 'inconnu', 'reglement_cree',
            'encaissement_cree', 'predefinie', 'jour_plein', 'segments_auto_depuis_reference_client', 'fait'}


def snake(s):
    return re.sub(r'([A-Z])', lambda m: '_' + m.group(1).lower(), s)


def camel(s):
    return re.sub(r'_([a-z0-9])', lambda m: m.group(1).upper(), s)


def to_col(table, key):
    return TREN.get(table, {}).get(key) or REN.get(key) or snake(key)


_INV = {}


def to_key(table, col):
    ov = {c: k for k, c in TREN.get(table, {}).items()}
    if col in ov:
        return ov[col]
    if col not in _INV:
        _INV[col] = None
        for k, c in REN.items():
            if c == col:
                _INV[col] = k
    return _INV[col] or camel(col)


# --- Introspection du schéma (SQLite) ------------------------------------------
_COLS = {}


def cols_of(conn, table):
    key = (id(conn), table)
    if key not in _COLS:
        _COLS[key] = [r[1] for r in conn.execute('PRAGMA table_info(%s)' % table)]
    return _COLS[key]


def conv_in(v):
    return 1 if v is True else 0 if v is False else v


def conv_out(col, v):
    return bool(v) if (col in BOOLCOLS and v is not None) else v


def jdump(x):
    return json.dumps(x, ensure_ascii=False)


# --- Écriture / lecture génériques d'une ligne ----------------------------------
def build_row(conn, table, fixed, doc, skip=(), rename=None):
    """Prépare la ligne SQL d'un document. `fixed` : colonnes imposées (clés, rang).
    Clés inconnues ou non scalaires -> extra (JSON)."""
    cols = cols_of(conn, table)
    row = dict(fixed)
    extra = {}
    for k, v in doc.items():
        if k in skip:
            continue
        if table == 'factures' and k in ('cmdId', 'cmdNumero') and v in (None, ''):
            continue  # reste vide de l'ancienne notion de commande (supprimée) : non conservé
        col = (rename or {}).get(k) or to_col(table, k)
        if col in cols and col not in fixed and col != 'extra' and isinstance(v, SCALAR):
            row[col] = conv_in(v)
        else:
            extra[k] = v
    if extra and 'extra' in cols:
        row['extra'] = jdump(extra)
    elif extra:
        raise ValueError("champ(s) sans colonne dans %s : %s" % (table, ', '.join(sorted(extra))))
    return row


def insert_row(conn, table, fixed, doc, skip=(), rename=None):
    row = build_row(conn, table, fixed, doc, skip, rename)
    names = list(row)
    conn.execute('INSERT INTO %s (%s) VALUES (%s)' % (table, ','.join(names), ','.join('?' * len(names))),
                 [row[n] for n in names])


def upsert_main(conn, table, fixed, doc, exists):
    """Ligne principale d'un document : INSERT, ou UPDATE de toutes les colonnes si elle existe déjà
    (une UPDATE plutôt qu'un DELETE+INSERT : les autres tables qui référencent cette ligne ne sont pas touchées)."""
    if not exists:
        return insert_row(conn, table, fixed, doc)
    row = build_row(conn, table, fixed, doc)
    cols = cols_of(conn, table)
    if table == 'statuts_personnel':          # le document « niveaux attendus » vit dans extra : à préserver
        old = conn.execute('SELECT extra FROM statuts_personnel WHERE id=?', (fixed['id'],)).fetchone()
        if old and old[0]:
            keep = json.loads(old[0]).get('_niveauxAttendusDoc')
            if keep is not None:
                ex = json.loads(row['extra']) if row.get('extra') else {}
                ex['_niveauxAttendusDoc'] = keep
                row['extra'] = jdump(ex)
    notnull = {r[1] for r in conn.execute('PRAGMA table_info(%s)' % table) if r[3]}
    sets = [c for c in cols if c not in fixed and not (c in notnull and c not in row)]
    conn.execute('UPDATE %s SET %s WHERE id=?' % (table, ','.join('%s=?' % c for c in sets)),
                 [row.get(c) for c in sets] + [fixed['id']])


def row_to_doc(conn, table, r, exclude=()):
    """Ligne SQL (dict) -> dict JSON."""
    out = {}
    for col, v in r.items():
        if col in exclude or col in ('extra', 'rang'):
            continue
        if v is not None:
            out[to_key(table, col)] = conv_out(col, v)
    if r.get('extra'):
        out.update(json.loads(r['extra']))
    return out


def fetch(conn, sql, params=()):
    cur = conn.execute(sql, params)
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


# --- Spécifications -----------------------------------------------------------
# kind: rows (liste de dicts -> table fille), strlist (liste de textes), map (dict -> clé/valeur)
def R(key, table, fk, **kw):
    return dict(kind='rows', key=key, table=table, fk=fk, **kw)


def S(key, table, fk, col, **kw):
    return dict(kind='strlist', key=key, table=table, fk=fk, col=col, **kw)


def M(key, table, fk, keycol, valcol):
    return dict(kind='map', key=key, table=table, fk=fk, keycol=keycol, valcol=valcol)


LIG = lambda t, fk: R('lignes', t, fk)
MAIN = {
    'tiersBancaires': dict(table='tiers', special='tiers'),
    'clients': dict(table='clients'),
    'personnelStatuts': dict(table='statuts_personnel'),
    'competenceCategories': dict(table='categories_competence'),
    'competencesReferentiel': dict(table='competences'),
    'personnel': dict(table='personnel', special='personnel'),
    'devis': dict(table='devis', children=[LIG('devis_lignes', 'devis_id')]),
    'contrats': dict(table='contrats', special='contrats', children=[
        LIG('contrats_lignes', 'contrat_id'), R('destinataires', 'contrat_destinataires', 'contrat_id'),
        S('codificationSegments', 'contrat_composition_code', 'contrat_id', 'segment_ref'),
        S('segmentsFixesRetires', 'contrat_segments_fixes_retires', 'contrat_id', 'segment_fixe'),
        M('codesRetourClient', 'contrat_codes_retour', 'contrat_id', 'statut_retour', 'code_client')]),
    'avenants': dict(table='avenants'),
    'attachements': dict(table='attachements', children=[LIG('attachements_lignes', 'attachement_id')]),
    'propositionsFacturation': dict(table='propositions_facturation', children=[LIG('propositions_facturation_lignes', 'pfa_id')]),
    'factures': dict(table='factures', children=[LIG('factures_lignes', 'facture_id')]),
    'avoirs': dict(table='avoirs', children=[LIG('avoirs_lignes', 'avoir_id')]),
    'reglements': dict(table='reglements'),
    'livrables': dict(table='livrables', children=[
        R('historiqueIndices', 'livrable_historique_indices', 'livrable_id'),
        R('affectations', 'livrable_affectations', 'livrable_id'),
        M('segmentsValeurs', 'livrable_segment_valeurs', 'livrable_id', 'segment_id', 'valeur')]),
    'bordereaux': dict(table='bordereaux', children=[LIG('bordereaux_lignes', 'bordereau_id')]),
    'planificationLignes': dict(table='grille_lignes', type='plan', special='grille'),
    'timesheetLignes': dict(table='grille_lignes', type='pointage', special='grille'),
    'etudeConsommateurs': dict(table='etude_consommateurs'),
    'etudeListes': dict(table='etude_listes_valeurs'),
    'etudeListeDocs': dict(table='etude_liste_documents'),
    'etudeBilanTableaux': dict(table='etude_bilan_tableaux'),
    'etudeMatTransfos': dict(table='etude_mat_transfos'),
    'etudeMatParams': dict(table='etude_mat_params'),
    'etudeMatSources': dict(table='etude_mat_sources'),
    'etudeMatConstructeurs': dict(table='etude_mat_constructeurs'),
    'etudeMatDisj': dict(table='etude_mat_disjoncteurs'),
    'etudeMatDecl': dict(table='etude_mat_declencheurs'),
    'etudeMatAssoc': dict(table='etude_mat_assoc_decl'),
    'etudeMatReglages': dict(table='etude_mat_reglages'),
    'etudeBtCables': dict(table='etude_bt_cables'),
    'etudeBtCircuits': dict(table='etude_bt_circuits'),
    'etudeBtLiensCaneco': dict(table='etude_bt_liens_caneco'),
    'etudeSymboles': dict(table='etude_symboles'),
    'etudeMatDocs': dict(table='etude_mat_docs'),
    'etudeMatCourbes': dict(table='etude_mat_courbes'),
    'planComptable': dict(table='plan_comptable'),
    'ecritures': dict(table='ecritures', children=[LIG('ecritures_lignes', 'ecriture_id')]),
    'exercicesArchives': dict(table='exercices_archives', children=[LIG('exercices_archives_lignes', 'exercice_id')]),
    'facturesFournisseurs': dict(table='factures_fournisseurs', children=[
        R('reglements', 'factures_fournisseurs_reglements', 'facture_fournisseur_id')]),
    'releves': dict(table='releves', children=[LIG('releves_lignes', 'releve_id')]),
    'users': dict(table='utilisateurs'),
    'backlog': dict(table='backlog'),
    'formations': dict(table='formations', special='formations'),
    'niveauxAttendusStatuts': dict(table='statuts_personnel', special='niveaux'),
    'settings': dict(table='parametres_societe', special='settings'),
    'meta': dict(table='compteurs', special='meta'),
}
# ordre d'insertion : parents avant enfants
ORDER = ['tiersBancaires', 'clients', 'personnelStatuts', 'competenceCategories', 'competencesReferentiel',
         'personnel', 'niveauxAttendusStatuts', 'devis', 'contrats', 'livrables', 'avenants', 'attachements',
         'propositionsFacturation', 'factures', 'avoirs', 'reglements', 'bordereaux', 'planificationLignes',
         'timesheetLignes', 'etudeConsommateurs', 'etudeListes', 'etudeListeDocs', 'etudeBilanTableaux', 'etudeMatTransfos', 'etudeMatParams', 'etudeMatSources', 'etudeMatConstructeurs', 'etudeMatDisj', 'etudeMatDecl', 'etudeMatAssoc', 'etudeMatReglages', 'etudeBtCables', 'etudeBtCircuits', 'etudeBtLiensCaneco', 'etudeSymboles', 'etudeMatDocs', 'etudeMatCourbes', 'planComptable', 'ecritures', 'exercicesArchives', 'facturesFournisseurs', 'releves',
         'users', 'backlog', 'formations', 'settings', 'meta']
IGNORED = {'bonsCommande': "notion de commande supprimée (décision utilisateur)"}


# --- Enfants génériques --------------------------------------------------------
def child_ok(ch, v):
    k = ch['kind']
    return ((k == 'rows' and isinstance(v, list) and all(isinstance(x, dict) for x in v)) or
            (k == 'strlist' and isinstance(v, list) and all(isinstance(x, str) for x in v)) or
            (k == 'map' and isinstance(v, dict) and all(isinstance(x, SCALAR) for x in v.values())))


def plan_children(spec, doc, handled):
    for ch in spec.get('children', []):
        if ch['key'] in doc and child_ok(ch, doc[ch['key']]):
            handled.add(ch['key'])


def put_children(conn, spec, pid, doc, handled):
    for ch in spec.get('children', []):
        key = ch['key']
        if key not in handled:
            continue
        v = doc[key]
        k = ch['kind']
        if k == 'rows':
            for rang, it in enumerate(v):
                insert_row(conn, ch['table'], {ch['fk']: pid, 'rang': rang}, it)
        elif k == 'strlist':
            for rang, it in enumerate(v):
                row = {ch['fk']: pid, ch['col']: it}
                if 'rang' in cols_of(conn, ch['table']):
                    row['rang'] = rang
                insert_row(conn, ch['table'], row, {})
        elif k == 'map':
            for kk, vv in v.items():
                insert_row(conn, ch['table'], {ch['fk']: pid, ch['keycol']: kk, ch['valcol']: conv_in(vv)}, {})


def get_children(conn, spec, pid, doc):
    for ch in spec.get('children', []):
        t, fk, k = ch['table'], ch['fk'], ch['kind']
        cols = cols_of(conn, t)
        order = ' ORDER BY rang' if 'rang' in cols else ''
        rows = fetch(conn, 'SELECT * FROM %s WHERE %s=?%s' % (t, fk, order), (pid,))
        if k == 'rows':
            doc[ch['key']] = [row_to_doc(conn, t, r, exclude=(fk,)) for r in rows]
        elif k == 'strlist':
            doc[ch['key']] = [r[ch['col']] for r in rows]
        elif k == 'map':
            doc[ch['key']] = {r[ch['keycol']]: conv_out(ch['valcol'], r[ch['valcol']]) for r in rows}


# --- Insertion d'un document -----------------------------------------------------
def put_doc(conn, coll, did, doc, exists=False):
    spec = MAIN[coll]
    t = spec['table']
    sp = spec.get('special')
    if not isinstance(doc, dict):
        raise ValueError('document non objet')
    handled = set()
    doc = dict(doc)
    if sp == 'settings':
        return put_settings(conn, did, doc, exists)
    if sp == 'meta':
        return put_meta(conn, did, doc)
    if sp == 'niveaux':
        return put_niveaux(conn, did, doc)
    fixed = {'id': did}
    if sp == 'grille':
        fixed['type'] = spec['type']
        # heures / joursPleins -> grille_jours
        h, jp = doc.get('heures'), doc.get('joursPleins')
        if isinstance(h, dict) and all(isinstance(x, SCALAR) for x in h.values()):
            handled.add('heures')
        else:
            h = None
        if isinstance(jp, dict) and all(isinstance(x, bool) for x in jp.values()):
            handled.add('joursPleins')
        else:
            jp = None
    if sp == 'contrats':
        sg = doc.get('segmentsPersonnalises')
        ok = isinstance(sg, list) and all(isinstance(s, dict) and isinstance(s.get('valeurs', []), list)
                                          and all(isinstance(x, str) for x in s.get('valeurs', [])) for s in sg)
        if ok:
            handled.add('segmentsPersonnalises')
    if sp == 'tiers':
        mz = doc.get('modeleZones')
        okz = isinstance(mz, dict) and isinstance(mz.get('zones', []), list) and all(isinstance(z, dict) for z in mz.get('zones', []))
        if okz:
            handled.add('modeleZones')
    if sp == 'personnel':
        cp = doc.get('competences')
        okc = isinstance(cp, list) and all(isinstance(c, dict) for c in cp)
        if okc:
            handled.add('competences')
    if sp == 'formations':
        ps, cs = doc.get('personnes'), doc.get('competencesViseesIds')
        okp = isinstance(ps, list) and all(isinstance(p, dict) and isinstance(p.get('id'), str) for p in ps)
        okcs = isinstance(cs, list) and all(isinstance(c, str) for c in cs)
        if okp:
            handled.add('personnes')
        if okcs:
            handled.add('competencesViseesIds')
    plan_children(spec, doc, handled)
    # table principale : clés gérées par des tables filles retirées du document
    main_doc = {k: v for k, v in doc.items() if k not in handled}
    if sp == 'tiers' and 'modeleZones' in handled:
        rest = {k: v for k, v in doc['modeleZones'].items() if k != 'zones'}
        if rest:
            main_doc['_modeleZonesAutres'] = rest
    upsert_main(conn, t, fixed, main_doc, exists)
    put_children(conn, spec, did, doc, handled)
    # enfants spéciaux (après la ligne parente)
    if sp == 'grille':
        days = sorted(set((h or {}).keys()) | set((jp or {}).keys()))
        for j in days:
            r = {'ligne_id': did, 'jour': j}
            if h is not None and j in h:
                r['heures'] = h[j]
            if jp is not None and j in jp:
                r['jour_plein'] = 1 if jp[j] else 0
            insert_row(conn, 'grille_jours', r, {})
    if sp == 'contrats' and 'segmentsPersonnalises' in handled:
        for rang, s in enumerate(doc['segmentsPersonnalises']):
            insert_row(conn, 'contrat_segments', {'contrat_id': did, 'rang': rang}, {k: v for k, v in s.items() if k != 'valeurs'})
            for vr, val in enumerate(s.get('valeurs', [])):
                insert_row(conn, 'contrat_segment_valeurs', {'contrat_id': did, 'segment_id': s['id'], 'rang': vr, 'valeur': val}, {})
    if sp == 'tiers' and 'modeleZones' in handled:
        for rang, z in enumerate(doc['modeleZones'].get('zones', [])):
            insert_row(conn, 'tiers_zones', {'tiers_id': did, 'rang': rang}, z)
    if sp == 'personnel' and 'competences' in handled:
        for rang, c in enumerate(doc['competences']):
            hist = c.get('historique')
            skip = ['competenceNom'] + (['historique'] if isinstance(hist, list) and all(isinstance(h, dict) for h in hist) else [])
            cid = c.get('competenceId')
            insert_row(conn, 'personnel_competences', {'personnel_id': did, 'rang': rang}, c, skip=skip)
            if 'historique' in skip:
                for hr, h in enumerate(hist):
                    insert_row(conn, 'personnel_competences_historique',
                               {'personnel_id': did, 'competence_id': cid, 'rang': hr}, h)
    if sp == 'formations':
        if 'personnes' in handled:
            for rang, p in enumerate(doc['personnes']):
                insert_row(conn, 'formation_personnes', {'formation_id': did, 'personnel_id': p['id'], 'rang': rang},
                           {k: v for k, v in p.items() if k not in ('id', 'nom')})
        if 'competencesViseesIds' in handled:
            for rang, c in enumerate(doc['competencesViseesIds']):
                insert_row(conn, 'formation_competences', {'formation_id': did, 'competence_id': c, 'rang': rang}, {})


def put_niveaux(conn, sid, doc):
    items = doc.get('niveauxAttendus')
    ok = isinstance(items, list) and all(isinstance(c, dict) for c in items)
    rest = {k: v for k, v in doc.items() if not (ok and k == 'niveauxAttendus')}
    # le document vit dans statuts_personnel.extra (clé _niveauxAttendus) tant que le statut existe
    row = conn.execute('SELECT extra FROM statuts_personnel WHERE id=?', (sid,)).fetchone()
    if row is None:
        raise ValueError('statut du personnel inexistant (%s)' % sid)
    ex = json.loads(row[0]) if row[0] else {}
    ex['_niveauxAttendusDoc'] = rest if rest else {}
    conn.execute('UPDATE statuts_personnel SET extra=? WHERE id=?', (jdump(ex), sid))
    if ok:
        for rang, c in enumerate(items):
            hist = c.get('historique')
            skip = ['competenceNom'] + (['historique'] if isinstance(hist, list) and all(isinstance(h, dict) for h in hist) else [])
            insert_row(conn, 'niveaux_attendus', {'statut_id': sid, 'rang': rang}, c, skip=skip)
            if 'historique' in skip:
                for hr, h in enumerate(hist):
                    insert_row(conn, 'niveaux_attendus_historique',
                               {'statut_id': sid, 'competence_id': c['competenceId'], 'rang': hr}, h)


def put_settings(conn, did, doc, exists=False):
    if did == 'company':
        handled = set()
        sp, sw = doc.get('seqPrefixes'), doc.get('seqWidths')
        okp = isinstance(sp, dict) and all(isinstance(x, str) for x in sp.values())
        okw = isinstance(sw, dict) and all(isinstance(x, int) and not isinstance(x, bool) for x in sw.values())
        if okp:
            handled.add('seqPrefixes')
        if okw:
            handled.add('seqWidths')
        upsert_main(conn, 'parametres_societe', {'id': 'company'}, {k: v for k, v in doc.items() if k not in handled}, exists)
        types = set((sp or {}).keys() if okp else []) | set((sw or {}).keys() if okw else [])
        for t in sorted(types):
            r = {'type': t}
            if okp and t in sp:
                r['prefixe'] = sp[t]
            if okw and t in sw:
                r['largeur'] = sw[t]
            if 'prefixe' not in r:
                r['prefixe'] = ''
            if 'largeur' not in r:
                r['largeur'] = 4
            insert_row(conn, 'numerotation_parametres', r, {})
    elif did == 'migrations':
        for k, v in doc.items():
            if not isinstance(v, bool):
                raise ValueError('migration non booléenne : %s' % k)
            insert_row(conn, 'migrations_faites', {'nom': k, 'fait': 1 if v else 0}, {})
    else:
        raise ValueError('document settings/%s non pris en charge' % did)


def put_meta(conn, did, doc):
    if did != 'counters':
        raise ValueError('document meta/%s non pris en charge' % did)
    for k, v in doc.items():
        m = re.match(r'^(.+)_(\d{4})$', k)
        if not m or not isinstance(v, int) or isinstance(v, bool):
            raise ValueError('compteur non reconnu : %s' % k)
        insert_row(conn, 'compteurs', {'type': m.group(1), 'annee': int(m.group(2)), 'valeur': v}, {})


# --- Reconstitution -----------------------------------------------------------
def rebuild_doc(conn, coll, did):
    spec = MAIN[coll]
    t = spec['table']
    sp = spec.get('special')
    if sp == 'settings':
        return rebuild_settings(conn, did)
    if sp == 'meta':
        return rebuild_meta(conn, did)
    if sp == 'niveaux':
        return rebuild_niveaux(conn, did)
    rows = fetch(conn, 'SELECT * FROM %s WHERE id=?' % t, (did,))
    if not rows:
        return None
    r = rows[0]
    if sp == 'grille' and r['type'] != spec['type']:
        return None
    doc = row_to_doc(conn, t, r, exclude=('id', 'type') if sp == 'grille' else ('id',))
    doc.pop('_niveauxAttendusDoc', None)
    get_children(conn, spec, did, doc)
    if sp == 'grille':
        jours = fetch(conn, 'SELECT * FROM grille_jours WHERE ligne_id=? ORDER BY jour', (did,))
        doc['heures'] = {j['jour']: j['heures'] for j in jours if j['heures'] is not None}
        doc['joursPleins'] = {j['jour']: bool(j['jour_plein']) for j in jours if j['jour_plein'] is not None}
    if sp == 'contrats':
        segs = fetch(conn, 'SELECT * FROM contrat_segments WHERE contrat_id=? ORDER BY rang', (did,))
        if segs or 'segmentsPersonnalises' not in doc:
            out = []
            for s in segs:
                d = row_to_doc(conn, 'contrat_segments', s, exclude=('contrat_id',))
                d['valeurs'] = [v['valeur'] for v in fetch(
                    conn, 'SELECT valeur FROM contrat_segment_valeurs WHERE contrat_id=? AND segment_id=? ORDER BY rang', (did, s['id']))]
                out.append(d)
            doc['segmentsPersonnalises'] = out
    if sp == 'tiers':
        zs = fetch(conn, 'SELECT * FROM tiers_zones WHERE tiers_id=? ORDER BY rang', (did,))
        autres = doc.pop('_modeleZonesAutres', None)
        if zs or autres:
            mz = dict(autres or {})
            mz['zones'] = [row_to_doc(conn, 'tiers_zones', z, exclude=('tiers_id',)) for z in zs]
            doc['modeleZones'] = mz
    if sp == 'personnel':
        pc = fetch(conn, 'SELECT p.*, c.nom AS _nom FROM personnel_competences p LEFT JOIN competences c ON c.id=p.competence_id '
                         'WHERE p.personnel_id=? ORDER BY p.rang', (did,))
        out = []
        for c in pc:
            nom = c.pop('_nom')
            d = row_to_doc(conn, 'personnel_competences', c, exclude=('personnel_id',))
            if nom is not None:
                d['competenceNom'] = nom
            hs = fetch(conn, 'SELECT * FROM personnel_competences_historique WHERE personnel_id=? AND competence_id=? ORDER BY rang',
                       (did, c['competence_id']))
            if hs:
                d['historique'] = [row_to_doc(conn, 'personnel_competences_historique', h, exclude=('personnel_id', 'competence_id')) for h in hs]
            out.append(d)
        doc['competences'] = out
    if sp == 'formations':
        ps = fetch(conn, 'SELECT f.*, p.nom AS _nom FROM formation_personnes f LEFT JOIN personnel p ON p.id=f.personnel_id '
                         'WHERE f.formation_id=? ORDER BY f.rang', (did,))
        doc['personnes'] = []
        for p in ps:
            d = {'id': p['personnel_id']}
            if p['_nom'] is not None:
                d['nom'] = p['_nom']
            if p.get('extra'):
                d.update(json.loads(p['extra']))
            doc['personnes'].append(d)
        doc['competencesViseesIds'] = [r['competence_id'] for r in fetch(
            conn, 'SELECT competence_id FROM formation_competences WHERE formation_id=? ORDER BY rang', (did,))]
    return doc


def rebuild_niveaux(conn, sid):
    row = conn.execute('SELECT extra FROM statuts_personnel WHERE id=?', (sid,)).fetchone()
    if not row or not row[0]:
        return None
    ex = json.loads(row[0])
    if '_niveauxAttendusDoc' not in ex:
        return None
    doc = dict(ex['_niveauxAttendusDoc'])
    items = fetch(conn, 'SELECT n.*, c.nom AS _nom FROM niveaux_attendus n LEFT JOIN competences c ON c.id=n.competence_id '
                        'WHERE n.statut_id=? ORDER BY n.rang', (sid,))
    out = []
    for c in items:
        nom = c.pop('_nom')
        d = row_to_doc(conn, 'niveaux_attendus', c, exclude=('statut_id',))
        if nom is not None:
            d['competenceNom'] = nom
        hs = fetch(conn, 'SELECT * FROM niveaux_attendus_historique WHERE statut_id=? AND competence_id=? ORDER BY rang',
                   (sid, c['competence_id']))
        if hs:
            d['historique'] = [row_to_doc(conn, 'niveaux_attendus_historique', h, exclude=('statut_id', 'competence_id')) for h in hs]
        out.append(d)
    doc['niveauxAttendus'] = out
    return doc


def rebuild_settings(conn, did):
    if did == 'company':
        rows = fetch(conn, "SELECT * FROM parametres_societe WHERE id='company'")
        if not rows:
            return None
        doc = row_to_doc(conn, 'parametres_societe', rows[0], exclude=('id',))
        np_ = fetch(conn, 'SELECT * FROM numerotation_parametres ORDER BY type')
        if np_:
            doc['seqPrefixes'] = {r['type']: r['prefixe'] for r in np_}
            doc['seqWidths'] = {r['type']: r['largeur'] for r in np_}
        return doc
    if did == 'migrations':
        rows = fetch(conn, 'SELECT * FROM migrations_faites')
        return {r['nom']: bool(r['fait']) for r in rows} if rows else None
    return None


def rebuild_meta(conn, did):
    if did != 'counters':
        return None
    rows = fetch(conn, 'SELECT * FROM compteurs')
    return {'%s_%s' % (r['type'], r['annee']): r['valeur'] for r in rows} if rows else None


# --- Comparaison ----------------------------------------------------------------
def _empty(v):
    return v is None or v == [] or v == {}


def diff(a, b, path=''):
    """Écarts entre deux valeurs JSON. Absent == null == liste/objet vide."""
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            va, vb = a.get(k), b.get(k)
            if _empty(va) and _empty(vb):
                continue
            out += diff(va, vb, path + '.' + k if path else k)
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [(path, 'longueur %d / %d' % (len(a), len(b)))]
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff(x, y, '%s[%d]' % (path, i))
        return out
    if _empty(a) and _empty(b):
        return []
    if isinstance(a, bool) != isinstance(b, bool) or a != b:
        return [(path, '%r / %r' % (a, b))]
    return []


# --- Orchestration ---------------------------------------------------------------
def migrer(src, dst):
    """src : connexion base V2.x ; dst : connexion base V3 (schéma créé). Retourne un rapport."""
    rap = {'migres': {}, 'erreurs': [], 'ignores': {}, 'inconnus': {}}
    colls = {r[0]: r[1] for r in src.execute('SELECT collection, COUNT(*) FROM documents GROUP BY collection')}
    for c, n in colls.items():
        if c in IGNORED:
            rap['ignores'][c] = (n, IGNORED[c])
        elif c not in MAIN:
            rap['inconnus'][c] = n
    for coll in ORDER:
        if coll not in colls:
            continue
        ok = 0
        for did, data in src.execute('SELECT id, data FROM documents WHERE collection=? ORDER BY rowid', (coll,)).fetchall():
            dst.execute('SAVEPOINT doc')
            try:
                put_doc(dst, coll, did, json.loads(data))
                dst.execute('RELEASE doc')
                ok += 1
            except Exception as e:
                dst.execute('ROLLBACK TO doc')
                dst.execute('RELEASE doc')
                rap['erreurs'].append((coll, did, '%s: %s' % (type(e).__name__, e)))
        rap['migres'][coll] = (ok, colls[coll])
    return rap


INFO_SUFFIX = ('competenceNom',)


def verifier(src, dst):
    """Reconstitue chaque document migré et le compare à l'original."""
    res = {'ok': 0, 'ecarts': [], 'absents': [], 'infos': []}
    for coll in ORDER:
        for did, data in src.execute('SELECT id, data FROM documents WHERE collection=? ORDER BY rowid', (coll,)).fetchall():
            orig = json.loads(data)
            new = rebuild_doc(dst, coll, did)
            if new is None:
                res['absents'].append((coll, did))
                continue
            d = diff(orig, new)
            fatal = [x for x in d if not x[0].endswith(INFO_SUFFIX) and not x[0].endswith('.nom')]
            info = [x for x in d if x not in fatal]
            if fatal:
                res['ecarts'].append((coll, did, fatal))
            else:
                res['ok'] += 1
            if info:
                res['infos'].append((coll, did, info))
    return res


# --- API de lecture / écriture utilisée par le serveur ---------------------------------
SPECIAL_CHILD_TABLES = {
    'grille': [('grille_jours', 'ligne_id')],
    'contrats': [('contrat_segments', 'contrat_id')],
    'tiers': [('tiers_zones', 'tiers_id')],
    'personnel': [('personnel_competences', 'personnel_id')],
    'formations': [('formation_personnes', 'formation_id'), ('formation_competences', 'formation_id')],
}


class CollectionInconnue(Exception):
    pass


def _spec(coll):
    if coll not in MAIN:
        raise CollectionInconnue(coll)
    return MAIN[coll]


def doc_exists(conn, coll, did):
    spec = _spec(coll)
    sp = spec.get('special')
    if sp == 'settings':
        if did == 'company':
            return conn.execute("SELECT 1 FROM parametres_societe WHERE id='company'").fetchone() is not None
        return conn.execute('SELECT 1 FROM migrations_faites LIMIT 1').fetchone() is not None if did == 'migrations' else False
    if sp == 'meta':
        return did == 'counters' and conn.execute('SELECT 1 FROM compteurs LIMIT 1').fetchone() is not None
    if sp == 'niveaux':
        return rebuild_niveaux(conn, did) is not None
    if sp == 'grille':
        return conn.execute('SELECT 1 FROM grille_lignes WHERE id=? AND type=?', (did, spec['type'])).fetchone() is not None
    return conn.execute('SELECT 1 FROM %s WHERE id=?' % spec['table'], (did,)).fetchone() is not None


def _delete_children(conn, coll, did):
    spec = _spec(coll)
    for ch in spec.get('children', []):
        conn.execute('DELETE FROM %s WHERE %s=?' % (ch['table'], ch['fk']), (did,))
    for t, fk in SPECIAL_CHILD_TABLES.get(spec.get('special'), []):
        conn.execute('DELETE FROM %s WHERE %s=?' % (t, fk), (did,))


def get_doc(conn, coll, did):
    _spec(coll)
    return rebuild_doc(conn, coll, did)


def list_docs(conn, coll):
    """[(id, doc)] dans l'ordre de création."""
    spec = _spec(coll)
    sp = spec.get('special')
    if sp in ('settings', 'meta'):
        ids = ['company', 'migrations'] if sp == 'settings' else ['counters']
    elif sp == 'niveaux':
        ids = [r[0] for r in conn.execute('SELECT id FROM statuts_personnel ORDER BY rowid')]
    elif sp == 'grille':
        ids = [r[0] for r in conn.execute('SELECT id FROM grille_lignes WHERE type=? ORDER BY rowid', (spec['type'],))]
    else:
        ids = [r[0] for r in conn.execute('SELECT id FROM %s ORDER BY rowid' % spec['table'])]
    out = []
    for i in ids:
        d = rebuild_doc(conn, coll, i)
        if d is not None:
            out.append((i, d))
    return out


def replace_doc(conn, coll, did, doc):
    """Équivalent de set() : remplace entièrement le document (le crée s'il n'existe pas).
    Ne fait pas de commit : la transaction est gérée par l'appelant."""
    _spec(coll)
    exists = doc_exists(conn, coll, did)
    if exists:
        _delete_children(conn, coll, did)
        sp = MAIN[coll].get('special')
        if sp == 'settings':
            conn.execute('DELETE FROM numerotation_parametres' if did == 'company' else 'DELETE FROM migrations_faites')
            if did == 'migrations':
                exists = False
        elif sp == 'meta':
            conn.execute('DELETE FROM compteurs')
        elif sp == 'niveaux':
            conn.execute('DELETE FROM niveaux_attendus WHERE statut_id=?', (did,))
    put_doc(conn, coll, did, doc, exists=exists)


def merge_doc(conn, coll, did, patch):
    """Équivalent de update() : fusion au premier niveau ; crée le document s'il n'existe pas."""
    cur = get_doc(conn, coll, did) or {}
    cur.update(patch)
    replace_doc(conn, coll, did, cur)
    return cur


def delete_doc(conn, coll, did):
    spec = _spec(coll)
    sp = spec.get('special')
    if sp == 'settings':
        if did == 'company':
            conn.execute('DELETE FROM numerotation_parametres')
            conn.execute("DELETE FROM parametres_societe WHERE id='company'")
        elif did == 'migrations':
            conn.execute('DELETE FROM migrations_faites')
    elif sp == 'meta':
        conn.execute('DELETE FROM compteurs')
    elif sp == 'niveaux':
        conn.execute('DELETE FROM niveaux_attendus WHERE statut_id=?', (did,))
        row = conn.execute('SELECT extra FROM statuts_personnel WHERE id=?', (did,)).fetchone()
        if row and row[0]:
            ex = json.loads(row[0])
            ex.pop('_niveauxAttendusDoc', None)
            conn.execute('UPDATE statuts_personnel SET extra=? WHERE id=?', (jdump(ex) if ex else None, did))
    elif sp == 'grille':
        conn.execute('DELETE FROM grille_lignes WHERE id=? AND type=?', (did, spec['type']))
    else:
        conn.execute('DELETE FROM %s WHERE id=?' % spec['table'], (did,))
