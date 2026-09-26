import copy
from decimal import Decimal

import pytest

from scripts.seed import ALLOWED_VIA, load_demo_data, seed, validate

TOLERANCE = Decimal("0.0001")


@pytest.fixture
def demo_data() -> dict:
    return load_demo_data()


def test_every_portfolio_weights_sum_to_one(demo_data: dict) -> None:
    for portfolio in demo_data["portfolios"]:
        total = sum(Decimal(str(h["weight"])) for h in portfolio["holdings"])
        assert abs(total - Decimal("1")) <= TOLERANCE, portfolio["name"]


def test_weights_are_within_bounds(demo_data: dict) -> None:
    for portfolio in demo_data["portfolios"]:
        for holding in portfolio["holdings"]:
            weight = Decimal(str(holding["weight"]))
            assert Decimal("0") < weight <= Decimal("1")


def test_validate_accepts_curated_data(demo_data: dict) -> None:
    validate(demo_data)


def test_validate_rejects_portfolio_total_not_one(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    data["portfolios"][0]["holdings"][0]["weight"] = 0.99
    with pytest.raises(ValueError, match="AI Infrastructure"):
        validate(data)


def test_validate_rejects_missing_weight(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    del data["portfolios"][1]["holdings"][0]["weight"]
    with pytest.raises(ValueError, match="Housing Ecosystem"):
        validate(data)


def test_validate_rejects_out_of_range_weight(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    data["portfolios"][2]["holdings"][0]["weight"] = 0
    with pytest.raises(ValueError, match="Energy Transition"):
        validate(data)


def test_every_exposure_has_exposure_sector(demo_data: dict) -> None:
    assert demo_data["exposures"]
    for exposure in demo_data["exposures"]:
        assert isinstance(exposure.get("exposure_sector"), str)
        assert exposure["exposure_sector"].strip()


def test_validate_rejects_missing_exposure_sector(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    del data["exposures"][0]["exposure_sector"]
    with pytest.raises(ValueError, match="exposure 1"):
        validate(data)


def test_validate_rejects_empty_exposure_sector(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    data["exposures"][0]["exposure_sector"] = "  "
    with pytest.raises(ValueError, match="exposure 1"):
        validate(data)


def test_energy_transition_expected_insight() -> None:
    data = load_demo_data()
    portfolio = next(p for p in data["portfolios"] if p["id"] == 3)
    insight = portfolio["expected_insight"]
    assert insight["direct_tickers"] == ["ALB"]
    assert insight["indirect_tickers"] == ["TSLA", "GM", "F", "ENPH"]
    assert insight["exposure_edge_ids"] == [11, 12, 13, 14]


def test_all_demo_exposures_pass_validation(demo_data: dict) -> None:
    validate(demo_data)
    for exposure in demo_data["exposures"]:
        assert exposure["via"] in ALLOWED_VIA


def test_unknown_via_fails_validation(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    data["exposures"][0]["via"] = "makes_up_relationships"
    with pytest.raises(ValueError, match="invalid via"):
        validate(data)


def test_legacy_via_values_are_rejected(demo_data: dict) -> None:
    for legacy in ("competitor", "regulatory"):
        data = copy.deepcopy(demo_data)
        data["exposures"][0]["via"] = legacy
        with pytest.raises(ValueError, match="invalid via"):
            validate(data)


def test_synthetic_asset_identifiers_are_accepted(demo_data: dict) -> None:
    validate(demo_data)
    known_identifiers = {
        holding["ticker"]
        for portfolio in demo_data["portfolios"]
        for holding in portfolio["holdings"]
    }
    assert {"DATA_CENTER_FUND", "PRIVATE_AI_CO", "RE_CREDIT_FUND"} <= known_identifiers

    for exposure in demo_data["exposures"]:
        assert isinstance(exposure["ticker"], str) and exposure["ticker"]
        assert isinstance(exposure["exposed_to_ticker"], str)
        assert exposure["exposed_to_ticker"]


def test_validate_accepts_exactly_three_portfolios(demo_data: dict) -> None:
    assert len(demo_data["portfolios"]) == 3
    validate(demo_data)


def test_seed_persists_three_portfolios(demo_data: dict) -> None:
    from app.db import SessionLocal
    from app.models import Portfolio

    validate(demo_data)
    seed(demo_data)

    with SessionLocal() as session:
        names = {p.name for p in session.query(Portfolio).all()}
    assert names == {
        "AI Infrastructure",
        "Housing Ecosystem",
        "Energy Transition",
    }
