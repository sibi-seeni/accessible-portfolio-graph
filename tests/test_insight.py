from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.insight import ThemeEdge, WeightedHolding, compute_strongest_theme, compute_theme_insight
from app.main import app
from scripts.seed import load_demo_data

client = TestClient(app)


@pytest.fixture
def demo_data() -> dict:
    return load_demo_data()


def test_all_portfolios_return_an_insight() -> None:
    for portfolio_id in (1, 2, 3):
        response = client.get(f"/portfolio/{portfolio_id}/insight")
        assert response.status_code == 200
        assert response.json()["portfolio_id"] == portfolio_id


def test_unknown_portfolio_returns_404() -> None:
    assert client.get("/portfolio/999/insight").status_code == 404


def test_calculated_sector_matches_expected(demo_data: dict) -> None:
    for portfolio in demo_data["portfolios"]:
        body = client.get(f"/portfolio/{portfolio['id']}/insight").json()
        assert body["sector"] == portfolio["expected_insight"]["sector"]


def test_calculated_tickers_and_edges_match_expected(demo_data: dict) -> None:
    for portfolio in demo_data["portfolios"]:
        expected = portfolio["expected_insight"]
        body = client.get(f"/portfolio/{portfolio['id']}/insight").json()
        assert body["direct_tickers"] == expected["direct_tickers"]
        assert body["indirect_tickers"] == expected["indirect_tickers"]
        assert body["exposure_edge_ids"] == expected["exposure_edge_ids"]


@pytest.mark.parametrize("portfolio_id", [1, 2, 3])
def test_insight_shape_and_bounds(portfolio_id: int) -> None:
    body = client.get(f"/portfolio/{portfolio_id}/insight").json()

    assert 0 < body["percentage"] <= 100
    assert body["contributing_tickers"]
    assert body["exposure_notes"]
    assert body["methodology"] == (
        "Curated direct and one-hop indirect exposure score based on portfolio weights."
    )
    assert body["narration"] is None

    assert len(body["contributing_tickers"]) == len(set(body["contributing_tickers"]))
    assert len(body["direct_tickers"]) == len(set(body["direct_tickers"]))
    assert len(body["indirect_tickers"]) == len(set(body["indirect_tickers"]))
    assert set(body["direct_tickers"]).isdisjoint(body["indirect_tickers"])
    assert set(body["contributing_tickers"]) == set(body["direct_tickers"]) | set(
        body["indirect_tickers"]
    )


def test_exposure_edge_ids_are_relevant(demo_data: dict) -> None:
    edges = {edge["id"]: edge for edge in demo_data["exposures"]}
    for portfolio in demo_data["portfolios"]:
        body = client.get(f"/portfolio/{portfolio['id']}/insight").json()
        assert body["exposure_edge_ids"] == sorted(body["exposure_edge_ids"])
        for edge_id in body["exposure_edge_ids"]:
            assert edges[edge_id]["exposure_sector"] == body["sector"]


def test_exposure_notes_match_returned_edges(demo_data: dict) -> None:
    edges = {edge["id"]: edge for edge in demo_data["exposures"]}
    for portfolio in demo_data["portfolios"]:
        body = client.get(f"/portfolio/{portfolio['id']}/insight").json()
        expected_notes: list[str] = []
        for edge_id in body["exposure_edge_ids"]:
            note = edges[edge_id]["note"]
            if note not in expected_notes:
                expected_notes.append(note)
        assert body["exposure_notes"] == expected_notes


def test_energy_transition_breakdown() -> None:
    body = client.get("/portfolio/3/insight").json()
    assert body["sector"] == "Battery & Critical Minerals"
    assert body["percentage"] == 80.0
    assert body["direct_tickers"] == ["ALB"]
    assert body["indirect_tickers"] == ["TSLA", "GM", "F", "ENPH"]
    assert body["contributing_tickers"] == ["ALB", "TSLA", "GM", "F", "ENPH"]
    assert body["exposure_edge_ids"] == [10, 11, 12, 13]


def test_duplicate_edges_do_not_double_count_source_holding() -> None:
    holdings = [
        WeightedHolding("A", "Software", Decimal("0.20")),
        WeightedHolding("B", "Software", Decimal("0.80")),
    ]
    edges = [
        ThemeEdge(1, "A", "X", "Semiconductors", "A depends on X"),
        ThemeEdge(2, "A", "Y", "Semiconductors", "A depends on Y"),
    ]

    result = compute_theme_insight("Semiconductors", holdings, edges)

    assert result.combined_weight == Decimal("0.20")
    assert result.indirect_tickers == ["A"]
    assert result.contributing_tickers == ["A"]
    assert result.exposure_edge_ids == [1, 2]


def test_direct_and_indirect_same_theme_counted_once() -> None:
    holdings = [
        WeightedHolding("A", "Semiconductors", Decimal("0.30")),
        WeightedHolding("B", "Software", Decimal("0.70")),
    ]
    edges = [ThemeEdge(1, "A", "X", "Semiconductors", "A depends on X")]

    result = compute_theme_insight("Semiconductors", holdings, edges)

    assert result.combined_weight == Decimal("0.30")
    assert result.direct_tickers == ["A"]
    assert result.indirect_tickers == []
    assert result.contributing_tickers == ["A"]


def test_no_multi_hop_exposure_is_counted() -> None:
    holdings = [
        WeightedHolding("A", "Software", Decimal("0.40")),
        WeightedHolding("B", "Energy", Decimal("0.60")),
    ]
    edges = [
        ThemeEdge(1, "A", "X", "Semiconductors", "A depends on X"),
        ThemeEdge(2, "X", "Y", "Semiconductors", "X depends on Y"),
    ]

    result = compute_theme_insight("Semiconductors", holdings, edges)

    assert result.combined_weight == Decimal("0.40")
    assert result.indirect_tickers == ["A"]
    assert result.exposure_edge_ids == [1]


def test_target_anchor_counts_as_direct() -> None:
    holdings = [
        WeightedHolding("A", "Software", Decimal("0.40")),
        WeightedHolding("ANCHOR", "Materials & Mining", Decimal("0.60")),
    ]
    edges = [ThemeEdge(1, "A", "ANCHOR", "Battery & Critical Minerals", "A needs ANCHOR")]

    result = compute_theme_insight("Battery & Critical Minerals", holdings, edges)

    assert result.combined_weight == Decimal("1.00")
    assert result.direct_tickers == ["ANCHOR"]
    assert result.indirect_tickers == ["A"]


def test_strongest_theme_selection() -> None:
    holdings = [
        WeightedHolding("A", "Semiconductors", Decimal("0.30")),
        WeightedHolding("B", "Software", Decimal("0.20")),
        WeightedHolding("C", "Software", Decimal("0.50")),
    ]
    edges = [
        ThemeEdge(1, "B", "X", "Semiconductors", "B depends on X"),
        ThemeEdge(2, "C", "X", "Semiconductors", "C depends on X"),
    ]

    result = compute_strongest_theme(holdings, edges)

    assert result is not None
    assert result.sector == "Semiconductors"
    assert result.combined_weight == Decimal("1.00")
