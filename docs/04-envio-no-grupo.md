# 04 — Envio no grupo (texto / vídeo / link)

O grupo é o mural de vagas. Cada post tem **conteúdo + botão**.

## Formatos

| Comando | O que sobe |
|---------|------------|
| `grupo-texto` | Texto + botão Ver vaga / Candidatar-se |
| `grupo-video` | Vídeo + legenda + o mesmo botão |

O botão aponta pra ficha da vaga. Não promete “vídeo completo” — quem já está no grupo já viu o clipe.

## Script

```bash
python3 scripts/rh_amanda.py grupo-texto \
    --chat -1001234567890 \
    --texto "Nova vaga: Atendente home office. Candidatura pelo botão." \
    --botao "Ver vaga" \
    --link "https://empregos.exemplo/vaga/atendente"

python3 scripts/rh_amanda.py grupo-video \
    --chat -1001234567890 \
    --video ./vaga-atendente.mp4 \
    --titulo "Vaga: Atendente — home office" \
    --subtitulo "Salário + comissão. Vagas limitadas nesta semana." \
    --botao "Candidatar-se" \
    --link "https://empregos.exemplo/vaga/atendente"
```

## Caption de vídeo

Use `--form-string` no texto. **Não** use `-F` no caption: o curl lê `<b>` como arquivo e o post sai mudo.

## O que o time não faz

- Postar na mão “pra não ficar vazio” se o horário automático já cobre
- Encaminhar o mesmo vídeo em vários grupos no feeling
- Trocar o link do botão sem ordem
