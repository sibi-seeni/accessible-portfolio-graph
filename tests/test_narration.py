"""Unit tests for Snowflake Cortex narration.

The OpenAI client is fully mocked. These tests require no Snowflake credentials
and make no network calls.
"""

from types import SimpleNamespace

import pytest

from app.config import Settings
from app.insight import get_portfolio_insight
from app.narration import (
    NarrationError,
    _base_url,
    generate_holdings_narration,
    generate_risk_narration,
)
from app.db import SessionLocal
from app import narration


class FakeCompletions:
    def __init__(self, owner: "FakeClient") -> None:
        self._owner = owner

    def create(self, **kwargs):
        self._owner.calls.append(kwargs)
        model = kwargs.get("model")
        if model in self._owner.fail_models:
            raise RuntimeError(f"model {model} is unavailable")
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=self._owner.content)
                )
            ]
        )


class FakeClient:
    def __init__(self, content: str = "Spoken narration.", fail_models=()) -> None:
        self.calls: list[dict] = []
        self.content = content
        self.fail_models = set(fail_models)
        self.chat = SimpleNamespace(completions=FakeCompletions(self))


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> FakeClient:
    client = FakeClient()
    monkeypatch.setattr(narration, "_build_client", lambda: client)
    return client


def test_base_url_uses_cortex_path(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        snowflake_account_url="https://acct.snowflakecomputing.com",
        snowflake_pat="pat",
    )
    monkeypatch.setattr(narration, "get_settings", lambda: settings)
    assert (
        _base_url()
        == "https://acct.snowflakecomputing.com/api/v2/cortex/v1"
    )


def test_base_url_requires_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        narration,
        "get_settings",
        lambda: Settings(snowflake_account_url=None, snowflake_pat=None),
    )
    with pytest.raises(NarrationError, match="SNOWFLAKE_ACCOUNT_URL"):
        _base_url()


def test_holdings_narration_returns_model_text(fake_client: FakeClient) -> None:
    result = generate_holdings_narration(1)
    assert result == "Spoken narration."


def test_holdings_narration_prompt_contains_structured_holdings(
    fake_client: FakeClient,
) -> None:
    generate_holdings_narration(1)
    call = fake_client.calls[0]
    user_content = call["messages"][1]["content"]
    system_content = call["messages"][0]["content"]

    assert "NVDA" in user_content
    assert "DATA_CENTER_FUND" in user_content
    assert "NVIDIA Corporation" in user_content
    assert "AI Infrastructure" in user_content
    assert "holdings_overview" in user_content
    assert "blind and low-vision investors" in system_content
    assert "complete source of truth" in system_content


def test_prompts_understand_cross_asset_holdings(fake_client: FakeClient) -> None:
    generate_holdings_narration(1)
    instruction = fake_client.calls[0]["messages"][1]["content"]
    system_content = fake_client.calls[0]["messages"][0]["content"]

    for phrase in (
        "private equity",
        "real estate",
        "private credit",
        "infrastructure",
    ):
        assert phrase in system_content

    assert "holdings, assets, or investments" in system_content
    assert "internal IDs" in system_content
    assert "company_name" in system_content
    assert "never read a synthetic identifier aloud" in system_content
    assert "fund structures" in system_content
    assert "borrowers" in system_content
    assert "tenants" in system_content
    assert "do not call every holding a company or a stock" in system_content
    assert "mix of holdings, asset types, and sectors" in instruction


def test_risk_narration_prompt_contains_insight(fake_client: FakeClient) -> None:
    with SessionLocal() as session:
        insight = get_portfolio_insight(session, 3)
    assert insight is not None

    generate_risk_narration(3, insight)
    user_content = fake_client.calls[0]["messages"][1]["content"]

    assert "Battery & Critical Minerals" in user_content
    assert "direct_tickers" in user_content
    assert "indirect_tickers" in user_content
    assert '"TSLA"' in user_content


def test_temperature_is_low_randomness(fake_client: FakeClient) -> None:
    generate_holdings_narration(1)
    assert fake_client.calls[0]["temperature"] == 0.0


def test_primary_model_is_used_first(
    fake_client: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        narration,
        "get_settings",
        lambda: Settings(snowflake_model="primary", snowflake_fallback_model="backup"),
    )
    generate_holdings_narration(1)
    assert fake_client.calls[0]["model"] == "primary"


def test_fallback_model_used_when_primary_fails(
    fake_client: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_client.fail_models = {"primary"}
    monkeypatch.setattr(
        narration,
        "get_settings",
        lambda: Settings(snowflake_model="primary", snowflake_fallback_model="backup"),
    )
    result = generate_holdings_narration(1)
    assert result == "Spoken narration."
    assert [call["model"] for call in fake_client.calls] == ["primary", "backup"]


def test_raises_when_all_models_fail(
    fake_client: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_client.fail_models = {"primary", "backup"}
    monkeypatch.setattr(
        narration,
        "get_settings",
        lambda: Settings(snowflake_model="primary", snowflake_fallback_model="backup"),
    )
    with pytest.raises(NarrationError, match="every configured model"):
        generate_holdings_narration(1)
    assert [call["model"] for call in fake_client.calls] == ["primary", "backup"]


def test_empty_model_output_falls_back(
    fake_client: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_client.content = "   "
    monkeypatch.setattr(
        narration,
        "get_settings",
        lambda: Settings(snowflake_model="primary", snowflake_fallback_model="backup"),
    )
    with pytest.raises(NarrationError, match="every configured model"):
        generate_holdings_narration(1)
    assert [call["model"] for call in fake_client.calls] == ["primary", "backup"]


def test_unknown_portfolio_raises(fake_client: FakeClient) -> None:
    with pytest.raises(NarrationError, match="was not found"):
        generate_holdings_narration(999)
