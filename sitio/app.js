/* Procedencia · aplicación estática. Lee window.PROCEDENCIA (lo genera procedencia.py construir). */
(function () {
  "use strict";
  // Idioma: ?lang= en la dirección, luego la elección guardada, luego el navegador. El inglés llega aparte, en datos-en.js.
  const IDIOMAS = ["es", "en"];
  const ELEGIDO = (() => {
    const q = new URLSearchParams(location.search).get("lang");
    if (IDIOMAS.includes(q)) { try { localStorage.setItem("procedencia-idioma", q); } catch (_) {} return q; }
    try { const g = localStorage.getItem("procedencia-idioma"); if (IDIOMAS.includes(g)) return g; } catch (_) {}
    const nav = (navigator.languages || [navigator.language || ""]).map((l) => String(l).slice(0, 2).toLowerCase());
    return nav.find((l) => IDIOMAS.includes(l)) || "en";
  })();
  if (ELEGIDO === "en" && !window.PROCEDENCIA_EN) {
    const s = document.createElement("script");
    s.src = "datos-en.js";
    s.onload = s.onerror = iniciar;
    document.head.appendChild(s);
  } else iniciar();

  function iniciar() {
    // Sin la traducción (si datos-en.js no cargó), todo queda en español.
    const LANG = ELEGIDO === "en" && window.PROCEDENCIA_EN ? "en" : "es";
    const L = (es, en) => (LANG === "en" ? en : es);
    const E = LANG === "en" ? window.PROCEDENCIA_EN : null;
    const D = E ? { ...window.PROCEDENCIA, ...E, fuentes: window.PROCEDENCIA.fuentes.map((f) => (E.notas_fuentes[f.id] ? { ...f, nota: E.notas_fuentes[f.id].nota } : f)) } : window.PROCEDENCIA;
    const C = D.catalogo;
    const $main = document.getElementById("contenido");
    const $tip = document.getElementById("tip");

    // ------------------------------------------------------------ índices
    const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
    const FICHA = porId(D.fichas);
    const FUENTE = porId(D.fuentes);
    const CASO = porId(D.casos);
    const RECORRIDO = porId(D.recorridos);
    const AMB = porId(C.ambitos);
    const NAT = porId(C.naturalezas);
    const ACTO = porId(C.actos);
    const TERR = porId(C.territorios);
    const EPOCA = porId(C.epocas);
    const SOL = porId(C.solidez);
    const VER = porId(C.verificacion);
    const DOC = porId(C.documentacion);
    const BORR = porId(C.borrado);
    const TCASO = porId(C.tipos_caso);
    const ECASO = porId(C.estados_caso);
    const TFUENTE = porId(C.tipos_fuente);
    const LINEAS = C.lineas_evidencia;
    const PUEBLO = porId(D.pueblos || []);
    const ALC = porId(C.alcance);
    const ORDEN_ALC = Object.fromEntries(C.alcance.map((a, i) => [a.id, i]));
    const DIAG = D.diagramas || {};
    const COLOR_CASO = { saber_borrado: "var(--ochre-ink)", biopirateria: "var(--jade)", apropiacion: "var(--blue)", saqueo: "var(--accent)" };
    const ORDEN_CASO = ["saber_borrado", "biopirateria", "apropiacion", "saqueo"];
    const TIPOS_CASO = ORDEN_CASO.map((id) => TCASO[id]).filter(Boolean);
    const BORRA = new Set(["nombre_ajeno", "identidad_ajena", "sustituto", "etiqueta_muda"]);
    const porAlcance = (a, b) => ORDEN_ALC[a.alcance] - ORDEN_ALC[b.alcance] || (b.wikipedias || 0) - (a.wikipedias || 0) || a.nombre.localeCompare(b.nombre, LANG);
    const CASOS_DE = {};
    D.casos.forEach((c) => c.fichas.forEach((f) => (CASOS_DE[f] = (CASOS_DE[f] || []).concat(c.id))));
    const RECORRIDOS_DE = {};
    D.recorridos.forEach((r) => r.pasos.forEach((p) => {
      for (const id of [p.ficha, p.caso]) if (id && !(RECORRIDOS_DE[id] || []).includes(r.id)) RECORRIDOS_DE[id] = (RECORRIDOS_DE[id] || []).concat(r.id);
    }));

    // ------------------------------------------------------------ utilidades
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmt = (n) => n.toLocaleString(L("es-MX", "en-US"));
    const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
    const anio = (y) => (y < 0 ? `${fmt(-y)} ${L("a. C.", "BCE")}` : String(y));
    const plural = (n, uno, varios) => `${fmt(n)} ${n === 1 ? uno : varios}`;
    const quitarAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    const ICONOS = {
      mazorca: '<path d="M12 3c2.5 0 4 3 4 7.5S14.5 19 12 19s-4-4-4-8.5S9.5 3 12 3z"/><path d="M10 7h4M9.4 10h5.2M9.4 13h5.2M10.2 16h3.6"/><path d="M8.3 11.5C5.6 13.4 4.6 17 5.2 21c2-1 4.3-2.3 6.8-2M15.7 11.5c2.7 1.9 3.7 5.5 3.1 9.5-2-1-4.3-2.3-6.8-2"/>',
      milpa: '<path d="M3 21h18M12 21V4"/><path d="M12 10C9 9.2 7 7.2 6 4c3 0 5 2 6 5M12 14c3-.8 5-2.8 6-6-3 0-5 2-6 5"/><path d="M5.5 21c0-2.2 1.6-3.8 3.5-3.8M18.5 21c0-2.2-1.6-3.8-3.5-3.8"/>',
      gota: '<path d="M12 3c3.6 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11z"/><path d="M9.4 14.6A2.6 2.6 0 0 0 12 17.2"/>',
      fibra: '<path d="M12 3v18M4.5 19.5C8.5 18 10.5 12 12 3c1.5 9 3.5 15 7.5 16.5"/><path d="M7.5 13.5c1.6.8 3 1.2 4.5 1.2s2.9-.4 4.5-1.2M9 9c1 .5 2 .7 3 .7s2-.2 3-.7"/>',
      flor: '<circle cx="12" cy="9" r="2.3"/><path d="M12 6.7V3.5M14.2 8.2l3-1M13.4 10.9l1.9 2.6M10.6 10.9l-1.9 2.6M9.8 8.2l-3-1"/><path d="M12 11.3V21M12 17.5c-2 0-3.6-1-4.3-2.6M12 16.2c2 0 3.6-1 4.3-2.6"/>',
      hoja: '<path d="M5 19.5C4.6 11 9.8 5 20 4.5c.4 10.2-5.6 15.4-14 15.2"/><path d="M5 19.5 14 10.5M9.5 15h4M12 12.5V9"/>',
      basamento: '<path d="M3 20h18M5 20v-3.5h14V20M7.5 16.5V13h9v3.5M10 13V9.5h4V13"/><path d="M10.5 9.5V6h3v3.5M12 13v7"/>',
      glifo: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9.2" r="1.3"/><circle cx="15" cy="9.2" r="1.3"/><path d="M8 13.8h8M8 16.8h5"/>',
      copal: '<path d="M5.5 14.5h13L17 20H7z"/><path d="M12 12c-2-1.4-2-2.9 0-4.4s2-3 0-4.6M8.6 12c-1.2-.9-1.2-1.9 0-2.9M15.4 12c1.2-.9 1.2-1.9 0-2.9"/>',
      telar: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m12 7 4.5 5-4.5 5-4.5-5z"/><path d="M4 12h3.5M16.5 12H20M12 4v3M12 17v3"/>',
      voluta: '<path d="M5.2 14A7 7 0 1 1 12 20"/><path d="M12 20c-2.6 0-4.5-1.6-4.5-3.9 0-2 1.6-3.4 3.4-3.4 1.5 0 2.6 1 2.6 2.3 0 1.2-.9 2-2 2"/>'
    };
    const icono = (amb, cls) => `<svg class="${cls || "ic"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[AMB[amb].icono] || ""}</svg>`;
    const colorAmb = (amb) => `--c0:${AMB[amb].color}`;

    const tagSolidez = (s) => (s ? `<span class="tag ${s}" title="${esc(SOL[s].texto)}">${esc(SOL[s].nombre)}</span>` : "");
    const vstate = (v) => `<span class="vstate ${v}" title="${esc(VER[v].texto)}"><i></i>${esc(VER[v].nombre)}</span>`;
    const tagDoc = (d) => `<span class="tag doc ${d}" title="${esc(DOC[d].texto)}">${esc(DOC[d].nombre)}</span>`;
    const marcasActos = (actos) => `<span class="actos" aria-label="${L("Actos", "Acts")}: ${esc(actos.map((a) => ACTO[a].nombre).join(", ") || L("ninguno", "none"))}">${C.actos
      .map((a) => `<span class="acto${actos.includes(a.id) ? " on" : ""}" title="${esc(a.nombre)}">${a.marca}</span>`).join("")}</span>`;

    const tip = (html) => `data-tip="${esc(html)}"`;
    const yLista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")}${L(" y ", " and ")}${xs[xs.length - 1]}`);
    const nombrePueblo = (id) => (PUEBLO[id] ? PUEBLO[id].nombre : id);
    const chipPueblo = (id) => `<a class="chip" href="#/pueblo/${id}">${esc(nombrePueblo(id))}</a>`;
    const despojoDe = (f) => ({ casos: (CASOS_DE[f.id] || []).map((id) => CASO[id]), nombres: f.nombres_mundo.filter((n) => BORRA.has(n.forma)) });
    const VERBO = L(
      { nativo: "la especie es nativa de aquí", domesticado: "aquí se domesticó", creado: "aquí se inventó o se creó", nombrado: "el nombre que usa el mundo viene de aquí" },
      { nativo: "the species is native here", domesticado: "it was domesticated here", creado: "it was invented or created here", nombrado: "the name the world uses comes from here" });
    const AHORA = new Date().getFullYear();
    function hace(f) {
      if (!/\d/.test(f.fecha.texto)) return "";
      const n = AHORA - f.fecha.anio;
      if (n < 2) return "";
      const r = n > 1000 ? Math.round(n / 100) * 100 : n > 100 ? Math.round(n / 10) * 10 : n;
      return L(`hace ${n > 100 ? "unos " : ""}${fmt(r)} años`, `${n > 100 ? "about " : ""}${fmt(r)} years ago`);
    }
    const alcTag = (id, extra) => `<span class="alc ${id}" title="${esc(ALC[id].texto)}">${esc(ALC[id].nombre)}${extra || ""}</span>`;

    // Fotografías: miniaturas de Wikimedia Commons con licencia libre, comprobadas por procedencia.py medios.
    function foto(f, cls, prioridad) {
      const i = f.imagen;
      if (!i) return `<span class="foto vacia ${cls || ""}">${icono(f.ambito, "")}</span>`;
      const url = i.url.split("?")[0];
      // Las miniaturas de Commons existen en anchos fijos: se pide la menor que llene el espacio.
      const srcset = url.includes("/960px-") ? ` srcset="${[330, 500, 960].map((w) => `${esc(url.replace("/960px-", `/${w}px-`))} ${w}w`).join(", ")}" sizes="${cls === "grande" ? "(max-width: 820px) 100vw, 560px" : cls === "mini" ? "44px" : "(max-width: 600px) 100vw, 360px"}"` : "";
      const carga = prioridad ? ' fetchpriority="high"' : ' loading="lazy"';
      return `<span class="foto ${cls || ""}"><img src="${esc(cls === "mini" && srcset ? url.replace("/960px-", "/330px-") : url)}"${srcset} alt="${L("Imagen", "Image")}: ${esc(f.nombre)}"${carga} decoding="async"></span>`;
    }
    const credito = (i) => (i ? `<span class="credito">${i.autor ? esc(i.autor.slice(0, 90)) : L("Autor no declarado", "Author not stated")} · ${esc(i.licencia)} · <a href="${esc(i.pagina)}" target="_blank" rel="noopener">Wikimedia Commons</a></span>` : "");

    const ICONOS_PASO = {
      grano: '<path d="M12 4c3 2 4 5 4 8s-1.6 6-4 8c-2.4-2-4-5-4-8s1-6 4-8z"/><path d="M12 8v8"/>',
      fuego: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-4 2.5-5 0 2 1 3 2 3 0-3-.5-5 .5-8z"/>',
      metate: '<path d="M3 15h18l-2 4H5z"/><path d="M7 15l1-3h8l1 3"/><rect x="6" y="7" width="12" height="3" rx="1.5"/>',
      frijol: '<path d="M8 6c3-2 8-1 9 3s-1 6-3 7-3 3-6 2-4-4-3-7 1-4 3-5z"/><path d="M10.5 10.5c1 1 2.2 1 3.2 0"/>',
      calabaza: '<path d="M12 7c-5 0-8 3-8 7s3 6 8 6 8-2 8-6-3-7-8-7z"/><path d="M12 7c-2 3-2 10 0 13M12 7c2 3 2 10 0 13M12 7V4l2-1"/>',
      suelo: '<path d="M3 11h18"/><path d="M6 15h2M11 17h2M16 15h2M8 20h2M14 20h2"/><path d="M12 11V4M12 7l3-2M12 8 9 6"/>',
      nopal: '<ellipse cx="12" cy="15.5" rx="4" ry="5.5"/><ellipse cx="7" cy="7" rx="2.5" ry="3.6"/><ellipse cx="17" cy="7" rx="2.5" ry="3.6"/>',
      insecto: '<ellipse cx="12" cy="13" rx="5" ry="6"/><path d="M12 7V4M7 10 4 8M17 10l3-2M7 15l-3 1M17 15l3 1M8 19l-2 2M16 19l2 2"/>',
      sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
      frasco: '<path d="M9 3h6M10 3v5l-4 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-9V3"/><path d="M7.5 14h9"/>',
      jarra: '<path d="M7 6h10l-1 13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2.3"/><path d="M9 3.5c1 1 2 1 3 0s2-1 3 0"/>',
      teocintle: '<path d="M12 21V3"/><path d="M12 8l-3-2M12 11l3-2M12 14l-3-2M12 17l3-2"/><path d="M5 21c1-5 3-8 7-10M19 21c-1-5-3-8-7-10"/>',
      manos: '<path d="M7 20v-6l-3-4 2-1 3 3V5a1.2 1.2 0 0 1 2.4 0v6M11.4 4a1.2 1.2 0 0 1 2.4 0v7M13.8 5a1.2 1.2 0 0 1 2.4 0v7M16.2 8a1.2 1.2 0 0 1 2.4 0v6c0 3-2 6-5 6H7"/>',
      mundo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
      raiz: '<path d="M12 3v7"/><path d="M8 4c0 3 2 5 4 6 2-1 4-3 4-6"/><ellipse cx="12" cy="14" rx="5" ry="4"/><path d="M10 18l-2 3M14 18l2 3M12 18v3"/>',
      pildora: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-30 12 12.5)"/><path d="M10.3 8.4l3.4 8.2"/>',
      arbol: '<path d="M12 21v-7"/><circle cx="12" cy="9" r="6"/><path d="M12 14l-3-3M12 12l3-2"/>',
      piedra: '<path d="M5 16c-1-4 2-8 7-8s8 3 7 7-4 5-7 5-6-1-7-4z"/><path d="M3 21h18"/>',
      arcilla: '<path d="M4 18c0-5 4-9 8-9s8 4 8 9z"/><path d="M8 14h1M12 12h1M15 15h1"/>',
      muro: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14.5h18M9 5v5M15 5v5M6 10v4.5M12 10v4.5M18 10v4.5M9 14.5V19M15 14.5V19"/>'
    };
    Object.assign(ICONOS_PASO, { maiz: ICONOS.mazorca, mazorca: ICONOS.mazorca, flor: ICONOS.flor, hoja: ICONOS.hoja, agua: ICONOS.gota });
    const iconoPaso = (k, n) => (ICONOS_PASO[k] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_PASO[k]}</svg>` : `<b>${n}</b>`);

    // ------------------------------------------------------------ verificación agregada
    function afirmacionesDe(f) {
      const out = [];
      if (f.veredicto) out.push(f.veredicto);
      (f.afirmaciones || []).forEach((a) => out.push(a));
      (f.nombres_mundo || []).forEach((n) => n.fuentes && out.push(n));
      if (f.expediente) {
        (f.expediente.contrapuntos || []).forEach((c) => out.push(c));
        if (f.expediente.comparacion) out.push(f.expediente.comparacion);
      }
      return out.filter((a) => a.verificacion);
    }
    function conteoVerif(lista) {
      const n = { comprobada: 0, citada: 0, pendiente: 0 };
      lista.forEach((f) => afirmacionesDe(f).forEach((a) => n[a.verificacion]++));
      return n;
    }
    function vbar(n, cls) {
      const t = n.comprobada + n.citada + n.pendiente || 1;
      const titulo = L(`${n.comprobada} con fuente comprobada, ${n.citada} citadas, ${n.pendiente} pendientes`, `${n.comprobada} with a verified source, ${n.citada} cited, ${n.pendiente} pending`);
      return `<span class="${cls || "vbar"}" role="img" aria-label="${titulo}" ${tip(`<b>${L("Afirmaciones", "Claims")}</b>${titulo}`)}>${["comprobada", "citada", "pendiente"]
        .filter((k) => n[k]).map((k) => `<span class="${k}" style="flex:${n[k] / t}">${cls === "stack" && n[k] / t > 0.06 ? n[k] : ""}</span>`).join("")}</span>`;
    }

    // ------------------------------------------------------------ mapas
    const GM = D.geo.mexico, GW = D.geo.mundo;
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    function ptMundo(lat, lon) {
      const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
      const t = Math.asin(M * Math.sin(p)), t2 = t * t, t6 = t2 * t2 * t2;
      const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
      const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
      return [(x + GW.xmax) * GW.escala, (GW.ymax - y) * GW.escala];
    }
    const ptMexico = (lat, lon) => [(lon - GM.lon0) * GM.k * GM.escala, (GM.lat1 - lat) * GM.escala];
    const dentroMexico = (lat, lon) => { const [x, y] = ptMexico(lat, lon); return x >= 0 && y >= 0 && x <= GM.ancho && y <= GM.alto; };
    const r1 = (n) => Math.round(n * 10) / 10;

    function tierras(geo, claseDe) {
      return Object.entries(geo.regiones).map(([cod, d]) => {
        const extra = claseDe ? claseDe(cod) : cod.startsWith("MX") ? " mx" : "";
        return `<path class="land${extra}" d="${d}"><title>${esc(geo.nombres[cod] || cod)}</title></path>`;
      }).join("");
    }
    function arco(a, b, cls) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1, k = Math.min(0.25 * len, 90);
      const c = [mx, my - k];
      return `<path class="arc ${cls || ""}" d="M${r1(a[0])},${r1(a[1])} Q${r1(c[0])},${r1(c[1])} ${r1(b[0])},${r1(b[1])}"/>`;
    }
    function svgMexico(puntos, opts = {}) {
      const etiq = opts.etiquetas ? puntos.filter((p) => p.lbl).map((p) => { const [x, y] = ptMexico(p.lat, p.lon); return `<text class="lbl" x="${r1(x + 10)}" y="${r1(y + 4)}">${esc(p.lbl)}</text>`; }).join("") : "";
      return `<svg class="map" viewBox="0 0 ${GM.ancho} ${GM.alto}" role="img" aria-label="${esc(opts.aria || L("Mapa de México", "Map of Mexico"))}">
        <rect width="${GM.ancho}" height="${GM.alto}" fill="var(--water)"/>${tierras(GM)}
        ${puntos.map((p) => { const [x, y] = ptMexico(p.lat, p.lon); return `<circle class="pt ${p.cls || ""}" cx="${r1(x)}" cy="${r1(y)}" r="${p.r || 7}" ${p.href ? `data-href="${p.href}"` : ""} ${p.tip ? tip(p.tip) : ""} ${p.attrs || ""}/>`; }).join("")}
        ${etiq}</svg>`;
    }

    // ------------------------------------------------------------ fuentes y notas
    function refFuente(f) {
      const enlace = f.doi ? `<a href="https://doi.org/${esc(f.doi)}" rel="noopener" target="_blank">doi:${esc(f.doi)}</a>`
        : f.url ? `<a href="${esc(f.url)}" rel="noopener" target="_blank">${esc(f.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 60))}</a>` : "";
      return `${esc(f.autores)} (${f.anio < 0 ? anio(f.anio) : esc(f.anio)}). <i>${esc(f.titulo)}</i>${f.publicacion ? `. ${esc(f.publicacion)}` : ""}.${enlace ? ` ${enlace}` : ""}${f.nota ? ` <span class="muted">${esc(f.nota)}</span>` : ""}`;
    }
    const RES = {
      ok: (c) => (c.metodo === "crossref" ? L("Registro comprobado en Crossref", "Record verified in Crossref") : L("La página responde", "The page responds")),
      discrepancia: () => L("El registro no coincide", "The record does not match"),
      error: () => L("El enlace falla", "The link fails"),
      bloqueada: () => L("El sitio no admite comprobación automática", "The site does not allow automatic checking"),
      sin_enlace: () => L("Sin enlace: comprobar a mano", "No link: check by hand"),
      sin_comprobar: () => L("Aún sin comprobar", "Not checked yet")
    };
    function resFuente(f) {
      const c = f.comprobacion || { resultado: "sin_comprobar" };
      const det = c.metodo === "crossref" && c.titulo_registrado ? `<b>${L("Crossref registra", "Crossref records")}</b>${esc(c.titulo_registrado)} (${esc(c.anio_registrado)}). ${L("Parecido del título", "Title similarity")}: ${Math.round((c.parecido || 0) * 100)} %.` : `<b>${RES[c.resultado](c)}</b>${c.fecha ? L(`Comprobado el ${esc(c.fecha)}.`, `Checked on ${esc(c.fecha)}.`) : ""}`;
      return `<span class="res ${c.resultado}" ${tip(det)}><i></i>${RES[c.resultado](c)}</span>`;
    }
    // Numera las fuentes en el orden en que se citan dentro de una página.
    function notas() {
      const orden = [];
      const numero = (id) => {
        let n = orden.indexOf(id) + 1;
        if (!n) { orden.push(id); n = orden.length; }
        return n;
      };
      return {
        numero,
        total: () => orden.length,
        cita(ids) {
          return (ids || []).map((id) => {
            const n = numero(id);
            const f = FUENTE[id];
            return `<button class="cite" type="button" data-fn="${n}" ${tip(`<b>${esc(f.autores)} (${esc(f.anio)})</b>${esc(f.titulo)}`)}>${n}</button>`;
          }).join("");
        },
        lista(sinTitulo) {
          if (!orden.length) return "";
          return `${sinTitulo ? "" : `<h2 class="sub" id="fuentes">${L("Fuentes", "Sources")} <span class="n">${orden.length}</span></h2>`}<ol class="footnotes">${orden.map((id, i) => `<li id="fn-${i + 1}"><span class="num">${i + 1}</span><div><div class="ref">${refFuente(FUENTE[id])}</div><div>${resFuente(FUENTE[id])} <span class="muted small">· ${esc(TFUENTE[FUENTE[id].tipo].nombre)}</span></div></div></li>`).join("")}</ol>`;
        }
      };
    }
    function afirmacion(a, N, extra) {
      return `<li class="claim ${a.verificacion}"><p>${esc(a.texto)}${N.cita(a.fuentes)}</p><div class="meta">${tagSolidez(a.solidez)}${vstate(a.verificacion)}${extra || ""}</div></li>`;
    }

    // ------------------------------------------------------------ tarjetas
    function tarjeta(f, tam) {
      const o = f.originales[0];
      const d = despojoDe(f);
      return `<a class="card ac ${f.clase} ${f.documentacion} ${tam || ""}" href="#/ficha/${f.id}" style="${colorAmb(f.ambito)}">
        <span class="foto-wrap">${foto(f)}${alcTag(f.alcance)}${o ? `<span class="orig-sobre">${esc(o.forma)}</span>` : ""}</span>
        <span class="cuerpo">
          <span class="top">${icono(f.ambito, "")}<span>${esc(AMB[f.ambito].nombre)}</span></span>
          <h3>${esc(f.nombre)}</h3>
          ${o ? `<span class="lengua">${esc(o.lengua)}${o.glosa ? ` · «${esc(o.glosa)}»` : ""}</span>` : ""}
          <span class="ver">${esc(f.en_breve)}</span>
          <span class="meta">${f.clase === "deslinde" ? `<span class="tag deslinde">${L("No se reclama", "Not claimed")}</span>` : ""}${d.casos.length ? `<span class="tag despojo">${L("Despojo documentado", "Documented dispossession")}</span>` : d.nombres.length ? `<span class="tag doc borra">${L("Nombre que borra su origen", "Name that erases its origin")}</span>` : ""}${vstate(f.veredicto.verificacion || "pendiente")}</span>
        </span>
      </a>`;
    }
    function chipFicha(id) {
      const f = FICHA[id];
      return f ? `<a class="chip" href="#/ficha/${id}"><span class="sw" style="background:${AMB[f.ambito].color}"></span>${esc(f.nombre)}</a>` : "";
    }
    function tarjetaCaso(c, conFoto) {
      const fi = conFoto && c.fichas.map((id) => FICHA[id]).find((f) => f && f.imagen);
      return `<a class="case${fi ? " con-foto" : ""}" href="#/caso/${c.id}" style="--c:${COLOR_CASO[c.tipo]}">
        ${fi ? foto(fi) : ""}
        <span class="state">${esc(TCASO[c.tipo].nombre)} · ${esc(ECASO[c.estado].nombre)}</span>
        <span class="yr">${esc(c.fecha.texto)}</span><h3>${esc(c.titulo)}</h3><p>${esc(c.resumen)}</p>
        ${c.reclamo ? `<p class="reclamo"><b>${L("Se reclama", "We demand")}:</b> ${esc(c.reclamo)}</p>` : ""}
        <span class="muted small">${esc(c.lugar)}</span></a>`;
    }

    // ------------------------------------------------------------ portada
    // El anuncio de «Lo que aún se niega» en la portada, con tres láminas del relato.
    function anuncioCuenta() {
      const laminas = ["cuenta-ciudad", "cuenta-tributo", "cuenta-borrado"].map((id) => CAP[id] && CAP[id].lamina).filter(Boolean);
      if (!laminas.length) return "";
      return `<section class="anuncio-cuenta"><div class="wrap">
        <a class="ac-caja" href="#/cuenta">
          <span class="ac-texto">
            <span class="eyebrow">${L(`Un relato en ${CUENTA.capitulos.length} actos`, `A story in ${CUENTA.capitulos.length} acts`)}</span>
            <b class="ac-t">${esc(CUENTA.titulo)}</b>
            <span class="ac-p">${L("La riqueza que se sacó de México durante la Colonia, el trabajo forzado del pueblo indígena que la hizo posible y a dónde fue a parar. Contada con códices de la época, y con la fuente de cada dato a un clic. México lo enseña en sus escuelas; fuera de aquí, todavía se niega o se ignora.", "The wealth taken from Mexico during the colonial era, the forced labor of Indigenous people that made it possible, and where it ended up. Told with codices of the period, with the source of every fact one click away. Mexico teaches it in its schools; elsewhere it is still denied or ignored.")}</span>
            <span class="btn primary">${L("Leer el relato", "Read the story")}</span>
          </span>
          <span class="ac-laminas" aria-hidden="true">${laminas.map((l, i) => `<img class="l${i}" src="${esc(l.archivo)}" alt="" loading="lazy" decoding="async">`).join("")}</span>
        </a>
      </div></section>`;
    }
    function vistaPortada() {
      const m = D.metricas;
      const aportes = D.fichas.filter((f) => f.clase === "aporte");
      const af = m.afirmaciones;
      const okF = m.fuentes_por_resultado.ok || 0;
      const mundial = D.fichas.filter((f) => f.alcance === "mundial").sort(porAlcance);
      const amplio = D.fichas.filter((f) => f.alcance === "amplio").sort(porAlcance);
      const casosDe = (t) => D.casos.filter((c) => c.tipo === t);
      const borrados = D.fichas.reduce((n, f) => n + f.nombres_mundo.filter((x) => BORRA.has(x.forma)).length, 0);
      const destacados = D.casos.filter((c) => c.tipo === "saber_borrado").slice(0, 3).concat(D.casos.filter((c) => c.tipo === "biopirateria").slice(0, 1));
      const ejes = [
        [L("Ámbito", "Field"), L("¿Para qué le sirve al mundo?", "What does it do for the world?"), C.ambitos.map((a) => a.nombre).join(" · "), L("Navegación principal: cada ficha está en uno solo.", "Main navigation: each entry belongs to only one.")],
        [L("Alcance", "Reach"), C.pregunta_alcance, C.alcance.map((a) => a.nombre).join(" · "), L("Ordena la página: lo que más cambió al mundo va primero.", "It orders the page: what changed the world most comes first.")],
        [L("Naturaleza", "Nature"), C.pregunta_naturaleza, C.naturalezas.map((a) => a.nombre).join(" · ")],
        [L("Actos", "Acts"), C.pregunta_actos, C.actos.map((a) => `${a.marca} ${a.nombre}`).join(" · ")],
        [L("Territorio", "Territory"), C.pregunta_territorio, C.territorios.map((a) => a.nombre).join(" · ")],
        [L("Época", "Period"), C.pregunta_epoca, C.epocas.map((a) => a.nombre).join(" · ")],
        [L("Solidez", "Strength"), C.pregunta_solidez, C.solidez.map((a) => a.nombre).join(" · "), L("Va en cada afirmación, no en la ficha.", "It goes on each claim, not on the entry.")],
        [L("Verificación", "Verification"), C.pregunta_verificacion, C.verificacion.map((a) => a.nombre).join(" · "), L("La calcula el verificador.", "The checker computes it.")]
      ];
      const max = Math.max(...C.ambitos.flatMap((a) => C.actos.map((t) => aportes.filter((f) => f.ambito === a.id && f.actos.includes(t.id)).length)));
      const nivel = (n) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
      const filas = C.ambitos.map((a) => `<tr><th scope="row"><span style="color:${a.color}">●</span> ${esc(a.nombre)}</th>${C.actos.map((t) => {
        const n = aportes.filter((f) => f.ambito === a.id && f.actos.includes(t.id)).length;
        return n ? `<td class="l${nivel(n)}" data-href="#/explorar?ambito=${a.id}&actos=${t.id}" ${tip(`<b>${esc(a.nombre)} · ${esc(t.nombre)}</b>${plural(n, L("aporte", "contribution"), L("aportes", "contributions"))}`)}>${n}</td>` : '<td class="z">·</td>';
      }).join("")}</tr>`).join("");
      const expedientes = D.fichas.filter((f) => f.documentacion === "expediente");
      const vacios = D.fichas.filter((f) => f.documentacion === "inventario").length;

      return `
      <section class="hero"><div class="wrap">
        <div>
          <p class="eyebrow">${L("Patrimonio de México y de sus pueblos", "The heritage of Mexico and its peoples")}</p>
          <h1>${L("Lo que el mundo recibió de <em>aquí</em>, y lo que se les quitó.", "What the world received from <em>here</em>, and what was taken from them.")}</h1>
          <p class="lede">${L(`${fmt(m.aportes)} aportes, del maíz al cero, ordenados por cuánto cambiaron al mundo. Cada uno con su nombre en la lengua de quienes lo crearon, y cada afirmación con una fuente que se puede comprobar.`, `${fmt(m.aportes)} contributions, from maize to zero, ordered by how much they changed the world. Each one carries its name in the language of those who created it, and each claim a source that can be checked.`)}</p>
          <div class="cta"><a class="btn primary" href="#/explorar">${L("Ver los aportes", "See the contributions")}</a><a class="btn" href="#/cuenta">${L("Lo que aún se niega", "What is still denied")}</a></div>
        </div>
        <div class="mosaico" aria-label="${L("Aportes que cambiaron al mundo", "Contributions that changed the world")}">${mundial.filter((f) => f.imagen).slice(0, 6).map((f, i) => `<a href="#/ficha/${f.id}" class="tesela t${i}">${foto(f, i === 0 ? "grande" : "", i < 3)}<span><b>${esc(f.originales[0] ? f.originales[0].forma : f.nombre)}</b>${esc(f.nombre)}</span></a>`).join("")}</div>
      </div></section>
      <div class="numbers"><div class="wrap"><dl>
        <div><dd>${fmt(mundial.length)}</dd><dt>${L("aportes que hoy usa buena parte de la humanidad", "contributions much of humanity uses today")}</dt></div>
        <div><dd>${fmt(m.nombres_originarios)}</dd><dt>${L("nombres en lenguas originarias rescatados", "names in Indigenous languages recovered")}</dt></div>
        <div><dd>${fmt(m.casos)}</dd><dt>${L("casos de despojo documentados", "documented cases of dispossession")}</dt></div>
        <div><dd>${fmt(okF)}<span style="font-size:.55em;color:var(--muted)"> / ${fmt(m.fuentes)}</span></dd><dt>${L("fuentes comprobadas en línea", "sources checked online")}</dt></div>
      </dl></div></div>

      ${anuncioCuenta()}

      <section class="block"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${esc(ALC.mundial.nombre)}</p><h2>${L("Sin esto, el mundo comería, vestiría y hablaría distinto", "Without these, the world would eat, dress and speak differently")}</h2>
          <p>${esc(ALC.mundial.texto)} ${L("Están primero porque su influencia es mayor; debajo de cada nombre, el original.", "They come first because their influence is greatest; under each name, the original one.")}</p></div>
        <div class="grid g-grande">${mundial.map((f) => tarjeta(f, "grande")).join("")}</div>
      </div></section>

      <section class="postura"><div class="wrap">
        <p class="eyebrow">${L("Postura", "Our stance")}</p><h2>${esc(C.postura.titulo)}</h2><p>${esc(C.postura.texto)}</p>
        <p style="margin-top:14px"><a href="#/metodo">${L("Cómo se prueba cada reclamo", "How each claim is proven")}</a></p>
      </div></section>

      <section class="block"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("Lo que se les quitó", "What was taken from them")}</p><h2>${L("Se llevaron el producto y dejaron fuera a quienes lo crearon", "They took the product and left out those who created it")}</h2>
          <p>${L(`El hule procesado 3,400 años antes de la patente de Goodyear; el maíz sin la cal que lo hacía seguro; plantas patentadas sin permiso; diseños copiados; códices quemados. Y ${fmt(borrados)} nombres que el mundo usa y que borran de dónde viene lo nombrado.`, `Rubber processed 3,400 years before Goodyear's patent; maize without the lime that made it safe; plants patented without permission; copied designs; burned codices. And ${fmt(borrados)} names the world uses that erase where the named thing comes from.`)}</p></div>
        <div class="despojo-tipos">${TIPOS_CASO.map((t) => `<a class="dt-tipo" href="#/despojo#t-${t.id}" style="--c:${COLOR_CASO[t.id]}"><span class="n">${casosDe(t.id).length}</span><b>${esc(t.nombre)}</b><span>${esc(t.pregunta)}</span></a>`).join("")}
          <a class="dt-tipo" href="#/nombres" style="--c:var(--ink-2)"><span class="n">${fmt(borrados)}</span><b>${L("Nombres ajenos", "Foreign names")}</b><span>${L("¿El nombre que usa el mundo señala otro país, otra persona o un sintético?", "Does the name the world uses point to another country, another person or a synthetic?")}</span></a></div>
        <div class="case-list" style="margin-top:18px">${destacados.map((c) => tarjetaCaso(c, true)).join("")}</div>
        <p style="margin-top:16px"><a class="btn primary" href="#/despojo">${L("Ver todo lo que se les quitó", "See everything that was taken from them")}</a></p>
      </div></section>

      <section class="block alt"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${esc(ALC.amplio.nombre)}</p><h2>${L("Lo que se usa en muchos países", "What is used in many countries")}</h2>
          <p>${esc(ALC.amplio.texto)}</p></div>
        <div class="grid">${amplio.slice(0, 12).map((f) => tarjeta(f)).join("")}</div>
        <p style="margin-top:16px"><a class="btn" href="#/explorar">${L(`Ver los ${fmt(m.fichas)} por alcance`, `See all ${fmt(m.fichas)} by reach`)}</a></p>
      </div></section>

      <section class="block"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("Quiénes", "Who")}</p><h2>${L("Los pueblos detrás de cada aporte", "The peoples behind each contribution")}</h2>
          <p>${L("Los olmecas, la primera gran civilización de Mesoamérica, vivieron en lo que hoy es Veracruz y Tabasco. Su centro de San Lorenzo sirvió de modelo a los primeros centros mayas; el cero y la escritura aparecen primero en su tierra.", "The Olmec, the first great civilization of Mesoamerica, lived in what is now Veracruz and Tabasco. Their center at San Lorenzo served as a model for the first Maya centers; zero and writing appear first in their land.")}</p></div>
        ${linaje()}
        <div class="related" style="margin-top:16px">${D.pueblos.map((p) => chipPueblo(p.id)).join("")}</div>
      </div></section>

      <section class="block alt"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("Diez ámbitos", "Ten fields")}</p><h2>${L("¿Para qué le sirve al mundo?", "What does it do for the world?")}</h2>
          <p>${L('Cada ficha pertenece a un solo ámbito. La barra muestra cuántas de sus afirmaciones tienen la fuente <span class="vstate comprobada"><i></i>comprobada</span>, <span class="vstate citada"><i></i>citada</span> o <span class="vstate pendiente"><i></i>pendiente</span>.', 'Each entry belongs to a single field. The bar shows how many of its claims have a <span class="vstate comprobada"><i></i>verified</span>, <span class="vstate citada"><i></i>cited</span> or <span class="vstate pendiente"><i></i>pending</span> source.')}</p></div>
        <div class="ambitos">${C.ambitos.map((a) => {
          const fs = D.fichas.filter((f) => f.ambito === a.id);
          return `<a class="amb ac" href="#/explorar?ambito=${a.id}" style="${colorAmb(a.id)}">${icono(a.id)}<h3>${esc(a.nombre)}</h3><span class="q">${esc(a.pregunta)}</span>
            <span class="foot"><span>${plural(fs.length, L("ficha", "entry"), L("fichas", "entries"))}</span></span>${vbar(conteoVerif(fs))}</a>`;
        }).join("")}</div>
      </div></section>

      <section class="block"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("El sistema", "The system")}</p><h2>${L("Cada pregunta en su eje", "Each question on its own axis")}</h2>
          <p>${L("Una ficha por cosa aportada. Cada eje responde una sola pregunta, para que las categorías no se confundan: dónde está la evidencia más antigua es una cosa; qué tan seguros estamos, otra.", "One entry per contributed thing. Each axis answers a single question, so the categories do not blur: where the oldest evidence lies is one thing; how sure we are, another.")}</p></div>
        <div class="system">
          <div class="ent"><span class="n">${fmt(m.fichas)}</span><h3>${L("Fichas", "Entries")}</h3><p>${L("Una por cosa aportada: una planta, una técnica, una obra.", "One per contributed thing: a plant, a technique, a work.")}</p></div>
          <div class="ent"><span class="n">${fmt(m.afirmaciones_total)}</span><h3>${L("Afirmaciones", "Claims")}</h3><p>${L("La unidad de verdad. Cada una tiene su solidez y sus fuentes.", "The unit of truth. Each one has its strength and its sources.")}</p></div>
          <div class="ent"><span class="n">${fmt(m.fuentes)}</span><h3>${L("Fuentes", "Sources")}</h3><p>${L("Cada DOI se comprueba en Crossref y cada enlace en línea.", "Each DOI is checked in Crossref and each link online.")}</p></div>
          <div class="ent"><span class="n">${fmt(m.pueblos)}</span><h3>${L("Pueblos", "Peoples")}</h3><p>${L("Quiénes lo crearon, con su nombre propio y su lengua.", "Who created it, with their own name and their language.")}</p></div>
        </div>
        <div class="axes">${ejes.map(([n, q, v, nota]) => `<div class="axis"><b>${esc(n)}</b><div class="q">${esc(q)}</div><div class="vals">${esc(v)}</div>${nota ? `<div class="vals" style="margin-top:4px;color:var(--accent)">${esc(nota)}</div>` : ""}</div>`).join("")}</div>
        <h3 style="margin-top:34px">${L("Ámbito por acto", "Field by act")}</h3>
        <p class="muted" style="margin:4px 0 12px">${L("Un aporte puede reunir varios actos: el maíz es nativo, domesticado y nombrado. Toca una celda para ver esas fichas.", "A contribution can combine several acts: maize is native, domesticated and named. Tap a cell to see those entries.")}</p>
        <div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>${C.actos.map((t) => `<th scope="col" title="${esc(t.texto)}">${t.marca} · ${esc(t.nombre)}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>
        <div class="legend"><span>${L("Menos", "Fewer")}</span><span class="ramp">${[1, 2, 3, 4, 5].map((i) => `<i class="l${i}"></i>`).join("")}</span><span>${L("Más aportes", "More contributions")}</span></div>
      </div></section>

      <section class="block alt"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("Expedientes", "Dossiers")}</p><h2>${L("Donde otro país reclama el origen", "Where another country claims the origin")}</h2>
          <p>${L(`Un expediente expone el argumento contrario y lo rebate con las mismas cinco líneas de evidencia para México y para la otra región. Hay ${expedientes.length}; ${plural(vacios, "ficha sigue", "fichas siguen")} en investigación.`, `A dossier lays out the opposing argument and rebuts it with the same five lines of evidence for Mexico and for the other region. There are ${expedientes.length}; ${plural(vacios, "entry is", "entries are")} still under research.`)}</p></div>
        <div class="grid">${expedientes.map((f) => tarjeta(f)).join("")}</div>
      </div></section>

      <section class="block"><div class="wrap">
        <div class="section-head"><p class="eyebrow">${L("Fe de erratas", "Errata")}</p><h2>${L("Lo que la verificación corrigió", "What verification corrected")}</h2>
          <p>${L("Al buscar las fuentes, varias afirmaciones cambiaron. Se publican junto con lo que decían.", "While looking for sources, several claims changed. They are published alongside what they used to say.")}</p></div>
        ${erratas(D.erratas.slice(-4).reverse())}
        <p style="margin-top:16px"><a class="btn" href="#/metodo/erratas">${L(`Ver las ${D.erratas.length} correcciones`, `See all ${D.erratas.length} corrections`)}</a></p>
      </div></section>`;
    }
    // Periodos de los pueblos con fechas sustentadas, y quién heredó de quién.
    function linaje() {
      const ps = D.pueblos.filter((p) => p.inicio != null).sort((a, b) => a.inicio - b.inicio);
      const W = 900, izq = 130, der = 20, fila = 30, top = 30, a0 = -2000, a1 = AHORA;
      const X = (y) => izq + ((y - a0) / (a1 - a0)) * (W - izq - der);
      const H = top + ps.length * fila + 26;
      const Y = (i) => top + i * fila;
      const ticks = [-2000, -1000, 0, 1000, 2000].map((y) => `<line class="tick" x1="${X(y)}" x2="${X(y)}" y1="${top - 10}" y2="${H - 22}"/><text class="tick-lbl" x="${X(y)}" y="${H - 6}" text-anchor="middle">${y < 0 ? fmt(-y) + L(" a.C.", " BCE") : y === 0 ? "0" : y}</text>`).join("");
      const barras = ps.map((p, i) => {
        const x0 = X(p.inicio), x1 = X(p.fin == null ? a1 : p.fin);
        return `<g data-href="#/pueblo/${p.id}" ${tip(`<b>${esc(p.nombre)}</b><span class="k">${esc(p.periodo)}</span><br>${esc(p.en_breve)}`)} style="cursor:pointer">
          <text class="lane-lbl" x="${izq - 10}" y="${Y(i) + 15}" text-anchor="end">${esc(p.nombre)}</text>
          <rect class="periodo${p.fin == null ? " vivo" : ""}" x="${r1(x0)}" y="${Y(i) + 5}" width="${r1(Math.max(4, x1 - x0))}" height="16" rx="4"/></g>`;
      }).join("");
      const flechas = ps.flatMap((p, i) => (p.heredan || []).map((h) => {
        const j = ps.findIndex((q) => q.id === h);
        if (j < 0) return "";
        const x = X(ps[j].inicio) + 6;
        return `<path class="hereda" d="M${r1(X(p.inicio) + 30)},${Y(i) + 21} C${r1(X(p.inicio) + 30)},${Y(j) + 4} ${r1(x - 20)},${Y(j) + 13} ${r1(x)},${Y(j) + 13}" marker-end="url(#punta)"/>`;
      })).join("");
      return `<figure class="linaje"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Periodos de los pueblos con fechas sustentadas; una flecha une a los olmecas con los mayas", "Periods of the peoples with supported dates; an arrow joins the Olmec to the Maya")}">
        <defs><marker id="punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="punta"/></marker></defs>
        ${ticks}${barras}${flechas}</svg>
        <figcaption>${L("Solo se dibujan los pueblos con fechas sustentadas. La barra abierta llega hasta hoy: esos pueblos siguen vivos. La flecha marca la herencia olmeca de los primeros centros mayas.", "Only peoples with supported dates are drawn. An open bar reaches today: those peoples are still alive. The arrow marks the Olmec heritage of the first Maya centers.")}</figcaption></figure>`;
    }
    function erratas(lista) {
      return lista.map((e) => `<div class="errata"><div class="w">${esc(e.donde)}</div><div><span class="eyebrow" style="color:var(--muted)">${L("Decía", "It said")}</span><p class="was">${esc(e.decia)}</p></div><div><span class="eyebrow">${L("Dice", "It now says")}</span><p>${esc(e.dice)}</p><p class="muted small">${esc(e.como)}${e.fuentes.length ? " · " + e.fuentes.map((id) => esc(FUENTE[id].autores.split(/[;,]/)[0]) + " " + esc(FUENTE[id].anio)).join("; ") : ""}</p></div></div>`).join("");
    }

    // ------------------------------------------------------------ explorar
    const FACETAS = [
      ["alcance", L("Alcance", "Reach"), C.pregunta_alcance, C.alcance, (f) => [f.alcance]],
      ["ambito", L("Ámbito", "Field"), L("¿Para qué le sirve al mundo?", "What does it do for the world?"), C.ambitos, (f) => [f.ambito]],
      ["naturaleza", L("Naturaleza", "Nature"), C.pregunta_naturaleza, C.naturalezas, (f) => [f.naturaleza]],
      ["actos", L("Actos", "Acts"), L("¿Qué hizo aquí la gente?", "What did people do here?"), C.actos, (f) => f.actos],
      ["territorio", L("Territorio", "Territory"), C.pregunta_territorio, C.territorios, (f) => [f.territorio]],
      ["epoca", L("Época", "Period"), C.pregunta_epoca, C.epocas, (f) => [f.epoca]],
      ["clase", L("Clase", "Class"), L("¿Se cuenta como aporte?", "Does it count as a contribution?"), C.clases, (f) => [f.clase]],
      ["documentacion", L("Documentación", "Documentation"), L("¿Cuánto está documentada?", "How well documented is it?"), C.documentacion, (f) => [f.documentacion]]
    ];
    function coincide(f, filtros, salvo) {
      for (const [k, , , , val] of FACETAS) {
        if (k === salvo || !filtros[k]) continue;
        const quiero = filtros[k].split(",");
        if (!val(f).some((v) => quiero.includes(v))) return false;
      }
      if (filtros.q) {
        const q = quitarAcentos(filtros.q);
        const texto = quitarAcentos([f.nombre, f.especie, f.region, f.veredicto.texto, f.en_breve, ...f.originales.map((o) => o.forma), ...f.nombres_mundo.map((n) => n.dice), ...f.pueblos.map(nombrePueblo)].join(" "));
        if (!texto.includes(q)) return false;
      }
      return true;
    }
    function vistaExplorar(filtros) {
      const res = D.fichas.filter((f) => coincide(f, filtros)).sort(porAlcance);
      const grupos = C.alcance.map((a) => [a, res.filter((f) => f.alcance === a.id)]).filter(([, fs]) => fs.length);
      const activos = FACETAS.filter(([k]) => filtros[k]).length + (filtros.q ? 1 : 0);
      const facetas = FACETAS.map(([k, nombre, q, valores, val]) => {
        const sel = (filtros[k] || "").split(",").filter(Boolean);
        return `<div class="facet"><h4>${esc(nombre)}</h4><p class="q">${esc(q)}</p><div class="opts">${valores.map((v) => {
          const n = D.fichas.filter((f) => coincide(f, filtros, k) && val(f).includes(v.id)).length;
          const on = sel.includes(v.id);
          const sig = on ? sel.filter((x) => x !== v.id) : sel.concat(v.id);
          const sw = k === "ambito" ? `<span class="sw" style="background:${v.color}"></span>` : k === "actos" ? `<b>${v.marca}</b>` : k === "alcance" ? `<span class="sw alc-sw ${v.id}"></span>` : "";
          return `<a class="chip" role="button" aria-pressed="${on}" href="${hashExplorar({ ...filtros, [k]: sig.join(",") })}" title="${esc(v.texto || v.pregunta || "")}">${sw}${esc(v.nombre)} <span class="n">${n}</span></a>`;
        }).join("")}</div></div>`;
      }).join("");
      const amb = filtros.ambito && !filtros.ambito.includes(",") ? AMB[filtros.ambito] : null;
      return `${manifiesto()}<div class="wrap"><div class="explore">
        <aside class="facets" data-open="false" aria-label="${L("Filtros", "Filters")}">
          <button class="btn filters-toggle" type="button" data-toggle-facets>${L("Filtros", "Filters")}${activos ? ` (${activos})` : ""}</button>
          ${facetas}
          ${activos ? `<p style="margin-top:14px"><a class="btn" href="#/explorar">${L("Quitar filtros", "Clear filters")}</a></p>` : ""}
        </aside>
        <div>
          <div class="results-head"><div><p class="eyebrow">${amb ? L("Ámbito", "Field") : L("Aportes", "Contributions")}</p><h1>${amb ? esc(amb.nombre) : L("Todos los aportes", "All contributions")}</h1>
            ${amb ? `<p class="muted" style="margin-top:6px"><b>${L("Incluye", "Includes")}:</b> ${esc(amb.incluye)}${amb.excluye ? ` <b>${L("No incluye", "Does not include")}:</b> ${esc(amb.excluye)}` : ""}</p>` : ""}</div>
            <p class="muted">${plural(res.length, L("ficha", "entry"), L("fichas", "entries"))}${filtros.q ? ` ${L("con", "with")} «${esc(filtros.q)}»` : ""}</p></div>
          ${res.length ? grupos.map(([a, fs]) => `<div class="grupo-alc"><h2>${alcTag(a.id)} <span class="muted small">${plural(fs.length, L("ficha", "entry"), L("fichas", "entries"))} · ${esc(a.texto)}</span></h2>
            <div class="grid${a.id === "mundial" ? " g-grande" : ""}">${fs.map((f) => tarjeta(f, a.id === "mundial" ? "grande" : "")).join("")}</div></div>`).join("") : `<div class="empty">${L("Ninguna ficha cumple todos los filtros. Quita alguno.", "No entry matches all the filters. Remove one.")}</div>`}
        </div></div></div>`;
    }
    function manifiesto() {
      const m = C.manifiesto;
      return `<section class="manifiesto" aria-label="${L("Lo que creemos y para qué existe este sitio", "What we believe and why this site exists")}"><div class="wrap">
        <div class="m-grid"><div><p class="eyebrow">${L("Lo que creemos", "What we believe")}</p><p class="m-txt">${esc(m.creencia)}</p></div>
        <div><p class="eyebrow">${L("Nuestro objetivo", "Our goal")}</p><p class="m-txt">${esc(m.objetivo)}</p></div></div>
        <p class="m-pie"><a href="#/despojo">${L("Ver lo que se les quitó", "See what was taken from them")}</a><a href="#/metodo">${L("Cómo se prueba cada reclamo", "How each claim is proven")}</a></p>
      </div></section>`;
    }
    function hashExplorar(f) {
      const q = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      return `#/explorar${q ? "?" + q : ""}`;
    }

    // ------------------------------------------------------------ ficha
    // Ficha con forma de artículo de enciclopedia: índice a la izquierda, texto al centro,
    // cuadro de datos a la derecha. En el teléfono las secciones se pliegan.
    function vistaFicha(id) {
      const f = FICHA[id];
      if (!f) return noEncontrado();
      const N = notas();
      const a = AMB[f.ambito];
      const v = f.veredicto;
      const sinFuente = !v.fuentes || !v.fuentes.length;
      const deslinde = f.clase === "deslinde";
      const nah = (o) => (/^n[aá]huatl$/i.test(o.lengua) ? ' lang="nah"' : "");
      const originales = f.originales.length ? `<p class="enc-orig">${f.originales.map((o, i) => `<span${i ? "" : ' class="o1"'}><i${nah(o)}>${esc(o.forma)}</i> <small>${esc(o.lengua)}${o.glosa ? ` · «${esc(o.glosa)}»` : ""}</small>${N.cita(o.fuentes)}</span>`).join("")}</p>`
        : f.sin_originario ? `<p class="enc-orig sin">${esc(f.sin_originario)}</p>` : "";
      const frase = deslinde ? "" : `${yLista(f.actos.map((x) => VERBO[x])).replace(/^./, (c) => c.toUpperCase())}. ${L("Su evidencia más antigua está en", "Its oldest evidence is in")} ${TERR[f.territorio].nombre}: ${f.region}.`;
      const entrada = `<p class="enc-lead">${esc(f.en_breve)}</p>${frase ? `<p class="enc-frase">${esc(frase)}</p>` : ""}
        <div class="enc-veredicto${sinFuente ? " abstiene" : ""}" id="veredicto"><span class="enc-lbl">${deslinde ? L("Por qué no se reclama", "Why it is not claimed") : L("Veredicto", "Verdict")}</span>
          <p>${esc(v.texto)}${N.cita(v.fuentes)}</p>
          <p class="enc-meta">${tagSolidez(v.solidez)}${vstate(v.verificacion || "pendiente")}${tagDoc(f.documentacion)}</p>
          ${sinFuente ? `<p class="abst">${L("Sin fuente todavía. Se muestra como pendiente, no como dato.", "No source yet. It is shown as pending, not as fact.")}</p>` : ""}</div>`;

      // Secciones, en orden de lectura. Cada una: [ancla, título, contenido].
      const secs = [];
      const d = despojoDe(f);
      if (d.casos.length || d.nombres.length) secs.push(["despojo", L("Lo que se le quitó", "What was taken"),
        `${d.casos.map((c) => `<a class="enc-caso" href="#/caso/${c.id}" style="--c:${COLOR_CASO[c.tipo]}"><span class="state">${esc(TCASO[c.tipo].nombre)} · ${esc(c.fecha.texto)}</span><b>${esc(c.titulo)}</b><span>${esc(c.reclamo ? L("Se reclama: ", "We demand: ") + c.reclamo : c.resumen)}</span></a>`).join("")}
         ${d.nombres.length ? `<p class="dn"><b>${d.nombres.length === 1 ? L("Un nombre que borra su origen", "A name that erases its origin") : L("Nombres que borran su origen", "Names that erase its origin")}:</b> ${d.nombres.map((n) => `«${esc(n.dice)}»${n.apunta ? ` <span class="muted">(→ ${esc(n.apunta.nombre)})</span>` : ""}`).join(", ")}</p>` : ""}`]);
      const diag = diagrama(f, N);
      if (diag) secs.push(["diagrama", DIAG[f.id].titulo, diag]);
      if (f.afirmaciones.length) {
        const n = { comprobada: 0, citada: 0, pendiente: 0 };
        f.afirmaciones.forEach((x) => n[x.verificacion]++);
        const resumen = n.comprobada === f.afirmaciones.length ? L("Todas con fuente comprobada.", "All with a verified source.")
          : L(`${n.comprobada} de ${f.afirmaciones.length} con fuente comprobada; las demás se marcan.`, `${n.comprobada} of ${f.afirmaciones.length} with a verified source; the rest are marked.`);
        secs.push(["pruebas", L("Las pruebas", "The evidence"), `<p class="enc-nota">${vbar(n, "vbar mini")} ${plural(f.afirmaciones.length, L("afirmación", "claim"), L("afirmaciones", "claims"))}. ${resumen}</p>
          <ol class="enc-claims">${f.afirmaciones.map((x) => `<li class="${x.verificacion}"><p>${esc(x.texto)}${N.cita(x.fuentes)} <span class="enc-sol ${x.solidez || ""}" title="${x.solidez ? esc(SOL[x.solidez].texto) : ""}">${x.solidez ? esc(SOL[x.solidez].nombre) : ""}</span>${x.verificacion !== "comprobada" ? vstate(x.verificacion) : ""}</p></li>`).join("")}</ol>`]);
      }
      if (f.nombres_mundo.length) secs.push(["nombres", L("Cómo lo llama el mundo", "What the world calls it"),
        `<div class="enc-tabla"><table class="names"><thead><tr><th>${L("Nombre", "Name")}</th><th>${L("Forma", "Form")}</th><th>${L("Qué pasa", "What happens")}</th></tr></thead><tbody>${f.nombres_mundo.map((n) => `<tr><td>${esc(n.dice)}<div class="muted small" style="font-family:var(--sans);font-weight:400">${esc(n.lengua)}</div></td><td><a class="tag doc${BORRA.has(n.forma) ? " borra" : ""}" href="#/nombres/${n.forma}" title="${esc(BORR[n.forma].pregunta)}">${esc(BORR[n.forma].nombre)}</a></td><td>${esc(n.nota || "")}${n.apunta ? ` <span class="muted">→ ${esc(n.apunta.nombre)}</span>` : ""}${n.fuentes ? N.cita(n.fuentes) : ""}</td></tr>`).join("")}</tbody></table></div>`]);
      if (f.expediente) secs.push(["expediente", L("Expediente", "Dossier"), expediente(f, N)]);
      const mundo = mapaMundo(f);
      if (mundo) secs.push(["distribucion", f.distribucion ? L("Dónde crece hoy", "Where it grows today") : L("De dónde vino la especie", "Where the species came from"), mundo]);
      if (f.pendientes.length) secs.push(["falta", L("Lo que falta", "What is missing"), `<ul class="pendientes">${f.pendientes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`]);
      const recs = RECORRIDOS_DE[f.id] || [];
      if (recs.length || f.relacionadas.length) secs.push(["vease", L("Véase también", "See also"),
        `${f.relacionadas.length ? `<div class="related">${f.relacionadas.map(chipFicha).join("")}</div>` : ""}
         ${recs.length ? `<p class="enc-recs"><span class="muted">${L("Recorridos", "Journeys")}:</span> ${recs.map((r) => `<a href="#/recorrido/${r}">${esc(RECORRIDO[r].titulo)}</a>`).join(" · ")}</p>` : ""}`]);
      const refs = N.lista(true);
      if (refs) secs.push(["fuentes", L("Fuentes", "Sources"), refs]);

      const seccion = ([ancla, titulo, html]) => `<details class="enc-sec" id="${ancla}" open><summary><h2>${esc(titulo)}</h2></summary><div class="enc-c">${html}</div></details>`;
      const indice = `<details class="enc-toc" open><summary>${L("Contenido", "Contents")}</summary><ol>
        <li><a href="#/ficha/${f.id}#arriba">${L("Inicio", "Top")}</a></li>${secs.map(([ancla, titulo]) => `<li><a href="#/ficha/${f.id}#${ancla}" data-sec="${ancla}">${esc(titulo)}</a></li>`).join("")}</ol></details>`;
      return `<article style="${colorAmb(f.ambito)}" class="ac enc" id="arriba"><div class="wrap enc-grid">
        <nav class="enc-nav" aria-label="${L("En esta ficha", "In this entry")}">${indice}</nav>
        <div class="enc-art">
          <header class="enc-titulo">
            <p class="eyebrow">${icono(f.ambito, "")}<a href="#/explorar?ambito=${f.ambito}">${esc(a.nombre)}</a>${alcTag(f.alcance)}</p>
            <div class="enc-h1"><h1>${esc(f.nombre)}</h1>${botonCompartir()}</div>
            ${originales}
          </header>
          ${infobox(f)}
          ${entrada}
          <nav class="enc-enlinea" aria-label="${L("En esta ficha", "In this entry")}">${indice}</nav>
          ${secs.map(seccion).join("")}
        </div>
      </div></article>`;
    }
    // Cuadro de datos, como el de una enciclopedia.
    function infobox(f) {
      const deslinde = f.clase === "deslinde";
      const fila = (k, val, nota) => (val ? `<tr><th scope="row">${k}</th><td>${val}${nota ? `<span class="why">${nota}</span>` : ""}</td></tr>` : "");
      const n = { comprobada: 0, citada: 0, pendiente: 0 };
      afirmacionesDe(f).forEach((x) => n[x.verificacion]++);
      const [lat, lon] = f.coords;
      const mapa = dentroMexico(lat, lon) && !(deslinde && f.origen_biologico)
        ? `<div class="ib-mapa">${svgMexico([{ lat, lon, r: 22, cls: "on" }], { aria: `${L("Ubicación", "Location")}: ${f.region}` })}<p class="cap">${esc(f.region)}</p></div>` : "";
      return `<aside class="infobox" aria-label="${L("Datos", "Facts")}">
        ${f.imagen ? `<figure>${foto(f, "grande", true)}<figcaption>${credito(f.imagen)}</figcaption></figure>` : ""}
        <table><tbody>
          ${fila(L("Qué es", "What it is"), esc(NAT[f.naturaleza].nombre), esc(`${AMB[f.ambito].nombre}: ${AMB[f.ambito].pregunta}`))}
          ${f.especie ? fila(L("Especie", "Species"), `<i>${esc(f.especie)}</i>`) : ""}
          ${f.autoria ? fila(L("Autoría", "Authorship"), esc(f.autoria)) : ""}
          ${fila(deslinde ? L("Por qué no se reclama", "Why it is not claimed") : L("Qué se hizo aquí", "What was done here"), deslinde ? L("No se reclama", "Not claimed") : esc(f.actos.map((x) => ACTO[x].nombre).join(" · ")), deslinde ? esc(C.clases[1].texto) : "")}
          ${fila(L("Dónde empezó", "Where it began"), deslinde && f.origen_biologico ? L("Fuera de México", "Outside Mexico") : esc(TERR[f.territorio].nombre), esc(f.region))}
          ${fila(L("Cuándo", "When"), esc(cuando(f)), esc(f.fecha.texto))}
          ${fila(L("Alcance", "Reach"), esc(ALC[f.alcance].nombre), f.wikipedias ? L(`Artículo en ${f.wikipedias} ediciones de Wikipedia`, `Article in ${f.wikipedias} Wikipedia editions`) : "")}
          ${f.pueblos.length ? fila(L("Pueblos", "Peoples"), f.pueblos.map((p) => `<a href="#/pueblo/${p}">${esc(nombrePueblo(p))}</a>`).join(", ")) : ""}
          ${fila(L("Verificación", "Verification"), `${vbar(n, "vbar mini")}<span class="why">${L(`${n.comprobada} comprobadas · ${n.citada} citadas · ${n.pendiente} pendientes`, `${n.comprobada} verified · ${n.citada} cited · ${n.pendiente} pending`)}</span>`)}
        </tbody></table>
        ${mapa}
      </aside>`;
    }
    const cuando = (f) => hace(f) || EPOCA[f.epoca].nombre;
    // Diagramas: datos/diagramas.json; cada paso resume afirmaciones de la ficha.
    function diagrama(f, N) {
      const d = DIAG[f.id];
      if (!d) return "";
      let cuerpo = "";
      if (d.tipo === "proceso") {
        cuerpo = `<ol class="proceso">${d.pasos.map((p, i) => `<li><span class="paso-ic">${iconoPaso(p.icono, i + 1)}</span><span class="paso-n">${i + 1}</span><b>${esc(p.titulo)}</b><span>${esc(p.texto)}</span></li>`).join("")}</ol>`
          + (d.contraste ? `<div class="contraste"><b>${esc(d.contraste.titulo)}.</b> ${esc(d.contraste.texto)}${N.cita(d.contraste.fuentes)}</div>` : "");
      } else if (d.tipo === "linea") cuerpo = lineaDiagrama(d);
      else if (d.tipo === "numeracion") cuerpo = numeralesMayas();
      return `<figure class="diagrama">${cuerpo}<p class="cap">${L("Resume las afirmaciones de esta ficha.", "It summarizes the claims in this entry.")}${N.cita(d.fuentes)}</p></figure>`;
    }
    function lineaDiagrama(d) {
      const W = 640, H = 120, a0 = -2000, a1 = AHORA, X = (y) => 30 + ((y - a0) / (a1 - a0)) * (W - 60);
      const ticks = [-2000, -1000, 0, 1000, 2000].map((y) => `<line class="tick" x1="${X(y)}" x2="${X(y)}" y1="30" y2="88"/><text class="tick-lbl" x="${X(y)}" y="108" text-anchor="middle">${y < 0 ? fmt(-y) + L(" a.C.", " BCE") : y}</text>`).join("");
      const [m1, m2] = d.marcas;
      const marca = (m) => `<circle class="${m.lado === "mexico" ? "m-mx" : "m-fuera"}" cx="${r1(X(m.anio))}" cy="60" r="11"/>`;
      return `<svg class="linea-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m1.titulo)} ${L("hacia", "around")} ${anio(m1.anio)}; ${esc(m2.titulo)} ${L("en", "in")} ${anio(m2.anio)}">
        ${ticks}<line class="lane-line" x1="30" x2="${W - 30}" y1="60" y2="60"/>
        <path class="brecha" d="M${r1(X(m1.anio))},38 V30 H${r1(X(m2.anio))} V38"/><text class="brecha-lbl" x="${r1((X(m1.anio) + X(m2.anio)) / 2)}" y="22" text-anchor="middle">${esc(d.conclusion)}</text>
        ${marca(m1)}${marca(m2)}</svg>
        <div class="linea-txt">${d.marcas.map((m) => `<div class="${m.lado}"><b>${anio(m.anio)} · ${esc(m.titulo)}</b><span>${esc(m.texto)}</span></div>`).join("")}</div>`;
    }
    // Numerales mayas: punto = 1, barra = 5, concha = 0; las posiciones valen 1, 20, 360 (en la Cuenta Larga)…
    function numeral(n, cx, y) {
      if (n === 0) return `<g class="concha"><ellipse cx="${cx}" cy="${y + 10}" rx="17" ry="9"/><path d="M${cx - 12},${y + 10} q12,-8 24,0 M${cx - 9},${y + 14} q9,-5 18,0"/></g>`;
      const barras = Math.floor(n / 5), puntos = n % 5;
      let out = "", yy = y;
      if (puntos) { const ancho = (puntos - 1) * 9; for (let i = 0; i < puntos; i++) out += `<circle cx="${cx - ancho / 2 + i * 9}" cy="${yy + 4}" r="3.4"/>`; yy += 11; }
      for (let i = 0; i < barras; i++) { out += `<rect x="${cx - 17}" y="${yy}" width="34" height="6.5" rx="3"/>`; yy += 10; }
      return `<g class="num-maya">${out}</g>`;
    }
    function numeralesMayas() {
      const celda = 62, W = celda * 10, H = 2 * 86;
      const tabla = Array.from({ length: 20 }, (_, n) => {
        const col = n % 10, filaN = Math.floor(n / 10), cx = col * celda + celda / 2, y = filaN * 86 + 12;
        return `${numeral(n, cx, y)}<text class="tick-lbl" x="${cx}" y="${y + 62}" text-anchor="middle">${n}</text>`;
      }).join("");
      const fecha = [[7, "bak'tun", L("× 144,000 días", "× 144,000 days")], [16, "k'atun", "× 7,200"], [3, "tun", "× 360"], [2, "winal", "× 20"], [13, "k'in", "× 1"]];
      const col = fecha.map(([n, nom, val], i) => `${numeral(n, 40, 14 + i * 44)}<text class="lane-lbl" x="76" y="${30 + i * 44}">${n} ${esc(nom)}</text><text class="tick-lbl" x="76" y="${44 + i * 44}">${esc(val)}</text>`).join("");
      const veinte = `${numeral(1, 40, 18)}${numeral(0, 40, 50)}<text class="lane-lbl" x="76" y="30">${L("1 veintena", "1 score")}</text><text class="lane-lbl" x="76" y="64">${L("0 unidades", "0 units")}</text><text class="brecha-lbl" x="20" y="100">= 20</text>`;
      return `<div class="maya">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Numerales mayas del 0 al 19: la concha es el cero, el punto vale uno y la barra cinco", "Maya numerals from 0 to 19: the shell is zero, the dot is worth one and the bar five")}">${tabla}</svg>
        <div class="maya-pos">
          <div><h4>${L("El cero hace posible la posición", "Zero makes place value possible")}</h4><svg viewBox="0 0 200 110" role="img" aria-label="${L("Veinte en numerales mayas: un punto arriba y una concha abajo", "Twenty in Maya numerals: a dot above and a shell below")}">${veinte}</svg><p class="cap">${L("Sin un signo para «nada», no podría distinguirse el 1 del 20.", "Without a sign for «nothing», 1 could not be told apart from 20.")}</p></div>
          <div><h4>${L("La fecha más antigua: 36 a. C.", "The oldest date: 36 BCE")}</h4><svg viewBox="0 0 220 226" role="img" aria-label="${L("Fecha de Cuenta Larga 7.16.3.2.13 de la Estela 2 de Chiapa de Corzo", "Long Count date 7.16.3.2.13 on Stela 2 at Chiapa de Corzo")}">${col}</svg><p class="cap">${L("Estela 2 de Chiapa de Corzo, Chiapas: 7.16.3.2.13.", "Stela 2 at Chiapa de Corzo, Chiapas: 7.16.3.2.13.")}</p></div>
        </div></div>`;
    }
    function expediente(f, N) {
      const e = f.expediente;
      const contra = (e.contrapuntos || []).map((c) => `<div class="counter"><div class="says"><h4>${L("Se dice", "It is said")}</h4><p>${esc(c.dice)}</p></div><div><h4>${L("Responde el expediente", "The dossier answers")}</h4><p>${esc(c.respuesta)}${N.cita(c.fuentes)}</p><div class="meta" style="margin-top:8px">${vstate(c.verificacion)}</div></div></div>`).join("");
      const cmp = e.comparacion;
      let tabla = "";
      if (cmp) {
        const fila = (nombre, ls, trad) => `<tr><th scope="row">${esc(nombre)}</th>${LINEAS.map((l) => `<td class="${ls.includes(l.id) ? "on" : ""}${l.n === 3 ? " threshold" : ""}" ${tip(`<b>${l.n}. ${esc(l.nombre)}</b>${esc(l.texto)}`)}>${ls.includes(l.id) ? "✓" : ""}</td>`).join("")}<td class="t ${trad ? "si" : "no"}">${trad ? L("Tradición", "Tradition") : L("Solo presencia", "Presence only")}</td></tr>`;
        tabla = `<h3 style="margin-top:22px">${L("La misma vara: México y", "The same yardstick: Mexico and")} ${esc(cmp.region)}</h3>
          <p class="muted small" style="margin:4px 0 6px">${esc(C.regla_tradicion)}</p>
          <div style="overflow-x:auto"><table class="lines"><thead><tr><th></th>${LINEAS.map((l) => `<th scope="col"${l.n === 3 ? ' class="threshold"' : ""} title="${esc(l.nombre)}">${l.n}<span class="ln">. ${esc(l.nombre)}</span></th>`).join("")}<th></th></tr></thead>
          <tbody>${fila(TERR.mexico.nombre, cmp.lineas.aqui, cmp.tradicion.aqui)}${fila(cmp.region, cmp.lineas.alla, cmp.tradicion.alla)}</tbody></table></div>
          <p style="margin-top:10px">${esc(cmp.texto)}${N.cita(cmp.fuentes)}</p><div class="meta" style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">${tagSolidez(cmp.solidez)}${vstate(cmp.verificacion)}</div>
          ${cmp.pendiente ? `<p class="abst">${esc(cmp.pendiente)}</p>` : ""}`;
      }
      return `${contra}${tabla}`;
    }
    function mapaMundo(f) {
      if (!f.distribucion && !f.origen_biologico) return "";
      const [lat, lon] = f.coords;
      const d = f.distribucion || { nativa: [], introducida: [] };
      const nat = new Set(d.nativa), intro = new Set(d.introducida);
      const cls = (cod) => (nat.has(cod) ? " nativa" : intro.has(cod) ? " introducida" : "");
      let extra = "";
      if (f.origen_biologico && f.origen_biologico.coords) {
        const o = ptMundo(...f.origen_biologico.coords), p = ptMundo(lat, lon);
        extra = `${arco(o, p)}<circle class="pt-origen" cx="${r1(o[0])}" cy="${r1(o[1])}" r="14" ${tip(`<b>${L("Origen biológico", "Biological origin")}</b>${esc(f.origen_biologico.texto)}`)}/><circle class="pt on" cx="${r1(p[0])}" cy="${r1(p[1])}" r="14" ${tip(`<b>${esc(f.nombre)}</b>${esc(f.region)}`)}/>`;
      }
      const leyenda = f.distribucion ? `<div class="legend"><span><i class="sw" style="background:var(--ok)"></i>${L("Nativa", "Native")} (${d.nativa.length})</span><span><i class="sw" style="background:var(--cited)"></i>${L("Introducida", "Introduced")} (${d.introducida.length})</span><span><i class="sw" style="background:var(--land);border:1px solid var(--line)"></i>${L("Sin registro", "No record")}</span></div>` : "";
      return `<figure class="enc-mundo panel">
        <svg class="map" viewBox="0 0 ${GW.ancho} ${GW.alto}" role="img" aria-label="${L("Mapa del mundo con la distribución de", "World map with the distribution of")} ${esc(f.especie || f.nombre)}"><rect width="${GW.ancho}" height="${GW.alto}" fill="var(--water)" rx="8"/>${tierras(GW, cls)}${extra}</svg>
        ${leyenda}<figcaption class="cap">${f.distribucion ? L(`Regiones donde el WCVP registra a <i>${esc(f.especie)}</i> como nativa o introducida. ${f.origen_biologico ? "La flecha une el origen biológico con el lugar del aporte." : ""}`, `Regions where the WCVP records <i>${esc(f.especie)}</i> as native or introduced. ${f.origen_biologico ? "The arrow joins the biological origin to the place of the contribution." : ""}`) : esc(f.origen_biologico.texto)}</figcaption></figure>`;
    }

    // ------------------------------------------------------------ mapa
    function vistaMapa(filtros) {
      const sel = filtros.ambito || "";
      const casos = filtros.capa === "casos";
      const fichas = D.fichas.filter((f) => dentroMexico(...f.coords));
      const fuera = D.fichas.length - fichas.length;
      let puntos;
      if (casos) {
        puntos = D.casos.filter((c) => dentroMexico(...c.coords)).map((c) => ({ lat: c.coords[0], lon: c.coords[1], r: 9, href: `#/caso/${c.id}`, attrs: `style="fill:${COLOR_CASO[c.tipo]}"`, tip: `<b>${esc(c.titulo)}</b><span class="k">${esc(TCASO[c.tipo].nombre)} · ${esc(c.fecha.texto)}</span>` }));
      } else {
        puntos = fichas.map((f) => ({
          lat: f.coords[0], lon: f.coords[1], r: 8, href: `#/ficha/${f.id}`,
          cls: (sel && f.ambito !== sel ? "dim " : "") + "ac", attrs: `style="${colorAmb(f.ambito)};fill:var(--c)"`,
          tip: `<b>${esc(f.nombre)}</b><span class="k">${esc(AMB[f.ambito].nombre)} · ${esc(f.region)}</span>`
        }));
      }
      const lista = casos ? [] : (sel ? fichas.filter((f) => f.ambito === sel) : []);
      return `<div class="wrap map-page">
        <p class="eyebrow">${L("Mapa", "Map")}</p><h1>${L("Dónde ocurrió cada aporte", "Where each contribution happened")}</h1>
        <p class="lede">${L("El punto marca el lugar del aporte: donde se domesticó, se inventó o se practica, no donde vive hoy la especie.", "The dot marks the place of the contribution: where it was domesticated, invented or practiced, not where the species lives today.")} ${casos ? L("Casos con lugar en México.", "Cases located in Mexico.") : L(`${plural(fichas.length, "ficha cae", "fichas caen")} en el mapa${fuera ? `; ${fuera} ocurrieron fuera del encuadre` : ""}.`, `${plural(fichas.length, "entry falls", "entries fall")} on the map${fuera ? `; ${fuera} happened outside the frame` : ""}.`)}</p>
        <div class="map-tools">
          <a class="chip" aria-pressed="${!casos && !sel}" href="#/mapa">${L("Todas las fichas", "All entries")}</a>
          ${C.ambitos.map((a) => `<a class="chip" aria-pressed="${sel === a.id}" href="#/mapa?ambito=${a.id}"><span class="sw" style="background:${a.color}"></span>${esc(a.nombre)}</a>`).join("")}
          <a class="chip" aria-pressed="${casos}" href="#/mapa?capa=casos">${L("Casos", "Cases")}</a>
        </div>
        <div class="map-stage">${svgMexico(puntos, { aria: L("Mapa de México", "Map of Mexico") })}</div>
        ${casos ? `<div class="legend">${TIPOS_CASO.map((t) => `<span><i class="sw" style="background:${COLOR_CASO[t.id]}"></i>${esc(t.nombre)}</span>`).join("")}</div>`
          : `<div class="legend">${C.ambitos.map((a) => `<span><i class="sw" style="background:${a.color}"></i>${esc(a.nombre)}</span>`).join("")}</div>`}
        ${lista.length ? `<div class="grid" style="margin-top:24px">${lista.map(tarjeta).join("")}</div>` : ""}
      </div>`;
    }

    // ------------------------------------------------------------ tiempo
    function vistaTiempo() {
      const W = 1120, izq = 150, der = 20, ancho = W - izq - der, carril = 30, top = 44;
      // Escala por tramos: la época antigua se comprime para que quepan los dos siglos recientes.
      const tramos = [[-9000, 1521, 0, 0.5], [1521, 1821, 0.5, 0.68], [1821, 2030, 0.68, 1]];
      const X = (y) => { for (const [a, b, u, v] of tramos) if (y <= b) return izq + ancho * (u + ((Math.max(y, a) - a) / (b - a)) * (v - u)); return izq + ancho; };
      const carriles = C.ambitos.map((a) => a.id).concat("casos");
      const H = top + carriles.length * carril + 30;
      const Y = (i) => top + i * carril + carril / 2;
      const eras = C.epocas.map((e, i) => { const [a, b] = tramos[i]; return `<rect class="era" x="${X(a)}" y="18" width="${X(b) - X(a) - 2}" height="${H - 40}" opacity="${i % 2 ? 0.55 : 0.3}"/><text class="era-lbl" x="${X(a) + 8}" y="34">${esc(e.nombre)}</text>`; }).join("");
      const ticks = [-8000, -6000, -4000, -2000, 0, 1521, 1650, 1821, 1900, 1950, 2000].map((y) => `<line class="tick" x1="${X(y)}" x2="${X(y)}" y1="${top - 4}" y2="${H - 26}"/><text class="tick-lbl" x="${X(y)}" y="${H - 8}" text-anchor="middle">${y < 0 ? fmt(-y) + L(" a.C.", " BCE") : y}</text>`).join("");
      const lanes = carriles.map((c, i) => `<line class="lane-line" x1="${izq}" x2="${W - der}" y1="${Y(i)}" y2="${Y(i)}"/><text class="lane-lbl" x="${izq - 12}" y="${Y(i) + 4}" text-anchor="end">${esc(c === "casos" ? L("Casos", "Cases") : AMB[c].nombre)}</text>`).join("");
      const usados = {};
      const jitter = (k, x) => { const key = k + Math.round(x / 9); usados[key] = (usados[key] || 0) + 1; return [0, -7, 7, -12, 12][(usados[key] - 1) % 5]; };
      const dots = D.fichas.map((f) => {
        const i = carriles.indexOf(f.ambito), x = X(f.fecha.anio);
        return `<circle class="tdot ac ${f.clase}" cx="${r1(x)}" cy="${Y(i) + jitter(f.ambito, x)}" r="6" data-href="#/ficha/${f.id}" style="${f.clase === "aporte" ? `${colorAmb(f.ambito)};fill:var(--c)` : ""}" ${tip(`<b>${esc(f.nombre)}</b><span class="k">${esc(f.fecha.texto)} · ${esc(AMB[f.ambito].nombre)}</span>`)}/>`;
      }).join("") + D.casos.map((c) => { const x = X(c.fecha.anio); return `<circle class="tdot caso" cx="${r1(x)}" cy="${Y(carriles.length - 1) + jitter("c", x)}" r="6" data-href="#/caso/${c.id}" style="fill:${COLOR_CASO[c.tipo]}" ${tip(`<b>${esc(c.titulo)}</b><span class="k">${esc(c.fecha.texto)} · ${esc(TCASO[c.tipo].nombre)}</span>`)}/>`; }).join("");
      const lista = C.epocas.map((e) => {
        const fs = D.fichas.filter((f) => f.epoca === e.id).sort((a, b) => a.fecha.anio - b.fecha.anio);
        return `<div class="family"><h3>${esc(e.nombre)} <span class="muted small">${plural(fs.length, L("ficha", "entry"), L("fichas", "entries"))}</span></h3><p class="q">${esc(e.texto)}</p><div class="related">${fs.map(chipFicha).join("")}</div></div>`;
      }).join("");
      return `<div class="wrap map-page">
        <p class="eyebrow">${L("Tiempo", "Time")}</p><h1>${L("Diez mil años en una línea", "Ten thousand years on one line")}</h1>
        <p class="lede">${L("Cada punto es la fecha del aporte en su ámbito; la última fila son los casos. La escala se comprime antes de 1521 para que quepan los dos siglos recientes: la mitad izquierda abarca nueve milenios.", "Each dot is the date of the contribution in its field; the last row holds the cases. The scale is compressed before 1521 so the last two centuries fit: the left half spans nine millennia.")}</p>
        <div class="timeline" style="margin-top:22px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Línea del tiempo de aportes y casos", "Timeline of contributions and cases")}">${eras}${ticks}${lanes}${dots}</svg></div>
        <div class="legend"><span><i class="sw" style="background:var(--accent)"></i>${L("Aporte (color del ámbito)", "Contribution (field color)")}</span><span><i class="sw" style="border:2px solid var(--muted)"></i>${L("Deslinde", "Clarification")}</span>${TIPOS_CASO.map((t) => `<span><i class="sw" style="background:${COLOR_CASO[t.id]}"></i>${L("Caso", "Case")}: ${esc(t.nombre)}</span>`).join("")}</div>
        ${lista}
      </div>`;
    }

    // ------------------------------------------------------------ nombres
    function vistaNombres(forma) {
      const todos = D.fichas.flatMap((f) => f.nombres_mundo.map((n) => ({ ...n, ficha: f })));
      const visibles = forma ? todos.filter((n) => n.forma === forma) : todos;
      const arcos = visibles.filter((n) => n.apunta).map((n) => {
        const a = ptMundo(...n.ficha.coords), b = ptMundo(...n.apunta.coords);
        return `${arco(a, b, n.forma === "conserva" ? "dash" : "")}<circle class="pt" cx="${r1(b[0])}" cy="${r1(b[1])}" r="5" data-href="#/ficha/${n.ficha.id}" ${tip(`<b>${esc(n.dice)}</b><span class="k">${esc(BORR[n.forma].nombre)} · ${L("apunta a", "points to")} ${esc(n.apunta.nombre)}</span><br>${esc(n.ficha.nombre)}`)}/>`;
      }).join("");
      const mx = ptMundo(22, -101);
      const familias = C.borrado.filter((b) => !forma || b.id === forma).map((b) => {
        const ns = todos.filter((n) => n.forma === b.id);
        return `<div class="family" id="f-${b.id}"><h3>${esc(b.nombre)} <span class="muted small">${ns.length}</span></h3><p class="q">${esc(b.pregunta)}</p>
          <div class="wall">${ns.map((n) => `<div class="name"><div class="dice">${esc(n.dice)}</div><div class="es">${esc(n.lengua)} · <a href="#/ficha/${n.ficha.id}">${esc(n.ficha.nombre)}</a></div>${n.nota ? `<div class="nota">${esc(n.nota)}${n.apunta ? ` → ${esc(n.apunta.nombre)}` : ""}</div>` : ""}</div>`).join("")}</div></div>`;
      }).join("");
      return `<div class="wrap map-page">
        <p class="eyebrow">${L("Nombres", "Names")}</p><h1>${L("Cómo lo llama el mundo", "What the world calls it")}</h1>
        <p class="lede">${L("Algunos nombres conservan el origen (chocolate, tomate, aguacate); otros lo trasladan a otro país, a otra persona o a un sintético. Cada nombre está en su ficha; aquí se agrupan por la forma en que borran o guardan el origen.", "Some names keep the origin (chocolate, tomato, avocado); others move it to another country, another person or a synthetic. Each name lives in its entry; here they are grouped by the way they erase or keep the origin.")}</p>
        <div class="map-tools"><a class="chip" aria-pressed="${!forma}" href="#/nombres">${L("Todas las formas", "All forms")}</a>${C.borrado.map((b) => `<a class="chip" aria-pressed="${forma === b.id}" href="#/nombres/${b.id}">${esc(b.nombre)} <span class="n">${todos.filter((n) => n.forma === b.id).length}</span></a>`).join("")}</div>
        <div class="map-stage"><svg viewBox="0 0 ${GW.ancho} ${GW.alto}" role="img" aria-label="${L("Mapa del mundo: a dónde apunta cada nombre", "World map: where each name points")}">${tierras(GW)}${arcos}<circle class="pt-origen" cx="${r1(mx[0])}" cy="${r1(mx[1])}" r="7"/></svg></div>
        <p class="muted small" style="margin-top:8px">${L(`Cada arco va del lugar del aporte al lugar que el nombre señala. ${visibles.filter((n) => n.apunta).length} de ${visibles.length} nombres señalan un lugar.`, `Each arc goes from the place of the contribution to the place the name points to. ${visibles.filter((n) => n.apunta).length} of ${visibles.length} names point to a place.`)}</p>
        ${familias}
      </div>`;
    }

    // ------------------------------------------------------------ casos
    function vistaCasos() {
      const W = 1000, H = 30 + TIPOS_CASO.length * 22 + 26, izq = 20, der = 20, a0 = 1500, a1 = 2030;
      const X = (y) => izq + ((y - a0) / (a1 - a0)) * (W - izq - der);
      const ticks = [1500, 1600, 1700, 1800, 1900, 2000].map((y) => `<line class="tick" x1="${X(y)}" x2="${X(y)}" y1="14" y2="${H - 26}"/><text class="tick-lbl" x="${X(y)}" y="${H - 8}" text-anchor="middle">${y}</text>`).join("");
      const filas = Object.fromEntries(TIPOS_CASO.map((t, i) => [t.id, 30 + i * 22]));
      const dots = D.casos.map((c) => `<circle class="tdot" cx="${r1(X(Math.max(a0, c.fecha.anio)))}" cy="${filas[c.tipo]}" r="7" data-href="#/caso/${c.id}" style="fill:${COLOR_CASO[c.tipo]}" ${tip(`<b>${esc(c.titulo)}</b><span class="k">${esc(c.fecha.texto)}</span>`)}/>`).join("");
      return `<div class="wrap map-page">
        <p class="eyebrow"><a href="#/despojo" style="color:inherit;text-decoration:none">${L("Lo que se les quitó", "What was taken from them")}</a></p><h1>${L("Todos los casos en el tiempo", "All the cases over time")}</h1>
        <p class="lede">${L("El saber borrado, la biopiratería, la apropiación y el saqueo no son aportes: son lo que se les hizo. Viven aparte y citan las fichas a las que afectaron. Los casos anteriores a 1500 se dibujan en el borde izquierdo.", "Erased knowledge, biopiracy, appropriation and looting are not contributions: they are what was done to them. They live apart and cite the entries they affected. Cases before 1500 are drawn at the left edge.")}</p>
        <div class="timeline" style="margin-top:20px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Casos en el tiempo", "Cases over time")}">${ticks}${dots}</svg></div>
        <div class="legend">${TIPOS_CASO.map((t) => `<span><i class="sw" style="background:${COLOR_CASO[t.id]}"></i>${esc(t.nombre)}</span>`).join("")}</div>
        ${TIPOS_CASO.map((t) => {
          const cs = D.casos.filter((c) => c.tipo === t.id).sort((a, b) => a.fecha.anio - b.fecha.anio);
          return `<div class="family"><h3>${esc(t.nombre)} <span class="muted small">${cs.length}</span></h3><p class="q">${esc(t.pregunta)}</p><div class="case-list">${cs.map((c) => tarjetaCaso(c)).join("")}</div></div>`;
        }).join("")}
      </div>`;
    }
    function vistaCaso(id) {
      const c = CASO[id];
      if (!c) return noEncontrado();
      const N = notas();
      let codices = "";
      if (c.ubicaciones) {
        const pts = c.ubicaciones.map((u) => ptMundo(...u.coords));
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const m = 30, x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, w = Math.max(...xs) - x0 + m, h = Math.max(...ys) - y0 + m;
        codices = `<h2 class="sub">${L("Dónde están hoy", "Where they are today")} <span class="n">${c.ubicaciones.length}</span></h2>
          <div class="map-stage"><svg viewBox="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}" role="img" aria-label="${L("Mapa de Europa con la ubicación de los códices", "Map of Europe with the location of the codices")}">${tierras(GW)}${c.ubicaciones.map((u, i) => `<circle class="pt" cx="${r1(pts[i][0])}" cy="${r1(pts[i][1])}" r="1.7" style="stroke-width:.6" ${tip(`<b>${esc(u.codice)}</b>${esc(u.institucion)}, ${esc(u.ciudad)}`)}/>`).join("")}</svg></div>
          <table class="codices"><thead><tr><th>${L("Códice", "Codex")}</th><th>${L("Ciudad", "City")}</th><th>${L("Institución", "Institution")}</th></tr></thead><tbody>${c.ubicaciones.map((u) => `<tr><td><b>${esc(u.codice)}</b></td><td>${esc(u.ciudad)}</td><td>${esc(u.institucion)}</td></tr>`).join("")}</tbody></table>`;
      }
      const body = `<ul class="claims">${c.afirmaciones.map((a) => afirmacion(a, N)).join("")}</ul>${codices}
        ${c.pendientes.length ? `<h2 class="sub">${L("Lo que falta", "What is missing")}</h2><ul class="pendientes">${c.pendientes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}${N.lista()}`;
      const recs = RECORRIDOS_DE[c.id] || [];
      return `<article style="--c:${COLOR_CASO[c.tipo]}">
        <div class="ficha-head"><div class="wrap"><p class="eyebrow" style="color:var(--c)"><a href="#/despojo" style="color:inherit;text-decoration:none">${L("Lo que se les quitó", "What was taken from them")} · ${esc(TCASO[c.tipo].nombre)}</a></p><h1>${esc(c.titulo)}</h1>
          <p style="margin-top:12px">${botonCompartir()}</p>
          <dl class="facts" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><dt>${L("Tipo", "Type")}</dt><dd>${esc(TCASO[c.tipo].nombre)}<span class="why">${esc(TCASO[c.tipo].pregunta)}</span></dd></div><div><dt>${L("Estado", "Status")}</dt><dd>${esc(ECASO[c.estado].nombre)}<span class="why">${esc(ECASO[c.estado].texto)}</span></dd></div><div><dt>${L("Cuándo y dónde", "When and where")}</dt><dd>${esc(c.fecha.texto)}<span class="why">${esc(c.lugar)}</span></dd></div></dl></div></div>
        <div class="wrap"><div class="ficha-body"><div><div class="verdict"><p>${esc(c.resumen)}</p></div>${c.reclamo ? `<div class="reclamo-box"><p class="eyebrow">${L("Se reclama", "We demand")}</p><p>${esc(c.reclamo)}</p></div>` : ""}${c.fichas.length ? `<div class="afectadas">${c.fichas.map((id) => FICHA[id]).filter(Boolean).map((f) => tarjeta(f)).join("")}</div>` : ""}<h2 class="sub">${L("Las pruebas", "The evidence")} <span class="n">${c.afirmaciones.length}</span></h2>${body}</div>
          <aside class="side">${dentroMexico(...c.coords) ? `<div class="panel"><h3>${L("Dónde empezó", "Where it began")}</h3>${svgMexico([{ lat: c.coords[0], lon: c.coords[1], r: 22, cls: "on" }], { aria: c.lugar })}<p class="cap">${esc(c.lugar)}</p></div>` : ""}
          ${recs.length ? `<div class="panel"><h3>${L("Aparece en los recorridos", "Appears in the journeys")}</h3>${recs.map((r) => `<p style="margin-top:8px"><a href="#/recorrido/${r}">${esc(RECORRIDO[r].titulo)}</a></p>`).join("")}</div>` : ""}</aside></div></div></article>`;
    }

    // ------------------------------------------------------------ despojo
    function vistaDespojo() {
      const borr = D.fichas.flatMap((f) => f.nombres_mundo.filter((n) => BORRA.has(n.forma)).map((n) => ({ ...n, ficha: f })));
      const desterr = ["marigold", "china", "corea"].map((id) => RECORRIDO[id]).filter(Boolean)
        .concat(D.recorridos.filter((r) => !["marigold", "china", "corea"].includes(r.id) && r.pasos.every((p) => p.ficha)));
      return `<div class="wrap map-page">
        <p class="eyebrow">${L("Lo que se les quitó", "What was taken from them")}</p><h1>${L("Despojo: lo que se destruyó, se borró o salió de aquí sin crédito ni permiso", "Dispossession: what was destroyed, erased, or taken from here without credit or permission")}</h1>
        <p class="lede">${esc(C.postura.texto)}</p>
        ${CUENTA.capitulos.length ? `<a class="cuenta-aviso" href="#/cuenta"><span class="enc-lbl">${L("Contexto", "Context")}</span><b>${esc(CUENTA.titulo)}</b><span>${esc(CUENTA.entrada)}</span></a>` : ""}
        <div class="despojo-tipos" style="margin-top:26px">${TIPOS_CASO.map((t) => `<a class="dt-tipo" href="#/despojo#t-${t.id}" style="--c:${COLOR_CASO[t.id]}"><span class="n">${D.casos.filter((c) => c.tipo === t.id).length}</span><b>${esc(t.nombre)}</b><span>${esc(t.pregunta)}</span></a>`).join("")}
          <a class="dt-tipo" href="#/despojo#t-nombres" style="--c:var(--ink-2)"><span class="n">${borr.length}</span><b>${L("Nombres ajenos", "Foreign names")}</b><span>${L("¿El nombre que usa el mundo borra de dónde viene?", "Does the name the world uses erase where it comes from?")}</span></a>
          <a class="dt-tipo" href="#/despojo#t-desterritorio" style="--c:var(--muted)"><span class="n">${desterr.length}</span><b>${L("Desterritorialización", "Deterritorialization")}</b><span>${L("¿Otro país lo vive como propio y olvidó de dónde vino?", "Does another country live it as its own and forget where it came from?")}</span></a></div>
        <p style="margin-top:14px"><a href="#/casos">${L("Ver todos los casos en una línea del tiempo", "See all the cases on a timeline")}</a></p>
        ${TIPOS_CASO.map((t) => {
          const cs = D.casos.filter((c) => c.tipo === t.id).sort((a, b) => a.fecha.anio - b.fecha.anio);
          return `<div class="family" id="t-${t.id}"><h2 class="sub" style="color:${COLOR_CASO[t.id]}">${esc(t.nombre)} <span class="n">${cs.length}</span></h2><p class="q">${esc(t.pregunta)}</p><div class="case-list">${cs.map((c) => tarjetaCaso(c, true)).join("")}</div></div>`;
        }).join("")}
        <div class="family" id="t-nombres"><h2 class="sub">${L("Nombres ajenos", "Foreign names")} <span class="n">${borr.length}</span></h2><p class="q">${L("El mundo los usa a diario, y cada uno lleva el origen a otra parte.", "The world uses them every day, and each one carries the origin somewhere else.")}</p>
          <div class="wall">${borr.map((n) => `<a class="name" href="#/ficha/${n.ficha.id}"><div class="dice">${esc(n.dice)}</div><div class="es">${esc(n.lengua)} · ${esc(BORR[n.forma].nombre)}</div><div class="nota">${L("Es", "It is")} <b>${esc(n.ficha.nombre)}</b>${n.ficha.originales[0] ? `, <i>${esc(n.ficha.originales[0].forma)}</i>` : ""}. ${esc(n.nota || "")}${n.apunta ? ` → ${esc(n.apunta.nombre)}` : ""}</div></a>`).join("")}</div></div>
        <div class="family" id="t-desterritorio"><h2 class="sub">${L("Desterritorialización", "Deterritorialization")} <span class="n">${desterr.length}</span></h2><p class="q">${L("Cocinas y fiestas de otros países que hoy no se entienden sin lo que salió de aquí.", "Cuisines and festivities of other countries that today cannot be understood without what left here.")}</p>
          <div class="route-list">${desterr.map(tarjetaRecorrido).join("")}</div></div>
      </div>`;
    }

    // ------------------------------------------------------------ pueblos
    const FICHAS_DE = (pid) => D.fichas.filter((f) => f.pueblos.includes(pid)).sort(porAlcance);
    function vistaPueblos() {
      const puntos = D.pueblos.map((p) => ({ lat: p.coords[0], lon: p.coords[1], r: 9, href: `#/pueblo/${p.id}`, lbl: p.nombre.split(" (")[0], tip: `<b>${esc(p.nombre)}</b><span class="k">${esc(p.region)} · ${esc(p.periodo)}</span>` }));
      return `<div class="wrap map-page">
        <p class="eyebrow">${L("Pueblos", "Peoples")}</p><h1>${L("Quiénes lo crearon", "Who created it")}</h1>
        <p class="lede">${L("Cada aporte tiene autores. Aquí están los pueblos que nombran las fichas, con el nombre que se dan a sí mismos cuando se conoce, su lengua y lo que aportaron.", "Every contribution has authors. Here are the peoples the entries name, with the name they call themselves when it is known, their language and what they contributed.")}</p>
        <h2 class="sub">${L("Herencia y periodos", "Heritage and periods")}</h2>${linaje()}
        <div class="ficha-body" style="margin-top:28px;padding-bottom:0"><div class="pueblos">${D.pueblos.map((p) => {
          const fs = FICHAS_DE(p.id);
          return `<a class="pueblo" href="#/pueblo/${p.id}"><h3>${esc(p.nombre)}</h3>${p.nombre_propio ? `<span class="orig">${esc(p.nombre_propio)}</span>` : ""}
            <span class="muted small">${esc(p.lengua)} · ${esc(p.region)} · ${esc(p.periodo)}</span><span class="ver">${esc(p.en_breve)}</span>
            <span class="mini">${fs.slice(0, 6).map((f) => foto(f, "mini")).join("")}${fs.length > 6 ? `<span class="mas">+${fs.length - 6}</span>` : ""}</span></a>`;
        }).join("")}</div>
        <aside class="side"><div class="panel" style="position:sticky;top:90px"><h3>${L("Dónde vivieron o viven", "Where they lived or live")}</h3>${svgMexico(puntos, { etiquetas: true, aria: L("Mapa de México con los pueblos", "Map of Mexico with the peoples") })}<p class="cap">${L("Un punto por pueblo, en el centro de su región.", "One dot per people, at the center of its region.")}</p></div></aside></div>
      </div>`;
    }
    function vistaPueblo(id) {
      const p = PUEBLO[id];
      if (!p) return noEncontrado();
      const N = notas();
      const fs = FICHAS_DE(id);
      const de = D.pueblos.filter((q) => (q.heredan || []).includes(id));
      return `<article><div class="ficha-head"><div class="wrap">
        <p class="eyebrow"><a href="#/pueblos" style="color:inherit;text-decoration:none">${L("Pueblos", "Peoples")}</a></p><h1>${esc(p.nombre)}</h1>
        ${p.nombre_propio ? `<div class="originals"><span class="o-grande">${esc(p.nombre_propio)}</span><small>${L("nombre propio", "own name")}${N.cita(p.fuentes_nombre)}</small></div>` : `<p class="sin-orig">${L("No se sabe cómo se llamaban a sí mismos.", "It is not known what they called themselves.")}</p>`}
        <dl class="facts" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><dt>${L("Lengua", "Language")}</dt><dd>${esc(p.lengua)}</dd></div><div><dt>${L("Región", "Region")}</dt><dd>${esc(p.region)}</dd></div><div><dt>${L("Periodo", "Period")}</dt><dd>${esc(p.periodo)}${p.fuentes_periodo && p.fuentes_periodo.length ? N.cita(p.fuentes_periodo) : ""}</dd></div></dl>
        </div></div>
        <div class="wrap"><div class="ficha-body"><div>
          <div class="breve"><p class="eyebrow">${L("En pocas palabras", "In brief")}</p><p class="b">${esc(p.en_breve)}</p></div>
          ${(p.heredan || []).length || de.length ? `<div class="herencia">${de.map((q) => `<a href="#/pueblo/${q.id}">${esc(q.nombre)}</a>`).join("")}${de.length ? "<span>→</span>" : ""}<b>${esc(p.nombre)}</b>${(p.heredan || []).length ? "<span>→</span>" : ""}${(p.heredan || []).map((h) => `<a href="#/pueblo/${h}">${esc(nombrePueblo(h))}</a>`).join("")}</div>` : ""}
          ${p.afirmaciones.length ? `<h2 class="sub">${L("Las pruebas", "The evidence")} <span class="n">${p.afirmaciones.length}</span></h2><ul class="claims">${p.afirmaciones.map((a) => afirmacion(a, N)).join("")}</ul>` : ""}
          <h2 class="sub">${L("Lo que aportaron", "What they contributed")} <span class="n">${fs.length}</span></h2>
          ${fs.length ? `<div class="grid">${fs.map((f) => tarjeta(f)).join("")}</div>` : `<p class="muted">${L("Ninguna ficha lo nombra todavía.", "No entry names them yet.")}</p>`}
          ${N.lista()}
        </div><aside class="side"><div class="panel"><h3>${L("Dónde", "Where")}</h3>${svgMexico([{ lat: p.coords[0], lon: p.coords[1], r: 22, cls: "on" }], { aria: p.region })}<p class="cap">${esc(p.region)}</p></div></aside></div></div></article>`;
    }

    // ------------------------------------------------------------ lo que aún se niega
    // datos/cuenta.json: una narrativa en actos. En el texto, [[frase|id,id]] marca una frase con su fuente:
    // se subraya, muestra la fuente al pasar el mouse y la abre abajo al hacer clic.
    const CUENTA = D.cuenta || { capitulos: [] };
    const CAP = porId(CUENTA.capitulos);
    const MARCA = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
    const millones = (n) => (n >= 1 ? fmt(Math.round(n * 100) / 100) : fmt(Math.round(n * 1000) * 1000));
    const rango = (a, b, f) => (a === b ? f(a) : `${f(a)}–${f(b)}`);
    const sinMarcas = (s) => s.replace(MARCA, "$1");
    // Numeral mesoamericano: un punto por unidad y una barra por cada cinco, como en los códices.
    function numeral(n) {
      const barras = Math.floor(n / 5), puntos = n % 5, h = (puntos ? 14 : 4) + barras * 9;
      const ps = Array.from({ length: puntos }, (_, i) => `<circle cx="${20 + (i - (puntos - 1) / 2) * 9}" cy="6" r="3.4"/>`).join("");
      const bs = Array.from({ length: barras }, (_, i) => `<rect x="4" y="${(puntos ? 14 : 4) + i * 9}" width="32" height="5.5" rx="2.75"/>`).join("");
      return `<svg class="numeral" viewBox="0 0 40 ${h}" aria-hidden="true">${ps}${bs}</svg>`;
    }
    function prosa(s, N) {
      let html = "", i = 0;
      for (const m of s.matchAll(MARCA)) {
        html += esc(s.slice(i, m.index));
        i = m.index + m[0].length;
        const ids = m[2].split(",").map((x) => x.trim()).filter((x) => FUENTE[x]);
        const t = ids.map((id) => `<b>${esc(FUENTE[id].autores)} (${esc(FUENTE[id].anio)})</b>${esc(FUENTE[id].titulo)}`).join("<br>") + `<span class="k">${L("Clic para abrir la fuente abajo", "Click to open the source below")}</span>`;
        html += `<span class="ev" tabindex="0" role="button" data-ev="${ids.join(",")}" ${tip(t)}>${esc(m[1])}<sup>${ids.map((id) => N.numero(id)).join(",")}</sup></span>`;
      }
      return html + esc(s.slice(i));
    }
    function dineroCuenta(c, N) {
      const onzas = c.pesos * c.onzas_por_peso, toneladas = (onzas * 31.1034768) / 1e6, usd = onzas * c.precio_onza;
      const mil = (n) => fmt(Math.round(n / 1e8) / 10);
      const t = Math.round(toneladas / 100) * 100;
      return `<figure class="calc">
        <div class="calc-filas">
          <p><span class="k">${L("Pesos que salieron de la Casa de Moneda de México", "Pesos that left the Mexico City Mint")}</span><b>${L("más de", "over")} ${fmt(c.pesos / 1e6)} ${L("millones", "million")}</b></p>
          <p><span class="k">× ${fmt(c.onzas_por_peso)} ${L("onzas troy de plata fina por peso", "troy ounces of fine silver per peso")}</span><b>${mil(onzas)} ${L("mil millones de onzas", "billion ounces")}</b></p>
          <p><span class="k">${L("En toneladas", "In metric tons")}</span><b>${L("casi", "almost")} ${fmt(t)} t</b></p>
          <p class="total"><span class="k">× ${fmt(c.precio_onza)} ${L("dólares la onza", "dollars an ounce")} (${esc(c.fecha_precio)})</span><b>${L("al menos", "at least")} ${fmt(Math.floor(usd / 1e9))} ${L("mil millones de dólares", "billion dollars")}</b></p>
        </div>
        <p class="calc-comp">${L(`Toda la América española produjo entre ${fmt(c.total_america[0])} y ${fmt(c.total_america[1])} toneladas de plata de 1500 a 1800. Solo esta casa de moneda acuñó entre ${pct(t, c.total_america[1])} % y ${pct(t, c.total_america[0])} % de esa cifra.`,
          `All of Spanish America produced between ${fmt(c.total_america[0])} and ${fmt(c.total_america[1])} metric tons of silver from 1500 to 1800. This mint alone struck between ${pct(t, c.total_america[1])}% and ${pct(t, c.total_america[0])}% of that.`)}</p>
        <figcaption class="cap">${esc(c.nota)}${N.cita(c.fuentes)}</figcaption>
      </figure>`;
    }
    function graficaSerie(g, N) {
      const W = 640, H = 270, x0 = 52, x1 = W - 20, y0 = 20, y1 = H - 34, a0 = 1510, a1 = 1630, top = 26;
      const X = (a) => x0 + ((a - a0) / (a1 - a0)) * (x1 - x0), Y = (v) => y1 - (v / top) * (y1 - y0);
      const pts = g.puntos;
      const linea = pts.map((p, i) => `${i ? "L" : "M"}${r1(X(p.anio))},${r1(Y(p.millones))}`).join(" ");
      const area = `${linea} L${r1(X(pts[pts.length - 1].anio))},${y1} L${r1(X(pts[0].anio))},${y1} Z`;
      const rejilla = [0, 5, 10, 15, 20, 25].map((v) => `<line class="gl" x1="${x0}" x2="${x1}" y1="${r1(Y(v))}" y2="${r1(Y(v))}"/><text class="gt" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${v}</text>`).join("");
      const anios = [1520, 1540, 1560, 1580, 1600, 1620].map((a) => `<text class="gt" x="${r1(X(a))}" y="${H - 12}" text-anchor="middle">${a}</text>`).join("");
      const marcas = pts.map((p) => {
        const t = `<b>${esc(p.texto || p.anio)}</b>${millones(p.millones)} ${p.millones >= 1 ? L("millones de personas", "million people") : L("personas", "people")}`;
        return `<g class="pg" ${tip(t)}><circle class="hit" cx="${r1(X(p.anio))}" cy="${r1(Y(p.millones))}" r="14"/><circle class="dot" cx="${r1(X(p.anio))}" cy="${r1(Y(p.millones))}" r="5"/></g>`;
      }).join("");
      const ini = pts[0], fin = pts[pts.length - 1];
      return `<figure class="graf">
        <figcaption class="graf-t">${esc(g.nombre)}</figcaption>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.nombre)}: ${pts.map((p) => `${p.texto || p.anio}, ${p.millones}`).join("; ")}">
          ${rejilla}${anios}<path class="area" d="${area}"/><path class="ln" d="${linea}"/>${marcas}
          <text class="dl" x="${r1(X(ini.anio) + 10)}" y="${r1(Y(ini.millones) + 4)}">${fmt(ini.millones)} ${L("millones", "million")} (${ini.anio})</text>
          <text class="dl" x="${r1(X(fin.anio) - 4)}" y="${r1(Y(fin.millones) - 14)}" text-anchor="end">${L("unas", "about")} ${millones(fin.millones)} (${esc(fin.texto || fin.anio)})</text>
        </svg>
        <details class="graf-datos"><summary>${L("Ver los datos", "See the data")}</summary><table><thead><tr><th>${L("Año", "Year")}</th><th>${L("Millones de personas", "Million people")}</th></tr></thead><tbody>${pts.map((p) => `<tr><td>${esc(p.texto || p.anio)}</td><td>${fmt(p.millones)}</td></tr>`).join("")}</tbody></table></details>
        <p class="cap">${L("Es la estimación más alta; las demás parten de menos gente, pero todas muestran la caída.", "This is the highest estimate; the others start from fewer people, but all show the collapse.")}${N.cita(g.fuentes)}</p>
      </figure>`;
    }
    function graficaCaidas(g, N) {
      const filas = g.filas, W = 640, izq = 236, der = W - 62, alto = 30, H = filas.length * alto + 34;
      const X = (v) => izq + (v / 100) * (der - izq);
      const valle = (f) => /valle/i.test(f.lugar) || /valley/i.test(f.lugar);
      const barras = filas.map((f, i) => {
        const y = 10 + i * alto, [a, b] = f.caida, cls = valle(f) ? "valle" : "otro";
        const t = `<b>${esc(f.autor)} · ${esc(f.lugar)}</b>1519: ${rango(f.inicio[0], f.inicio[1], millones)} ${L("millones", "million")} → 1595: ${rango(f.fin[0], f.fin[1], millones)} ${L("millones", "million")}<br>${L("Caída", "Decline")}: ${rango(a, b, String)} %`;
        return `<g class="fila ${cls}" ${tip(t)}><rect class="hit" x="0" y="${y - 4}" width="${W}" height="${alto}"/>
          <text class="gk" x="${izq - 10}" y="${y + 15}" text-anchor="end">${esc(f.autor)}<tspan class="gl2"> · ${esc(f.lugar)}</tspan></text>
          <rect class="b" x="${izq}" y="${y + 4}" width="${r1(X(a) - izq)}" height="14" rx="3"/>${b > a ? `<rect class="b ext" x="${r1(X(a) + 2)}" y="${y + 4}" width="${r1(X(b) - X(a) - 2)}" height="14" rx="3"/>` : ""}
          <text class="gv" x="${r1(X(b) + 8)}" y="${y + 15}">${rango(a, b, String)} %</text></g>`;
      }).join("");
      const ejes = [0, 25, 50, 75, 100].map((v) => `<line class="gl" x1="${r1(X(v))}" x2="${r1(X(v))}" y1="6" y2="${H - 26}"/><text class="gt" x="${r1(X(v))}" y="${H - 10}" text-anchor="middle">${v} %</text>`).join("");
      return `<figure class="graf">
        <figcaption class="graf-t">${esc(g.nombre)}</figcaption>
        <p class="leyenda"><span><i class="sw valle"></i>${L("Valle de México, donde está la capital", "Valley of Mexico, where the capital is")}</span><span><i class="sw otro"></i>${L("Todo México u otras regiones", "All of Mexico or other regions")}</span><span><i class="sw ext"></i>${L("Rango de la estimación", "Range of the estimate")}</span></p>
        <div class="graf-scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.nombre)}">${ejes}${barras}</svg></div>
        <details class="graf-datos"><summary>${L("Ver los datos", "See the data")}</summary><table><thead><tr><th>${L("Autor", "Author")}</th><th>${L("Zona", "Area")}</th><th>1519</th><th>1595</th><th>${L("Caída", "Decline")}</th></tr></thead><tbody>${filas.map((f) => `<tr><td>${esc(f.autor)}</td><td>${esc(f.lugar)}</td><td>${rango(f.inicio[0], f.inicio[1], fmt)}</td><td>${rango(f.fin[0], f.fin[1], fmt)}</td><td>${rango(f.caida[0], f.caida[1], String)} %</td></tr>`).join("")}</tbody></table><p class="muted small">${L("En millones de personas.", "In millions of people.")}</p></details>
        <p class="cap">${L("Se discute cuánta gente había, no si murió.", "What is debated is how many people there were, not whether they died.")}${N.cita(g.fuentes)}</p>
      </figure>`;
    }
    function ciudadCuenta(g, N) {
      return `<div class="ciudad">
        <div><span class="k">1519 · Tenochtitlan-Tlatelolco</span><b>${fmt(g.antes[0])}–${fmt(g.antes[1])}</b><span class="muted small">${L("personas, según la estimación", "people, depending on the estimate")}${N.cita(g.fuentes.slice(0, -1))}</span></div>
        <div><span class="k">1803 · ${L("Ciudad de México", "Mexico City")}</span><b>${L("algo más de", "just over")} ${fmt(g.despues)}</b><span class="muted small">${L("habitantes de todos los orígenes, casi 300 años después", "inhabitants of every origin, almost 300 years later")}${N.cita(g.fuentes.slice(-1))}</span></div></div>`;
    }
    // El mercurio de las minas: cada gota, mil toneladas.
    function mercurio(m, N) {
      const gotas = Math.round(m.total / 1000);
      return `<figure class="mercurio">
        <div class="merc-cifra"><b>${fmt(m.mercurio)} t</b><span>${L(`de mercurio al año se perdían en las minas de la América española, de ${m.desde} a ${m.hasta}`, `of mercury a year were lost in the mines of Spanish America, from ${m.desde} to ${m.hasta}`)}</span></div>
        <div class="gotas" role="img" aria-label="${L(`${fmt(m.total)} toneladas de mercurio en total`, `${fmt(m.total)} metric tons of mercury in all`)}" ${tip(`<b>${fmt(m.total)} t</b>${L("dispersas en Centro y Sudamérica por la minería del oro y la plata", "dispersed across Central and South America by gold and silver mining")}`)}>${"<i></i>".repeat(gotas)}</div>
        <figcaption class="cap">${L(`En total, ${fmt(m.total)} toneladas en Centro y Sudamérica. Cada gota son mil toneladas.`, `In all, ${fmt(m.total)} metric tons across Central and South America. Each drop is a thousand tons.`)}${N.cita(m.fuentes)}</figcaption>
      </figure>`;
    }
    // A dónde fue la plata: un mapa esquemático, no a escala. Cada punto abre su frase con fuente.
    const FLUJO_XY = { china: [84, 160], manila: [200, 236], acapulco: [356, 262], minas: [392, 122], mexico: [424, 196, "w"], veracruz: [500, 206], caribe: [574, 286], sevilla: [664, 190], guerras: [744, 150], norte: [664, 84] };
    const FLUJO_RUTAS = [["minas", "mexico"], ["mexico", "veracruz"], ["mexico", "acapulco"], ["veracruz", "sevilla"], ["veracruz", "caribe"], ["sevilla", "guerras"], ["sevilla", "norte"], ["acapulco", "manila"], ["manila", "china"]];
    function flujo(f, N) {
      const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const curva = ([a, b]) => {
        const [x1, y1] = FLUJO_XY[a], [x2, y2] = FLUJO_XY[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
        return `M${x1},${y1} Q${r1(mx - dy * 0.18)},${r1(my + dx * 0.18)} ${x2},${y2}`;
      };
      const rutas = FLUJO_RUTAS.map((r, i) => `<path id="ruta-${i}" class="ruta" d="${curva(r)}"/>${quieto ? "" : [0, 1].map((k) => `<circle class="moneda" r="3"><animateMotion dur="${5 + (i % 3)}s" begin="${-k * 2.6 - i * 0.7}s" repeatCount="indefinite"><mpath href="#ruta-${i}"/></animateMotion></circle>`).join("")}`).join("");
      const zonas = [[24, 70, 236, 214, L("Asia", "Asia")], [318, 70, 220, 214, L("Nueva España", "New Spain")], [604, 24, 176, 210, L("Europa", "Europe")]]
        .map(([x, y, w, h, t]) => `<rect class="zona" x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/><text class="zona-t" x="${x + 14}" y="${y + 22}">${t}</text>`).join("");
      const nodos = f.nodos.map((n, i) => {
        const [x, y, lado] = FLUJO_XY[n.id];
        const etiqueta = lado === "w" ? `x="${x - 16}" y="${y + 5}" text-anchor="end"` : `x="${x}" y="${y + 28}" text-anchor="middle"`;
        return `<g class="nodo${i ? "" : " on"}" tabindex="0" role="button" aria-pressed="${i ? "false" : "true"}" data-nodo="${n.id}" aria-label="${esc(n.titulo)}"><circle class="halo" cx="${x}" cy="${y}" r="18"/><circle class="pt" cx="${x}" cy="${y}" r="7"/><text ${etiqueta}>${esc(n.titulo)}</text></g>`;
      }).join("");
      const paneles = f.nodos.map((n, i) => `<div class="flujo-nodo" data-panel="${n.id}" ${i ? "hidden" : ""}><p class="k">${esc(n.lugar)}</p><h3>${esc(n.titulo)}</h3><p>${prosa(n.texto, N)}</p></div>`).join("");
      return `<figure class="flujo">
        <div class="graf-scroll"><svg viewBox="0 0 790 330" role="group" aria-label="${L("Mapa de las rutas de la plata", "Map of the silver routes")}">
          <text class="mar" x="236" y="318">${L("Océano Pacífico", "Pacific Ocean")}</text><text class="mar" x="552" y="128">${L("Océano Atlántico", "Atlantic Ocean")}</text>
          ${zonas}${rutas}${nodos}</svg></div>
        <div class="flujo-panel" aria-live="polite">${paneles}</div>
        <figcaption class="cap">${L("Esquema de las rutas, no a escala.", "Schematic of the routes, not to scale.")}</figcaption>
      </figure>`;
    }
    // Quién lo reconoce y quién lo niega: una línea de tiempo con dos lados.
    function lineaNiega(eventos, N) {
      const lado = { reconoce: L("Lo reconoce", "Acknowledges it"), niega: L("Lo niega o lo minimiza", "Denies or downplays it") };
      return `<figure class="linea-niega">
        <p class="leyenda"><span><i class="sw reconoce"></i>${lado.reconoce}</span><span><i class="sw niega"></i>${lado.niega}</span></p>
        <ol>${eventos.map((e) => `<li class="${e.lado}"><span class="ln-anio">${esc(e.anio)}</span><div class="ln-c"><span class="k">${lado[e.lado]}</span><p>${prosa(e.texto, N)}</p></div></li>`).join("")}</ol>
      </figure>`;
    }
    function lamina(l, id) {
      return `<figure class="lamina">
        <button class="lam-btn" type="button" data-lamina="${id}" aria-label="${L("Ampliar la lámina", "Enlarge the plate")}: ${esc(l.codice)}">
          <img src="${esc(l.archivo)}" alt="${esc(l.pie)}" loading="lazy" decoding="async"><span class="lam-zoom">${L("Ampliar", "Enlarge")}</span></button>
        <figcaption><b>${esc(l.codice)}</b><span class="muted"> · ${esc(l.fecha)}</span><span class="lam-pie">${esc(l.pie)}</span></figcaption>
      </figure>`;
    }
    const voz = (q, N) => `<figure class="voz"><svg class="voluta" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 42c0-17 11-30 25-30 9 0 13 6 13 11 0 6-5 9-9 9-5 0-7-4-6-7 1-2 3-3 5-2"/></svg>
      <blockquote>«${esc(q.texto)}»</blockquote><figcaption>${esc(q.quien)}${N.cita(q.fuentes)}</figcaption></figure>`;
    function vistaCuenta() {
      const N = notas();
      const caps = CUENTA.capitulos;
      const seguir = (c) => {
        const casos = c.casos.map((id) => CASO[id]).filter(Boolean), fichas = c.fichas.filter((id) => FICHA[id]);
        if (!casos.length && !fichas.length && !c.enlace) return "";
        return `<div class="seguir"><span class="k">${L("Para seguir", "Keep going")}</span>
          ${casos.map((k) => `<a class="chip" href="#/caso/${k.id}"><span class="sw" style="background:${COLOR_CASO[k.tipo]}"></span>${esc(k.titulo)}</a>`).join("")}
          ${fichas.map(chipFicha).join("")}${c.enlace ? `<a class="chip enl" href="${esc(c.enlace.href)}">${esc(c.enlace.texto)} →</a>` : ""}</div>`;
      };
      const visual = (c) => ({
        ciudad: () => ciudadCuenta(c.ciudad, N),
        poblacion: () => graficaSerie(c.graficas.serie, N) + graficaCaidas(c.graficas.estimaciones, N),
        minas: () => mercurio(c.minas, N),
        dinero: () => dineroCuenta(c.calculo, N),
        flujo: () => flujo(c.flujo, N),
        linea: () => lineaNiega(c.linea, N)
      }[c.visual] || (() => ""))();
      const acto = (c, i) => {
        const ultimo = i === caps.length - 1;
        return `<section class="cn-acto${ultimo ? " cierre" : ""}" id="${c.id}">
          <span class="acto-glifo">${numeral(i + 1)}</span>
          <header class="acto-cab">${c.periodo ? `<p class="acto-per">${esc(c.periodo)}</p>` : ""}<h2>${esc(c.titulo)}</h2><p class="acto-ent">${esc(c.entrada)}</p></header>
          <div class="acto-cuerpo${c.lamina ? " con-lamina" : ""}">
            <div class="acto-texto">${c.texto.map((p) => `<p>${prosa(p, N)}</p>`).join("")}${c.cita ? voz(c.cita, N) : ""}</div>
            ${c.lamina ? `<div class="acto-lam">${lamina(c.lamina, c.id)}</div>` : ""}
          </div>
          ${c.visual ? `<div class="acto-visual">${visual(c)}</div>` : ""}
          ${seguir(c)}
          ${ultimo ? `<p class="cierre-enl"><a class="btn" href="#/despojo">${L("Lo que se les quitó", "What was taken from them")}</a> <a class="btn ghost" href="#/nombres">${L("Los nombres", "The names")}</a></p>` : ""}
        </section>`;
      };
      const actos = caps.map(acto).join("");
      const refs = N.lista(true);
      const tira = `<nav class="cn-tira" aria-label="${L("Actos", "Acts")}"><ol>${caps.map((c, i) => `<li><a href="#/cuenta#${c.id}" data-acto="${c.id}">${numeral(i + 1)}<span>${esc(c.titulo)}</span></a></li>`).join("")}</ol></nav>`;
      return `<article class="cuenta-n" id="arriba">
        <header class="cn-hero wrap">
          <p class="eyebrow"><a href="#/despojo">${L("Lo que se les quitó", "What was taken from them")}</a> · ${L("contexto", "context")}</p>
          <div class="enc-h1"><h1>${esc(CUENTA.titulo)}</h1>${botonCompartir()}</div>
          <p class="cn-lead">${esc(CUENTA.entrada)}</p>
          <p class="cn-guia"><span class="ev muestra">${L("Las frases subrayadas", "Underlined phrases")}</span> ${L("llevan su fuente: pasa el mouse para verla o haz clic para abrirla abajo. Las láminas son de códices de la época y se amplían con un clic.", "carry their source: hover to see it, or click to open it below. The plates come from codices of the period and enlarge with a click.")}</p>
        </header>
        ${tira}
        <div class="cn-camino wrap"><div class="huellas" aria-hidden="true"><i></i></div>
          ${actos}
          ${refs ? `<section class="cn-acto fuentes-acto" id="fuentes"><details class="cn-fuentes"><summary>${L("Todas las fuentes", "All the sources")} <span class="n">${N.total()}</span></summary>${refs}</details></section>` : ""}
        </div>
        <aside class="evid" hidden aria-live="polite" aria-label="${L("Fuente", "Source")}"><button class="evid-x" type="button" aria-label="${L("Cerrar", "Close")}">×</button><div class="evid-c"></div></aside>
        <dialog class="visor" aria-label="${L("Lámina", "Plate")}"></dialog>
      </article>`;
    }
    function abrirEvidencia(el) {
      const caja = document.querySelector(".evid");
      if (!caja) return;
      document.querySelectorAll(".ev.activa").forEach((x) => x.classList.remove("activa"));
      el.classList.add("activa");
      const frase = el.cloneNode(true);
      frase.querySelectorAll("sup").forEach((s) => s.remove());
      const nums = el.querySelector("sup").textContent.split(",");
      caja.querySelector(".evid-c").innerHTML = `<p class="k">${L("La frase", "The phrase")}</p><p class="evid-frase">${esc(frase.textContent)}</p>
        <p class="k">${el.dataset.ev.includes(",") ? L("Las fuentes", "The sources") : L("La fuente", "The source")}</p>
        <ol class="evid-refs">${el.dataset.ev.split(",").map((id, i) => `<li><span class="num">${nums[i]}</span><div><div class="ref">${refFuente(FUENTE[id])}</div><div>${resFuente(FUENTE[id])} <span class="muted small">· ${esc(TFUENTE[FUENTE[id].tipo].nombre)}</span></div></div></li>`).join("")}</ol>`;
      caja.hidden = false;
    }
    function cerrarEvidencia() {
      const caja = document.querySelector(".evid");
      if (caja) caja.hidden = true;
      document.querySelectorAll(".ev.activa").forEach((x) => x.classList.remove("activa"));
    }
    function abrirVisor(id) {
      const l = CAP[id].lamina, v = document.querySelector("dialog.visor");
      v.innerHTML = `<button class="visor-x" type="button" aria-label="${L("Cerrar", "Close")}">×</button>
        <img src="${esc(l.archivo)}" alt="${esc(l.pie)}">
        <div class="visor-pie"><p class="k">${esc(l.codice)} · ${esc(l.fecha)}</p><p>${esc(l.pie)}</p>
          <p class="muted small">${esc(l.custodia)} · ${L("Dominio público", "Public domain")} · <a href="${esc(l.commons)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>
          <p class="small">${l.fuentes.map((x) => refFuente(FUENTE[x])).join("<br>")}</p></div>`;
      v.showModal();
    }
    function elegirNodo(g) {
      const fig = g.closest(".flujo");
      fig.querySelectorAll(".nodo").forEach((n) => { n.classList.toggle("on", n === g); n.setAttribute("aria-pressed", n === g); });
      fig.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== g.dataset.nodo));
    }

    // ------------------------------------------------------------ recorridos
    const tarjetaRecorrido = (r) => `<a class="route" href="#/recorrido/${r.id}"><span class="mini">${r.pasos.filter((p) => p.ficha).slice(0, 5).map((p) => foto(FICHA[p.ficha], "mini")).join("")}</span><h3>${esc(r.titulo)}</h3><p>${esc(r.entrada)}</p><span class="steps">${r.pasos.map((p) => `<i class="${p.caso ? "c" : ""}"></i>`).join("")}</span><p class="muted small" style="margin-top:6px">${plural(r.pasos.length, L("paso", "step"), L("pasos", "steps"))}</p></a>`;
    function vistaRecorridos() {
      return `<div class="wrap map-page"><p class="eyebrow">${L("Recorridos", "Journeys")}</p><h1>${L("Historias que cruzan fichas", "Stories that run across entries")}</h1>
        <p class="lede">${L("Un recorrido no duplica fichas: las ordena para contar algo que ninguna cuenta sola, como la cocina china sin México o la flor que India cree suya.", "A journey does not duplicate entries: it orders them to tell something none tells alone, like Chinese cooking without Mexico or the flower India believes is its own.")}</p>
        <div class="route-list" style="margin-top:24px">${D.recorridos.map(tarjetaRecorrido).join("")}</div></div>`;
    }
    function vistaRecorrido(id) {
      const r = RECORRIDO[id];
      if (!r) return noEncontrado();
      const N = notas();
      const pasos = r.pasos.map((p) => {
        const destino = p.ficha ? tarjeta(FICHA[p.ficha]) : p.caso ? tarjetaCaso(CASO[p.caso]) : "";
        return `<li><div><p class="step">${esc(p.texto)}</p>${destino}</div></li>`;
      }).join("");
      return `<div class="wrap map-page" style="max-width:820px"><p class="eyebrow"><a href="#/recorridos" style="color:inherit;text-decoration:none">${L("Recorrido", "Journey")}</a></p><h1>${esc(r.titulo)}</h1><p class="lede">${esc(r.entrada)}</p><p style="margin-top:14px">${botonCompartir()}</p>
        ${r.afirmaciones && r.afirmaciones.length ? `<ul class="claims" style="margin-top:18px">${r.afirmaciones.map((a) => afirmacion(a, N)).join("")}</ul>` : ""}
        <ol class="path">${pasos}</ol>
        ${r.pendientes && r.pendientes.length ? `<h2 class="sub">${L("Lo que falta", "What is missing")}</h2><ul class="pendientes">${r.pendientes.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}${N.lista()}</div>`;
    }

    // ------------------------------------------------------------ fuentes
    function vistaFuentes(filtros) {
      const m = D.metricas;
      const tipo = filtros.tipo || "", res = filtros.res || "";
      const lista = D.fuentes.filter((f) => (!tipo || f.tipo === tipo) && (!res || (f.comprobacion || {}).resultado === res))
        .sort((a, b) => TFUENTE[a.tipo].rango - TFUENTE[b.tipo].rango || String(a.autores).localeCompare(b.autores));
      const porRes = m.fuentes_por_resultado;
      const nombreRes = L(
        { ok: "Comprobadas", discrepancia: "No coinciden", error: "Enlace roto", bloqueada: "Bloquean la comprobación", sin_enlace: "Sin enlace" },
        { ok: "Verified", discrepancia: "Do not match", error: "Broken link", bloqueada: "Block checking", sin_enlace: "No link" });
      const destinos = (ids) => ids.map((id) => FICHA[id] ? `<a href="#/ficha/${id}">${esc(FICHA[id].nombre)}</a>` : CASO[id] ? `<a href="#/caso/${id}">${esc(CASO[id].titulo)}</a>` : RECORRIDO[id] ? `<a href="#/recorrido/${id}">${esc(RECORRIDO[id].titulo)}</a>` : CAP[id] ? `<a href="#/cuenta#${id}">${esc(CAP[id].titulo)}</a>` : PUEBLO[id] ? `<a href="#/pueblo/${id}">${esc(PUEBLO[id].nombre)}</a>` : esc(id)).join(", ");
      const filas = lista.map((f) => `<tr><td class="t">${refFuente(f)}</td><td>${esc(TFUENTE[f.tipo].nombre)}<div class="muted small">${L("rango", "rank")} ${TFUENTE[f.tipo].rango}</div></td><td>${resFuente(f)}</td><td class="small">${destinos(f.citada_por || [])}</td></tr>`).join("");
      const hf = (o) => `#/fuentes?${Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&")}`;
      return `<div class="wrap map-page"><p class="eyebrow">${L("Fuentes", "Sources")}</p><h1>${L(`${fmt(m.fuentes)} fuentes y lo que se comprobó de cada una`, `${fmt(m.fuentes)} sources and what was checked about each one`)}</h1>
        <p class="lede">${L("El verificador busca cada DOI en Crossref y compara el título y el año registrados; abre cada enlace y anota si responde. <b>Comprobar el registro no es leer el pasaje</b>: confirma que la fuente existe y es la que se dice, no que diga lo que se le atribuye.", "The checker looks up each DOI in Crossref and compares the registered title and year; it opens each link and notes whether it responds. <b>Checking the record is not reading the passage</b>: it confirms that the source exists and is the one cited, not that it says what is attributed to it.")}</p>
        <div class="defs" style="margin-top:24px">
          <div class="def"><h3>${L("Afirmaciones", "Claims")}</h3><p class="q">${esc(C.pregunta_verificacion)}</p>${vbar(m.afirmaciones, "stack")}
            <div class="legend">${C.verificacion.slice().reverse().map((v) => `<span class="vstate ${v.id}"><i></i>${esc(v.nombre)}: ${fmt(m.afirmaciones[v.id] || 0)}</span>`).join("")}</div></div>
          <div class="def"><h3>${L("Fuentes", "Sources")}</h3><p class="q">${L("¿Qué respondió la comprobación?", "What did the check return?")}</p>
            <div class="stack">${Object.entries(porRes).map(([k, n]) => `<span class="${k === "ok" ? "comprobada" : "pendiente"}" style="flex:${n}" ${tip(`<b>${esc(nombreRes[k] || k)}</b>${n}`)}>${n / m.fuentes > 0.06 ? n : ""}</span>`).join("")}</div>
            <div class="legend">${Object.entries(porRes).map(([k, n]) => `<span class="res ${k}"><i></i>${esc(nombreRes[k] || k)}: ${n}</span>`).join("")}</div></div>
        </div>
        <div class="map-tools" style="margin-top:28px"><a class="chip" aria-pressed="${!tipo}" href="${hf({ res })}">${L("Todos los tipos", "All types")}</a>${C.tipos_fuente.map((t) => `<a class="chip" aria-pressed="${tipo === t.id}" href="${hf({ tipo: t.id, res })}" title="${esc(t.texto || "")}">${esc(t.nombre)} <span class="n">${D.fuentes.filter((f) => f.tipo === t.id).length}</span></a>`).join("")}</div>
        <div class="map-tools" style="margin-top:0"><a class="chip" aria-pressed="${!res}" href="${hf({ tipo })}">${L("Cualquier resultado", "Any result")}</a>${Object.keys(porRes).map((k) => `<a class="chip" aria-pressed="${res === k}" href="${hf({ tipo, res: k })}">${esc(nombreRes[k] || k)}</a>`).join("")}</div>
        <p class="abiertos">${L('Todos los datos son abiertos: <a href="datos-abiertos.json" download>descargar en JSON</a> (fichas, afirmaciones, fuentes, casos, pueblos y comprobaciones), con licencia CC BY 4.0.', 'All the data is open: <a href="datos-abiertos.json" download>download as JSON</a> (entries, claims, sources, cases, peoples and checks, in Spanish), under a CC BY 4.0 license.')}</p>
        <div class="src-table-wrap"><table class="src"><thead><tr><th>${L("Referencia", "Reference")}</th><th>${L("Tipo", "Type")}</th><th>${L("Comprobación", "Check")}</th><th>${L("Se cita en", "Cited in")}</th></tr></thead><tbody>${filas}</tbody></table></div>
        ${D.avisos.length ? `<h2 class="sub">${L("Avisos del verificador", "Checker warnings (in Spanish)")} <span class="n">${D.avisos.length}</span></h2><ul class="pendientes">${D.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      </div>`;
    }

    // ------------------------------------------------------------ método
    function vistaMetodo(ancla) {
      const ejes = [
        [L("Ámbito", "Field"), L("¿Para qué le sirve al mundo?", "What does it do for the world?"), C.ambitos.map((a) => [a.nombre, `${a.pregunta} ${L("Incluye", "Includes")}: ${a.incluye}${a.excluye ? ` ${L("No incluye", "Does not include")}: ${a.excluye}` : ""}`])],
        [L("Alcance", "Reach"), C.pregunta_alcance, C.alcance.map((a) => [a.nombre, a.texto]).concat([[L("Cómo se decide", "How it is decided"), C.nota_alcance]])],
        [L("Naturaleza", "Nature"), C.pregunta_naturaleza, C.naturalezas.map((a) => [a.nombre, a.texto || ""])],
        [L("Actos", "Acts"), C.pregunta_actos, C.actos.map((a) => [`${a.marca} · ${a.nombre}`, a.texto])],
        [L("Territorio", "Territory"), C.pregunta_territorio, C.territorios.map((a) => [a.nombre, a.texto])],
        [L("Época", "Period"), C.pregunta_epoca, C.epocas.map((a) => [a.nombre, a.texto])],
        [L("Clase", "Class"), L("¿Se reclama como aporte?", "Is it claimed as a contribution?"), C.clases.map((a) => [a.nombre, a.texto])],
        [L("Tipo de caso", "Type of case"), L("¿Qué se les hizo?", "What was done to them?"), TIPOS_CASO.map((a) => [a.nombre, a.pregunta])],
        [L("Solidez", "Strength"), C.pregunta_solidez, C.solidez.map((a) => [a.nombre, a.texto])],
        [L("Verificación", "Verification"), C.pregunta_verificacion, C.verificacion.map((a) => [a.nombre, a.texto])],
        [L("Documentación", "Documentation"), L("¿Cuánto está documentada la ficha?", "How well documented is the entry?"), C.documentacion.map((a) => [a.nombre, a.texto])]
      ];
      const traduccion = L([
        ["Tipo «Originario»", "Se separa en dos ejes: el acto (nativo o creado) y el territorio (México)."],
        ["Tipo «Domesticado»", "Acto «domesticado». Si la especie silvestre vino de fuera, su origen biológico se anota aparte y se dibuja en el mapa."],
        ["Tipo «Nombrado»", "Acto «nombrado». El origen biológico queda en su propio campo, para no confundir la palabra con la planta."],
        ["Tipo «Mesoamericano»", "No es un tipo: es el eje territorio, que pregunta dónde está la evidencia más antigua. Si está en México, el aporte es de México aunque después se compartiera."],
        ["Tipo «Mexicano moderno»", "No es un tipo: es la época (virreinal o moderna). La autoría, si la hay, va en su campo."],
        ["Confianza alta, media, debatida", "Pasa de la ficha a cada afirmación, como solidez: consenso, sustentada o en debate."],
        ["«Por verificar» dentro de la confianza", "Se separa: la ficha lista sus pendientes y la afirmación sin fuente se marca pendiente."],
        ["Escala de evidencia (cinco niveles)", "Cinco líneas que se marcan presentes o ausentes, y se comparan entre México y otra región."],
        ["Secciones (Sabores, Cocina italiana, Animales…)", "Cada ficha en un solo ámbito. Lo transversal pasa a recorridos; «animal» es una naturaleza."],
        ["Imitaciones y nombres que borran el origen", "Cada nombre vive en su ficha con una de cinco formas de borrado."],
        ["Saqueo y biopiratería", "Son casos: le pasaron a un aporte y lo citan, pero no son aportes."],
        ["Lo que no es mexicano («No mexicano», «Debatida»)", "Son deslindes: se publican con la misma vara y no se cuentan."]
      ], [
        ["Type «Originario» (originary)", "Split into two axes: the act (native or created) and the territory (Mexico)."],
        ["Type «Domesticado» (domesticated)", "The act «domesticated». If the wild species came from elsewhere, its biological origin is recorded separately and drawn on the map."],
        ["Type «Nombrado» (named)", "The act «named». The biological origin stays in its own field, so the word is not confused with the plant."],
        ["Type «Mesoamericano» (Mesoamerican)", "It is not a type: it is the territory axis, which asks where the oldest evidence is. If it is in Mexico, the contribution is Mexico's even if it was shared later."],
        ["Type «Mexicano moderno» (modern Mexican)", "It is not a type: it is the period (colonial or modern). Authorship, if any, goes in its own field."],
        ["High, medium, debated confidence", "It moves from the entry to each claim, as strength: consensus, supported or debated."],
        ["«To be verified» inside confidence", "Split off: the entry lists what is pending, and a claim without a source is marked pending."],
        ["Evidence scale (five levels)", "Five lines marked present or absent, and compared between Mexico and another region."],
        ["Sections (Flavors, Italian cooking, Animals…)", "Each entry in a single field. Cross-cutting topics become journeys; «animal» is a nature."],
        ["Imitations and names that erase the origin", "Each name lives in its entry with one of five forms of erasure."],
        ["Looting and biopiracy", "They are cases: they happened to a contribution and cite it, but they are not contributions."],
        ["What is not Mexican («Not Mexican», «Debated»)", "They are clarifications: published with the same yardstick and not counted."]
      ]);
      setTimeout(() => { if (ancla) { const el = document.getElementById(ancla); if (el) el.scrollIntoView(); } }, 0);
      return `<div class="wrap map-page"><p class="eyebrow">${L("Método", "Method")}</p><h1>${L("Cómo se clasifica y se verifica", "How it is classified and verified")}</h1>
        <div class="postura" style="margin:22px 0 0;border-radius:12px"><div style="padding:0 22px"><p class="eyebrow">${L("Postura", "Our stance")}</p><h2>${esc(C.postura.titulo)}</h2><p>${esc(C.postura.texto)}</p></div></div>
        <p class="lede">${L(`${C.principios.length} principios sostienen todo el sistema. De ellos salen los ejes, las líneas de evidencia y las reglas que el verificador aplica antes de cada publicación.`, `${C.principios.length} principles hold up the whole system. From them come the axes, the lines of evidence and the rules the checker applies before each publication.`)}</p>
        <h2 class="sub" style="margin-top:34px">${L("Principios", "Principles")}</h2>
        <div class="principles">${C.principios.map((p) => `<div class="principle"><h3>${esc(p.nombre)}</h3><p>${esc(p.texto)}</p></div>`).join("")}</div>
        <h2 class="sub">${L("Ejes: una pregunta cada uno", "Axes: one question each")}</h2>
        <div class="defs">${ejes.map(([n, q, vals]) => `<div class="def"><h3>${esc(n)}</h3><p class="q">${esc(q)}</p><dl>${vals.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl></div>`).join("")}</div>
        <h2 class="sub" id="lineas">${L("Las cinco líneas de evidencia", "The five lines of evidence")}</h2>
        <p class="muted" style="margin-bottom:12px">${esc(C.regla_tradicion)}</p>
        <div class="defs">${LINEAS.map((l) => `<div class="def"><h3>${l.n}. ${esc(l.nombre)}</h3><p style="margin-top:6px">${esc(l.texto)}</p><p class="small" style="margin-top:8px;color:${l.sostiene_tradicion ? "var(--ok)" : "var(--muted)"};font-weight:700">${l.sostiene_tradicion ? L("Sostiene «tradición»", "Supports «tradition»") : L("Solo prueba presencia", "Proves presence only")}</p></div>`).join("")}</div>
        <h2 class="sub">${L("Formas de borrado del nombre", "Ways a name erases origin")}</h2>
        <div class="defs">${C.borrado.map((b) => `<div class="def"><h3><a href="#/nombres/${b.id}">${esc(b.nombre)}</a></h3><p class="q">${esc(b.pregunta)}</p></div>`).join("")}</div>
        <h2 class="sub">${L("Del inventario a este sistema", "From the inventory to this system")}</h2>
        <p class="muted" style="margin-bottom:10px">${L("Cómo se tradujo cada etiqueta del inventario original.", "How each label of the original inventory was translated.")}</p>
        <div class="src-table-wrap"><table class="trad"><thead><tr><th>${L("En el inventario", "In the inventory")}</th><th>${L("Aquí", "Here")}</th></tr></thead><tbody>${traduccion.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
        <h2 class="sub">${L("Qué revisa el verificador", "What the checker reviews")}</h2>
        <ul class="pendientes">${L([
          "Que cada valor exista en el catálogo y que cada ficha tenga un solo ámbito.",
          "Que un aporte tenga al menos un acto; que «nativo» solo se diga de seres vivos y «domesticado», no de saberes, obras o lenguas.",
          "Que cada afirmación tenga solidez y que sus fuentes existan; que ninguna fuente quede sin citar.",
          "Que la palabra «tradición» de un expediente se apoye en las líneas 3, 4 o 5.",
          "Que «nativo» coincida con la distribución del WCVP para la especie.",
          "Que las coordenadas caigan en su territorio y las referencias entre fichas, casos, recorridos, pueblos y diagramas existan.",
          "Que cada aporte tenga su nombre en lengua originaria, con fuente, o explique por qué no lo tiene; que cada ficha tenga su explicación «en pocas palabras» y su alcance.",
          "Que cada imagen tenga licencia libre (dominio público, CC0, CC BY, CC BY-SA o GFDL) y se muestre con su autor.",
          "Que cada diagrama cite las fuentes de las afirmaciones que resume.",
          "Que cada texto tenga su traducción al inglés; lo que falta se muestra en español.",
          "En línea: cada DOI en Crossref (título y año) y cada enlace por HTTP."
        ], [
          "That every value exists in the catalog and that each entry has a single field.",
          "That a contribution has at least one act; that «native» is said only of living beings and «domesticated» not of knowledge, works or languages.",
          "That every claim has a strength and that its sources exist; that no source goes uncited.",
          "That a dossier's use of the word «tradition» rests on lines 3, 4 or 5.",
          "That «native» matches the WCVP distribution for the species.",
          "That coordinates fall within their territory and that references between entries, cases, journeys, peoples and diagrams exist.",
          "That each contribution has its name in an Indigenous language, with a source, or explains why it does not; that each entry has its «in brief» explanation and its reach.",
          "That every image has a free license (public domain, CC0, CC BY, CC BY-SA or GFDL) and is shown with its author.",
          "That every diagram cites the sources of the claims it summarizes.",
          "That every text has its English translation; anything missing is shown in Spanish.",
          "Online: each DOI in Crossref (title and year) and each link over HTTP."
        ]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h2 class="sub" id="erratas">${L("Fe de erratas", "Errata")} <span class="n">${D.erratas.length}</span></h2>
        ${erratas(D.erratas)}
      </div>`;
    }

    const botonCompartir = () => `<button class="btn share" type="button" data-share><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>${L("Compartir", "Share")}</button>`;
    function aviso(texto) {
      let t = document.getElementById("aviso");
      if (!t) { t = document.createElement("div"); t.id = "aviso"; t.className = "aviso"; t.setAttribute("role", "status"); document.body.appendChild(t); }
      t.textContent = texto; t.hidden = false;
      clearTimeout(aviso.t); aviso.t = setTimeout(() => (t.hidden = true), 2200);
    }
    function compartir() {
      const datos = { title: document.title, url: location.href };
      if (navigator.share) { navigator.share(datos).catch(() => {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(() => aviso(L("Enlace copiado", "Link copied")), () => aviso(location.href));
    }

    function noEncontrado() {
      return `<div class="wrap map-page"><h1>${L("No existe esa página", "That page does not exist")}</h1><p class="lede">${L('Puede que la ficha haya cambiado de nombre. <a href="#/explorar">Ver todas las fichas</a>.', 'The entry may have been renamed. <a href="#/explorar">See all entries</a>.')}</p></div>`;
    }

    // ------------------------------------------------------------ enrutador
    function ruta() {
      const h = location.hash.replace(/^#\/?/, "").replace(/#.*$/, "");
      const [camino, consulta] = h.split("?");
      const partes = camino.split("/").filter(Boolean);
      const filtros = Object.fromEntries(new URLSearchParams(consulta || ""));
      return { partes, filtros };
    }
    function pintar() {
      const { partes, filtros } = ruta();
      const [p0, p1] = partes;
      const vistas = {
        "": () => vistaPortada(),
        explorar: () => vistaExplorar(filtros),
        ficha: () => vistaFicha(p1),
        mapa: () => vistaMapa(filtros),
        tiempo: () => vistaTiempo(),
        nombres: () => vistaNombres(p1),
        casos: () => vistaCasos(),
        despojo: () => vistaDespojo(),
        cuenta: () => vistaCuenta(),
        pueblos: () => vistaPueblos(),
        pueblo: () => vistaPueblo(p1),
        caso: () => vistaCaso(p1),
        recorridos: () => vistaRecorridos(),
        recorrido: () => vistaRecorrido(p1),
        fuentes: () => vistaFuentes(filtros),
        metodo: () => vistaMetodo(p1)
      };
      const v = vistas[p0 || ""] || noEncontrado;
      $main.innerHTML = v();
      if (p0 === "ficha") prepararFicha();
      if (p0 === "cuenta") prepararCuenta();
      ocultarTip();
      const seccion = { ficha: "explorar", caso: "despojo", casos: "despojo", recorrido: "recorridos", pueblo: "pueblos" }[p0] || p0;
      document.querySelectorAll("nav.main a").forEach((a) => {
        if (a.getAttribute("href") === `#/${seccion}`) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      const titulo = $main.querySelector("h1");
      document.title = p0 && titulo ? `${titulo.textContent} · Procedencia` : "Procedencia";
      const q = document.getElementById("q");
      if (p0 !== "explorar" && document.activeElement !== q) q.value = "";
      const ancla = location.hash.split("#")[2];
      if (ancla) setTimeout(() => { const el = document.getElementById(ancla); if (el) { abrir(el); el.scrollIntoView({ behavior: "instant" }); } }, 0);
      else if (!(p0 === "explorar" && document.activeElement === q) && !(p0 === "metodo" && p1)) window.scrollTo({ top: 0, behavior: "instant" });
    }
    window.addEventListener("hashchange", pintar);

    // ------------------------------------------------------------ interacción
    function ocultarTip() { $tip.hidden = true; }
    const ANCHO = matchMedia("(min-width: 821px)");
    // Abre las secciones plegadas que contienen un elemento antes de llevar la vista a él.
    function abrir(el) {
      for (let d = el.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
    }
    let vigia;
    function prepararFicha() {
      // En el teléfono, como en una enciclopedia móvil: abiertas la primera sección y las pruebas; las demás, plegadas.
      if (!ANCHO.matches) document.querySelectorAll(".enc-sec").forEach((d, i) => { if (i && d.id !== "pruebas") d.open = false; });
      if (!ANCHO.matches) document.querySelector(".enc-enlinea .enc-toc").open = false;
      if (vigia) vigia.disconnect();
      const enlaces = Object.fromEntries([...document.querySelectorAll(".enc-nav a[data-sec]")].map((a) => [a.dataset.sec, a]));
      vigia = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          Object.values(enlaces).forEach((a) => a.removeAttribute("aria-current"));
          if (enlaces[e.target.id]) enlaces[e.target.id].setAttribute("aria-current", "true");
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      document.querySelectorAll(".enc-sec").forEach((s) => vigia.observe(s));
    }
    // La narrativa: el camino de huellas se entinta al avanzar y la tira marca el acto que se lee.
    let vigiaActos;
    function prepararCuenta() {
      if (vigiaActos) vigiaActos.disconnect();
      const enlaces = Object.fromEntries([...document.querySelectorAll(".cn-tira a")].map((a) => [a.dataset.acto, a]));
      const tira = document.querySelector(".cn-tira ol");
      vigiaActos = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("visto");
          const a = enlaces[e.target.id];
          if (!a) return;
          Object.values(enlaces).forEach((x) => x.removeAttribute("aria-current"));
          a.setAttribute("aria-current", "step");
          tira.scrollTo({ left: a.parentElement.offsetLeft - 16, behavior: "smooth" });
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      document.querySelectorAll(".cn-acto").forEach((s) => vigiaActos.observe(s));
      pegarTira();
      avanceCamino();
    }
    // La tira se pega justo debajo de la cabecera, que cambia de alto según el ancho.
    function pegarTira() {
      const t = document.querySelector(".cn-tira"), cab = document.querySelector("header.top");
      if (t && cab) t.style.top = cab.offsetHeight + "px";
    }
    window.addEventListener("resize", pegarTira);
    function avanceCamino() {
      const camino = document.querySelector(".cn-camino");
      if (!camino) return;
      const r = camino.getBoundingClientRect();
      camino.style.setProperty("--avance", Math.min(1, Math.max(0, (innerHeight * 0.55 - r.top) / r.height)).toFixed(4));
    }
    let pendienteAvance = false;
    window.addEventListener("scroll", () => {
      if (pendienteAvance) return;
      pendienteAvance = true;
      requestAnimationFrame(() => { pendienteAvance = false; avanceCamino(); });
    }, { passive: true });
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el) return ocultarTip();
      $tip.innerHTML = el.getAttribute("data-tip");
      $tip.hidden = false;
    });
    document.addEventListener("mousemove", (e) => {
      if ($tip.hidden) return;
      const w = $tip.offsetWidth, h = $tip.offsetHeight;
      let x = e.clientX + 14, y = e.clientY + 16;
      if (x + w > innerWidth - 8) x = e.clientX - w - 14;
      if (y + h > innerHeight - 8) y = e.clientY - h - 12;
      $tip.style.position = "fixed";
      $tip.style.left = Math.max(8, x) + "px";
      $tip.style.top = Math.max(8, y) + "px";
    });
    document.addEventListener("click", (e) => {
      const ev = e.target.closest(".ev[data-ev]");
      if (ev) { ocultarTip(); abrirEvidencia(ev); return; }
      if (e.target.closest(".evid-x")) { cerrarEvidencia(); return; }
      const lam = e.target.closest("[data-lamina]");
      if (lam) { abrirVisor(lam.dataset.lamina); return; }
      const visor = e.target.closest("dialog.visor");
      if (visor && (e.target === visor || e.target.closest(".visor-x"))) { visor.close(); return; }
      const nodo = e.target.closest("[data-nodo]");
      if (nodo) { elegirNodo(nodo); return; }
      const paso = e.target.closest(".cn-tira a");
      if (paso) {
        e.preventDefault();
        const destino = document.getElementById(paso.dataset.acto);
        history.replaceState(null, "", paso.getAttribute("href"));
        destino.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        return;
      }
      const cita = e.target.closest("[data-fn]");
      if (cita) {
        const li = document.getElementById("fn-" + cita.dataset.fn);
        if (li) { abrir(li); li.scrollIntoView({ block: "center" }); li.style.background = "var(--highlight)"; setTimeout(() => (li.style.background = ""), 1600); }
        return;
      }
      if (e.target.closest("[data-share]")) { compartir(); return; }
      // En pantalla ancha las secciones de la ficha no se pliegan: se lee como un artículo.
      if (e.target.closest(".enc-sec > summary, .enc-nav summary") && ANCHO.matches) { e.preventDefault(); return; }
      const nav = e.target.closest("[data-href]");
      if (nav) { location.hash = nav.dataset.href; return; }
      if (e.target.closest("[data-toggle-facets]")) {
        const f = document.querySelector(".facets");
        f.dataset.open = f.dataset.open === "true" ? "false" : "true";
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-href]")) { e.preventDefault(); location.hash = e.target.dataset.href; }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".ev[data-ev]")) { e.preventDefault(); abrirEvidencia(e.target); }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-nodo]")) { e.preventDefault(); elegirNodo(e.target); }
      if (e.key === "Escape") cerrarEvidencia();
    });
    const $q = document.getElementById("q");
    $q.addEventListener("input", () => {
      const { partes, filtros } = ruta();
      const base = partes[0] === "explorar" ? filtros : {};
      history.replaceState(null, "", hashExplorar({ ...base, q: $q.value.trim() }));
      pintar();
    });

    // Tema: el sistema por defecto; el botón alterna y se recuerda si el navegador lo permite.
    const raiz = document.documentElement;
    try { const t = localStorage.getItem("procedencia-tema"); if (t) raiz.dataset.theme = t; } catch (_) {}
    document.getElementById("theme").addEventListener("click", () => {
      const oscuro = raiz.dataset.theme ? raiz.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      raiz.dataset.theme = oscuro ? "light" : "dark";
      try { localStorage.setItem("procedencia-tema", raiz.dataset.theme); } catch (_) {}
    });

    // Cabecera y pie: index.html trae el español; data-en lleva el inglés.
    document.documentElement.lang = LANG;
    if (LANG === "en") {
      document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = el.dataset.en));
      document.querySelectorAll("[data-en-aria]").forEach((el) => el.setAttribute("aria-label", el.dataset.enAria));
      document.querySelectorAll("[data-en-placeholder]").forEach((el) => (el.placeholder = el.dataset.enPlaceholder));
    }
    const $lang = document.getElementById("lang");
    const otro = LANG === "en" ? "es" : "en";
    $lang.textContent = otro.toUpperCase();
    $lang.lang = otro;
    $lang.setAttribute("aria-label", L("Read in English", "Leer en español"));
    $lang.title = $lang.getAttribute("aria-label");
    $lang.addEventListener("click", () => {
      try { localStorage.setItem("procedencia-idioma", otro); } catch (_) {}
      const u = new URL(location.href);
      u.searchParams.set("lang", otro);
      location.href = u.toString();
    });

    document.getElementById("pie-datos").textContent = L(
      `Datos generados el ${D.metricas.fecha} · ${D.metricas.fichas} fichas · ${D.metricas.fuentes} fuentes · ${D.metricas.pueblos} pueblos · ${D.metricas.especies_wcvp} especies contrastadas con el WCVP.`,
      `Data generated on ${D.metricas.fecha} · ${D.metricas.fichas} entries · ${D.metricas.fuentes} sources · ${D.metricas.pueblos} peoples · ${D.metricas.especies_wcvp} species checked against the WCVP.`);
    pintar();
  }
})();
