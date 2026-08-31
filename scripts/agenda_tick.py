#!/usr/bin/env python3
"""Tick da agenda JSON. O cron/LaunchAgent/Agendador chama isto a cada minuto.

Os horários por canal estão no SQLite (painel). Este script só envia se for a hora
e ainda não tiver enviado hoje. Idempotente.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "painel"))

import app  # noqa: E402

if __name__ == "__main__":
    app.init_db()
    app.scheduler_tick()
