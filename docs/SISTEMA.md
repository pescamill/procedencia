# El sistema

El inventario original acertaba en lo esencial (separar lo nativo de lo domesticado, pedir la misma vara a México y a otras regiones), pero metía varias preguntas en una sola etiqueta. «Tipo: mesoamericano» decía dónde; «Tipo: mexicano moderno» decía cuándo; «Confianza: media, por verificar» mezclaba el grado de acuerdo con una tarea pendiente. Las secciones repetían fichas (el chile estaba en Alimentos y en Sabores; la grana, en Colorantes y en Expedientes) y los animales tenían sección propia aunque un animal puede ser comida, color o medicina.

Este sistema parte de una sola idea: **cada eje responde una pregunta, y una cosa vive en un solo lugar**.

**Manifiesto.** La página de aportes abre con lo que creemos (que a México y a sus pueblos originarios los han despojado de muchos de sus aportes, que el mundo cree suyos) y con nuestro objetivo (divulgar esta información y dignificar a nuestros pueblos originarios y su aporte al mundo). El texto vive en `catalogo.json`, en `manifiesto`.

**Postura.** Procedencia no es neutral: defiende el patrimonio de México y de sus pueblos originarios frente al saqueo, la desterritorialización y el borrado de su autoría. Como en un alegato, la fuerza está en la prueba. Cuando otro país reclama un origen, el sitio expone su argumento y muestra por qué la evidencia lo pone aquí; lo que no se puede probar todavía queda pendiente y no se reclama, para no debilitar los reclamos probados.

## Ocho principios

0. **Defender con pruebas.** El sitio toma partido por el patrimonio de México; por eso cada reclamo se sostiene con una fuente comprobable.
1. **Una cosa, una ficha.** Cada aporte existe una vez. Secciones, mapas y recorridos son vistas que lo citan.
2. **Un eje, una pregunta.** Cada clasificación responde una sola pregunta y sus valores se excluyen entre sí. Cada ámbito declara qué incluye y qué no.
3. **La afirmación es la unidad de verdad.** La solidez y las fuentes van en cada afirmación, no en la ficha.
4. **La misma vara.** Las cinco líneas de evidencia se aplican igual a México y a cualquier otra región.
5. **Lo aportado no es lo que le pasó.** Aportes, casos y nombres que borran el origen viven en lugares distintos.
6. **Sin fuente, no se afirma.** Lo que no tiene fuente se muestra como pendiente.
7. **El verificador también se verifica.** Un programa aplica estas reglas y publica sus cifras.

## Cinco entidades

| Entidad | Qué es | Cuántas |
|---|---|---|
| Ficha | Una cosa aportada (o un deslinde). | 89 |
| Afirmación | Un enunciado con solidez y fuentes. Vive dentro de una ficha, caso, recorrido o pueblo. | 264 |
| Fuente | Una referencia con tipo, rango y enlace comprobable. | 155 |
| Caso | Algo que se le hizo a uno o más aportes. | 21 |
| Pueblo | Quienes lo crearon: nombre propio, lengua, región, periodo y herencia (`datos/pueblos.json`). | 15 |

Los **recorridos** (9) no son entidades: son vistas narrativas que ordenan fichas y casos. Los **diagramas** (`datos/diagramas.json`) tampoco: resumen en pasos las afirmaciones de una ficha y citan sus fuentes.

## Ejes de la ficha

| Eje | Pregunta | Valores | Cardinalidad |
|---|---|---|---|
| Ámbito | ¿Para qué le sirve al mundo? | Alimentación, Agricultura, Color, Materiales, Plantas de ornato, Salud, Conocimiento y técnica, Construcción, Ritual y fiesta, Artes y oficios, Lengua | Uno |
| Naturaleza | ¿Qué es? | Planta, animal, hongo, técnica, saber, práctica, obra, lengua | Uno |
| Actos | ¿Qué hizo aquí la gente? | Nativo, domesticado, creado, nombrado | Uno o más |
| Territorio | ¿Dónde está la evidencia más antigua del aporte? | México, Mesoamérica | Uno |
| Alcance | ¿Cuánto llegó al mundo? | Cambió al mundo, muy extendido, conocido fuera, sobre todo aquí | Uno |
| Época | ¿Cuándo ocurrió? | Antes de 1521, 1521–1821, desde 1821 | Uno |
| Clase | ¿Se cuenta como aporte? | Aporte, deslinde | Uno |

Y dos ejes que se **calculan**, no se escriben:

| Eje | Pregunta | Valores | Cómo se calcula |
|---|---|---|---|
| Verificación (por afirmación) | ¿Qué se comprobó de sus fuentes? | Pendiente, citada, comprobada | Sin fuentes → pendiente; todas comprobadas en línea → comprobada; si no, citada. |
| Documentación (por ficha) | ¿Cuánto está documentada? | En investigación, ficha, expediente | Veredicto sin fuente → en investigación; con contrapuntos y comparación → expediente. |

La **solidez** (consenso, sustentada, en debate) es un eje de la afirmación, no de la ficha: en la grana, la cría oaxaqueña es consenso y el origen de la especie está en debate.

**Territorio.** Si la evidencia más antigua está dentro del México actual, el aporte es de México aunque después se compartiera con Guatemala o Belice: así pasan a México la milpa, la chía, el jitomate, el hule, el cacao como bebida, el azul maya, el cero, la escritura y los calendarios. «Mesoamérica» queda para lo que tiene su evidencia más antigua fuera, en varias regiones a la vez, o todavía sin situar.

**Alcance.** Ordena la página: lo que cambió al mundo va primero y con más espacio. Es una valoración editorial; junto a ella se muestra un indicador medible, el número de ediciones de Wikipedia con artículo sobre el tema (de Wikidata, con `procedencia.py medios`).

**Para cualquier lector.** Cada ficha lleva `en_breve`: una o dos frases llanas que no agregan datos, solo dicen qué es y por qué importa. Cada aporte lleva su nombre en la lengua originaria (`originales`, con fuente) o explica en `sin_originario` por qué no lo tiene, por ejemplo porque es una creación del siglo XX. El verificador falla si falta cualquiera de los dos.

### Las fronteras de los ámbitos

Cada ámbito tiene una pregunta, una lista de lo que incluye y otra de lo que no. El verificador falla si a un ámbito le falta alguna de las tres. Las fronteras que más se prestan a confusión:

- **Alimentación / Agricultura:** lo que se cosecha va en Alimentación; la forma de cultivar (milpa, chinampa), en Agricultura.
- **Salud / Ritual y fiesta:** la ceremonia va en Ritual; la sustancia que el mundo recibió como fármaco o como objeto de investigación (psilocibina, mescalina), en Salud.
- **Color / Alimentación:** si el mundo lo usa sobre todo para dar color (achiote como E160b), va en Color.
- **Artes y oficios / Ritual y fiesta:** la música o el oficio que el mundo recibió como arte (mariachi) va en Artes; la danza que es sobre todo ceremonia (voladores), en Ritual.
- **Conocimiento y técnica / Construcción:** la traza y el tamaño de una ciudad van en Conocimiento; la forma de edificar, el mortero, el trabajo de obra y el arte hecho para un edificio, en Construcción.
- **Construcción / Artes y oficios:** un mural o un relieve que es parte de un templo va en Construcción; la pintura, el textil o la artesanía sueltos, en Artes.
- **Lengua / cada ficha:** el nombre náhuatl de una planta va en su ficha; Lengua guarda las lenguas vivas y los préstamos como fenómeno.

### Reglas entre ejes

- Un aporte tiene al menos un acto; un deslinde puede no tener ninguno.
- «Nativo» solo se dice de seres vivos (planta, animal, hongo).
- «Domesticado» no se dice de saberes, obras ni lenguas.
- «Nativo» se contrasta con la distribución del WCVP. Si el WCVP no registra a la especie como nativa del territorio, el verificador falla. Así la guayaba pasó a deslinde.
- Si el acto es «nombrado» y la especie vino de fuera, su origen biológico se anota en `origen_biologico` y se dibuja con una flecha en el mapa.

## Líneas de evidencia

Sustituyen a la «escala de evidencia» del inventario. Ya no son niveles de una escala: cada línea está presente o ausente, y se comparan dos regiones lado a lado.

| n | Línea | ¿Sostiene «tradición»? |
|---|---|---|
| 1 | Presencia aislada | No |
| 2 | Presencia recurrente | No |
| 3 | Producción local | Sí |
| 4 | Nombre propio | Sí |
| 5 | Testimonio escrito o pictográfico | Sí |

El verificador calcula si cada región «sostiene tradición» (alguna de las líneas 3 a 5) y el sitio lo muestra en la tabla del expediente.

## Nombres en el mundo

Cada nombre que el mundo usa vive en su ficha, con una de cinco formas:

| Forma | Pregunta |
|---|---|
| Nombre ajeno | ¿El nombre señala otro país, otra persona u otro pueblo? |
| Identidad ajena | ¿Otro país se volvió sinónimo de su versión famosa o de su producción? |
| Sustituto | ¿Un sintético o una imitación ocupa su lugar? |
| Etiqueta muda | ¿La etiqueta o el mercado lo nombran sin decir de dónde viene? |
| Conserva su origen | ¿El nombre que usa el mundo guarda la huella de su origen? |

Si el nombre señala un lugar, se anota en `apunta` y se dibuja un arco en el mapa de Nombres.

## Casos

Tipo (saber borrado, biopiratería, apropiación, saqueo) y estado (abierto, resuelto, histórico) son ejes separados. Cada caso cita las fichas a las que afectó; la ficha muestra sus casos en un recuadro, «Lo que se le quitó», sin contenerlos. Un caso puede llevar `reclamo`: lo que el sitio pide que se reconozca.

**Saber borrado** pregunta si se destruyó o se borró lo que un pueblo sabía, hablaba, construyó o cuidaba, o si el mundo tomó el producto y atribuyó su saber a otros. Cubre:

- libros quemados (Maní);
- ciudades arrasadas (Tenochtitlan);
- la gente misma (las matanzas de Cholula y Tóxcatl, la mortandad del cocoliztli);
- los gobiernos desmontados (Cuauhtémoc, el cazonci);
- la medicina nahua copiada sin sus autores;
- las lenguas extintas o en riesgo;
- las especies perdidas;
- el saber separado del producto (el hule antes de Goodyear, el maíz sin nixtamalización).

El robo de piezas de un museo es **saqueo**, no saber borrado: el objeto existe y puede volver.

La vista «Lo que se les quitó» junta los cuatro tipos de caso, los nombres que borran el origen y los recorridos de desterritorialización (la cocina china y la coreana sin México, el cempasúchil en India).

## Del inventario a este sistema

| En el inventario | Aquí |
|---|---|
| Tipo «Originario» | Acto (nativo o creado) + territorio México |
| Tipo «Domesticado» | Acto «domesticado»; origen biológico aparte si vino de fuera |
| Tipo «Nombrado» | Acto «nombrado»; origen biológico en su propio campo |
| Tipo «Mesoamericano» | Territorio «Mesoamérica» |
| Tipo «Mexicano moderno» | Época virreinal o moderna; autoría si la hay |
| Confianza alta, media, debatida | Solidez por afirmación: consenso, sustentada, en debate |
| «Por verificar» | Pendientes de la ficha + verificación «pendiente» |
| Escala de evidencia | Cinco líneas presentes o ausentes, comparadas entre regiones |
| Secciones temáticas | Un ámbito por ficha; lo transversal pasa a recorridos |
| Sección Animales | Naturaleza «animal», en el ámbito que le toque |
| Imitaciones y nombres | Nombres en el mundo, con forma de borrado |
| Saqueo, biopiratería | Casos |
| «No mexicano», «Debatida» | Deslindes |
