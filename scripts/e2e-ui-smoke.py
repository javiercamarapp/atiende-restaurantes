import asyncio
import os

from playwright.async_api import async_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8080").rstrip("/")


async def main() -> None:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
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

        await page.goto(f"{BASE_URL}/admin/login", wait_until="networkidle")
        await page.get_by_placeholder("tu@correo.com").wait_for()
        assert await page.get_by_role("button", name="Continuar con Google").is_visible()
        assert await page.get_by_role("button", name="Continuar con correo").is_visible()

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
