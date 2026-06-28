#!/usr/bin/env python3
"""Combina index.html + CSS + JS en un solo archivo HTML autónomo."""
import re, pathlib

base = pathlib.Path(__file__).parent
html = (base / "index.html").read_text(encoding="utf-8")
css = (base / "css" / "styles.css").read_text(encoding="utf-8")

# Inline CSS
html = html.replace(
    '<link rel="stylesheet" href="css/styles.css" />',
    f"<style>\n{css}\n</style>",
)

# Inline JS files in order
for js in ["geometry", "fronts", "shapes", "editor", "main"]:
    code = (base / "js" / f"{js}.js").read_text(encoding="utf-8")
    html = html.replace(
        f'<script src="js/{js}.js"></script>',
        f"<script>\n{code}\n</script>",
    )

out = base / "mcd-editor-standalone.html"
out.write_text(html, encoding="utf-8")
print(f"OK -> {out}  ({len(html)} bytes)")
# sanity: ensure no external refs remain
leftover = re.findall(r'(?:src|href)="(?:js/|css/)[^"]+"', html)
print("Referencias externas restantes:", leftover if leftover else "ninguna")
