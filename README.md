# Procedencia

Aportes de México al mundo, ficha por ficha, y lo que se les quitó a sus pueblos. El sitio defiende ese patrimonio con pruebas: cada afirmación lleva su grado de acuerdo y su fuente; cada fuente, el resultado de comprobarla en línea. Lo que no tiene fuente se muestra como pendiente y no se reclama.

Nace del «Inventario de aportes de México al mundo», que definía qué artículos tendría el proyecto pero aún no llevaba fuentes. Este repositorio es la fase de investigación: las fuentes, el sistema que ordena los datos y el sitio que los muestra.

## Qué hay

| Ruta | Qué es |
|---|---|
| `datos/catalogo.json` | El sistema: principios, ejes y sus valores, líneas de evidencia, formas de borrado, tipos de caso y de fuente. |
| `datos/fichas/*.json` | 96 fichas (92 aportes y 4 deslindes), agrupadas por ámbito en cinco archivos. |
| `datos/casos.json` | 31 casos de saber borrado, biopiratería, apropiación y saqueo. |
| `datos/recorridos.json` | 10 recorridos que ordenan fichas y casos para contar algo. |
| `datos/cuenta.json` | «Lo que aún se niega»: un relato en 11 actos sobre la riqueza que se sacó de México. Las frases con fuente se marcan `[[frase\|fuente]]`; lleva láminas de códices, gráficas, el mapa de la plata y la cuenta del dinero. |
| `datos/pueblos.json` | 15 pueblos: nombre propio, lengua, región, periodo y herencia. |
| `datos/diagramas.json` | Diagramas de proceso por ficha, con sus fuentes. |
| `datos/medios.json`, `datos/medios_comprobados.json` | Qué imagen de Commons usa cada ficha, y su autor, licencia y número de Wikipedias. |
| `datos/fuentes.json` | 250 fuentes con tipo, DOI o enlace. |
| `datos/traducciones/en.json` | La versión en inglés: cada texto en español con su traducción, por huella del texto. |
| `datos/erratas.json` | Lo que la verificación corrigió del inventario. |
| `datos/comprobaciones.json`, `datos/wcvp/` | Lo que encontró la última comprobación en línea. |
| `datos/geo/` | Mapas del mundo y de México (TDWG nivel 3), ya proyectados. |
| `procedencia.py` | Verificador y constructor. Solo biblioteca estándar. |
| `herramientas/mapas.py` | Convierte el geojson de TDWG en los mapas de `datos/geo/`. |
| `sitio/` | El sitio estático: `index.html`, `estilo.css`, `app.js`, los `datos.js` y `datos-en.js` generados y `datos-abiertos.json`. |
| `sitio/ficha/`, `caso/`, `pueblo/`, `recorrido/`, `cuenta/`, `en/` | Generadas: una página por id, en español y en inglés, para compartir y para los buscadores. Cargan la misma aplicación. |
| `sitio/compartir/` | Generadas: la tarjeta de 1200×630 de cada página, y `huellas.json` para pintar solo las que cambian. |
| `reportes/estado.md` | Cifras y pendientes de la última construcción. |
| `docs/` | El sistema explicado, la política de fuentes, el plan de difusión y el registro de cambios. |

## Uso

```bash
python3 procedencia.py verificar    # reglas del sistema; falla si alguna no se cumple
python3 procedencia.py comprobar    # sale a la red: Crossref, enlaces y WCVP (unos minutos)
python3 procedencia.py comprobar --nuevas   # solo las fuentes que aún no se comprobaron
python3 procedencia.py medios       # sale a la red: imagen y licencia en Commons, Wikipedias en Wikidata
python3 procedencia.py traducir     # agrega a datos/traducciones/en.json los textos nuevos o cambiados
python3 procedencia.py construir    # verifica y genera sitio/datos.js, sitio/datos-en.js, reportes/estado.md,
                                    # las páginas por id, sus tarjetas (con Chrome), sitemap.xml y robots.txt
```

Para ver el sitio:

```bash
cd sitio && python3 -m http.server 8795 --bind 127.0.0.1
```

y abre http://127.0.0.1:8795. No hay dependencias ni paso de compilación: el sitio se puede publicar tal cual en cualquier hosting estático.

## Cómo se agrega una ficha

1. Agrega la ficha al archivo de su ámbito en `datos/fichas/`. El ámbito se decide con su pregunta y su lista de «no incluye» (ver `docs/SISTEMA.md`).
2. Escribe `en_breve` para cualquier lector, elige su `alcance` y agrega su nombre en lengua originaria en `originales` (con fuente) o explica en `sin_originario` por qué no lo tiene. Cada afirmación lleva `solidez` y `fuentes`. Si aún no hay fuente, deja `fuentes` vacío: se mostrará como pendiente.
3. Agrega las fuentes nuevas a `datos/fuentes.json`, con DOI siempre que exista.
4. Agrega su artículo de Wikipedia a `datos/medios.json` y corre `python3 procedencia.py medios`.
5. `python3 procedencia.py comprobar --nuevas` y revisa las discrepancias que reporte.
6. `python3 procedencia.py traducir` y llena el campo `en` de cada texto nuevo en `datos/traducciones/en.json`. Lo que quede en `null` se muestra en español y el verificador lo avisa.
7. `python3 procedencia.py construir`.

## Idiomas

El botón ES/EN de la cabecera cambia el idioma y lo recuerda. También se puede enlazar con `?lang=en` o `?lang=es`; sin preferencia, el sitio sigue el idioma del navegador. El español es la fuente: cada texto traducible se identifica por los diez primeros dígitos del SHA-1 de su versión en español, así que si el español cambia, la traducción vuelve a quedar pendiente en lugar de quedar desfasada. Los títulos de las fuentes, los nombres propios y los nombres en lenguas originarias no se traducen.

## Licencias

El código está bajo la licencia MIT (`LICENSE`). Los textos de las fichas son obra propia y se publican bajo CC BY 4.0. Los datos de terceros (mapas TDWG, distribuciones del WCVP, metadatos de Crossref, imágenes de Wikimedia Commons) conservan sus licencias; ver `THIRD_PARTY_NOTICES.md`.
