/**
 * Pilón: servidor pequeño para la IA en vivo del sitio (Cloudflare Worker).
 *
 * Qué hace: recibe {task, data} del sitio, arma un prompt FIJO para esa tarea y llama a Claude.
 * No acepta prompts libres, así nadie puede usarlo como chatbot gratis.
 *
 * Variables en Cloudflare:
 *   ANTHROPIC_API_KEY  (secreto, obligatorio)
 *   LIMITES            (KV namespace, opcional: límite diario por persona y total)
 *   ORIGENES           (texto, opcional: dominios extra separados por coma,
 *                       p. ej. "https://pilon.mx,https://www.pilon.mx")
 */
const MODEL = "claude-haiku-5-5";
const ALLOWED_ORIGINS = ["https://kalebtf.github.io"];
const PER_IP_PER_DAY = 25;
const TOTAL_PER_DAY = 600;

const MANUAL = [
  ["1. Horario de atención", "El almacén atiende de lunes a viernes de 7:00 a 18:00 y sábados de 7:00 a 13:00. Los pedidos recibidos después de las 15:00 se surten al día siguiente hábil."],
  ["2. Devoluciones de material", "El cliente puede devolver material en los 15 días naturales siguientes a la entrega, con su factura y en empaque original. No se aceptan devoluciones de material cortado a la medida ni de cemento con más de 30 días de fabricación. La nota de crédito se emite en un máximo de 3 días hábiles."],
  ["3. Crédito a clientes", "El crédito se otorga a clientes con 6 meses de compras continuas. El plazo estándar es de 30 días. Con más de 60 días de atraso se suspende el crédito hasta regularizar el saldo. El gerente de cobranza autoriza convenios de pago."],
  ["4. Entregas a domicilio", "La entrega es gratis en Mérida para pedidos mayores a $5,000. Progreso, Umán y Kanasín tienen un costo de $450 por viaje. El cliente debe tener a alguien para recibir y firmar la remisión."],
  ["5. Vacaciones del personal", "Se otorgan conforme a la Ley Federal del Trabajo: 12 días el primer año de servicio, aumentando 2 días por año hasta 20. Deben solicitarse con 15 días de anticipación al jefe directo."],
  ["6. Viáticos", "Los viajes fuera de Mérida tienen viáticos de $650 por día para alimentos. Se comprueban con CFDI a nombre de la empresa en los 5 días hábiles siguientes al viaje."],
  ["7. Seguridad en almacén", "Es obligatorio usar casco, chaleco y zapato de seguridad en el patio de carga. Los montacargas solo los operan personas con certificación vigente."]
];
const BIZ_CTX = {
  rest: `"Cocina Doña Elvira", restaurante de comida yucateca en la Calle 60, Centro de Mérida (horario 8:00-23:00, tiene patio, menú en inglés recién hecho, estacionamiento público en la calle 57, el turno de cocina de fin de semana se reforzó y el mesero ahora avisa el tiempo estimado)`,
  hotel: `"Casa Ejemplo Hotel Boutique", hotel en una casona de 1890 en la Calle 55, a una cuadra del parque de Santa Lucía, Centro de Mérida (check-in 15:00, guarda maletas desde las 10:00, ingreso anticipado si avisan por WhatsApp, desayuno incluido, alberca pequeña, el aire acondicionado de las habitaciones se revisó esta semana, reserva directa por WhatsApp y precios aproximados en USD en la web)`
};
const TONES = { calido: "cálido y cercano", profesional: "profesional y formal (usted)", breve: "muy breve, máximo 30 palabras" };
const cut = (s, n) => String(s ?? "").slice(0, n);
const num = (v, max) => Math.max(0, Math.min(Number(v) || 0, max));

function buildPrompt(task, d) {
  if (task === "resena") {
    const lang = d.lang === "en" ? "inglés" : "español";
    return { max: 300, json: false, prompt: `Eres el dueño de ${BIZ_CTX[d.biz] || BIZ_CTX.rest}. Responde esta reseña de Google en ${lang}, tono ${TONES[d.tone] || TONES.calido}, máximo 70 palabras. Agradece; si hay queja, reconócela sin excusas y di qué se hizo; invita a volver; firma como el equipo. No inventes descuentos ni datos que no estén aquí. Solo el texto de la respuesta.\n\nReseña (${num(d.stars, 5)} estrellas) de ${cut(d.name, 60)}: "${cut(d.review, 600)}"` };
  }
  if (task === "cobranza") {
    return { max: 350, json: false, prompt: `Mejora este recordatorio de cobranza de una empresa de Mérida. Mantén TODOS los datos exactos (nombre, folio, monto, fecha, días), tono respetuoso y cercano, en español de México, sin amenazas ni presión indebida, ${d.channel === "wa" ? "máximo 60 palabras y conserva la línea final para responder BAJA" : "formato correo con asunto"}. Solo el mensaje final.\n\n${cut(d.base, 900)}` };
  }
  if (task === "manual") {
    // Manual de ejemplo (por número de sección) o manual que subió el visitante (máx. 3 secciones cortas)
    const ids = (Array.isArray(d.sections) ? d.sections : []).filter(i => Number.isInteger(i) && MANUAL[i]).slice(0, 3);
    const custom = (Array.isArray(d.custom) ? d.custom : []).slice(0, 3).map(x => [cut(x?.[0], 120), cut(x?.[1], 1500)]);
    const ctx = (custom.length ? custom : ids.map(i => MANUAL[i])).map(([t, b]) => `[${t}] ${b}`).join("\n") || "(ninguna)";
    return { max: 250, json: false, prompt: `Responde la pregunta de un empleado usando SOLO estas secciones del manual de una empresa en Mérida. Si la respuesta no está en las secciones, di exactamente que no aparece en el manual. Responde en español, máximo 60 palabras, y termina citando la sección entre paréntesis.\n\nSecciones:\n${ctx}\n\nPregunta: ${cut(d.question, 300)}` };
  }
  if (task === "inmueble") {
    const v = { type: cut(d.type, 40), zone: cut(d.zone, 80), bed: num(d.bed, 50), bath: num(d.bath, 50), lot: num(d.lot, 1e6), built: num(d.built, 1e6), price: num(d.price, 1e10), extra: cut(d.extra, 700) };
    return { max: 900, json: true, prompt: `Escribe una ficha inmobiliaria atractiva y honesta para un portal, en español de México y en inglés de EE. UU. No inventes datos que no estén aquí. En inglés agrega el precio aproximado en USD (tipo de cambio 18.5) y los m² en sq ft. Cada versión: título en la primera línea, precio en la segunda, luego características y 2-3 frases de descripción, máximo 110 palabras. Responde solo con JSON {"es": string, "en": string}, sin texto adicional.\n\nDatos: ${JSON.stringify(v)}` };
  }
  return null;
}

async function overLimit(env, ip) {
  if (!env.LIMITES) return false;
  const day = new Date().toISOString().slice(0, 10);
  const kIp = `ip:${day}:${ip}`, kAll = `all:${day}`;
  const [a, b] = await Promise.all([env.LIMITES.get(kIp), env.LIMITES.get(kAll)]);
  if (+a >= PER_IP_PER_DAY || +b >= TOTAL_PER_DAY) return true;
  await Promise.all([env.LIMITES.put(kIp, String(+a + 1), { expirationTtl: 172800 }), env.LIMITES.put(kAll, String(+b + 1), { expirationTtl: 172800 })]);
  return false;
}

// Dominios permitidos: los fijos + los de la variable ORIGENES (para agregar el dominio propio sin tocar código).
const origins = env => [...ALLOWED_ORIGINS, ...String(env?.ORIGENES || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean)];
const allowed = (origin, env) => origins(env).includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || "");
function cors(origin, env) {
  const ok = allowed(origin, env);
  return { "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...h } });

// Caché: misma tarea + mismos datos = misma respuesta, sin volver a pagarle a la IA (7 días).
const CACHE_TTL = 7 * 24 * 3600;
async function cacheKey(task, prompt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(MODEL + "|" + task + "|" + prompt));
  return "cache:" + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Monitoreo: una línea JSON por solicitud. Se ve en Cloudflare → Workers → pilon-ia → Logs (activar "Workers Logs").
function log(level, event, fields) {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...fields });
  (level === "error" ? console.error : console.log)(line);
}

export default {
  async fetch(req, env) {
    const started = Date.now();
    const origin = req.headers.get("Origin") || "";
    const h = cors(origin, env);
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (url.pathname === "/salud") return json({ ok: !!env.ANTHROPIC_API_KEY, cache: !!env.LIMITES }, env.ANTHROPIC_API_KEY ? 200 : 503, h);
    if (url.pathname !== "/ia" || req.method !== "POST") return json({ error: "no encontrado" }, 404, h);
    if (origin && !allowed(origin, env)) { log("warn", "origen_bloqueado", { origin }); return json({ error: "origen no permitido" }, 403, h); }

    let body; try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400, h); }
    const task = body?.task;
    const p = buildPrompt(task, body?.data || {});
    if (!p) { log("warn", "tarea_desconocida", { task: String(task).slice(0, 30) }); return json({ error: "tarea desconocida" }, 400, h); }

    // 1) Caché primero: las respuestas repetidas no gastan saldo ni cuentan para el límite diario.
    let key = null;
    if (env.LIMITES) {
      key = await cacheKey(task, p.prompt);
      const hit = await env.LIMITES.get(key);
      if (hit) { log("info", "ia_ok", { task, cached: true, ms: Date.now() - started }); return new Response(hit, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "x-cache": "HIT", ...h } }); }
    }
    // 2) Límite diario por persona y total.
    if (await overLimit(env, req.headers.get("CF-Connecting-IP") || "?")) { log("warn", "limite", { task }); return json({ error: "límite diario alcanzado" }, 429, h); }

    // 3) Llamada a Claude.
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: p.max, messages: [{ role: "user", content: p.prompt }] })
      });
    } catch (e) { log("error", "ia_red", { task, msg: String(e).slice(0, 200) }); return json({ error: "IA no disponible" }, 502, h); }
    if (!r.ok) { log("error", "ia_http", { task, status: r.status, body: (await r.text()).slice(0, 300) }); return json({ error: "IA no disponible" }, 502, h); }
    const out = await r.json();
    const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
    let payload;
    if (!p.json) payload = { text };
    else {
      try { const m = text.match(/\{[\s\S]*\}/); payload = { json: JSON.parse(m ? m[0] : text) }; }
      catch { log("error", "ia_formato", { task, sample: text.slice(0, 120) }); return json({ error: "respuesta sin formato" }, 502, h); }
    }
    const res = JSON.stringify(payload);
    if (key) await env.LIMITES.put(key, res, { expirationTtl: CACHE_TTL });
    log("info", "ia_ok", { task, cached: false, ms: Date.now() - started, in: out.usage?.input_tokens, out: out.usage?.output_tokens });
    return new Response(res, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "x-cache": "MISS", ...h } });
  }
};
