#!/usr/bin/env python3
"""Instala/remove a agenda JSON no cron do usuário (Mac/Linux) ou Agendador (Windows).

Os horários continuam no painel (SQLite). O sistema só acorda o tick a cada minuto.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TICK = ROOT / "scripts" / "agenda_tick.py"
PY = sys.executable
MARK_S = "# BEGIN JOINADS-TELEGRAM-AGENDA"
MARK_E = "# END JOINADS-TELEGRAM-AGENDA"
LAUNCH = Path.home() / "Library/LaunchAgents/com.joinads.telegram-agenda.plist"
LABEL = "com.joinads.telegram-agenda"
WIN_TASK = "JOINADS-Telegram-Agenda"


def _run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def status() -> dict:
    plat = sys.platform
    if plat == "darwin":
        loaded = _run(["launchctl", "list", LABEL]).returncode == 0
        exists = LAUNCH.is_file()
        cron = MARK_S in (_run(["crontab", "-l"]).stdout or "")
        installed = loaded or exists or cron
        how = "LaunchAgent" if (loaded or exists) else ("crontab" if cron else "nenhum")
        return {"installed": installed, "how": how, "detail": str(LAUNCH) if exists else how, "os": "mac"}
    if plat.startswith("win"):
        r = _run(["schtasks", "/Query", "/TN", WIN_TASK])
        return {
            "installed": r.returncode == 0,
            "how": "Agendador de Tarefas",
            "detail": WIN_TASK if r.returncode == 0 else "",
            "os": "windows",
        }
    cron = MARK_S in (_run(["crontab", "-l"]).stdout or "")
    return {"installed": cron, "how": "crontab", "detail": "crontab -l" if cron else "", "os": "linux"}


def _cron_line() -> str:
    return f"* * * * * cd {ROOT} && {PY} {TICK} >> {ROOT}/data/agenda.log 2>&1"


def _strip_cron(text: str) -> str:
    lines = text.splitlines()
    out, skip = [], False
    for ln in lines:
        if ln.strip() == MARK_S:
            skip = True
            continue
        if ln.strip() == MARK_E:
            skip = False
            continue
        if not skip:
            out.append(ln)
    return "\n".join(out).rstrip() + "\n"


def _write_crontab(body: str) -> None:
    p = _run(["crontab", "-"], input=body)
    if p.returncode != 0:
        raise RuntimeError(p.stderr or "crontab falhou")


def install() -> dict:
    if not TICK.is_file():
        raise RuntimeError(f"faltando {TICK}")
    plat = sys.platform
    if plat == "darwin":
        LAUNCH.parent.mkdir(parents=True, exist_ok=True)
        LAUNCH.write_text(
            f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{PY}</string>
    <string>{TICK}</string>
  </array>
  <key>WorkingDirectory</key><string>{ROOT}</string>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>{ROOT}/data/agenda.log</string>
  <key>StandardErrorPath</key><string>{ROOT}/data/agenda.log</string>
</dict>
</plist>
"""
        )
        uid = os.getuid()
        _run(["launchctl", "bootout", f"gui/{uid}/{LABEL}"])
        p = _run(["launchctl", "bootstrap", f"gui/{uid}", str(LAUNCH)])
        if p.returncode != 0 and "already" not in (p.stderr or "").lower():
            # fallback cron
            raw = _run(["crontab", "-l"]).stdout or ""
            body = _strip_cron(raw) + f"\n{MARK_S}\n{_cron_line()}\n{MARK_E}\n"
            _write_crontab(body)
            return status()
        return status()
    if plat.startswith("win"):
        tr = f'"{PY}" "{TICK}"'
        p = _run(
            [
                "schtasks", "/Create", "/F",
                "/TN", WIN_TASK,
                "/SC", "MINUTE", "/MO", "1",
                "/TR", tr,
            ]
        )
        if p.returncode != 0:
            raise RuntimeError(p.stderr or p.stdout or "schtasks falhou")
        return status()
    raw = _run(["crontab", "-l"]).stdout or ""
    body = _strip_cron(raw) + f"\n{MARK_S}\n{_cron_line()}\n{MARK_E}\n"
    _write_crontab(body)
    return status()


def uninstall() -> dict:
    plat = sys.platform
    if plat == "darwin":
        uid = os.getuid()
        _run(["launchctl", "bootout", f"gui/{uid}/{LABEL}"])
        if LAUNCH.is_file():
            LAUNCH.unlink()
        raw = _run(["crontab", "-l"]).stdout or ""
        if MARK_S in raw:
            _write_crontab(_strip_cron(raw))
        return status()
    if plat.startswith("win"):
        _run(["schtasks", "/Delete", "/F", "/TN", WIN_TASK])
        return status()
    raw = _run(["crontab", "-l"]).stdout or ""
    if MARK_S in raw:
        _write_crontab(_strip_cron(raw))
    return status()
