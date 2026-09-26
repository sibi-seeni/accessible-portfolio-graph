"""Tests for deterministic portfolio query handling.

The Snowflake Cortex call is mocked; these tests never hit the network.
"""

from typing import Any

import pytest

from app import query
from app.db import SessionLocal
from app.query import (
    INTENT_CONNECTION,
    INTENT_HIDDEN_RISK,
    INTENT_SECTOR,
    INTENT_SUMMARY,
    INTENT_UNSUPPORTED,
    SUPPORTED_MESSAGE,
    PortfolioNotFoundError,
    _extract_entities,
    _extract_tickers,
    _extract_unknown_tokens,
    _known_tickers,
    _load_holdings,
    _resolve_sector,
    _route,
    answer_portfolio_question,
)

SECTORS = [
    "Semiconductors",
    "Software",
    "Digital Infrastructure",
    "Utilities",
    "Energy Infrastructure",
    "Homebuilding",
    "Residential Real Estate",
    "Real Estate Credit",
    "Financials",
    "Automotive",
    "Industrials",
    "Energy",
    "Materials & Mining",
    "Battery & Critical Minerals",
]

SYNTHETIC_NAMES = {
    "DATA_CENTER_FUND": "Hyperscale Data Center Fund",
    "PRIVATE_AI_CO": "Private AI Software Co.",
    "INFRA_FUND": "Renewable Infrastructure Fund",
    "RE_CREDIT_FUND": "Real Estate Credit Fund",
    "MULTIFAMILY_FUND": "Multifamily Housing Fund",
    "PRIVATE_HOMEBUILDER": "Sunbelt Residential Partners",
}


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
    result = answer_portfolio_question(1, "what is my biggest hidden exposure?")

    assert result["intent"] == INTENT_HIDDEN_RISK
    assert result["answer"] == "Mocked spoken answer."
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "holding:PRIVATE_AI_CO" in result["highlight_node_ids"]
    assert "sector:Digital Infrastructure" in result["highlight_node_ids"]
    assert set(result["highlight_edge_ids"]) == {"exposure:1", "exposure:2"}

    context, instruction = narrate.calls[0]
    assert context["sector"] == "Digital Infrastructure"
    assert context["exposure_score"] == 60.0
    direct_names = {h["name"] for h in context["direct_holdings"]}
    assert direct_names == {"Hyperscale Data Center Fund"}
    assert "display names" in instruction


def test_connection_intent_nvidia_to_data_center_fund(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "Why is NVIDIA connected to the data center fund?"
    )

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:1"]
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]

    context, instruction = narrate.calls[0]
    assert context["connection_exists"] is True
    connection = context["connections"][0]
    assert connection["source_name"] == "NVIDIA Corporation"
    assert connection["target_name"] == SYNTHETIC_NAMES["DATA_CENTER_FUND"]
    assert connection["via"] == "demand_driver"
    assert "display names" in instruction


def test_connection_intent_real_estate_credit_to_multifamily(
    narrate: NarrateRecorder,
) -> None:
    result = answer_portfolio_question(
        2, "Why is the real estate credit fund related to the multifamily investment?"
    )

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:8", "exposure:10"]
    assert "holding:RE_CREDIT_FUND" in result["highlight_node_ids"]
    assert "holding:MULTIFAMILY_FUND" in result["highlight_node_ids"]

    context = narrate.calls[0][0]
    assert context["connection_exists"] is True
    names = {
        (c["source_name"], c["target_name"]) for c in context["connections"]
    }
    assert ("Real Estate Credit Fund", "Multifamily Housing Fund") in names
    assert context["connections"][0]["note"]


def test_lookup_by_synthetic_id(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "How is DATA_CENTER_FUND connected to NVDA?"
    )

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:1"]
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert narrate.calls[0][0]["connection_exists"] is True


def test_lookup_by_human_readable_name(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "How is the hyperscale data center fund connected to nvidia?"
    )

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:1"]
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]
    assert "holding:NVDA" in result["highlight_node_ids"]


def test_private_homebuilder_connection(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        2, "How is the private homebuilder connected to the multifamily fund?"
    )

    assert result["intent"] == INTENT_CONNECTION
    assert result["highlight_edge_ids"] == ["exposure:7"]
    assert "holding:PRIVATE_HOMEBUILDER" in result["highlight_node_ids"]
    assert "holding:MULTIFAMILY_FUND" in result["highlight_node_ids"]


def test_sector_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "why do I have digital infrastructure exposure?"
    )

    assert result["intent"] == INTENT_SECTOR
    context = narrate.calls[0][0]
    assert context["sector"] == "Digital Infrastructure"
    assert set(result["highlight_edge_ids"]) == {"exposure:1", "exposure:2"}
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "sector:Digital Infrastructure" in result["highlight_node_ids"]


def test_sector_intent_without_named_sector(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(
        1, "which holdings contribute to technology exposure?"
    )

    assert result["intent"] == INTENT_SECTOR
    assert narrate.calls[0][0]["sector"] is None
    assert narrate.calls[0][0]["sector_breakdown"]


def test_summary_intent(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "what do I own?")

    assert result["intent"] == INTENT_SUMMARY
    assert "holding:NVDA" in result["highlight_node_ids"]
    assert "holding:DATA_CENTER_FUND" in result["highlight_node_ids"]
    assert "sector:Software" in result["highlight_node_ids"]
    assert result["highlight_edge_ids"] == []
    assert narrate.calls[0][0]["holdings"]


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("what is my biggest hidden risk?", INTENT_HIDDEN_RISK),
        ("where am I most concentrated?", INTENT_HIDDEN_RISK),
        ("what exposure should I know about?", INTENT_HIDDEN_RISK),
        ("why is NVIDIA connected to the data center fund?", INTENT_CONNECTION),
        ("what connects these holdings?", INTENT_CONNECTION),
        ("why do I have digital infrastructure exposure?", INTENT_SECTOR),
        ("which holdings contribute to technology exposure?", INTENT_SECTOR),
        ("what do I own?", INTENT_SUMMARY),
        ("summarize this portfolio", INTENT_SUMMARY),
        ("what is the weather today?", INTENT_UNSUPPORTED),
    ],
)
def test_intent_routing(question: str, expected: str) -> None:
    known = {"NVDA", "DATA_CENTER_FUND"}
    tokens = _extract_tickers(question, known)
    assert _route(question, tokens, SECTORS) == expected


def test_ticker_extraction() -> None:
    known = {"NVDA", "TSLA", "F"}
    assert _extract_tickers("why is tsla connected to NVDA?", known) == ["TSLA", "NVDA"]
    assert _extract_tickers("how is F doing?", known) == ["F"]
    assert _extract_tickers("what do I own?", known) == []


def test_entity_extraction_by_id_and_name() -> None:
    with SessionLocal() as session:
        holdings = _load_holdings(session, 2)

    assert set(
        _extract_entities("Why is RE_CREDIT_FUND related to MULTIFAMILY_FUND?", holdings)
    ) == {"MULTIFAMILY_FUND", "RE_CREDIT_FUND"}
    assert set(
        _extract_entities(
            "how is the real estate credit fund connected to the multifamily fund?",
            holdings,
        )
    ) == {"MULTIFAMILY_FUND", "RE_CREDIT_FUND"}
    assert _extract_entities("what do I own?", holdings) == []


def test_unknown_entity_detection() -> None:
    with SessionLocal() as session:
        known = _known_tickers(session)
    assert _extract_unknown_tokens("why is ZZZZ connected to NVDA?", known) == ["ZZZZ"]
    assert _extract_unknown_tokens("what do I own?", known) == []


def test_sector_resolution() -> None:
    assert _resolve_sector("digital infrastructure exposure", SECTORS) == (
        "Digital Infrastructure"
    )
    assert _resolve_sector("battery and minerals", SECTORS) == (
        "Battery & Critical Minerals"
    )
    assert _resolve_sector("technology", SECTORS) is None


def test_unsupported_entity(narrate: NarrateRecorder) -> None:
    result = answer_portfolio_question(1, "why is ZZZZ connected to NVDA?")

    assert result["intent"] == INTENT_CONNECTION
    context = narrate.calls[0][0]
    assert context["unknown_identifiers"] == ["ZZZZ"]
    assert context["connection_exists"] is False
    assert context["connections"] == []
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
