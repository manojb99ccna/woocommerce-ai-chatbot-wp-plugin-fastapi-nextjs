from __future__ import annotations

import json
import hashlib
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.params import Header, Path as PathParam, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
import httpx

from app.core.config import settings
from app.schemas import AgentReplyRequest, ChatRequest, ChatResponse, EscalationRequest, EscalationResponse, PollResponse
from app.services.fallback import generate_fallback
from app.services.escalation import detect_escalation
from app.services import db as db_service
from app.services.make_webhook import post_make_webhook
from app.services.openai_client import build_messages, generate_reply
from app.services.openai_client import proxy_reply


logger = logging.getLogger("backend_ai_service")
chat_logger = logging.getLogger("chat_logger")
openai_logger = logging.getLogger("openai_logger")
make_logger = logging.getLogger("make_logger")


def _configure_file_logging() -> None:
    base_dir = Path(__file__).resolve().parents[1].parent
    logs_dir = base_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    if not chat_logger.handlers:
        chat_handler = RotatingFileHandler(logs_dir / "chat.txt", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        chat_handler.setFormatter(fmt)
        chat_logger.setLevel(logging.INFO)
        chat_logger.addHandler(chat_handler)
        chat_logger.propagate = False

    if not openai_logger.handlers:
        openai_handler = RotatingFileHandler(logs_dir / "openai.txt", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        openai_handler.setFormatter(fmt)
        openai_logger.setLevel(logging.INFO)
        openai_logger.addHandler(openai_handler)
        openai_logger.propagate = False

    if not make_logger.handlers:
        make_handler = RotatingFileHandler(logs_dir / "make.txt", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        make_handler.setFormatter(fmt)
        make_logger.setLevel(logging.INFO)
        make_logger.addHandler(make_handler)
        make_logger.propagate = False

    if not logger.handlers:
        app_handler = RotatingFileHandler(logs_dir / "app.txt", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
        app_handler.setFormatter(fmt)
        logger.setLevel(logging.INFO)
        logger.addHandler(app_handler)
        logger.propagate = False


def _pretty(obj: object) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:
        return str(obj)


def _openai_request_url() -> str:
    return "https://api.openai.com/v1/chat/completions"


def _mask_bearer(token: str | None) -> str:
    t = (token or "").strip()
    if not t:
        return "Bearer <empty>"
    digest = hashlib.sha256(t.encode("utf-8")).hexdigest()[:12]
    if len(t) <= 12:
        return "Bearer " + t + f" (len={len(t)} sha256={digest})"
    return "Bearer " + t[:6] + "..." + t[-4:] + f" (len={len(t)} sha256={digest})"


def _extract_http_status_from_error(err: str) -> int | None:
    m = re.search(r"\bError code:\s*(\d{3})\b", err or "")
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _openai_postman_style_log(*, request_id: str, session_id: str, model: str, request_body: dict, response_body: dict | None, error_message: str | None, reply: str) -> str:
    status = 200 if error_message is None else (_extract_http_status_from_error(error_message) or 0)
    headers = {
        "Authorization": _mask_bearer(settings.openai_api_key),
        "Content-Type": "application/json",
    }
    lines = []
    lines.append("REQUEST")
    lines.append("METHOD: POST")
    lines.append("URL: " + _openai_request_url())
    lines.append("REQUEST_ID: " + request_id)
    lines.append("SESSION_ID: " + session_id)
    lines.append("MODEL: " + model)
    lines.append("")
    lines.append("HEADERS:")
    lines.append(_pretty(headers))
    lines.append("")
    lines.append("BODY:")
    lines.append(_pretty(request_body))
    lines.append("")
    lines.append("RESPONSE")
    lines.append("STATUS: " + (str(status) if status else "N/A"))
    lines.append("")
    lines.append("BODY:")
    if response_body is not None:
        lines.append(_pretty(response_body))
    else:
        lines.append(_pretty({"error_message": error_message or "Unknown"}))
    lines.append("")
    lines.append("REPLY:")
    lines.append(reply)
    lines.append("")
    return "\n".join(lines)

def _openai_proxy_postman_style_log(*, request_id: str, session_id: str, model: str, request_body: dict, response_body: dict | None, reply: str) -> str:
    headers = {"Content-Type": "application/json"}
    lines = []
    lines.append("REQUEST (PROXY)")
    lines.append("METHOD: POST")
    lines.append("URL: " + (settings.openai_proxy_url or "N/A"))
    lines.append("REQUEST_ID: " + request_id)
    lines.append("SESSION_ID: " + session_id)
    lines.append("MODEL: " + model)
    lines.append("")
    lines.append("HEADERS:")
    lines.append(_pretty(headers))
    lines.append("")
    lines.append("BODY:")
    lines.append(_pretty(request_body))
    lines.append("")
    lines.append("RESPONSE (PROXY)")
    lines.append("")
    lines.append("BODY:")
    lines.append(_pretty(response_body if response_body is not None else {"response": "N/A"}))
    lines.append("")
    lines.append("REPLY:")
    lines.append(reply)
    lines.append("")
    return "\n".join(lines)


def _admin_link(conversation_uid: str) -> str:
    base = (settings.admin_dashboard_base_url or "").rstrip("/")
    if not base:
        return "N/A"
    return f"{base}/conversations/u/{conversation_uid}"


def _admin_allowed(token: str | None) -> bool:
    expected = (settings.admin_api_token or "").strip()
    if not expected:
        return False
    return (token or "").strip() == expected


def create_app() -> FastAPI:
    _configure_file_logging()
    logger.info("service_start")
    application = FastAPI(
        title="WooCommerce AI Customer Support",
        version="0.1.0",
        openapi_tags=[
            {"name": "health", "description": "Service and dependency checks"},
            {"name": "test", "description": "Manual test endpoints (OpenAI / Make.com)"},
            {"name": "chat", "description": "Chat and polling endpoints"},
            {"name": "admin", "description": "Admin endpoints (requires x-admin-token)"},
        ],
    )

    allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    if allowed_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=False,
            allow_methods=["POST", "GET", "OPTIONS"],
            allow_headers=["*"]
        )
    else:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["POST", "GET", "OPTIONS"],
            allow_headers=["*"]
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        logger.exception("unhandled_exception", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error"},
        )

    @application.get("/health", tags=["health"])
    async def health():
        return {
            "ok": True,
            "service": "backend-ai-service",
            "env": settings.app_env,
        }

    @application.get("/health/openai", tags=["health"])
    async def health_openai():
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {settings.openai_api_key or ''}"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url, headers=headers)
            ok = r.status_code == 200
            auth_masked = _mask_bearer(settings.openai_api_key)
            return {
                "ok": ok,
                "status_code": r.status_code,
                "auth": auth_masked,
                "model_configured": settings.openai_model,
                "note": "200 means key is valid; 401 invalid key; 429 insufficient_quota",
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    @application.get("/test/openai", tags=["test"])
    async def test_openai(
        message: str = Query("What is WooCommerce in WordPress?"),
        model: str | None = Query(None, include_in_schema=False),
    ):
        """
        Quick OpenAI test endpoint (visible in /docs).
        Uses a direct HTTP call (no internal wrappers), similar to your PHP sample.
        Returns reply plus raw request/response so you can compare easily.
        """
        use_model = (model or settings.openai_model).strip()
        key = (settings.openai_api_key or "").strip()
        if not key:
            return JSONResponse(status_code=500, content={"ok": False, "error": "OPENAI_API_KEY_not_set"})
        url = _openai_request_url()
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": use_model,
            "temperature": 0.4,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful ecommerce customer support assistant for a WooCommerce store. Be concise and polite."
                },
                {"role": "user", "content": message},
            ],
        }
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(url, headers=headers, json=body)
            latency_ms = int((time.time() - start) * 1000)
            data = None
            try:
                data = r.json()
            except Exception:
                data = {"raw": r.text}
            reply = None
            if isinstance(data, dict) and isinstance(data.get("choices"), list) and data["choices"]:
                reply = (data["choices"][0].get("message", {}) or {}).get("content")
            return {
                "ok": r.status_code == 200,
                "status_code": r.status_code,
                "model": use_model,
                "reply": reply,
                "latency_ms": latency_ms,
                "request": {
                    "method": "POST",
                    "url": url,
                    "headers": {"Authorization": _mask_bearer(key), "Content-Type": "application/json"},
                    "body": body,
                },
                "response": data,
            }
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "ok": False,
                    "model": use_model,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                    "request": {
                        "method": "POST",
                        "url": url,
                        "headers": {"Authorization": _mask_bearer(key), "Content-Type": "application/json"},
                        "body": body,
                    },
                },
            )

    @application.post("/test/make", tags=["test"])
    async def test_make(background: BackgroundTasks, reason: str = Query("human_request")):
        """
        Quick Make.com webhook test endpoint (visible in /docs).
        Fires one webhook call using MAKE_WEBHOOK_URL and returns immediately.
        """
        if not settings.make_webhook_url:
            return JSONResponse(status_code=500, content={"ok": False, "error": "MAKE_WEBHOOK_URL_not_set"})
        request_id = "test-" + str(uuid.uuid4())
        background.add_task(
            post_make_webhook,
            url=settings.make_webhook_url,
            event="test_webhook",
            request_id=request_id,
            session_id="test_session",
            reason=reason,
            message="Test webhook message",
            transcript=[],
            contact=None,
            note="N/A",
            meta={"source": "test_api", "ts": datetime.now(timezone.utc).isoformat()},
            escalation_db_id=None,
            admin_link="N/A",
        )
        return {"ok": True, "request_id": request_id, "make_url": settings.make_webhook_url}

    if settings.db_enabled and settings.db_auto_create_tables:
        try:
            db_service.ensure_tables()
        except Exception as exc:
            logger.warning("db_init_failed", extra={"error_type": type(exc).__name__})

    @application.post("/chat", response_model=ChatResponse, tags=["chat"])
    async def chat(payload: ChatRequest, request: Request, background: BackgroundTasks):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.time()

        detected = detect_escalation(payload.message)
        escalation = detected
        conversation_ref = None
        user_message_id = None
        escalation_db_id = None
        assistant_message_id = None
        meta = {
            "user_agent": request.headers.get("user-agent"),
            "origin": request.headers.get("origin"),
            "ip": request.client.host if request.client else None,
            "ts": datetime.now(timezone.utc).isoformat(),
            "escalation_detection": {
                "detected": bool(detected.escalation),
                "reason": detected.reason or "N/A",
                "matched_group": detected.matched_group or "N/A",
                "matched_pattern": detected.matched_pattern or "N/A",
            },
        }

        handoff_active = False
        if db_service.db_is_configured():
            try:
                conversation_ref = await run_in_threadpool(
                    db_service.get_or_create_conversation,
                    payload.session_id,
                    payload.site_url,
                )
                existing = await run_in_threadpool(db_service.get_conversation_by_session_id, payload.session_id or "")
                if existing and str(existing.get("status")) == "escalated":
                    escalation = type(escalation)(escalation=True, reason="human_handoff")
                    meta["handoff_active"] = True
                    handoff_active = True
                if payload.contact and conversation_ref:
                    await run_in_threadpool(
                        db_service.update_conversation_contact,
                        conversation_id=conversation_ref.conversation_id,
                        contact_name=payload.contact.name,
                        contact_email=payload.contact.email,
                    )
                user_message_id = await run_in_threadpool(
                    db_service.insert_message,
                    conversation_id=conversation_ref.conversation_id,
                    role="user",
                    content=payload.message,
                    request_id=request_id,
                    meta=meta,
                )
            except Exception as exc:
                logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(exc).__name__})

        if handoff_active:
            reply = ""
        elif escalation.escalation:
            reply = ""
        else:
            try:
                if not settings.openai_api_key:
                    raise RuntimeError("OPENAI_API_KEY is not configured")

                ai = await generate_reply(
                    message=payload.message,
                    transcript=payload.transcript,
                    model=settings.openai_model,
                    site_url=payload.site_url,
                )
                reply = ai.reply
                openai_logger.info(
                    "%s",
                    _openai_postman_style_log(
                        request_id=request_id,
                        session_id=payload.session_id or "Unknown",
                        model=settings.openai_model,
                        request_body={"model": settings.openai_model, "temperature": 0.4, "messages": ai.request_messages},
                        response_body=ai.response_json if ai.response_json is not None else {"response": "N/A"},
                        error_message=None,
                        reply=ai.reply,
                    ),
                )
                if db_service.db_is_configured() and conversation_ref:
                    try:
                        await run_in_threadpool(
                            db_service.insert_openai_call,
                            conversation_id=conversation_ref.conversation_id,
                            trigger_message_id=user_message_id,
                            request_id=request_id,
                            model=settings.openai_model,
                            temperature=0.4,
                            prompt_messages=ai.request_messages,
                            response_json=ai.response_json,
                            reply_text=ai.reply,
                            ok=True,
                            error_type=None,
                            error_message=None,
                            latency_ms=ai.latency_ms,
                        )
                    except Exception as exc:
                        logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(exc).__name__})
            except Exception as exc:
                logger.warning("openai_failure", extra={"request_id": request_id, "error_type": type(exc).__name__})
                # Try proxy first if configured
                proxy = await proxy_reply(
                    message=payload.message,
                    transcript=payload.transcript,
                    model=settings.openai_model,
                    site_url=payload.site_url,
                )
                if proxy is not None:
                    reply = proxy.reply
                    openai_logger.info(
                        "%s",
                        _openai_proxy_postman_style_log(
                            request_id=request_id,
                            session_id=payload.session_id or "Unknown",
                            model=settings.openai_model,
                            request_body={"model": settings.openai_model, "temperature": 0.4, "messages": proxy.request_messages},
                            response_body=proxy.response_json,
                            reply=reply,
                        ),
                    )
                    if db_service.db_is_configured() and conversation_ref:
                        try:
                            await run_in_threadpool(
                                db_service.insert_openai_call,
                                conversation_id=conversation_ref.conversation_id,
                                trigger_message_id=user_message_id,
                                request_id=request_id,
                                model=settings.openai_model,
                                temperature=0.4,
                                prompt_messages=proxy.request_messages,
                                response_json=proxy.response_json,
                                reply_text=reply,
                                ok=True,
                                error_type=None,
                                error_message=None,
                                latency_ms=proxy.latency_ms,
                            )
                        except Exception as db_exc:
                            logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(db_exc).__name__})
                else:
                    fallback = generate_fallback(payload.message, payload.site_url)
                    reply = fallback.reply
                    prompt = build_messages(payload.message, payload.transcript, payload.site_url)
                    err_obj = {"error_type": type(exc).__name__, "error_message": str(exc)}
                    openai_logger.info(
                        "%s",
                        _openai_postman_style_log(
                            request_id=request_id,
                            session_id=payload.session_id or "Unknown",
                            model=settings.openai_model,
                            request_body={"model": settings.openai_model, "temperature": 0.4, "messages": prompt},
                            response_body=err_obj,
                            error_message=str(exc),
                            reply=reply,
                        ),
                    )
                    if (not escalation.escalation) and fallback.suggest_escalation:
                        escalation = type(escalation)(escalation=True, reason="ai_unavailable")
                    if db_service.db_is_configured() and conversation_ref:
                        try:
                            await run_in_threadpool(
                                db_service.insert_openai_call,
                                conversation_id=conversation_ref.conversation_id,
                                trigger_message_id=user_message_id,
                                request_id=request_id,
                                model=settings.openai_model,
                                temperature=0.4,
                                prompt_messages=prompt,
                                response_json=None,
                                reply_text=reply,
                                ok=False,
                                error_type=type(exc).__name__,
                                error_message=str(exc),
                                latency_ms=int((time.time() - start) * 1000),
                            )
                        except Exception as db_exc:
                            logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(db_exc).__name__})

        if reply and db_service.db_is_configured() and conversation_ref:
            try:
                assistant_message_id = await run_in_threadpool(
                    db_service.insert_message,
                    conversation_id=conversation_ref.conversation_id,
                    role="assistant",
                    content=reply,
                    request_id=request_id,
                    meta=None,
                )
            except Exception as exc:
                logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(exc).__name__})

        chat_logger.info(
            "CHAT\n%s\n\n",
            _pretty(
                {
                    "request_id": request_id,
                    "session_id": payload.session_id or "Unknown",
                    "site_url": payload.site_url or "Unknown",
                    "escalation": bool(escalation.escalation),
                    "escalation_reason": escalation.reason or "N/A",
                    "user_message": payload.message,
                    "assistant_reply": reply,
                }
            ),
        )

        return ChatResponse(
            reply=reply,
            escalation=escalation.escalation,
            escalation_reason=escalation.reason,
            request_id=request_id,
            latency_ms=int((time.time() - start) * 1000),
            last_message_id=assistant_message_id or user_message_id,
        )

    @application.post("/escalate", response_model=EscalationResponse, tags=["chat"])
    async def escalate(payload: EscalationRequest, request: Request, background: BackgroundTasks):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        conversation_ref = None
        escalation_db_id = None
        if db_service.db_is_configured():
            try:
                conversation_ref = await run_in_threadpool(
                    db_service.get_or_create_conversation,
                    payload.session_id,
                    None,
                )
                if payload.contact and conversation_ref:
                    await run_in_threadpool(
                        db_service.update_conversation_contact,
                        conversation_id=conversation_ref.conversation_id,
                        contact_name=payload.contact.name,
                        contact_email=payload.contact.email,
                    )
                await run_in_threadpool(db_service.mark_escalated, conversation_ref.conversation_id, payload.reason)
                escalation_db_id = await run_in_threadpool(
                    db_service.insert_escalation,
                    conversation_id=conversation_ref.conversation_id,
                    request_id=request_id,
                    source="form_submitted",
                    reason=payload.reason,
                    contact_name=payload.contact.name if payload.contact else None,
                    contact_email=payload.contact.email if payload.contact else None,
                    note=payload.note,
                    transcript=db_service.normalize_transcript([m.model_dump() for m in payload.transcript]),
                    make_webhook_ok=False,
                    make_webhook_error=None if settings.make_webhook_url else "make_not_configured",
                )
            except Exception as exc:
                logger.warning("db_log_failed", extra={"request_id": request_id, "error_type": type(exc).__name__})

        if not settings.make_webhook_url:
            return EscalationResponse(ok=False, request_id=request_id, error="make_not_configured", detail="MAKE_WEBHOOK_URL is not configured")

        background.add_task(
            post_make_webhook,
            url=settings.make_webhook_url,
            event="escalation_details",
            request_id=request_id,
            session_id=payload.session_id,
            reason=payload.reason,
            message=None,
            transcript=payload.transcript,
            contact=payload.contact,
            note=payload.note,
            escalation_db_id=escalation_db_id,
            admin_link=_admin_link(conversation_ref.conversation_uid) if conversation_ref else "N/A",
            meta={
                "user_agent": request.headers.get("user-agent"),
                "origin": request.headers.get("origin"),
                "ip": request.client.host if request.client else None,
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        )

        return EscalationResponse(ok=True, request_id=request_id)

    @application.get("/poll", response_model=PollResponse, tags=["chat"])
    async def poll(session_id: str = Query(...), after_id: int = Query(0)):
        if not db_service.db_is_configured():
            return PollResponse(session_id=session_id, messages=[])

        try:
            conv = await run_in_threadpool(db_service.get_conversation_by_session_id, session_id)
            if not conv:
                return PollResponse(session_id=session_id, messages=[])
            rows = await run_in_threadpool(db_service.get_messages_after_id, int(conv["id"]), int(after_id))
            messages = [{"id": r["id"], "role": r["role"], "content": r["content"], "created_at": r["created_at"]} for r in (rows or [])]
            return PollResponse(session_id=session_id, messages=messages)
        except Exception:
            return PollResponse(session_id=session_id, messages=[])

    @application.get("/admin/conversations/{conversation_id}/messages", tags=["admin"])
    async def admin_messages(
        conversation_id: int = PathParam(..., ge=1),
        after_id: int = Query(0),
        x_admin_token: str | None = Header(None, alias="x-admin-token"),
    ):
        if not _admin_allowed(x_admin_token):
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
        if not db_service.db_is_configured():
            return JSONResponse(status_code=500, content={"error": "db_not_configured"})
        messages = await run_in_threadpool(db_service.get_messages_after_id, int(conversation_id), int(after_id))
        return {"conversation_id": conversation_id, "messages": messages}

    @application.post("/admin/agent/reply", tags=["admin"])
    async def admin_reply(payload: AgentReplyRequest, x_admin_token: str | None = Header(None, alias="x-admin-token")):
        if not _admin_allowed(x_admin_token):
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
        if not db_service.db_is_configured():
            return JSONResponse(status_code=500, content={"error": "db_not_configured"})
        message_id = await run_in_threadpool(
            db_service.insert_agent_message,
            conversation_id=int(payload.conversation_id),
            agent_name=payload.agent_name,
            content=payload.message,
        )
        return {"ok": True, "message_id": message_id}

    @application.post("/admin/conversations/{conversation_id}/end-handoff", tags=["admin"])
    async def admin_end_handoff(
        conversation_id: int = PathParam(..., ge=1),
        x_admin_token: str | None = Header(None, alias="x-admin-token"),
    ):
        if not _admin_allowed(x_admin_token):
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
        if not db_service.db_is_configured():
            return JSONResponse(status_code=500, content={"error": "db_not_configured"})
        conv = await run_in_threadpool(db_service.get_conversation_by_id, int(conversation_id))
        if not conv:
            return JSONResponse(status_code=404, content={"error": "conversation_not_found"})
        if str(conv.get("status") or "") != "escalated":
            return {"ok": True, "note": "already_normal"}
        await run_in_threadpool(db_service.mark_normal, int(conversation_id))
        await run_in_threadpool(
            db_service.insert_system_message,
            conversation_id=int(conversation_id),
            content="__handoff_end__",
            meta={"source": "admin"},
        )
        return {"ok": True}

    @application.post("/admin/conversations/{conversation_id}/start-handoff", tags=["admin"])
    async def admin_start_handoff(
        conversation_id: int = PathParam(..., ge=1),
        x_admin_token: str | None = Header(None, alias="x-admin-token"),
    ):
        if not _admin_allowed(x_admin_token):
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
        if not db_service.db_is_configured():
            return JSONResponse(status_code=500, content={"error": "db_not_configured"})
        conv = await run_in_threadpool(db_service.get_conversation_by_id, int(conversation_id))
        if not conv:
            return JSONResponse(status_code=404, content={"error": "conversation_not_found"})
        if str(conv.get("status") or "") == "escalated":
            return {"ok": True, "note": "already_escalated"}
        await run_in_threadpool(db_service.mark_escalated, int(conversation_id), "admin_started")
        await run_in_threadpool(
            db_service.insert_system_message,
            conversation_id=int(conversation_id),
            content="__handoff_start__",
            meta={"source": "admin"},
        )
        return {"ok": True}

    return application


app = create_app()
