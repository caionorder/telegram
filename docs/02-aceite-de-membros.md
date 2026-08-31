# 02 — Aceite de membros

A pessoa toca no link e **não entra**. Fica em “aguardando aprovação”.

## Ordem obrigatória

```
1. approveChatJoinRequest(chat_id, user_id)   ← PRIMEIRO
2. sendMessage(particular, texto da Amanda)   ← DEPOIS
```

Se o particular falhar (candidato bloqueou o bot), a pessoa **ainda entra**. Welcome não pode barrar o aceite.

Meta: pediu → entrou em segundos. Quase 100%. Pedido perdido **não volta sozinho**.

## O que o time faz

- Nada, se estiver fluido.
- Fila de pendentes: **aprova agora** e avisa (“X pendentes no Empregos On-line”).

## O que o time não faz

- Desligar “Aprovar novos membros”
- Tornar o grupo público / colocar @
- Revogar o link sem ordem
- Compartilhar o link principal (entra direto, o bot não vê)
- Subir segundo bot no mesmo token (Telegram 409, pedidos se perdem)
- Aprovar “pra ajudar” quando o bot está saudável

## Script

```bash
python3 scripts/rh_amanda.py aprovar \
    --chat -1001234567890 \
    --user 111222333 \
    --nome Joao
```

Dry-run por padrão. `--go` envia.
