# 09 — Padrão JSON de conteúdo

O canal no painel tem um campo **JSON**: caminho no repo (`content/vagas.exemplo.json`) ou **URL** (`https://…/vagas.json`).

O painel lê e publica. **Todo post leva `buttons` com `url`.** Sem botão o envio recusa.

## Formato

```json
{
  "version": 1,
  "posts": [
    {
      "type": "text",
      "text": "Nova vaga: Atendente home office.",
      "buttons": [{ "text": "Candidatar-se", "url": "https://empregos.exemplo/vaga/atendente" }]
    },
    {
      "type": "photo",
      "photo": "https://exemplo.com/foto.jpg",
      "caption": "Vaga: Atendente — home office",
      "buttons": [{ "text": "Ver vaga", "url": "https://empregos.exemplo/vaga/atendente" }]
    },
    {
      "type": "video",
      "video": "https://exemplo.com/video.mp4",
      "caption": "Veja o dia a dia. Candidate-se no botão.",
      "buttons": [{ "text": "Candidatar-se", "url": "https://empregos.exemplo/vaga/atendente" }]
    }
  ]
}
```

| type | Campos | Telegram |
|------|--------|----------|
| `text` | `text` + `buttons` | sendMessage |
| `photo` | `photo` (URL) + `caption` + `buttons` | sendPhoto |
| `video` | `video` (URL) + `caption` + `buttons` | sendVideo |

`photo` e `video` neste treino são **URL**. O Telegram baixa. Arquivo local grande fica pro `rh_amanda.py grupo-video`.

## Arquivo de exemplo

`content/vagas.exemplo.json` — os três tipos, todos com link.

No canal: JSON = `content/vagas.exemplo.json`  
Ou hospeda o mesmo JSON e cola a URL.

## Enviar — agora ou na agenda

**Manual:** Canais → **Enviar JSON agora**.

**Agenda (no painel):** no canal, liga **Agenda ligada** e põe os horários (`08,11,14,17,20`). O relógio é **deste computador**. Em cada hora o painel:

1. Lê o JSON de novo (arquivo ou URL — se você atualizou, pega o novo)
2. Publica os posts com botão
3. Marca a hora como enviada. Não manda de novo na mesma hora.

O processo é o **mesmo** `python3 painel/app.py`. Sem o painel aberto, a agenda **não** roda. LaunchAgent / Agendador no login mantém isso vivo.

Uma vez por canal por hora. “Enviar agora” não gasta o slot da agenda.
