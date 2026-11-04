# Xook IA · Mérida

Software con inteligencia artificial para negocios de Yucatán y México.
*AI software for small and medium businesses in Yucatán and Mexico.*

**Sitio:** https://kalebtf.github.io/xook-portafolio/ con 6 demos que funcionan, con ilustraciones propias.
Sin el servidor de IA, los textos de IA son respuestas de muestra. Lo demás funciona de verdad en el navegador: lectura de CFDI, Excel de entrada y salida, cartera, citas y calendario.

## Demos

| Demo | Para quién | Qué resuelve | Tecnología |
|---|---|---|---|
| Reseñas y web bilingüe | Restaurantes, hoteles, tours | Contesta reseñas de Google en español o inglés; web ES/EN | LLM + plantilla web |
| Bandeja CFDI | Despachos contables | Lee XML CFDI 4.0 (pegado o subido), clasifica gastos, detecta errores (sin timbre, otro RFC, PPD, S01) y exporta a Excel | Parser XML exacto + SheetJS |
| Cobranza amable | Distribuidoras B2B | Sube tu Excel de cartera; antigüedad de saldos, recordatorios que suben de tono, opción BAJA, reporte en Excel | Reglas + SheetJS + LLM opcional |
| Pregúntale a tus manuales | Empresas medianas | Respuestas solo con el manual, citando la sección | Búsqueda por palabras + LLM (basado en DocuBot) |
| Fichas de inmuebles | Inmobiliarias | Ficha para portales en español e inglés, sin inventar datos | LLM con salida JSON |
| Citas y recordatorios | Dentistas, clínicas | Agenda, confirmación y recordatorio por WhatsApp; agrega la cita a Google Calendar o .ics | Lógica de agenda + iCalendar |

## Carpetas

- `index.html`: la página publicada. **No la edites a mano.** Se arma con `python src/build.py` a partir de:
  - `src/estilos.css` (diseño e ilustraciones), `src/cuerpo.html` (contenido) y `src/app.js` (demos; ahí está `CONFIG` con `AI_URL` y `WHATSAPP`).
  - `src/pagina.html`: la misma página en formato de artifact de Claude (también la genera `build.py`).
- `og.png`: la imagen que se ve al compartir la liga por WhatsApp o redes.
- `vendor/`: SheetJS 0.18.5 (Apache 2.0), para leer y escribir Excel en el navegador.
- `servidor-ia/`: Cloudflare Worker opcional que activa la IA en vivo en el sitio. Pasos en su README.
- `agente-correos/` — agente en Python que extrae datos de correos con Claude (tool use + Pydantic + SQLite) y su evaluación. Base de la Bandeja CFDI.
- `docs/` — investigación y guías: oportunidades en Mérida y México (español) y el plan de negocio (inglés).
- Proyecto relacionado: [DocuBot](https://github.com/kalebtf/docubot) — asistente RAG sobre documentos, evaluación 16/16.

## Correr el agente de correos

```powershell
cd agente-correos
python -m venv .venv
.venv\Scripts\activate
python -m pip install anthropic python-dotenv pydantic
# crea .env con ANTHROPIC_API_KEY=... (nunca se sube a GitHub)
python evaluate.py emails_test.json
```

Datos de ejemplo ficticios. RFC de prueba del SAT.
