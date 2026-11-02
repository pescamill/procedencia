"""Descarga las fotos del reel desde Wikimedia Commons, con su autor y su licencia.

    python3 -I promo/imagenes.py   → promo/img/<id>.jpg y promo/img/creditos.json

Las de fichas del sitio salen de datos/medios_comprobados.json; las demás se nombran aquí. Las fotos no se
suben al repositorio: este script las vuelve a bajar.
"""

import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "promo/img"
UA = "ProcedenciaReel/1.0 (https://pescamill.github.io/procedencia)"
API = "https://commons.wikimedia.org/w/api.php"
# el Python de python.org no trae certificados: se usan los del sistema, como en procedencia.py
CTX = ssl.create_default_context(cafile="/etc/ssl/cert.pem") if Path("/etc/ssl/cert.pem").exists() else ssl.create_default_context()

# id del reel → ficha del sitio (usa su imagen comprobada) o archivo de Commons
DEL_SITIO = ["cacao-chocolate", "aguacate", "jitomate", "calabaza", "frijol", "nopal", "guajolote", "papaya",
             "chia", "cacahuate", "guayaba", "nixtamalizacion", "chinampas", "milpa", "algodon"]
EXTRA = {
    "maiz": "Multicolored glass gem corn.jpg",
    "cempasuchil": "Tagetes erecta Antigua Orange 2zz.jpg",
    "chile": "Bowl of jalapeños.jpg",
    "aji": "Aji Amarillo pepper.jpg",
    "vainilla": "Vanilla 6beans.JPG",
    # reel «Un mundo sin México»: lo que desaparecería, y el teocintle junto al maíz
    "pizza": "Margherita Originale.JPG",
    "kimchi": "Korean cuisine-Kimchi-08.jpg",
    "mezclilla": "Close-Up of Denim Jeans.jpg",
    "palomitas": "Popcorn in a bowl.jpg",
    "zucchini": "Zucchini in basket 2021 G1.jpg",
    "chocolate-suizo": "Swiss Chocolate.jpg",
    "teocintle": "Maize-teosinte.jpg",
}


def pedir(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        return r.read()


def info(archivo):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + archivo, "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1100})
    pag = next(iter(json.loads(pedir(f"{API}?{q}"))["query"]["pages"].values()))
    ii = pag["imageinfo"][0]
    m = ii["extmetadata"]
    limpio = lambda k: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.get(k, {}).get("value", ""))).strip()
    return {"archivo": archivo, "url": ii["thumburl"], "pagina": ii["descriptionurl"],
            "autor": re.sub(r"^Photo by ", "", limpio("Artist")) or "Autor desconocido", "licencia": limpio("LicenseShortName")}


def main():
    medios = json.loads((RAIZ / "datos/medios_comprobados.json").read_text())
    pedidos = {i: medios[i]["imagen"]["archivo"] for i in DEL_SITIO} | EXTRA
    SALIDA.mkdir(exist_ok=True)
    creditos = {}
    for rid, archivo in pedidos.items():
        c = info(archivo)
        destino = SALIDA / f"{rid}.jpg"
        if not destino.exists():
            destino.write_bytes(pedir(c["url"]))
            time.sleep(0.5)
        creditos[rid] = c
        print(f"{rid:16} {c['licencia']:14} {c['autor'][:50]}")
    (SALIDA / "creditos.json").write_text(json.dumps(creditos, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
