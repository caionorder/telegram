# 06 — Instalar no Mac

O painel e o script usam **Python 3**. Sem pip extra.

## 1. Ver se já tem

Abra o **Terminal** (Spotlight → Terminal) e cole:

```bash
python3 --version
```

Se aparecer `Python 3.9` ou maior, pule para o passo 3.

## 2. Instalar

1. Abra [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Baixe o instalador **macOS**
3. Marque as opções padrão → Install
4. Feche e abra o Terminal de novo
5. `python3 --version`

No Mac com Homebrew: `brew install python`

## 3. Baixar o pack

```bash
git clone git@github.com:caionorder/telegram.git
cd telegram
cp .env.example .env
```

Edite `.env` e troque `ADMIN_PASSWORD=mude-isto`.

## 4. Subir o painel

```bash
chmod +x scripts/start-mac.sh
./scripts/start-mac.sh
```

Ou: `python3 painel/app.py`

Navegador: [http://127.0.0.1:8787](http://127.0.0.1:8787)  
Usuário `admin` · senha do `.env`.

## 5. Deixar a aprovação ligando sozinha (reinício)

A aprovação **não** é cron de 1 minuto. É o processo do painel (botão “Ligar aprovação”) ou o mesmo `python3 painel/app.py` sempre aberto.

Pra subir de novo se o Mac reiniciar, use **LaunchAgent**. Receita em [08-daemon-e-cron.md](08-daemon-e-cron.md).
