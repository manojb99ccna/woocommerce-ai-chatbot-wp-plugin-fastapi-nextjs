# Backend AI Service (FastAPI)

## Overview
This service is the “brain” for the WooCommerce AI customer support system.

- Exposes `POST /chat` for chat replies.
- Detects escalation (human request, refund, angry message).
- On escalation, posts a webhook to Make.com.

## Run (Windows PowerShell)
From `backend-ai-service/`:

```powershell
./venv/Scripts/python.exe -m pip install -r requirements.txt
./venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment
Create a `.env` file in `backend-ai-service/` or set environment variables in your shell.

Required:
- `OPENAI_API_KEY`

Optional:
- `MAKE_WEBHOOK_URL`
- `OPENAI_MODEL`
- `ALLOWED_ORIGINS`
- `DB_ENABLED`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_TABLE_PREFIX`
