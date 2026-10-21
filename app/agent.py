"""Connection agent: an LLM tool loop that proposes companies and exposures.

The agent reads the graph through tools and can only write *proposals*
(status "proposed", source "agent"). A person approves or rejects each one in
the UI, which keeps the rule that the graph's relationships are curated rather
than invented by a model; the model drafts, people decide.

It talks to Snowflake Cortex through the OpenAI-compatible Chat Completions
API (tool calling is supported there for OpenAI and Claude models). Set
AGENT_BASE_URL / AGENT_API_KEY / AGENT_MODEL to point it at any other
OpenAI-compatible endpoint instead.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Protocol

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import catalog
from app.config import get_settings
from app.graph import to_net_edge, visible_exposures
from app.models import (
    ASSET_CLASS_VALUES,
    EXPOSURE_VIA_VALUES,
    SOURCE_AGENT,
    STATUS_APPROVED,
    STATUS_PROPOSED,
    Company,
    Exposure,
    Holding,
    Portfolio,
)
from app.narration import REQUEST_TIMEOUT_SECONDS, NarrationError, _build_client, _candidate_models
from app.network import find_paths
from app.schemas import AgentRunResponse, AgentStep

MAX_PROPOSED_EXPOSURES = 8

VIA_GUIDE = {
    "demand_driver": "growth at the source drives demand for the target",
    "operating_dependency": "the source needs the target's output or capacity to operate",
    "supply_chain": "the source depends on the target as a supplier of inputs",
    "lending": "the source lends against, or finances, assets like the target",
    "credit_market": "both depend on the same lending and interest-rate conditions",
    "financing_dependency": "the source relies on financing the target provides",
    "housing_cycle": "both are driven by the same housing demand cycle",
}

SYSTEM_PROMPT = f"""You maintain a curated knowledge graph of economic exposure between assets
(public equities, private equity, real estate, private credit, infrastructure).
An exposure edge reads "ticker is exposed to exposed_to_ticker via <via>", with
exposure_sector naming the shared hidden theme (for example Tesla -> Albemarle
via supply_chain, theme "Battery & Critical Minerals").

Your job: carry out the user's instruction by inspecting the graph with tools
and then proposing new companies and exposures. Everything you write is a
proposal a person will review, so quality matters more than volume.

Rules:
- Inspect before you write: search for companies and check existing edges so
  you never duplicate an asset or relationship.
- Only propose relationships that are well documented and widely reported
  (supplier, customer, financing or demand links). Never invent figures,
  ownership stakes, contracts, or private-company facts.
- Prefer linking new assets to companies already in the graph, especially ones
  held in portfolios, because that is what surfaces hidden concentration.
- Public companies use their real ticker. Private or synthetic assets use an
  UPPER_SNAKE_CASE identifier.
- via must be one of: {json.dumps(VIA_GUIDE)}
- asset_class must be one of: {", ".join(ASSET_CLASS_VALUES)}.
- Reuse an existing sector name for exposure_sector when one fits; call
  list_sectors first.
- The note is one or two factual sentences explaining the mechanism.
- confidence is your honest 0-1 estimate that the relationship is real and
  material. Skip anything below 0.5.
- Propose at most {MAX_PROPOSED_EXPOSURES} exposures per run.
- When done, call finish with a short plain-text summary of what you proposed
  and why. If nothing well-supported exists, say so and propose nothing.
"""


def _fn(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            },
        },
    }


_STR = {"type": "string"}

TOOLS: list[dict[str, Any]] = [
    _fn(
        "search_companies",
        "Find companies already in the graph by ticker, name or sector substring.",
        {"query": _STR},
        ["query"],
    ),
    _fn(
        "get_company",
        "Details for one company: sector, asset class, which portfolios hold it, and every existing or proposed exposure touching it.",
        {"ticker": _STR},
        ["ticker"],
    ),
    _fn(
        "get_portfolio",
        "Holdings (ticker, name, sector, weight) of a portfolio.",
        {"portfolio_id": {"type": "integer"}},
        ["portfolio_id"],
    ),
    _fn("list_portfolios", "All portfolios with ids and names.", {}, []),
    _fn("list_sectors", "All sector / theme names currently in use.", {}, []),
    _fn(
        "find_paths",
        "Existing multi-hop routes between two assets (approved and proposed edges).",
        {"source": _STR, "target": _STR, "max_hops": {"type": "integer", "minimum": 1, "maximum": 5}},
        ["source", "target"],
    ),
    _fn(
        "propose_company",
        "Propose adding an asset to the graph. Required before proposing exposures that involve it.",
        {
            "ticker": _STR,
            "company_name": _STR,
            "sector": _STR,
            "asset_class": {"type": "string", "enum": list(ASSET_CLASS_VALUES)},
            "description": _STR,
        },
        ["ticker", "company_name", "sector", "asset_class", "description"],
    ),
    _fn(
        "propose_exposure",
        "Propose a directed exposure edge between two assets that exist (approved or proposed).",
        {
            "ticker": _STR,
            "exposed_to_ticker": _STR,
            "via": {"type": "string", "enum": list(EXPOSURE_VIA_VALUES)},
            "exposure_sector": _STR,
            "note": _STR,
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        ["ticker", "exposed_to_ticker", "via", "exposure_sector", "note", "confidence"],
    ),
    _fn(
        "finish",
        "End the run with a short summary for the reviewer.",
        {"summary": _STR},
        ["summary"],
    ),
]


TOOL_NAMES = frozenset(tool["function"]["name"] for tool in TOOLS)


class AgentUnavailableError(RuntimeError):
    """No model endpoint is configured or every model failed."""


class ChatClient(Protocol):
    chat: Any


def build_agent_client() -> tuple[ChatClient, list[str]]:
    settings = get_settings()
    if settings.agent_base_url:
        client = OpenAI(
            base_url=settings.agent_base_url,
            api_key=settings.agent_api_key or "unused",
            timeout=REQUEST_TIMEOUT_SECONDS * 2,
        )
        return client, [settings.agent_model or settings.snowflake_model]
    try:
        client = _build_client()
        models = _candidate_models()
    except NarrationError as exc:
        raise AgentUnavailableError(
            "The connection agent needs SNOWFLAKE_ACCOUNT_URL and SNOWFLAKE_PAT "
            "(or AGENT_BASE_URL) in .env."
        ) from exc
    if settings.agent_model:
        models = [settings.agent_model] + [m for m in models if m != settings.agent_model]
    return client, models


class _Run:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.company_tickers: list[str] = []
        self.exposure_ids: list[int] = []
        self.summary: str | None = None

    # Read tools -----------------------------------------------------------

    def search_companies(self, query: str) -> Any:
        rows = catalog.list_companies(self.session, query, include_proposed=True)
        return [
            {"ticker": c.ticker, "name": c.company_name, "sector": c.sector, "status": c.status, "held_in": c.held_in}
            for c in rows[:25]
        ]

    def get_company(self, ticker: str) -> Any:
        ticker = catalog.normalize_ticker(ticker)
        company = self.session.get(Company, ticker)
        if company is None:
            return {"error": f"{ticker} is not in the graph."}
        exposures = self.session.scalars(
            select(Exposure)
            .where(Exposure.status.in_([STATUS_APPROVED, STATUS_PROPOSED]))
            .where((Exposure.ticker == ticker) | (Exposure.exposed_to_ticker == ticker))
            .order_by(Exposure.id)
        ).all()
        return {
            **catalog.company_out(self.session, company).model_dump(),
            "exposures": [catalog.exposure_out(e).model_dump() for e in exposures],
        }

    def get_portfolio(self, portfolio_id: int) -> Any:
        portfolio = self.session.get(Portfolio, portfolio_id)
        if portfolio is None:
            return {"error": f"Portfolio {portfolio_id} not found."}
        holdings = self.session.scalars(
            select(Holding).where(Holding.portfolio_id == portfolio_id).order_by(Holding.id)
        ).all()
        return {
            "id": portfolio.id,
            "name": portfolio.name,
            "holdings": [catalog.holding_out(h).model_dump() for h in holdings],
        }

    def list_portfolios(self) -> Any:
        return [
            {"id": p.id, "name": p.name}
            for p in self.session.scalars(select(Portfolio).order_by(Portfolio.id)).all()
        ]

    def list_sectors(self) -> Any:
        return catalog.sector_names(self.session)

    def find_paths(self, source: str, target: str, max_hops: int = 3) -> Any:
        edges = [to_net_edge(e) for e in visible_exposures(self.session, include_proposed=True)]
        paths = find_paths(
            catalog.normalize_ticker(source), catalog.normalize_ticker(target), edges, max_hops
        )
        return [
            {"tickers": path.tickers, "edge_ids": path.edge_ids, "vias": [s.edge.via for s in path.steps]}
            for path in paths
        ]

    # Write tools (proposals only) -------------------------------------------

    def propose_company(
        self, ticker: str, company_name: str, sector: str, asset_class: str, description: str
    ) -> Any:
        company = catalog.create_company(
            self.session,
            ticker=ticker,
            company_name=company_name,
            sector=sector,
            asset_class=asset_class,
            description=description,
            status=STATUS_PROPOSED,
            source=SOURCE_AGENT,
        )
        self.company_tickers.append(company.ticker)
        return {"proposed": company.ticker}

    def propose_exposure(
        self,
        ticker: str,
        exposed_to_ticker: str,
        via: str,
        exposure_sector: str,
        note: str,
        confidence: float,
    ) -> Any:
        if len(self.exposure_ids) >= MAX_PROPOSED_EXPOSURES:
            return {"error": f"Limit of {MAX_PROPOSED_EXPOSURES} proposals reached; call finish."}
        if confidence < 0.5:
            return {"skipped": "confidence below 0.5"}
        exposure = catalog.create_exposure(
            self.session,
            ticker=ticker,
            exposed_to_ticker=exposed_to_ticker,
            via=via,
            exposure_sector=exposure_sector,
            note=note,
            status=STATUS_PROPOSED,
            source=SOURCE_AGENT,
            confidence=round(float(confidence), 2),
        )
        self.exposure_ids.append(exposure.id)
        return {"proposed_exposure_id": exposure.id}

    def finish(self, summary: str) -> Any:
        self.summary = summary.strip()
        return {"ok": True}

    def call(self, name: str, arguments: dict[str, Any]) -> Any:
        if name not in TOOL_NAMES:
            return {"error": f"Unknown tool {name!r}."}
        handler: Callable[..., Any] = getattr(self, name)
        # A savepoint per tool keeps one bad call from poisoning the transaction.
        nested = self.session.begin_nested()
        try:
            result = handler(**arguments)
        except (catalog.CatalogError, catalog.NotFoundError, catalog.ConflictError) as exc:
            nested.rollback()
            return {"error": str(exc)}
        except TypeError as exc:
            nested.rollback()
            return {"error": f"Bad arguments for {name}: {exc}"}
        nested.commit()
        return result


def _context(session: Session, portfolio_id: int | None) -> str:
    if portfolio_id is None:
        return "No portfolio is selected; work across the whole graph."
    portfolio = session.get(Portfolio, portfolio_id)
    if portfolio is None:
        return "No portfolio is selected; work across the whole graph."
    return f"The user is looking at portfolio {portfolio.id} ({portfolio.name})."


def _complete(client: ChatClient, models: list[str], messages: list[dict[str, Any]]) -> tuple[Any, str]:
    errors = []
    for model in models:
        try:
            response = client.chat.completions.create(
                model=model, messages=messages, tools=TOOLS, tool_choice="auto"
            )
            return response.choices[0].message, model
        except Exception as exc:  # noqa: BLE001 - try every configured model
            errors.append(f"{model}: {exc}")
    raise AgentUnavailableError("Agent model call failed. " + " | ".join(errors))


def run_agent(
    session: Session,
    instruction: str,
    portfolio_id: int | None = None,
    max_steps: int = 8,
    client: ChatClient | None = None,
    models: list[str] | None = None,
) -> AgentRunResponse:
    """Run the tool loop, commit the proposals it made, and return the trace."""
    if client is None:
        client, default_models = build_agent_client()
        models = models or default_models
    models = models or ["default"]

    run = _Run(session)
    steps: list[AgentStep] = []
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{_context(session, portfolio_id)}\n\nInstruction: {instruction}"},
    ]
    used_model = models[0]

    for _ in range(max_steps):
        message, used_model = _complete(client, models, messages)
        tool_calls = list(getattr(message, "tool_calls", None) or [])
        if not tool_calls:
            run.summary = run.summary or (message.content or "").strip()
            break
        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {"name": call.function.name, "arguments": call.function.arguments},
                    }
                    for call in tool_calls
                ],
            }
        )
        for call in tool_calls:
            try:
                arguments = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                arguments = {}
                result: Any = {"error": "Arguments were not valid JSON."}
            else:
                result = run.call(call.function.name, arguments)
            steps.append(AgentStep(tool=call.function.name, arguments=arguments, result=result))
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, default=str),
                }
            )
        if run.summary is not None:
            break

    session.commit()
    return AgentRunResponse(
        summary=run.summary or "The agent stopped before writing a summary.",
        model=used_model,
        steps=steps,
        proposed_company_tickers=run.company_tickers,
        proposed_exposure_ids=run.exposure_ids,
    )
