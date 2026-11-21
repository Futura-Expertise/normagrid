"""
Test de fumee rapide (pas la suite complete NormaGrid) : verifie via un
navigateur pilote que le parcours de base fonctionne de bout en bout sur la
version Flask/SQLite de Chantier ERP :
  1. Creation du premier compte administrateur
  2. Creation d'un client
  3. Creation d'un devis (numerotation automatique DEV-<annee>-0001)
  4. Rechargement de la page -> les donnees persistent bien en SQLite
"""
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5001"


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(BASE_URL, wait_until="networkidle")

        # 1. Premier compte admin
        page.wait_for_selector("#first-user-form", timeout=10000)
        page.fill("#fu-nom", "Karim Alaoui")
        page.click("#first-user-form button[type=submit]")
        page.wait_for_selector(".sidebar", timeout=10000)
        print("OK: compte admin cree et connecte")

        # 2. Nouveau client
        page.click("[data-nav=clients]")
        page.wait_for_selector("#btn-new-client")
        page.click("#btn-new-client")
        page.wait_for_selector("#cf-nom")
        page.fill("#cf-nom", "SARL Batiment Atlas")
        page.fill("#cf-ville", "Casablanca")
        page.click("#cf-save")
        page.wait_for_selector(".toast.success")
        page.wait_for_timeout(2500)  # laisser le polling (2s) rafraichir la liste
        assert "Batiment Atlas" in page.content(), "client absent de la liste apres creation"
        print("OK: client cree")

        # 3. Nouveau devis
        page.click("[data-nav=devis]")
        page.wait_for_selector("#btn-new-devis")
        page.click("#btn-new-devis")
        page.wait_for_selector("#df-client")
        page.select_option("#df-client", label="SARL Batiment Atlas")
        page.fill("#df-objet", "Travaux de gros oeuvre - Test E2E")
        page.fill('[data-f="designation"][data-i="0"]', "Beton arme")
        page.fill('[data-f="qte"][data-i="0"]', "10")
        page.fill('[data-f="pu"][data-i="0"]', "1500")
        page.click("#df-save")
        page.wait_for_selector(".toast.success")
        page.wait_for_timeout(2500)
        content = page.content()
        assert "DEV-" in content, "numero de devis absent (numerotation automatique)"
        print("OK: devis cree avec numerotation automatique")

        # 4. Rechargement -> persistance SQLite
        page.reload(wait_until="networkidle")
        page.wait_for_selector(".picker-users, .sidebar", timeout=10000)
        if page.query_selector(".picker-user"):
            page.click(".picker-user")
        page.wait_for_selector(".sidebar", timeout=10000)
        page.click("[data-nav=devis]")
        page.wait_for_timeout(800)
        content2 = page.content()
        assert "DEV-" in content2 and "Batiment Atlas" in content2, "les donnees n'ont pas persiste apres rechargement"
        print("OK: donnees persistees apres rechargement de page (SQLite)")

        browser.close()
        print("\nTOUS LES TESTS DE FUMEE ONT REUSSI")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"\nECHEC: {e}", file=sys.stderr)
        sys.exit(1)
