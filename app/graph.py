from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exposure, Holding, Portfolio
from app.schemas import GraphEdge, GraphNode, PortfolioGraph


def _holding_node(holding: Holding) -> GraphNode:
    return GraphNode(
        id=f"holding:{holding.ticker}",
        type="holding",
        label=holding.company_name,
        ticker=holding.ticker,
        sector=holding.sector,
    )


def _sector_node(name: str) -> GraphNode:
    return GraphNode(id=f"sector:{name}", type="sector", label=name)


def _external_node(ticker: str) -> GraphNode:
    return GraphNode(id=f"external:{ticker}", type="exposure", label=ticker, ticker=ticker)


def build_portfolio_graph(session: Session, portfolio: Portfolio) -> PortfolioGraph:
    holdings = session.scalars(
        select(Holding)
        .where(Holding.portfolio_id == portfolio.id)
        .order_by(Holding.ticker)
    ).all()
    held_tickers = {holding.ticker for holding in holdings}

    exposures = session.scalars(
        select(Exposure)
        .where(Exposure.ticker.in_(held_tickers))
        .order_by(Exposure.id)
    ).all()

    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []

    for holding in holdings:
        holding_node = _holding_node(holding)
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

    for exposure in exposures:
        source_id = f"holding:{exposure.ticker}"
        if source_id not in nodes:
            external = _external_node(exposure.ticker)
            nodes[external.id] = external
            source_id = external.id

        target_id = f"holding:{exposure.exposed_to_ticker}"
        if target_id not in nodes:
            external = _external_node(exposure.exposed_to_ticker)
            nodes[external.id] = external
            target_id = external.id

        edges.append(
            GraphEdge(
                id=f"exposure:{exposure.id}",
                source=source_id,
                target=target_id,
                type=exposure.via,
                label=exposure.via,
                note=exposure.note,
            )
        )

    return PortfolioGraph(
        portfolio_id=portfolio.id,
        portfolio_name=portfolio.name,
        nodes=[nodes[node_id] for node_id in sorted(nodes)],
        edges=sorted(edges, key=lambda edge: edge.id),
    )
