# WooCommerce AI Chatbot (WP Plugin + FastAPI + Next.js Admin)

AI + human customer support for WooCommerce:

- WordPress floating chat widget (plugin)
- FastAPI backend (OpenAI, MySQL, Make.com webhook)
- Next.js admin inbox/dashboard (human handoff, conversation logs)

## Components

- `frontend-wordpress/wp-content/plugins/ecom-ai-chatbot` — WordPress plugin
- `backend-ai-service` — FastAPI backend service
- `admin-nextjs` — Next.js admin dashboard
- `docs` — setup notes and Postman collections

## Quick Start (local)

1. Configure backend `.env` in `backend-ai-service/` (not committed).
2. Start backend:
   - `cd backend-ai-service`
   - `./venv/Scripts/uvicorn.exe app.main:app --host 127.0.0.1 --port 8000`
3. Start admin dashboard:
   - `cd admin-nextjs`
   - `npm install`
   - `npm run dev`

## API Docs

- Backend Swagger: http://127.0.0.1:8000/docs

