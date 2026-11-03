"""Procedencia: verificador y constructor.

    python3 procedencia.py verificar     # reglas del sistema; sale con error si alguna falla
    python3 procedencia.py comprobar     # red: DOIs en Crossref, URLs, distribución en WCVP
    python3 procedencia.py comprobar --nuevas   # solo las fuentes sin comprobar
    python3 procedencia.py medios        # red: imagen de Commons y alcance en Wikipedia
    python3 procedencia.py traducir      # datos/traducciones/en.json: textos nuevos y pendientes
    python3 procedencia.py construir     # sitio/datos.js, sitio/datos-en.js, reportes/estado.md y las páginas para compartir

Solo usa la biblioteca estándar. `comprobar` y `medios` salen a la red y guardan lo que encontraron en
datos/comprobaciones.json, datos/wcvp/ y datos/medios_comprobados.json. `construir` pinta las tarjetas para
compartir con Chrome sin ventana, y solo baja de Commons las fotos de dominio público de las tarjetas que cambiaron.
"""

import concurrent.futures
import datetime as dt
import copy
import difflib
import hashlib
import html
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "datos"
SITIO = RAIZ / "sitio"
AGENTE = "procedencia-verificador/1.0 (+https://github.com/pescamill/procedencia)"

# Regiones TDWG de México y de la Mesoamérica que no es México
TDWG_MEXICO = {"MXC", "MXE", "MXG", "MXI", "MXN", "MXS", "MXT"}
TDWG_MESOAMERICA = TDWG_MEXICO | {"GUA", "BLZ", "HON", "ELS", "NIC", "COS"}
CAJAS = {  # lat_min, lat_max, lon_min, lon_max
    "mexico": (14.3, 33.0, -118.5, -86.5),
    "mesoamerica": (8.0, 26.5, -106.0, -82.0),
}


def leer(nombre):
    return json.loads((DATOS / nombre).read_text(encoding="utf-8"))


def cargar():
    cat = leer("catalogo.json")
    fichas = []
    for archivo in sorted((DATOS / "fichas").glob("*.json")):
        fichas.extend(json.loads(archivo.read_text(encoding="utf-8")))
    fuentes = leer("fuentes.json")
    casos = leer("casos.json")
    recorridos = leer("recorridos.json")
    ruta = DATOS / "comprobaciones.json"
    comprobaciones = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}
    wcvp = {}
    for archivo in (DATOS / "wcvp").glob("*.json"):
        d = json.loads(archivo.read_text(encoding="utf-8"))
        wcvp[d["especie"]] = d
    return cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp


def extras():
    """Pueblos, diagramas e imágenes comprobadas: datos que acompañan a las fichas."""
    ruta = DATOS / "medios_comprobados.json"
    medios = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}
    diagramas = {k: v for k, v in leer("diagramas.json").items() if not k.startswith("_")}
    return leer("pueblos.json"), diagramas, medios


def cuenta():
    """La sección «Lo que aún se niega»: una narrativa en actos con frases marcadas con su fuente."""
    ruta = DATOS / "cuenta.json"
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {"capitulos": []}


MARCA = re.compile(r"\[\[([^|\]]+)\|([^\]]+)\]\]")


def fuentes_de_datos(cap):
    """Fuentes de un acto: las de sus frases marcadas [[frase|id,id]] y las de su lámina, cita, mapa y gráficas."""
    ids = []
    def recorrer(x, clave=None):
        if isinstance(x, dict):
            for k, v in x.items():
                recorrer(v, k)
        elif isinstance(x, list):
            for v in x:
                recorrer(v, clave)
        elif isinstance(x, str):
            if clave == "fuentes":
                ids.append(x)
            else:
                for _, fs in MARCA.findall(x):
                    ids.extend(i.strip() for i in fs.split(","))
    recorrer(cap)
    return list(dict.fromkeys(ids))


# ---------------------------------------------------------------- verificar

def afirmaciones_de(obj):
    """Todas las afirmaciones de una ficha o un caso, con su lugar."""
    if "veredicto" in obj:
        yield "veredicto", obj["veredicto"]
    for i, a in enumerate(obj.get("afirmaciones", [])):
        yield f"afirmaciones[{i}]", a
    for i, n in enumerate(obj.get("nombres_mundo", [])):
        if "fuentes" in n:
            yield f"nombres_mundo[{i}]", n
    exp = obj.get("expediente") or {}
    for i, c in enumerate(exp.get("contrapuntos", [])):
        yield f"expediente.contrapuntos[{i}]", c
    if exp.get("comparacion"):
        yield "expediente.comparacion", exp["comparacion"]
    for i, o in enumerate(obj.get("originales", [])):
        if o.get("fuentes"):
            yield f"originales[{i}]", o
    for i, c in enumerate(obj.get("aclaraciones", [])):
        yield f"aclaraciones[{i}]", c


def verificar(cat, fichas, fuentes, casos, recorridos, wcvp=None):
    errores, avisos = [], []
    ids = lambda clave: {x["id"] for x in cat[clave]}
    validos = {
        "ambito": ids("ambitos"), "naturaleza": ids("naturalezas"), "clase": ids("clases"),
        "territorio": ids("territorios"), "epoca": ids("epocas"),
    }
    actos, solidez, lineas = ids("actos"), ids("solidez"), ids("lineas_evidencia")
    borrado, tipos_caso, estados = ids("borrado"), ids("tipos_caso"), ids("estados_caso")
    tipos_fuente = ids("tipos_fuente")
    id_fuentes = [f["id"] for f in fuentes]
    conjunto_fuentes = set(id_fuentes)
    usadas = set()
    pueblos, diagramas, medios = extras()
    alcances = {x["id"] for x in cat["alcance"]}
    id_pueblos = {p["id"] for p in pueblos}

    # Principio 2: cada ámbito declara su pregunta y su frontera, para que no se confunda con otro
    for a in cat["ambitos"]:
        for campo in ("pregunta", "incluye", "excluye"):
            if not a.get(campo):
                errores.append(f"ámbito {a['id']}: falta «{campo}»")

    # Principio 1: una cosa, una ficha
    vistos = {}
    for obj in fichas + casos:
        if obj["id"] in vistos:
            errores.append(f"{obj['id']}: id repetido")
        vistos[obj["id"]] = obj
    nombres = {}
    for f in fichas:
        clave = pliegue(f["nombre"])
        if clave in nombres:
            errores.append(f"{f['id']}: mismo nombre que {nombres[clave]} (una cosa, una ficha)")
        nombres[clave] = f["id"]
    for fid in set(id_fuentes):
        if id_fuentes.count(fid) > 1:
            errores.append(f"fuente {fid}: id repetido")

    # Principio 2: un eje, una pregunta; cada valor en su catálogo
    for f in fichas:
        for eje, valores in validos.items():
            if f.get(eje) not in valores:
                errores.append(f"{f['id']}: {eje} «{f.get(eje)}» no está en el catálogo")
        for a in f.get("actos", []):
            if a not in actos:
                errores.append(f"{f['id']}: acto «{a}» no está en el catálogo")
        if len(set(f.get("actos", []))) != len(f.get("actos", [])):
            errores.append(f"{f['id']}: actos repetidos")
        if f.get("clase") == "aporte" and not f.get("actos"):
            errores.append(f"{f['id']}: un aporte necesita al menos un acto")
        if "nativo" in f.get("actos", []) and f.get("naturaleza") not in ("planta", "animal", "hongo") and not f.get("especie"):
            errores.append(f"{f['id']}: «nativo» solo aplica a seres vivos")
        if "domesticado" in f.get("actos", []) and f.get("naturaleza") in ("saber", "obra", "lengua"):
            errores.append(f"{f['id']}: «domesticado» no aplica a {f['naturaleza']}")
        lat, lon = f.get("coords", [None, None])
        caja = CAJAS.get(f.get("territorio"))
        fuera = f.get("clase") == "deslinde" or ("nombrado" in f.get("actos", []) and "origen_biologico" in f)
        if caja and lat is not None and not fuera and not (caja[0] <= lat <= caja[1] and caja[2] <= lon <= caja[3]):
            errores.append(f"{f['id']}: coordenadas {lat},{lon} fuera de {f['territorio']}")
        for n in f.get("nombres_mundo", []):
            if n.get("forma") not in borrado:
                errores.append(f"{f['id']}: forma de borrado «{n.get('forma')}» no está en el catálogo")
        if f.get("alcance") not in alcances:
            errores.append(f"{f['id']}: alcance «{f.get('alcance')}» no está en el catálogo")
        if not (f.get("en_breve") or "").strip():
            errores.append(f"{f['id']}: falta «en_breve», la explicación para cualquier lector")
        # el sitio recorre estas listas sin comprobar que existan: vacías sí, ausentes no
        for lista in ("actos", "pueblos", "originales", "afirmaciones", "nombres_mundo", "pendientes", "relacionadas"):
            if not isinstance(f.get(lista), list):
                errores.append(f"{f['id']}: falta la lista «{lista}» (puede ir vacía)")
        if f.get("clase") == "aporte" and not f.get("originales") and not f.get("sin_originario"):
            errores.append(f"{f['id']}: un aporte lleva su nombre en lengua originaria o explica por qué no lo tiene")
        for p in f.get("pueblos", []):
            if p not in id_pueblos:
                errores.append(f"{f['id']}: pueblo «{p}» no existe en pueblos.json")
        img = (medios.get(f["id"]) or {}).get("imagen")
        if img:
            if not any(l in (img.get("licencia") or "").lower() for l in LICENCIAS_LIBRES):
                errores.append(f"{f['id']}: la imagen {img['archivo']} no tiene licencia libre ({img.get('licencia')})")
            if not img.get("autor"):
                avisos.append(f"{f['id']}: la imagen {img['archivo']} no declara autor")
        for r in f.get("relacionadas", []):
            if r not in vistos:
                errores.append(f"{f['id']}: relacionada «{r}» no existe")
        exp = f.get("expediente")
        if exp:
            comp = exp.get("comparacion") or {}
            for lado in ("aqui", "alla"):
                for l in comp.get("lineas", {}).get(lado, []):
                    if l not in lineas:
                        errores.append(f"{f['id']}: línea de evidencia «{l}» no existe")
            if not exp.get("contrapuntos"):
                errores.append(f"{f['id']}: un expediente responde al menos a un contrapunto")

    for c in casos:
        if c.get("tipo") not in tipos_caso:
            errores.append(f"{c['id']}: tipo de caso «{c.get('tipo')}» no está en el catálogo")
        if c.get("estado") not in estados:
            errores.append(f"{c['id']}: estado «{c.get('estado')}» no está en el catálogo")
        for fid in c.get("fichas", []):
            if fid not in vistos:
                errores.append(f"{c['id']}: ficha «{fid}» no existe")

    for p in pueblos:
        for h in p.get("heredan", []):
            if h not in id_pueblos:
                errores.append(f"pueblo {p['id']}: hereda a «{h}», que no existe")
    for fid, d in diagramas.items():
        if fid not in vistos:
            errores.append(f"diagrama {fid}: la ficha no existe")
        if not d.get("fuentes"):
            errores.append(f"diagrama {fid}: un diagrama resume afirmaciones con fuente")
        for x in d.get("fuentes", []) + (d.get("contraste") or {}).get("fuentes", []):
            usadas.add(x)
            if x not in conjunto_fuentes:
                errores.append(f"diagrama {fid}: fuente «{x}» no existe")

    for r in recorridos:
        for p in r["pasos"]:
            for clave in ("ficha", "caso"):
                if clave in p and p[clave] not in vistos:
                    errores.append(f"recorrido {r['id']}: {clave} «{p[clave]}» no existe")

    cta = cuenta()
    capitulos = cta["capitulos"]
    # La portada del relato: los puntos que sostiene, con frases marcadas como los actos.
    portada = {"id": "cuenta", "tesis": cta.get("tesis", [])}
    for p in [t["texto"] for t in cta.get("tesis", [])]:
        if p.count("[[") != len(MARCA.findall(p)) or p.count("]]") != p.count("[["):
            errores.append(f"cuenta: marca [[frase|fuentes]] mal cerrada: {p[:60]}")
    for x in fuentes_de_datos(portada):
        usadas.add(x)
        if x not in conjunto_fuentes:
            errores.append(f"cuenta: fuente «{x}» no existe")
    for cap in capitulos:
        if cap["id"] in vistos:
            errores.append(f"{cap['id']}: id repetido")
        for clave in ("texto", "fichas", "casos"):
            if not isinstance(cap.get(clave), list):
                errores.append(f"{cap['id']}: falta la lista «{clave}» (puede ir vacía)")
        for x in cap.get("fichas", []) + cap.get("casos", []):
            if x not in vistos:
                errores.append(f"{cap['id']}: «{x}» no existe")
        otros = (cap.get("flujo") or {}).get("nodos", []) + cap.get("linea", []) + (cap.get("censura") or {}).get("eventos", [])
        for p in cap.get("texto", []) + [n["texto"] for n in otros]:
            if p.count("[[") != len(MARCA.findall(p)) or p.count("]]") != p.count("[["):
                errores.append(f"{cap['id']}: marca [[frase|fuentes]] mal cerrada: {p[:60]}")
        lam = cap.get("lamina")
        if lam:
            if not (RAIZ / "sitio" / lam["archivo"]).exists():
                errores.append(f"{cap['id']}: la lámina «{lam['archivo']}» no está en sitio/")
            if not lam.get("commons") or not lam.get("licencia"):
                errores.append(f"{cap['id']}: la lámina necesita su ficha de Commons y su licencia")
        for x in fuentes_de_datos(cap):
            usadas.add(x)
            if x not in conjunto_fuentes:
                errores.append(f"{cap['id']}: fuente «{x}» no existe")

    # Principio 3: la afirmación es la unidad de verdad
    for obj in fichas + casos + recorridos + pueblos + capitulos:
        for lugar, a in afirmaciones_de(obj):
            if "solidez" in a and a["solidez"] not in solidez:
                errores.append(f"{obj['id']}.{lugar}: solidez «{a['solidez']}» no está en el catálogo")
            for fid in a.get("fuentes", []):
                usadas.add(fid)
                if fid not in conjunto_fuentes:
                    errores.append(f"{obj['id']}.{lugar}: fuente «{fid}» no existe")

    for f in fuentes:
        if f.get("tipo") not in tipos_fuente:
            errores.append(f"fuente {f['id']}: tipo «{f.get('tipo')}» no está en el catálogo")
        if not f.get("doi") and not f.get("url"):
            avisos.append(f"fuente {f['id']}: sin DOI ni URL; no puede comprobarse automáticamente")
        if f["id"] not in usadas:
            avisos.append(f"fuente {f['id']}: nadie la cita")
    for idioma, faltan in faltan_traducciones(cat, fichas, fuentes, casos, recorridos).items():
        if faltan:
            avisos.append(f"traducción '{idioma}': {len(faltan)} textos sin traducir; se muestran en español")

    # Contraste con la distribución nativa del WCVP
    for f in fichas:
        d = (wcvp or {}).get(f.get("especie"))
        if not d or "nativo" not in f.get("actos", []) or d.get("estado") != "ok":
            continue
        zona = TDWG_MEXICO if f["territorio"] == "mexico" else TDWG_MESOAMERICA
        if not set(d["nativa"]) & zona:
            errores.append(f"{f['id']}: dice «nativo» pero el WCVP no registra a {f['especie']} como nativa de {f['territorio']}")

    return errores, avisos


def pliegue(texto):
    texto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn").strip()


# ---------------------------------------------------------------- comprobar

def contexto_ssl():
    for cafile in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if Path(cafile).exists():
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


CTX = contexto_ssl()


def pedir(url, json_=True, intentos=5):
    ultimo = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=40, context=CTX) as r:
                cuerpo = r.read(400_000)
                return r.status, (json.loads(cuerpo) if json_ else cuerpo.decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            ultimo = e
            if e.code == 429 or e.code >= 500:
                time.sleep(2 * (i + 1))
                continue
            return e.code, None
        except Exception as e:  # red, tiempo de espera
            ultimo = e
            time.sleep(1 + i)
    return 0, str(ultimo)


def limpiar_titulo(t):
    t = re.sub(r"<[^>]+>", "", html.unescape(t))
    return " ".join(pliegue(t).replace("–", "-").split())


def comprobar_doi(f):
    estado, datos = pedir("https://api.crossref.org/works/" + urllib.parse.quote(f["doi"]))
    if estado != 200 or not isinstance(datos, dict):
        return {"metodo": "crossref", "resultado": "error", "detalle": f"Crossref respondió {estado}"}
    m = datos["message"]
    titulo = " ".join(m.get("title") or [""])
    anio = (m.get("issued", {}).get("date-parts") or [[None]])[0][0]
    parecido = difflib.SequenceMatcher(None, limpiar_titulo(titulo), limpiar_titulo(f["titulo"])).ratio()
    # El título citado puede abreviar el registrado: se acepta si uno contiene al otro.
    a, b = limpiar_titulo(titulo), limpiar_titulo(f["titulo"])
    if a.startswith(b[:40]) or b.startswith(a[:40]):
        parecido = max(parecido, 0.9)
    ok_anio = anio is None or abs(int(anio) - int(f["anio"])) <= 1
    resultado = "ok" if parecido >= 0.75 and ok_anio else "discrepancia"
    return {
        "metodo": "crossref", "resultado": resultado, "parecido": round(parecido, 2),
        "titulo_registrado": re.sub(r"<[^>]+>", "", html.unescape(titulo)).strip(), "anio_registrado": anio,
        "revista_registrada": (m.get("container-title") or [""])[0],
    }


def pedir_con_curl(url):
    """Segundo intento para servidores que no envían su cadena de certificados completa.

    curl usa los certificados del sistema y sigue verificándolos; solo se usa cuando Python no pudo."""
    if not shutil.which("curl"):
        return 0
    r = subprocess.run(["curl", "-sS", "-L", "-o", "/dev/null", "-w", "%{http_code}", "-A", AGENTE, "--max-time", "30", url],
                       capture_output=True, text=True)
    return int(r.stdout or 0) if r.returncode == 0 else 0


def comprobar_url(f):
    estado, cuerpo = pedir(f["url"], json_=False, intentos=2)
    if estado == 0 and "CERTIFICATE_VERIFY_FAILED" in str(cuerpo):
        codigo = pedir_con_curl(f["url"])
        if codigo == 200:
            return {"metodo": "http", "resultado": "ok", "codigo": 200,
                    "detalle": "Comprobada con curl: el servidor no envía su cadena de certificados completa."}
        if codigo in (401, 403):
            estado, cuerpo = codigo, ""
    if estado == 200 and isinstance(cuerpo, str):
        if "Just a moment" in cuerpo[:3000] or "challenge-platform" in cuerpo[:6000]:
            return {"metodo": "http", "resultado": "bloqueada", "detalle": "El sitio pide una prueba de navegador; no se comprueba automáticamente."}
        titulo = re.search(r"<title[^>]*>(.*?)</title>", cuerpo, re.S | re.I)
        return {"metodo": "http", "resultado": "ok", "codigo": 200,
                "titulo_pagina": " ".join(html.unescape(titulo.group(1)).split())[:160] if titulo else ""}
    if estado in (401, 403):
        return {"metodo": "http", "resultado": "bloqueada", "codigo": estado, "detalle": "El sitio rechaza a los programas; no se comprueba automáticamente."}
    return {"metodo": "http", "resultado": "error", "codigo": estado, "detalle": str(cuerpo)[:160] if estado == 0 else f"HTTP {estado}"}


WCVP = "f382f0ce-323a-4091-bb9f-add557f3a9a2"


def comprobar_especie(nombre):
    q = urllib.parse.urlencode({"datasetKey": WCVP, "q": nombre, "rank": "SPECIES", "limit": 20})
    estado, datos = pedir(f"https://api.gbif.org/v1/species/search?{q}")
    if estado != 200:
        return {"especie": nombre, "estado": "error", "detalle": f"GBIF respondió {estado}"}
    candidatos = [r for r in datos.get("results", []) if pliegue(r.get("canonicalName", "")) == pliegue(nombre)]
    if not candidatos:
        return {"especie": nombre, "estado": "sin_registro"}
    elegido = next((r for r in candidatos if r.get("taxonomicStatus") == "ACCEPTED"), candidatos[0])
    clave = elegido.get("acceptedKey") or elegido["key"]
    nativa, introducida, offset = set(), set(), 0
    while True:
        estado, d = pedir(f"https://api.gbif.org/v1/species/{clave}/distributions?limit=200&offset={offset}")
        if estado != 200:
            return {"especie": nombre, "estado": "error", "detalle": f"GBIF respondió {estado}"}
        for r in d.get("results", []):
            cod = (r.get("locationId") or "").replace("TDWG:", "")
            if not cod:
                continue
            medio = (r.get("establishmentMeans") or "NATIVE").upper()
            (introducida if medio == "INTRODUCED" else nativa).add(cod)
        if d.get("endOfRecords", True):
            break
        offset += 200
    return {
        "especie": nombre, "estado": "ok", "gbif": clave,
        "nombre_aceptado": elegido.get("accepted") or elegido.get("scientificName"),
        "url": f"https://www.gbif.org/species/{clave}",
        "nativa": sorted(nativa), "introducida": sorted(introducida - nativa),
    }


def comprobar(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp, solo_nuevas=False):
    hoy = dt.date.today().isoformat()
    nuevas = dict(comprobaciones) if solo_nuevas else {}
    for i, f in enumerate(fuentes, 1):
        if solo_nuevas and f["id"] in comprobaciones:
            continue
        if f.get("doi"):
            r = comprobar_doi(f)
        elif f.get("url"):
            r = comprobar_url(f)
        else:
            r = {"metodo": "ninguno", "resultado": "sin_enlace"}
        r["fecha"] = hoy
        nuevas[f["id"]] = r
        print(f"[{i}/{len(fuentes)}] {f['id']}: {r['resultado']}" + (f" ({r.get('parecido')})" if "parecido" in r else ""))
        time.sleep(0.25)
    (DATOS / "comprobaciones.json").write_text(json.dumps(nuevas, ensure_ascii=False, indent=1), encoding="utf-8")
    if solo_nuevas:
        return

    especies = sorted({f["especie"] for f in fichas if f.get("especie")})
    for nombre in especies:
        d = comprobar_especie(nombre)
        d["fecha"] = hoy
        (DATOS / "wcvp" / f"{pliegue(nombre).replace(' ', '-')}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"WCVP {nombre}: {d['estado']} · nativa en {len(d.get('nativa', []))} regiones, introducida en {len(d.get('introducida', []))}")
        time.sleep(0.25)


LICENCIAS_LIBRES = ("public domain", "pd", "cc0", "cc by", "cc-by", "cc by-sa", "cc-by-sa", "gfdl", "attribution")


def texto_plano(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def medios():
    """Imagen de Commons y alcance en Wikipedia de cada ficha (red)."""
    pedidos = {k: v for k, v in leer("medios.json").items() if not k.startswith("_")}
    api = "https://en.wikipedia.org/w/api.php?"
    titulos = sorted({v["wiki"] for v in pedidos.values()})
    pagina = {}
    for i in range(0, len(titulos), 40):
        q = urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "prop": "pageimages|pageprops",
                                    "piprop": "name", "ppprop": "wikibase_item", "titles": "|".join(titulos[i:i + 40])})
        _, d = pedir(api + q)
        d = d["query"]
        alias = {r["from"]: r["to"] for r in d.get("normalized", []) + d.get("redirects", [])}
        por_titulo = {p["title"]: p for p in d["pages"].values()}
        for t in titulos[i:i + 40]:
            destino = t
            while destino in alias:
                destino = alias[destino]
            p = por_titulo.get(destino, {})
            pagina[t] = {"titulo": destino, "imagen": p.get("pageimage"), "qid": p.get("pageprops", {}).get("wikibase_item")}
        time.sleep(0.5)

    qids = sorted({p["qid"] for p in pagina.values() if p["qid"]})
    enlaces = {}
    for i in range(0, len(qids), 40):
        q = urllib.parse.urlencode({"action": "wbgetentities", "format": "json", "props": "sitelinks", "ids": "|".join(qids[i:i + 40])})
        _, d = pedir("https://www.wikidata.org/w/api.php?" + q)
        for qid, e in d.get("entities", {}).items():
            enlaces[qid] = sum(1 for s in e.get("sitelinks", {}) if s.endswith("wiki") and s not in ("commonswiki", "specieswiki", "metawiki"))
        time.sleep(0.5)

    salida = {}
    hoy = dt.date.today().isoformat()
    for fid, v in pedidos.items():
        p = pagina[v["wiki"]]
        archivo = v.get("archivo", p["imagen"])
        r = {"wiki": p["titulo"], "qid": p["qid"], "wikipedias": enlaces.get(p["qid"]), "fecha": hoy}
        if archivo:
            q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata",
                                        "iiurlwidth": 900, "titles": "File:" + archivo.removeprefix("File:")})
            _, d = pedir("https://commons.wikimedia.org/w/api.php?" + q)
            info = (next(iter(d["query"]["pages"].values())).get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            r["imagen"] = {
                "archivo": archivo.removeprefix("File:"),
                "url": info.get("thumburl") or info.get("url"),
                "pagina": info.get("descriptionurl"),
                "autor": texto_plano(meta.get("Artist", {}).get("value")) or texto_plano(meta.get("Credit", {}).get("value")),
                "licencia": texto_plano(meta.get("LicenseShortName", {}).get("value")),
                "licencia_url": meta.get("LicenseUrl", {}).get("value"),
                "descripcion": texto_plano(meta.get("ImageDescription", {}).get("value"))[:300],
            }
            time.sleep(0.3)
        salida[fid] = r
        img = r.get("imagen") or {}
        print(f"{fid}: {r['wikipedias']} wikipedias · {img.get('archivo', 'sin imagen')} · {img.get('licencia', '')}")
    (DATOS / "medios_comprobados.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")


# ---------------------------------------------------------------- traducir

IDIOMAS = ("en",)
# Campos de texto que se traducen. Los identificadores, los nombres originarios ('forma'),
# los nombres que usa el mundo ('dice') y los títulos de las fuentes se quedan como están.
TRADUCIBLES = {
    "texto", "en_breve", "pendientes", "resumen", "nombre", "region", "entrada", "nota", "titulo",
    "lengua", "glosa", "sin_originario", "excluye", "incluye", "respuesta", "lugar", "reclamo",
    "institucion", "ciudad", "codice", "nombre_propio", "autoria", "periodo", "enfoque", "pendiente",
    "conclusion", "creencia", "objetivo", "nota_alcance", "regla_tradicion", "donde", "decia", "como",
    "marca", "por_que", "fecha_precio", "pie", "custodia", "quien", "subtitulo", "cap",
}
NO_SE_TRADUCEN = {"fuentes", "relacionadas", "pueblos", "fichas", "heredan", "aqui", "alla", "lineas"}


def clave_texto(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]


def es_traducible(clave, contenedor=None):
    # 'dice' es prosa en contrapuntos y erratas, pero en nombres_mundo es el nombre tal como lo dice el mundo.
    if clave == "dice":
        return contenedor != "nombres_mundo"
    return clave in TRADUCIBLES or clave.startswith("pregunta")


def textos(obj, clave=None, contenedor=None):
    """Cada texto traducible de un objeto, en orden."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.startswith("_") or k in NO_SE_TRADUCEN:
                continue
            yield from textos(v, k, clave)
    elif isinstance(obj, list):
        for v in obj:
            yield from textos(v, clave, contenedor)
    elif isinstance(obj, str) and clave and es_traducible(clave, contenedor) and obj.strip():
        yield obj


def traducido(obj, mapa, clave=None, contenedor=None):
    """Copia del objeto con cada texto traducible sustituido; lo que no tiene traducción queda en español."""
    if isinstance(obj, dict):
        return {k: (v if k.startswith("_") or k in NO_SE_TRADUCEN else traducido(v, mapa, k, clave)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [traducido(v, mapa, clave, contenedor) for v in obj]
    if isinstance(obj, str) and clave and es_traducible(clave, contenedor):
        return mapa.get(obj) or obj
    return obj


def contenido(cat, fichas, fuentes, casos, recorridos):
    pueblos, diagramas, _ = extras()
    notas = {f["id"]: {"nota": f["nota"]} for f in fuentes if f.get("nota")}
    return {"catalogo": cat, "fichas": fichas, "casos": casos, "recorridos": recorridos,
            "pueblos": pueblos, "diagramas": diagramas, "erratas": leer("erratas.json"), "notas_fuentes": notas,
            "cuenta": cuenta()}


def leer_traducciones(idioma):
    ruta = DATOS / "traducciones" / f"{idioma}.json"
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else {}


def mapa_traducciones(idioma):
    return {v["es"]: v[idioma] for k, v in leer_traducciones(idioma).items() if not k.startswith("_") and v.get(idioma)}


def faltan_traducciones(cat, fichas, fuentes, casos, recorridos):
    todos = {s for s in textos(list(contenido(cat, fichas, fuentes, casos, recorridos).values()))}
    return {i: sorted(todos - set(mapa_traducciones(i))) for i in IDIOMAS}


def traducir(cat, fichas, fuentes, casos, recorridos):
    """Pone al día datos/traducciones/<idioma>.json: agrega los textos nuevos y quita los que ya no existen.

    Cada entrada guarda el texto en español junto a su traducción. Si el español cambia, su clave cambia
    y la traducción vieja deja de aplicarse: el texto vuelve a aparecer como pendiente."""
    vistos = []
    for s in textos(list(contenido(cat, fichas, fuentes, casos, recorridos).values())):
        if s not in vistos:
            vistos.append(s)
    for idioma in IDIOMAS:
        viejo = leer_traducciones(idioma)
        nuevo = {"_nota": f"Traducción al '{idioma}'. Clave: los 10 primeros dígitos del SHA-1 del texto en español. "
                          f"'{idioma}': null significa pendiente. 'procedencia.py traducir' agrega y quita entradas."}
        for s in vistos:
            k = clave_texto(s)
            nuevo[k] = {"es": s, idioma: (viejo.get(k) or {}).get(idioma)}
        ruta = DATOS / "traducciones" / f"{idioma}.json"
        ruta.parent.mkdir(exist_ok=True)
        ruta.write_text(json.dumps(nuevo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        hechas = sum(1 for k, v in nuevo.items() if not k.startswith("_") and v.get(idioma))
        quitadas = sum(1 for k in viejo if not k.startswith("_") and k not in nuevo)
        print(f"{idioma}: {len(vistos)} textos, {hechas} traducidos, {len(vistos) - hechas} pendientes, {quitadas} ya no existían")


# ---------------------------------------------------------------- construir

def estado_fuente(fid, comprobaciones):
    return (comprobaciones.get(fid) or {}).get("resultado", "sin_comprobar")


def derivar(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp, pueblos=(), medios=None, capitulos=()):
    """Calcula verificación por afirmación, documentación por ficha y métricas."""
    medios = medios or {}
    def verif(a):
        fs = a.get("fuentes", [])
        if not fs:
            return "pendiente"
        return "comprobada" if all(estado_fuente(x, comprobaciones) == "ok" for x in fs) else "citada"

    total_af = {"pendiente": 0, "citada": 0, "comprobada": 0}
    for obj in fichas + casos + recorridos + list(pueblos) + list(capitulos):
        for lugar, a in afirmaciones_de(obj):
            a["verificacion"] = verif(a)
            if not lugar.startswith("originales"):
                total_af[a["verificacion"]] += 1
        if obj in fichas:
            m = medios.get(obj["id"]) or {}
            if m.get("imagen"):
                obj["imagen"] = m["imagen"]
            if m.get("wikipedias"):
                obj["wikipedias"] = m["wikipedias"]
                obj["wikidata"] = m.get("qid")
            if not obj["veredicto"].get("fuentes"):
                obj["documentacion"] = "inventario"
            elif obj.get("expediente"):
                obj["documentacion"] = "expediente"
            else:
                obj["documentacion"] = "ficha"
            d = wcvp.get(obj.get("especie"))
            if d and d.get("estado") == "ok":
                obj["distribucion"] = {k: d[k] for k in ("nativa", "introducida", "url", "nombre_aceptado", "fecha")}
            exp = obj.get("expediente") or {}
            comp = exp.get("comparacion")
            if comp:
                sostienen = {l["id"] for l in cat["lineas_evidencia"] if l["sostiene_tradicion"]}
                comp["tradicion"] = {lado: bool(set(comp["lineas"].get(lado, [])) & sostienen) for lado in ("aqui", "alla")}

    citas = {}
    for obj in fichas + casos + recorridos + list(pueblos) + list(capitulos):
        for _, a in afirmaciones_de(obj):
            for fid in a.get("fuentes", []):
                citas.setdefault(fid, set()).add(obj["id"])
    for cap in capitulos:
        for fid in fuentes_de_datos(cap):
            citas.setdefault(fid, set()).add(cap["id"])
    for f in fuentes:
        f["comprobacion"] = comprobaciones.get(f["id"], {"resultado": "sin_comprobar"})
        f["citada_por"] = sorted(citas.get(f["id"], []))

    por_resultado = {}
    for f in fuentes:
        r = f["comprobacion"]["resultado"]
        por_resultado[r] = por_resultado.get(r, 0) + 1
    metricas = {
        "fichas": len(fichas),
        "aportes": sum(f["clase"] == "aporte" for f in fichas),
        "deslindes": sum(f["clase"] == "deslinde" for f in fichas),
        "casos": len(casos),
        "recorridos": len(recorridos),
        "capitulos": len(capitulos),
        "fuentes": len(fuentes),
        "fuentes_por_resultado": por_resultado,
        "afirmaciones": total_af,
        "afirmaciones_total": sum(total_af.values()),
        "documentacion": {k: sum(f["documentacion"] == k for f in fichas) for k in ("inventario", "ficha", "expediente")},
        "pueblos": len(pueblos),
        "alcance": {x["id"]: sum(f.get("alcance") == x["id"] for f in fichas) for x in cat["alcance"]},
        "imagenes": sum(1 for f in fichas if f.get("imagen")),
        "nombres_originarios": sum(len(f.get("originales", [])) for f in fichas),
        "especies_wcvp": sum(1 for f in fichas if f.get("distribucion")),
        "fecha": dt.date.today().isoformat(),
    }
    return metricas


def construir(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp):
    errores, avisos = verificar(cat, fichas, fuentes, casos, recorridos, wcvp)
    if errores:
        print("No se construye: el verificador encontró errores.")
        for e in errores:
            print("  ✗", e)
        sys.exit(1)
    pueblos, diagramas, medios = extras()
    cta = cuenta()
    metricas = derivar(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp, pueblos, medios, cta["capitulos"])
    for fid, d in diagramas.items():
        for x in d.get("fuentes", []) + (d.get("contraste") or {}).get("fuentes", []):
            f = next(f for f in fuentes if f["id"] == x)
            if fid not in f["citada_por"]:
                f["citada_por"] = sorted(f["citada_por"] + [fid])
    geo = {n: json.loads((DATOS / "geo" / f"{n}.json").read_text(encoding="utf-8")) for n in ("mundo", "mexico")}
    paquete = {
        "catalogo": cat, "fichas": fichas, "casos": casos, "recorridos": recorridos,
        "fuentes": fuentes, "metricas": metricas, "avisos": avisos, "geo": geo,
        "erratas": leer("erratas.json"), "pueblos": pueblos, "diagramas": diagramas, "cuenta": cta,
    }
    js = "/* Generado por procedencia.py construir; no editar a mano. */\nwindow.PROCEDENCIA = " + json.dumps(paquete, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITIO / "datos.js").write_text(js, encoding="utf-8")
    por_idioma = {"es": paquete}
    for idioma in IDIOMAS:
        mapa = mapa_traducciones(idioma)
        partes = {k: paquete[k] for k in ("catalogo", "fichas", "casos", "recorridos", "erratas", "pueblos", "diagramas", "cuenta")}
        partes["notas_fuentes"] = {f["id"]: {"nota": f["nota"]} for f in fuentes if f.get("nota")}
        partes = {k: traducido(v, mapa) for k, v in partes.items()}
        js_i = (f"/* Generado por procedencia.py construir; no editar a mano. */\nwindow.PROCEDENCIA_{idioma.upper()} = "
                + json.dumps(partes, ensure_ascii=False, separators=(",", ":")) + ";\n")
        (SITIO / f"datos-{idioma}.js").write_text(js_i, encoding="utf-8")
        por_idioma[idioma] = {**paquete, **partes}
    abiertos = {k: v for k, v in paquete.items() if k not in ("geo", "avisos")}
    abiertos["licencia"] = "Textos y datos: CC BY 4.0. Imágenes: la licencia de cada una, en fichas[].imagen."
    (SITIO / "datos-abiertos.json").write_text(json.dumps(abiertos, ensure_ascii=False, indent=1), encoding="utf-8")
    escribir_reporte(cat, fichas, fuentes, casos, metricas, avisos)
    print(f"sitio/datos.js ({round(len(js.encode()) / 1024)} KB), sitio/datos-abiertos.json y reportes/estado.md")
    escribir_paginas(por_idioma)
    print(json.dumps(metricas, ensure_ascii=False, indent=1))


def escribir_reporte(cat, fichas, fuentes, casos, m, avisos):
    nombre = {x["id"]: x["nombre"] for x in cat["ambitos"]}
    L = [f"# Estado de la verificación · {m['fecha']}", "",
         "Generado por `python3 procedencia.py construir`. No se edita a mano.", "",
         "## Cifras", "",
         f"- Fichas: {m['fichas']} ({m['aportes']} aportes, {m['deslindes']} deslindes); casos: {m['casos']}; recorridos: {m['recorridos']}.",
         f"- Documentación: {m['documentacion']['expediente']} expedientes, {m['documentacion']['ficha']} fichas con fuente, {m['documentacion']['inventario']} en investigación.",
         f"- Afirmaciones: {m['afirmaciones_total']} — {m['afirmaciones']['comprobada']} con fuente comprobada, {m['afirmaciones']['citada']} citadas sin comprobar, {m['afirmaciones']['pendiente']} pendientes.",
         f"- Fuentes: {m['fuentes']} — " + ", ".join(f"{v} {k}" for k, v in sorted(m["fuentes_por_resultado"].items())) + ".",
         f"- Especies contrastadas con el WCVP: {m['especies_wcvp']}.", "",
         "## Fuentes que no coinciden con su registro", ""]
    malas = [f for f in fuentes if f["comprobacion"]["resultado"] in ("discrepancia", "error")]
    L += [f"- `{f['id']}`: {f['comprobacion']['resultado']} — {f['comprobacion'].get('titulo_registrado') or f['comprobacion'].get('detalle', '')}" for f in malas] or ["Ninguna."]
    L += ["", "## Pendientes por ficha", ""]
    for f in sorted(fichas, key=lambda x: (x["ambito"], x["nombre"])):
        sin = [a["texto"] for _, a in afirmaciones_de(f) if a.get("verificacion") == "pendiente" and "texto" in a]
        if f.get("pendientes") or sin:
            L.append(f"### {f['nombre']} ({nombre[f['ambito']]})")
            L += [f"- Sin fuente: {t}" for t in sin]
            L += [f"- {p}" for p in f.get("pendientes", [])]
            L.append("")
    L += ["## Avisos", ""] + [f"- {a}" for a in avisos]
    (RAIZ / "reportes" / "estado.md").write_text("\n".join(L) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- páginas para compartir

URL_SITIO = "https://pescamill.github.io/procedencia/"
AGENTE_IMAGENES = "ProcedenciaReel/1.0 (https://pescamill.github.io/procedencia)"
CACHE = RAIZ / ".cache"
COMPARTIR = SITIO / "compartir"
# Carpetas de sitio/ que escribe escribir_paginas: se borran y se vuelven a escribir en cada construcción.
GENERADAS = ("ficha", "caso", "pueblo", "recorrido", "cuenta", *IDIOMAS)
MARCA_SVG = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="{fondo}"/>'
             '<path d="M10 23c0-6.5 2.7-11.5 6-13 3.3 1.5 6 6.5 6 13" fill="none" stroke="{trazo}" stroke-width="2.4" stroke-linecap="round"/>'
             '<circle cx="16" cy="15.5" r="2.2" fill="{trazo}"/></svg>')


def sin_marcas(s):
    return MARCA.sub(r"\1", s or "").strip()


def recortar(s, tope):
    s = " ".join((s or "").split())
    return s if len(s) <= tope else s[:tope].rsplit(" ", 1)[0].rstrip(",;:—–") + "…"


def primera_frase(s, tope=150):
    """La primera oración, sin cortar en abreviaturas como «a. C.»."""
    s = sin_marcas(s)
    m = re.search(r"(?<![\s.]\w)[.!?](?=\s+[«“¿¡A-ZÁÉÍÓÚÑ])", s)
    return recortar(s[:m.end()] if m else s, tope)


def de_dominio_publico(img):
    return (img.get("licencia") or "").lower().startswith(("public domain", "cc0", "pd"))


def credito_foto(img, L):
    """Autor y licencia de la foto de una tarjeta; si Commons no da un autor legible, la fuente."""
    autor = recortar(re.sub(r"^No machine-readable author provided\.\s*", "", img.get("autor") or ""), 50)
    if pliegue(autor) in ("", "see above", "unknown", "desconocido"):
        autor = "Wikimedia Commons"
    lic = img.get("licencia") or ""
    lic = L("dominio público", "public domain") if lic.lower().startswith(("public domain", "pd")) else lic
    return f"{L('Imagen', 'Image')}: {autor} · {lic}"


def referencia(f):
    e = html.escape
    enlace = f"https://doi.org/{f['doi']}" if f.get("doi") else f.get("url")
    titulo = f'<a href="{e(enlace)}" rel="external">{e(f["titulo"])}</a>' if enlace else e(f["titulo"])
    return f"{e(f['autores'])} ({f['anio']}). {titulo}. <i>{e(f['publicacion'])}</i>."


def paginas_de(D, idioma):
    """Las páginas que se comparten, en un idioma: ruta, cabecera, resumen legible y tarjeta."""
    L = (lambda es, en: en) if idioma == "en" else (lambda es, en: es)
    pre = "" if idioma == "es" else f"{idioma}/"
    app = "#/" if idioma == "es" else f"?lang={idioma}#/"
    e = html.escape
    cat = D["catalogo"]
    fuente = {f["id"]: f for f in D["fuentes"]}
    ambito = {a["id"]: a for a in cat["ambitos"]}
    clase = {c["id"]: c["nombre"] for c in cat["clases"]}
    solidez = {s["id"]: s["nombre"] for s in cat["solidez"]}
    tipo_caso = {t["id"]: t for t in cat["tipos_caso"]}
    ficha = {f["id"]: f for f in D["fichas"]}
    caso = {c["id"]: c for c in D["casos"]}

    def citas():
        """citar(ids) devuelve la llamada [n]; lista() las fuentes citadas, en orden de aparición."""
        orden = []
        def citar(ids):
            ids = [x for x in ids if x in fuente]
            orden.extend(x for x in ids if x not in orden)
            return f" <sup>[{', '.join(str(orden.index(x) + 1) for x in ids)}]</sup>" if ids else ""
        def lista():
            refs = "".join(f"<li>{referencia(fuente[x])}</li>" for x in orden)
            return f"<h2>{L('Fuentes', 'Sources')}</h2><ol>{refs}</ol>" if orden else ""
        return citar, lista

    def con_citas(s, citar):
        """Texto con frases marcadas [[frase|fuentes]]: la frase queda y lleva su llamada."""
        partes, pos = [], 0
        for m in MARCA.finditer(s):
            partes += [e(s[pos:m.start()]), e(m.group(1)), citar([x.strip() for x in m.group(2).split(",")])]
            pos = m.end()
        return "".join(partes) + e(s[pos:])

    def afirmaciones(obj, citar):
        lis = "".join(f"<li>{e(sin_marcas(a['texto']))}{citar(a['fuentes']) if a.get('fuentes') else ' <span class=\"muted\">· ' + L('sin fuente todavía', 'no source yet') + '</span>'}</li>"
                      for a in obj.get("afirmaciones", []) if a.get("texto"))
        return f"<h2>{L('Lo que sostienen las fuentes', 'What the sources show')}</h2><ul>{lis}</ul>" if lis else ""

    def enlaces(titulo, items):
        lis = "".join(f'<li><a href="{pre}{tipo}/{x["id"]}/">{e(x.get("nombre") or x["titulo"])}</a></li>' for tipo, x in items)
        return f"<h2>{titulo}</h2><ul>{lis}</ul>" if lis else ""

    def abrir(ruta, texto):
        return f'<p><a class="btn" href="{app}{ruta}">{texto}</a></p>'

    paginas = []
    for f in D["fichas"]:
        citar, lista = citas()
        a, v, img = ambito[f["ambito"]], f["veredicto"], f.get("imagen") or {}
        o = (f.get("originales") or [None])[0]
        origs = "".join(f"<li><b>{e(x['forma'])}</b> ({e(x['lengua'])}){': ' + e(x['glosa']) if x.get('glosa') else ''}{citar(x.get('fuentes', []))}</li>"
                        for x in f.get("originales", []))
        cuerpo = (f'<p class="eyebrow">{e(a["nombre"])}</p><h1>{e(f["nombre"])}</h1>'
                  + (f"<p>{L('Su nombre originario', 'Its original name')}:</p><ul>{origs}</ul>" if origs else "")
                  + f'<p class="lede">{e(f["en_breve"])}</p>'
                  + f"<h2>{L('Veredicto', 'Verdict')}</h2><p>{e(v['texto'])}{citar(v.get('fuentes', []))} <span class=\"muted\">· {e(solidez.get(v.get('solidez'), ''))}</span></p>"
                  + afirmaciones(f, citar)
                  + enlaces(L("Véase también", "See also"), [("ficha" if r in ficha else "caso", ficha.get(r) or caso[r]) for r in f["relacionadas"]])
                  + lista() + abrir(f"ficha/{f['id']}", L("Abrir la ficha completa", "Open the full entry")))
        nombre_o = L(f"«{o['forma']}» en {o['lengua']}", f"“{o['forma']}” in {o['lengua']}") if o else ""
        paginas.append({
            "ruta": f"ficha/{f['id']}",
            "titulo": f"{f['nombre']}" + (f" ({o['forma']})" if o else "") + " · Procedencia",
            "og_titulo": f"{f['nombre']}: {nombre_o}" if o else f"{f['nombre']} · Procedencia",
            "descripcion": recortar(f["en_breve"], 200), "cuerpo": cuerpo,
            "tarjeta": {
                "cejilla": (f"{clase[f['clase']]} · " if f["clase"] == "deslinde" else "") + (o["lengua"] if o else a["nombre"]),
                "grande": o["forma"] if o else f["nombre"], "nombre": f["nombre"] if o else "",
                "linea": primera_frase(f["en_breve"]), "color": a["color"],
                "foto": img.get("url") if de_dominio_publico(img) else None,
                "credito": credito_foto(img, L) if de_dominio_publico(img) else "",
            },
        })

    for c in D["casos"]:
        citar, lista = citas()
        t = tipo_caso.get(c["tipo"], {})
        fecha = (c.get("fecha") or {}).get("texto", "")
        cuerpo = (f'<p class="eyebrow">{e(t.get("nombre", ""))} · {e(fecha)}</p><h1>{e(c["titulo"])}</h1>'
                  + f'<p class="lede">{e(c["resumen"])}</p>' + (f'<p class="muted">{e(c["lugar"])}</p>' if c.get("lugar") else "")
                  + afirmaciones(c, citar)
                  + enlaces(L("Fichas de este caso", "Entries in this case"), [("ficha", ficha[x]) for x in c.get("fichas", [])])
                  + lista() + abrir(f"caso/{c['id']}", L("Abrir el caso completo", "Open the full case")))
        paginas.append({
            "ruta": f"caso/{c['id']}", "titulo": f"{c['titulo']} · Procedencia", "og_titulo": c["titulo"],
            "descripcion": recortar(c["resumen"], 200), "cuerpo": cuerpo,
            "tarjeta": {"cejilla": f"{t.get('nombre', '')} · {fecha}", "grande": c["titulo"], "nombre": c.get("lugar", ""),
                        "linea": primera_frase(c["resumen"]), "color": t.get("color", "#812d37")},
        })

    for p in D["pueblos"]:
        citar, lista = citas()
        datos = [(L("Nombre propio", "Own name"), p.get("nombre_propio")), (L("Lengua", "Language"), p.get("lengua")),
                 (L("Región", "Region"), p.get("region")), (L("Periodo", "Period"), p.get("periodo"))]
        cuerpo = (f'<p class="eyebrow">{L("Pueblo", "People")}</p><h1>{e(p["nombre"])}</h1><p class="lede">{e(p["en_breve"])}</p>'
                  + "<ul>" + "".join(f"<li>{k}: {e(x)}</li>" for k, x in datos if x) + "</ul>"
                  + afirmaciones(p, citar)
                  + enlaces(L("Sus aportes", "Their contributions"), [("ficha", f) for f in D["fichas"] if p["id"] in f["pueblos"]])
                  + lista() + abrir(f"pueblo/{p['id']}", L("Abrir la página completa", "Open the full page")))
        propio = p.get("nombre_propio")
        paginas.append({
            "ruta": f"pueblo/{p['id']}", "titulo": f"{p['nombre']} · Procedencia",
            "og_titulo": f"{p['nombre']} ({propio})" if propio else p["nombre"],
            "descripcion": recortar(p["en_breve"], 200), "cuerpo": cuerpo,
            "tarjeta": {"cejilla": f"{L('Pueblo', 'People')} · {p.get('periodo', '')}", "grande": propio or p["nombre"],
                        "nombre": p["nombre"] if propio else p.get("lengua", ""), "linea": primera_frase(p["en_breve"]), "color": "#3d6252"},
        })

    for r in D["recorridos"]:
        citar, lista = citas()
        pasos = "".join(f'<li><a href="{pre}{"ficha" if "ficha" in x else "caso"}/{x.get("ficha") or x.get("caso")}/">'
                        f'{e((ficha.get(x.get("ficha")) or caso.get(x.get("caso")))["nombre" if "ficha" in x else "titulo"])}</a>: {e(x["texto"])}</li>'
                        for x in r["pasos"])
        cuerpo = (f'<p class="eyebrow">{L("Recorrido", "Journey")}</p><h1>{e(r["titulo"])}</h1><p class="lede">{e(r["entrada"])}</p>'
                  + f"<ol>{pasos}</ol>" + afirmaciones(r, citar) + lista()
                  + abrir(f"recorrido/{r['id']}", L("Hacer el recorrido", "Take the journey")))
        foto = next((ficha[x["ficha"]]["imagen"] for x in r["pasos"] if "ficha" in x and de_dominio_publico(ficha[x["ficha"]].get("imagen") or {})), {})
        paginas.append({
            "ruta": f"recorrido/{r['id']}", "titulo": f"{r['titulo']} · Procedencia", "og_titulo": r["titulo"],
            "descripcion": recortar(r["entrada"], 200), "cuerpo": cuerpo,
            "tarjeta": {"cejilla": f"{L('Recorrido', 'Journey')} · {len(r['pasos'])} {L('pasos', 'steps')}", "grande": r["titulo"],
                        "linea": primera_frase(r["entrada"]), "color": "#c99538", "foto": foto.get("url"),
                        "credito": credito_foto(foto, L) if foto else ""},
        })

    cu = D["cuenta"]
    citar, lista = citas()
    tesis = "".join(f"<li><b>{e(t['titulo'])}.</b> {con_citas(t['texto'], citar)}</li>" for t in cu.get("tesis", []))
    actos = "".join(f"<h2>{e(c['titulo'])}</h2><p class=\"muted\">{e(c.get('periodo', ''))}</p><p><i>{e(c.get('entrada', ''))}</i></p>"
                    + "".join(f"<p>{con_citas(x, citar)}</p>" for x in c["texto"]) for c in cu["capitulos"])
    lam = next(c["lamina"] for c in cu["capitulos"] if c.get("lamina"))
    paginas.append({
        "ruta": "cuenta", "titulo": f"{cu['titulo']} · Procedencia", "og_titulo": f"{cu['titulo']}: {cu.get('subtitulo', '')}",
        "descripcion": recortar(cu["entrada"], 200),
        "cuerpo": (f'<p class="eyebrow">{e(cu.get("subtitulo", ""))}</p><h1>{e(cu["titulo"])}</h1><p class="lede">{e(cu["entrada"])}</p>'
                   + f"<ul>{tesis}</ul>{actos}{lista()}" + abrir("cuenta", L("Leer el relato completo", "Read the full story"))),
        "tarjeta": {"cejilla": cu.get("subtitulo", ""), "grande": cu["titulo"], "linea": primera_frase(cu["entrada"]), "color": "#812d37",
                    "foto": str(SITIO / lam["archivo"]), "credito": f"{lam['codice']}, {lam['fecha']} · {L('dominio público', 'public domain')}"},
    })
    return paginas


def tarjeta_portada(D, idioma):
    L = (lambda es, en: en) if idioma == "en" else (lambda es, en: es)
    img = next(f for f in D["fichas"] if f["id"] == "maiz").get("imagen") or {}
    return {"cejilla": L("Aportes de México al mundo", "Mexico's gifts to the world"),
            "grande": L("Lo que el mundo recibió de México", "What the world got from Mexico"),
            "linea": L("Del maíz al cero: cada aporte con su nombre originario y cada afirmación con su fuente.",
                       "From maize to zero: each one with its Indigenous name, each claim with its source."),
            "color": "#c99538", "foto": img.get("url") if de_dominio_publico(img) else None,
            "credito": credito_foto(img, L) if de_dominio_publico(img) else ""}


def tarjeta_html(t, src):
    """La tarjeta de 1200×630: el nombre originario grande, el nombre de hoy, una frase y la marca."""
    e = html.escape
    grande = t["grande"]
    ancho = 530 if src else 960
    n = max(len(grande), 1)
    tam = min(150, int(ancho / (0.56 * n))) if n <= 14 else min(88, int(2 * ancho / (0.56 * n)))
    tam = max(tam, 54)
    foto = (f'<div class="foto"><img src="{e(src)}"></div>' if src else
            f'<div class="eco">{MARCA_SVG.format(fondo="none", trazo=t["color"])}</div>')
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,600,100;1,9..144,400,100&family=Inter:wght@400;500;600&display=block">
<style>
html,body{{margin:0;width:1200px;height:630px;overflow:hidden;background:#2b211a;color:#f6f0e2;font-family:Inter,sans-serif}}
.franja{{position:absolute;left:0;top:0;bottom:0;width:14px;background:{t['color']}}}
.foto{{position:absolute;top:0;right:0;bottom:0;width:600px}}
.foto img{{width:100%;height:100%;object-fit:cover}}
.foto::after{{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#2b211a 0%,rgba(43,33,26,.6) 18%,rgba(43,33,26,0) 50%)}}
.eco{{position:absolute;right:-90px;top:-40px;width:620px;height:620px;opacity:.16}}
.eco svg{{width:100%;height:100%}}
.texto{{position:absolute;left:78px;top:62px;bottom:52px;width:{ancho}px;display:flex;flex-direction:column}}
.cejilla{{font:600 21px/1.3 Inter;letter-spacing:.16em;text-transform:uppercase;color:#d9a84d}}
.grande{{font-family:Fraunces;font-weight:600;font-size:{tam}px;line-height:1.02;letter-spacing:-.02em;margin-top:22px;text-wrap:balance;overflow-wrap:anywhere}}
.nombre{{font:italic 400 46px/1.15 Fraunces;color:#eadba9;margin-top:14px}}
.linea{{font:400 27px/1.4 Inter;color:#dacfbd;margin-top:22px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}
.marca{{margin-top:auto;display:flex;align-items:center;gap:14px;font:600 30px Fraunces}}
.marca svg{{width:46px;height:46px}}
.marca span{{font:400 17px Inter;color:#a89a86;margin-left:6px;white-space:nowrap}}
.credito{{position:absolute;right:12px;bottom:12px;max-width:560px;padding:3px 8px;border-radius:4px;background:rgba(43,33,26,.72);font:400 14px Inter;color:rgba(246,240,226,.85)}}
</style></head><body>
{foto}<div class="franja"></div>
<div class="texto">
<div class="cejilla">{e(t.get('cejilla', ''))}</div>
<div class="grande">{e(grande)}</div>
{f'<div class="nombre">{e(t["nombre"])}</div>' if t.get('nombre') else ''}
<div class="linea">{e(t.get('linea', ''))}</div>
<div class="marca">{MARCA_SVG.format(fondo="#c99538", trazo="#2b211a")}Procedencia<span>pescamill.github.io/procedencia</span></div>
</div>
{f'<div class="credito">{e(t["credito"])}</div>' if t.get('credito') else ''}
</body></html>"""


def navegador():
    for c in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium", "google-chrome", "chromium", "chromium-browser"):
        if c and (Path(c).exists() or shutil.which(c)):
            return shutil.which(c) or c
    return None


def a_jpeg(png, jpg):
    if shutil.which("sips"):
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78", str(png), "--out", str(jpg)], capture_output=True)
    elif shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(png), "-q:v", "3", str(jpg)], capture_output=True)
    return jpg.exists()


def foto_local(foto):
    """La foto de la tarjeta como archivo local: las de Commons se bajan una vez a .cache/imagenes/."""
    if not foto.startswith("http"):
        return Path(foto)
    destino = CACHE / "imagenes" / (hashlib.sha1(foto.encode()).hexdigest()[:12] + (Path(urllib.parse.urlparse(foto).path).suffix.lower() or ".jpg"))
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(foto, headers={"User-Agent": AGENTE_IMAGENES})
        with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
            destino.write_bytes(r.read())
        time.sleep(0.3)
    return destino


def pintar_tarjeta(chrome, ruta, t, fotos):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        src = fotos.get(t.get("foto"))
        (tmp / "t.html").write_text(tarjeta_html(t, src.as_uri() if src else None), encoding="utf-8")
        subprocess.run([chrome, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
                        f"--user-data-dir={tmp / 'perfil'}", "--window-size=1200,630", "--virtual-time-budget=6000",
                        f"--screenshot={tmp / 't.png'}", (tmp / "t.html").as_uri()], capture_output=True, timeout=120)
        destino = SITIO / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        return (tmp / "t.png").exists() and a_jpeg(tmp / "t.png", destino)


def pintar_tarjetas(tarjetas):
    """Una imagen de 1200×630 por página, pintada con Chrome sin ventana. Solo se pinta la que cambió:
    sitio/compartir/huellas.json guarda la huella de cada tarjeta, que también va en la dirección de og:image."""
    ruta_huellas = COMPARTIR / "huellas.json"
    viejas = json.loads(ruta_huellas.read_text(encoding="utf-8")) if ruta_huellas.exists() else {}
    huellas, pendientes = {}, []
    for ruta, t in tarjetas.items():
        h = hashlib.sha1(tarjeta_html(t, t.get("foto")).encode("utf-8")).hexdigest()[:10]
        if viejas.get(ruta) == h and (SITIO / ruta).exists():
            huellas[ruta] = h
        else:
            pendientes.append((ruta, t, h))
    chrome = navegador()
    if pendientes and not (chrome and (shutil.which("sips") or shutil.which("ffmpeg"))):
        print(f"  · {len(pendientes)} tarjetas sin pintar: hace falta Chrome (o la variable CHROME) y sips o ffmpeg")
        huellas.update({r: viejas[r] for r, _, _ in pendientes if r in viejas and (SITIO / r).exists()})
    elif pendientes:
        fotos = {}
        for _, t, _ in pendientes:
            if t.get("foto") and t["foto"] not in fotos:
                try:
                    fotos[t["foto"]] = foto_local(t["foto"])
                except Exception as ex:  # sin red: la tarjeta sale sin foto
                    print(f"  · no se pudo bajar {t['foto']}: {ex}")
                    fotos[t["foto"]] = None
        with concurrent.futures.ThreadPoolExecutor(6) as hilos:
            hechas = hilos.map(lambda x: (x[0], x[2], pintar_tarjeta(chrome, x[0], x[1], fotos)), pendientes)
            for ruta, h, ok in hechas:
                if ok:
                    huellas[ruta] = h
                elif ruta in viejas and (SITIO / ruta).exists():
                    huellas[ruta] = viejas[ruta]
        print(f"{len(pendientes)} tarjetas pintadas en sitio/compartir/ ({sum(r in huellas for r, _, _ in pendientes)} bien)")
    for archivo in COMPARTIR.rglob("*.jpg"):
        if archivo.relative_to(SITIO).as_posix() not in tarjetas:
            archivo.unlink()
    COMPARTIR.mkdir(exist_ok=True)
    ruta_huellas.write_text(json.dumps(dict(sorted(huellas.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return huellas


def pagina_html(plantilla, p, idioma, imagen):
    """index.html con la cabecera, el idioma y el resumen de una página; la aplicación la toma al cargar."""
    e = html.escape
    pre = "" if idioma == "es" else f"{idioma}/"
    alternas = {i: f"{URL_SITIO}{'' if i == 'es' else i + '/'}{p['ruta']}/" for i in ("es", *IDIOMAS)}
    url = alternas[idioma]
    locale = {"es": "es_MX", "en": "en_US"}
    cabecera = "\n".join([
        f'<base href="{"../" * (pre + p["ruta"]).count("/")}../">',
        f"<title>{e(p['titulo'])}</title>",
        f'<meta name="description" content="{e(p["descripcion"])}">',
        f'<link rel="canonical" href="{url}">',
        *[f'<link rel="alternate" hreflang="{i}" href="{u}">' for i, u in alternas.items()],
        f'<link rel="alternate" hreflang="x-default" href="{alternas["en"]}">',
        '<meta property="og:type" content="article">',
        '<meta property="og:site_name" content="Procedencia">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:title" content="{e(p["og_titulo"])}">',
        f'<meta property="og:description" content="{e(p["descripcion"])}">',
        *([f'<meta property="og:image" content="{imagen}">', '<meta property="og:image:width" content="1200">',
           '<meta property="og:image:height" content="630">', f'<meta property="og:image:alt" content="{e(p["og_titulo"])}">'] if imagen else []),
        f'<meta property="og:locale" content="{locale[idioma]}">',
        *[f'<meta property="og:locale:alternate" content="{locale[i]}">' for i in alternas if i != idioma],
        '<meta name="twitter:card" content="summary_large_image">',
    ])
    cambios = [
        (r'<html lang="es">', lambda m: f'<html lang="{idioma}" data-ruta="/{p["ruta"]}">'),
        (r"<!-- cabecera:.*?<!-- /cabecera -->", lambda m: cabecera),
        (r'<main id="contenido" tabindex="-1"></main>',
         lambda m: f'<main id="contenido" tabindex="-1"><article class="wrap map-page" style="max-width:820px">{p["cuerpo"]}</article></main>'),
    ]
    for patron, nuevo in cambios:
        plantilla, n = re.subn(patron, nuevo, plantilla, count=1, flags=re.S)
        if n != 1:
            sys.exit(f"sitio/index.html ya no tiene «{patron}»: escribir_paginas no sabe dónde poner la página")
    if idioma != "es":  # la cabecera y el pie, ya en el idioma, para quien lee sin JavaScript
        plantilla = re.sub(r'(<[^>]*\sdata-en="([^"]*)"[^>]*>)[^<]*<', lambda m: m.group(1) + m.group(2) + "<", plantilla)
    return plantilla


def escribir_paginas(por_idioma):
    """Una página por ficha, caso, pueblo y recorrido, y la de «Lo que aún se niega», en cada idioma, con su
    tarjeta para compartir; además sitio/sitemap.xml y sitio/robots.txt."""
    plantilla = (SITIO / "index.html").read_text(encoding="utf-8")
    todas = {i: paginas_de(D, i) for i, D in por_idioma.items()}
    tarjetas = {}
    for idioma, paginas in todas.items():
        pre = "" if idioma == "es" else f"{idioma}/"
        tarjetas[f"compartir/{pre}procedencia.jpg"] = tarjeta_portada(por_idioma[idioma], idioma)
        tarjetas.update({f"compartir/{pre}{p['ruta']}.jpg": p["tarjeta"] for p in paginas})
    huellas = pintar_tarjetas(tarjetas)
    for d in GENERADAS:
        shutil.rmtree(SITIO / d, ignore_errors=True)
    for idioma, paginas in todas.items():
        pre = "" if idioma == "es" else f"{idioma}/"
        for p in paginas:
            img = next((x for x in (f"compartir/{pre}{p['ruta']}.jpg", f"compartir/{pre}procedencia.jpg") if x in huellas), None)
            destino = SITIO / pre / p["ruta"] / "index.html"
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_text(pagina_html(plantilla, p, idioma, img and f"{URL_SITIO}{img}?v={huellas[img]}"), encoding="utf-8")

    urls = [f"<url><loc>{URL_SITIO}</loc></url>"]
    for p in todas["es"]:
        alternas = {i: f"{URL_SITIO}{'' if i == 'es' else i + '/'}{p['ruta']}/" for i in todas}
        enlaces = "".join(f'<xhtml:link rel="alternate" hreflang="{i}" href="{u}"/>' for i, u in alternas.items())
        enlaces += f'<xhtml:link rel="alternate" hreflang="x-default" href="{alternas["en"]}"/>'
        urls += [f"<url><loc>{u}</loc>{enlaces}</url>" for u in alternas.values()]
    (SITIO / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
                                       + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    (SITIO / "robots.txt").write_text(
        "# Los buscadores solo leen robots.txt en la raíz del dominio; aquí sirve si el sitio pasa a tener dominio propio.\n"
        f"User-agent: *\nAllow: /\n\nSitemap: {URL_SITIO}sitemap.xml\n", encoding="utf-8")
    n = sum(len(x) for x in todas.values())
    print(f"{n} páginas en sitio/{{{','.join(GENERADAS)}}}/, {len(huellas)} tarjetas, sitio/sitemap.xml y sitio/robots.txt")


def main():
    orden = sys.argv[1] if len(sys.argv) > 1 else "verificar"
    datos = cargar()
    if orden == "verificar":
        errores, avisos = verificar(*datos[:5], wcvp=datos[6])
        for a in avisos:
            print("  ·", a)
        for e in errores:
            print("  ✗", e)
        print(f"{len(errores)} errores, {len(avisos)} avisos")
        sys.exit(1 if errores else 0)
    elif orden == "comprobar":
        comprobar(*datos, solo_nuevas="--nuevas" in sys.argv)
    elif orden == "medios":
        medios()
    elif orden == "traducir":
        traducir(*datos[:5])
    elif orden == "construir":
        construir(*datos)
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
