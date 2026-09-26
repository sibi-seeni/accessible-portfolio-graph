import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Exposure

client = TestClient(app)

PORTFOLIOS = {
    1: {
        "name": "AI Growth",
        "holding_tickers": {"NVDA", "TSM", "ASML", "MSFT", "GOOGL", "ORCL"},
        "sectors": {"Semiconductors", "Software"},
        "exposure_edges": 5,
        "via_counts": {"supply_chain": 5},
    },
    2: {
        "name": "Everyday Diversified",
        "holding_tickers": {"PG", "KO", "V", "MA", "UPS", "AMZN", "CRM"},
        "sectors": {
            "Consumer Staples",
            "Payments",
            "Logistics",
            "E-Commerce & Retail",
            "Software",
        },
        "exposure_edges": 4,
        "via_counts": {"supply_chain": 3, "competitor": 1},
    },
    3: {
        "name": "Energy Transition",
        "holding_tickers": {"TSLA", "GM", "F", "CAT", "XOM", "ENPH", "ALB"},
        "sectors": {"Automotive", "Industrials", "Energy", "Materials & Mining"},
        "exposure_edges": 6,
        "via_counts": {"supply_chain": 5, "regulatory": 1},
    },
}


def test_list_portfolios() -> None:
    response = client.get("/portfolios")
    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "AI Growth"},
        {"id": 2, "name": "Everyday Diversified"},
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

    for edge_id in ("exposure:10", "exposure:11", "exposure:12", "exposure:13"):
        assert exposure_edges[edge_id]["exposure_sector"] == "Battery & Critical Minerals"
    assert exposure_edges["exposure:14"]["exposure_sector"] == "Industrials"
    assert exposure_edges["exposure:15"]["exposure_sector"] == "Automotive"

    for edge in exposure_edges.values():
        assert edge["exposure_sector"]

    for edge in graph["edges"]:
        if edge["type"] == "belongs_to_sector":
            assert "exposure_sector" not in edge


def test_seeded_exposures_persist_exposure_sector() -> None:
    with SessionLocal() as session:
        exposures = session.query(Exposure).all()

    assert len(exposures) == 15
    assert all(exposure.exposure_sector for exposure in exposures)
