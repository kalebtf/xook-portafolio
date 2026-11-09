# Checklist de producción · Pilón

**Para qué sirve:** antes de instalar cualquier herramienta a un cliente, revisamos esta lista. Es lo que separa un demo de una app por la que alguien paga.
Basado en los 10 puntos de "Cómo vender tu app hecha con Claude" (Enrique Rocha, TikTok, nov. 2026), más 4 puntos propios para negocios en México.

Leyenda: ✅ hecho · 🟡 parcial · ⬜ pendiente · — no aplica todavía

| # | Punto | Sitio de demos (hoy) | Productos para clientes (citas, cobranza, reseñas) |
|---|---|---|---|
| 1 | **Código comprimido, sin source maps, sin llaves en el navegador** | ✅ `build.py` comprime JS y CSS con esbuild; no hay source maps; la llave de Anthropic solo vive como secreto en Cloudflare; `.env` está en `.gitignore`. El repositorio es público a propósito (portafolio). | Mismo armado. Las llaves de cada cliente (WhatsApp, Google) van como secretos del servidor y nunca en la página. |
| 2 | **Candado de datos por usuario** (nadie ve datos ajenos) | — Sin base de datos; los archivos que sube el visitante no salen de su navegador. | ⬜ Cada registro lleva `cliente_id`; cada consulta filtra por el cliente que inició sesión; hay pruebas que intentan leer datos de otro cliente y deben fallar. |
| 3 | **Control de versiones** | ✅ Git + GitHub, con un commit por cambio. ✅ 144 pruebas automáticas (celular y PC) antes de publicar. | ⬜ Rama `main` (producción) + rama de pruebas; etiqueta de versión en cada entrega; forma de regresar a la versión anterior en 1 minuto. |
| 4 | **Buenas conexiones (APIs)** | 🟡 Excel, ZIP del SAT, Word/PDF, ligas a WhatsApp y Google Calendar, archivo .ics. | ⬜ Google Calendar API, WhatsApp Cloud API, Google Business Profile API (en enero), correo transaccional. |
| 5 | **Hosting y despliegue** | ✅ GitHub Pages (público). 🟡 Servidor de IA escrito, sin activar. | ⬜ Cloudflare Workers + D1 (base de datos), con dominio propio. |
| 6 | **Seguridad** (que no te vacíen la cuenta) | 🟡 El servidor acepta solo 4 tareas fijas y solo responde a nuestro sitio. ⬜ Tope de gasto mensual en Anthropic (pendiente de Kaleb). | ⬜ Inicio de sesión para el dueño del negocio; tope de gasto por cliente; secretos rotables. |
| 7 | **Límite de solicitudes** | ✅ Programado: 25 respuestas por persona al día y 600 en total (se activa con el KV `LIMITES`). | ⬜ Límite por cliente y por número de WhatsApp. |
| 8 | **Caché** (que no vaya lenta) | ✅ Fotos ligeras (960 px) en tarjetas; librerías pesadas que se cargan solo al usarse; ✅ caché de respuestas de IA por 7 días. | ⬜ Caché de horarios disponibles y de consultas frecuentes. |
| 9 | **Escalabilidad** (1,000 usuarios) | ✅ Página estática en CDN; los Workers escalan solos. | ⬜ Prueba de carga antes del primer cliente grande; índices en la base de datos. |
| 10 | **Monitoreo** (saber qué se rompe) | 🟡 El servidor registra cada solicitud y cada error (Workers Logs). | ⬜ Aviso por correo o WhatsApp si hay errores seguidos o si el gasto diario pasa un tope; revisión semanal de uso y costo. |
| 11 | **Privacidad (México)** | ⬜ Aviso de privacidad en el sitio. | ⬜ Aviso de privacidad y contrato de tratamiento de datos para cada cliente (revisarlos con un abogado). |
| 12 | **Respaldos** | — | ⬜ Respaldo diario de la base de datos; probar una restauración al mes. |
| 13 | **Pruebas automáticas** | ✅ 144 pruebas de inicio a fin. | ⬜ Las mismas, más pruebas del servidor (incluido el candado de datos del punto 2). |
| 14 | **Factura y términos** | — | ⬜ RFC y facturación (contador); términos del servicio y del piloto de 2 semanas. |

## Antes de entregar a un cliente
- [ ] Todos los puntos aplicables en ✅
- [ ] Probado con datos reales del cliente en la versión de pruebas
- [ ] Tope de gasto configurado y aviso de errores probado
- [ ] El cliente aprobó por escrito el aviso de privacidad y el alcance del piloto
