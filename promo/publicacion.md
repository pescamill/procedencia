# Reel de Procedencia

`promo/procedencia-reel.mp4` · 1080×1920 · 30 fps · 1:31 · música: Ariis, «GOZALO (Slowed)».

Versión 2: alimentos y agricultura, en 3D y al ritmo de la canción. La primera versión sigue en `promo/reel-v1.html`.

El video, la canción y las fotos no se suben al repositorio: la canción tiene derechos de autor, y las fotos se vuelven a bajar de Wikimedia Commons con su autor y su licencia. Para volver a generarlo:

```bash
python3 -I promo/imagenes.py                                     # fotos de Commons y sus créditos
uv run --with librosa --with numpy python promo/ritmo.py promo/audio.mp3 promo/golpes.json   # bombos de la canción
../pleno/.venv/bin/python promo/capturas.py                      # capturas del sitio publicado
../pleno/.venv/bin/python promo/datos_reel.py                    # golpes, mapa, fichas y créditos
../pleno/.venv/bin/python promo/render.py                        # video con música y efectos
```

## Ritmo

La canción va a 104.8 BPM. Sus bombos llegan en pares, como latidos, en frases de 4.58 s. `ritmo.py` detecta cada bombo y el reel los usa directamente:

- Cada corte cae en un bombo, y la página nueva entra en 3D para aterrizar justo en él.
- Cada bombo da un latido: la cámara se acerca, la viñeta se oscurece y las fotos se adelantan.
- Los sellos, los números y los alfileres del mapa caen en bombos concretos.
- En el montaje, cae una foto por tiempo.
- Los golpes fuertes sacuden la cámara: el bajo en 9.2 s, el drop en 18.4 s, y luego 41.3 s, 60.5 s y 82.2 s.

## Guion

| Tiempo | En pantalla | Fuente |
|---|---|---|
| 0:00 | «El chocolate es de Suiza…» (foto del cacao en gris: «¿Suiza?») | — |
| 0:04 | «La palta y el choclo son de Perú…» | — |
| 0:09 | «Las "marigold" son de la India y China…» | — |
| 0:13 | «Pero si México no ha aportado nada al mundo…», con un anillo de fotos de alimentos girando | — |
| 0:16 | El anillo gira a saltos, uno por bombo: **¿Nada?** | — |
| 0:18 | **¿Estás seguro?** Esto dicen las pruebas. Cada dato, con su fuente. | — |
| 0:20 | Lámina 01 · ~~El chocolate es de Suiza~~ FALSO · 1900 a. C. Ya había cacao en vasijas de Chiapas. La planta es amazónica; la bebida de chocolate es mesoamericana. | Powis et al. 2007; Zarrillo et al. 2018 |
| 0:25 | Lámina 02 · ~~La palta es de Perú~~ · *ahuacatl*: sus tres razas se domesticaron en Mesoamérica. | Rendón-Anaya et al. 2019 |
| 0:30 | Lámina 03 · ~~El choclo es de Perú~~ · 9,000 años: se domesticó una sola vez, en el Balsas, Guerrero; al Perú llegó desde Mesoamérica. | Matsuoka et al. 2002; Grobman et al. 2012 |
| 0:34 | ¿Entonces por qué casi nadie lo sabe? | — |
| 0:37 | African marigold, turkey, paprika húngara, Bourbon vanilla, chocolate suizo: al mundo le llegó con otro nombre. | Fichas de cempasúchil, guajolote, chile, vainilla y cacao |
| 0:41 | Lámina 04 · ~~Las marigold son de la India y China~~ · *cempohualxochitl*: nativa de México, llegó a la India después de 1500; hoy México le compra a China casi todo su pigmento. | WCVP; Zamarrón 2021 |
| 0:46 | Lámina 05 · ~~El chile viene del ají sudamericano~~ · ají (*C. baccatum*) ≠ chile (*C. annuum*). El ají andino es otra especie; el chile que conquistó el mundo (paprika, cayena, kimchi) se domesticó en México. | Kraft et al. 2014; Perry et al. 2007 |
| 0:50 | Lámina 06 · ~~La vainilla es de Madagascar~~ · 1841: la cultivaron primero los totonacas; hasta 1841, el monopolio fue de México. | Lubinsky et al. 2008; Fouché y Jouve 1999 |
| 0:55 | Y la lista sigue: calabaza, frijol, jitomate, nopal, guajolote y chía, una por tiempo. | Smith 1997; Kwak 2009; Blanca 2015; Griffith 2004; Speller 2010; Cahill 2003 |
| 0:58 | ¿Y cómo sé que no es propaganda? | — |
| 1:00 | El método: el veredicto del chile, con su grado de acuerdo, su fuente comprobada y su DOI. | Kraft et al. 2014 |
| 1:04 | 320 afirmaciones · 187 fuentes · 173 comprobadas en línea. | `reportes/estado.md` |
| 1:06 | Lo que no es de aquí, también se dice: el cacahuate es sudamericano; lo mexicano es la palabra. NO SE RECLAMA. | Bertioli et al. 2019 |
| 1:08 | Consenso · Sustentada · En debate. 18 en la fe de erratas. | `datos/erratas.json` |
| 1:13 | Cómo entrar: pescamill.github.io/procedencia, en un teléfono en 3D. | Capturas del sitio publicado |
| 1:22 | Procedencia · pescamill.github.io/procedencia · Gratis · Español e inglés · Datos abiertos · @pescamill | — |

En cada foto aparecen su autor y su licencia; el cierre lo recuerda.

Lo que el reel no dice, a propósito:
- Que el ají «no tiene nada que ver» con el chile. Son especies distintas del mismo género, *Capsicum*, así que el reel dice «otra especie».
- Que el chocolate con leche suizo es de 1875: en el sitio aún no tiene fuente.
- Que México es el mayor productor de aguacate: tampoco tiene fuente todavía.

## Texto para la publicación

> «El chocolate es de Suiza.» «La palta y el choclo son de Perú.» «Las marigold son de la India.» ¿Seguro?
>
> El maíz se domesticó en Guerrero hace 9,000 años. En Chiapas ya había cacao hace casi 4,000. El cempasúchil es mexicano, y hoy México le compra a China su pigmento. El ají andino es otra especie: el chile que conquistó el mundo, de la paprika al kimchi, se domesticó en México.
>
> Procedencia reúne los aportes de México y de sus pueblos originarios. Cada afirmación lleva su fuente, y cada fuente, el resultado de comprobarla. Lo que no es de aquí, como el cacahuate, también se dice.
>
> Gratis, en español e inglés: pescamill.github.io/procedencia
>
> #México #Comida #Maíz #Chocolate #Cempasúchil #Chile #PueblosOriginarios

---

# Reel 3 · «Un mundo sin México»

`promo/procedencia-mundo.mp4` · 1080×1920 · 30 fps · 1:31 · misma canción y misma rejilla de bombos que el reel 2.

```bash
python3 -I promo/imagenes.py
../pleno/.venv/bin/python promo/datos_reel.py
../pleno/.venv/bin/python promo/render.py --pagina reel-mundo.html --salida promo/procedencia-mundo.mp4
```

Una idea: si se quitan los alimentos que salieron de México, el mundo pierde la pizza roja, el kimchi rojo, casi toda la mezclilla y el chocolate suizo. Y no fue suerte: aquí nació la agricultura, se transformó el teocintle en maíz y se cultivó sobre el agua.

## Guion

| Tiempo | En pantalla | Fuente |
|---|---|---|
| 0:00 | «Imagina un mundo sin lo que salió de México…», con un anillo de fotos | — |
| 0:04 | El anillo se apaga foto por foto, una por golpe: «Sin maíz. Sin algodón. Sin calabaza. Sin chile. Sin jitomate. Sin cacao.» | — |
| 0:13 | ¿Cómo se vería? | — |
| 0:18 | Sin maíz: el cereal más producido del mundo. Ni palomitas, ni polenta, ni tortillas. | FAOSTAT; Matsuoka et al. 2002 |
| 0:23 | Sin nixtamal: Europa adoptó el maíz sin la técnica, y en Italia la pelagra enfermó a decenas de miles en el siglo XIX. | Katz et al. 1974; Ginnaio 2011 |
| 0:27 | Sin algodón: el 90 % del algodón del mundo es *G. hirsutum*, domesticado en Yucatán. | Wendel y Grover 2015; Yuan et al. 2021 |
| 0:32 | Sin calabaza: Guilá Naquitz, hace 10,000 años; el zucchini es *Cucurbita pepo*. | Smith 1997 |
| 0:36 | Sin chile: ninguna especie de chile es nativa de Asia; el kimchi no sería rojo. | Kraft et al. 2014 |
| 0:41 | Sin jitomate: la pizza no tendría rojo. | Blanca et al. 2015 |
| 0:46 | Sin cacao: Suiza no tendría chocolate. | Powis et al. 2007; Zarrillo et al. 2018 |
| 0:50 | Y sin vainilla, aguacate, frijol, guajolote, nopal y chía, uno por tiempo. | Fichas del sitio |
| 0:55 | ¿Suerte? No. Es ciencia agrícola, hecha aquí, hace miles de años. | — |
| 0:59 | Aquí se inventó la agricultura: uno de los pocos centros independientes del mundo. | Larson et al. 2014; Smith 1997 |
| 1:04 | Bioingeniería: del teocintle al maíz, con unos pocos genes como *tga1*. | Doebley 2004; Wang et al. 2005 |
| 1:08 | La milpa: maíz, frijol y calabaza aprovechan mejor los nutrientes juntos. | Postma y Lynch 2012; Zizumbo-Villarreal 2010 |
| 1:13 | Cultivar sobre el agua: chinampas, la presa de Purrón (desde hacia 750 a. C.) y los camellones mayas. | Calnek 1972; Aiuvalasit et al. 2010; Beach et al. 2019 |
| 1:18 | 330 afirmaciones · 212 fuentes · 197 comprobadas en línea. | `reportes/estado.md` |
| 1:22 | Cierre: Procedencia · pescamill.github.io/procedencia · @pescamill | — |

Lo que el reel no dice, a propósito:
- Que sin México «no habría algodón»: el 10 % restante es de otras especies, así que dice «9 de cada 10 fibras».
- Que la calabaza de Halloween es mexicana: no hay fuente para eso en el sitio todavía.
- «Industrial»: la palabra no cabe para el mundo antiguo. El reel dice «ciencia agrícola» y muestra la escala con las chinampas, la presa y los camellones.
- El adobe se agregó al sitio como deslinde: se usó aquí a escala monumental, pero no se inventó aquí.

## Texto para la publicación

> Imagina el mundo sin lo que salió de México.
>
> Sin maíz, el cereal más producido del planeta. Sin el algodón de 9 de cada 10 fibras del mundo. Sin el chile del kimchi, sin el jitomate de la pizza, sin el cacao del chocolate suizo.
>
> No fue suerte. Mesoamérica es uno de los pocos lugares del mundo donde la agricultura nació sola. Aquí se convirtió el teocintle en maíz, se inventó la milpa, se cocinó el maíz con cal y se cultivó sobre el agua.
>
> Cada dato lleva su fuente: pescamill.github.io/procedencia
>
> #México #Maíz #Agricultura #Chinampas #Milpa #Ciencia #PueblosOriginarios
