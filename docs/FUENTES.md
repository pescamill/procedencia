# Fuentes y verificación

## Qué cuenta como fuente

Cada fuente tiene un tipo, y cada tipo un rango. El rango dice para qué sirve, no cuánto vale el autor.

| Rango | Tipos | Para qué |
|---|---|---|
| 1 | Artículo revisado por pares, libro académico, documento oficial, base de datos científica | Afirmaciones científicas, históricas y legales. |
| 2 | Fuente histórica (códices, crónicas), institución o museo, obra de consulta | Testimonio de época y datos institucionales. Una crónica es testimonio, no verificación. |
| 3 | Prensa | Hechos recientes y públicos (una demanda, una carta, un retiro de marca). Nunca para cuestiones científicas. |

Siempre que existe, se usa el DOI y no un enlace a la editorial.

## Qué comprueba el programa

`python3 procedencia.py comprobar` sale a la red y guarda lo que encontró en `datos/comprobaciones.json`:

- **DOI:** lo busca en Crossref y compara el título registrado con el anotado (parecido de 0 a 1) y el año (se acepta una diferencia de un año, por la distancia entre publicación en línea e impresa). Si el título se parece menos de 0.75 (o si un título no empieza como el otro), el resultado es «discrepancia».
- **Enlace:** lo abre y anota si responde. Si el sitio rechaza a los programas (403 o una página de desafío), el resultado es «bloqueada»: no se intenta saltar el bloqueo.
- **Especie:** busca la especie en el WCVP a través de GBIF y guarda en `datos/wcvp/` las regiones TDWG donde es nativa o introducida.

Después, `construir` calcula la verificación de cada afirmación:

- **Pendiente:** no tiene fuente.
- **Citada:** tiene fuente, pero alguna no se pudo comprobar (sin enlace o bloqueada).
- **Fuente comprobada:** todas sus fuentes existen y coinciden con su registro.

## Lo que «comprobada» no significa

Comprobar el registro **no es leer el pasaje**. El programa confirma que la fuente existe y que es la que se dice (mismo título, mismo año), no que diga lo que se le atribuye. La lectura del pasaje es trabajo editorial y se anota en las notas de cada fuente cuando se hace. Por eso el sitio dice «fuente comprobada» y no «afirmación comprobada».

## Qué encontró la primera comprobación

- **Diez DOIs equivocados.** Se habían escrito de memoria al preparar el proyecto y apuntaban a otros artículos (recubrimientos comestibles, ácaros, almortas…). La comparación de títulos los detectó; se buscaron en Crossref y se corrigieron todos.
- **Dos discrepancias de título** (EFSA 2016 y la Lista Roja del ajolote): los títulos anotados eran paráfrasis. Se sustituyeron por los registrados.
- **Tres enlaces rotos:** Consumerist cerró (se enlaza la copia del Internet Archive), el catálogo del INALI cambió de lugar (se enlaza el PDF) y la biblioteca de Dresde cambió de dominio.
- **Un conflicto con el WCVP:** la guayaba figuraba como nativa de México, pero el WCVP la registra nativa solo de Perú. Pasó a deslinde.

Todo esto está en la fe de erratas del sitio (`datos/erratas.json`).

## Iteración 2: fuentes nuevas

- 18 fuentes nuevas; `comprobar --nuevas` revisa solo esas. Coincidieron todas las que tienen DOI.
- Dos sitios no admiten la comprobación automática: academia.edu (Blume 2011) y el blog de David Stuart (responde a un navegador, no al programa). Quedan como «bloqueada».
- **Nombres originarios.** Las formas en náhuatl citan el Gran Diccionario Náhuatl (UNAM), que reúne el vocabulario de Molina (1571) y otros veinte; las formas mayas, el Diccionario Cordemex. Confirmar cada entrada en el diccionario es lectura pendiente: la cita dice dónde buscarla, no que ya se leyó.
- **Imágenes.** `procedencia.py medios` toma la imagen principal del artículo de Wikipedia en inglés (o la que fija `datos/medios.json`), consulta en Commons su autor y su licencia, y el verificador rechaza cualquier licencia que no sea libre. Tres imágenes que no correspondían (un caracol de Galápagos, copal de Madagascar, una ilustración ajena al ulama) se reemplazaron o se quitaron a mano.

## Lo que queda

- Cuatro fuentes sin enlace (Karttunen 1983, Landa, Díaz del Castillo, Coe 1996): son libros sin edición digital abierta. Sus afirmaciones quedan como «citadas».
- El WCVP se consulta vía GBIF porque POWO bloquea a los programas.
- `reportes/estado.md` lista los pendientes de cada ficha después de cada construcción.
