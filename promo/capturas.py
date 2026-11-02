"""Capturas del sitio publicado en tamaño de celular, para el reel.

    ../pleno/.venv/bin/python promo/capturas.py   → promo/capturas/*.png
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SITIO = "https://pescamill.github.io/procedencia/?lang=es"
PAGINAS = {"inicio": "#/", "maiz": "#/ficha/maiz", "fuentes": "#/fuentes", "despojo": "#/despojo"}


def main():
    out = HERE / "capturas"
    out.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome")
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="light")
        page = ctx.new_page()
        for nombre, ruta in PAGINAS.items():
            page.goto(SITIO + ruta)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1200)
            page.screenshot(path=str(out / f"{nombre}.png"), full_page=True)
            print(nombre, page.title())
        browser.close()


if __name__ == "__main__":
    main()
