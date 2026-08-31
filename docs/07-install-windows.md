# 07 — Instalar no Windows

O painel e o script usam **Python 3**. Sem pip extra.

## 1. Instalar o Python

1. Abra [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/)
2. Baixe a versão **Windows installer (64-bit)**
3. **Marque “Add python.exe to PATH”** no primeiro ecrã. Sem isso o resto falha.
4. Install Now
5. Abra o **Prompt de Comando** (cmd) e rode:

```bat
python --version
```

Tem que aparecer `Python 3.x`.

## 2. Baixar o pack

Se tiver Git:

```bat
git clone git@github.com:caionorder/telegram.git
cd telegram
copy .env.example .env
```

Se não tiver Git: no GitHub → Code → Download ZIP → extraia → abra essa pasta.

Edite o `.env` no Bloco de Notas. Troque `ADMIN_PASSWORD=mude-isto`.

## 3. Subir o painel

Dê dois cliques em `scripts\start-windows.bat`

Ou no cmd, **dentro da pasta do repo**:

```bat
python painel\app.py
```

Navegador: [http://127.0.0.1:8787](http://127.0.0.1:8787)  
Usuário `admin` · senha do `.env`.

Deixe a janela do cmd **aberta**. Fechou = painel e aprovação param.

## 4. Subir sozinho no login

Agendador de Tarefas do Windows — receita em [08-daemon-e-cron.md](08-daemon-e-cron.md).
