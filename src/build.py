"""Arma index.html a partir de las piezas en src/.

Uso:  python src/build.py
Piezas: estilos.css (diseño), cuerpo.html (contenido), app.js (demos).
"""
from pathlib import Path
from PIL import Image
import minify  # comprime JS y CSS (sin source maps)
import sitios  # webs bilingües de demostración

SRC = Path(__file__).parent
ROOT = SRC.parent
SITE_URL = "https://kalebtf.github.io/xook-portafolio/"
TITLE = "Pilón · Software con IA para negocios de Mérida"
DESC = ("Software con inteligencia artificial para negocios de Mérida y México: reseñas en inglés, "
        "facturas CFDI, cobranza, manuales, inmuebles y citas. Pruébalo gratis.")
FONTS = ("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700"
         "&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap")
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='8' fill='%230D5C61'/%3E%3Ctext x='16' y='23' "
           "text-anchor='middle' font-family='Arial' font-weight='800' font-size='19' fill='white'%3EP%3C/text%3E%3C/svg%3E")

head = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#0B4F4A">
<link rel="icon" href="{FAVICON}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="Pilón · Software con IA para negocios de Yucatán">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}">
<meta property="og:image" content="{SITE_URL}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>
:root{{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}
body{{margin:0}}
"""

# ---------- Fotos: versión ligera (960 px) para tarjetas y encabezados de demos ----------
SMALL = ROOT / "img" / "s"; SMALL.mkdir(exist_ok=True)
for src in (ROOT / "img").glob("*.jpg"):
    dst = SMALL / src.name
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        im = Image.open(src).convert("RGB"); im.thumbnail((960, 960))
        im.save(dst, quality=78, optimize=True, progressive=True)
og_png, og_jpg = ROOT / "og.png", ROOT / "og.jpg"
if og_png.exists() and (not og_jpg.exists() or og_jpg.stat().st_mtime < og_png.stat().st_mtime):
    Image.open(og_png).convert("RGB").save(og_jpg, quality=85, optimize=True, progressive=True)

css = minify.css((SRC / "estilos.css").read_text(encoding="utf-8"))
js = minify.js((SRC / "app.js").read_text(encoding="utf-8"))
body = (SRC / "cuerpo.html").read_text(encoding="utf-8")

html = head + css + "\n</style>\n</head>\n<body>\n" + body + "\n<script>" + js + "</script>\n</body>\n</html>\n"
(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"index.html listo: {len(html):,} bytes")

# Versión para artifact de Claude: sin <html>/<head>; la plataforma pone el esqueleto.
artifact = (f'<title>{TITLE}</title>\n<meta name="description" content="{DESC}">\n'
            f'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="{FONTS}">\n'
            "<style>" + css + "</style>\n" + body + "\n<script>" + js + "</script>\n")
(SRC / "pagina.html").write_text(artifact, encoding="utf-8")
print(f"src/pagina.html (artifact) lista: {len(artifact):,} bytes")

sitios.build()
