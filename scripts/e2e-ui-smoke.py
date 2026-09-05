import asyncio
import os

from playwright.async_api import async_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8080/restaurantes").rstrip("/")
BROWSER = os.environ.get("BROWSER", "chromium")
SIMULATE_CHUNK_FAILURE = os.environ.get("SIMULATE_CHUNK_FAILURE") == "1"


async def main() -> None:
    async with async_playwright() as playwright:
        browser_type = getattr(playwright, BROWSER, None)
        if browser_type is None:
            raise ValueError(f"Navegador Playwright no soportado: {BROWSER}")
        browser = await browser_type.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        page_errors: list[str] = []
        console_errors: list[str] = []

        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )

        if SIMULATE_CHUNK_FAILURE:
            await page.route("**/assets/SuperAdminDashboard-*.js", lambda route: route.abort())
            await page.goto(f"{BASE_URL}/admin/superadmin", wait_until="domcontentloaded")
            recovery = page.get_by_role("alert")
            await recovery.wait_for(timeout=15_000)
            assert "No se pudo cargar el panel" in await recovery.inner_text()
            await browser.close()
            return

        await page.goto(f"{BASE_URL}/admin/login", wait_until="networkidle")
        await page.get_by_placeholder("tu@correo.com").wait_for()
        assert await page.get_by_role("button", name="Continuar con Google").is_visible()
        assert await page.get_by_role("button", name="Continuar con correo").is_visible()

        # Public hosting aliases must converge to the official software URL.
        for legacy_origin in filter(None, os.environ.get("LEGACY_ORIGINS", "").split(",")):
            await page.goto(
                f"{legacy_origin.rstrip('/')}/restaurantes/admin/login?qa=canonical",
                wait_until="networkidle",
            )
            await page.get_by_placeholder("tu@correo.com").wait_for()
            assert page.url == f"{BASE_URL}/admin/login?qa=canonical", page.url

        # Vite preview requires the base's trailing slash. Vercel additionally
        # serves the slashless entry through its hosting rewrite.
        entries = (BASE_URL, BASE_URL + "/") if os.environ.get("HOST_ROUTING") == "1" else (BASE_URL + "/",)
        for entry in entries:
            await page.goto(entry, wait_until="networkidle")
            await page.get_by_placeholder("tu@correo.com").wait_for()
            assert "/restaurantes/admin/login" in page.url, page.url

        terms_link = page.get_by_role("link", name="Términos de Servicio")
        assert await terms_link.get_attribute("href") == "/restaurantes/terminos"
        await terms_link.click()
        assert "/restaurantes/terminos" in page.url

        for path, heading in (
            ("/terminos", "Términos"),
            ("/privacidad", "Privacidad"),
        ):
            await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
            body = await page.locator("body").inner_text()
            assert heading.lower() in body.lower(), f"Falta contenido legal en {path}"

        await page.goto(f"{BASE_URL}/ruta-inexistente", wait_until="networkidle")
        assert "404" in await page.locator("body").inner_text()

        assert not page_errors, f"Errores de página: {page_errors}"
        assert not console_errors, f"Errores de consola: {console_errors}"
        await browser.close()


asyncio.run(main())
