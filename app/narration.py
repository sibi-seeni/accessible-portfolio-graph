"""Snowflake Cortex narration for the Accessible Portfolio Explorer.

Narration is generated through Snowflake's OpenAI-compatible Cortex Chat
Completions REST API using the official OpenAI Python SDK. Structured portfolio
and exposure data is the only source of truth; the model is never allowed to
invent market facts.

This module performs NO local/fabricated fallback. If the primary model and the
fallback model both fail, a clear `NarrationError` is raised.
"""

from __future__ import annotations

import json
from typing import Any

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import Holding, Portfolio
from app.schemas import PortfolioInsight

SYSTEM_PROMPT = (
    "You produce concise audio-first portfolio narration for blind and "
    "low-vision investors. Treat supplied structured portfolio data as the "
    "complete source of truth."
)

STYLE_RULES = (
    "Rules for every response: This narration will be heard, not read. Use "
    "short, simple sentences. No markdown. No bullet lists. Never refer to "
    "visuals or say 'as shown', 'on the screen', 'in the graph', or 'see'. Use "
    "calm, factual language. Aim for roughly 60 to 100 spoken words. Clearly "
    "distinguish a direct holding from indirect exposure. Do not give "
    "investment advice. Do not invent any fact that is not present in the "
    "supplied structured data. Output only the spoken narration text."
)

ACCOUNT_PATH = "/api/v2/cortex/v1"


class NarrationError(RuntimeError):
    """Raised when Snowflake Cortex narration cannot be generated."""


def _base_url() -> str:
    settings = get_settings()
    if not settings.snowflake_account_url:
        raise NarrationError(
            "SNOWFLAKE_ACCOUNT_URL is not set. Add it to your .env file."
        )
    if not settings.snowflake_pat:
        raise NarrationError("SNOWFLAKE_PAT is not set. Add it to your .env file.")
    return settings.snowflake_account_url.rstrip("/") + ACCOUNT_PATH


def _build_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(base_url=_base_url(), api_key=settings.snowflake_pat)


def _candidate_models() -> list[str]:
    settings = get_settings()
    models: list[str] = []
    if settings.snowflake_model:
        models.append(settings.snowflake_model)
    if (
        settings.snowflake_fallback_model
        and settings.snowflake_fallback_model not in models
    ):
        models.append(settings.snowflake_fallback_model)
    if not models:
        raise NarrationError(
            "No Snowflake model configured. Set SNOWFLAKE_MODEL and "
            "SNOWFLAKE_FALLBACK_MODEL in your .env file."
        )
    return models


def _complete(client: OpenAI, model: str, messages: list[dict[str, str]]) -> str:
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.0,
    )
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise NarrationError(f"Snowflake Cortex model {model!r} returned no text.")
    return content.strip()


def _generate(messages: list[dict[str, str]]) -> str:
    client = _build_client()
    errors: list[str] = []
    for model in _candidate_models():
        try:
            return _complete(client, model, messages)
        except Exception as exc:  # noqa: BLE001 - try every configured model
            errors.append(f"{model}: {exc}")
    raise NarrationError(
        "Snowflake Cortex narration failed for every configured model. "
        + " | ".join(errors)
    )


def _messages(user_payload: dict[str, Any], instruction: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": f"{SYSTEM_PROMPT} {STYLE_RULES}"},
        {
            "role": "user",
            "content": json.dumps(user_payload, separators=(",", ":"), default=str)
            + "\n"
            + instruction,
        },
    ]


def _portfolio_payload(portfolio: Portfolio, holdings: list[Holding]) -> dict[str, Any]:
    return {
        "portfolio": {"id": portfolio.id, "name": portfolio.name},
        "holdings": [
            {
                "ticker": holding.ticker,
                "company_name": holding.company_name,
                "sector": holding.sector,
                "shares": holding.shares,
                "weight": holding.weight,
            }
            for holding in holdings
        ],
    }


def _load_portfolio(
    session: Session, portfolio_id: int
) -> tuple[Portfolio, list[Holding]]:
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise NarrationError(f"Portfolio {portfolio_id} was not found.")
    holdings = list(
        session.scalars(
            select(Holding)
            .where(Holding.portfolio_id == portfolio_id)
            .order_by(Holding.id)
        ).all()
    )
    return portfolio, holdings


def generate_holdings_narration(portfolio_id: int) -> str:
    """Spoken overview of a portfolio's holdings."""
    with SessionLocal() as session:
        portfolio, holdings = _load_portfolio(session, portfolio_id)
        payload = _portfolio_payload(portfolio, holdings)

    payload["request"] = "holdings_overview"
    instruction = (
        "Narrate this portfolio's holdings. Name the portfolio and its mix of "
        "companies and sectors. Mention each direct holding and how much of the "
        "portfolio it represents. This is a direct holdings summary only; do "
        "not discuss hidden or indirect exposure."
    )
    return _generate(_messages(payload, instruction))


def generate_risk_narration(portfolio_id: int, insight: PortfolioInsight) -> str:
    """Spoken explanation of the hidden concentration behind a portfolio."""
    with SessionLocal() as session:
        portfolio, holdings = _load_portfolio(session, portfolio_id)
        payload = _portfolio_payload(portfolio, holdings)

    payload["request"] = "hidden_risk"
    payload["insight"] = {
        "sector": insight.sector,
        "percentage": insight.percentage,
        "direct_tickers": insight.direct_tickers,
        "indirect_tickers": insight.indirect_tickers,
        "exposure_notes": insight.exposure_notes,
        "methodology": insight.methodology,
    }
    instruction = (
        "Explain the hidden concentration for this portfolio. State the "
        "combined exposure figure as a mapped exposure score, not a financial "
        "risk percentage. Distinguish clearly between the companies held "
        "directly in the concentrating sector and the companies that add "
        "indirect exposure through the listed supply-chain, competitor, or "
        "regulatory links. Explain why these hidden connections matter without "
        "giving investment advice."
    )
    return _generate(_messages(payload, instruction))
