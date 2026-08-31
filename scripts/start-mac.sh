#!/bin/bash
cd "$(dirname "$0")/.."
echo "JOINADS Telegram → http://127.0.0.1:8787"
echo "usuario: admin  (senha no .env)"
exec python3 painel/app.py
