"""Pure tests for multi-hop traversal. No database."""

import json
from decimal import Decimal
from pathlib import Path

import pytest

from app.insight import ThemeEdge, WeightedHolding, compute_theme_scores
from app.network import NetEdge, NetHolding, find_paths, neighbourhood, shock, theme_scores

DATA = json.loads(
    (Path(__file__).resolve().parents[1] / "data" / "demo_data.json").read_text()
)
EDGES = [
    NetEdge(e["id"], e["ticker"], e["exposed_to_ticker"], e["via"], e["exposure_sector"], e["note"])
    for e in DATA["exposures"]
]


def _holdings(portfolio_id: int) -> list[NetHolding]:
    portfolio = next(p for p in DATA["portfolios"] if p["id"] == portfolio_id)
    return [
        NetHolding(h["ticker"], h["sector"], Decimal(str(h["weight"])))
        for h in portfolio["holdings"]
    ]


def _edge(edge_id: int, a: str, b: str, sector: str = "Theme") -> NetEdge:
    return NetEdge(edge_id, a, b, "supply_chain", sector, f"{a} needs {b}")


@pytest.mark.parametrize("portfolio_id", [1, 2, 3])
def test_one_hop_themes_match_curated_insight(portfolio_id: int) -> None:
    holdings = _holdings(portfolio_id)
    expected = {
        theme.sector: theme.combined_weight
        for theme in compute_theme_scores(
            [WeightedHolding(h.ticker, h.sector, h.weight) for h in holdings],
            [ThemeEdge(e.id, e.ticker, e.exposed_to_ticker, e.exposure_sector, e.note) for e in EDGES],
        )
    }
    actual = {s.sector: s.score for s in theme_scores(holdings, EDGES, max_hops=1)}
    assert actual == expected


def test_second_hop_adds_discounted_exposure() -> None:
    # NVDA -> DATA_CENTER_FUND -> NEE: NVDA reaches Utilities at hop 2.
    holdings = _holdings(1)
    one = {s.sector: s for s in theme_scores(holdings, EDGES, max_hops=1)}
    two = {s.sector: s for s in theme_scores(holdings, EDGES, max_hops=2, decay=Decimal("0.5"))}

    assert two["Utilities"].score > one["Utilities"].score
    nvda = next(c for c in two["Utilities"].contributions if c.ticker == "NVDA")
    assert nvda.hops == 2
    assert nvda.strength == Decimal("0.5")
    assert nvda.edge_ids == [1, 3]
    # 0.15 NEE direct + 0.20 DCF one hop + 0.5 * (0.20 NVDA + 0.20 PRIVATE_AI_CO)
    assert two["Utilities"].score == Decimal("0.55")


def test_theme_scores_never_exceed_full_weight() -> None:
    for portfolio_id in (1, 2, 3):
        for score in theme_scores(_holdings(portfolio_id), EDGES, max_hops=5, decay=Decimal(1)):
            assert Decimal(0) <= score.score <= Decimal(1)


def test_neighbourhood_depth_one_is_edges_touching_seeds() -> None:
    edges = [_edge(1, "A", "B"), _edge(2, "B", "C"), _edge(3, "C", "D")]
    reach = neighbourhood({"A"}, edges, depth=1)
    assert [e.id for e in reach.edges] == [1]
    assert reach.hop_by_ticker == {"A": 0, "B": 1}

    reach = neighbourhood({"A"}, edges, depth=3)
    assert [e.id for e in reach.edges] == [1, 2, 3]
    assert reach.hop_by_ticker["D"] == 3


def test_neighbourhood_walks_incoming_edges() -> None:
    edges = [_edge(1, "X", "A")]
    reach = neighbourhood({"A"}, edges, depth=1)
    assert reach.hop_by_ticker == {"A": 0, "X": 1}


def test_find_paths_shortest_first_and_directions() -> None:
    edges = [_edge(1, "A", "B"), _edge(2, "C", "B"), _edge(3, "A", "C"), _edge(4, "C", "D")]
    paths = find_paths("A", "B", edges, max_hops=3)
    assert [p.edge_ids for p in paths] == [[1], [3, 2]]
    assert paths[1].tickers == ["A", "C", "B"]
    assert [s.forward for s in paths[1].steps] == [True, True]

    backwards = find_paths("B", "A", edges, max_hops=1)
    assert backwards[0].steps[0].forward is False


def test_find_paths_respects_hop_limit_and_cycles() -> None:
    edges = [_edge(1, "A", "B"), _edge(2, "B", "C"), _edge(3, "C", "A"), _edge(4, "C", "D")]
    assert find_paths("A", "D", edges, max_hops=1) == []
    paths = find_paths("A", "D", edges, max_hops=3)
    assert [p.edge_ids for p in paths] == [[3, 4], [1, 2, 4]]
    assert find_paths("A", "A", edges) == []


def test_curated_multi_hop_route_tesla_to_caterpillar() -> None:
    paths = find_paths("TSLA", "CAT", EDGES, max_hops=3)
    assert paths[0].tickers == ["TSLA", "ALB", "CAT"]
    assert paths[0].edge_ids == [11, 15]


def test_shock_decays_with_distance() -> None:
    hits = {h.ticker: h for h in shock("ALB", _holdings(3), EDGES, max_hops=2)}
    assert hits["ALB"].hops == 0 and hits["ALB"].impact == Decimal(1)
    assert hits["TSLA"].hops == 1 and hits["TSLA"].impact == Decimal("0.5")
    assert hits["CAT"].path.edge_ids == [15]
    assert "XOM" not in hits  # no curated link to Exxon


def test_shock_on_unheld_asset_reaches_holdings() -> None:
    holdings = [NetHolding("A", "S", Decimal("1"))]
    edges = [_edge(1, "A", "SUPPLIER"), _edge(2, "SUPPLIER", "MINE")]
    hits = shock("MINE", holdings, edges, max_hops=3, decay=Decimal("0.5"))
    assert [(h.ticker, h.hops, h.impact) for h in hits] == [("A", 2, Decimal("0.25"))]
    assert shock("MINE", holdings, edges, max_hops=1) == []
