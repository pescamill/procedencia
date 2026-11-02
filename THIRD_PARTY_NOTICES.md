# Datos y obras de terceros

## Mapas: TDWG WGSRPD, nivel 3

`datos/geo/mundo.json` y `datos/geo/mexico.json` se derivan del *World Geographical Scheme for Recording Plant Distributions*, 2.ª edición (Brummitt, R. K., 2001, Hunt Institute for Botanical Documentation), en la versión geojson que publica el grupo TDWG. Las regiones se simplificaron y proyectaron con `herramientas/mapas.py` (Equal Earth para el mundo; equirectangular para México).

## Distribuciones: WCVP vía GBIF

`datos/wcvp/*.json` guarda, por especie, las regiones nativas e introducidas que registra el *World Checklist of Vascular Plants* (Royal Botanic Gardens, Kew), consultado a través del conjunto publicado en GBIF. Cita: Govaerts, R. et al. (2021). The World Checklist of Vascular Plants, a continuously updated resource for exploring global plant diversity. *Scientific Data* 8, 215. doi:10.1038/s41597-021-00997-6. El WCVP se distribuye bajo CC BY.

## Metadatos bibliográficos: Crossref

`datos/comprobaciones.json` guarda el título, el año y la revista que Crossref registra para cada DOI. Crossref publica estos metadatos sin restricciones (CC0).

## Imágenes: Wikimedia Commons

Las fotografías e ilustraciones de las fichas se enlazan desde Wikimedia Commons (`upload.wikimedia.org`); no se copian al repositorio. Cada una tiene una licencia libre (dominio público, CC0, CC BY, CC BY-SA o GFDL) y se muestra junto con su autor, su licencia y el enlace a su página en Commons. El registro completo, por ficha, está en `datos/medios_comprobados.json`. El número de Wikipedias por tema viene de Wikidata (CC0).

## Cenefa

`sitio/img/borde.svg` proviene del proyecto Amoxcalli, del mismo autor.
