"""Write paths for the graph: companies, holdings, exposures and proposals.

People add rows directly (status approved, source user). The connection agent
only ever creates *proposed* rows; they join the graph once a person approves
them. Curated seed exposures cannot be deleted through the API.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    ASSET_CLASS_VALUES,
    EXPOSURE_VIA_VALUES,
    SOURCE_CURATED,
    SOURCE_USER,
    STATUS_APPROVED,
    STATUS_PROPOSED,
    STATUS_REJECTED,
    Company,
    Exposure,
    Holding,
    Portfolio,
    Sector,
)
from app.schemas import CompanyOut, ExposureOut, HoldingOut, ProposalsResponse

WEIGHT_QUANTUM = Decimal("0.0001")
MIN_WEIGHT = WEIGHT_QUANTUM
TICKER_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9_.\-]{0,39}$")


class CatalogError(ValueError):
    """Invalid input (400)."""


class NotFoundError(LookupError):
    """Referenced row does not exist (404)."""


class ConflictError(RuntimeError):
    """Row already exists or cannot change in this state (409)."""


def normalize_ticker(ticker: str) -> str:
    value = ticker.strip().upper().replace(" ", "_")
    if not TICKER_PATTERN.match(value):
        raise CatalogError(
            f"Identifier {ticker!r} must be letters, digits, '_', '.' or '-' (max 40)."
        )
    return value


def ensure_sector(session: Session, name: str) -> str:
    name = name.strip()
    if not name:
        raise CatalogError("Sector name cannot be empty.")
    existing = session.scalars(
        select(Sector).where(func.lower(Sector.name) == name.lower())
    ).first()
    if existing is not None:
        return existing.name
    session.add(Sector(name=name))
    session.flush()
    return name


def sector_names(session: Session) -> list[str]:
    return list(session.scalars(select(Sector.name).order_by(Sector.name)).all())


def _held_in(session: Session, ticker: str) -> list[int]:
    return sorted(
        set(
            session.scalars(
                select(Holding.portfolio_id).where(Holding.ticker == ticker)
            ).all()
        )
    )


def company_out(session: Session, company: Company) -> CompanyOut:
    return CompanyOut(
        ticker=company.ticker,
        company_name=company.company_name,
        sector=company.sector,
        asset_class=company.asset_class,
        description=company.description,
        status=company.status,
        source=company.source,
        held_in=_held_in(session, company.ticker),
    )


def exposure_out(exposure: Exposure) -> ExposureOut:
    return ExposureOut(
        id=exposure.id,
        ticker=exposure.ticker,
        exposed_to_ticker=exposure.exposed_to_ticker,
        via=exposure.via,
        exposure_sector=exposure.exposure_sector,
        note=exposure.note,
        status=exposure.status,
        source=exposure.source,
        confidence=exposure.confidence,
    )


def list_companies(
    session: Session, query: str | None = None, include_proposed: bool = False
) -> list[CompanyOut]:
    statement = select(Company).order_by(Company.ticker)
    statuses = [STATUS_APPROVED, STATUS_PROPOSED] if include_proposed else [STATUS_APPROVED]
    statement = statement.where(Company.status.in_(statuses))
    if query:
        pattern = f"%{query.strip().lower()}%"
        statement = statement.where(
            func.lower(Company.ticker).like(pattern)
            | func.lower(Company.company_name).like(pattern)
            | func.lower(Company.sector).like(pattern)
        )
    return [company_out(session, company) for company in session.scalars(statement).all()]


def create_company(
    session: Session,
    *,
    ticker: str,
    company_name: str,
    sector: str,
    asset_class: str,
    description: str | None,
    status: str = STATUS_APPROVED,
    source: str = SOURCE_USER,
) -> Company:
    ticker = normalize_ticker(ticker)
    if asset_class not in ASSET_CLASS_VALUES:
        raise CatalogError(
            f"asset_class must be one of {', '.join(ASSET_CLASS_VALUES)}."
        )
    existing = session.get(Company, ticker)
    if existing is not None and existing.status != STATUS_REJECTED:
        raise ConflictError(f"{ticker} already exists.")
    sector = ensure_sector(session, sector)
    if existing is not None:
        # A previously rejected proposal can be re-proposed or added by hand.
        session.delete(existing)
        session.flush()
    company = Company(
        ticker=ticker,
        company_name=company_name.strip(),
        sector=sector,
        asset_class=asset_class,
        description=(description or "").strip() or None,
        status=status,
        source=source,
    )
    session.add(company)
    session.flush()
    return company


def _require_known(session: Session, ticker: str, allow_proposed: bool) -> str:
    ticker = normalize_ticker(ticker)
    company = session.get(Company, ticker)
    allowed = {STATUS_APPROVED, STATUS_PROPOSED} if allow_proposed else {STATUS_APPROVED}
    if company is None or company.status not in allowed:
        raise NotFoundError(f"Unknown asset {ticker}. Add it as a company first.")
    return ticker


def create_exposure(
    session: Session,
    *,
    ticker: str,
    exposed_to_ticker: str,
    via: str,
    exposure_sector: str,
    note: str,
    status: str = STATUS_APPROVED,
    source: str = SOURCE_USER,
    confidence: float | None = None,
) -> Exposure:
    allow_proposed = status == STATUS_PROPOSED
    ticker = _require_known(session, ticker, allow_proposed)
    exposed_to_ticker = _require_known(session, exposed_to_ticker, allow_proposed)
    if ticker == exposed_to_ticker:
        raise CatalogError("An asset cannot be exposed to itself.")
    if via not in EXPOSURE_VIA_VALUES:
        raise CatalogError(f"via must be one of {', '.join(EXPOSURE_VIA_VALUES)}.")
    if not note.strip():
        raise CatalogError("A note explaining the relationship is required.")
    if confidence is not None and not 0 <= confidence <= 1:
        raise CatalogError("confidence must be between 0 and 1.")
    duplicate = session.scalars(
        select(Exposure).where(
            Exposure.ticker == ticker,
            Exposure.exposed_to_ticker == exposed_to_ticker,
            Exposure.via == via,
            Exposure.status != STATUS_REJECTED,
        )
    ).first()
    if duplicate is not None:
        raise ConflictError(
            f"{ticker} -> {exposed_to_ticker} via {via} already exists (#{duplicate.id})."
        )
    exposure = Exposure(
        ticker=ticker,
        exposed_to_ticker=exposed_to_ticker,
        via=via,
        exposure_sector=ensure_sector(session, exposure_sector),
        note=note.strip(),
        status=status,
        source=source,
        confidence=confidence,
    )
    session.add(exposure)
    session.flush()
    return exposure


def delete_exposure(session: Session, exposure_id: int) -> None:
    exposure = session.get(Exposure, exposure_id)
    if exposure is None:
        raise NotFoundError(f"Exposure {exposure_id} not found.")
    if exposure.source == SOURCE_CURATED:
        raise ConflictError("Curated demo relationships cannot be deleted.")
    session.delete(exposure)


def _rebalance(holdings: list[Holding], target_total: Decimal) -> None:
    """Scale weights proportionally so they sum to `target_total` exactly."""
    current = sum((h.weight for h in holdings), Decimal(0))
    if not holdings or current <= 0:
        return
    ordered = sorted(holdings, key=lambda h: (h.weight, h.ticker))
    remaining = target_total
    for holding in ordered[:-1]:
        scaled = (holding.weight * target_total / current).quantize(
            WEIGHT_QUANTUM, rounding=ROUND_HALF_UP
        )
        holding.weight = max(MIN_WEIGHT, scaled)
        remaining -= holding.weight
    ordered[-1].weight = max(MIN_WEIGHT, remaining)


def _portfolio_holdings(session: Session, portfolio_id: int) -> list[Holding]:
    return list(
        session.scalars(
            select(Holding).where(Holding.portfolio_id == portfolio_id).order_by(Holding.id)
        ).all()
    )


def holding_out(holding: Holding) -> HoldingOut:
    return HoldingOut(
        ticker=holding.ticker,
        company_name=holding.company_name,
        sector=holding.sector,
        weight=float(holding.weight),
        shares=holding.shares,
    )


def add_holding(
    session: Session, portfolio: Portfolio, *, ticker: str, weight: float, shares: int
) -> list[HoldingOut]:
    """Add a company to a portfolio at `weight`, scaling the others to fit."""
    ticker = _require_known(session, ticker, allow_proposed=False)
    company = session.get(Company, ticker)
    assert company is not None
    holdings = _portfolio_holdings(session, portfolio.id)
    if any(h.ticker == ticker for h in holdings):
        raise ConflictError(f"{ticker} is already held in {portfolio.name}.")
    new_weight = (
        Decimal(1)
        if not holdings
        else Decimal(str(weight)).quantize(WEIGHT_QUANTUM, rounding=ROUND_HALF_UP)
    )
    _rebalance(holdings, Decimal(1) - new_weight)
    holding = Holding(
        portfolio_id=portfolio.id,
        ticker=ticker,
        company_name=company.company_name,
        shares=shares,
        sector=company.sector,
        weight=new_weight,
    )
    session.add(holding)
    session.flush()
    return [holding_out(h) for h in _portfolio_holdings(session, portfolio.id)]


def remove_holding(session: Session, portfolio: Portfolio, ticker: str) -> list[HoldingOut]:
    ticker = normalize_ticker(ticker)
    holdings = _portfolio_holdings(session, portfolio.id)
    target = next((h for h in holdings if h.ticker == ticker), None)
    if target is None:
        raise NotFoundError(f"{ticker} is not held in {portfolio.name}.")
    if len(holdings) == 1:
        raise ConflictError("A portfolio needs at least one holding.")
    session.delete(target)
    rest = [h for h in holdings if h is not target]
    _rebalance(rest, Decimal(1))
    session.flush()
    return [holding_out(h) for h in rest]


def create_portfolio(session: Session, name: str) -> Portfolio:
    name = name.strip()
    if session.scalars(select(Portfolio).where(Portfolio.name == name)).first():
        raise ConflictError(f"A portfolio named {name!r} already exists.")
    portfolio = Portfolio(name=name)
    session.add(portfolio)
    session.flush()
    return portfolio


def list_proposals(session: Session) -> ProposalsResponse:
    companies = session.scalars(
        select(Company).where(Company.status == STATUS_PROPOSED).order_by(Company.ticker)
    ).all()
    exposures = session.scalars(
        select(Exposure).where(Exposure.status == STATUS_PROPOSED).order_by(Exposure.id)
    ).all()
    return ProposalsResponse(
        companies=[company_out(session, c) for c in companies],
        exposures=[exposure_out(e) for e in exposures],
    )


def review_exposure(session: Session, exposure_id: int, approve: bool) -> Exposure:
    exposure = session.get(Exposure, exposure_id)
    if exposure is None:
        raise NotFoundError(f"Exposure {exposure_id} not found.")
    if exposure.status != STATUS_PROPOSED:
        raise ConflictError(f"Exposure {exposure_id} is already {exposure.status}.")
    if approve:
        # Approving a relationship approves the proposed companies it needs.
        for ticker in (exposure.ticker, exposure.exposed_to_ticker):
            company = session.get(Company, ticker)
            if company is not None and company.status == STATUS_PROPOSED:
                company.status = STATUS_APPROVED
        exposure.status = STATUS_APPROVED
    else:
        exposure.status = STATUS_REJECTED
    session.flush()
    return exposure


def review_company(session: Session, ticker: str, approve: bool) -> Company:
    company = session.get(Company, normalize_ticker(ticker))
    if company is None:
        raise NotFoundError(f"Company {ticker} not found.")
    if company.status != STATUS_PROPOSED:
        raise ConflictError(f"{company.ticker} is already {company.status}.")
    company.status = STATUS_APPROVED if approve else STATUS_REJECTED
    if not approve:
        # Proposed links that depend on a rejected company cannot be approved.
        for exposure in session.scalars(
            select(Exposure).where(
                Exposure.status == STATUS_PROPOSED,
                (Exposure.ticker == company.ticker)
                | (Exposure.exposed_to_ticker == company.ticker),
            )
        ).all():
            exposure.status = STATUS_REJECTED
    session.flush()
    return company
