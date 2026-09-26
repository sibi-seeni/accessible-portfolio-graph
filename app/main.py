from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audio import STATIC_DIR, AudioUnavailableError, get_portfolio_audio
from app.db import get_session
from app.graph import build_portfolio_graph
from app.insight import get_portfolio_insight
from app.models import Portfolio
from app.narration import NarrationError
from app.query import (
    INTENT_UNSUPPORTED,
    PortfolioNotFoundError,
    answer_portfolio_question,
)
from app.schemas import (
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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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


@app.get("/portfolio/{portfolio_id}/graph", response_model=PortfolioGraph)
def get_portfolio_graph(
    portfolio_id: int, session: Session = Depends(get_session)
) -> PortfolioGraph:
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return build_portfolio_graph(session, portfolio)


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
