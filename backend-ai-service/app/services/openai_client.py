from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas import TranscriptMessage


@dataclass(frozen=True)
class OpenAIChatResult:
    reply: str
    request_messages: list[dict[str, str]]
    response_json: dict | None
    latency_ms: int


def build_messages(message: str, transcript: list[TranscriptMessage], site_url: str | None) -> list[dict[str, str]]:
    system = (
        "You are a helpful ecommerce customer support assistant for a WooCommerce store. "
        "Be concise, polite, and action-oriented. "
        "If you do not know something, ask a short clarifying question."
    )
    if site_url:
        system = system + " The store website base URL is: " + site_url.rstrip("/")

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]

    normalized: list[TranscriptMessage] = []
    for item in transcript or []:
        if not item.content:
            continue
        if normalized and normalized[-1].role == item.role and normalized[-1].content == item.content:
            continue
        normalized.append(item)

    for item in normalized:
        messages.append({"role": item.role, "content": item.content})

    last = normalized[-1] if normalized else None
    if not (last and last.role == "user" and last.content == message):
        messages.append({"role": "user", "content": message})
    return messages


async def generate_reply(*, message: str, transcript: list[TranscriptMessage], model: str, site_url: str | None) -> OpenAIChatResult:
    start = time.time()
    request_messages = build_messages(message, transcript, site_url)

    if settings.openai_mock:
        return OpenAIChatResult(
            reply="(mock) Thanks - I received your message: " + message,
            request_messages=request_messages,
            response_json=None,
            latency_ms=int((time.time() - start) * 1000),
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model=model,
        messages=request_messages,
        temperature=0.4,
    )

    choice = completion.choices[0]
    content = (choice.message.content or "").strip()
    reply = content if content else "Sorry — I couldn't generate a response. Please try again."
    response_json = completion.model_dump() if hasattr(completion, "model_dump") else None
    return OpenAIChatResult(
        reply=reply,
        request_messages=request_messages,
        response_json=response_json,
        latency_ms=int((time.time() - start) * 1000),
    )


async def proxy_reply(*, message: str, transcript: list[TranscriptMessage], model: str, site_url: str | None) -> OpenAIChatResult | None:
    """
    Optional external proxy call (e.g., PHP script) when OpenAI is unavailable.
    Sends { model, temperature, messages } to settings.openai_proxy_url and expects JSON with 'reply' or OpenAI-like choices.
    """
    url = (settings.openai_proxy_url or "").strip()
    if not url:
        return None
    start = time.time()
    request_messages = build_messages(message, transcript, site_url)
    payload = {"model": model, "temperature": 0.4, "messages": request_messages}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        data = r.json()
        # Accept either {'reply': '...'} or OpenAI-like {'choices':[{'message':{'content':'...'}}]}
        reply = None
        if isinstance(data, dict):
            reply = data.get("reply")
            if not reply and isinstance(data.get("choices"), list) and data["choices"]:
                reply = (data["choices"][0].get("message", {}) or {}).get("content")
        if not reply:
            reply = "Sorry — I couldn't generate a response. Please try again."
        return OpenAIChatResult(
            reply=str(reply),
            request_messages=request_messages,
            response_json=data if isinstance(data, dict) else None,
            latency_ms=int((time.time() - start) * 1000),
        )
    except Exception:
        return None
