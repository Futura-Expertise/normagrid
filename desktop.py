"""
Point d'entree "application de bureau" : lance Flask en arriere-plan et
affiche l'interface dans une fenetre native (pywebview) au lieu d'un onglet
de navigateur.

Chantier ERP n'a pas besoin de boites de dialogue natives (pas de choix de
dossier/fichier cote serveur : l'import CSV des clients se fait entierement
cote navigateur via <input type="file">), donc contrairement a NormaGrid,
aucun pont js_api n'est necessaire ici.
"""

import threading
import time
import webbrowser

from app import app, APP_VERSION, PORT
from backend.db import init_db

HOST = "127.0.0.1"
URL = f"http://{HOST}:{PORT}"


def _run_flask():
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)


def _fallback_browser_mode():
    """
    Repli automatique : si la fenetre native pywebview ne peut pas s'ouvrir
    (bibliotheque manquante, runtime .NET absent/incompatible sur certains PC
    Windows ARM64, etc.), on ouvre simplement l'application dans le
    navigateur par defaut a la place, et on garde le serveur Flask actif.
    """
    print()
    print("ATTENTION : la fenetre d'application native n'a pas pu s'ouvrir sur")
    print("ce PC (bibliotheque graphique manquante ou incompatible).")
    print("Chantier ERP continue de fonctionner normalement : ouverture")
    print(f"automatique dans votre navigateur par defaut ({URL})...")
    print()
    print("Vous pouvez fermer cette fenetre noire (cmd) pour quitter")
    print("l'application une fois que vous avez fini de travailler.")
    print()
    try:
        webbrowser.open(URL)
    except Exception:
        print(f"Ouvrez manuellement votre navigateur a l'adresse : {URL}")

    # Le serveur Flask tourne dans le thread demarre plus haut : on attend
    # simplement qu'il se termine (c-a-d qu'on ne fait rien de plus ici, la
    # fenetre cmd reste ouverte et sert de "bouton pour quitter").
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    from backend.migration_v3 import MigrationRefusee
    try:
        init_db()
    except MigrationRefusee as e:
        print("\n=== DÉMARRAGE REFUSÉ : la reprise des anciennes données n'est pas complète ===\n")
        print(e)
        print("\nVotre ancienne base n'a pas été modifiée. Corrigez les points ci-dessus puis relancez.")
        raise SystemExit(1)
    print(f"=== Chantier ERP {APP_VERSION} (application de bureau) ===")

    flask_thread = threading.Thread(target=_run_flask, daemon=True)
    flask_thread.start()
    time.sleep(0.5)  # laisser Flask demarrer avant d'ouvrir la fenetre/le navigateur

    try:
        import webview

        webview.create_window(
            f"Chantier ERP {APP_VERSION}",
            URL,
            width=1440,
            height=920,
            min_size=(1100, 700),
        )
        webview.start()
    except Exception as e:
        print(f"[Info] Fenetre native indisponible ({e}).")
        _fallback_browser_mode()
