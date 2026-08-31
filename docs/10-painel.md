# 10 — Painel local

Sim: um visual pra o time cadastrar canal, bot, boas-vindas e JSON. Sem Postgres, sem Docker. **SQLite** em `data/app.sqlite`.

## O que é

| | |
|--|--|
| URL | http://127.0.0.1:8787 |
| Login | `ADMIN_USER` / `ADMIN_PASSWORD` no `.env` (padrão admin / mude-isto) |
| Banco | arquivo SQLite, no disco |
| Python | só a stdlib. Zero pip |

## Telas

1. **Canais** — nome, chat_id −100…, bot, texto de boas-vindas (`{name}`), URL/arquivo JSON, enviar agora
2. **Bots** — nome, @username, token
3. **JSON / envio** — o padrão dos três tipos
4. **Aprovação** — liga/desliga o daemon (getUpdates)
5. **Logs** — aceite, DM, send, erro

## Subir

Mac: `./scripts/start-mac.sh`  
Windows: `scripts\start-windows.bat`

Não exponha na internet. É `127.0.0.1`. Senha no `.env`, não no Git.
