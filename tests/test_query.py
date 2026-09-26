"""Tests for deterministic portfolio query handling.

The Snowflake Cortex call is mocked; these tests never hit the network.
"""

from typing import Any

import pytest

from app import query
from app.query import (
    INTENT_CONNECTION,
    INTENT_HIDDEN_RISK,
    INTENT_SECTOR,
    INTENT_SUMMARY,
    INTENT_UNSUPPORTED,
    SUPPORTED_MESSAGE,
    PortfolioNotFoundError,
    _extract_tickers,
    _resolve_sector,
    _route,
    answer_portfolio_question,
)

SECTORS = [
    "Semiconductors",
    "Software",
    "Consumer Staples",
    "Payments",
    "Logistics",
    "E-Commerce & Retail",
    "Automotive",
    "Industrials",
    "Energy",
    "Materials & Mining",
    "Cloud & Data Infrastructure",
    "Battery & Critical Minerals",
]


class NarrateRecorder:
    def __init__(self, answer: str = "Mocked spoken answer.") -> None:
        self.answer = answer
        self.calls: list[tuple[dict[str, Any], str]] = []

    def __call__(self, context: dict[str, Any], instruction: str) -> str:
        self.calls.append((context, instruction))
        return self.answer


@pytest.fixture
def narrate(monkeypatch: pytest.MonkeyPatch) -> NarrateRecorder:
    recorder = NarrateRecorder()
    monkeypatch.setattr(query, "_narrate", recorder)
    return recorder


def test_hidden_risk_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "what is my biggest hidden risk?")

    assert result["intent"] == INTENT_HIDDEN_RISK
    assert result["answer"] == "Mocked spoken answer."
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "sector:Semiconductors" in result["highlight_node_ids"]
    assert "exposure:3" in result["highlight_edge_ids"]
    assert narrate.calls[0][0]["sector"] == "Semiconductors"


def test_connection_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "why is MSFT connected to NVDA?")

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:3"]
    assert "holding:MSFT" in result["highlight_node_ids"]
    assert "holding:NVDA" in result["highlight_node_ids"]
    context = narrate.calls[0][0]
    assert context["connection_exists"] is True
    assert context["connections"][0]["via"] == "supply_chain"


def test_sector_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "why do I have semiconductor exposure?")

    assert result["intent"] == INTENT_SECTOR
    assert narrate.calls[0][0]["sector"] == "Semiconductors"
    assert set(result["highlight_edge_ids"]) == {
        "exposure:1",
        "exposure:2",
        "exposure:3",
        "exposure:4",
        "exposure:5",
    }
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "holding:MSFT" in result["highlight_node_ids"]


def test_sector_intent_without_named_sector(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "which companies contribute to technology exposure?"
    )

    assert result["intent"] == INTENT_SECTOR
    assert narrate.calls[0][0]["sector"] is None
    assert narrate.calls[0][0]["sector_breakdown"]


def test_summary_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "what do I own?")

    assert result["intent"] == INTENT_SUMMARY
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "sector:Software" in result["highlight_node_ids"]
    assert result["highlight_edge_ids"] == []
    assert narrate.calls[0][0]["holdings"]


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("what is my biggest hidden risk?", INTENT_HIDDEN_RISK),
        ("where am I most concentrated?", INTENT_HIDDEN_RISK),
        ("what exposure should I know about?", INTENT_HIDDEN_RISK),
        ("why is MSFT connected to NVDA?", INTENT_CONNECTION),
        ("what connects these companies?", INTENT_CONNECTION),
        ("why do I have semiconductor exposure?", INTENT_SECTOR),
        ("which companies contribute to technology exposure?", INTENT_SECTOR),
        ("what do I own?", INTENT_SUMMARY),
        ("summarize this portfolio", INTENT_SUMMARY),
        ("what is the weather today?", INTENT_UNSUPPORTED),
    ],
)
def test_intent_routing(question: str, expected: str) -> None:
    known = {"MSFT", "NVDA"}
    tickers = _extract_tickers(question, known)
    assert _route(question, tickers, SECTORS) == expected


def test_ticker_extraction() -> None:
    known = {"MSFT", "NVDA", "V", "F"}
    assert _extract_tickers("why is msft connected to NVDA?", known) == ["MSFT", "NVDA"]
    assert _extract_tickers("how is V doing?", known) == ["V"]
    assert _extract_tickers("what do I own?", known) == []


def test_sector_resolution() -> None:
    assert _resolve_sector("semiconductor exposure", SECTORS) == "Semiconductors"
    assert _resolve_sector("cloud and data", SECTORS) == "Cloud & Data Infrastructure"
    assert _resolve_sector("technology", SECTORS) is None


def test_unknown_ticker(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "why is ZZZZ connected to NVDA?")

    assert result["intent"] == INTENT_CONNECTION
    context = narrate.calls[0][0]
    assert context["unknown_tickers"] == ["ZZZZ"]
    assert context["connection_exists"] is False
    assert result["highlight_edge_ids"] == []
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "external:ZZZZ" not in result["highlight_node_ids"]


def test_unsupported_question_does_not_call_snowflake(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "what is the weather today?")

    assert result["intent"] == INTENT_UNSUPPORTED
    assert result["answer"] == SUPPORTED_MESSAGE
    assert result["highlight_node_ids"] == []
    assert result["highlight_edge_ids"] == []
    assert narrate.calls == []


def test_invalid_portfolio_raises(narrate: NarrateRecorder) -> None:
    with pytest.raises(PortfolioNotFoundError):
        answer_portfolio_question(999, "what do I own?")
    assert narrate.calls == []
