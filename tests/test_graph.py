import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Exposure

client = TestClient(app)

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_data.json"

PORTFOLIOS = {
    1: {
        "name": "AI Infrastructure",
        "holding_tickers": {"NVDA", "PRIVATE_AI_CO", "DATA_CENTER_FUND", "NEE", "INFRA_FUND"},
        "sectors": {
            "Semiconductors",
            "Software",
            "Digital Infrastructure",
            "Utilities",
            "Energy Infrastructure",
        },
        "exposure_edges": 4,
        "via_counts": {"demand_driver": 2, "operating_dependency": 2},
    },
    2: {
        "name": "Housing Ecosystem",
        "holding_tickers": {
            "LEN",
            "PRIVATE_HOMEBUILDER",
            "MULTIFAMILY_FUND",
            "RE_CREDIT_FUND",
            "JPM",
        },
        "sectors": {
            "Homebuilding",
            "Residential Real Estate",
            "Real Estate Credit",
            "Financials",
        },
        "exposure_edges": 5,
        "via_counts": {
            "housing_cycle": 2,
            "lending": 1,
            "credit_market": 1,
            "financing_dependency": 1,
        },
    },
    3: {
        "name": "Energy Transition",
        "holding_tickers": {"TSLA", "GM", "F", "CAT", "XOM", "ENPH", "ALB"},
        "sectors": {"Automotive", "Industrials", "Energy", "Materials & Mining"},
        "exposure_edges": 5,
        "via_counts": {"supply_chain": 5},
    },
}


@pytest.fixture(scope="module")
def demo_data() -> dict:
    with DATA_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def test_list_portfolios() -> None:
    response = client.get("/portfolios")
    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "AI Infrastructure"},
        {"id": 2, "name": "Housing Ecosystem"},
        {"id": 3, "name": "Energy Transition"},
    ]


def test_unknown_portfolio_returns_404() -> None:
    assert client.get("/portfolio/999/graph").status_code == 404


@pytest.mark.parametrize("portfolio_id", sorted(PORTFOLIOS))
def test_graph_shape(portfolio_id: int) -> None:
    expected = PORTFOLIOS[portfolio_id]
    response = client.get(f"/portfolio/{portfolio_id}/graph")
    assert response.status_code == 200

    graph = response.json()
    assert graph["portfolio_id"] == portfolio_id
    assert graph["portfolio_name"] == expected["name"]

    node_ids = [node["id"] for node in graph["nodes"]]
    assert len(node_ids) == len(set(node_ids))

    holding_tickers = {node["ticker"] for node in graph["nodes"] if node["type"] == "holding"}
    assert holding_tickers == expected["holding_tickers"]
    for node in graph["nodes"]:
        if node["type"] == "holding":
            assert node["sector"] in expected["sectors"]

    sector_labels = {node["label"] for node in graph["nodes"] if node["type"] == "sector"}
    assert sector_labels == expected["sectors"]

    edges = graph["edges"]
    sector_edges = [edge for edge in edges if edge["type"] == "belongs_to_sector"]
    exposure_edges = [edge for edge in edges if edge["type"] != "belongs_to_sector"]

    assert len(sector_edges) == len(expected["holding_tickers"])
    assert {edge["source"] for edge in sector_edges} == {
        f"holding:{ticker}" for ticker in expected["holding_tickers"]
    }
    assert len(exposure_edges) == expected["exposure_edges"]

    via_counts: dict[str, int] = {}
    for edge in exposure_edges:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids
        assert edge["label"] == edge["type"]
        assert edge["note"]
        via_counts[edge["type"]] = via_counts.get(edge["type"], 0) + 1
    assert via_counts == expected["via_counts"]


def test_graph_is_deterministic() -> None:
    first = client.get("/portfolio/1/graph").json()
    second = client.get("/portfolio/1/graph").json()
    assert first == second


def test_graph_holding_nodes_expose_weight() -> None:
    graph = client.get("/portfolio/1/graph").json()
    holding_nodes = [node for node in graph["nodes"] if node["type"] == "holding"]
    assert holding_nodes

    for node in holding_nodes:
        assert "weight" in node
        assert 0 < node["weight"] <= 1

    total = sum(node["weight"] for node in holding_nodes)
    assert abs(total - 1.0) < 1e-6

    for node in graph["nodes"]:
        if node["type"] != "holding":
            assert "weight" not in node


def test_graph_exposure_edges_expose_sector() -> None:
    graph = client.get("/portfolio/3/graph").json()
    exposure_edges = {
        edge["id"]: edge for edge in graph["edges"] if edge["type"] != "belongs_to_sector"
    }

    for edge_id in ("exposure:11", "exposure:12", "exposure:13", "exposure:14"):
        assert exposure_edges[edge_id]["exposure_sector"] == "Battery & Critical Minerals"
    assert exposure_edges["exposure:15"]["exposure_sector"] == "Industrials"

    for edge in exposure_edges.values():
        assert edge["exposure_sector"]

    for edge in graph["edges"]:
        if edge["type"] == "belongs_to_sector":
            assert "exposure_sector" not in edge


def test_seeded_exposures_persist_exposure_sector() -> None:
    with SessionLocal() as session:
        exposures = session.query(Exposure).all()

    assert len(exposures) == 14
    assert all(exposure.exposure_sector for exposure in exposures)


@pytest.mark.parametrize("portfolio_id", sorted(PORTFOLIOS))
def test_holding_labels_use_company_name(portfolio_id: int, demo_data: dict) -> None:
    portfolio = next(p for p in demo_data["portfolios"] if p["id"] == portfolio_id)
    expected_labels = {h["ticker"]: h["company_name"] for h in portfolio["holdings"]}

    graph = client.get(f"/portfolio/{portfolio_id}/graph").json()
    holding_nodes = {node["ticker"]: node for node in graph["nodes"] if node["type"] == "holding"}

    assert set(holding_nodes) == set(expected_labels)
    for ticker, label in expected_labels.items():
        assert holding_nodes[ticker]["label"] == label


def test_data_center_fund_appears_once() -> None:
    graph = client.get("/portfolio/1/graph").json()
    matches = [node for node in graph["nodes"] if node.get("ticker") == "DATA_CENTER_FUND"]
    assert len(matches) == 1
    assert matches[0]["id"] == "holding:DATA_CENTER_FUND"
    assert matches[0]["label"] == "Hyperscale Data Center Fund"
    assert not any(node["id"].startswith("external:") for node in graph["nodes"])


def test_re_credit_fund_appears_once() -> None:
    graph = client.get("/portfolio/2/graph").json()
    matches = [node for node in graph["nodes"] if node.get("ticker") == "RE_CREDIT_FUND"]
    assert len(matches) == 1
    assert matches[0]["id"] == "holding:RE_CREDIT_FUND"
    assert matches[0]["label"] == "Real Estate Credit Fund"
    assert not any(node["id"].startswith("external:") for node in graph["nodes"])


def test_exposure_target_that_is_a_holding_reuses_holding_node() -> None:
    graph = client.get("/portfolio/2/graph").json()
    edges = {edge["id"]: edge for edge in graph["edges"]}

    assert edges["exposure:9"]["source"] == "holding:JPM"
    assert edges["exposure:9"]["target"] == "holding:RE_CREDIT_FUND"
    assert edges["exposure:8"]["target"] == "holding:MULTIFAMILY_FUND"

    node_ids = {node["id"] for node in graph["nodes"]}
    assert "holding:RE_CREDIT_FUND" in node_ids
    assert "holding:MULTIFAMILY_FUND" in node_ids
    assert "external:RE_CREDIT_FUND" not in node_ids
    assert "external:MULTIFAMILY_FUND" not in node_ids


@pytest.mark.parametrize("portfolio_id", sorted(PORTFOLIOS))
def test_synthetic_assets_follow_same_graph_path(portfolio_id: int) -> None:
    graph = client.get(f"/portfolio/{portfolio_id}/graph").json()
    expected = PORTFOLIOS[portfolio_id]
    synthetic = {t for t in expected["holding_tickers"] if "_" in t}

    nodes_by_id = {node["id"]: node for node in graph["nodes"]}
    for ticker in synthetic:
        node = nodes_by_id[f"holding:{ticker}"]
        assert node["type"] == "holding"
        assert node["ticker"] == ticker
        assert node["sector"] in expected["sectors"]
        assert node["label"]
        assert any(
            edge["id"] == f"belongs_to_sector:{ticker}"
            and edge["source"] == node["id"]
            for edge in graph["edges"]
        )
