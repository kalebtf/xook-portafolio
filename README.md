# Xook IA · Mérida

Software con inteligencia artificial para negocios de Yucatán y México.
*AI software for small and medium businesses in Yucatán and Mexico.*

**Demo en vivo:** página de portafolio con 6 demos que funcionan (`index.html`).
Ábrela en cualquier navegador; las respuestas con IA usan ejemplos pre-escritos cuando no hay IA disponible.

## Demos

| Demo | Para quién | Qué resuelve | Tecnología |
|---|---|---|---|
| Reseñas y web bilingüe | Restaurantes, hoteles, tours | Contesta reseñas de Google en español o inglés; web ES/EN | LLM + plantilla web |
| Bandeja CFDI | Despachos contables | Lee XML CFDI 4.0, clasifica gastos, detecta errores (sin timbre, otro RFC, PPD, S01) | Parser XML exacto en el navegador |
| Cobranza amable | Distribuidoras B2B | Antigüedad de saldos, recordatorios que suben de tono, opción BAJA | Reglas + LLM opcional |
| Pregúntale a tus manuales | Empresas medianas | Respuestas solo con el manual, citando la sección | Búsqueda por palabras + LLM (basado en DocuBot) |
| Fichas de inmuebles | Inmobiliarias | Ficha para portales en español e inglés, sin inventar datos | LLM con salida JSON |
| Citas y recordatorios | Dentistas, clínicas | Agenda, confirmación y recordatorio por WhatsApp | Lógica de agenda |

## Carpetas

- `index.html` — la página de portafolio y los demos (un solo archivo, sin servidor). `src/pagina.html` es la misma página en formato de artifact de Claude.
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
