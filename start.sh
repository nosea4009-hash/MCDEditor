#!/usr/bin/env bash
# Levanta el editor MCD en localhost.
# Uso:  ./start.sh   (o:  bash start.sh)
# Luego abre http://localhost:8000 en tu navegador.

PORT="${1:-8000}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==============================================="
echo "  Editor MCD - Discusiones de Mesoescala"
echo "==============================================="
echo "  Sirviendo: $DIR"
echo "  Abre en tu navegador:  http://localhost:$PORT"
echo "  (Ctrl+C para detener)"
echo "==============================================="

cd "$DIR" || exit 1

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  npx --yes serve -l "$PORT" .
else
  echo "No encontré python ni npx. Instala Python 3 o Node.js para servir la carpeta."
  echo "Alternativa: abre index.html directamente en el navegador (doble clic)."
  exit 1
fi
