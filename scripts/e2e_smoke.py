"""Browser smoke with no authentication, provider calls or external writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(f"{BASE}/admin/login")
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="Bienvenido a atiende").wait_for()
    page.get_by_role("link", name="Términos de Servicio").wait_for()
    page.screenshot(path=str(Path("/private/tmp/atiende-e2e-login.png")), full_page=True)

    page.goto(f"{BASE}/terminos")
    page.wait_for_load_state("networkidle")
    page.get_by_text("Términos de Servicio para restaurantes").wait_for()

    page.goto(f"{BASE}/privacidad")
    page.wait_for_load_state("networkidle")
    page.get_by_text("Aviso de Privacidad de atiende.ai").wait_for()

    page.goto(f"{BASE}/ruta-inexistente")
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="404").wait_for()

    browser.close()
    unexpected = [error for error in errors if "404 Error" not in error]
    if unexpected:
        raise AssertionError(f"browser page errors: {unexpected}")
    print("browser smoke: login, legal pages and 404 passed")
