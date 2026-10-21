"""Session-level wrappers that turn `app.network` results into API responses."""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.graph import companies_by_ticker, to_net_edge, visible_exposures
from app.insight import compute_theme_scores, ThemeEdge, WeightedHolding
from app.models import Company, Holding, Portfolio
from app.network import NetHolding, Path, clamp_hops, find_paths, shock, theme_scores
from app.schemas import (
    PathOut,
    PathStepOut,
    PathsResponse,
    ShockHitOut,
    ShockResponse,
    ThemeContributionOut,
    ThemeOut,
    ThemesResponse,
)

THEMES_METHODOLOGY = (
    "Curated exposure followed up to {hops} hops. Each extra hop is discounted by "
    "{decay:g}x; a holding counts once per theme through its strongest route."
)
SHOCK_METHODOLOGY = (
    "Holdings within {hops} hops of the stressed asset along curated relationships "
    "in either direction. Impact per holding is {decay:g} to the power of its "
    "distance, weighted by portfolio weight. A structural map, not a forecast."
)
PERCENT = Decimal("0.1")


class UnknownAssetError(LookupError):
    pass


def _pct(value: Decimal) -> float:
    return float((value * 100).quantize(PERCENT, rounding=ROUND_HALF_UP))


def _holdings(session: Session, portfolio_id: int) -> list[Holding]:
    return list(
        session.scalars(
            select(Holding).where(Holding.portfolio_id == portfolio_id).order_by(Holding.id)
        ).all()
    )


def _node_id(ticker: str, held: set[str]) -> str:
    return f"holding:{ticker}" if ticker in held else f"external:{ticker}"


def _path_out(path: Path, held: set[str]) -> PathOut:
    return PathOut(
        hops=path.hops,
        tickers=path.tickers,
        node_ids=[_node_id(ticker, held) for ticker in path.tickers],
        edge_ids=[f"exposure:{edge_id}" for edge_id in path.edge_ids],
        steps=[
            PathStepOut(
                edge_id=f"exposure:{step.edge.id}",
                from_ticker=step.start,
                to_ticker=step.end,
                via=step.edge.via,
                exposure_sector=step.edge.exposure_sector,
                note=step.edge.note,
                forward=step.forward,
            )
            for step in path.steps
        ],
    )


def _known(session: Session, ticker: str, held: set[str]) -> None:
    if ticker in held or session.get(Company, ticker) is not None:
        return
    raise UnknownAssetError(ticker)


def portfolio_paths(
    session: Session,
    portfolio: Portfolio,
    source: str,
    target: str,
    max_hops: int,
    include_proposed: bool = False,
) -> PathsResponse:
    held = {h.ticker for h in _holdings(session, portfolio.id)}
    _known(session, source, held)
    _known(session, target, held)
    edges = [to_net_edge(row) for row in visible_exposures(session, include_proposed)]
    max_hops = clamp_hops(max_hops)
    return PathsResponse(
        portfolio_id=portfolio.id,
        source=source,
        target=target,
        max_hops=max_hops,
        paths=[_path_out(path, held) for path in find_paths(source, target, edges, max_hops)],
    )


def portfolio_themes(
    session: Session, portfolio: Portfolio, max_hops: int, decay: float
) -> ThemesResponse:
    holdings = _holdings(session, portfolio.id)
    rows = visible_exposures(session)
    names = {h.ticker: h.company_name for h in holdings}
    max_hops = clamp_hops(max_hops)
    decay_value = Decimal(str(decay))

    one_hop = {
        theme.sector: theme.combined_weight
        for theme in compute_theme_scores(
            [WeightedHolding(h.ticker, h.sector, h.weight) for h in holdings],
            [ThemeEdge(r.id, r.ticker, r.exposed_to_ticker, r.exposure_sector, r.note) for r in rows],
        )
    }
    scores = theme_scores(
        [NetHolding(h.ticker, h.sector, h.weight) for h in holdings],
        [to_net_edge(row) for row in rows],
        max_hops=max_hops,
        decay=decay_value,
    )
    return ThemesResponse(
        portfolio_id=portfolio.id,
        max_hops=max_hops,
        decay=decay,
        methodology=THEMES_METHODOLOGY.format(hops=max_hops, decay=decay),
        themes=[
            ThemeOut(
                sector=score.sector,
                percentage=_pct(score.score),
                one_hop_percentage=_pct(one_hop.get(score.sector, Decimal(0))),
                contributions=[
                    ThemeContributionOut(
                        ticker=c.ticker,
                        name=names.get(c.ticker, c.ticker),
                        weight=float(c.weight),
                        strength=float(c.strength),
                        hops=c.hops,
                        edge_ids=[f"exposure:{edge_id}" for edge_id in c.edge_ids],
                    )
                    for c in score.contributions
                ],
            )
            for score in scores
        ],
    )


def portfolio_shock(
    session: Session, portfolio: Portfolio, ticker: str, max_hops: int, decay: float
) -> ShockResponse:
    holdings = _holdings(session, portfolio.id)
    held = {h.ticker for h in holdings}
    _known(session, ticker, held)
    companies = companies_by_ticker(session)
    names = {t: c.company_name for t, c in companies.items()}
    names.update({h.ticker: h.company_name for h in holdings})
    max_hops = clamp_hops(max_hops)

    hits = shock(
        ticker,
        [NetHolding(h.ticker, h.sector, h.weight) for h in holdings],
        [to_net_edge(row) for row in visible_exposures(session)],
        max_hops=max_hops,
        decay=Decimal(str(decay)),
    )
    total = sum((hit.weight * hit.impact for hit in hits), Decimal(0))
    return ShockResponse(
        portfolio_id=portfolio.id,
        ticker=ticker,
        name=names.get(ticker, ticker),
        max_hops=max_hops,
        decay=decay,
        portfolio_impact_percentage=_pct(total),
        methodology=SHOCK_METHODOLOGY.format(hops=max_hops, decay=decay),
        hits=[
            ShockHitOut(
                ticker=hit.ticker,
                name=names.get(hit.ticker, hit.ticker),
                weight=float(hit.weight),
                hops=hit.hops,
                impact=float(hit.impact),
                path=_path_out(hit.path, held),
            )
            for hit in hits
        ],
    )
