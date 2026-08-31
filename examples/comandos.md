# Comandos — @rh_amanda / Empregos On-line

Dry-run (padrão): imprime o JSON, **não envia**.

```bash
cd joinads-treinamento-admin-grupos

# 1) Aceite + particular
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao

# 2) Texto + botão no grupo
python3 scripts/rh_amanda.py grupo-texto \
    --chat -1001234567890 \
    --texto "Nova vaga aberta: Atendente home office. Candidatura pelo botão." \
    --botao "Ver vaga" \
    --link "https://empregos.exemplo/vaga/atendente"

# 3) Vídeo + botão no grupo
python3 scripts/rh_amanda.py grupo-video \
    --chat -1001234567890 \
    --video ./vaga-atendente.mp4 \
    --titulo "Vaga: Atendente — home office" \
    --subtitulo "Salário + comissão. Vagas limitadas nesta semana." \
    --botao "Candidatar-se" \
    --link "https://empregos.exemplo/vaga/atendente"
```

## Enviar de verdade

```bash
cp .env.example .env   # cole BOT_TOKEN=
set -a && source .env && set +a

python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao \
    --go
```

`--go` só em grupo de teste.

## API crua (quadro)

```bash
# Aceite
curl -s "https://api.telegram.org/bot$BOT_TOKEN/approveChatJoinRequest" \
  -d chat_id=-1001234567890 \
  -d user_id=111222333

# Particular (DEPOIS)
curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -d chat_id=111222333 \
  --data-urlencode text="Oi, João! Sou a Amanda do RH. Sua entrada no grupo Empregos On-line já foi aprovada."

# Texto + botão no grupo
curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -d chat_id=-1001234567890 \
  --data-urlencode text="Nova vaga: Atendente home office." \
  -d disable_web_page_preview=true \
  --data-urlencode reply_markup='{"inline_keyboard":[[{"text":"Candidatar-se","url":"https://empregos.exemplo/vaga/atendente"}]]}'
```

Caption de vídeo: `--form-string`. Nunca `-F` no texto.
