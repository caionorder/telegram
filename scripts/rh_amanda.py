#!/usr/bin/env python3
"""
Exemplo LIGHT — administração de grupo Telegram
Grupo: Empregos On-line
Bot:   @rh_amanda  (Amanda, RH)

Três ações:

  1. aprovar      → aceita o pedido de entrada + manda boas-vindas no particular
  2. grupo-video  → manda vídeo da vaga + botão no grupo
  3. grupo-texto  → manda texto / link da vaga no grupo

Por padrão é DRY-RUN (só imprime). Pra enviar de verdade:  --go

Uso:
  export BOT_TOKEN="token_do_bot_rh_amanda"

  python3 scripts/rh_amanda.py aprovar \\
      --chat -1001234567890 \\
      --user 111222333 \\
      --nome Joao

  python3 scripts/rh_amanda.py grupo-video \\
      --chat -1001234567890 \\
      --video ./vaga-atendente.mp4 \\
      --titulo "Vaga: Atendente — home office" \\
      --subtitulo "Salário + comissão. Vagas limitadas nesta semana." \\
      --botao "Candidatar-se" \\
      --link "https://empregos.exemplo/vaga/atendente"

  python3 scripts/rh_amanda.py grupo-texto \\
      --chat -1001234567890 \\
      --texto "Nova vaga aberta: Atendente home office. Candidatura pelo botão." \\
      --botao "Ver vaga" \\
      --link "https://empregos.exemplo/vaga/atendente"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

GRUPO = "Empregos On-line"
BOT = "@rh_amanda"
RH = "Amanda"

API = "https://api.telegram.org/bot{token}/{method}"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def load_env() -> None:
    """Lê .env na raiz do repo (BOT_TOKEN=...). Não sobrescreve o que já está no ambiente."""
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    with open(path) as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


def tg(token: str, method: str, payload: dict, dry: bool) -> dict:
    url = API.format(token=token, method=method)
    print(f"\n→ {method}")
    print(json.dumps(payload, ensure_ascii=False, indent=2)[:900])
    if dry:
        print("(dry-run — não enviou. Passe --go pra executar.)")
        return {"ok": True, "dry_run": True}
    data = urllib.parse.urlencode(
        {k: v if isinstance(v, str) else json.dumps(v) for k, v in payload.items()}
    ).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode())
    print("←", json.dumps(out, ensure_ascii=False)[:400])
    return out


def welcome_text(name: str) -> str:
    return (
        f"Oi, {name}! 👋\n\n"
        f"Sou a {RH} do RH. Sua entrada no grupo *{GRUPO}* já foi aprovada — "
        "você já está dentro.\n\n"
        "Pra eu te avisar das próximas vagas no WhatsApp (se o grupo sair do ar), "
        "me manda seu número com DDI.\n\n"
        "📱 Exemplo:\n"
        "+55 11 99391-1111 (Brasil)\n"
        "+595 981 123456 (Paraguai)\n\n"
        "Assim que chegar uma vaga nova, eu te chamo. Até lá, fica de olho no grupo."
    )


def cmd_aprovar(args, token: str, dry: bool) -> None:
    """Ordem: APROVA primeiro, DEPOIS manda o particular."""
    print(f"Bot {BOT}  |  grupo {GRUPO}")
    ok = tg(
        token,
        "approveChatJoinRequest",
        {"chat_id": args.chat, "user_id": args.user},
        dry,
    )
    if not ok.get("ok") and not dry:
        print("ERRO: aprovação falhou. Não manda particular. Tenta de novo.")
        sys.exit(1)

    dm = args.dm or args.user
    tg(token, "sendMessage", {"chat_id": dm, "text": welcome_text(args.nome)}, dry)
    print(f"\nPronto: {args.nome} aprovado no {GRUPO} + boas-vindas no particular.")


def cmd_grupo_video(args, token: str, dry: bool) -> None:
    caption = f"<b>{args.titulo}</b>\n\n{args.subtitulo}"
    markup = {"inline_keyboard": [[{"text": args.botao, "url": args.link}]]}

    if dry:
        print(f"Bot {BOT}  |  grupo {GRUPO}")
        print("\n→ sendVideo")
        print(json.dumps({
            "chat_id": args.chat,
            "video": args.video or args.url,
            "caption": caption,
            "parse_mode": "HTML",
            "reply_markup": markup,
        }, ensure_ascii=False, indent=2))
        print("(dry-run — não enviou. Passe --go pra executar.)")
        return

    import subprocess

    cmd = [
        "curl", "-sS", "--http1.1", "-4", "--max-time", "90",
        API.format(token=token, method="sendVideo"),
        "--form-string", f"chat_id={args.chat}",
        "--form-string", f"caption={caption}",
        "--form-string", "parse_mode=HTML",
        "--form-string", f"reply_markup={json.dumps(markup)}",
    ]
    if args.url:
        cmd += ["--form-string", f"video={args.url}"]
    elif args.video:
        cmd += ["-F", f"video=@{args.video}"]
    else:
        print("ERRO: passe --video arquivo.mp4  OU  --url https://...")
        sys.exit(1)

    out = subprocess.check_output(cmd, text=True)
    print("←", out[:400])


def cmd_grupo_texto(args, token: str, dry: bool) -> None:
    print(f"Bot {BOT}  |  grupo {GRUPO}")
    markup = {"inline_keyboard": [[{"text": args.botao, "url": args.link}]]}
    tg(
        token,
        "sendMessage",
        {
            "chat_id": args.chat,
            "text": args.texto,
            "disable_web_page_preview": True,
            "reply_markup": markup,
        },
        dry,
    )


def main() -> None:
    load_env()
    p = argparse.ArgumentParser(
        prog="rh_amanda.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=f"{BOT} no grupo {GRUPO} — aceite, particular e envio no grupo.",
        epilog=(
            "Sem --go o script só imprime o JSON (treino).\n"
            "Com --go envia de verdade — precisa BOT_TOKEN no ambiente ou no .env.\n"
            "Documentação: scripts/README.md"
        ),
    )
    p.add_argument("--go", action="store_true", help="Envia de verdade. Sem isso, só mostra.")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("aprovar", help="Aceita o pedido + manda boas-vindas no particular")
    a.add_argument("--chat", required=True, help="ID do grupo Empregos On-line")
    a.add_argument("--user", required=True, help="user_id de quem pediu pra entrar")
    a.add_argument("--dm", default="", help="chat do particular (se vazio, usa --user)")
    a.add_argument("--nome", required=True, help="primeiro nome do candidato")

    v = sub.add_parser("grupo-video", help="Manda vídeo da vaga + botão no grupo")
    v.add_argument("--chat", required=True)
    v.add_argument("--video", default="", help="arquivo local .mp4")
    v.add_argument("--url", default="", help="URL do vídeo")
    v.add_argument("--titulo", required=True)
    v.add_argument("--subtitulo", required=True)
    v.add_argument("--botao", default="Candidatar-se")
    v.add_argument("--link", required=True)

    t = sub.add_parser("grupo-texto", help="Manda texto + botão/link da vaga no grupo")
    t.add_argument("--chat", required=True)
    t.add_argument("--texto", required=True)
    t.add_argument("--botao", default="Ver vaga")
    t.add_argument("--link", required=True)

    args = p.parse_args()
    token = os.environ.get("BOT_TOKEN", "").strip()
    if args.go and not token:
        print("ERRO: export BOT_TOKEN=...  (token do @rh_amanda)")
        sys.exit(1)
    if not token:
        token = "TOKEN_DO_RH_AMANDA"

    dry = not args.go
    if args.cmd == "aprovar":
        cmd_aprovar(args, token, dry)
    elif args.cmd == "grupo-video":
        cmd_grupo_video(args, token, dry)
    elif args.cmd == "grupo-texto":
        cmd_grupo_texto(args, token, dry)


if __name__ == "__main__":
    main()
