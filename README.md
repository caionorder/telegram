# JOINADS — Administração de grupos Telegram

Treinamento interno. Repositório privado: [caionorder/telegram](https://github.com/caionorder/telegram).

| Peça | Nome |
|------|------|
| Grupo | **Empregos On-line** (privado) |
| Bot | **@rh_amanda_bot** (Amanda RH) |
| Painel | http://127.0.0.1:8787 · SQLite local |

Fluxo: **criar bot e grupo → aceite sozinho → particular → JSON (texto / foto / vídeo + link)**.

---

## Começar (Mac)

```bash
git clone git@github.com:caionorder/telegram.git
cd telegram
cp .env.example .env          # troque ADMIN_PASSWORD
./scripts/start-mac.sh        # http://127.0.0.1:8787
```

Instalação completa: [docs/06-install-macos.md](docs/06-install-macos.md)

## Começar (Windows)

1. Instale Python e **marque Add to PATH** — [docs/07-install-windows.md](docs/07-install-windows.md)
2. `copy .env.example .env`
3. Dois cliques em `scripts\start-windows.bat`

Login: `admin` / senha do `.env`.

---

## O que o time usa no dia a dia

O **painel** (`python3 painel/app.py`):

- Cadastra **bots** (token BotFather)
- Cadastra **canais** (chat_id, boas-vindas `{name}`, JSON)
- **Liga a aprovação** (processo vivo — não é cron de 1 min)
- **Envia o JSON agora** (texto / foto / vídeo, sempre com link)

Banco: arquivo `data/app.sqlite`. Sem Postgres.

JSON de exemplo: [`content/vagas.exemplo.json`](content/vagas.exemplo.json)  
Padrão: [docs/09-json-padrao.md](docs/09-json-padrao.md)

Aprovação sozinha (LaunchAgent / Agendador): [docs/08-daemon-e-cron.md](docs/08-daemon-e-cron.md)

---

## CLI (opcional)

```bash
python3 scripts/rh_amanda.py aprovar --chat -100… --user 111 --nome Joao
```

Sem `--go` só imprime. [scripts/README.md](scripts/README.md)

---

## Docs

| Arquivo | Assunto |
|---------|---------|
| [00-criar-bot-e-canal.md](docs/00-criar-bot-e-canal.md) | BotFather + grupo fechado |
| [06-install-macos.md](docs/06-install-macos.md) | Python no Mac |
| [07-install-windows.md](docs/07-install-windows.md) | Python no Windows |
| [08-daemon-e-cron.md](docs/08-daemon-e-cron.md) | Por que não cron de 1 min |
| [09-json-padrao.md](docs/09-json-padrao.md) | text / photo / video + buttons |
| [10-painel.md](docs/10-painel.md) | UI local |

Apresentação: `apresentacao/slides.html` · PDF na raiz.

---

Uso interno JOINADS, LLC. Não encaminhar pra publisher.
