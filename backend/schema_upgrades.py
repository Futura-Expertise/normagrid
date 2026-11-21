# -*- coding: utf-8 -*-
"""Mises à niveau du schéma relationnel d'une base V3 déjà existante (le schéma complet n'est appliqué
que sur une base vide). Chaque étape est enregistrée dans `migrations_faites` et ne se rejoue pas.

V3.02 « livrables liés à un devis » :
  - devis : liv_seq, bordereau_seq, segments_auto_depuis_reference_client
  - livrables et bordereaux : contrat_id devient facultatif ; ajout de devis_id / devis_numero
    + règle « lié à un contrat OU à un devis » (CHECK)
  - grille_lignes (planning / pointage) : ajout de devis_id / devis_numero
V3.13 : table etude_bt_cables (catalogue des câbles BT, import Excel).
V3.12 : colonne « categorie » des disjoncteurs (Disj. Boîtier moulé, Disj. Ouvert, Disjonct. B / C / D..., Fusible gG).
V3.11 : tables etude_mat_constructeurs / disjoncteurs / declencheurs / assoc_decl / reglages (protections BT par constructeur, import Excel).
V3.08 : colonne « onaf » (OUI / NON) de la base matériel (transformateurs sans ventilation : ONAF non applicable).
V3.06 : tables etude_mat_transfos / etude_mat_params / etude_mat_sources (base matériel, avec valeurs de départ).
V3.05 : table etude_bilan_tableaux (bilan de puissance par tableau).
V3.04 : table etude_liste_documents (document « Liste des consommateurs »).
V3.03 « étude électrique » : nouvelles tables etude_consommateurs et etude_listes_valeurs (créées si absentes)
  + valeurs de départ des listes déroulantes (reprises du modèle « Liste des consommateurs »).
SQLite ne sait pas retirer un NOT NULL : livrables et bordereaux sont reconstruits (procédure officielle
en 12 étapes : copie dans une table neuve, remplacement, vérification des clés étrangères)."""
import os
import re

ETAPE_LIVRABLES_DEVIS = "livrablesDevisV302"
ETAPE_ETUDE_ELEC = "etudeElectriqueV303"
ETAPE_ETUDE_LISTE = "etudeListeV304"
ETAPE_ETUDE_BILAN = "etudeBilanV305"
ETAPE_ETUDE_MATERIEL = "etudeMaterielV306"
ETAPE_MATERIEL_ONAF = "etudeMaterielOnafV308"
ETAPE_MATERIEL_PROTECTIONS = "etudeMaterielProtectionsV311"
ETAPE_CABLES_BT = "etudeCablesBtV313"
ETAPE_CIRCUITS_BT = "etudeCircuitsBtV314"
ETAPE_LIENS_CANECO = "etudeLiensCanecoV315"
ETAPE_SYMBOLES = "etudeSymbolesV330"
ETAPE_MAT_DOCS = "etudeMatDocsV336"
ETAPE_LIENS_VARIANTE = "etudeLiensVarianteV316"
ETAPE_DECL_REFERENCES = "etudeDeclencheursReferencesV319"
ETAPE_PROTECTIONS_CATEGORIE = "etudeMaterielCategorieV312"
TABLES_PROTECTIONS = ("etude_mat_constructeurs", "etude_mat_disjoncteurs", "etude_mat_declencheurs",
                      "etude_mat_assoc_decl", "etude_mat_reglages")
TABLES_MATERIEL = ("etude_mat_transfos", "etude_mat_params", "etude_mat_sources")

# Valeurs de départ des listes déroulantes de l'étude électrique (celles du fichier modèle).
LISTES_ETUDE_DEFAUT = {
    "tension": ["230", "400", "525", "10000"],
    "phaseFreq": ["3/50", "1/50", "2/50"],
    "specialReqts": ["DOL", "VFD", "DD", "FEEDER", "NA", "N/A"],
    "ws": ["W", "S", "Futur"],
    "ci": ["C", "I", "S"],
    "eNe": ["E", "NE"],
    "unite": ["kW", "kVA", "A"],
    "typeConso": ["Moteur", "Tableau", "Divers"],
    "contenu": ["3P+PE", "P+N+PE", "3P+N+PE", "3P"],
    "modePose": [],
}


def _ddl(schema_sql, table):
    m = re.search(r"CREATE TABLE %s \(.*?\n\);" % table, schema_sql, re.S)
    if not m:
        raise RuntimeError("table %s introuvable dans le schéma" % table)
    return m.group(0)


def _index_ddl(schema_sql, table):
    return re.findall(r"CREATE (?:UNIQUE )?INDEX \w+ ON %s\(.*?\);" % table, schema_sql)


def marquer_faite(conn, nom):
    conn.execute("INSERT OR IGNORE INTO migrations_faites (nom, fait) VALUES (?, 1)", (nom,))


def deja_faite(conn, nom):
    return conn.execute("SELECT 1 FROM migrations_faites WHERE nom=?", (nom,)).fetchone() is not None


def _colonnes(conn, table):
    return [r[1] for r in conn.execute("PRAGMA table_info(%s)" % table)]


def _reconstruire(conn, schema_sql, table):
    ddl = _ddl(schema_sql, table).replace("CREATE TABLE %s (" % table, "CREATE TABLE %s_new (" % table, 1)
    anciennes = _colonnes(conn, table)
    conn.execute(ddl)
    conn.execute("INSERT INTO %s_new (%s) SELECT %s FROM %s" % (table, ",".join(anciennes), ",".join(anciennes), table))
    conn.execute("DROP TABLE %s" % table)
    conn.execute("ALTER TABLE %s_new RENAME TO %s" % (table, table))
    for idx in _index_ddl(schema_sql, table):
        conn.execute(idx)


def livrables_devis(conn, schema_path):
    """Applique l'étape V3.02 ; sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_LIVRABLES_DEVIS):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    conn.commit()
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        conn.execute("BEGIN")
        for col, typ in (("liv_seq", "INTEGER"), ("bordereau_seq", "INTEGER"),
                         ("segments_auto_depuis_reference_client", "INTEGER")):
            if col not in _colonnes(conn, "devis"):
                conn.execute("ALTER TABLE devis ADD COLUMN %s %s" % (col, typ))
        for col, typ in (("devis_id", "TEXT REFERENCES devis(id)"), ("devis_numero", "TEXT")):
            if col not in _colonnes(conn, "grille_lignes"):
                conn.execute("ALTER TABLE grille_lignes ADD COLUMN %s %s" % (col, typ))
        for table in ("livrables", "bordereaux"):
            _reconstruire(conn, schema_sql, table)
        mal = conn.execute("PRAGMA foreign_key_check").fetchall()
        if mal:
            raise RuntimeError("clés étrangères invalides après mise à niveau : %s" % (mal[:5],))
        marquer_faite(conn, ETAPE_LIVRABLES_DEVIS)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
    return True


def semer_listes_etude(conn):
    """Insère les valeurs de départ des listes (une seule fois par base : l'utilisateur les gère ensuite)."""
    import uuid
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    for liste, valeurs in LISTES_ETUDE_DEFAUT.items():
        for rang, v in enumerate(valeurs, start=1):
            conn.execute("INSERT OR IGNORE INTO etude_listes_valeurs (id, liste, valeur, rang, created_at) VALUES (?,?,?,?,?)",
                         (uuid.uuid4().hex[:20], liste, v, rang, now))


def etude_electrique(conn, schema_path):
    """Étape V3.03 : crée les tables du module Étude électrique (base existante) ; sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_ETUDE_ELEC):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    for table in ("etude_consommateurs", "etude_listes_valeurs"):
        existe = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        if not existe:
            conn.execute(_ddl(schema_sql, table))
            for idx in _index_ddl(schema_sql, table):
                conn.execute(idx)
    semer_listes_etude(conn)
    marquer_faite(conn, ETAPE_ETUDE_ELEC)
    conn.commit()
    return True


def etude_liste(conn, schema_path):
    """Étape V3.04 : crée la table du document « Liste des consommateurs » ; sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_ETUDE_LISTE):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_liste_documents"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_ETUDE_LISTE)
    conn.commit()
    return True


def etude_bilan(conn, schema_path):
    """Étape V3.05 : crée la table du bilan de puissance ; sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_ETUDE_BILAN):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_bilan_tableaux"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_ETUDE_BILAN)
    conn.commit()
    return True


def semer_materiel(conn):
    """Valeurs de départ de la base matériel (transformateurs HT/MT, paramètres, sources) : une seule fois par base ;
    l'utilisateur les gère ensuite. Données : backend/seed_materiel_transfos.json."""
    import json
    import uuid
    from datetime import datetime
    chemin = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_materiel_transfos.json")
    with open(chemin, encoding="utf-8") as f:
        seed = json.load(f)
    now = datetime.utcnow().isoformat() + "Z"

    def inserer(table, ligne):
        cols = ["id"] + [re.sub(r"([A-Z])", lambda m: "_" + m.group(1).lower(), k) for k in ligne] + ["created_at"]
        vals = [uuid.uuid4().hex[:20]] + list(ligne.values()) + [now]
        conn.execute("INSERT OR IGNORE INTO %s (%s) VALUES (%s)" % (table, ",".join(cols), ",".join("?" * len(cols))), vals)
    for t in seed["transfos"]:
        inserer("etude_mat_transfos", t)
    for p in seed["params"]:
        inserer("etude_mat_params", p)
    for s in seed["sources"]:
        inserer("etude_mat_sources", s)


def etude_materiel(conn, schema_path):
    """Étape V3.06 : crée les tables de la base matériel et les alimente ; sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_ETUDE_MATERIEL):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    for table in TABLES_MATERIEL:
        if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
            conn.execute(_ddl(schema_sql, table))
            for idx in _index_ddl(schema_sql, table):
                conn.execute(idx)
    semer_materiel(conn)
    marquer_faite(conn, ETAPE_ETUDE_MATERIEL)
    conn.commit()
    return True


def etude_materiel_onaf(conn, schema_path):
    """Étape V3.08 : ajoute la colonne « onaf » (OUI / NON : une puissance ONAF existe-t-elle ?) à la base matériel
    des transformateurs ; vide = OUI. Sans effet si déjà faite ou si la colonne existe."""
    if deja_faite(conn, ETAPE_MATERIEL_ONAF):
        return False
    if "onaf" not in _colonnes(conn, "etude_mat_transfos"):
        conn.execute("ALTER TABLE etude_mat_transfos ADD COLUMN onaf TEXT")
    marquer_faite(conn, ETAPE_MATERIEL_ONAF)
    conn.commit()
    return True


def etude_materiel_protections(conn, schema_path):
    """Étape V3.11 : crée les tables des protections BT (constructeurs, disjoncteurs, déclencheurs, associations,
    réglages). Aucune valeur de départ : les données arrivent par import Excel. Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_MATERIEL_PROTECTIONS):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    for table in TABLES_PROTECTIONS:
        if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
            conn.execute(_ddl(schema_sql, table))
            for idx in _index_ddl(schema_sql, table):
                conn.execute(idx)
    marquer_faite(conn, ETAPE_MATERIEL_PROTECTIONS)
    conn.commit()
    return True


def etude_materiel_categorie(conn, schema_path):
    """Étape V3.12 : ajoute la colonne « categorie » aux disjoncteurs de la base matériel (catégorie de protection
    choisie à l'écran après le constructeur). Sans effet si déjà faite ou si la colonne existe."""
    if deja_faite(conn, ETAPE_PROTECTIONS_CATEGORIE):
        return False
    if "categorie" not in _colonnes(conn, "etude_mat_disjoncteurs"):
        conn.execute("ALTER TABLE etude_mat_disjoncteurs ADD COLUMN categorie TEXT")
    marquer_faite(conn, ETAPE_PROTECTIONS_CATEGORIE)
    conn.commit()
    return True


def etude_cables_bt(conn, schema_path):
    """Étape V3.13 : crée la table du catalogue des câbles BT (sans données : import Excel). Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_CABLES_BT):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_bt_cables"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_CABLES_BT)
    conn.commit()
    return True


def etude_circuits_bt(conn, schema_path):
    """Étape V3.14 : crée la table des circuits BT (saisie du sous-menu Calcul). Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_CIRCUITS_BT):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_bt_circuits"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_CIRCUITS_BT)
    conn.commit()
    return True


def etude_liens_caneco(conn, schema_path):
    """Étape V3.15 : crée la table des liens Caneco <-> catalogues. Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_LIENS_CANECO):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_bt_liens_caneco"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_LIENS_CANECO)
    conn.commit()
    return True


def etude_liens_variante(conn, schema_path):
    """Étape V3.16 : colonne « variante » (pouvoir de coupure) des liens Caneco. Sans effet si déjà faite ou si la table n'existe pas encore."""
    if deja_faite(conn, ETAPE_LIENS_VARIANTE):
        return False
    cols = [r[1] for r in conn.execute("PRAGMA table_info(etude_bt_liens_caneco)").fetchall()]
    if cols and "variante" not in cols:
        conn.execute("ALTER TABLE etude_bt_liens_caneco ADD COLUMN variante TEXT")
    marquer_faite(conn, ETAPE_LIENS_VARIANTE)
    conn.commit()
    return True


def etude_decl_references(conn, schema_path):
    """Étape V3.19 : colonnes de détail des déclencheurs (série, In, plage Ir, seuil Im) pour « une référence par ligne ». Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_DECL_REFERENCES):
        return False
    cols = [r[1] for r in conn.execute("PRAGMA table_info(etude_mat_declencheurs)").fetchall()]
    if cols:
        for c, t in (("serie", "TEXT"), ("calibre_a", "REAL"), ("ir_min_a", "REAL"), ("ir_max_a", "REAL"), ("im_min_a", "REAL"), ("im_max_a", "REAL")):
            if c not in cols:
                conn.execute("ALTER TABLE etude_mat_declencheurs ADD COLUMN %s %s" % (c, t))
    marquer_faite(conn, ETAPE_DECL_REFERENCES)
    conn.commit()
    return True


def etude_symboles(conn, schema_path):
    """Étape V3.30 : crée la table de la bibliothèque de symboles. Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_SYMBOLES):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    table = "etude_symboles"
    if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        conn.execute(_ddl(schema_sql, table))
        for idx in _index_ddl(schema_sql, table):
            conn.execute(idx)
    marquer_faite(conn, ETAPE_SYMBOLES)
    conn.commit()
    return True


def etude_mat_docs(conn, schema_path):
    """Étape V3.36 : tables des fiches techniques et des courbes de déclenchement. Sans effet si déjà faite."""
    if deja_faite(conn, ETAPE_MAT_DOCS):
        return False
    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()
    for table in ("etude_mat_docs", "etude_mat_courbes"):
        if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
            conn.execute(_ddl(schema_sql, table))
            for idx in _index_ddl(schema_sql, table):
                conn.execute(idx)
    marquer_faite(conn, ETAPE_MAT_DOCS)
    conn.commit()
    return True


def schema_a_jour(conn):
    """Base dont le schéma vient d'être créé en entier (base neuve ou migration V2 -> V3) : toutes les étapes
    sont déjà incluses ; on enregistre seulement les étapes et on sème les listes."""
    marquer_faite(conn, ETAPE_LIVRABLES_DEVIS)
    marquer_faite(conn, ETAPE_ETUDE_ELEC)
    marquer_faite(conn, ETAPE_ETUDE_LISTE)
    marquer_faite(conn, ETAPE_ETUDE_BILAN)
    marquer_faite(conn, ETAPE_ETUDE_MATERIEL)
    marquer_faite(conn, ETAPE_MATERIEL_ONAF)
    marquer_faite(conn, ETAPE_MATERIEL_PROTECTIONS)
    marquer_faite(conn, ETAPE_PROTECTIONS_CATEGORIE)
    marquer_faite(conn, ETAPE_CABLES_BT)
    marquer_faite(conn, ETAPE_CIRCUITS_BT)
    marquer_faite(conn, ETAPE_LIENS_CANECO)
    marquer_faite(conn, ETAPE_LIENS_VARIANTE)
    marquer_faite(conn, ETAPE_DECL_REFERENCES)
    marquer_faite(conn, ETAPE_SYMBOLES)
    marquer_faite(conn, ETAPE_MAT_DOCS)
    semer_listes_etude(conn)
    semer_materiel(conn)


def appliquer(conn, schema_path, base_neuve):
    """Point d'entrée appelé par init_db(). Base neuve : le schéma complet est déjà à jour, on marque seulement
    les étapes comme faites."""
    if base_neuve:
        schema_a_jour(conn)
        conn.commit()
        return
    livrables_devis(conn, schema_path)
    etude_electrique(conn, schema_path)
    etude_liste(conn, schema_path)
    etude_bilan(conn, schema_path)
    etude_materiel(conn, schema_path)
    etude_materiel_onaf(conn, schema_path)
    etude_materiel_protections(conn, schema_path)
    etude_materiel_categorie(conn, schema_path)
    etude_cables_bt(conn, schema_path)
    etude_circuits_bt(conn, schema_path)
    etude_liens_caneco(conn, schema_path)
    etude_liens_variante(conn, schema_path)
    etude_decl_references(conn, schema_path)
    etude_symboles(conn, schema_path)
    etude_mat_docs(conn, schema_path)
