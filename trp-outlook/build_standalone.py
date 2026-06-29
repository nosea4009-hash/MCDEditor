#!/usr/bin/env python3
"""
build_standalone.py — TRP Meteorología (Editor de Outlooks)

Genera un único archivo HTML autocontenido (`trp-outlook-standalone.html`)
embebiendo el CSS y todo el JavaScript propio del proyecto dentro del HTML,
para que puedas abrirlo con doble clic sin necesidad de un servidor local.

Las librerías Leaflet y Turf, y los límites de países (Natural Earth), siguen
cargándose por CDN (el navegador las cachea tras la primera carga, así que
luego el modo "Vectorial personalizado" funciona también sin conexión).

Uso:
    python3 build_standalone.py

Opcional — versión 100% offline (descarga e incrusta Leaflet, Turf y los
límites de países dentro del HTML). Requiere internet al construir:
    python3 build_standalone.py --offline
"""

import os
import re
import sys
import json

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "trp-outlook-standalone.html")

JS_ORDER = ["js/topojson-mini.js", "js/citydata.js", "js/fallback-geo.js", "js/app.js"]
CSS_FILE = "css/styles.css"

LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
TURF_JS = "https://unpkg.com/@turf/turf@6/turf.min.js"
GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"


def read(path):
    with open(os.path.join(HERE, path), "r", encoding="utf-8") as f:
        return f.read()


def fetch(url):
    """Descarga texto desde una URL (solo para --offline)."""
    try:
        from urllib.request import urlopen, Request
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8")
    except Exception as e:
        print("  ! No se pudo descargar %s (%s)" % (url, e))
        return None


def build(offline=False):
    html = read("index.html")
    css = read(CSS_FILE)

    # 1) Inline del CSS propio
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css" />',
        "<style>\n%s\n</style>" % css,
    )

    # 2) Inline del JavaScript propio
    for src in JS_ORDER:
        code = read(src)
        tag = '<script src="%s"></script>' % src
        html = html.replace(tag, "<script>\n%s\n</script>" % code)

    note = "Mi código va embebido; Leaflet/Turf/datos por CDN."

    if offline:
        print("Modo OFFLINE: descargando librerías y datos…")
        lcss = fetch(LEAFLET_CSS)
        ljs = fetch(LEAFLET_JS)
        tjs = fetch(TURF_JS)
        geo = fetch(GEO_URL)
        if all([lcss, ljs, tjs, geo]):
            # CSS de Leaflet (las imágenes de marcador quedan por CDN igualmente)
            html = re.sub(
                r'<link rel="stylesheet" href="%s"[^>]*>' % re.escape(LEAFLET_CSS),
                "<style>\n%s\n</style>" % lcss, html)
            html = re.sub(
                r'<script src="%s"[^>]*></script>' % re.escape(LEAFLET_JS),
                "<script>\n%s\n</script>" % ljs, html)
            html = re.sub(
                r'<script src="%s"[^>]*></script>' % re.escape(TURF_JS),
                "<script>\n%s\n</script>" % tjs, html)
            # Datos de países pre-incrustados: la app los usa si existe window.__TRP_GEO__
            inject = "<script>window.__TRP_GEO__=%s;</script>" % geo
            html = html.replace("</head>", inject + "\n</head>")
            note = "TODO embebido (offline real). Los fondos satélite/calle siguen necesitando internet."
        else:
            print("  ! Falló alguna descarga. Genero la versión por CDN.")

    banner = "<!-- TRP Meteorología — archivo autocontenido. %s -->\n" % note
    html = "<!-- Generado por build_standalone.py -->\n" + banner + html

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print("OK -> %s  (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024.0))


if __name__ == "__main__":
    build(offline=("--offline" in sys.argv))
