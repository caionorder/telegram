#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
HTML="$DIR/slides.html"
PDF="$ROOT/JOINADS-Treinamento-Admin-Grupos.pdf"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PDF" "file://$HTML"

echo "PDF: $PDF"
ls -la "$PDF"
