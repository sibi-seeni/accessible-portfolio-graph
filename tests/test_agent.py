"""Connection agent tool loop with a scripted fake model. No network access."""

import json
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, or_

from app import agent
from app.db import SessionLocal
from app.main import app
from app.models import Company, Exposure

client = TestClient(app)


def _call(call_id: str, name: str, **arguments: Any) -> SimpleNamespace:
    return SimpleNamespace(
        id=call_id,
        function=SimpleNamespace(name=name, arguments=json.dumps(arguments)),
    )


class ScriptedClient:
    """Returns one scripted assistant message per completion request."""

    def __init__(self, turns: list[list[SimpleNamespace]]) -> None:
        self.turns = list(turns)
        self.requests: list[dict[str, Any]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        self.requests.append(json.loads(json.dumps(kwargs, default=str)))
        calls = self.turns.pop(0) if self.turns else []
        message = SimpleNamespace(content="" if calls else "Nothing else to add.", tool_calls=calls or None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


@pytest.fixture(autouse=True)
def cleanup() -> Iterator[None]:
    def wipe() -> None:
        with SessionLocal() as session, session.begin():
            session.execute(
                delete(Exposure).where(
                    or_(Exposure.ticker.like("ZZT%"), Exposure.exposed_to_ticker.like("ZZT%"))
                )
            )
            session.execute(delete(Company).where(Company.ticker.like("ZZT%")))

    wipe()
    yield
    wipe()


def _run(turns: list[list[SimpleNamespace]], instruction: str = "Connect ZZTSMC") -> tuple[Any, ScriptedClient]:
    fake = ScriptedClient(turns)
    with SessionLocal() as session:
        result = agent.run_agent(session, instruction, portfolio_id=1, client=fake, models=["fake-model"])
    return result, fake


def test_agent_proposes_company_and_links_then_finishes() -> None:
    result, fake = _run(
        [
            [_call("1", "search_companies", query="NVDA"), _call("2", "list_sectors")],
            [
                _call(
                    "3", "propose_company", ticker="ZZTSMC", company_name="Test Foundry",
                    sector="Semiconductors", asset_class="public_equity", description="Contract chipmaker.",
                )
            ],
            [
                _call(
                    "4", "propose_exposure", ticker="NVDA", exposed_to_ticker="ZZTSMC",
                    via="supply_chain", exposure_sector="Semiconductors",
                    note="NVIDIA outsources wafer fabrication.", confidence=0.95,
                ),
                _call(
                    "5", "propose_exposure", ticker="NVDA", exposed_to_ticker="ZZTSMC",
                    via="supply_chain", exposure_sector="Semiconductors", note="dup", confidence=0.9,
                ),
                _call(
                    "6", "propose_exposure", ticker="NVDA", exposed_to_ticker="ZZTSMC",
                    via="demand_driver", exposure_sector="Semiconductors", note="weak", confidence=0.2,
                ),
            ],
            [_call("7", "finish", summary="Proposed the foundry and one supply link.")],
        ]
    )

    assert result.summary == "Proposed the foundry and one supply link."
    assert result.model == "fake-model"
    assert result.proposed_company_tickers == ["ZZTSMC"]
    assert len(result.proposed_exposure_ids) == 1
    assert [step.tool for step in result.steps] == [
        "search_companies", "list_sectors", "propose_company",
        "propose_exposure", "propose_exposure", "propose_exposure", "finish",
    ]
    assert "error" in result.steps[4].result  # duplicate rejected, run continued
    assert result.steps[5].result == {"skipped": "confidence below 0.5"}

    # Tool results are fed back with matching ids, and tools are advertised.
    second_request = fake.requests[1]
    assert {t["function"]["name"] for t in second_request["tools"]} >= {"propose_exposure", "finish"}
    assert second_request["messages"][-1]["role"] == "tool"
    assert second_request["messages"][-1]["tool_call_id"] == "2"

    with SessionLocal() as session:
        company = session.get(Company, "ZZTSMC")
        exposure = session.get(Exposure, result.proposed_exposure_ids[0])
        assert company.status == "proposed" and company.source == "agent"
        assert exposure.status == "proposed" and exposure.confidence == 0.95

    # Proposals do not leak into the curated insight.
    insight = client.get("/portfolio/1/insight").json()
    assert insight["percentage"] == 60.0


def test_agent_handles_unknown_tools_and_bad_arguments() -> None:
    result, _ = _run(
        [
            [_call("1", "drop_tables"), _call("2", "get_company", nope=True)],
            [_call("3", "get_company", ticker="ZZTNOPE")],
        ]
    )
    assert result.steps[0].result == {"error": "Unknown tool 'drop_tables'."}
    assert "Bad arguments" in result.steps[1].result["error"]
    assert "not in the graph" in result.steps[2].result["error"]
    assert result.summary == "Nothing else to add."


def test_agent_endpoint_returns_503_without_model(monkeypatch: pytest.MonkeyPatch) -> None:
    def unavailable() -> Any:
        raise agent.AgentUnavailableError("not configured")

    monkeypatch.setattr(agent, "build_agent_client", unavailable)
    response = client.post("/agent/run", json={"instruction": "Add TSMC"})
    assert response.status_code == 503
    assert response.json()["detail"] == "not configured"


def test_agent_cannot_call_internal_attributes() -> None:
    result, _ = _run([[_call("1", "call", tool="finish"), _call("2", "session")]])
    assert result.steps[0].result == {"error": "Unknown tool 'call'."}
    assert result.steps[1].result == {"error": "Unknown tool 'session'."}
