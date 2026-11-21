# -*- coding: utf-8 -*-
"""Reprise automatique d'une base JSON (V2.x, table « documents ») vers la base relationnelle V3.

Règles : la base source n'est jamais modifiée ni supprimée ; la migration est écrite dans un fichier
temporaire, vérifiée document par document, puis renommée atomiquement. Au moindre écart la base V3
n'est PAS créée et l'application refuse de démarrer avec un rapport explicite."""
import datetime
import glob
import os
import shutil
import sqlite3

from backend import sql_migration as sm

RAPPORT_COURANT = "dernier_rapport_migration.txt"


class MigrationRefusee(Exception):
    pass


def est_base_json(path):
    try:
        c = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        try:
            names = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            c.close()
        return "documents" in names and "utilisateurs" not in names
    except Exception:
        return False


def est_base_v3(path):
    try:
        c = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        try:
            return c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='utilisateurs'").fetchone() is not None
        finally:
            c.close()
    except Exception:
        return False


def trouver_source(data_dir, cible):
    """Base JSON la plus récente du dossier de données (hors cible), ou None."""
    cands = [p for p in glob.glob(os.path.join(data_dir, "chantier_erp_V*.db"))
             if os.path.abspath(p) != os.path.abspath(cible) and est_base_json(p)]
    cands.sort(key=os.path.getmtime, reverse=True)
    return cands[0] if cands else None


def rapport_texte(src_path, dst_path, rap, ver):
    L = ["RAPPORT DE MIGRATION JSON -> SQL", "Date   : %s" % datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
         "Source : %s (non modifiée)" % os.path.basename(src_path), "Cible  : %s" % os.path.basename(dst_path), ""]
    total = sum(n for _, n in rap["migres"].values())
    done = sum(o for o, _ in rap["migres"].values())
    L.append("Documents migrés : %d / %d" % (done, total))
    for c, (o, n) in rap["migres"].items():
        L.append("  %-26s %5d / %d%s" % (c, o, n, "" if o == n else "   <-- INCOMPLET"))
    for c, (n, why) in rap["ignores"].items():
        L.append("Ignoré : %s (%d documents) — %s" % (c, n, why))
    for c, n in rap["inconnus"].items():
        L.append("COLLECTION INCONNUE NON MIGRÉE : %s (%d documents)" % (c, n))
    L += ["", "Erreurs de migration : %d" % len(rap["erreurs"])]
    for c, i, m in rap["erreurs"]:
        L.append("  %s / %s : %s" % (c, i, m))
    L += ["", "Vérification (JSON reconstitué comparé à l'original) : %d identiques, %d écarts, %d absents"
          % (ver["ok"], len(ver["ecarts"]), len(ver["absents"]))]
    for c, i, fat in ver["ecarts"]:
        L.append("  ÉCART %s / %s : %s" % (c, i, fat[:5]))
    for c, i in ver["absents"]:
        L.append("  ABSENT %s / %s" % (c, i))
    parfait = (not rap["erreurs"] and not ver["ecarts"] and not ver["absents"]
               and not rap["inconnus"] and done == total)
    L += ["", "RÉSULTAT : " + ("MIGRATION COMPLÈTE ET VÉRIFIÉE" if parfait
                              else "À CORRIGER — la base V3 n'a pas été créée")]
    return "\n".join(L), parfait


def migrer_fichier(src_path, cible, schema_path):
    """Migre src_path vers cible. Renvoie le texte du rapport ; lève MigrationRefusee si non parfait."""
    data_dir = os.path.dirname(os.path.abspath(cible))
    tmp = cible + ".migration.tmp"
    for p in (tmp, tmp + "-journal"):
        if os.path.exists(p):
            os.remove(p)
    src = sqlite3.connect("file:%s?mode=ro" % src_path, uri=True)
    dst = sqlite3.connect(tmp)
    try:
        dst.execute("PRAGMA foreign_keys=ON")
        with open(schema_path, encoding="utf-8") as f:
            dst.executescript(f.read())
        rap = sm.migrer(src, dst)
        dst.commit()
        ver = sm.verifier(src, dst)
        # Le schema complet vient d'etre applique : on enregistre les etapes de mise a niveau comme faites et on seme
        # les listes de l'etude electrique APRES la verification (ces lignes n'existent pas dans la base V2).
        from backend import schema_upgrades
        schema_upgrades.schema_a_jour(dst)
        dst.commit()
        txt, parfait = rapport_texte(src_path, cible, rap, ver)
    except Exception as e:
        txt, parfait = "RAPPORT DE MIGRATION JSON -> SQL\nERREUR INATTENDUE : %s\n\nRÉSULTAT : À CORRIGER" % e, False
    finally:
        src.close()
        dst.close()
    horodatage = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    for nom in (RAPPORT_COURANT, "rapport_migration_%s.txt" % horodatage):
        with open(os.path.join(data_dir, nom), "w", encoding="utf-8") as f:
            f.write(txt + "\n")
    if not parfait:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise MigrationRefusee(txt)
    os.replace(tmp, cible)
    return txt


def preparer(cible, schema_path):
    """Appelé avant toute ouverture de la base : si une base JSON doit être reprise, la migre.
    Renvoie True si une migration a eu lieu."""
    data_dir = os.path.dirname(os.path.abspath(cible))
    if os.path.exists(cible):
        if est_base_v3(cible):
            return False
        if est_base_json(cible):  # ex. fichier V2.x adopté sous le nom V3.00 : on le range puis on le migre
            sauvegarde = cible + ".avant_migration_V3.bak"
            if os.path.exists(sauvegarde):
                sauvegarde = cible + ".avant_migration_V3_%s.bak" % datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            shutil.move(cible, sauvegarde)
            try:
                migrer_fichier(sauvegarde, cible, schema_path)
            except MigrationRefusee:
                shutil.move(sauvegarde, cible)  # rien n'est perdu : on remet le fichier d'origine
                raise
            return True
        if os.path.getsize(cible) == 0:
            return False  # fichier vide : init_db créera le schéma
        raise MigrationRefusee("Le fichier %s existe mais n'est reconnu ni comme base V2 (JSON) ni comme base V3."
                               % os.path.basename(cible))
    src = trouver_source(data_dir, cible)
    if src:
        migrer_fichier(src, cible, schema_path)
        return True
    # Mise a jour entre deux versions V3 : la base V3 precedente la plus recente est COPIEE sous le
    # nom de la nouvelle version (l'ancienne reste intacte).
    precedentes = [p for p in glob.glob(os.path.join(data_dir, "chantier_erp_V[3-9]*.db"))
                   if os.path.abspath(p) != os.path.abspath(cible) and est_base_v3(p)]
    if precedentes:
        precedentes.sort(key=os.path.getmtime, reverse=True)
        shutil.copy2(precedentes[0], cible)
        return True
    return False


def nettoyer_extra_factures(conn):
    """Retire de factures.extra les restes vides cmdId/cmdNumero (notion de commande supprimée).
    Idempotent ; une valeur réellement renseignée est conservée."""
    import json
    n = 0
    for fid, extra in conn.execute("SELECT id, extra FROM factures WHERE extra IS NOT NULL AND extra <> ''").fetchall():
        try:
            j = json.loads(extra)
        except Exception:
            continue
        reste = {k: v for k, v in j.items() if not (k in ("cmdId", "cmdNumero") and v in (None, ""))}
        if len(reste) != len(j):
            conn.execute("UPDATE factures SET extra=? WHERE id=?",
                         (json.dumps(reste, ensure_ascii=False) if reste else None, fid))
            n += 1
    return n
