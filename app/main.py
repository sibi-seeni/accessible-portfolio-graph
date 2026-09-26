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
from app.schemas import (
    PortfolioAudioResponse,
    PortfolioGraph,
    PortfolioInsight,
    PortfolioSummary,
)

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
