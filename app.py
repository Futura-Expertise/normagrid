import os

from flask import Flask, render_template

from backend.db import init_db, APP_VERSION, get_secret_key, is_postgres
from backend.routes.api import api
from backend.routes.auth import auth
from backend.routes.releve import releve
from backend.routes.facture_fournisseur import facture_fournisseur
from backend.routes.facture_client import facture_client
from backend.routes.commande_client import commande_client
from backend.routes.etude_docs import etude_docs
from backend.routes.devis_import import devis_import
from backend.routes.excel_io import excel_io
from backend.routes.livrables_import import livrables_import
from backend.routes.xlsx_tools import xlsx_tools
from backend.routes.etude_electrique import etude_electrique
from backend.routes.ouverture import ouverture
from backend.routes.db_admin import db_admin
from backend.routes.modules import modules_bp
from backend import access as accessmod

# PORT : fixe a 5001 par defaut (inchange, usage local), mais lisible depuis
# la variable d'environnement PORT si elle est definie - convention
# attendue par la plupart des hebergeurs cloud manages (V1.55, voir
# claude/architecture-cloud-securite.md), qui imposent eux-memes le port
# d'ecoute au demarrage du conteneur.
PORT = int(os.environ.get("PORT", 5001))

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0  # evite que le navigateur garde en cache un ancien JS/CSS
app.config["TEMPLATES_AUTO_RELOAD"] = True

# V1.55 : authentification reelle par session (voir backend/auth.py). La
# cle de signature est stable (voir get_secret_key) pour que les sessions
# survivent aux redemarrages. Le cookie n'est marque "Secure" (HTTPS
# uniquement) qu'en mode PostgreSQL/cloud : en local (SQLite, http://),
# l'exiger empecherait toute connexion.
app.config["SECRET_KEY"] = get_secret_key()
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = is_postgres() or os.environ.get("ERP_COOKIE_SECURE", "").strip() in ("1", "true")

app.register_blueprint(api)
app.register_blueprint(auth)
app.register_blueprint(releve)
app.register_blueprint(facture_fournisseur)
app.register_blueprint(facture_client)
app.register_blueprint(commande_client)
app.register_blueprint(devis_import)
app.register_blueprint(excel_io)
app.register_blueprint(livrables_import)
app.register_blueprint(xlsx_tools)
app.register_blueprint(etude_electrique)
app.register_blueprint(etude_docs)
app.register_blueprint(ouverture)
app.register_blueprint(db_admin)
app.register_blueprint(modules_bp)

# V1.55 : controle d'authentification et d'autorisation reellement applique
# a CHAQUE requete /api/*, quel que soit le blueprint - voir backend/access.py
# pour le detail de la politique (une seule porte d'entree, plus facile a
# auditer que des controles disperses dans chaque fichier de routes).
app.before_request(accessmod.enforce_request)


@app.get("/")
def index():
    return render_template("index.html", version=APP_VERSION)


if __name__ == "__main__":
    from backend.migration_v3 import MigrationRefusee
    try:
        init_db()
    except MigrationRefusee as e:
        print("\n=== DÉMARRAGE REFUSÉ : la reprise des anciennes données n'est pas complète ===\n")
        print(e)
        print("\nVotre ancienne base n'a pas été modifiée. Corrigez les points ci-dessus puis relancez.")
        raise SystemExit(1)
    print(f"=== Chantier ERP {APP_VERSION} ===")
    try:
        app.run(debug=True, host="0.0.0.0", port=PORT)
    except OSError as e:
        print(f"\nERREUR : le port {PORT} est deja utilise par un autre programme.")
        print("Fermez toute fenetre/terminal ou un ancien 'python app.py' tournerait encore,")
        print("puis relancez ce script.\n")
        raise e
