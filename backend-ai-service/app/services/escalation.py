from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class EscalationResult:
    escalation: bool
    reason: str | None = None
    matched_group: str | None = None
    matched_pattern: str | None = None


_HUMAN_PATTERNS = [
    r"\bhuman\b",
    r"\bagent\b",
    r"\brepresentative\b",
    r"\bperson\b",
    r"\bspeak to (someone|a person)\b",
    r"\bcall me\b",
]

_REFUND_PATTERNS = [
    r"\brefund\b",
    r"\bmoney back\b",
    r"\bchargeback\b",
    r"\breturn\b",
    r"\bcancel (my|this) order\b",
]

_ANGRY_PATTERNS = [
    r"\bscam\b",
    r"\bfraud\b",
    r"\bworst\b",
    r"\brip\s*off\b",
    r"\bterrible\b",
    r"\bunacceptable\b",
    r"\bfurious\b",
    r"\bangry\b",
    r"\bwtf\b",
    r"\bshit\b",
    r"\bfuck\b",
    r"!{3,}",
]


def detect_escalation(message: str) -> EscalationResult:
    text = (message or "").lower()

    for pattern in _HUMAN_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return EscalationResult(escalation=True, reason="human_request", matched_group="HUMAN_PATTERNS", matched_pattern=pattern)

    for pattern in _REFUND_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return EscalationResult(escalation=True, reason="refund_request", matched_group="REFUND_PATTERNS", matched_pattern=pattern)

    for pattern in _ANGRY_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return EscalationResult(escalation=True, reason="angry_message", matched_group="ANGRY_PATTERNS", matched_pattern=pattern)

    return EscalationResult(escalation=False, reason=None)
