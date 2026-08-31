# JOINADS — Administração de grupos Telegram

Treinamento interno. Repositório: [caionorder/telegram](https://github.com/caionorder/telegram).

Exemplo didático (versão light):

| Peça | Nome |
|------|------|
| Grupo | **Empregos On-line** (privado) |
| Bot | **@rh_amanda** (Amanda, RH) |

A mecânica é a mesma da operação: **aceite → particular → texto / vídeo / link no grupo**.

---

## Começar

```bash
git clone git@github.com:caionorder/telegram.git
cd telegram

# 1. Ver a apresentação (Chrome, 16:9)
open apresentacao/slides.html

# 2. Rodar o script em dry-run (não envia nada)
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao
```

PDF institucional: [`JOINADS-Treinamento-Admin-Grupos.pdf`](JOINADS-Treinamento-Admin-Grupos.pdf)

---

## O que tem aqui

```
telegram/
├── README.md                                 ← você está aqui
├── JOINADS-Treinamento-Admin-Grupos.pdf      ← 16 slides, identidade JOINADS
├── apresentacao/
│   ├── slides.html                           ← mesmo deck, pra projetar
│   └── exportar-pdf.sh
├── docs/                                     ← texto completo, um tema por arquivo
│   ├── 01-visao-geral.md
│   ├── 02-aceite-de-membros.md
│   ├── 03-mensagem-particular.md
│   ├── 04-envio-no-grupo.md
│   └── 05-regras-e-falhas.md
├── scripts/
│   ├── README.md                             ← documentação do script
│   └── rh_amanda.py                          ← aprovar · grupo-texto · grupo-video
├── examples/comandos.md
└── brand/joinads-logo.png
```

---

## Script

Documentação completa: [`scripts/README.md`](scripts/README.md)

```bash
python3 scripts/rh_amanda.py aprovar     --chat -100… --user 111 --nome Joao
python3 scripts/rh_amanda.py grupo-texto --chat -100… --texto "…" --botao "Ver vaga" --link "…"
python3 scripts/rh_amanda.py grupo-video --chat -100… --video ./vaga.mp4 --titulo "…" --link "…"
```

Sem `--go` só imprime. Com `--go` envia (precisa `BOT_TOKEN` no `.env`).

```bash
cp .env.example .env
```

---

## Frase pra gravar

> A pessoa pede pra entrar, o bot aceita na hora, manda o particular, e o grupo trabalha sozinho com vaga + botão. Gente na fila, grupo mudo ou link errado: avisa agora.

---

## Identidade

Ink `#030b09` · verde JOINADS `#3CF26B` · pale `#F5FBF2`  
Logo sempre em fundo ink. JOINADS, LLC.

Uso interno. Não encaminhar pra publisher, mídia ou pessoa de fora.

Regenerar o PDF:

```bash
./apresentacao/exportar-pdf.sh
```
