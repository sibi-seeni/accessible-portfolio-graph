"""Deterministic hidden-concentration insight for the Accessible Portfolio Explorer.

GET /portfolio/{id}/insight identifies the strongest mapped sector/theme
concentration for a curated demo portfolio. This is NOT a financial risk model;
it is a deterministic metric computed from curated data only. No LLM, market
data, or recursion participates.

All weights are curated demo portfolio weights stored on `holdings.weight`
(a fraction of the portfolio, so each portfolio's holding weights sum to 1.0).
There is no market-value calculation and no live financial data.

Each curated exposure edge carries an explicit `exposures.exposure_sector`: the
hidden sector/risk theme that the relationship represents. The theme is NOT
inferred from the target asset's conventional sector. For example, TSLA -> ALB
has exposure_sector "Battery & Critical Minerals" even though ALB's holding
sector is "Materials & Mining".

Tickers are opaque holding identifiers. They may be public equity symbols
(e.g. NVDA) or synthetic alternative-asset identifiers (e.g. DATA_CENTER_FUND,
PRIVATE_AI_CO, MULTIFAMILY_FUND, RE_CREDIT_FUND). The calculation treats every
holding identically and never validates or resolves a ticker against an
exchange; no external API is called.

DIRECT SECTOR EXPOSURE
----------------------
For sector/theme S, the directly exposed holdings are held tickers that either:

A. are the `exposed_to_ticker` anchor of a curated exposure edge whose
   `exposure_sector` is S, OR
B. have their own `holding.sector` equal to S.

INDIRECT SECTOR EXPOSURE
------------------------
A held asset contributes its portfolio weight to sector S indirectly when it
is the source `ticker` of a curated exposure edge whose `exposure_sector` is S.

Example:

    MSFT weight = 0.20
    MSFT -> NVDA via supply_chain, exposure_sector = Semiconductors

Then MSFT contributes 0.20 mapped indirect exposure to Semiconductors.

COMBINED SECTOR EXPOSURE
------------------------
For each sector S build the SET of held holdings exposed to S either directly or
indirectly. Then:

    combined_exposure(S) = sum(weight of each unique holding in that set)

A holding contributes its weight at most ONCE to a particular sector, no matter
how many qualifying edges it has or whether it qualifies both directly and
indirectly. Therefore:

    0 <= combined_exposure(S) <= 1.0
    percentage = combined_exposure(S) * 100

Example (Energy Transition):
    ALB  = 0.25 direct  (target anchor of the Battery & Critical Minerals edges)
    TSLA = 0.20 indirect
    GM   = 0.15 indirect
    F    = 0.10 indirect
    ENPH = 0.10 indirect

    combined_exposure("Battery & Critical Minerals") = 0.80
    percentage = 80.0%

CONSTRAINTS
-----------
- Only one-hop curated exposures count. Do NOT recursively traverse edges.
- Do NOT assign arbitrary fractional strength to an exposure edge. An exposure
  edge means the originating holding's full weight is mapped to that theme.
- Do NOT hardcode any percentage. It must be computed from portfolio weights.
- Return exactly ONE strongest theme (highest combined exposure; tie-break by
  higher indirect exposure, then alphabetical theme name).
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exposure, Holding, Portfolio
from app.schemas import PortfolioInsight

METHODOLOGY = "Curated direct and one-hop indirect exposure score based on portfolio weights."
PERCENTAGE_QUANTUM = Decimal("0.1")
ZERO = Decimal("0")


@dataclass(frozen=True)
class WeightedHolding:
    ticker: str
    sector: str
    weight: Decimal


@dataclass(frozen=True)
class ThemeEdge:
    id: int
    ticker: str
    exposed_to_ticker: str
    exposure_sector: str
    note: str


@dataclass(frozen=True)
class ThemeInsight:
    sector: str
    combined_weight: Decimal
    direct_tickers: list[str]
    indirect_tickers: list[str]
    contributing_tickers: list[str]
    exposure_edge_ids: list[int]
    exposure_notes: list[str]


def compute_theme_insight(
    sector: str,
    holdings: Sequence[WeightedHolding],
    edges: Sequence[ThemeEdge],
) -> ThemeInsight:
    """Combine direct and one-hop indirect exposure for a single theme."""
    weight_by_ticker = {holding.ticker: holding.weight for holding in holdings}
    held_tickers = set(weight_by_ticker)

    theme_edges = [
        edge
        for edge in edges
        if edge.exposure_sector == sector and edge.ticker in held_tickers
    ]

    direct_set = {holding.ticker for holding in holdings if holding.sector == sector}
    direct_set |= {edge.exposed_to_ticker for edge in theme_edges} & held_tickers

    direct_tickers = [h.ticker for h in holdings if h.ticker in direct_set]
    direct_tickers_set = set(direct_tickers)

    indirect_tickers: list[str] = []
    exposure_edge_ids: list[int] = []
    exposure_notes: list[str] = []
    for edge in theme_edges:
        exposure_edge_ids.append(edge.id)
        if edge.note not in exposure_notes:
            exposure_notes.append(edge.note)
        if edge.ticker not in direct_tickers_set and edge.ticker not in indirect_tickers:
            indirect_tickers.append(edge.ticker)

    contributing_tickers = direct_tickers + indirect_tickers
    combined_weight = sum(
        (weight_by_ticker[ticker] for ticker in contributing_tickers), ZERO
    )

    return ThemeInsight(
        sector=sector,
        combined_weight=combined_weight,
        direct_tickers=direct_tickers,
        indirect_tickers=indirect_tickers,
        contributing_tickers=contributing_tickers,
        exposure_edge_ids=exposure_edge_ids,
        exposure_notes=exposure_notes,
    )


def compute_theme_scores(
    holdings: Sequence[WeightedHolding],
    edges: Sequence[ThemeEdge],
) -> list[ThemeInsight]:
    """Score every candidate theme, strongest first (deterministic tie-break)."""
    if not holdings:
        return []

    held_tickers = {holding.ticker for holding in holdings}
    themes = {holding.sector for holding in holdings}
    themes |= {
        edge.exposure_sector for edge in edges if edge.ticker in held_tickers
    }

    weight_by_ticker = {holding.ticker: holding.weight for holding in holdings}
    insights = {
        sector: compute_theme_insight(sector, holdings, edges)
        for sector in sorted(themes)
    }

    def indirect_weight(insight: ThemeInsight) -> Decimal:
        return sum((weight_by_ticker[t] for t in insight.indirect_tickers), ZERO)

    ranked = sorted(themes)
    ranked.sort(
        key=lambda sector: (
            insights[sector].combined_weight,
            indirect_weight(insights[sector]),
        ),
        reverse=True,
    )
    return [insights[sector] for sector in ranked]


def compute_strongest_theme(
    holdings: Sequence[WeightedHolding],
    edges: Sequence[ThemeEdge],
) -> ThemeInsight | None:
    """Return the single strongest theme for the given holdings and edges."""
    scores = compute_theme_scores(holdings, edges)
    return scores[0] if scores else None


def get_portfolio_insight(session: Session, portfolio_id: int) -> PortfolioInsight | None:
    """Calculate the strongest mapped concentration for a portfolio, or None."""
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        return None

    holdings = session.scalars(
        select(Holding)
        .where(Holding.portfolio_id == portfolio_id)
        .order_by(Holding.id)
    ).all()
    held_tickers = {holding.ticker for holding in holdings}

    edges = session.scalars(
        select(Exposure)
        .where(Exposure.ticker.in_(held_tickers))
        .order_by(Exposure.id)
    ).all()

    theme = compute_strongest_theme(
        [WeightedHolding(h.ticker, h.sector, h.weight) for h in holdings],
        [ThemeEdge(e.id, e.ticker, e.exposed_to_ticker, e.exposure_sector, e.note) for e in edges],
    )
    if theme is None:
        return None

    percentage = (theme.combined_weight * 100).quantize(
        PERCENTAGE_QUANTUM, rounding=ROUND_HALF_UP
    )

    return PortfolioInsight(
        portfolio_id=portfolio.id,
        portfolio_name=portfolio.name,
        sector=theme.sector,
        percentage=float(percentage),
        direct_tickers=theme.direct_tickers,
        indirect_tickers=theme.indirect_tickers,
        contributing_tickers=theme.contributing_tickers,
        exposure_edge_ids=theme.exposure_edge_ids,
        exposure_notes=theme.exposure_notes,
        methodology=METHODOLOGY,
        narration=None,
    )
