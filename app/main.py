from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import catalog
from app.agent import AgentUnavailableError, run_agent
from app.audio import STATIC_DIR, AudioUnavailableError, get_portfolio_audio
from app.db import get_session
from app.explore import (
    UnknownAssetError,
    portfolio_paths,
    portfolio_shock,
    portfolio_themes,
)
from app.graph import build_portfolio_graph
from app.insight import get_portfolio_insight
from app.models import ASSET_CLASS_VALUES, EXPOSURE_VIA_VALUES, Portfolio
from app.narration import NarrationError
from app.query import (
    INTENT_UNSUPPORTED,
    PortfolioNotFoundError,
    answer_portfolio_question,
)
from app.schemas import (
    AgentRunRequest,
    AgentRunResponse,
    CompanyCreate,
    CompanyOut,
    ExposureCreate,
    ExposureOut,
    HoldingCreate,
    HoldingOut,
    PathsResponse,
    PortfolioCreate,
    ProposalsResponse,
    ShockRequest,
    ShockResponse,
    ThemesResponse,
    PortfolioAudioResponse,
    PortfolioGraph,
    PortfolioInsight,
    PortfolioQueryRequest,
    PortfolioQueryResponse,
    PortfolioSummary,
)
from app.tts import TTSError, synthesize_live_narration

app = FastAPI(title="Portfolio Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/portfolios", response_model=list[PortfolioSummary])
def list_portfolios(session: Session = Depends(get_session)) -> list[PortfolioSummary]:
    portfolios = session.scalars(select(Portfolio).order_by(Portfolio.id)).all()
    return [PortfolioSummary(id=portfolio.id, name=portfolio.name) for portfolio in portfolios]


def _portfolio_or_404(session: Session, portfolio_id: int) -> Portfolio:
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@contextmanager
def _writes(session: Session) -> Iterator[None]:
    """Commit on success and map catalog errors onto HTTP status codes."""
    try:
        yield
        session.commit()
    except catalog.CatalogError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except catalog.NotFoundError as exc:
        session.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except catalog.ConflictError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/meta")
def get_meta(session: Session = Depends(get_session)) -> dict[str, list[str]]:
    return {
        "via_values": list(EXPOSURE_VIA_VALUES),
        "asset_classes": list(ASSET_CLASS_VALUES),
        "sectors": catalog.sector_names(session),
    }


@app.post("/portfolios", response_model=PortfolioSummary, status_code=201)
def create_portfolio(
    request: PortfolioCreate, session: Session = Depends(get_session)
) -> PortfolioSummary:
    with _writes(session):
        portfolio = catalog.create_portfolio(session, request.name)
        result = PortfolioSummary(id=portfolio.id, name=portfolio.name)
    return result


@app.get("/portfolio/{portfolio_id}/graph", response_model=PortfolioGraph)
def get_portfolio_graph(
    portfolio_id: int,
    depth: int = Query(default=1, ge=1, le=5),
    include_proposed: bool = False,
    session: Session = Depends(get_session),
) -> PortfolioGraph:
    portfolio = _portfolio_or_404(session, portfolio_id)
    return build_portfolio_graph(session, portfolio, depth, include_proposed)


@app.get("/portfolio/{portfolio_id}/paths", response_model=PathsResponse)
def get_paths(
    portfolio_id: int,
    source: str,
    target: str,
    max_hops: int = Query(default=3, ge=1, le=5),
    include_proposed: bool = False,
    session: Session = Depends(get_session),
) -> PathsResponse:
    portfolio = _portfolio_or_404(session, portfolio_id)
    try:
        return portfolio_paths(
            session, portfolio, source.upper(), target.upper(), max_hops, include_proposed
        )
    except UnknownAssetError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown asset {exc}") from exc


@app.get("/portfolio/{portfolio_id}/themes", response_model=ThemesResponse)
def get_themes(
    portfolio_id: int,
    max_hops: int = Query(default=3, ge=1, le=5),
    decay: float = Query(default=0.5, gt=0, le=1),
    session: Session = Depends(get_session),
) -> ThemesResponse:
    portfolio = _portfolio_or_404(session, portfolio_id)
    return portfolio_themes(session, portfolio, max_hops, decay)


@app.post("/portfolio/{portfolio_id}/shock", response_model=ShockResponse)
def post_shock(
    portfolio_id: int, request: ShockRequest, session: Session = Depends(get_session)
) -> ShockResponse:
    portfolio = _portfolio_or_404(session, portfolio_id)
    try:
        return portfolio_shock(
            session, portfolio, request.ticker.upper(), request.max_hops, request.decay
        )
    except UnknownAssetError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown asset {exc}") from exc


@app.post(
    "/portfolio/{portfolio_id}/holdings",
    response_model=list[HoldingOut],
    status_code=201,
)
def add_holding(
    portfolio_id: int, request: HoldingCreate, session: Session = Depends(get_session)
) -> list[HoldingOut]:
    portfolio = _portfolio_or_404(session, portfolio_id)
    with _writes(session):
        result = catalog.add_holding(
            session, portfolio, ticker=request.ticker, weight=request.weight, shares=request.shares
        )
    return result


@app.delete("/portfolio/{portfolio_id}/holdings/{ticker}", response_model=list[HoldingOut])
def remove_holding(
    portfolio_id: int, ticker: str, session: Session = Depends(get_session)
) -> list[HoldingOut]:
    portfolio = _portfolio_or_404(session, portfolio_id)
    with _writes(session):
        result = catalog.remove_holding(session, portfolio, ticker)
    return result


@app.get("/companies", response_model=list[CompanyOut])
def list_companies(
    q: str | None = None,
    include_proposed: bool = False,
    session: Session = Depends(get_session),
) -> list[CompanyOut]:
    return catalog.list_companies(session, q, include_proposed)


@app.post("/companies", response_model=CompanyOut, status_code=201)
def create_company(
    request: CompanyCreate, session: Session = Depends(get_session)
) -> CompanyOut:
    with _writes(session):
        company = catalog.create_company(session, **request.model_dump())
        result = catalog.company_out(session, company)
    return result


@app.post("/exposures", response_model=ExposureOut, status_code=201)
def create_exposure(
    request: ExposureCreate, session: Session = Depends(get_session)
) -> ExposureOut:
    with _writes(session):
        result = catalog.exposure_out(catalog.create_exposure(session, **request.model_dump()))
    return result


@app.delete("/exposures/{exposure_id}", status_code=204)
def delete_exposure(exposure_id: int, session: Session = Depends(get_session)) -> Response:
    with _writes(session):
        catalog.delete_exposure(session, exposure_id)
    return Response(status_code=204)


@app.get("/proposals", response_model=ProposalsResponse)
def list_proposals(session: Session = Depends(get_session)) -> ProposalsResponse:
    return catalog.list_proposals(session)


@app.post("/proposals/exposures/{exposure_id}/{decision}", response_model=ExposureOut)
def review_exposure(
    exposure_id: int, decision: str, session: Session = Depends(get_session)
) -> ExposureOut:
    approve = _decision(decision)
    with _writes(session):
        result = catalog.exposure_out(catalog.review_exposure(session, exposure_id, approve))
    return result


@app.post("/proposals/companies/{ticker}/{decision}", response_model=CompanyOut)
def review_company(
    ticker: str, decision: str, session: Session = Depends(get_session)
) -> CompanyOut:
    approve = _decision(decision)
    with _writes(session):
        result = catalog.company_out(session, catalog.review_company(session, ticker, approve))
    return result


def _decision(decision: str) -> bool:
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=404, detail="Use approve or reject.")
    return decision == "approve"


@app.post("/agent/run", response_model=AgentRunResponse)
def post_agent_run(
    request: AgentRunRequest, session: Session = Depends(get_session)
) -> AgentRunResponse:
    try:
        return run_agent(session, request.instruction, request.portfolio_id, request.max_steps)
    except AgentUnavailableError as exc:
        session.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/portfolio/{portfolio_id}/insight", response_model=PortfolioInsight)
def get_insight(
    portfolio_id: int, session: Session = Depends(get_session)
) -> PortfolioInsight:
    insight = get_portfolio_insight(session, portfolio_id)
    if insight is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return insight


@app.get("/portfolio/{portfolio_id}/audio", response_model=PortfolioAudioResponse)
def get_audio(
    portfolio_id: int, session: Session = Depends(get_session)
) -> PortfolioAudioResponse:
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    try:
        return get_portfolio_audio(portfolio_id)
    except AudioUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/portfolio/{portfolio_id}/query", response_model=PortfolioQueryResponse)
def query_portfolio(
    portfolio_id: int,
    request: PortfolioQueryRequest,
    session: Session = Depends(get_session),
) -> PortfolioQueryResponse:
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    try:
        result = answer_portfolio_question(portfolio_id, request.question)
    except PortfolioNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Portfolio not found") from exc
    except NarrationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The narration service is temporarily unavailable. Please try again.",
        ) from exc

    audio_url: str | None = None
    warning: str | None = None

    if result["intent"] != INTENT_UNSUPPORTED:
        try:
            audio_path = synthesize_live_narration(result["answer"])
            audio_url = f"/static/audio/live/{audio_path.name}"
        except TTSError:
            warning = "Audio is unavailable right now. The text answer is shown instead."

    return PortfolioQueryResponse(
        intent=result["intent"],
        answer=result["answer"],
        audio_url=audio_url,
        warning=warning,
        highlight_node_ids=result["highlight_node_ids"],
        highlight_edge_ids=result["highlight_edge_ids"],
    )
