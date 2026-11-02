"""Genera promo/reel-datos.js: golpes de la canción, mapa de México, fichas y créditos de las fotos del reel.

    ../pleno/.venv/bin/python promo/datos_reel.py
"""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PROMO = RAIZ / "promo"
FICHAS = ["cacao-chocolate", "aguacate", "maiz", "cempasuchil", "chile", "vainilla", "calabaza", "frijol", "jitomate",
          "nopal", "guajolote", "papaya", "chia", "cacahuate",
          # reel «Un mundo sin México» (reel-mundo.html)
          "nixtamalizacion", "algodon", "milpa", "chinampas", "agricultura-independiente", "presa-purron", "camellones-mayas",
          # las del reel anterior (reel-v1.html)
          "cero", "hule", "barbasco-pildora", "television-color", "guayaba"]


def main():
    beats = json.loads((PROMO / "beats.json").read_text())
    golpes = json.loads((PROMO / "golpes.json").read_text())
    geo = json.loads((RAIZ / "datos/geo/mexico.json").read_text())
    creditos = json.loads((PROMO / "img/creditos.json").read_text())
    fichas = {}
    for archivo in (RAIZ / "datos/fichas").glob("*.json"):
        for f in json.loads(archivo.read_text()):
            if f["id"] in FICHAS:
                fichas[f["id"]] = {"coords": f["coords"], "region": f.get("region")}
    datos = {
        "beats": [round(b, 3) for b in beats["beats"]],
        "kicks": [t for t, _ in golpes["kicks"]],
        "geo": {k: geo[k] for k in ("lon0", "lat1", "k", "escala")} | {"regiones": geo["regiones"]},
        "fichas": fichas,
        "creditos": {k: {"autor": v["autor"], "licencia": v["licencia"]} for k, v in creditos.items()},
    }
    (PROMO / "reel-datos.js").write_text("window.REEL = " + json.dumps(datos, ensure_ascii=False) + ";\n")
    print(len(datos["kicks"]), "bombos ·", len(fichas), "fichas ·", len(creditos), "fotos")


if __name__ == "__main__":
    main()
