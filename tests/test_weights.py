import copy
from decimal import Decimal

import pytest

from scripts.seed import load_demo_data, validate

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
    with pytest.raises(ValueError, match="AI Growth"):
        validate(data)


def test_validate_rejects_missing_weight(demo_data: dict) -> None:
    data = copy.deepcopy(demo_data)
    del data["portfolios"][1]["holdings"][0]["weight"]
    with pytest.raises(ValueError, match="Everyday Diversified"):
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
    assert insight["exposure_edge_ids"] == [10, 11, 12, 13]
