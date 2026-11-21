#!/usr/bin/env python3
"""
Migration unique (V1.55) : copie toutes les donnees du fichier SQLite local
vers une base PostgreSQL, en vue d'un hebergement cloud. Voir
claude/architecture-cloud-securite.md pour la demarche complete.

A lancer UNE SEULE FOIS, depuis le poste qui a la base SQLite locale
actuelle, avant de basculer le serveur sur la variable d'environnement
DATABASE_URL. Le fichier SQLite n'est jamais modifie (lecture seule) : en
cas de probleme, on peut recommencer sans rien avoir perdu.

Usage (depuis le dossier de l'application) :

    python3 scripts/migrate_sqlite_to_postgres.py \\
        --postgres-url postgresql://utilisateur:motdepasse@hote:5432/nom_base

Par defaut, lit le fichier SQLite a l'emplacement configure localement
(celui que l'application utilise actuellement). Pour indiquer un autre
fichier explicitement :

    python3 scripts/migrate_sqlite_to_postgres.py --sqlite-file /chemin/vers/chantier_erp_V1.55.db --postgres-url ...

Le script est idempotent par ecrasement : relance sur une base Postgres
deja migree, il met simplement a jour chaque document avec le contenu du
fichier SQLite (pas de doublon cree), ce qui permet de refaire une
migration finale juste avant la bascule sans se soucier d'un essai
anterieur.
"""

import argparse
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
except ImportError:
    print("ERREUR : psycopg2 n'est pas installe. Lancez : pip install psycopg2-binary")
    sys.exit(1)

from backend import db as dbmod


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite-file", default=None, help="Chemin du fichier SQLite source (par defaut : celui configure localement)")
    parser.add_argument("--postgres-url", required=True, help="URL de connexion PostgreSQL de destination")
    parser.add_argument("--dry-run", action="store_true", help="Compte les documents sans rien ecrire sur Postgres")
    args = parser.parse_args()

    sqlite_path = args.sqlite_file or dbmod.get_db_path()
    if not os.path.exists(sqlite_path):
        print("ERREUR : fichier SQLite introuvable : %s" % sqlite_path)
        sys.exit(1)
    print("Source SQLite : %s" % sqlite_path)

    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row
    rows = src.execute("SELECT collection, id, data, created_at, updated_at FROM documents ORDER BY rowid").fetchall()
    src.close()
    print("Documents trouves : %d" % len(rows))

    by_collection = {}
    for r in rows:
        by_collection[r["collection"]] = by_collection.get(r["collection"], 0) + 1
    for coll, count in sorted(by_collection.items()):
        print("  - %-28s %5d document(s)" % (coll, count))

    if args.dry_run:
        print("\n(dry-run : rien ecrit sur PostgreSQL)")
        return

    dest = psycopg2.connect(args.postgres_url)
    cur = dest.cursor()
    cur.execute(open(dbmod.SCHEMA_PATH, "r", encoding="utf-8").read())
    dest.commit()

    inserted, updated = 0, 0
    for r in rows:
        cur.execute("SELECT 1 FROM documents WHERE collection=%s AND id=%s", (r["collection"], r["id"]))
        exists = cur.fetchone() is not None
        if exists:
            cur.execute(
                "UPDATE documents SET data=%s, updated_at=%s WHERE collection=%s AND id=%s",
                (r["data"], r["updated_at"], r["collection"], r["id"]),
            )
            updated += 1
        else:
            cur.execute(
                "INSERT INTO documents (collection, id, data, created_at, updated_at) VALUES (%s,%s,%s,%s,%s)",
                (r["collection"], r["id"], r["data"], r["created_at"], r["updated_at"]),
            )
            inserted += 1
    dest.commit()
    dest.close()

    print("\nOK : %d document(s) insere(s), %d mis a jour." % (inserted, updated))
    print("Pensez a relancer le serveur avec DATABASE_URL=%s pour qu'il utilise desormais PostgreSQL." % args.postgres_url)


if __name__ == "__main__":
    main()
