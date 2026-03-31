from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import anyio
import httpx

from app.schemas import ContactInfo, TranscriptMessage


logger = logging.getLogger("make_logger")


def _pretty(obj: object) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:
        return str(obj)


def _nz(value: str | None, fallback: str) -> str:
    v = (value or "").strip()
    return v if v else fallback


def _utc_ts() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _last_user_message(transcript: list[TranscriptMessage] | None, message: str | None) -> str:
    if message and message.strip():
        return message.strip()
    for item in reversed(transcript or []):
        if item.role == "user" and item.content.strip():
            return item.content.strip()
    return "Unknown"


def _contact_payload(contact: ContactInfo | None, last_message: str) -> dict[str, str]:
    name = _nz(contact.name if contact else None, "Unknown")
    email = _nz(contact.email if contact else None, "Unknown")
    return {"name": name, "email": email, "message": last_message}


def _meta_payload(meta: dict[str, Any] | None) -> dict[str, str]:
    meta = meta or {}
    return {
        "user_agent": _nz(str(meta.get("user_agent")) if meta.get("user_agent") is not None else None, "Unknown"),
        "origin": _nz(str(meta.get("origin")) if meta.get("origin") is not None else None, "Unknown"),
        "ip": _nz(str(meta.get("ip")) if meta.get("ip") is not None else None, "Unknown"),
        "ts": _nz(str(meta.get("ts")) if meta.get("ts") is not None else None, _utc_ts()),
    }


async def post_make_webhook(
    *,
    url: str,
    event: str,
    request_id: str,
    session_id: str | None,
    reason: str | None,
    message: str | None,
    transcript: list[TranscriptMessage],
    contact: ContactInfo | None,
    note: str | None = None,
    meta: dict[str, Any] | None = None,
    escalation_db_id: int | None = None,
    admin_link: str | None = None,
) -> None:
    last_message = _last_user_message(transcript, message)
    transcript_string = json.dumps([m.model_dump() for m in (transcript or [])], ensure_ascii=False)
    payload: dict[str, Any] = {
        "event": _nz(event, "escalation_details"),
        "request_id": _nz(request_id, "Unknown"),
        "session_id": _nz(session_id, "Unknown"),
        "reason": _nz(reason, "Unknown"),
        "message": last_message,
        "contact": _contact_payload(contact, last_message),
        "note": _nz(note, "N/A"),
        "transcript": transcript_string,
        "meta": _meta_payload(meta),
        "admin_link": _nz(admin_link, "N/A"),
    }

    timeout = httpx.Timeout(10.0, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, json=payload)
            ok = 200 <= res.status_code < 300
            if ok:
                body = (res.text or "").strip()
                logger.info(
                    "MAKE\nREQUEST_URL: %s\n\nREQUEST_BODY:\n%s\n\nRESPONSE_STATUS: %s\nRESPONSE_BODY:\n%s\n\n",
                    url,
                    _pretty(
                        {
                            "event": payload["event"],
                            "request_id": payload["request_id"],
                            "session_id": payload["session_id"],
                            "reason": payload["reason"],
                            "payload": payload,
                        }
                    ),
                    res.status_code,
                    body[:2000] if body else "OK",
                )
            else:
                body = (res.text or "").strip()
                logger.warning(
                    "MAKE_ERROR\nREQUEST_URL: %s\n\nREQUEST_BODY:\n%s\n\nRESPONSE_STATUS: %s\nRESPONSE_BODY:\n%s\n\n",
                    url,
                    _pretty(
                        {
                            "event": payload["event"],
                            "request_id": payload["request_id"],
                            "session_id": payload["session_id"],
                            "reason": payload["reason"],
                            "payload": payload,
                        }
                    ),
                    res.status_code,
                    body[:2000],
                )
            try:
                from app.services import db as db_service

                if db_service.db_is_configured():
                    await anyio.to_thread.run_sync(
                        db_service.insert_make_webhook_log,
                        escalation_id=escalation_db_id,
                        event=payload["event"],
                        request_id=payload["request_id"],
                        session_id=payload["session_id"],
                        reason=payload["reason"],
                        make_url=url,
                        request_payload=payload,
                        response_status=res.status_code,
                        response_body=(res.text or "")[:5000] if not ok else None,
                        ok=ok,
                        error=None if ok else (res.text or "")[:1000],
                    )
                    if escalation_db_id:
                        await anyio.to_thread.run_sync(
                            db_service.update_escalation_webhook_result,
                            escalation_db_id,
                            ok,
                            None if ok else (res.text or "")[:1000],
                        )
            except Exception:
                return
    except Exception as exc:
        logger.warning(
            "MAKE_EXCEPTION\nREQUEST_URL: %s\n\nREQUEST_BODY:\n%s\n\nERROR:\n%s\n\n",
            url,
            _pretty(
                {
                    "event": payload["event"],
                    "request_id": payload["request_id"],
                    "session_id": payload["session_id"],
                    "reason": payload["reason"],
                    "payload": payload,
                }
            ),
            _pretty({"error_type": type(exc).__name__, "error_message": str(exc)}),
        )
        try:
            from app.services import db as db_service

            if db_service.db_is_configured():
                await anyio.to_thread.run_sync(
                    db_service.insert_make_webhook_log,
                    escalation_id=escalation_db_id,
                    event=payload["event"],
                    request_id=payload["request_id"],
                    session_id=payload["session_id"],
                    reason=payload["reason"],
                    make_url=url,
                    request_payload=payload,
                    response_status=None,
                    response_body=None,
                    ok=False,
                    error=str(exc)[:1000],
                )
                if escalation_db_id:
                    await anyio.to_thread.run_sync(
                        db_service.update_escalation_webhook_result,
                        escalation_db_id,
                        False,
                        str(exc)[:1000],
                    )
        except Exception:
            return
        return
