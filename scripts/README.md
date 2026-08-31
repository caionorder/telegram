# `rh_amanda.py`

Bot de treino **@rh_amanda_bot** no grupo **Empregos On-line**.

Três ações, nesta ordem mental:

| Comando | O que faz no Telegram | Quando usar |
|---------|------------------------|-------------|
| `aprovar` | Aceita o pedido **e depois** manda o particular | Alguém pediu pra entrar |
| `grupo-texto` | Texto + botão no grupo | Publicar vaga em texto |
| `grupo-video` | Vídeo + legenda + botão no grupo | Publicar vaga em vídeo |

Sem `--go` o script **só imprime** o JSON. Não chama a API. Esse é o modo de treino.

Python 3.9+ · só biblioteca padrão (e `curl` no `grupo-video --go`).

Antes de ligar o bot no grupo: [`../docs/00-criar-bot-e-canal.md`](../docs/00-criar-bot-e-canal.md) (BotFather + grupo fechado).

---

## Setup

```bash
cd telegram          # raiz deste repositório
cp .env.example .env
# cole o token do BotFather em BOT_TOKEN=
```

O script lê `BOT_TOKEN` do ambiente. Se existir `.env` na raiz, ele carrega sozinho.

```bash
python3 scripts/rh_amanda.py -h
python3 scripts/rh_amanda.py aprovar -h
```

---

## 1. Aceitar membro + particular

Ordem **obrigatória** no código: `approveChatJoinRequest` primeiro, `sendMessage` depois.

Se a aprovação falhar, o particular **não** dispara.

```bash
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao
```

| Flag | Obrigatório | Significado |
|------|-------------|-------------|
| `--chat` | sim | ID do grupo (começa com `-100`) |
| `--user` | sim | `user_id` de quem pediu |
| `--nome` | sim | Primeiro nome (entra no texto da Amanda) |
| `--dm` | não | Chat do particular. Se vazio, usa `--user` |

Com token e certeza:

```bash
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao \
    --go
```

---

## 2. Texto + botão no grupo

```bash
python3 scripts/rh_amanda.py grupo-texto \
    --chat -1001234567890 \
    --texto "Nova vaga aberta: Atendente home office. Candidatura pelo botão." \
    --botao "Ver vaga" \
    --link "https://empregos.exemplo/vaga/atendente"
```

O botão é um `inline_keyboard` com URL. Padrão do botão: `Ver vaga`.

---

## 3. Vídeo + botão no grupo

```bash
python3 scripts/rh_amanda.py grupo-video \
    --chat -1001234567890 \
    --video ./vaga-atendente.mp4 \
    --titulo "Vaga: Atendente — home office" \
    --subtitulo "Salário + comissão. Vagas limitadas nesta semana." \
    --botao "Candidatar-se" \
    --link "https://empregos.exemplo/vaga/atendente"
```

Ou `--url https://…mp4` no lugar de `--video` (o Telegram baixa o arquivo).

**Caption:** o script usa `curl --form-string`. Não troque por `-F` — o curl trata `<b>` como caminho de arquivo e o post sai sem texto.

---

## Segurança

- Sem `--go` → dry-run. Sempre comece assim.
- `--go` sem `BOT_TOKEN` → o script recusa.
- `--go` só em **grupo de teste**, até o responsável mandar.
- Dois processos no mesmo token = Telegram **409**. Pedidos se perdem.

---

## Mapa da API

| Comando | Método Telegram |
|---------|-----------------|
| `aprovar` passo 1 | `approveChatJoinRequest` |
| `aprovar` passo 2 | `sendMessage` (particular) |
| `grupo-texto` | `sendMessage` + `reply_markup` |
| `grupo-video` | `sendVideo` + `reply_markup` |

Exemplos `curl` equivalentes: [`../examples/comandos.md`](../examples/comandos.md).
