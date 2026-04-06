from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

import mysql.connector

from app.core.config import settings


@dataclass(frozen=True)
class ConversationRef:
    conversation_id: int
    conversation_uid: str


def db_is_configured() -> bool:
    if not settings.db_enabled:
        return False
    return bool(settings.db_host and settings.db_user and settings.db_name)


def _t(name: str) -> str:
    return f"{settings.db_table_prefix}{name}"


def _connect():
    return mysql.connector.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        autocommit=True,
    )


def ensure_tables() -> None:
    if not db_is_configured():
        return

    conversations = _t("conversations")
    messages = _t("messages")
    calls = _t("openai_calls")
    escalations = _t("escalations")
    make_logs = _t("make_webhook_logs")

    ddl_conversations = f"""
    CREATE TABLE IF NOT EXISTS {conversations} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      conversation_uid CHAR(36) NOT NULL,
      session_id VARCHAR(128) NULL,
      site_url VARCHAR(255) NULL,
      status ENUM('normal','escalated','closed') NOT NULL DEFAULT 'normal',
      escalated_at TIMESTAMP(6) NULL,
      escalation_reason VARCHAR(64) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_conversation_uid (conversation_uid),
      KEY idx_session_id (session_id),
      KEY idx_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """

    ddl_messages = f"""
    CREATE TABLE IF NOT EXISTS {messages} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      conversation_id BIGINT UNSIGNED NOT NULL,
      role ENUM('user','assistant','agent','system') NOT NULL,
      content MEDIUMTEXT NOT NULL,
      request_id VARCHAR(64) NULL,
      meta_json LONGTEXT NULL,
      PRIMARY KEY (id),
      KEY idx_conv_time (conversation_id, created_at),
      KEY idx_role (role),
      CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES {conversations}(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """

    ddl_calls = f"""
    CREATE TABLE IF NOT EXISTS {calls} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      conversation_id BIGINT UNSIGNED NOT NULL,
      trigger_message_id BIGINT UNSIGNED NULL,
      request_id VARCHAR(64) NULL,
      model VARCHAR(64) NULL,
      temperature DECIMAL(4,2) NULL,
      prompt_messages_json LONGTEXT NULL,
      response_json LONGTEXT NULL,
      reply_text MEDIUMTEXT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      error_type VARCHAR(64) NULL,
      error_message TEXT NULL,
      latency_ms INT UNSIGNED NULL,
      PRIMARY KEY (id),
      KEY idx_conv_time (conversation_id, created_at),
      KEY idx_request_id (request_id),
      KEY idx_ok (ok, created_at),
      CONSTRAINT fk_calls_conversation
        FOREIGN KEY (conversation_id) REFERENCES {conversations}(id) ON DELETE CASCADE,
      CONSTRAINT fk_calls_trigger_message
        FOREIGN KEY (trigger_message_id) REFERENCES {messages}(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """

    ddl_escalations = f"""
    CREATE TABLE IF NOT EXISTS {escalations} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      conversation_id BIGINT UNSIGNED NOT NULL,
      request_id VARCHAR(64) NULL,
      source VARCHAR(32) NOT NULL,
      reason VARCHAR(64) NULL,
      contact_name VARCHAR(128) NULL,
      contact_email VARCHAR(190) NULL,
      note TEXT NULL,
      transcript_json LONGTEXT NULL,
      make_webhook_ok TINYINT(1) NOT NULL DEFAULT 0,
      make_webhook_error TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_conv_time (conversation_id, created_at),
      KEY idx_reason (reason, created_at),
      CONSTRAINT fk_escalations_conversation
        FOREIGN KEY (conversation_id) REFERENCES {conversations}(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """

    ddl_make_logs = f"""
    CREATE TABLE IF NOT EXISTS {make_logs} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      escalation_id BIGINT UNSIGNED NULL,
      event VARCHAR(64) NOT NULL,
      request_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(128) NOT NULL,
      reason VARCHAR(64) NOT NULL,
      make_url VARCHAR(512) NOT NULL,
      request_payload LONGTEXT NOT NULL,
      response_status INT NULL,
      response_body LONGTEXT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 0,
      error TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_escalation_id (escalation_id),
      KEY idx_request_id (request_id),
      KEY idx_ok (ok, created_at),
      CONSTRAINT fk_make_logs_escalation
        FOREIGN KEY (escalation_id) REFERENCES {escalations}(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(ddl_conversations)
            cur.execute(ddl_messages)
            cur.execute(ddl_calls)
            cur.execute(ddl_escalations)
            cur.execute(ddl_make_logs)
        finally:
            cur.close()
    finally:
        conn.close()


def get_or_create_conversation(session_id: str | None, site_url: str | None) -> ConversationRef:
    if not db_is_configured():
        raise RuntimeError("db_not_configured")

    session_id = (session_id or "").strip() or None
    site_url = (site_url or "").strip() or None

    conversations = _t("conversations")
    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            if session_id:
                cur.execute(
                    f"SELECT id, conversation_uid FROM {conversations} WHERE session_id=%s ORDER BY id DESC LIMIT 1",
                    (session_id,),
                )
                row = cur.fetchone()
                if row:
                    return ConversationRef(conversation_id=int(row[0]), conversation_uid=str(row[1]))

            conversation_uid = str(uuid.uuid4())
            cur.execute(
                f"INSERT INTO {conversations} (conversation_uid, session_id, site_url) VALUES (%s, %s, %s)",
                (conversation_uid, session_id, site_url),
            )
            return ConversationRef(conversation_id=int(cur.lastrowid), conversation_uid=conversation_uid)
        finally:
            cur.close()
    finally:
        conn.close()


def get_conversation_by_session_id(session_id: str) -> dict | None:
    if not db_is_configured():
        raise RuntimeError("db_not_configured")

    conversations = _t("conversations")
    conn = _connect()
    try:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(f"SELECT * FROM {conversations} WHERE session_id=%s ORDER BY id DESC LIMIT 1", (session_id,))
            return cur.fetchone()
        finally:
            cur.close()
    finally:
        conn.close()


def get_conversation_by_id(conversation_id: int) -> dict | None:
    if not db_is_configured():
        raise RuntimeError("db_not_configured")

    conversations = _t("conversations")
    conn = _connect()
    try:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(f"SELECT * FROM {conversations} WHERE id=%s LIMIT 1", (conversation_id,))
            return cur.fetchone()
        finally:
            cur.close()
    finally:
        conn.close()


def update_conversation_contact(*, conversation_id: int, contact_name: str | None, contact_email: str | None) -> None:
    conversations = _t("conversations")
    name = (contact_name or "").strip() or None
    email = (contact_email or "").strip() or None
    if not (name or email):
        return

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            try:
                cur.execute(
                    f"UPDATE {conversations} SET contact_name=COALESCE(%s, contact_name), contact_email=COALESCE(%s, contact_email) WHERE id=%s",
                    (name, email, conversation_id),
                )
            except Exception:
                return
        finally:
            cur.close()
    finally:
        conn.close()


def mark_normal(conversation_id: int) -> None:
    conversations = _t("conversations")
    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {conversations} SET status='normal', escalated_at=NULL, escalation_reason=NULL WHERE id=%s",
                (conversation_id,),
            )
        finally:
            cur.close()
    finally:
        conn.close()


def get_messages_after_id(conversation_id: int, after_id: int) -> list[dict]:
    messages = _t("messages")
    conn = _connect()
    try:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(
                f"SELECT id, created_at, role, content, meta_json FROM {messages} WHERE conversation_id=%s AND id>%s ORDER BY id ASC LIMIT 200",
                (conversation_id, after_id),
            )
            rows = cur.fetchall()
            out: list[dict] = []
            for r in rows:
                out.append(
                    {
                        "id": int(r["id"]),
                        "created_at": r["created_at"].isoformat() if r.get("created_at") else "",
                        "role": str(r.get("role") or ""),
                        "content": str(r.get("content") or ""),
                        "meta_json": r.get("meta_json"),
                    }
                )
            return out
        finally:
            cur.close()
    finally:
        conn.close()


def insert_agent_message(*, conversation_id: int, agent_name: str | None, content: str) -> int:
    meta = {"agent_name": (agent_name or "").strip() or "Unknown"}
    return insert_message(conversation_id=conversation_id, role="agent", content=content, request_id=None, meta=meta)


def insert_system_message(*, conversation_id: int, content: str, meta: dict | None = None) -> int:
    return insert_message(conversation_id=conversation_id, role="system", content=content, request_id=None, meta=meta)


def mark_escalated(conversation_id: int, reason: str | None) -> None:
    conversations = _t("conversations")
    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {conversations} SET status='escalated', escalated_at=NOW(6), escalation_reason=%s WHERE id=%s",
                (reason, conversation_id),
            )
        finally:
            cur.close()
    finally:
        conn.close()


def insert_message(
    *,
    conversation_id: int,
    role: str,
    content: str,
    request_id: str | None,
    meta: dict | None,
) -> int:
    messages = _t("messages")
    meta_json = json.dumps(meta, ensure_ascii=False) if meta else None

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"INSERT INTO {messages} (conversation_id, role, content, request_id, meta_json) VALUES (%s, %s, %s, %s, %s)",
                (conversation_id, role, content, request_id, meta_json),
            )
            return int(cur.lastrowid)
        finally:
            cur.close()
    finally:
        conn.close()


def insert_openai_call(
    *,
    conversation_id: int,
    trigger_message_id: int | None,
    request_id: str | None,
    model: str | None,
    temperature: float | None,
    prompt_messages: list[dict] | None,
    response_json: dict | None,
    reply_text: str | None,
    ok: bool,
    error_type: str | None,
    error_message: str | None,
    latency_ms: int | None,
) -> int:
    calls = _t("openai_calls")
    prompt_messages_json = json.dumps(prompt_messages, ensure_ascii=False) if prompt_messages is not None else None
    response_json_text = json.dumps(response_json, ensure_ascii=False) if response_json is not None else None

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"""
                INSERT INTO {calls} (
                  conversation_id, trigger_message_id, request_id, model, temperature,
                  prompt_messages_json, response_json, reply_text, ok, error_type, error_message, latency_ms
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    conversation_id,
                    trigger_message_id,
                    request_id,
                    model,
                    temperature,
                    prompt_messages_json,
                    response_json_text,
                    reply_text,
                    1 if ok else 0,
                    error_type,
                    error_message,
                    latency_ms,
                ),
            )
            return int(cur.lastrowid)
        finally:
            cur.close()
    finally:
        conn.close()


def insert_escalation(
    *,
    conversation_id: int,
    request_id: str | None,
    source: str,
    reason: str | None,
    contact_name: str | None,
    contact_email: str | None,
    note: str | None,
    transcript: list[dict] | None,
    make_webhook_ok: bool,
    make_webhook_error: str | None,
) -> int:
    escalations = _t("escalations")
    transcript_json = json.dumps(transcript, ensure_ascii=False) if transcript is not None else None

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"""
                INSERT INTO {escalations} (
                  conversation_id, request_id, source, reason, contact_name, contact_email,
                  note, transcript_json, make_webhook_ok, make_webhook_error
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    conversation_id,
                    request_id,
                    source,
                    reason,
                    contact_name,
                    contact_email,
                    note,
                    transcript_json,
                    1 if make_webhook_ok else 0,
                    make_webhook_error,
                ),
            )
            return int(cur.lastrowid)
        finally:
            cur.close()
    finally:
        conn.close()


def update_escalation_webhook_result(escalation_id: int, ok: bool, error: str | None) -> None:
    escalations = _t("escalations")
    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"UPDATE {escalations} SET make_webhook_ok=%s, make_webhook_error=%s WHERE id=%s",
                (1 if ok else 0, error, escalation_id),
            )
        finally:
            cur.close()
    finally:
        conn.close()


def insert_make_webhook_log(
    *,
    escalation_id: int | None,
    event: str,
    request_id: str,
    session_id: str,
    reason: str,
    make_url: str,
    request_payload: dict,
    response_status: int | None,
    response_body: str | None,
    ok: bool,
    error: str | None,
) -> int:
    make_logs = _t("make_webhook_logs")
    payload_text = json.dumps(request_payload, ensure_ascii=False)

    conn = _connect()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"""
                INSERT INTO {make_logs} (
                  escalation_id, event, request_id, session_id, reason, make_url,
                  request_payload, response_status, response_body, ok, error
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    escalation_id,
                    event,
                    request_id,
                    session_id,
                    reason,
                    make_url,
                    payload_text,
                    response_status,
                    response_body,
                    1 if ok else 0,
                    error,
                ),
            )
            return int(cur.lastrowid)
        finally:
            cur.close()
    finally:
        conn.close()


def normalize_transcript(transcript: list[dict] | None) -> list[dict]:
    out: list[dict] = []
    for item in transcript or []:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant", "system"} and isinstance(content, str):
            out.append({"role": role, "content": content})
    return out

