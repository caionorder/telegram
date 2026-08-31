#!/usr/bin/env python3
"""
Painel JOINADS — Telegram (treino)

Sobe em http://127.0.0.1:8787
  - login com ADMIN_USER / ADMIN_PASSWORD do .env
  - SQLite local (data/app.sqlite)
  - cadastro de bots, canais, JSON de conteúdo
  - daemon de aprovação (getUpdates) em thread

Zero pip. Python 3.9+.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
STATIC = Path(__file__).resolve().parent / "static"
DB = DATA / "app.sqlite"


def load_env() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "mude-isto")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8787"))
SECRET = hashlib.sha256((ADMIN_USER + ":" + ADMIN_PASSWORD).encode()).digest()


def db() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB, check_same_thread=False, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode=WAL")
    return con


def init_db() -> None:
    con = db()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL,
            token TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            bot_id INTEGER NOT NULL,
            welcome_text TEXT NOT NULL DEFAULT '',
            json_url TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS bot_offset (
            bot_id INTEGER PRIMARY KEY,
            offset INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            at TEXT NOT NULL,
            kind TEXT NOT NULL,
            channel_id INTEGER,
            detail TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS discovered_chats (
            bot_id INTEGER NOT NULL,
            chat_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            chat_type TEXT NOT NULL DEFAULT '',
            seen_at TEXT NOT NULL,
            PRIMARY KEY (bot_id, chat_id)
        );
        """
    )
    cols = [r[1] for r in con.execute("PRAGMA table_info(channels)").fetchall()]
    if "invite_link" not in cols:
        con.execute("ALTER TABLE channels ADD COLUMN invite_link TEXT NOT NULL DEFAULT ''")
    if "schedule" not in cols:
        con.execute("ALTER TABLE channels ADD COLUMN schedule TEXT NOT NULL DEFAULT '08,11,14,17,20'")
    if "schedule_on" not in cols:
        con.execute("ALTER TABLE channels ADD COLUMN schedule_on INTEGER NOT NULL DEFAULT 0")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS send_slots (
            channel_id INTEGER NOT NULL,
            day TEXT NOT NULL,
            hour TEXT NOT NULL,
            sent_at TEXT NOT NULL,
            PRIMARY KEY (channel_id, day, hour)
        )
        """
    )
    con.commit()
    con.close()


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def log_event(kind: str, detail: str, channel_id=None) -> None:
    con = db()
    con.execute(
        "INSERT INTO events(at, kind, channel_id, detail) VALUES (?,?,?,?)",
        (now(), kind, channel_id, detail[:2000]),
    )
    con.commit()
    con.close()


def rows(con, q, args=()):
    return [dict(r) for r in con.execute(q, args).fetchall()]


def sign(msg: str) -> str:
    return hmac.new(SECRET, msg.encode(), hashlib.sha256).hexdigest()


def make_session() -> str:
    exp = str(int(time.time()) + 86400)
    return f"{ADMIN_USER}:{exp}:{sign(ADMIN_USER + ':' + exp)}"


def valid_session(raw: str) -> bool:
    try:
        user, exp, sig = raw.split(":", 2)
    except ValueError:
        return False
    if user != ADMIN_USER or int(exp) < time.time():
        return False
    return hmac.compare_digest(sig, sign(user + ":" + exp))


def tg(token: str, method: str, payload: dict, timeout: int = 25) -> dict:
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = urllib.parse.urlencode(
        {k: v if isinstance(v, str) else json.dumps(v) for k, v in payload.items()}
    ).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except Exception:
            return {"ok": False, "description": str(e)}
    except Exception as e:
        return {"ok": False, "description": str(e)}


def remember_chat(bot_id: int, chat: dict) -> None:
    if not chat or chat.get("id") is None:
        return
    if chat.get("type") not in ("group", "supergroup", "channel"):
        return
    cid = str(chat["id"])
    title = chat.get("title") or cid
    con = db()
    con.execute(
        "INSERT INTO discovered_chats(bot_id, chat_id, title, chat_type, seen_at) VALUES(?,?,?,?,?) "
        "ON CONFLICT(bot_id, chat_id) DO UPDATE SET title=excluded.title, chat_type=excluded.chat_type, seen_at=excluded.seen_at",
        (bot_id, cid, title, chat.get("type") or "", now()),
    )
    con.commit()
    con.close()


def chat_from_update(u: dict):
    for key in ("message", "channel_post", "my_chat_member", "chat_member", "chat_join_request"):
        blob = u.get(key)
        if blob and isinstance(blob.get("chat"), dict):
            return blob["chat"]
    return None


def ingest_updates(bot: dict, updates: list) -> None:
    con = db()
    channels = rows(con, "SELECT * FROM channels WHERE bot_id=? AND active=1", (bot["id"],))
    con.close()
    by_chat = {str(c["chat_id"]): c for c in channels}
    for u in updates:
        chat = chat_from_update(u)
        if chat:
            remember_chat(bot["id"], chat)
        cj = u.get("chat_join_request")
        if not cj:
            continue
        chat_id = str(cj.get("chat", {}).get("id", ""))
        user_id = cj.get("from", {}).get("id")
        first = cj.get("from", {}).get("first_name") or ""
        ch = by_chat.get(chat_id)
        if not ch:
            log_event("discover", f"pedido em {cj.get('chat', {}).get('title') or chat_id} (ainda não cadastrado)")
            continue
        ok = tg(bot["token"], "approveChatJoinRequest", {"chat_id": chat_id, "user_id": user_id})
        if not ok.get("ok") and "already" not in str(ok.get("description", "")).lower():
            log_event("error", f"approve falhou {first}: {ok.get('description')}", ch["id"])
            continue
        log_event("approve", f"{first} → {ch['name']}", ch["id"])
        dm = cj.get("user_chat_id") or user_id
        text = (ch.get("welcome_text") or "").replace("{name}", first)
        if text:
            w = tg(bot["token"], "sendMessage", {"chat_id": dm, "text": text})
            if w.get("ok"):
                log_event("welcome", f"DM {first}", ch["id"])
            else:
                log_event("error", f"welcome {first}: {w.get('description')}", ch["id"])


ALLOWED = ["chat_join_request", "my_chat_member", "message", "channel_post"]


def poll_bot(bot: dict, timeout: int = 20) -> list:
    con = db()
    off = con.execute("SELECT offset FROM bot_offset WHERE bot_id=?", (bot["id"],)).fetchone()
    offset = int(off["offset"]) if off else 0
    con.close()
    res = tg(
        bot["token"],
        "getUpdates",
        {"offset": offset, "timeout": timeout, "allowed_updates": ALLOWED},
        timeout=timeout + 15,
    )
    if not res.get("ok"):
        log_event("error", f"getUpdates {bot['username']}: {res.get('description')}")
        return []
    updates = res.get("result") or []
    if updates:
        max_id = max(int(u.get("update_id", 0)) for u in updates) + 1
        con = db()
        con.execute(
            "INSERT INTO bot_offset(bot_id, offset) VALUES(?,?) "
            "ON CONFLICT(bot_id) DO UPDATE SET offset=excluded.offset",
            (bot["id"], max_id),
        )
        con.commit()
        con.close()
        ingest_updates(bot, updates)
    return updates


# ── daemon ──────────────────────────────────────────────────────────────────

_daemon_lock = threading.Lock()
_daemon_on = False
_daemon_status = "parado"


def daemon_loop() -> None:
    global _daemon_on, _daemon_status
    log_event("daemon", "aprovação ligada")
    while True:
        with _daemon_lock:
            if not _daemon_on:
                _daemon_status = "parado"
                log_event("daemon", "aprovação desligada")
                return
        con = db()
        bots = rows(con, "SELECT * FROM bots")
        channels = rows(con, "SELECT * FROM channels WHERE active=1")
        con.close()
        if not bots:
            _daemon_status = "ligado · nenhum bot"
            time.sleep(3)
            continue
        for bot in bots:
            _daemon_status = f"ligado · polling @{bot['username'].lstrip('@')}"
            poll_bot(bot, timeout=20)


def start_daemon() -> None:
    global _daemon_on, _daemon_status
    with _daemon_lock:
        if _daemon_on:
            return
        _daemon_on = True
        _daemon_status = "ligando"
    threading.Thread(target=daemon_loop, name="approve-daemon", daemon=True).start()


def stop_daemon() -> None:
    global _daemon_on
    with _daemon_lock:
        _daemon_on = False


def listed_chats(bot_id: int) -> list:
    con = db()
    found = rows(
        con,
        "SELECT chat_id, title, chat_type, seen_at FROM discovered_chats WHERE bot_id=? ORDER BY seen_at DESC",
        (bot_id,),
    )
    con.close()
    return found


def discover_bot(bot_id: int) -> list:
    """Cata grupos onde o bot já entrou. Sem o ID — o usuário só escolhe o nome."""
    con = db()
    bot = con.execute("SELECT * FROM bots WHERE id=?", (bot_id,)).fetchone()
    con.close()
    if not bot:
        raise ValueError("Bot não existe")
    bot = dict(bot)
    if not _daemon_on:
        poll_bot(bot, timeout=2)
    found = listed_chats(bot_id)
    log_event("discover", f"{bot['username']}: {len(found)} grupo(s) visto(s)")
    return found


def resolve_link(bot_id: int, link: str) -> dict:
    """@publico ou t.me/nome público. Link t.me/+ privado não tem ID — usa Detectar."""
    con = db()
    bot = con.execute("SELECT * FROM bots WHERE id=?", (bot_id,)).fetchone()
    con.close()
    if not bot:
        raise ValueError("Bot não existe")
    raw = (link or "").strip()
    if not raw:
        raise ValueError("Cola o @ ou o t.me/ do canal público")
    if "t.me/+" in raw or "telegram.me/+" in raw:
        raise ValueError(
            "Link t.me/+ (privado) não entrega o ID. Coloca o bot como admin no grupo, "
            "manda uma mensagem lá, depois Detectar grupos — aparece o nome na lista."
        )
    handle = raw
    handle = handle.replace("https://", "").replace("http://", "")
    handle = handle.replace("t.me/", "").replace("telegram.me/", "").strip("/")
    if not handle.startswith("@"):
        handle = "@" + handle
    res = tg(bot["token"], "getChat", {"chat_id": handle})
    if not res.get("ok"):
        raise ValueError(res.get("description") or "Não achei esse chat. Bot é admin?")
    chat = res["result"]
    remember_chat(bot["id"], chat)
    return {
        "chat_id": str(chat["id"]),
        "title": chat.get("title") or handle,
        "chat_type": chat.get("type") or "",
    }


def make_join_link(bot_id: int, chat_id: str) -> str:
    con = db()
    bot = con.execute("SELECT * FROM bots WHERE id=?", (bot_id,)).fetchone()
    con.close()
    if not bot:
        return ""
    res = tg(
        bot["token"],
        "createChatInviteLink",
        {"chat_id": chat_id, "creates_join_request": True, "name": "joinads"},
    )
    if res.get("ok"):
        return (res.get("result") or {}).get("invite_link") or ""
    return ""


# ── JSON send ───────────────────────────────────────────────────────────────

def load_json_source(src: str) -> dict:
    src = (src or "").strip()
    if not src:
        raise ValueError("Canal sem JSON (arquivo ou URL).")
    if src.startswith("http://") or src.startswith("https://"):
        req = urllib.request.Request(src, headers={"User-Agent": "JOINADS-Telegram/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    path = Path(src)
    if not path.is_absolute():
        path = ROOT / src
    return json.loads(path.read_text())


def buttons_markup(item: dict) -> dict:
    btns = item.get("buttons") or []
    if not btns:
        raise ValueError("Todo post precisa de buttons[].text e buttons[].url")
    row = []
    for b in btns:
        if not b.get("text") or not b.get("url"):
            raise ValueError("Botão sem text ou url")
        row.append({"text": b["text"], "url": b["url"]})
    return {"inline_keyboard": [row]}


def send_item(token: str, chat_id: str, item: dict) -> dict:
    kind = item.get("type")
    markup = json.dumps(buttons_markup(item))
    if kind == "text":
        return tg(
            token,
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": item.get("text") or "",
                "disable_web_page_preview": True,
                "reply_markup": markup,
            },
        )
    if kind == "photo":
        return tg(
            token,
            "sendPhoto",
            {
                "chat_id": chat_id,
                "photo": item["photo"],
                "caption": item.get("caption") or "",
                "reply_markup": markup,
            },
        )
    if kind == "video":
        return tg(
            token,
            "sendVideo",
            {
                "chat_id": chat_id,
                "video": item["video"],
                "caption": item.get("caption") or "",
                "reply_markup": markup,
            },
        )
    raise ValueError(f"type desconhecido: {kind} (use text, photo ou video)")


def send_channel_json(channel_id: int) -> dict:
    con = db()
    ch = con.execute("SELECT * FROM channels WHERE id=?", (channel_id,)).fetchone()
    if not ch:
        con.close()
        raise ValueError("Canal não existe")
    bot = con.execute("SELECT * FROM bots WHERE id=?", (ch["bot_id"],)).fetchone()
    con.close()
    if not bot:
        raise ValueError("Bot do canal não existe")
    payload = load_json_source(ch["json_url"])
    posts = payload.get("posts")
    if not isinstance(posts, list) or not posts:
        raise ValueError("JSON precisa de posts: []")
    sent, errors = [], []
    for i, item in enumerate(posts, 1):
        try:
            res = send_item(bot["token"], ch["chat_id"], item)
            if res.get("ok"):
                sent.append(i)
                log_event("send", f"{item.get('type')} #{i} → {ch['name']}", channel_id)
            else:
                errors.append(f"#{i} {res.get('description')}")
                log_event("error", f"send #{i}: {res.get('description')}", channel_id)
        except Exception as e:
            errors.append(f"#{i} {e}")
            log_event("error", f"send #{i}: {e}", channel_id)
    return {"sent": sent, "errors": errors, "total": len(posts)}


def parse_hours(raw: str) -> list:
    out = []
    for part in (raw or "").replace(";", ",").split(","):
        p = part.strip()
        if not p:
            continue
        if p.isdigit():
            out.append(f"{int(p):02d}")
    return out


def scheduler_tick() -> None:
    """Uma vez por hora, por canal com agenda. Relê o JSON na hora (arquivo ou URL)."""
    day = time.strftime("%Y-%m-%d")
    hour = time.strftime("%H")
    con = db()
    chans = rows(con, "SELECT * FROM channels WHERE active=1 AND schedule_on=1")
    con.close()
    for ch in chans:
        hours = parse_hours(ch.get("schedule") or "")
        if hour not in hours:
            continue
        con = db()
        done = con.execute(
            "SELECT 1 FROM send_slots WHERE channel_id=? AND day=? AND hour=?",
            (ch["id"], day, hour),
        ).fetchone()
        con.close()
        if done:
            continue
        try:
            result = send_channel_json(ch["id"])
            con = db()
            con.execute(
                "INSERT OR IGNORE INTO send_slots(channel_id, day, hour, sent_at) VALUES(?,?,?,?)",
                (ch["id"], day, hour, now()),
            )
            con.commit()
            con.close()
            log_event(
                "schedule",
                f"{hour}h {ch['name']}: {len(result.get('sent') or [])}/{result.get('total')}",
                ch["id"],
            )
        except Exception as e:
            log_event("error", f"agenda {hour}h {ch['name']}: {e}", ch["id"])


def scheduler_loop() -> None:
    log_event("schedule", "agenda JSON ligada (relógio do computador)")
    while True:
        try:
            scheduler_tick()
        except Exception as e:
            log_event("error", f"agenda: {e}")
        time.sleep(20)


def agenda_status() -> list:
    day = time.strftime("%Y-%m-%d")
    hour = time.strftime("%H")
    con = db()
    chans = rows(con, "SELECT id,name,schedule,schedule_on,json_url FROM channels ORDER BY id")
    slots = rows(con, "SELECT channel_id, hour, sent_at FROM send_slots WHERE day=?", (day,))
    con.close()
    sent_map = {}
    for s in slots:
        sent_map.setdefault(s["channel_id"], []).append(s["hour"])
    out = []
    for c in chans:
        hours = parse_hours(c.get("schedule") or "")
        out.append(
            {
                **c,
                "hours": hours,
                "sent_today": sent_map.get(c["id"], []),
                "now_hour": hour,
                "due_now": hour in hours and c.get("schedule_on") and hour not in sent_map.get(c["id"], []),
            }
        )
    return out


# ── HTTP ────────────────────────────────────────────────────────────────────

def json_body(handler) -> dict:
    n = int(handler.headers.get("Content-Length") or 0)
    if n == 0:
        return {}
    return json.loads(handler.rfile.read(n).decode() or "{}")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _cookie(self) -> str:
        c = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = c.get("session")
        return morsel.value if morsel else ""

    def auth(self) -> bool:
        return valid_session(self._cookie())

    def send_json(self, code: int, obj, set_cookie=None, clear=False):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if set_cookie:
            self.send_header(
                "Set-Cookie",
                f"session={set_cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400",
            )
        if clear:
            self.send_header("Set-Cookie", "session=; Path=/; Max-Age=0")
        self.end_headers()
        self.wfile.write(raw)

    def send_file(self, path: Path, ctype: str):
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self.send_file(STATIC / "index.html", "text/html; charset=utf-8")
        if path == "/app.js":
            return self.send_file(STATIC / "app.js", "application/javascript; charset=utf-8")
        if path == "/styles.css":
            return self.send_file(STATIC / "styles.css", "text/css; charset=utf-8")
        if path == "/logo.png":
            return self.send_file(ROOT / "brand" / "joinads-logo.png", "image/png")
        if path == "/api/me":
            return self.send_json(200, {"ok": self.auth(), "user": ADMIN_USER if self.auth() else None})
        if not self.auth():
            return self.send_json(401, {"ok": False, "error": "login"})
        con = db()
        try:
            if path == "/api/bots":
                bots = rows(con, "SELECT id,name,username,created_at FROM bots ORDER BY id")
                return self.send_json(200, {"ok": True, "bots": bots})
            if path == "/api/channels":
                ch = rows(
                    con,
                    "SELECT c.*, b.name AS bot_name, b.username AS bot_username "
                    "FROM channels c JOIN bots b ON b.id=c.bot_id ORDER BY c.id",
                )
                return self.send_json(200, {"ok": True, "channels": ch})
            if path == "/api/events":
                ev = rows(con, "SELECT * FROM events ORDER BY id DESC LIMIT 80")
                return self.send_json(200, {"ok": True, "events": ev})
            if path == "/api/daemon":
                return self.send_json(
                    200, {"ok": True, "on": _daemon_on, "status": _daemon_status}
                )
            if path == "/api/agenda":
                try:
                    from syscron import status as cron_status
                    cron = cron_status()
                except Exception as e:
                    cron = {"installed": False, "how": "", "detail": str(e)}
                return self.send_json(200, {"ok": True, "channels": agenda_status(), "cron": cron})
            if path == "/api/discovered":
                q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                bot_id = int((q.get("bot_id") or ["0"])[0])
                return self.send_json(200, {"ok": True, "chats": listed_chats(bot_id)})
        finally:
            con.close()
        self.send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = json_body(self)
        if path == "/api/login":
            u, p = body.get("user", ""), body.get("password", "")
            if hmac.compare_digest(u, ADMIN_USER) and hmac.compare_digest(p, ADMIN_PASSWORD):
                return self.send_json(200, {"ok": True}, set_cookie=make_session())
            return self.send_json(401, {"ok": False, "error": "usuário ou senha"})
        if path == "/api/logout":
            return self.send_json(200, {"ok": True}, clear=True)
        if not self.auth():
            return self.send_json(401, {"ok": False, "error": "login"})
        con = db()
        try:
            if path == "/api/bots":
                con.execute(
                    "INSERT INTO bots(name,username,token,created_at) VALUES(?,?,?,?)",
                    (body["name"], body["username"], body["token"], now()),
                )
                con.commit()
                return self.send_json(200, {"ok": True})
            if path == "/api/channels":
                invite = make_join_link(int(body["bot_id"]), str(body["chat_id"]))
                con.execute(
                    "INSERT INTO channels(name,chat_id,bot_id,welcome_text,json_url,active,created_at,invite_link,schedule,schedule_on) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (
                        body["name"],
                        str(body["chat_id"]),
                        int(body["bot_id"]),
                        body.get("welcome_text") or "",
                        body.get("json_url") or "",
                        1 if body.get("active", True) else 0,
                        now(),
                        invite,
                        body.get("schedule") or "08,11,14,17,20",
                        1 if body.get("schedule_on") else 0,
                    ),
                )
                con.commit()
                return self.send_json(200, {"ok": True, "invite_link": invite})
            if path == "/api/channels/update":
                con.execute(
                    "UPDATE channels SET name=?, chat_id=?, bot_id=?, welcome_text=?, json_url=?, active=?, schedule=?, schedule_on=? WHERE id=?",
                    (
                        body["name"],
                        str(body["chat_id"]),
                        int(body["bot_id"]),
                        body.get("welcome_text") or "",
                        body.get("json_url") or "",
                        1 if body.get("active", True) else 0,
                        body.get("schedule") or "08,11,14,17,20",
                        1 if body.get("schedule_on") else 0,
                        int(body["id"]),
                    ),
                )
                con.commit()
                return self.send_json(200, {"ok": True})
            if path == "/api/channels/send":
                try:
                    result = send_channel_json(int(body["id"]))
                    return self.send_json(200, {"ok": True, **result})
                except Exception as e:
                    return self.send_json(400, {"ok": False, "error": str(e)})
            if path == "/api/daemon/start":
                start_daemon()
                return self.send_json(200, {"ok": True, "status": _daemon_status})
            if path == "/api/daemon/stop":
                stop_daemon()
                return self.send_json(200, {"ok": True})
            if path == "/api/discover":
                try:
                    chats = discover_bot(int(body["bot_id"]))
                    return self.send_json(200, {"ok": True, "chats": chats})
                except Exception as e:
                    return self.send_json(400, {"ok": False, "error": str(e)})
            if path == "/api/resolve":
                try:
                    chat = resolve_link(int(body["bot_id"]), body.get("link") or "")
                    return self.send_json(200, {"ok": True, **chat})
                except Exception as e:
                    return self.send_json(400, {"ok": False, "error": str(e)})
            if path == "/api/agenda/install":
                try:
                    from syscron import install as cron_install
                    return self.send_json(200, {"ok": True, "cron": cron_install()})
                except Exception as e:
                    return self.send_json(400, {"ok": False, "error": str(e)})
            if path == "/api/agenda/uninstall":
                try:
                    from syscron import uninstall as cron_uninstall
                    return self.send_json(200, {"ok": True, "cron": cron_uninstall()})
                except Exception as e:
                    return self.send_json(400, {"ok": False, "error": str(e)})
        finally:
            con.close()
        self.send_json(404, {"ok": False, "error": "not found"})

    def do_DELETE(self):
        if not self.auth():
            return self.send_json(401, {"ok": False, "error": "login"})
        path = urllib.parse.urlparse(self.path).path
        con = db()
        try:
            if path.startswith("/api/bots/"):
                con.execute("DELETE FROM bots WHERE id=?", (int(path.rsplit("/", 1)[1]),))
                con.commit()
                return self.send_json(200, {"ok": True})
            if path.startswith("/api/channels/"):
                con.execute("DELETE FROM channels WHERE id=?", (int(path.rsplit("/", 1)[1]),))
                con.commit()
                return self.send_json(200, {"ok": True})
        finally:
            con.close()
        self.send_json(404, {"ok": False})


def main() -> None:
    init_db()
    STATIC.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=scheduler_loop, name="json-agenda", daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"JOINADS Telegram  →  http://{HOST}:{PORT}")
    print(f"login  {ADMIN_USER}  /  senha do .env (ADMIN_PASSWORD)")
    print("Agenda JSON: ligada enquanto o painel estiver aberto (relógio desta máquina)")
    print("Ctrl+C para parar")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nparado")


if __name__ == "__main__":
    main()
