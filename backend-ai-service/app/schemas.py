from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TranscriptMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ContactInfo(BaseModel):
    name: str | None = None
    email: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    contact: ContactInfo | None = None
    site_url: str | None = None


class ChatResponse(BaseModel):
    reply: str
    escalation: bool
    escalation_reason: str | None = None
    request_id: str
    latency_ms: int
    last_message_id: int | None = None


class PollResponseMessage(BaseModel):
    id: int
    role: Literal["user", "assistant", "agent", "system"]
    content: str
    created_at: str


class PollResponse(BaseModel):
    session_id: str
    messages: list[PollResponseMessage]


class AgentReplyRequest(BaseModel):
    conversation_id: int
    agent_name: str | None = None
    message: str = Field(min_length=1, max_length=4000)


class EscalationRequest(BaseModel):
    session_id: str | None = None
    reason: str | None = None
    contact: ContactInfo | None = None
    note: str | None = None
    transcript: list[TranscriptMessage] = Field(default_factory=list)


class EscalationResponse(BaseModel):
    ok: bool
    request_id: str
    error: str | None = None
    detail: str | None = None
