"""Write endpoints, multi-hop endpoints and proposal review against the real DB.

Every row created here uses a ZZT* identifier inside a throwaway portfolio and
is removed afterwards, so the seeded demo data is left untouched.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, or_

from app.db import SessionLocal
from app.main import app
from app.models import Company, Exposure, Holding, Portfolio, Sector

client = TestClient(app)
THEME = "ZZT Test Theme"


def _cleanup() -> None:
    with SessionLocal() as session, session.begin():
        session.execute(
            delete(Exposure).where(
                or_(Exposure.ticker.like("ZZT%"), Exposure.exposed_to_ticker.like("ZZT%"))
            )
        )
        session.execute(delete(Holding).where(Holding.ticker.like("ZZT%")))
        test_ids = [
            p.id
            for p in session.query(Portfolio).filter(Portfolio.name.like("ZZT%")).all()
        ]
        session.execute(delete(Holding).where(Holding.portfolio_id.in_(test_ids)))
        session.execute(delete(Portfolio).where(Portfolio.id.in_(test_ids)))
        session.execute(delete(Company).where(Company.ticker.like("ZZT%")))
        session.execute(delete(Sector).where(Sector.name.like("ZZT%")))


@pytest.fixture()
def sandbox() -> Iterator[int]:
    _cleanup()
    response = client.post("/portfolios", json={"name": "ZZT Sandbox"})
    assert response.status_code == 201
    yield response.json()["id"]
    _cleanup()


def _company(ticker: str, sector: str = "Semiconductors", asset_class: str = "public_equity") -> None:
    response = client.post(
        "/companies",
        json={"ticker": ticker, "company_name": f"{ticker} Inc.", "sector": sector, "asset_class": asset_class},
    )
    assert response.status_code == 201, response.text


def _link(a: str, b: str, via: str = "supply_chain", sector: str = THEME) -> int:
    response = client.post(
        "/exposures",
        json={"ticker": a, "exposed_to_ticker": b, "via": via, "exposure_sector": sector, "note": f"{a} depends on {b}."},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_add_holdings_rebalances_to_one(sandbox: int) -> None:
    _company("ZZTA")
    _company("ZZTB")
    first = client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTA", "weight": 0.3})
    assert first.status_code == 201
    assert first.json()[0]["weight"] == 1.0  # first holding takes the whole book

    second = client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTB", "weight": 0.25})
    weights = {h["ticker"]: h["weight"] for h in second.json()}
    assert weights == {"ZZTA": 0.75, "ZZTB": 0.25}

    duplicate = client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTB", "weight": 0.1})
    assert duplicate.status_code == 409

    remaining = client.delete(f"/portfolio/{sandbox}/holdings/ZZTB").json()
    assert remaining == [
        {"ticker": "ZZTA", "company_name": "ZZTA Inc.", "sector": "Semiconductors", "weight": 1.0, "shares": 1}
    ]


def test_validation_errors(sandbox: int) -> None:
    bad_class = client.post(
        "/companies",
        json={"ticker": "ZZTX", "company_name": "X", "sector": "Software", "asset_class": "crypto"},
    )
    assert bad_class.status_code == 400
    _company("ZZTX")
    assert client.post(
        "/companies",
        json={"ticker": "zztx", "company_name": "X", "sector": "Software", "asset_class": "public_equity"},
    ).status_code == 409
    unknown = client.post(
        "/exposures",
        json={"ticker": "ZZTX", "exposed_to_ticker": "ZZTNOPE", "via": "supply_chain", "exposure_sector": THEME, "note": "n"},
    )
    assert unknown.status_code == 404
    bad_via = client.post(
        "/exposures",
        json={"ticker": "ZZTX", "exposed_to_ticker": "NVDA", "via": "competitor", "exposure_sector": THEME, "note": "n"},
    )
    assert bad_via.status_code == 400
    assert client.delete("/exposures/1").status_code == 409  # curated rows are protected


def test_depth_expands_graph_and_paths_find_route(sandbox: int) -> None:
    for ticker in ("ZZTA", "ZZTB", "ZZTC"):
        _company(ticker)
    client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTA", "weight": 0.5})
    first = _link("ZZTA", "ZZTB")
    second = _link("ZZTB", "ZZTC")

    shallow = client.get(f"/portfolio/{sandbox}/graph").json()
    assert {n["id"] for n in shallow["nodes"]} >= {"holding:ZZTA", "external:ZZTB"}
    assert "external:ZZTC" not in {n["id"] for n in shallow["nodes"]}

    deep = client.get(f"/portfolio/{sandbox}/graph", params={"depth": 2}).json()
    external = {n["id"]: n for n in deep["nodes"] if n["type"] == "exposure"}
    assert external["external:ZZTC"]["hop"] == 2
    assert external["external:ZZTC"]["label"] == "ZZTC Inc."
    edge = next(e for e in deep["edges"] if e["id"] == f"exposure:{second}")
    assert edge["origin"] == "user" and edge["status"] == "approved"

    paths = client.get(
        f"/portfolio/{sandbox}/paths", params={"source": "ZZTA", "target": "ZZTC"}
    ).json()["paths"]
    assert paths[0]["edge_ids"] == [f"exposure:{first}", f"exposure:{second}"]
    assert paths[0]["node_ids"] == ["holding:ZZTA", "external:ZZTB", "external:ZZTC"]

    assert client.get(
        f"/portfolio/{sandbox}/paths", params={"source": "ZZTA", "target": "ZZTNOPE"}
    ).status_code == 404


def test_themes_and_shock_endpoints(sandbox: int) -> None:
    for ticker in ("ZZTA", "ZZTB", "ZZTC"):
        _company(ticker)
    client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTA", "weight": 0.5})
    _link("ZZTA", "ZZTB", sector="Software")
    _link("ZZTB", "ZZTC", sector=THEME)

    themes = client.get(f"/portfolio/{sandbox}/themes", params={"max_hops": 2}).json()
    by_sector = {t["sector"]: t for t in themes["themes"]}
    assert by_sector[THEME]["percentage"] == 50.0  # 1.0 weight * 0.5 decay
    assert by_sector[THEME]["one_hop_percentage"] == 0.0
    assert by_sector[THEME]["contributions"][0]["hops"] == 2

    hit = client.post(f"/portfolio/{sandbox}/shock", json={"ticker": "ZZTC", "max_hops": 3}).json()
    assert hit["portfolio_impact_percentage"] == 25.0
    assert hit["hits"][0]["ticker"] == "ZZTA" and hit["hits"][0]["hops"] == 2


def test_seeded_portfolio_themes_and_shock() -> None:
    themes = client.get("/portfolio/1/themes", params={"max_hops": 1}).json()
    assert themes["themes"][0]["sector"] == "Digital Infrastructure"
    assert themes["themes"][0]["percentage"] == themes["themes"][0]["one_hop_percentage"] == 60.0

    shock = client.post("/portfolio/3/shock", json={"ticker": "ALB", "max_hops": 1}).json()
    assert {h["ticker"] for h in shock["hits"]} == {"ALB", "TSLA", "GM", "F", "ENPH", "CAT"}


def test_proposals_stay_out_of_graph_until_approved(sandbox: int) -> None:
    from app import catalog

    _company("ZZTA")
    client.post(f"/portfolio/{sandbox}/holdings", json={"ticker": "ZZTA", "weight": 0.5})
    with SessionLocal() as session, session.begin():
        catalog.create_company(
            session, ticker="ZZTP", company_name="Proposed Co", sector="Software",
            asset_class="private_equity", description=None, status="proposed", source="agent",
        )
        proposed_id = catalog.create_exposure(
            session, ticker="ZZTA", exposed_to_ticker="ZZTP", via="demand_driver",
            exposure_sector="Software", note="A drives P.", status="proposed",
            source="agent", confidence=0.8,
        ).id

    graph = client.get(f"/portfolio/{sandbox}/graph").json()
    assert f"exposure:{proposed_id}" not in {e["id"] for e in graph["edges"]}
    ghost = client.get(f"/portfolio/{sandbox}/graph", params={"include_proposed": True}).json()
    ghost_edge = next(e for e in ghost["edges"] if e["id"] == f"exposure:{proposed_id}")
    assert ghost_edge["status"] == "proposed" and ghost_edge["confidence"] == 0.8
    assert next(n for n in ghost["nodes"] if n["id"] == "external:ZZTP")["status"] == "proposed"

    proposals = client.get("/proposals").json()
    assert "ZZTP" in {c["ticker"] for c in proposals["companies"]}
    assert proposed_id in {e["id"] for e in proposals["exposures"]}

    approved = client.post(f"/proposals/exposures/{proposed_id}/approve")
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    assert client.post(f"/proposals/exposures/{proposed_id}/approve").status_code == 409
    company = next(c for c in client.get("/companies", params={"q": "ZZTP"}).json())
    assert company["status"] == "approved"  # approving the link approved the company

    graph = client.get(f"/portfolio/{sandbox}/graph").json()
    assert f"exposure:{proposed_id}" in {e["id"] for e in graph["edges"]}


def test_rejecting_company_rejects_its_links(sandbox: int) -> None:
    from app import catalog

    _company("ZZTA")
    with SessionLocal() as session, session.begin():
        catalog.create_company(
            session, ticker="ZZTR", company_name="Rejected Co", sector="Software",
            asset_class="public_equity", description=None, status="proposed", source="agent",
        )
        link_id = catalog.create_exposure(
            session, ticker="ZZTA", exposed_to_ticker="ZZTR", via="supply_chain",
            exposure_sector="Software", note="n", status="proposed", source="agent",
        ).id
    assert client.post("/proposals/companies/ZZTR/reject").json()["status"] == "rejected"
    assert link_id not in {e["id"] for e in client.get("/proposals").json()["exposures"]}
    assert client.post("/proposals/companies/ZZTR/maybe").status_code == 404


def test_meta_lists_vocabularies() -> None:
    meta = client.get("/meta").json()
    assert "supply_chain" in meta["via_values"]
    assert "real_estate" in meta["asset_classes"]
    assert "Semiconductors" in meta["sectors"]
