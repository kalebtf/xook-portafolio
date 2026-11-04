"""Arma index.html a partir de las piezas en src/.

Uso:  python src/build.py
Piezas: estilos.css (diseño), cuerpo.html (contenido), app.js (demos).
"""
from pathlib import Path

SRC = Path(__file__).parent
ROOT = SRC.parent
SITE_URL = "https://kalebtf.github.io/xook-portafolio/"
TITLE = "Xook IA Mérida"
DESC = ("Software con inteligencia artificial para negocios de Mérida y México: reseñas en inglés, "
        "facturas CFDI, cobranza, manuales, inmuebles y citas. Pruébalo gratis.")
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='8' fill='%230D5C61'/%3E%3Ctext x='16' y='23' "
           "text-anchor='middle' font-family='Arial' font-weight='800' font-size='19' fill='white'%3EX%3C/text%3E%3C/svg%3E")

head = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#0D5C61">
<link rel="icon" href="{FAVICON}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="Xook IA · Software con IA para negocios de Yucatán">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}">
<meta property="og:image" content="{SITE_URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}
body{{margin:0}}
"""

html = (head
        + (SRC / "estilos.css").read_text(encoding="utf-8")
        + "\n</style>\n</head>\n<body>\n"
        + (SRC / "cuerpo.html").read_text(encoding="utf-8")
        + "\n<script>\n" + (SRC / "app.js").read_text(encoding="utf-8") + "</script>\n</body>\n</html>\n")
(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"index.html listo: {len(html):,} bytes")

# Versión para artifact de Claude: sin <html>/<head>; la plataforma pone el esqueleto.
artifact = (f'<title>{TITLE}</title>\n<meta name="description" content="{DESC}">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">\n'
            "<style>\n" + (SRC / "estilos.css").read_text(encoding="utf-8") + "\n</style>\n"
            + (SRC / "cuerpo.html").read_text(encoding="utf-8")
            + "\n<script>\n" + (SRC / "app.js").read_text(encoding="utf-8") + "</script>\n")
(SRC / "pagina.html").write_text(artifact, encoding="utf-8")
print(f"src/pagina.html (artifact) lista: {len(artifact):,} bytes")
