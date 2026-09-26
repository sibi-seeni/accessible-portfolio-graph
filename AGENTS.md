# AGENTS.md

## Environment
- Python virtual environment located in `.venv/`.
- Environment variables managed via `.env` (see `.env.example`).

## Tooling
- Framework: FastAPI (detected via `.venv/bin/fastapi`, `uvicorn`).
- Testing: pytest (detected via `.venv/bin/pytest`).

# Hackathon project constraints

This is a 24-hour hackathon backend. Optimize for simplicity, reliability, and demo readiness, not production architecture.

Project:
Accessible Portfolio Explorer. A cross-asset portfolio intelligence graph that reveals shared economic and sector dependencies across public equity, private equity, real estate, private credit, and infrastructure. Three static curated demo portfolios are represented as a small knowledge graph. The frontend visualizes holdings, sectors, and hidden exposure relationships. The backend also supports an audio-first mode.

Backend stack:
- Python 3.12+
- FastAPI
- Tiger Data hosted PostgreSQL
- SQLAlchemy
- Snowflake Cortex REST API / OpenAI-compatible endpoint
- ElevenLabs Python SDK
- pytest

STRICT SCOPE:
- Exactly 3 curated portfolios.
- Approximately 5-8 holdings each.
- Approximately 10-15 total hidden exposure relationships.
- Static data only.
- No live market-data API.
- No live filing ingestion.
- No recursive graph traversal.
- No Neo4j.
- No Timescale hypertables.
- No temporal graph model.
- No general text-to-SQL.
- No authentication.
- No Docker unless specifically requested.
- No deployment work; localhost demo.
- Prefer synchronous Python unless async provides an obvious benefit.
- Keep dependencies minimal.

Database tables (four-table architecture; do not change):
1. portfolios(id, name)
2. sectors(id, name)
3. holdings(id, portfolio_id, ticker, company_name, shares, sector)
4. exposures(id, ticker, exposed_to_ticker, via, note)

Asset identifiers (`ticker` / `exposed_to_ticker`):
`ticker` and `exposed_to_ticker` are legacy field/column names used as stable graph asset identifiers.
They do NOT imply that every referenced asset is publicly traded.
- Public equity holdings keep using their real ticker symbol (e.g. NVDA).
- Alternative assets (private equity, real estate, private credit, infrastructure) use synthetic stable identifiers (e.g. DATA_CENTER_FUND).
Examples:
- NVDA = public equity
- DATA_CENTER_FUND = real-estate investment
- PRIVATE_AI_CO = private-equity investment
- RE_CREDIT_FUND = private-credit investment

Terminology:
- When discussing generic graph nodes, prefer "holding", "asset", or "investment" over "company".
- Public tickers (e.g. NVDA, LEN, TSLA) are still valid holdings.
- Alternative assets use synthetic stable identifiers.
- The legacy `company_name` column stores the display name for any holding, including alternative assets.

Exposure via values (use only these; do not invent additional relationship types):
- demand_driver
- operating_dependency
- housing_cycle
- lending
- credit_market
- financing_dependency
- supply_chain

Core insight:
For a selected portfolio, combine direct sector exposure with curated indirect exposure. Return exactly one strongest hidden-sector concentration insight when possible.

API contract:
GET /health
GET /portfolios
GET /portfolio/{id}/graph
GET /portfolio/{id}/insight
GET /portfolio/{id}/audio
POST /portfolio/{id}/query

Expected insight shape:
{
  "sector": "...",
  "percentage": 45.2,
  "contributing_tickers": ["...", "..."],
  "exposure_notes": ["..."],
  "narration": "..."
}

Graph endpoint should produce frontend-ready JSON nodes and edges rather than forcing the frontend to reconstruct relationships.

Audio:
Pre-generate holdings and risk narration MP3 files for all 3 portfolios.
Only the natural-language query endpoint needs live Snowflake -> ElevenLabs generation.

Engineering rules:
- Do not redesign the architecture unless explicitly asked.
- Do not add speculative abstractions.
- Do not create a generalized graph engine.
- Keep functions small and readable.
- Add type hints.
- Fail clearly when environment variables are missing.
- Never hardcode secrets.
- Whenever changing code, run relevant tests or provide the exact test command.
- Preserve the API contract unless explicitly instructed to change it.