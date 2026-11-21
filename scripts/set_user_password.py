#!/usr/bin/env python3
"""
Script de maintenance (V1.55) : definit l'email et le mot de passe d'un
utilisateur existant, directement en base, sans passer par le reseau.

A quoi ca sert : avant la V1.55, les comptes de cette application
n'avaient ni email ni mot de passe reel (juste un nom et un code PIN
decoratif, voir claude/architecture-cloud-securite.md). Une fois la V1.55
installee, l'authentification devient obligatoire pour TOUTE l'API - donc
si vous mettez a jour une installation existante qui a deja des
utilisateurs, aucun d'entre eux ne peut plus se connecter tant que son
email et son mot de passe n'ont pas ete definis. Ce script sert
exactement a debloquer cette situation une premiere fois (ensuite, un
administrateur connecte peut gerer les comptes normalement depuis
Parametres > Utilisateurs, dans l'application).

Pour une INSTALLATION TOUTE NEUVE (aucun utilisateur encore cree), ce
script n'est pas necessaire : l'assistant de premier demarrage de
l'application cree directement le premier compte administrateur avec un
email et un mot de passe.

Usage (depuis le dossier de l'application) :

    python3 scripts/set_user_password.py --list
    python3 scripts/set_user_password.py --nom "Admin Test" --email admin@exemple.com --password "un-mot-de-passe-solide"

Pour une base PostgreSQL (hebergement cloud), definir DATABASE_URL avant
d'appeler ce script, exactement comme pour le serveur lui-meme :

    DATABASE_URL=postgresql://... python3 scripts/set_user_password.py --list
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import auth as authmod
from backend import db as dbmod


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="Liste les utilisateurs existants (nom, role, email actuel)")
    parser.add_argument("--nom", help="Nom exact de l'utilisateur a mettre a jour (voir --list)")
    parser.add_argument("--email", help="Nouvel email de connexion")
    parser.add_argument("--password", help="Nouveau mot de passe")
    args = parser.parse_args()

    dbmod.init_db()

    if args.list or not (args.nom and args.email and args.password):
        users = authmod._all_users()
        if not users:
            print("Aucun utilisateur en base - utilisez l'assistant de premier demarrage de l'application.")
            return
        print("Utilisateurs existants :")
        for u in users:
            print("  - nom=%r role=%r email=%r actif=%r" % (
                u.get("nom"), u.get("role"), u.get("email") or "(aucun)", u.get("actif", True)))
        if not (args.nom and args.email and args.password):
            print("\nPrecisez --nom, --email et --password pour definir les identifiants d'un utilisateur.")
        return

    matches = [u for u in authmod._all_users() if u.get("nom") == args.nom]
    if not matches:
        print("ERREUR : aucun utilisateur nomme %r (utilisez --list pour voir les noms exacts)." % args.nom)
        sys.exit(1)
    if len(matches) > 1:
        print("ERREUR : plusieurs utilisateurs portent ce nom, ce script ne sait pas lequel choisir.")
        sys.exit(1)
    user = matches[0]

    existing_email_user = authmod.find_user_by_email(args.email)
    if existing_email_user and existing_email_user["id"] != user["id"]:
        print("ERREUR : cet email est deja utilise par un autre utilisateur (%r)." % existing_email_user.get("nom"))
        sys.exit(1)

    conn = dbmod.get_connection()
    import json
    current = dict(user)
    current.pop("id", None)
    current["email"] = args.email
    current["passwordHash"] = authmod.hash_password(args.password)
    current.pop("pin", None)
    payload = json.dumps(current, ensure_ascii=False)
    conn.execute(
        "UPDATE documents SET data=? WHERE collection='users' AND id=?",
        (payload, user["id"]),
    )
    conn.commit()
    conn.close()
    print("OK : %r peut maintenant se connecter avec l'email %s." % (args.nom, args.email))


if __name__ == "__main__":
    main()
