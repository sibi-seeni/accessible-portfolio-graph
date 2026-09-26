"""Deterministic natural-language query handling for a single portfolio.

Intent routing is keyword/regex/entity based. No LLM is used to classify the
question and no text-to-SQL is generated. Snowflake Cortex is only called for a
supported intent, using a compact structured context built from PostgreSQL.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.insight import (
    ThemeEdge,
    WeightedHolding,
    compute_theme_insight,
    get_portfolio_insight,
)
from app.models import Exposure, Holding, Portfolio, Sector
from app.narration import _generate as _snowflake_generate

INTENT_HIDDEN_RISK = "biggest_hidden_risk"
INTENT_CONNECTION = "connection_explanation"
INTENT_SECTOR = "sector_exposure"
INTENT_SUMMARY = "portfolio_summary"
INTENT_UNSUPPORTED = "unsupported"

SUPPORTED_MESSAGE = (
    "This demo can answer four kinds of questions. Ask about your biggest "
    "hidden risk, why two companies are connected, why you have exposure to a "
    "sector, or for a summary of what the portfolio owns. Please rephrase your "
    "question as one of those."
)

QUERY_SYSTEM_PROMPT = (
    "You answer questions about a single curated demo portfolio for blind and "
    "low-vision investors. Use only the supplied context. Answer in two to five "
    "short spoken sentences. No markdown. No bullet lists. Never refer to "
    "visuals or say 'as shown', 'on the screen', 'in the graph', or 'see'. If "
    "the context does not contain a requested connection, say clearly that no "
    "curated connection exists. Do not give investment advice. Do not invent "
    "relationships or facts. Output only the spoken answer."
)

CONNECT_KEYWORDS = (
    "connect",
    "related",
    "relationship",
    "link",
    "associated",
    "tied",
    "correlat",
)
SECTOR_HINTS = ("sector", "industry", "contribute", "exposure to")
RISK_KEYWORDS = (
    "hidden risk",
    "biggest",
    "risk",
    "concentrat",
    "most expos",
    "overexpos",
    "exposure",
    "worried",
    "danger",
)
SUMMARY_KEYWORDS = (
    "what do i own",
    "summar",
    "holdings",
    "what companies",
    "what do i have",
    "list my",
    "portfolio contain",
    "what's in",
    "what is in",
)

TICKER_TOKEN = re.compile(r"\b[A-Za-z]{1,5}\b")
UPPER_TOKEN = re.compile(r"\b[A-Z]{2,5}\b")
STOPWORDS = {
    "AI", "US", "UK", "IT", "IS", "OK", "TV", "PC", "CEO", "AND", "OR",
    "TO", "OF", "IN", "ON", "AT", "BY", "AS", "MY", "DO", "SO", "IF", "BE",
    "NO", "THE",
}


class PortfolioNotFoundError(LookupError):
    """Raised when the requested portfolio does not exist."""


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _known_tickers(session: Session) -> set[str]:
    tickers = set(session.scalars(select(Holding.ticker)).all())
    tickers |= set(session.scalars(select(Exposure.ticker)).all())
    tickers |= set(session.scalars(select(Exposure.exposed_to_ticker)).all())
    return {ticker.upper() for ticker in tickers}


def _extract_tickers(question: str, known: set[str]) -> list[str]:
    """Extract recognized tickers and unknown uppercase ticker-like tokens."""
    found: list[str] = []
    for token in TICKER_TOKEN.findall(question):
        upper = token.upper()
        if upper in known:
            found.append(upper)
        elif token.isupper() and len(token) >= 2 and upper not in STOPWORDS:
            found.append(upper)
    return _dedupe(found)


def _sector_keywords(sectors: list[str]) -> dict[str, str]:
    keywords: dict[str, str] = {}
    for name in sectors:
        for word in re.split(r"[^a-z]+", name.lower()):
            if len(word) < 4:
                continue
            for form in (word, word.rstrip("s")):
                if form:
                    keywords.setdefault(form, name)
    return keywords


def _resolve_sector(question: str, sectors: list[str]) -> str | None:
    lowered = question.lower()
    for keyword, name in _sector_keywords(sectors).items():
        if re.search(rf"\b{re.escape(keyword)}", lowered):
            return name
    return None


def _route(question: str, tickers: list[str], sectors: list[str]) -> str:
    lowered = question.lower()
    if any(k in lowered for k in CONNECT_KEYWORDS) or len(tickers) >= 2:
        return INTENT_CONNECTION
    if _resolve_sector(question, sectors) is not None or any(
        k in lowered for k in SECTOR_HINTS
    ):
        return INTENT_SECTOR
    if any(k in lowered for k in RISK_KEYWORDS):
        return INTENT_HIDDEN_RISK
    if any(k in lowered for k in SUMMARY_KEYWORDS):
        return INTENT_SUMMARY
    return INTENT_UNSUPPORTED


def _narrate(context: dict[str, Any], instruction: str) -> str:
    payload = json.dumps(context, separators=(",", ":"), default=str) + "\n" + instruction
    return _snowflake_generate(
        [
            {"role": "system", "content": QUERY_SYSTEM_PROMPT},
            {"role": "user", "content": payload},
        ]
    )


def _load_holdings(session: Session, portfolio_id: int) -> list[Holding]:
    return list(
        session.scalars(
            select(Holding)
            .where(Holding.portfolio_id == portfolio_id)
            .order_by(Holding.id)
        ).all()
    )


def _load_edges(session: Session, held_tickers: set[str]) -> list[Exposure]:
    if not held_tickers:
        return []
    return list(
        session.scalars(
            select(Exposure)
            .where(Exposure.ticker.in_(held_tickers))
            .order_by(Exposure.id)
        ).all()
    )


def _theme_inputs(
    holdings: list[Holding], edges: list[Exposure]
) -> tuple[list[WeightedHolding], list[ThemeEdge]]:
    weighted = [WeightedHolding(h.ticker, h.sector, h.weight) for h in holdings]
    theme_edges = [
        ThemeEdge(e.id, e.ticker, e.exposed_to_ticker, e.exposure_sector, e.note)
        for e in edges
    ]
    return weighted, theme_edges


def _holding_node_id(ticker: str, held: set[str]) -> str:
    return f"holding:{ticker}" if ticker in held else f"external:{ticker}"


def _answer_hidden_risk(
    session: Session, portfolio: Portfolio, holdings: list[Holding]
) -> dict[str, Any]:
    insight = get_portfolio_insight(session, portfolio.id)
    if insight is None:
        return {
            "intent": INTENT_HIDDEN_RISK,
            "answer": "This portfolio has no holdings, so there is no hidden concentration to report.",
            "highlight_node_ids": [],
            "highlight_edge_ids": [],
        }

    context = {
        "question_type": INTENT_HIDDEN_RISK,
        "portfolio": {"id": portfolio.id, "name": portfolio.name},
        "sector": insight.sector,
        "exposure_score": insight.percentage,
        "direct_tickers": insight.direct_tickers,
        "indirect_tickers": insight.indirect_tickers,
        "exposure_notes": insight.exposure_notes,
        "methodology": insight.methodology,
    }
    instruction = (
        "Answer using only the supplied insight. Name the concentrated sector "
        "and the mapped exposure score. Say which companies are held directly "
        "in that sector and which add indirect exposure. Explain briefly why "
        "the connections matter. Do not give investment advice."
    )
    answer = _narrate(context, instruction)

    return {
        "intent": INTENT_HIDDEN_RISK,
        "answer": answer,
        "highlight_node_ids": _dedupe(
            [f"holding:{t}" for t in insight.contributing_tickers]
            + [f"sector:{insight.sector}"]
        ),
        "highlight_edge_ids": [f"exposure:{eid}" for eid in insight.exposure_edge_ids],
    }


def _answer_connection(
    session: Session,
    portfolio: Portfolio,
    holdings: list[Holding],
    tickers: list[str],
    known: set[str],
) -> dict[str, Any]:
    held = {holding.ticker for holding in holdings}
    edges = _load_edges(session, held)
    unknown = [t for t in tickers if t not in known]

    if len(tickers) >= 2:
        wanted = set(tickers)
        focus = [e for e in edges if e.ticker in wanted and e.exposed_to_ticker in wanted]
        connection_exists: bool | None = bool(focus)
    else:
        wanted = set(tickers)
        focus = [
            e
            for e in edges
            if not wanted or e.ticker in wanted or e.exposed_to_ticker in wanted
        ]
        connection_exists = None

    context = {
        "question_type": INTENT_CONNECTION,
        "portfolio": {"id": portfolio.id, "name": portfolio.name},
        "mentioned_tickers": tickers,
        "unknown_tickers": unknown,
        "requested_pair": tickers if len(tickers) >= 2 else None,
        "connection_exists": connection_exists,
        "connections": [
            {
                "edge_id": e.id,
                "source": e.ticker,
                "target": e.exposed_to_ticker,
                "via": e.via,
                "sector": e.exposure_sector,
                "note": e.note,
            }
            for e in focus
        ],
    }
    instruction = (
        "Answer using only the supplied connections. If a requested pair is "
        "listed, explain how the two companies are connected and through what. "
        "If connection_exists is false, or a mentioned ticker is unknown, say "
        "clearly that no curated connection was found. Do not invent links."
    )
    answer = _narrate(context, instruction)

    focus_tickers = [e.ticker for e in focus] + [e.exposed_to_ticker for e in focus]
    node_ids = _dedupe(
        [_holding_node_id(t, held) for t in tickers + focus_tickers if t in known or t in held]
    )
    return {
        "intent": INTENT_CONNECTION,
        "answer": answer,
        "highlight_node_ids": node_ids,
        "highlight_edge_ids": [f"exposure:{e.id}" for e in focus],
    }


def _answer_sector(
    session: Session, portfolio: Portfolio, holdings: list[Holding], question: str
) -> dict[str, Any]:
    sectors = [s.name for s in session.scalars(select(Sector).order_by(Sector.id)).all()]
    resolved = _resolve_sector(question, sectors)
    held = {holding.ticker for holding in holdings}
    edges = _load_edges(session, held)
    weighted, theme_edges = _theme_inputs(holdings, edges)

    if resolved is not None:
        theme = compute_theme_insight(resolved, weighted, theme_edges)
        context = {
            "question_type": INTENT_SECTOR,
            "portfolio": {"id": portfolio.id, "name": portfolio.name},
            "sector": resolved,
            "direct_tickers": theme.direct_tickers,
            "indirect_tickers": theme.indirect_tickers,
            "exposure_score": float(theme.combined_weight * 100),
            "exposure_notes": theme.exposure_notes,
        }
        instruction = (
            "Answer using only the supplied sector exposure. Name the sector "
            "and the companies that contribute directly and indirectly. Use the "
            "curated notes to explain why. Do not give investment advice."
        )
        answer = _narrate(context, instruction)
        return {
            "intent": INTENT_SECTOR,
            "answer": answer,
            "highlight_node_ids": _dedupe(
                [f"holding:{t}" for t in theme.contributing_tickers]
                + [f"sector:{resolved}"]
            ),
            "highlight_edge_ids": [
                f"exposure:{eid}" for eid in theme.exposure_edge_ids
            ],
        }

    all_sectors = sorted(
        {holding.sector for holding in holdings}
        | {e.exposure_sector for e in edges if e.ticker in held}
    )
    breakdown = []
    contributing: list[str] = []
    edge_ids: list[str] = []
    for name in all_sectors:
        theme = compute_theme_insight(name, weighted, theme_edges)
        breakdown.append(
            {
                "sector": name,
                "direct_tickers": theme.direct_tickers,
                "indirect_tickers": theme.indirect_tickers,
                "exposure_score": float(theme.combined_weight * 100),
            }
        )
        contributing.extend(theme.contributing_tickers)
        edge_ids.extend(f"exposure:{eid}" for eid in theme.exposure_edge_ids)

    context = {
        "question_type": INTENT_SECTOR,
        "portfolio": {"id": portfolio.id, "name": portfolio.name},
        "sector": None,
        "sector_breakdown": breakdown,
    }
    instruction = (
        "The question did not name a known sector, so answer using the "
        "supplied sector breakdown. Summarize the portfolio's main sector "
        "exposures and the companies behind them. Do not give investment advice."
    )
    answer = _narrate(context, instruction)
    return {
        "intent": INTENT_SECTOR,
        "answer": answer,
        "highlight_node_ids": _dedupe(
            [f"holding:{t}" for t in contributing]
            + [f"sector:{name}" for name in all_sectors]
        ),
        "highlight_edge_ids": _dedupe(edge_ids),
    }


def _answer_summary(portfolio: Portfolio, holdings: list[Holding]) -> dict[str, Any]:
    context = {
        "question_type": INTENT_SUMMARY,
        "portfolio": {"id": portfolio.id, "name": portfolio.name},
        "holdings": [
            {
                "ticker": h.ticker,
                "company_name": h.company_name,
                "sector": h.sector,
                "weight": h.weight,
            }
            for h in holdings
        ],
    }
    instruction = (
        "Answer using only the supplied holdings. Summarize what the portfolio "
        "owns, naming the main companies with their weights and sectors. This "
        "is a direct holdings summary only; do not discuss hidden or indirect "
        "exposure."
    )
    answer = _narrate(context, instruction)
    return {
        "intent": INTENT_SUMMARY,
        "answer": answer,
        "highlight_node_ids": _dedupe(
            [f"holding:{h.ticker}" for h in holdings]
            + [f"sector:{h.sector}" for h in holdings]
        ),
        "highlight_edge_ids": [],
    }


def answer_portfolio_question(portfolio_id: int, question: str) -> dict[str, Any]:
    """Route a question to one supported intent and return a spoken answer."""
    with SessionLocal() as session:
        portfolio = session.get(Portfolio, portfolio_id)
        if portfolio is None:
            raise PortfolioNotFoundError(f"Portfolio {portfolio_id} was not found.")

        holdings = _load_holdings(session, portfolio_id)
        sectors = [
            s.name for s in session.scalars(select(Sector).order_by(Sector.id)).all()
        ]
        known = _known_tickers(session)
        tickers = _extract_tickers(question, known)
        intent = _route(question, tickers, sectors)

        if intent == INTENT_UNSUPPORTED:
            return {
                "intent": INTENT_UNSUPPORTED,
                "answer": SUPPORTED_MESSAGE,
                "highlight_node_ids": [],
                "highlight_edge_ids": [],
            }
        if intent == INTENT_HIDDEN_RISK:
            return _answer_hidden_risk(session, portfolio, holdings)
        if intent == INTENT_CONNECTION:
            return _answer_connection(session, portfolio, holdings, tickers, known)
        if intent == INTENT_SECTOR:
            return _answer_sector(session, portfolio, holdings, question)
        return _answer_summary(portfolio, holdings)
