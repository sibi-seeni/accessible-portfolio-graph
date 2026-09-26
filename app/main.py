from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.graph import build_portfolio_graph
from app.models import Portfolio
from app.schemas import PortfolioGraph, PortfolioSummary

app = FastAPI(title="Portfolio Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
