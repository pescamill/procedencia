"""Procedencia: verificador y constructor.

    python3 procedencia.py verificar     # reglas del sistema; sale con error si alguna falla
    python3 procedencia.py comprobar     # red: DOIs en Crossref, URLs, distribución en WCVP
    python3 procedencia.py comprobar --nuevas   # solo las fuentes sin comprobar
    python3 procedencia.py medios        # red: imagen de Commons y alcance en Wikipedia
    python3 procedencia.py traducir      # datos/traducciones/en.json: textos nuevos y pendientes
    python3 procedencia.py construir     # sitio/datos.js, sitio/datos-en.js y reportes/estado.md

Solo usa la biblioteca estándar. `comprobar` y `medios` son los únicos que salen a la red y
guardan lo que encontraron en datos/comprobaciones.json, datos/wcvp/ y datos/medios_comprobados.json.
"""

import datetime as dt
import copy
import difflib
import hashlib
import html
import json
import re
import ssl
import sys
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

    # Principio 3: la afirmación es la unidad de verdad
    for obj in fichas + casos + recorridos + pueblos:
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


def comprobar_url(f):
    estado, cuerpo = pedir(f["url"], json_=False, intentos=2)
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
    "marca",
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
            "pueblos": pueblos, "diagramas": diagramas, "erratas": leer("erratas.json"), "notas_fuentes": notas}


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


def derivar(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp, pueblos=(), medios=None):
    """Calcula verificación por afirmación, documentación por ficha y métricas."""
    medios = medios or {}
    def verif(a):
        fs = a.get("fuentes", [])
        if not fs:
            return "pendiente"
        return "comprobada" if all(estado_fuente(x, comprobaciones) == "ok" for x in fs) else "citada"

    total_af = {"pendiente": 0, "citada": 0, "comprobada": 0}
    for obj in fichas + casos + recorridos + list(pueblos):
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
    for obj in fichas + casos + recorridos + list(pueblos):
        for _, a in afirmaciones_de(obj):
            for fid in a.get("fuentes", []):
                citas.setdefault(fid, set()).add(obj["id"])
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
    metricas = derivar(cat, fichas, fuentes, casos, recorridos, comprobaciones, wcvp, pueblos, medios)
    for fid, d in diagramas.items():
        for x in d.get("fuentes", []) + (d.get("contraste") or {}).get("fuentes", []):
            f = next(f for f in fuentes if f["id"] == x)
            if fid not in f["citada_por"]:
                f["citada_por"] = sorted(f["citada_por"] + [fid])
    geo = {n: json.loads((DATOS / "geo" / f"{n}.json").read_text(encoding="utf-8")) for n in ("mundo", "mexico")}
    paquete = {
        "catalogo": cat, "fichas": fichas, "casos": casos, "recorridos": recorridos,
        "fuentes": fuentes, "metricas": metricas, "avisos": avisos, "geo": geo,
        "erratas": leer("erratas.json"), "pueblos": pueblos, "diagramas": diagramas,
    }
    js = "/* Generado por procedencia.py construir; no editar a mano. */\nwindow.PROCEDENCIA = " + json.dumps(paquete, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITIO / "datos.js").write_text(js, encoding="utf-8")
    for idioma in IDIOMAS:
        mapa = mapa_traducciones(idioma)
        partes = {k: paquete[k] for k in ("catalogo", "fichas", "casos", "recorridos", "erratas", "pueblos", "diagramas")}
        partes["notas_fuentes"] = {f["id"]: {"nota": f["nota"]} for f in fuentes if f.get("nota")}
        partes = {k: traducido(v, mapa) for k, v in partes.items()}
        js_i = (f"/* Generado por procedencia.py construir; no editar a mano. */\nwindow.PROCEDENCIA_{idioma.upper()} = "
                + json.dumps(partes, ensure_ascii=False, separators=(",", ":")) + ";\n")
        (SITIO / f"datos-{idioma}.js").write_text(js_i, encoding="utf-8")
    abiertos = {k: v for k, v in paquete.items() if k not in ("geo", "avisos")}
    abiertos["licencia"] = "Textos y datos: CC BY 4.0. Imágenes: la licencia de cada una, en fichas[].imagen."
    (SITIO / "datos-abiertos.json").write_text(json.dumps(abiertos, ensure_ascii=False, indent=1), encoding="utf-8")
    escribir_reporte(cat, fichas, fuentes, casos, metricas, avisos)
    print(f"sitio/datos.js ({round(len(js.encode()) / 1024)} KB), sitio/datos-abiertos.json y reportes/estado.md")
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
