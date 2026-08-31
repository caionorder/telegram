# 08 — Aprovação sozinha: daemon, não cron de 1 min

## O erro clássico

“Coloca no cron a cada 1 minuto.”

No Telegram isso é **errado** pra aceite:

- O método `getUpdates` é um **fio contínuo**. Duas cópias = erro **409** e pedido perdido.
- 1 minuto de espera = gente na fila. A regra do treino é **pediu → entrou na hora**.

O que precisa rodar sozinho é um **processo vivo** (daemon): o painel com “Ligar aprovação”, ou `python3 painel/app.py` sempre aberto.

Cron / Agendador / LaunchAgent servem só pra **subir de novo** se a máquina reiniciar.

---

## No painel

1. Cadastra bot + canal (boas-vindas + chat_id)
2. Canais → ativo
3. Aprovação → **Ligar aprovação**
4. Deixa o painel aberto (ou sobe no login, abaixo)

O processo faz `getUpdates` (espera de ~20s). Pedido chega → `approveChatJoinRequest` → `sendMessage` no particular.

---

## Mac — LaunchAgent (sobe no login)

Arquivo: `~/Library/LaunchAgents/com.joinads.telegram-painel.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.joinads.telegram-painel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>/CAMINHO/COMPLETO/telegram/painel/app.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/CAMINHO/COMPLETO/telegram</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key>
  <string>/tmp/joinads-telegram.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/joinads-telegram.err</string>
</dict>
</plist>
```

```bash
# troque o python3 se `which python3` for outro
launchctl load ~/Library/LaunchAgents/com.joinads.telegram-painel.plist
```

`KeepAlive` = se cair, o Mac sobe de novo. Isso **substitui** cron.

---

## Windows — Agendador

1. Agendador de Tarefas → Criar tarefa
2. Geral: “Executar estando o usuário conectado”, nome `JOINADS Telegram`
3. Disparador: **Ao fazer logon**
4. Ação: Iniciar programa  
   Programa: `python`  
   Argumentos: `painel\app.py`  
   Iniciar em: `C:\CAMINHO\telegram`
5. Condições: desmarque “Iniciar somente se o computador estiver ligado na energia”

Não crie tarefa “a cada 1 minuto”.

---

## Cron (só watchdog, opcional)

Se o LaunchAgent/Agendador não for opção, um cron **raro** que só verifica se o processo existe:

```cron
*/5 * * * * pgrep -f painel/app.py >/dev/null || /usr/bin/python3 /CAMINHO/telegram/painel/app.py
```

Ainda assim o `app.py` precisa ficar **rodando**, não “executar e sair”.
