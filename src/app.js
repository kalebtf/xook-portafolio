(() => {
"use strict";
/* ============ Configuración ============
   AI_URL: dirección del servidor de IA (Cloudflare Worker, ver /servidor-ia). Vacío = respuestas de muestra.
   WHATSAPP: número con lada de país, solo dígitos (ej. "529991234567"). Vacío = se oculta el botón. */
const CONFIG = { AI_URL: "", WHATSAPP: "", EMAIL: "kalebtf@gmail.com" };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); flash(btn, "Copiado"); }
  catch { flash(btn, "Selecciona y copia"); }
}
function flash(btn, msg) { if (!btn) return; const t = btn.textContent; btn.textContent = msg; setTimeout(() => btn.textContent = t, 1600); }
function say(el, text, kind) { el.textContent = text; el.className = "note" + (kind ? " " + kind : ""); }
// Dentro de Claude (artifact) las descargas piden permiso al visitante; en un sitio normal, descarga directa.
let dlCap = null;
if (window.claude) window.claude.use("downloads").then(d => { dlCap = d; }).catch(() => {});
async function saveFile(name, data, type) {
  if (dlCap) {
    try { await dlCap.save({ filename: name, data: new Blob([data], { type }) }); return; }
    catch (e) { if (e && e.code === "declined") throw new Error("Descarga cancelada."); }
  }
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const downloadText = (name, text, type) => saveFile(name, text, type).catch(() => {});

/* ============ Excel (SheetJS, se carga solo cuando se necesita) ============ */
let xlsxPromise = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  const add = src => new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = () => window.XLSX ? ok(window.XLSX) : fail(); s.onerror = fail; document.head.append(s); });
  xlsxPromise = add("vendor/xlsx.full.min.js").catch(() => add("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"))
    .catch(() => { xlsxPromise = null; throw new Error("No se pudo cargar el lector de Excel. Revisa tu conexión."); });
  return xlsxPromise;
}
// Fechas como número de serie de Excel (evita el desfase de zona horaria de la librería)
const xlDate = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5;
async function downloadXLSX(name, sheetName, rows, widths, dateCols = []) {
  const X = await loadXLSX();
  const ws = X.utils.json_to_sheet(rows);
  if (widths) ws["!cols"] = widths.map(w => ({ wch: w }));
  if (rows.length) {
    const heads = Object.keys(rows[0]);
    dateCols.forEach(h => { const c = heads.indexOf(h); if (c < 0) return; for (let r = 1; r <= rows.length; r++) { const cell = ws[X.utils.encode_cell({ r, c })]; if (cell) cell.z = "dd/mm/yyyy"; } });
  }
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheetName);
  await saveFile(name, X.write(wb, { type: "array", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* ============ IA: servidor propio, cuenta de Claude del visitante, o respuestas de muestra ============ */
let aiMode = "none", sample = null;
const status = $("#ai-status");
function setAIStatus() {
  const live = aiMode !== "none";
  status.textContent = live ? "IA en vivo" : "Respuestas de muestra";
  $("#ai-explain").textContent = live
    ? "Las respuestas de reseñas, manuales, fichas y cobranza se escriben en el momento con IA. Lo demás (leer CFDI y Excel, cartera, citas) funciona aquí mismo."
    : "En esta página, los textos de IA son respuestas de muestra escritas para cada caso. Con tu negocio, la IA los escribe en el momento con tus datos. Lo demás (leer CFDI y Excel, cartera, citas, calendario) funciona de verdad aquí mismo.";
  $("#cb-ai").hidden = !live;
}
setAIStatus();
(async () => {
  if (CONFIG.AI_URL) {
    try { const r = await fetch(CONFIG.AI_URL.replace(/\/$/, "") + "/salud", { method: "GET" }); if (r.ok) aiMode = "server"; } catch {}
  }
  if (aiMode === "none") {
    try { sample = window.claude ? await window.claude.use("sample") : null; if (sample) aiMode = "claude"; } catch { sample = null; }
  }
  setAIStatus();
})();
async function runAI(task, data, prompt, json) {
  if (aiMode === "server") {
    const r = await fetch(CONFIG.AI_URL.replace(/\/$/, "") + "/ia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, data }) });
    if (!r.ok) throw new Error("servidor " + r.status);
    const j = await r.json(); return json ? j.json : j.text;
  }
  if (aiMode === "claude") {
    if (json) return await sample.json(prompt, { modelTier: "quick" });
    const { text } = await sample(prompt, { modelTier: "quick" }); return text;
  }
  throw new Error("sin IA");
}
const badge = live => `<span class="ai-badge">${live ? "IA en vivo" : "muestra"}</span>`;
async function askAI(task, data, prompt, outEl, srcEl, fallback) {
  outEl.classList.add("filled");
  if (aiMode === "none") { outEl.textContent = fallback; srcEl.innerHTML = badge(false); return; }
  outEl.textContent = "Escribiendo…";
  try { const t = await runAI(task, data, prompt, false); if (!t || !String(t).trim()) throw 0; outEl.textContent = String(t).trim(); srcEl.innerHTML = badge(true); }
  catch { outEl.textContent = fallback; srcEl.innerHTML = badge(false); }
}

/* ============ Pestañas ============ */
const DEMOS = ["resenas", "cfdi", "cobranza", "manuales", "inmuebles", "agenda"];
function showDemo(name, scroll) {
  if (!DEMOS.includes(name)) return;
  $$(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.demo === name)));
  $$(".demo").forEach(d => d.hidden = d.id !== "demo-" + name);
  if (scroll) $("#demos").scrollIntoView({ behavior: "smooth", block: "start" });
}
$$(".tab").forEach(t => t.addEventListener("click", () => { showDemo(t.dataset.demo); try { history.replaceState(null, "", "#" + t.dataset.demo); } catch {} }));
$(".tabs").addEventListener("keydown", e => {
  if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
  const tabs = $$(".tab"); const i = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
  const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
});
function fromHash() { const h = location.hash.slice(1); if (DEMOS.includes(h)) showDemo(h, true); }
window.addEventListener("hashchange", fromHash); fromHash();

$$("[data-go]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); showDemo(a.dataset.go, true); try { history.replaceState(null, "", "#" + a.dataset.go); } catch {} }));

/* ============ 1. Reseñas ============ */
const TONES = { calido: "cálido y cercano", profesional: "profesional y formal (usted)", breve: "muy breve, máximo 30 palabras" };
const BIZ = {
  rest: { name: "Cocina Doña Elvira (ejemplo)", img: "img/restaurante.jpg", domain: "donaelvira.example",
    ctx: `"Cocina Doña Elvira", restaurante de comida yucateca en la Calle 60, Centro de Mérida (horario 8:00-23:00, tiene patio, menú en inglés recién hecho, estacionamiento público en la calle 57, el turno de cocina de fin de semana se reforzó y el mesero ahora avisa el tiempo estimado)`,
    reviews: [
      { name: "Jennifer M.", stars: 5, lang: "en", when: "hace 2 días", text: "Amazing cochinita pibil and the best horchata we had in Mérida! The courtyard is beautiful. Only wish they had an English menu.",
        reply: {
          calido: "Thank you so much, Jennifer! We're thrilled you enjoyed our cochinita pibil and horchata in the courtyard. Great news: our English menu is now ready, just ask your server or scan the QR at your table. We hope to welcome you back on your next visit to Mérida! — Elvira and the team",
          profesional: "Dear Jennifer, thank you for your kind review. We are delighted you enjoyed our cochinita pibil, horchata and courtyard. We are pleased to share that our English menu is now available; simply ask your server or scan the QR code at your table. We look forward to welcoming you again. — Cocina Doña Elvira",
          breve: "Thank you, Jennifer! So glad you loved the cochinita and horchata. Our English menu is ready now. See you next time! — Elvira & team" } },
      { name: "Luis Canché", stars: 2, lang: "es", when: "hace 5 días", text: "La comida rica pero esperamos 45 minutos por los panuchos un sábado. Nadie nos avisó que iba a tardar.",
        reply: {
          calido: "Luis, gracias por decírnoslo y una disculpa por la espera del sábado. Tienes razón: debimos avisarte desde el inicio. Ya reforzamos el turno de cocina de fin de semana y ahora el mesero informa el tiempo estimado al tomar la orden. Nos encantaría que nos des otra oportunidad; pregunta por Elvira. — Cocina Doña Elvira",
          profesional: "Estimado Luis: gracias por su comentario y lamentamos la espera del sábado. Debimos informarle el tiempo desde el inicio. Ya reforzamos el turno de cocina de fin de semana y el mesero ahora indica el tiempo estimado al tomar la orden. Será un gusto atenderle de nuevo. — Cocina Doña Elvira",
          breve: "Luis, una disculpa por la espera del sábado. Ya reforzamos la cocina en fin de semana y te avisamos el tiempo al ordenar. ¡Esperamos verte pronto! — Doña Elvira" } },
      { name: "Ana Sofía R.", stars: 4, lang: "es", when: "hace 1 semana", text: "Muy buen sazón yucateco y precios justos. El estacionamiento es complicado en la calle 60.",
        reply: {
          calido: "¡Gracias, Ana Sofía! Nos alegra que disfrutaras el sazón de casa. Sobre el estacionamiento: a media cuadra, en la calle 57, hay un estacionamiento público abierto hasta las 11 p. m. Lo agregamos a nuestra página para que sea más fácil llegar. ¡Te esperamos pronto! — Cocina Doña Elvira",
          profesional: "Estimada Ana Sofía: muchas gracias por su reseña. Sobre el estacionamiento, a media cuadra, en la calle 57, hay un estacionamiento público abierto hasta las 11 p. m.; ya lo indicamos en nuestra página. Será un gusto recibirle de nuevo. — Cocina Doña Elvira",
          breve: "¡Gracias, Ana Sofía! Tip: hay estacionamiento público en la calle 57, a media cuadra. ¡Te esperamos! — Doña Elvira" } }
    ],
    site: {
      es: { tag: "Cocina yucateca de casa desde 1998", h: "Cocina Doña Elvira", cta: "Reservar por WhatsApp", a: ["Horario", "Lun a dom, 8:00 a 23:00"], b: ["Dirección", "Calle 60, Centro"], c: ["Especialidad", "Cochinita pibil y panuchos"], d: ["Cómo llegar", "Estacionamiento en calle 57"] },
      en: { tag: "Homestyle Yucatecan food since 1998", h: "Cocina Doña Elvira", cta: "Book on WhatsApp", a: ["Hours", "Mon–Sun, 8 am – 11 pm"], b: ["Address", "Calle 60, Downtown"], c: ["Signature dish", "Cochinita pibil & panuchos"], d: ["Getting here", "Parking on Calle 57"] } } },
  hotel: { name: "Casa Ejemplo Hotel Boutique", img: "img/hotel.jpg", domain: "casaejemplo.example",
    ctx: `"Casa Ejemplo Hotel Boutique", hotel en una casona de 1890 en la Calle 55, a una cuadra del parque de Santa Lucía, Centro de Mérida (check-in 15:00, guarda maletas desde las 10:00, ingreso anticipado si avisan por WhatsApp, desayuno incluido, alberca pequeña, el aire acondicionado de las habitaciones se revisó esta semana, reserva directa por WhatsApp y precios aproximados en USD en la web)`,
    reviews: [
      { name: "Thomas & Claire", stars: 5, lang: "en", when: "hace 3 días", text: "Gorgeous colonial house, the plunge pool was perfect after a hot day exploring. Breakfast was amazing. Only issue: our room's AC was a bit noisy at night.",
        reply: {
          calido: "Thank you, Thomas and Claire! We're so happy the plunge pool and breakfast made your days in Mérida even better. You're right about the AC: our maintenance team serviced the units this week. We'd love to welcome you back! — The Casa Ejemplo team",
          profesional: "Dear Thomas and Claire, thank you for your wonderful review. We are delighted you enjoyed the plunge pool and our breakfast. Regarding the air conditioning, our maintenance team serviced the units this week. We look forward to hosting you again. — Casa Ejemplo Hotel Boutique",
          breve: "Thank you, Thomas and Claire! Glad you loved the pool and breakfast. The AC has been serviced. Hope to see you again! — Casa Ejemplo" } },
      { name: "Daniela G.", stars: 3, lang: "es", when: "hace 6 días", text: "La casa es preciosa, pero el check-in era a las 15:00, llegamos a las 13:00 y no nos ofrecieron guardar las maletas. El personal, muy amable.",
        reply: {
          calido: "Daniela, gracias por tu reseña y una disculpa: debimos ofrecerte guardar tus maletas desde que llegaste. Ahora lo hacemos siempre desde las 10:00 y, si nos escribes por WhatsApp antes de llegar, intentamos darte el cuarto antes. ¡Nos encantará recibirte otra vez! — Equipo Casa Ejemplo",
          profesional: "Estimada Daniela: gracias por su comentario y lamentamos lo ocurrido a su llegada. Debimos ofrecerle resguardo de equipaje. Ahora lo ofrecemos siempre desde las 10:00 y, si nos avisa por WhatsApp, procuramos el ingreso anticipado. Será un gusto recibirle nuevamente. — Casa Ejemplo Hotel Boutique",
          breve: "Daniela, una disculpa. Ya guardamos maletas desde las 10:00 y, si nos avisas, te damos el cuarto antes. ¡Te esperamos! — Casa Ejemplo" } },
      { name: "Marc L.", stars: 4, lang: "en", when: "hace 2 semanas", text: "Great location near Santa Lucía park, very quiet rooms. Wish the website showed prices in USD and that booking direct was easier. We ended up booking through an app.",
        reply: {
          calido: "Thanks so much, Marc! We're glad you enjoyed the quiet rooms and being steps from Santa Lucía park. Great point: you can now book directly with us on WhatsApp, and our website shows approximate prices in USD. See you on your next trip to Mérida! — The Casa Ejemplo team",
          profesional: "Dear Marc, thank you for your review. We are pleased you enjoyed the location near Santa Lucía park and the quiet rooms. You can now book directly with us via WhatsApp, and our website displays approximate prices in USD. We look forward to your next visit. — Casa Ejemplo Hotel Boutique",
          breve: "Thanks, Marc! Direct booking on WhatsApp and USD prices are now on our site. See you next time! — Casa Ejemplo" } }
    ],
    site: {
      es: { tag: "Hotel boutique en una casona de 1890", h: "Casa Ejemplo", cta: "Reservar por WhatsApp", a: ["Check-in", "15:00 · maletas desde 10:00"], b: ["Dirección", "Calle 55, a una cuadra de Santa Lucía"], c: ["Incluye", "Desayuno y alberca"], d: ["Tarifas", "Desde $2,400 MXN por noche"] },
      en: { tag: "Boutique hotel in an 1890 mansion", h: "Casa Ejemplo", cta: "Book on WhatsApp", a: ["Check-in", "3 pm · luggage from 10 am"], b: ["Address", "Calle 55, one block from Santa Lucía park"], c: ["Includes", "Breakfast & plunge pool"], d: ["Rates", "From $2,400 MXN (≈ US$130) / night"] } } }
};
let rvBiz = "rest", rvSel = 0, siteLang = "es";
function renderReviews() {
  const B = BIZ[rvBiz];
  $("#rv-title").textContent = "1 · Reseñas recientes de " + B.name;
  $("#reviews").innerHTML = B.reviews.map((r, i) => `<button class="review" aria-pressed="${i === rvSel}" data-i="${i}"><span class="row" style="justify-content:space-between"><b>${esc(r.name)}</b><span class="stars" aria-label="${r.stars} de 5 estrellas">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span></span><span>${esc(r.text)}</span><span class="meta">Google · ${r.when} · ${r.lang === "en" ? "en inglés" : "en español"}</span></button>`).join("");
  $$("#reviews .review").forEach(b => b.addEventListener("click", () => { rvSel = +b.dataset.i; renderReviews(); }));
}
function setBiz(k) {
  rvBiz = k; rvSel = 0;
  $("#rv-biz-rest").setAttribute("aria-pressed", String(k === "rest")); $("#rv-biz-hotel").setAttribute("aria-pressed", String(k === "hotel"));
  const ph = $("#rv-photo"); ph.classList.remove("missing"); ph.src = BIZ[k].img;
  $("#rv-out").textContent = "Elige una reseña y pulsa “Redactar respuesta”."; $("#rv-out").classList.remove("filled"); $("#rv-src").innerHTML = "";
  renderReviews(); renderSite(siteLang);
}
$("#rv-biz-rest").addEventListener("click", () => setBiz("rest")); $("#rv-biz-hotel").addEventListener("click", () => setBiz("hotel"));
$("#rv-go").addEventListener("click", async e => {
  const btn = e.currentTarget; const B = BIZ[rvBiz]; const r = B.reviews[rvSel]; const tone = $("#rv-tone").value; btn.disabled = true;
  const data = { biz: rvBiz, review: r.text, stars: r.stars, name: r.name, lang: r.lang, tone };
  const prompt = `Eres el dueño de ${B.ctx}. Responde esta reseña de Google en el MISMO idioma de la reseña (${r.lang === "en" ? "inglés" : "español"}), tono ${TONES[tone]}, máximo 70 palabras. Agradece; si hay queja, reconócela sin excusas y di qué se hizo; invita a volver; firma como el equipo. No inventes descuentos ni datos que no estén aquí. Solo el texto de la respuesta.\n\nReseña (${r.stars} estrellas) de ${r.name}: "${r.text}"`;
  await askAI("resena", data, prompt, $("#rv-out"), $("#rv-src"), r.reply[tone]);
  btn.disabled = false;
});
$("#rv-copy").addEventListener("click", e => copyText($("#rv-out").textContent, e.currentTarget));
function renderSite(l) {
  siteLang = l; const B = BIZ[rvBiz]; const s = B.site[l];
  $("#minisite").innerHTML = `<div class="bar"><i></i><i></i><i></i><span>${B.domain}/${l}</span></div><div class="hero2" style="--site-img:url('${B.img}')"><span class="mono" style="font-size:.72rem;opacity:.9">${s.tag}</span><h3>${s.h}</h3><span class="chip" style="justify-self:start;background:var(--accent);color:var(--accent-ink)">${s.cta}</span></div><div class="info">${[s.a, s.b, s.c, s.d].map(x => `<div><b>${x[0]}</b>${x[1]}</div>`).join("")}</div>`;
  $("#ms-es").setAttribute("aria-pressed", String(l === "es")); $("#ms-en").setAttribute("aria-pressed", String(l === "en"));
}
$("#ms-es").addEventListener("click", () => renderSite("es")); $("#ms-en").addEventListener("click", () => renderSite("en"));
renderReviews(); renderSite("es");

/* ============ 2. CFDI ============ */
const CF_SAMPLES = {
  "Gasolina": `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="GAS" Folio="88231" Fecha="2026-10-28T09:14:02" FormaPago="04" SubTotal="1034.48" Moneda="MXN" Total="1200.00" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" LugarExpedicion="97000">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="ESCUELA KEMPER URGATE" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CACX7605101P8" Nombre="XOCHILT CASAS CHAVEZ" DomicilioFiscalReceptor="97000" RegimenFiscalReceptor="612" UsoCFDI="G03"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="15101514" Cantidad="48.2" ClaveUnidad="LTR" Descripcion="Gasolina Magna" ValorUnitario="21.46" Importe="1034.48" ObjetoImp="02"/></cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="6F1C2A10-3B7D-4E21-9C55-1A2B3C4D5E61" FechaTimbrado="2026-10-28T09:14:40"/></cfdi:Complemento>
</cfdi:Comprobante>`,
  "Laptop a crédito": `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="1311" Fecha="2026-10-30T16:40:00" FormaPago="99" SubTotal="15500.00" Moneda="MXN" Total="17980.00" TipoDeComprobante="I" Exportacion="01" MetodoPago="PPD" LugarExpedicion="97130">
  <cfdi:Emisor Rfc="XIA190128J61" Nombre="XENON INDUSTRIAL ARTICLES" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CACX7605101P8" Nombre="XOCHILT CASAS CHAVEZ" DomicilioFiscalReceptor="97000" RegimenFiscalReceptor="612" UsoCFDI="I04"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="43211503" Cantidad="1" ClaveUnidad="H87" Descripcion="Computadora portátil 14 pulgadas" ValorUnitario="15500.00" Importe="15500.00" ObjetoImp="02"/></cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="0A9B8C7D-6E5F-4A3B-8C2D-1E0F9A8B7C6D" FechaTimbrado="2026-10-30T16:41:12"/></cfdi:Complemento>
</cfdi:Comprobante>`,
  "Comida de otro RFC": `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="R" Folio="5521" Fecha="2026-11-01T14:05:00" FormaPago="04" SubTotal="862.07" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" LugarExpedicion="97000">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="ESCUELA KEMPER URGATE" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" DomicilioFiscalReceptor="97000" RegimenFiscalReceptor="616" UsoCFDI="S01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="90101501" Cantidad="1" ClaveUnidad="E48" Descripcion="Consumo de alimentos" ValorUnitario="862.07" Importe="862.07" ObjetoImp="02"/></cfdi:Conceptos>
</cfdi:Comprobante>`
};
const CATS = [["151015", "Combustible"], ["4321", "Equipo de cómputo"], ["901015", "Alimentos y restaurantes"], ["8111", "Software y sistemas"], ["7810", "Fletes y transporte"], ["7811", "Fletes y transporte"], ["8012", "Servicios profesionales"], ["8011", "Servicios profesionales"], ["5310", "Papelería y oficina"], ["4412", "Papelería y oficina"], ["4410", "Papelería y oficina"], ["8311", "Teléfono e internet"], ["8310", "Luz, agua y gas"], ["8411", "Pagos y servicios financieros"]];
const REGIMEN = { "601": "General de Ley PM", "612": "Actividad empresarial", "626": "RESICO", "616": "Sin obligaciones", "605": "Sueldos y salarios", "606": "Arrendamiento" };
let cfRows = [], cfSel = "Gasolina";
function byLocal(doc, name) { return [...doc.getElementsByTagName("*")].filter(el => el.localName === name); }
function parseCFDI(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("no es un XML válido (archivo dañado o incompleto).");
  const c = byLocal(doc, "Comprobante")[0]; if (!c) throw new Error("no es una factura CFDI (falta el nodo Comprobante).");
  const em = byLocal(doc, "Emisor")[0], re = byLocal(doc, "Receptor")[0], tfd = byLocal(doc, "TimbreFiscalDigital")[0];
  const conceptos = byLocal(doc, "Concepto");
  const clave = conceptos[0]?.getAttribute("ClaveProdServ") || "";
  const tipo = c.getAttribute("TipoDeComprobante");
  const cat = tipo === "P" ? "Complemento de pago" : (CATS.find(([p]) => clave.startsWith(p)) || [, "Otros gastos"])[1];
  return {
    version: c.getAttribute("Version"), folio: [c.getAttribute("Serie"), c.getAttribute("Folio")].filter(Boolean).join("-") || "s/folio",
    fecha: (c.getAttribute("Fecha") || "").slice(0, 10), total: parseFloat(c.getAttribute("Total") || "0"),
    metodo: c.getAttribute("MetodoPago") || "", tipo,
    emisor: em?.getAttribute("Nombre") || em?.getAttribute("Rfc") || "¿?", emisorRfc: em?.getAttribute("Rfc") || "",
    receptorRfc: (re?.getAttribute("Rfc") || "").toUpperCase(), receptor: re?.getAttribute("Nombre") || "", regimen: re?.getAttribute("RegimenFiscalReceptor") || "", uso: re?.getAttribute("UsoCFDI") || "",
    uuid: (tfd?.getAttribute("UUID") || "").toUpperCase(), desc: conceptos[0]?.getAttribute("Descripcion") || "", cat,
    related: byLocal(doc, "DoctoRelacionado").map(d => (d.getAttribute("IdDocumento") || "").toUpperCase()).filter(Boolean)
  };
}
const cfClients = () => $("#cf-rfc").value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
function flagsFor(r) {
  const f = [], cl = cfClients();
  if (!r.uuid) f.push(["bad", "Sin timbre del SAT"]);
  if (cl.length && !cl.includes(r.receptorRfc)) f.push(["bad", "No es de tus clientes (" + r.receptorRfc + ")"]);
  if (r.uso === "S01") f.push(["warn", "Sin efectos fiscales"]);
  if (r.metodo === "PPD") {
    const paid = cfRows.find(x => x.tipo === "P" && x.related.includes(r.uuid));
    f.push(paid ? ["ok", "PPD: pago recibido (" + paid.folio + ")"] : ["warn", "PPD: pedir complemento de pago"]);
  }
  if (r.version !== "4.0") f.push(["warn", "Versión " + r.version + " (ya no vigente)"]);
  if (r.tipo === "E") f.push(["info", "Nota de crédito"]);
  if (r.tipo === "P") { const rel = cfRows.filter(x => r.related.includes(x.uuid)).map(x => x.folio); f.push(["info", rel.length ? "Paga la factura " + rel.join(", ") : "Pago de factura no cargada"]); }
  if (!f.some(([k]) => k === "bad" || k === "warn")) f.unshift(["ok", "Correcta"]);
  return f;
}
const needsReview = r => flagsFor(r).some(([k]) => k === "bad" || k === "warn");
const signedTotal = r => r.tipo === "E" ? -r.total : r.tipo === "P" ? 0 : r.total;
function cfVisible() {
  const v = $("#cf-filter").value, cl = cfClients();
  if (v === "*") return cfRows;
  if (v === "otros") return cfRows.filter(r => !cl.includes(r.receptorRfc));
  if (v === "revisar") return cfRows.filter(needsReview);
  return cfRows.filter(r => r.receptorRfc === v);
}
function renderFilter() {
  const sel = $("#cf-filter"), cur = sel.value || "*", cl = cfClients();
  const name = rfc => (cfRows.find(r => r.receptorRfc === rfc) || {}).receptor;
  sel.innerHTML = `<option value="*">Todas</option><option value="revisar">Solo por revisar</option>` + cl.map(r => `<option value="${esc(r)}">${esc(name(r) ? name(r) + " · " : "")}${esc(r)}</option>`).join("") + `<option value="otros">Fuera de mis clientes</option>`;
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : "*";
}
function renderCF() {
  renderFilter();
  const rows = cfVisible(), body = $("#cf-body");
  if (!rows.length) body.innerHTML = `<tr><td colspan="4" class="muted">${cfRows.length ? "No hay facturas con este filtro." : "Aún no hay facturas. Sube XML o el ZIP de prueba."}</td></tr>`;
  else body.innerHTML = rows.map(r => { const f = flagsFor(r); const reg = REGIMEN[r.regimen] ? " · " + REGIMEN[r.regimen] : ""; return `<tr><td><b>${esc(r.emisor)}</b><br><span class="note mono">${esc(r.folio)} · ${esc(r.fecha)}</span></td><td>${esc(r.receptor || r.receptorRfc)}<span class="note">${esc(reg)}</span><br><span class="note">${esc(r.cat)} · ${esc(r.desc)}</span></td><td class="num">${r.tipo === "P" ? "—" : (r.tipo === "E" ? "−" : "") + money(r.total)}</td><td><div class="flags">${f.map(([k, t]) => `<span class="chip ${k}">${esc(t)}</span>`).join("")}</div></td></tr>`; }).join("");
  $("#cf-k1").textContent = rows.length;
  $("#cf-k2").textContent = money(rows.reduce((a, r) => a + signedTotal(r), 0));
  $("#cf-k3").textContent = rows.filter(needsReview).length;
}
function addXML(xml, name) {
  try {
    const r = parseCFDI(xml);
    if (r.uuid && cfRows.some(x => x.uuid === r.uuid)) return { ok: false, dup: true, msg: (name ? name + ": " : "") + "ya estaba en la bandeja (mismo UUID)." };
    cfRows.push(r); return { ok: true };
  } catch (e) { return { ok: false, msg: (name ? name + ": " : "La factura ") + e.message }; }
}
let zipPromise = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (zipPromise) return zipPromise;
  const add = src => new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = () => window.JSZip ? ok(window.JSZip) : fail(); s.onerror = fail; document.head.append(s); });
  zipPromise = add("vendor/jszip.min.js").catch(() => add("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"))
    .catch(() => { zipPromise = null; throw new Error("No se pudo cargar el lector de ZIP. Revisa tu conexión."); });
  return zipPromise;
}
async function ingest(files) {
  const msg = $("#cf-msg"); let added = 0, dups = 0; const errs = [];
  say(msg, "Leyendo…");
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      try {
        const Z = await loadJSZip(); const zip = await Z.loadAsync(await f.arrayBuffer());
        const xmls = Object.values(zip.files).filter(z => !z.dir && /\.xml$/i.test(z.name));
        if (!xmls.length) errs.push(f.name + ": el ZIP no trae archivos .xml.");
        for (const z of xmls) { const r = addXML(await z.async("string"), z.name.split("/").pop()); r.ok ? added++ : r.dup ? dups++ : errs.push(r.msg); }
      } catch (e) { errs.push(f.name + ": " + (e.message || "no se pudo abrir el ZIP.")); }
    } else { const r = addXML(await f.text(), f.name); r.ok ? added++ : r.dup ? dups++ : errs.push(r.msg); }
  }
  renderCF();
  const parts = [`${added} factura${added === 1 ? "" : "s"} agregada${added === 1 ? "" : "s"}`];
  if (dups) parts.push(`${dups} repetida${dups === 1 ? "" : "s"} (mismo UUID)`);
  say(msg, parts.join(", ") + "." + (errs.length ? " No se pudieron leer: " + errs.join(" ") : ""), added ? "okmsg" : "errmsg");
}
const cfSeg = $("#cf-samples");
Object.keys(CF_SAMPLES).forEach(k => { const b = document.createElement("button"); b.type = "button"; b.textContent = k; b.setAttribute("aria-pressed", String(k === cfSel)); b.addEventListener("click", () => { cfSel = k; $$("#cf-samples button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#cf-xml").value = CF_SAMPLES[k]; }); cfSeg.append(b); });
$("#cf-xml").value = CF_SAMPLES[cfSel];
$("#cf-add").addEventListener("click", () => { const r = addXML($("#cf-xml").value); renderCF(); say($("#cf-msg"), r.ok ? "Factura agregada." : r.msg, r.ok ? "okmsg" : "errmsg"); });
$("#cf-file").addEventListener("change", async e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) await ingest(files); });
$("#cf-reset").addEventListener("click", () => { cfRows = []; $("#cf-filter").value = "*"; say($("#cf-msg"), "Bandeja vacía. Sube facturas para probar."); renderCF(); });
$("#cf-rfc").addEventListener("input", renderCF);
$("#cf-filter").addEventListener("change", renderCF);
$("#cf-dl-sample").addEventListener("click", e => { e.preventDefault(); downloadText(`ejemplo-${norm(cfSel).replace(/[^a-z0-9]+/g, "-")}.xml`, CF_SAMPLES[cfSel], "application/xml"); });
function cfTable() {
  return cfVisible().map(r => ({ Fecha: r.fecha, Folio: r.folio, Tipo: { I: "Ingreso", E: "Egreso", P: "Pago" }[r.tipo] || r.tipo, Emisor: r.emisor, "RFC emisor": r.emisorRfc, Cliente: r.receptor, "RFC cliente": r.receptorRfc, Régimen: REGIMEN[r.regimen] || r.regimen, "Uso CFDI": r.uso, Categoría: r.cat, Concepto: r.desc, "Método de pago": r.metodo, Total: signedTotal(r), UUID: r.uuid, Avisos: flagsFor(r).map(x => x[1]).join("; ") }));
}
$("#cf-xlsx").addEventListener("click", async () => {
  if (!cfVisible().length) return say($("#cf-msg"), "No hay facturas para exportar.", "errmsg");
  try { await downloadXLSX("bandeja-cfdi.xlsx", "Facturas", cfTable(), [11, 12, 9, 28, 15, 24, 15, 20, 9, 22, 30, 10, 12, 38, 44]); say($("#cf-msg"), "Excel descargado.", "okmsg"); }
  catch (err) { say($("#cf-msg"), err.message, "errmsg"); }
});
$("#cf-csv").addEventListener("click", e => {
  const t = cfTable(); if (!t.length) return;
  const head = Object.keys(t[0]);
  copyText([head.join("\t"), ...t.map(r => head.map(h => r[h]).join("\t"))].join("\n"), e.currentTarget);
});
Object.values(CF_SAMPLES).forEach(x => addXML(x));
renderCF();

/* ============ 3. Cobranza ============ */
const today = new Date(); today.setHours(0, 0, 0, 0);
const DAY = 864e5;
const dAdd = n => new Date(today.getTime() + n * DAY);
const fmtD = d => d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
const SAMPLE_INV = [
  { cli: "Constructora Itzimná", contacto: "Ing. Raúl Dzib", folio: "A-1042", saldo: 48720, due: -18 },
  { cli: "Ferretería El Henequén", contacto: "Sra. Lucy May", folio: "A-1051", saldo: 12350, due: -6 },
  { cli: "Desarrollos Costa Progreso", contacto: "Lic. Andrea Cetina", folio: "A-0998", saldo: 136900, due: -47 },
  { cli: "Acabados Montejo", contacto: "Sr. Jorge Uc", folio: "A-1066", saldo: 9800, due: 4 },
  { cli: "Grupo Hotelero Paseo", contacto: "C.P. Mario Pool", folio: "A-0971", saldo: 61400, due: -92 }
].map(i => ({ ...i, date: dAdd(i.due) }));
let INV = SAMPLE_INV.slice(), cbCompany = "Materiales del Sureste", cbSel = null, cbCh = "mail";
function stage(late) {
  if (late <= 0) return ["info", "Al corriente", "Aviso"];
  if (late <= 30) return ["warn", late + " d vencida", "Recordatorio"];
  if (late <= 60) return ["warn", late + " d vencida", "Propuesta de pagos"];
  return ["bad", late + " d vencida", "Llamada del gerente"];
}
function renderCB() {
  const total = INV.reduce((a, i) => a + i.saldo, 0) || 1;
  const over = INV.filter(i => i.due < 0);
  const vencido = over.reduce((a, i) => a + i.saldo, 0);
  const avg = over.length ? Math.round(over.reduce((a, i) => a - i.due, 0) / over.length) : 0;
  $("#cb-k1").textContent = money(INV.reduce((a, i) => a + i.saldo, 0)); $("#cb-k2").textContent = money(vencido); $("#cb-k3").textContent = avg + " d";
  const buckets = [["Al corriente", i => i.due >= 0, "var(--teal)"], ["1-30 d", i => i.due < 0 && i.due >= -30, "var(--yellow)"], ["31-60 d", i => i.due < -30 && i.due >= -60, "var(--amber)"], ["+60 d", i => i.due < -60, "var(--red)"]];
  $("#cb-aging").innerHTML = buckets.map(([, fn, c]) => { const s = INV.filter(fn).reduce((a, i) => a + i.saldo, 0); return `<span style="width:${(s / total * 100).toFixed(1)}%;background:${c}"></span>`; }).join("");
  $("#cb-aging-l").innerHTML = buckets.map(([l, fn, c]) => `<span style="white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c}"></span> ${l}: ${money(INV.filter(fn).reduce((a, i) => a + i.saldo, 0))}</span>`).join(" &nbsp; ");
  const order = INV.map((i, k) => k).sort((a, b) => INV[a].due - INV[b].due);
  $("#cb-body").innerHTML = order.map(k => { const i = INV[k]; const [cls, t] = stage(-i.due); return `<tr><td><b>${esc(i.cli)}</b><br><span class="note mono">${esc(i.folio)} · vence ${fmtD(i.date)}</span></td><td class="num"><b>${money(i.saldo)}</b><br><span class="chip ${cls}">${t}</span></td><td style="text-align:right"><button class="btn ghost small" data-k="${k}">Recordar</button></td></tr>`; }).join("");
  $$("#cb-body button").forEach(b => b.addEventListener("click", () => { cbSel = +b.dataset.k; writeReminder(); }));
}
function template(i, ch) {
  const d = -i.due, fecha = fmtD(i.date), m = money(i.saldo);
  const who = i.contacto || "equipo de " + i.cli;
  const firma = "Cobranza · " + cbCompany;
  let body;
  if (d <= 0) body = `Hola ${who}, le compartimos que la factura ${i.folio} por ${m} vence el ${fecha}. Si ya la programó, ¡gracias! Cualquier duda con el CFDI estamos a sus órdenes.`;
  else if (d <= 30) body = `Hola ${who}, esperamos que esté muy bien. Le recordamos que la factura ${i.folio} por ${m} venció el ${fecha}. ¿Nos ayuda con una fecha estimada de pago? Si ya pagó, mándenos el comprobante y lo aplicamos hoy.`;
  else if (d <= 60) body = `Hola ${who}. La factura ${i.folio} por ${m} lleva ${d} días vencida. Entendemos que pueden surgir imprevistos: si le ayuda, podemos acordar dos pagos. ¿Le parece si lo platicamos esta semana?`;
  else body = `Estimado(a) ${who}: la factura ${i.folio} por ${m} tiene ${d} días de atraso. Queremos resolverlo juntos antes de pausar nuevos pedidos a crédito. Nuestro gerente le llamará mañana para acordar un plan de pago.`;
  if (ch === "wa") return body + `\n\n— ${firma}\nResponde BAJA si no deseas recibir recordatorios por WhatsApp.`;
  return `Asunto: ${d > 0 ? "Recordatorio" : "Aviso"} · factura ${i.folio} de ${i.cli}\n\n${body}\n\nSaludos cordiales,\n${firma}`;
}
function writeReminder() {
  if (cbSel === null || !INV[cbSel]) return; const i = INV[cbSel];
  $("#cb-out").textContent = template(i, cbCh); $("#cb-out").classList.add("filled"); $("#cb-src").innerHTML = '<span class="ai-badge">plantilla · ' + stage(-i.due)[2].toLowerCase() + "</span>";
}
$("#cb-ch-mail").addEventListener("click", () => { cbCh = "mail"; $("#cb-ch-mail").setAttribute("aria-pressed", "true"); $("#cb-ch-wa").setAttribute("aria-pressed", "false"); writeReminder(); });
$("#cb-ch-wa").addEventListener("click", () => { cbCh = "wa"; $("#cb-ch-wa").setAttribute("aria-pressed", "true"); $("#cb-ch-mail").setAttribute("aria-pressed", "false"); writeReminder(); });
$("#cb-ai").addEventListener("click", async e => {
  if (cbSel === null) cbSel = 0;
  const btn = e.currentTarget; const i = INV[cbSel]; const base = template(i, cbCh); btn.disabled = true;
  const prompt = `Mejora este recordatorio de cobranza de una empresa de Mérida. Mantén TODOS los datos exactos (nombre, folio, monto, fecha, días), tono respetuoso y cercano, en español de México, sin amenazas ni presión indebida, ${cbCh === "wa" ? "máximo 60 palabras y conserva la línea final para responder BAJA" : "formato correo con asunto"}. Solo el mensaje final.\n\n${base}`;
  await askAI("cobranza", { base, channel: cbCh }, prompt, $("#cb-out"), $("#cb-src"), base);
  btn.disabled = false;
});
$("#cb-copy").addEventListener("click", e => copyText($("#cb-out").textContent, e.currentTarget));

function toDate(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * DAY)); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const s = String(v || "").trim(); let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
const toNum = v => typeof v === "number" ? v : parseFloat(String(v || "").replace(/[$,\s]/g, "").replace(/MXN/i, ""));
async function importCartera(file) {
  const msg = $("#cb-msg");
  say(msg, "Leyendo tu archivo…");
  try {
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: "array" });
    const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
    if (!rows.length) throw new Error("El archivo está vacío.");
    const keys = Object.keys(rows[0]); const find = re => keys.find(k => re.test(norm(k)));
    const K = { cli: find(/cliente|razon|nombre/), contacto: find(/contacto|atencion|responsable/), folio: find(/folio|factura|documento/), saldo: find(/saldo|monto|importe|total|adeudo/), vence: find(/venc|fecha/) };
    const missing = [["Cliente", K.cli], ["Saldo", K.saldo], ["Vence", K.vence]].filter(x => !x[1]).map(x => x[0]);
    if (missing.length) throw new Error("Faltan columnas: " + missing.join(", ") + ". Descarga la plantilla para ver el formato.");
    let skipped = 0;
    const list = rows.slice(0, 500).map(r => {
      const date = toDate(r[K.vence]), saldo = toNum(r[K.saldo]);
      if (!String(r[K.cli]).trim() || !date || !(saldo > 0)) { skipped++; return null; }
      return { cli: String(r[K.cli]).trim(), contacto: K.contacto ? String(r[K.contacto]).trim() : "", folio: K.folio ? String(r[K.folio]).trim() || "s/folio" : "s/folio", saldo, date, due: Math.round((date - today) / DAY) };
    }).filter(Boolean);
    if (!list.length) throw new Error("No encontré filas con cliente, saldo mayor a 0 y fecha de vencimiento válida.");
    INV = list; cbCompany = "Tu empresa"; cbSel = null;
    $("#cb-title").textContent = "1 · Tu cartera: " + file.name;
    $("#cb-out").textContent = "Pulsa “Recordar” en un cliente."; $("#cb-out").classList.remove("filled"); $("#cb-src").innerHTML = "";
    renderCB();
    say(msg, `Listo: ${list.length} facturas leídas${skipped ? `, ${skipped} filas omitidas (sin saldo o sin fecha)` : ""}. Tu archivo no salió de tu navegador.`, "okmsg");
  } catch (e) { say(msg, e.message || "No pude leer ese archivo.", "errmsg"); }
}
$("#cb-file").addEventListener("change", e => { const f = e.target.files[0]; if (f) importCartera(f); e.target.value = ""; });
$("#cb-reset").addEventListener("click", () => { INV = SAMPLE_INV.slice(); cbCompany = "Materiales del Sureste"; cbSel = null; $("#cb-title").textContent = "1 · Cartera de Materiales del Sureste (ejemplo)"; say($("#cb-msg"), "Volviste al ejemplo."); renderCB(); });
$("#cb-template").addEventListener("click", async () => {
  try { await downloadXLSX("plantilla-cartera.xlsx", "Cartera", SAMPLE_INV.map(i => ({ Cliente: i.cli, Contacto: i.contacto, Folio: i.folio, Saldo: i.saldo, Vence: xlDate(i.date) })), [30, 22, 10, 12, 12], ["Vence"]); say($("#cb-msg"), "Plantilla descargada. Llénala con tus clientes y súbela.", "okmsg"); }
  catch (e) { say($("#cb-msg"), e.message, "errmsg"); }
});
$("#cb-xlsx").addEventListener("click", async () => {
  try {
    const rows = INV.slice().sort((a, b) => a.due - b.due).map(i => ({ Cliente: i.cli, Contacto: i.contacto, Folio: i.folio, Saldo: i.saldo, Vence: xlDate(i.date), "Días vencida": Math.max(0, -i.due), Etapa: stage(-i.due)[2], "Mensaje WhatsApp": template(i, "wa"), "Mensaje correo": template(i, "mail") }));
    await downloadXLSX("reporte-cobranza.xlsx", "Cobranza", rows, [28, 20, 10, 12, 12, 12, 20, 60, 60], ["Vence"]);
    say($("#cb-msg"), "Reporte descargado con un mensaje listo para cada cliente.", "okmsg");
  } catch (e) { say($("#cb-msg"), e.message, "errmsg"); }
});
renderCB();

/* ============ 4. Manuales ============ */
const MANUAL = [
  ["1. Horario de atención", "El almacén atiende de lunes a viernes de 7:00 a 18:00 y sábados de 7:00 a 13:00. Los pedidos recibidos después de las 15:00 se surten al día siguiente hábil."],
  ["2. Devoluciones de material", "El cliente puede devolver material en los 15 días naturales siguientes a la entrega, con su factura y en empaque original. No se aceptan devoluciones de material cortado a la medida ni de cemento con más de 30 días de fabricación. La nota de crédito se emite en un máximo de 3 días hábiles."],
  ["3. Crédito a clientes", "El crédito se otorga a clientes con 6 meses de compras continuas. El plazo estándar es de 30 días. Con más de 60 días de atraso se suspende el crédito hasta regularizar el saldo. El gerente de cobranza autoriza convenios de pago."],
  ["4. Entregas a domicilio", "La entrega es gratis en Mérida para pedidos mayores a $5,000. Progreso, Umán y Kanasín tienen un costo de $450 por viaje. El cliente debe tener a alguien para recibir y firmar la remisión."],
  ["5. Vacaciones del personal", "Se otorgan conforme a la Ley Federal del Trabajo: 12 días el primer año de servicio, aumentando 2 días por año hasta 20. Deben solicitarse con 15 días de anticipación al jefe directo."],
  ["6. Viáticos", "Los viajes fuera de Mérida tienen viáticos de $650 por día para alimentos. Se comprueban con CFDI a nombre de la empresa en los 5 días hábiles siguientes al viaje."],
  ["7. Seguridad en almacén", "Es obligatorio usar casco, chaleco y zapato de seguridad en el patio de carga. Los montacargas solo los operan personas con certificación vigente."]
];
const STOP = new Set("el la los las un una unos unas de del al a y o u que en con por para es son se su sus lo como cual cuales cuanto cuanta cuantos cuantas cuando donde mi me tiene tienen tengo tenemos hay puede pueden puedo debe deben debo si no hace hacer usted ustedes ellos esta este estan esto eso algo alguna alguno algun sobre mas menos muy ser estar quiero necesito saber pasa tambien".split(" "));
const SUFFIXES = ["aciones", "acion", "iones", "mente", "iendo", "ando", "idos", "idas", "ados", "adas", "ido", "ida", "ado", "ada", "an", "en", "ar", "er", "ir", "es", "os", "as", "o", "a", "e", "s"];
const stem = w => { for (const s of SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 3) return w.slice(0, -s.length); return w; };
const toks = s => norm(s).replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
const same = (a, b) => a === b;
function search(q) {
  const qt = [...new Set(toks(q))];
  const scored = MANUAL.map(([t, b], i) => {
    const tt = toks(t), bt = toks(b);
    const hit = qt.filter(w => bt.some(d => same(w, d)) || tt.some(d => same(w, d))).length;
    const head = qt.filter(w => tt.some(d => same(w, d))).length;
    return { i, t, b, s: hit + head * 1.5 };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  return scored.filter(x => x.s >= scored[0].s * 0.6).slice(0, 2);
}
function bestSentences(q, text) {
  const qt = [...new Set(toks(q))];
  const sents = text.split(/(?<=\.)\s+/);
  const sc = sents.map(s => toks(s).filter(d => qt.some(w => same(w, d))).length);
  const max = Math.max(...sc);
  if (max === 0) return text;
  return sents.filter((s, i) => sc[i] === max || (sc[i] > 0 && sc[i] >= max - 1)).slice(0, 2).join(" ");
}
const SUGG = ["¿Cuántos días tiene un cliente para devolver material?", "¿Cuánto cuesta la entrega a Progreso?", "¿Cuántos días de vacaciones me tocan el primer año?", "¿Tienen sucursal en Cancún?"];
$("#mn-sugg").innerHTML = SUGG.map(s => `<button class="btn ghost small" type="button">${esc(s)}</button>`).join("");
$$("#mn-sugg button").forEach(b => b.addEventListener("click", () => { $("#mn-q").value = b.textContent; runManual(); }));
$("#mn-doc").innerHTML = MANUAL.map(([t, b]) => `<div><b>${esc(t)}</b><br>${esc(b)}</div>`).join("");
async function runManual() {
  const q = $("#mn-q").value.trim(); if (!q) return;
  const hits = search(q);
  $("#mn-frags").innerHTML = hits.length ? hits.map(h => `<div class="frag"><b>${esc(h.t)}</b>${esc(h.b)}</div>`).join("") : '<div class="frag"><b>Sin coincidencias</b>Ninguna sección del manual habla de esto.</div>';
  const fallback = hits.length ? `${bestSentences(q, hits[0].b)}\n\n(Fuente: sección “${hits[0].t}”)` : "No encontré esa información en el manual. Te sugiero preguntar a tu jefe directo o a Recursos Humanos.";
  const ctx = hits.map(h => `[${h.t}] ${h.b}`).join("\n");
  const prompt = `Responde la pregunta de un empleado usando SOLO estas secciones del manual de una distribuidora de materiales en Mérida. Si la respuesta no está en las secciones, di exactamente que no aparece en el manual. Responde en español, máximo 60 palabras, y termina citando la sección entre paréntesis.\n\nSecciones:\n${ctx}\n\nPregunta: ${q}`;
  const btn = $("#mn-go"); btn.disabled = true;
  if (!hits.length) { $("#mn-out").textContent = fallback; $("#mn-out").classList.add("filled"); $("#mn-src").innerHTML = '<span class="ai-badge">no está en el manual</span>'; }
  else await askAI("manual", { question: q, sections: hits.map(h => h.i) }, prompt, $("#mn-out"), $("#mn-src"), fallback);
  btn.disabled = false;
}
$("#mn-go").addEventListener("click", runManual);
$("#mn-q").addEventListener("keydown", e => { if (e.key === "Enter") runManual(); });

/* ============ 5. Inmuebles ============ */
const TYPE_EN = { "Casa colonial": "Colonial home", "Departamento": "Apartment", "Casa de playa": "Beach house", "Terreno": "Land" };
const USD_RATE = 18.5;
const RE_PRESETS = [
  { label: "Casa colonial en Santiago", v: { type: "Casa colonial", zone: "Barrio de Santiago, Centro", bed: 3, bath: 2.5, lot: 420, built: 260, price: 6950000, extra: "Restaurada en 2024, techos altos con vigas, pisos de pasta originales, alberca, jardín con árbol de mango, a 3 cuadras del mercado de Santiago." },
    en: "Restored in 2024 with high beamed ceilings, original pasta tile floors, a pool and a garden with a mango tree, three blocks from Santiago market." },
  { label: "Casa de playa en Chicxulub", v: { type: "Casa de playa", zone: "Chicxulub Puerto, Progreso", bed: 3, bath: 3, lot: 300, built: 210, price: 8400000, extra: "Frente al mar, terraza en azotea con vista al atardecer, alberca, a 10 minutos del malecón de Progreso y a 40 de Mérida." },
    en: "Beachfront, with a rooftop terrace for sunset views and a pool, 10 minutes from the Progreso boardwalk and 40 minutes from Mérida." },
  { label: "Departamento en Temozón", v: { type: "Departamento", zone: "Temozón Norte, Mérida", bed: 2, bath: 2, lot: 0, built: 115, price: 3650000, extra: "Torre nueva con gimnasio, alberca, seguridad 24 horas y dos cajones de estacionamiento; cerca de plazas comerciales y hospitales del norte." },
    en: "New tower with gym, pool, 24-hour security and two parking spaces; close to shopping centers and hospitals in north Mérida." }
];
let reLang = "es", reData = null;
function setRE(v) { $("#re-type").value = v.type; $("#re-zone").value = v.zone; $("#re-bed").value = v.bed; $("#re-bath").value = v.bath; $("#re-lot").value = v.lot; $("#re-built").value = v.built; $("#re-price").value = v.price; $("#re-extra").value = v.extra; }
$("#re-presets").innerHTML = RE_PRESETS.map((p, i) => `<button type="button" class="btn ghost small" data-i="${i}">${esc(p.label)}</button>`).join("");
$$("#re-presets button").forEach(b => b.addEventListener("click", () => { setRE(RE_PRESETS[+b.dataset.i].v); $("#re-go").click(); }));
setRE(RE_PRESETS[0].v);
function reVals() { return { type: $("#re-type").value, zone: $("#re-zone").value.trim(), bed: +$("#re-bed").value || 0, bath: +$("#re-bath").value || 0, lot: +$("#re-lot").value || 0, built: +$("#re-built").value || 0, price: +$("#re-price").value || 0, extra: $("#re-extra").value.trim() }; }
function reFallback(v) {
  const usd = Math.round(v.price / USD_RATE / 1000) * 1000;
  const isLand = v.type === "Terreno";
  const featEs = [!isLand && v.bed && `${v.bed} recámaras`, !isLand && v.bath && `${v.bath} baños`, v.lot && `${v.lot.toLocaleString("es-MX")} m² de terreno`, !isLand && v.built && `${v.built.toLocaleString("es-MX")} m² de construcción`].filter(Boolean).join(" · ");
  const featEn = [!isLand && v.bed && `${v.bed} bedrooms`, !isLand && v.bath && `${v.bath} bathrooms`, v.lot && `${v.lot.toLocaleString("en-US")} m² lot (${Math.round(v.lot * 10.764).toLocaleString("en-US")} sq ft)`, !isLand && v.built && `${v.built.toLocaleString("en-US")} m² built (${Math.round(v.built * 10.764).toLocaleString("en-US")} sq ft)`].filter(Boolean).join(" · ");
  const preset = RE_PRESETS.find(p => p.v.extra === v.extra);
  return {
    es: `${v.type} en ${v.zone}\n${money(v.price)} MXN\n\n${featEs}\n\n${v.extra}\n\nAgenda tu visita y recibe el plano y los documentos por correo.`,
    en: `${TYPE_EN[v.type] || v.type} in ${v.zone}\n${money(v.price)} MXN (approx. US$${usd.toLocaleString("en-US")})\n\n${featEn}\n\n${preset ? preset.en + "\n\n" : ""}Book a visit and get the floor plan and documents by email.`,
    partial: !preset
  };
}
function renderRE() {
  if (!reData) return;
  $("#re-out").textContent = reData[reLang]; $("#re-out").classList.add("filled");
  $("#re-es").setAttribute("aria-pressed", String(reLang === "es")); $("#re-en").setAttribute("aria-pressed", String(reLang === "en"));
  const note = $("#re-note");
  note.hidden = !(reData.partial && reLang === "en");
  note.textContent = "En modo muestra traducimos los datos fijos (tipo, medidas, precio). Los “Detalles” que escribiste se traducen con la IA en vivo.";
}
$("#re-es").addEventListener("click", () => { reLang = "es"; renderRE(); }); $("#re-en").addEventListener("click", () => { reLang = "en"; renderRE(); });
$("#re-go").addEventListener("click", async e => {
  const btn = $("#re-go"); const v = reVals(); const fb = reFallback(v); btn.disabled = true;
  if (aiMode === "none") { reData = fb; $("#re-src").innerHTML = badge(false); renderRE(); btn.disabled = false; return; }
  $("#re-out").textContent = "Escribiendo…";
  try {
    const r = await runAI("inmueble", v, `Escribe una ficha inmobiliaria atractiva y honesta para un portal, en español de México y en inglés de EE. UU. No inventes datos que no estén aquí. En inglés agrega el precio aproximado en USD (tipo de cambio ${USD_RATE}) y los m² en sq ft. Cada versión: título en la primera línea, precio en la segunda, luego características y 2-3 frases de descripción, máximo 110 palabras. Responde solo con JSON {"es": string, "en": string}.\n\nDatos: ${JSON.stringify(v)}`, true);
    if (r && typeof r.es === "string" && typeof r.en === "string") { reData = { es: r.es, en: r.en, partial: false }; $("#re-src").innerHTML = badge(true); }
    else throw 0;
  } catch { reData = fb; $("#re-src").innerHTML = badge(false); }
  renderRE(); btn.disabled = false;
});
$("#re-copy").addEventListener("click", e => copyText($("#re-out").textContent, e.currentTarget));

/* ============ 6. Agenda ============ */
const SVCS = [["Limpieza dental", "Dental cleaning", 40, 600], ["Valoración de implante", "Implant consultation", 45, 800], ["Blanqueamiento", "Teeth whitening", 60, 2800], ["Resina (caries)", "Tooth-colored filling", 45, 900]];
const CLINIC = { name: "Clínica Dental Montejo (ejemplo)", addr: "Calle 31, col. México, Mérida" };
const DEFAULT_NAME = { es: "Mariana Pech", en: "Mary Johnson" };
let agLang = "es", agPick = null, agReply = 0;
const loc = () => agLang === "en" ? "en-US" : "es-MX";
function renderSvcs() { const cur = $("#ag-svc").value || "0"; $("#ag-svc").innerHTML = SVCS.map(([es, en, m, p], i) => `<option value="${i}">${agLang === "en" ? en : es} · ${m} min · ${money(p)} MXN${agLang === "en" ? ` (≈ US$${Math.round(p / USD_RATE)})` : ""}</option>`).join(""); $("#ag-svc").value = cur; }
const taken = new Set(["1-10:30", "1-12:00", "2-09:00", "3-16:30", "3-17:30"]);
const TIMES = ["09:00", "10:30", "12:00", "16:30", "17:30"];
function bizDays(n) { const out = []; const d = new Date(today); while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) out.push(new Date(d)); } return out; }
const DAYS = bizDays(3);
function renderAG() {
  $("#ag-days").innerHTML = DAYS.map((d, di) => `<p class="day-label">${d.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })}</p><div class="slots">${TIMES.map(t => { const k = (di + 1) + "-" + t; const dis = taken.has(k); const on = agPick && agPick.k === k; return `<button type="button" class="slot" data-k="${k}" data-d="${di}" data-t="${t}" ${dis ? `disabled aria-label="${t} ocupado"` : ""} aria-pressed="${on}">${t}</button>`; }).join("")}</div>`).join("");
  $$("#ag-days .slot:not([disabled])").forEach(b => b.addEventListener("click", () => { agPick = { k: b.dataset.k, d: DAYS[+b.dataset.d], t: b.dataset.t }; agReply = 0; renderAG(); renderWA(); }));
}
function agTimes() {
  const s = SVCS[+$("#ag-svc").value]; const [h, m] = agPick.t.split(":").map(Number);
  const start = new Date(agPick.d); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + s[2] * 60000);
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  return { svc: agLang === "en" ? s[1] : s[0], start: f(start), end: f(end) };
}
function renderWA() {
  if (!agPick) return;
  const s = SVCS[+$("#ag-svc").value]; const en = agLang === "en"; const svc = en ? s[1] : s[0]; const price = s[3];
  const name = $("#ag-name").value.trim() || (en ? "Patient" : "Paciente");
  const fecha = agPick.d.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" });
  const prev = new Date(agPick.d); prev.setDate(prev.getDate() - 1);
  const prevTxt = prev.toLocaleDateString(loc(), { day: "numeric", month: "short" });
  let html = en
    ? `<div class="bubble">Hi ${esc(name)}! Your <b>${esc(svc.toLowerCase())}</b> is booked for <b>${fecha} at ${agPick.t}</b> at ${CLINIC.name}, ${CLINIC.addr}. Cost: ${money(price)} MXN (≈ US$${Math.round(price / USD_RATE)}).<time>now</time></div>`
      + `<div class="bubble">Reminder: tomorrow at ${agPick.t} you have your ${esc(svc.toLowerCase())}. Reply 1 to confirm or 2 to reschedule.\nReply STOP to opt out.<time>${prevTxt} · 10:00</time></div>`
    : `<div class="bubble">¡Hola ${esc(name)}! Tu cita de <b>${esc(svc)}</b> quedó agendada para el <b>${fecha} a las ${agPick.t}</b> en ${CLINIC.name}, ${CLINIC.addr}. Costo: ${money(price)}.<time>ahora</time></div>`
      + `<div class="bubble">Recordatorio: mañana a las ${agPick.t} tienes tu ${esc(svc.toLowerCase())}. Responde 1 para confirmar o 2 para cambiar la cita.\nEscribe BAJA para no recibir mensajes.<time>${prevTxt} · 10:00</time></div>`;
  if (agReply === 1) html += `<div class="bubble me">1<time>10:02</time></div><div class="bubble">${en ? "Thank you! Your appointment is confirmed. Please arrive 10 minutes early. 😊" : "¡Gracias! Tu cita está confirmada. Te esperamos 10 minutos antes. 😊"}<time>10:02</time></div>`;
  if (agReply === 2) html += `<div class="bubble me">2<time>10:03</time></div><div class="bubble">${en ? "No problem. We've released your slot, and our front desk will message you shortly to pick a new time." : "Sin problema. Liberamos tu horario y en unos minutos te escribe nuestra recepción para elegir uno nuevo."}<time>10:03</time></div>`;
  $("#ag-wa").innerHTML = html;
  const t = agTimes();
  $("#ag-gcal").href = "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: `${t.svc} · ${name}`, dates: `${t.start}/${t.end}`, ctz: "America/Merida", details: `${en ? "Patient" : "Paciente"}: ${name}. ${en ? "Confirmed via WhatsApp." : "Confirmación por WhatsApp."}`, location: CLINIC.name + ", " + CLINIC.addr }).toString();
}
function setAgLang(l) {
  const nameEl = $("#ag-name"); if (!nameEl.value.trim() || nameEl.value === DEFAULT_NAME[agLang]) nameEl.value = DEFAULT_NAME[l];
  agLang = l; $("#ag-es").setAttribute("aria-pressed", String(l === "es")); $("#ag-en").setAttribute("aria-pressed", String(l === "en"));
  renderSvcs(); renderAG(); renderWA();
}
$("#ag-es").addEventListener("click", () => setAgLang("es")); $("#ag-en").addEventListener("click", () => setAgLang("en"));
function pickFirst() { if (!agPick) { const b = $("#ag-days .slot:not([disabled])"); b && b.click(); } }
$("#ag-svc").addEventListener("change", () => renderWA()); $("#ag-name").addEventListener("input", () => renderWA());
$("#ag-r1").addEventListener("click", () => { pickFirst(); agReply = 1; renderWA(); });
$("#ag-r2").addEventListener("click", () => { pickFirst(); agReply = 2; renderWA(); });
$("#ag-ics").addEventListener("click", () => {
  pickFirst(); const t = agTimes(); const name = $("#ag-name").value.trim() || "Paciente";
  const icsEsc = s => String(s).replace(/([,;\\])/g, "\\$1");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Xook IA//Citas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${t.start}-${Math.random().toString(36).slice(2)}@xook-ia`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Merida:${t.start}`, `DTEND;TZID=America/Merida:${t.end}`,
    `SUMMARY:${icsEsc(t.svc + " · " + name)}`, `LOCATION:${icsEsc(CLINIC.name + ", " + CLINIC.addr)}`,
    `DESCRIPTION:${icsEsc("Cita agendada desde el demo de Xook IA.")}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de cita", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  downloadText("cita.ics", ics, "text/calendar");
});
renderSvcs(); renderAG();
{ const first = $("#ag-days .slot:not([disabled])"); if (first) first.click(); }

/* ============ Contacto ============ */
$("#ct-mail").textContent = CONFIG.EMAIL;
$("#ct-form").addEventListener("submit", e => {
  e.preventDefault();
  const biz = $("#ct-biz").value.trim();
  if (!biz) { $("#ct-biz").focus(); $("#ct-biz").setAttribute("aria-invalid", "true"); return; }
  $("#ct-biz").removeAttribute("aria-invalid");
  const msg = `Hola, me interesa la auditoría gratis.\nNegocio: ${biz}\nGiro: ${$("#ct-type").value}\nMe interesa: ${$("#ct-need").value}\nMe pueden encontrar en Google como: ${biz}, Mérida.`;
  $("#ct-msg").textContent = msg;
  $("#ct-mailto").href = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent("Auditoría gratis: " + biz)}&body=${encodeURIComponent(msg)}`;
  const wa = $("#ct-wa");
  if (CONFIG.WHATSAPP) { wa.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(msg)}`; wa.hidden = false; } else wa.hidden = true;
  $("#ct-out").hidden = false;
});
$("#ct-copy").addEventListener("click", e => copyText($("#ct-msg").textContent, e.currentTarget));
})();
