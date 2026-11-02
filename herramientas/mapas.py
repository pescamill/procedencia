"""Convierte las regiones botánicas TDWG (WGSRPD, nivel 3) en trazos SVG locales.

Se corre una vez; el sitio no hace peticiones a servicios de mapas.

    python3 -I herramientas/mapas.py ruta/a/level3.geojson

Salida: datos/geo/mundo.json (proyección Equal Earth) y datos/geo/mexico.json
(equirectangular ajustada a 23° N, recortada a México y Centroamérica).
Cada archivo trae el ancho y alto del lienzo, el trazo de cada región por su
código TDWG, su centro aproximado y los parámetros para proyectar un punto
(lat, lon) en el navegador con la misma fórmula.
"""

import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Equal Earth (Šavrič, Patterson y Jenny, 2018)
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def equal_earth(lon, lat):
    l = math.radians(lon)
    p = math.radians(lat)
    t = math.asin(M * math.sin(p))
    t2 = t * t
    t6 = t2 * t2 * t2
    x = l * math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x, y


def dp(puntos, tol):
    """Douglas-Peucker iterativo."""
    if len(puntos) < 3:
        return puntos
    conservar = [False] * len(puntos)
    conservar[0] = conservar[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = puntos[a]
        bx, by = puntos[b]
        dx, dy = bx - ax, by - ay
        largo = math.hypot(dx, dy)
        peor, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = puntos[i]
            if largo:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / largo
            else:  # anillo cerrado: los extremos coinciden
                d = math.hypot(px - ax, py - ay)
            if d > peor:
                peor, idx = d, i
        if peor > tol and idx > 0:
            conservar[idx] = True
            pila.append((a, idx))
            pila.append((idx, b))
    return [p for p, c in zip(puntos, conservar) if c]


def anillos(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def construir(features, proyectar, ancho, tol, min_area, filtro=None, recorte=None):
    trazos, centros = {}, {}
    for f in features:
        cod = f["properties"]["LEVEL3_COD"]
        if filtro and not filtro(cod):
            continue
        partes = []
        sx = sy = sa = 0.0
        for poligono in anillos(f["geometry"]):
            for k, anillo in enumerate(poligono):
                if k > 0:
                    continue  # se omiten huecos: no cambian la lectura a esta escala
                pts = [proyectar(lon, lat) for lon, lat in anillo]
                if recorte:
                    x0, y0, x1, y1 = recorte
                    if all(not (x0 - 40 <= x <= x1 + 40 and y0 - 40 <= y <= y1 + 40) for x, y in pts):
                        continue
                pts = dp(pts, tol)
                if len(pts) < 4:
                    continue
                area = 0.0
                cx = cy = 0.0
                for (x1_, y1_), (x2_, y2_) in zip(pts, pts[1:] + pts[:1]):
                    c = x1_ * y2_ - x2_ * y1_
                    area += c
                    cx += (x1_ + x2_) * c
                    cy += (y1_ + y2_) * c
                area /= 2
                if abs(area) < min_area:
                    continue
                if area:
                    sx += cx / (6 * area) * abs(area)
                    sy += cy / (6 * area) * abs(area)
                    sa += abs(area)
                partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
        if partes:
            trazos[cod] = "".join(partes)
            if sa:
                centros[cod] = [round(sx / sa, 1), round(sy / sa, 1)]
    return trazos, centros


def main(ruta):
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    features = datos["features"]
    nombres = {f["properties"]["LEVEL3_COD"]: f["properties"]["LEVEL3_NAM"] for f in features}

    # Mundo
    xmax, _ = equal_earth(180, 0)
    _, ymax = equal_earth(0, 90)
    ancho = 1000.0
    escala = ancho / (2 * xmax)
    alto = 2 * ymax * escala

    def p_mundo(lon, lat):
        x, y = equal_earth(lon, lat)
        return (x + xmax) * escala, (ymax - y) * escala

    trazos, centros = construir(features, p_mundo, ancho, tol=0.9, min_area=1.5,
                                filtro=lambda c: c != "ANT")
    mundo = {
        "proyeccion": "equal-earth", "ancho": ancho, "alto": round(alto, 1),
        "escala": escala, "xmax": xmax, "ymax": ymax,
        "regiones": trazos, "centros": centros, "nombres": nombres,
        "fuente": "TDWG World Geographical Scheme for Recording Plant Distributions, nivel 3 (Brummitt, 2001)",
    }

    # México y Centroamérica
    lon0, lon1, lat0, lat1 = -118.6, -82.4, 12.6, 33.2
    k = math.cos(math.radians(23))
    ancho_mx = 1000.0
    esc = ancho_mx / ((lon1 - lon0) * k)
    alto_mx = (lat1 - lat0) * esc

    def p_mx(lon, lat):
        return (lon - lon0) * k * esc, (lat1 - lat) * esc

    trazos_mx, centros_mx = construir(features, p_mx, ancho_mx, tol=0.6, min_area=4,
                                      recorte=(0, 0, ancho_mx, alto_mx))
    mexico = {
        "proyeccion": "equirectangular", "ancho": ancho_mx, "alto": round(alto_mx, 1),
        "lon0": lon0, "lat1": lat1, "k": k, "escala": esc,
        "regiones": trazos_mx, "centros": centros_mx,
        "nombres": {c: nombres[c] for c in trazos_mx},
        "fuente": mundo["fuente"],
    }

    destino = RAIZ / "datos" / "geo"
    destino.mkdir(parents=True, exist_ok=True)
    for nombre, obj in (("mundo", mundo), ("mexico", mexico)):
        (destino / f"{nombre}.json").write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(nombre, len(obj["regiones"]), "regiones,", round((destino / f"{nombre}.json").stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main(sys.argv[1])
