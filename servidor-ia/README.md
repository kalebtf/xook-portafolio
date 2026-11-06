# Servidor de IA para el sitio (opcional)

**Qué es:** un programa pequeño que vive en Cloudflare (gratis) y conecta el sitio con Claude.
**Para qué sirve:** sin él, el sitio muestra respuestas de muestra. Con él, las reseñas, los manuales, las fichas y la cobranza se escriben en vivo.
**Analogía:** es la ventanilla de un banco. El sitio pide algo, la ventanilla revisa que sea un trámite permitido y lo pasa a Claude. Tu llave nunca sale de la ventanilla.

## Seguridad
- Solo acepta 4 tareas fijas (reseña, cobranza, manual, inmueble). No acepta preguntas libres.
- Solo responde a tu sitio (`kalebtf.github.io`).
- Límite de 25 respuestas por persona al día y 600 en total, si activas el paso 3.
- **Caché** (paso 3): si alguien pide exactamente lo mismo, se responde de memoria por 7 días. No le paga de nuevo a la IA ni cuenta para el límite.
- **Registro (monitoreo):** cada solicitud deja una línea con la tarea, si vino de caché, cuánto tardó y cuántos tokens usó. Los errores quedan marcados como `error`.
- Tu llave de Anthropic se guarda como **secreto** en Cloudflare. No la pegues en el código ni la compartas en el chat.

## Pasos (unos 15 minutos)
1. **Crea el Worker.** En [dash.cloudflare.com](https://dash.cloudflare.com) entra a *Workers & Pages → Create → Worker*, ponle de nombre `xook-ia` y pulsa *Deploy*. Luego entra a *Edit code*, borra lo que trae, pega el contenido de `worker.js` y vuelve a pulsar *Deploy*.
2. **Guarda tu llave.** En *Settings → Variables and Secrets → Add*, elige el tipo *Secret*, ponle de nombre `ANTHROPIC_API_KEY` y pega tu llave de [console.anthropic.com](https://console.anthropic.com).
3. **Límites diarios (recomendado).** En *Storage & Databases → KV → Create*, crea uno llamado `xook-limites`. Después, en el Worker, entra a *Settings → Bindings → Add → KV namespace*, ponle de nombre `LIMITES` y elige `xook-limites`.
4. **Pon un tope de gasto.** En la consola de Anthropic, entra a *Limits* y fija un límite mensual bajo (por ejemplo, USD 5) con la recarga automática apagada. Así nunca gastas más de lo que decidas.
5. **Activa el registro.** En el Worker, entra a *Settings → Observability* y prende **Workers Logs**. Ahí ves cada solicitud y cada error.
6. **Prueba.** Abre `https://xook-ia.<tu-subdominio>.workers.dev/salud`. Debe decir `{"ok":true,"cache":true}`.
7. **Avísale a Claude la dirección.** Claude la pone en `CONFIG.AI_URL` (en `src/app.js`), vuelve a armar la página y la publica.
