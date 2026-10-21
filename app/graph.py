from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    STATUS_APPROVED,
    STATUS_PROPOSED,
    Company,
    Exposure,
    Holding,
    Portfolio,
)
from app.network import NetEdge, clamp_hops, neighbourhood
from app.schemas import GraphEdge, GraphNode, PortfolioGraph

DEFAULT_ASSET_CLASS = "public_equity"


def visible_exposures(session: Session, include_proposed: bool = False) -> list[Exposure]:
    """Every exposure the graph should consider, oldest first."""
    statuses = [STATUS_APPROVED, STATUS_PROPOSED] if include_proposed else [STATUS_APPROVED]
    return list(
        session.scalars(
            select(Exposure).where(Exposure.status.in_(statuses)).order_by(Exposure.id)
        ).all()
    )


def to_net_edge(exposure: Exposure) -> NetEdge:
    return NetEdge(
        id=exposure.id,
        ticker=exposure.ticker,
        exposed_to_ticker=exposure.exposed_to_ticker,
        via=exposure.via,
        exposure_sector=exposure.exposure_sector,
        note=exposure.note,
    )


def companies_by_ticker(session: Session) -> dict[str, Company]:
    return {company.ticker: company for company in session.scalars(select(Company)).all()}


def _holding_node(holding: Holding, company: Company | None) -> GraphNode:
    return GraphNode(
        id=f"holding:{holding.ticker}",
        type="holding",
        label=holding.company_name,
        ticker=holding.ticker,
        sector=holding.sector,
        weight=float(holding.weight),
        asset_class=company.asset_class if company else DEFAULT_ASSET_CLASS,
    )


def _sector_node(name: str) -> GraphNode:
    return GraphNode(id=f"sector:{name}", type="sector", label=name)


def _external_node(ticker: str, company: Company | None, hop: int | None) -> GraphNode:
    return GraphNode(
        id=f"external:{ticker}",
        type="exposure",
        label=company.company_name if company else ticker,
        ticker=ticker,
        sector=company.sector if company else None,
        asset_class=company.asset_class if company else None,
        hop=hop,
        status=company.status if company and company.status != STATUS_APPROVED else None,
    )


def build_portfolio_graph(
    session: Session,
    portfolio: Portfolio,
    depth: int = 1,
    include_proposed: bool = False,
) -> PortfolioGraph:
    """Holdings, their sector hubs, and exposures within `depth` hops.

    depth=1 is the classic view: every exposure touching a holding. Larger
    depths pull in assets the portfolio does not hold but is connected to,
    which is where multi-hop concentration shows up.
    """
    depth = clamp_hops(depth)
    holdings = session.scalars(
        select(Holding)
        .where(Holding.portfolio_id == portfolio.id)
        .order_by(Holding.ticker)
    ).all()
    held_tickers = {holding.ticker for holding in holdings}
    companies = companies_by_ticker(session)

    exposure_rows = {row.id: row for row in visible_exposures(session, include_proposed)}
    reach = neighbourhood(
        held_tickers, [to_net_edge(row) for row in exposure_rows.values()], depth
    )

    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []

    for holding in holdings:
        holding_node = _holding_node(holding, companies.get(holding.ticker))
        sector_node = _sector_node(holding.sector)
        nodes[holding_node.id] = holding_node
        nodes[sector_node.id] = sector_node
        edges.append(
            GraphEdge(
                id=f"belongs_to_sector:{holding.ticker}",
                source=holding_node.id,
                target=sector_node.id,
                type="belongs_to_sector",
            )
        )

    def node_id(ticker: str) -> str:
        holding_id = f"holding:{ticker}"
        if holding_id in nodes:
            return holding_id
        external = _external_node(
            ticker, companies.get(ticker), reach.hop_by_ticker.get(ticker)
        )
        nodes.setdefault(external.id, external)
        return external.id

    for net_edge in reach.edges:
        exposure = exposure_rows[net_edge.id]
        edges.append(
            GraphEdge(
                id=f"exposure:{exposure.id}",
                source=node_id(exposure.ticker),
                target=node_id(exposure.exposed_to_ticker),
                type=exposure.via,
                label=exposure.via,
                exposure_sector=exposure.exposure_sector,
                note=exposure.note,
                status=exposure.status,
                origin=exposure.source,
                confidence=exposure.confidence,
            )
        )

    return PortfolioGraph(
        portfolio_id=portfolio.id,
        portfolio_name=portfolio.name,
        nodes=[nodes[node_id] for node_id in sorted(nodes)],
        edges=sorted(edges, key=lambda edge: edge.id),
    )
