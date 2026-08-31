@echo off
cd /d "%~dp0.."
echo JOINADS Telegram
echo Painel: http://127.0.0.1:8787
echo Usuario: admin  (senha no arquivo .env)
python painel\app.py
if errorlevel 1 python3 painel\app.py
pause
