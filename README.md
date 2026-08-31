# JOINADS — Administração de grupos Telegram

Treinamento interno. Exemplo didático:

| Peça | Nome |
|------|------|
| Empresa | JOINADS, LLC |
| Grupo | **Empregos On-line** (privado) |
| Bot | **@rh_amanda** (Amanda, RH) |

A mecânica é a mesma da operação: **aceite de membros → mensagem no particular → envio de texto / vídeo / link no grupo**.

---

## O que tem neste pack

```
joinads-treinamento-admin-grupos/
├── README.md                          ← você está aqui
├── JOINADS-Treinamento-Admin-Grupos.pdf
├── apresentacao/
│   ├── slides.html                    ← deck 16:9 (abrir no Chrome)
│   └── exportar-pdf.sh
├── docs/
│   ├── 01-visao-geral.md
│   ├── 02-aceite-de-membros.md
│   ├── 03-mensagem-particular.md
│   ├── 04-envio-no-grupo.md
│   └── 05-regras-e-falhas.md
├── scripts/
│   └── rh_amanda.py                   ← os 3 comandos
├── examples/
│   └── comandos.md
└── brand/
    └── joinads-logo.png
```

1. **PDF** — apresentação institucional (identidade JOINADS).
2. **HTML** — mesmo deck, pra projetar no time (`apresentacao/slides.html`).
3. **Docs** — texto completo, um arquivo por tema.
4. **Script** — `aprovar` · `grupo-video` · `grupo-texto`.

---

## Começar em 3 minutos

```bash
cd joinads-treinamento-admin-grupos
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao
```

Sem `--go` o script **só imprime** o que faria. Não manda nada no Telegram.

Quando o JSON estiver certo:

```bash
cp .env.example .env          # cole o token do @rh_amanda
# BOT_TOKEN=123:ABC
set -a && source .env && set +a

python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao \
    --go
```

`--go` só em **grupo de teste**, até o responsável mandar.

Os três comandos estão em [`examples/comandos.md`](examples/comandos.md).

---

## Frase pra gravar

> A pessoa pede pra entrar, o bot aceita na hora, manda o particular, e o grupo recebe vaga (texto / vídeo / link) com botão de candidatura. Gente na fila, grupo mudo ou link errado: avisa agora. Não “resolve no grupo” na mão.

---

## Identidade

Ink `#030b09` · verde JOINADS `#3CF26B` · pale `#F5FBF2`  
Logo sempre em fundo ink. JOINADS, LLC · uso interno.

*Material de treino. Não encaminhar pra publisher, mídia ou pessoa de fora.*
