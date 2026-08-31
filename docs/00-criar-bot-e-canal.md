# 00 — Criar o bot (BotFather) e o grupo fechado

Antes de aceitar membro, mandar particular ou postar vaga, existem **duas peças** que o time monta no Telegram. Sem elas o script não tem onde falar.

| Peça | Neste treino |
|------|----------------|
| Bot | Nome **Amanda RH** · username **@rh_amanda_bot** |
| Grupo | **Empregos On-line** · privado · com pedido de entrada |

Regra dura do Telegram: **username de bot termina em `bot`**. `@rh_amanda` o BotFather recusa. O nome que a pessoa vê pode ser “Amanda RH”; o @ é `@rh_amanda_bot`.

---

## 1. Criar o bot no BotFather

1. No Telegram, busque **@BotFather** (selo azul). Abra o chat.
2. Envie `/start`, depois `/newbot`.
3. **Nome** (o que aparece no perfil): `Amanda RH`
4. **Username** (único, 5–32 caracteres, só letra/número/`_`, **termina em bot**): `rh_amanda_bot`
5. O BotFather devolve um **token** no formato `123456789:AAH...`. Isso é a senha do bot.

Se o username estiver ocupado: `rh_amanda_rh_bot`, `amanda_rh_joinads_bot`, etc. Continua precisando terminar em `bot`.

### Token — o que fazer e o que não fazer

- Cola no `.env` local: `BOT_TOKEN=...`
- **Não** manda no WhatsApp do time, **não** commita no Git, **não** cola no slide.
- Quem tem o token **manda mensagem como o bot**. Se vazar, no BotFather: `/revoke` e gera outro.

### Ajustes úteis no BotFather

Depois de criado, `/mybots` → o bot → Bot Settings:

| Comando | Valor neste treino |
|---------|-------------------|
| `/setjoingroups` | **Enable** — senão você não adiciona o bot no grupo |
| `/setdescription` | “RH do grupo Empregos On-line.” |
| `/setuserpic` | Foto da Amanda (opcional) |
| `/setprivacy` | **Disable** se o bot precisar ler mensagem no grupo. Só pra aprovar + postar, o padrão serve |

---

## 2. Criar o grupo fechado

Canal e grupo **privado** aceitam pedido de entrada. Neste treino: **grupo**.

1. Telegram → lápis / Nova mensagem → **Novo grupo**.
2. Nome: `Empregos On-line`. Cria (pode pular membros).
3. Toque no nome do grupo → **Editar** / Administrar.
4. Tipo: **Privado**. Sem @público. Não aparece na busca.
5. Permissões / Privacidade → **Aprovar novos membros = ligado**.  
   Sem isso o pedido **não chega** no bot. A pessoa ou entra direto, ou fica no limbo.

### Link de convite (o certo)

O link que o Telegram mostra em “Compartilhar” costuma ser o **principal** — muita vez **entra direto**, e o bot não vê.

1. Grupo → Editar → **Links de convite** → Criar link.
2. Liga **Pedir aprovação** / “Request admin approval” / “Aprovar novos membros”.
3. Copia o `t.me/+……`. **Só esse** vai no anúncio e no botão.

---

## 3. Colocar o bot como admin

1. Grupo → Administradores → Adicionar → busque `@rh_amanda_bot`.
2. Marque no mínimo:

| Permissão | Precisa? |
|-----------|----------|
| Convidar usuários via link | **Sim** — sem isso não aprova pedido |
| Enviar / postar mensagens | **Sim** — sem isso não publica vaga |
| Excluir mensagens | Recomendado |
| Alterar informações do grupo | Não |

3. Salva. O bot tem que aparecer na lista de admins.

Se o Telegram recusar adicionar: BotFather → `/setjoingroups` → Enable, tenta de novo.

---

## 4. Pegar o ID do grupo (`--chat`)

Grupo privado **não** tem `@`. O ID é um número `-100…`.

Com o bot **já admin**, no grupo manda qualquer mensagem (ou peça pra entrar com o link de pedido). Depois:

```bash
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getUpdates" | python3 -m json.tool
```

Procure `"chat": { "id": -1001234567890`. Esse valor é o `--chat` do script.

---

## 5. Checklist antes do `--go`

- [ ] Bot criado, username termina em `bot`
- [ ] Token só no `.env` (não no Git)
- [ ] `/setjoingroups` Enable
- [ ] Grupo **privado**
- [ ] **Aprovar novos membros** ligado
- [ ] Link `t.me/+` **com pedido** (não o principal)
- [ ] Bot **admin** com convidar + postar
- [ ] `--chat` é `-100…`
- [ ] Dry-run do script ok, **aí** `--go` em grupo de teste

A partir daqui: [02 — Aceite](02-aceite-de-membros.md).
