from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FallbackResult:
    reply: str
    suggest_escalation: bool


def generate_fallback(message: str, site_url: str | None) -> FallbackResult:
    text = (message or "").strip()
    lower = text.lower()

    base = (site_url or "").rstrip("/")
    shop_url = (base + "/shop") if base else "/shop"
    account_orders_url = (base + "/my-account/orders") if base else "/my-account/orders"

    if re.search(r"\b(shop|shop page|store|catalog|products)\b", lower) or "place order" in lower:
        return FallbackResult(reply="You can browse products on our Shop page: " + shop_url, suggest_escalation=False)

    if "where is my order" in lower or re.search(r"\btrack\b.*\border\b", lower):
        return FallbackResult(
            reply="To help locate your order, share your order number and the email used at checkout. You can also check your orders here: " + account_orders_url,
            suggest_escalation=False,
        )

    if "shipping" in lower or "delivery" in lower:
        return FallbackResult(
            reply="Shipping times depend on your location and the shipping method selected at checkout. Tell me your city/zip and I’ll guide you.",
            suggest_escalation=False,
        )

    if "payment" in lower or "pay" in lower:
        return FallbackResult(
            reply="We accept payment methods available at checkout. If you tell me your country, I can confirm what options you should see.",
            suggest_escalation=False,
        )

    if "cash on delivery" in lower or re.search(r"\bcod\b", lower):
        return FallbackResult(
            reply="Cash on delivery availability depends on your location and order value. Share your city/zip and I’ll confirm.",
            suggest_escalation=False,
        )

    if "damaged" in lower or "broken" in lower or "defective" in lower:
        return FallbackResult(
            reply="Sorry about that. Please share your order number and a photo of the damage. You can also request human support and we’ll follow up.",
            suggest_escalation=True,
        )

    if "refund" in lower or "money back" in lower or "return" in lower:
        return FallbackResult(
            reply="I can help with a refund/return. Please share your order number and the email used at checkout. If you prefer, request human support and we’ll follow up.",
            suggest_escalation=True,
        )

    if "change" in lower and ("address" in lower or "delivery address" in lower):
        return FallbackResult(
            reply="I can help update your delivery address if the order hasn’t shipped yet. Share your order number and the new address.",
            suggest_escalation=False,
        )

    if "human" in lower or "agent" in lower or "representative" in lower:
        return FallbackResult(
            reply="Sure. Please request human support and leave your email so the team can contact you.",
            suggest_escalation=True,
        )

    if "disappoint" in lower or "angry" in lower or "terrible" in lower or "worst" in lower:
        return FallbackResult(
            reply="Sorry about that. Please request human support and share your order number so we can fix this quickly.",
            suggest_escalation=True,
        )

    return FallbackResult(
        reply="Sorry — the chat service is temporarily unavailable. Please request human support and we’ll follow up.",
        suggest_escalation=True,
    )
