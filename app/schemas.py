from typing import Any

from pydantic import BaseModel, Field, model_serializer


class PortfolioSummary(BaseModel):
    id: int
    name: str


class GraphNode(BaseModel):
    id: str
    type: str
    label: str
    ticker: str | None = None
    sector: str | None = None
    weight: float | None = None
    asset_class: str | None = None
    hop: int | None = None
    status: str | None = None

    @model_serializer
    def _serialize(self) -> dict[str, object]:
        data: dict[str, object] = {"id": self.id, "type": self.type, "label": self.label}
        for key in ("ticker", "sector", "weight", "asset_class", "hop", "status"):
            value = getattr(self, key)
            if value is not None:
                data[key] = value
        return data


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    exposure_sector: str | None = None
    note: str | None = None
    status: str | None = None
    # Who created the relationship (curated / user / agent). Named `origin`
    # because `source` is already the edge's source node.
    origin: str | None = None
    confidence: float | None = None

    @model_serializer
    def _serialize(self) -> dict[str, object]:
        data: dict[str, object] = {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "type": self.type,
            "label": self.label,
        }
        if self.exposure_sector is not None:
            data["exposure_sector"] = self.exposure_sector
        data["note"] = self.note
        for key in ("status", "origin", "confidence"):
            value = getattr(self, key)
            if value is not None:
                data[key] = value
        return data


class PortfolioGraph(BaseModel):
    portfolio_id: int
    portfolio_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class PortfolioInsight(BaseModel):
    portfolio_id: int
    portfolio_name: str
    sector: str
    percentage: float
    direct_tickers: list[str]
    indirect_tickers: list[str]
    contributing_tickers: list[str]
    exposure_edge_ids: list[int]
    exposure_notes: list[str]
    methodology: str
    narration: str | None = None


class AudioItem(BaseModel):
    url: str
    transcript: str


class PortfolioAudioResponse(BaseModel):
    portfolio_id: int
    holdings: AudioItem
    risk: AudioItem


class PortfolioQueryRequest(BaseModel):
    question: str


class PortfolioQueryResponse(BaseModel):
    intent: str
    answer: str
    audio_url: str | None = None
    warning: str | None = None
    highlight_node_ids: list[str]
    highlight_edge_ids: list[str]


class PathStepOut(BaseModel):
    edge_id: str
    from_ticker: str
    to_ticker: str
    via: str
    exposure_sector: str
    note: str
    forward: bool


class PathOut(BaseModel):
    hops: int
    tickers: list[str]
    node_ids: list[str]
    edge_ids: list[str]
    steps: list[PathStepOut]


class PathsResponse(BaseModel):
    portfolio_id: int
    source: str
    target: str
    max_hops: int
    paths: list[PathOut]


class ThemeContributionOut(BaseModel):
    ticker: str
    name: str
    weight: float
    strength: float
    hops: int
    edge_ids: list[str]


class ThemeOut(BaseModel):
    sector: str
    percentage: float
    one_hop_percentage: float
    contributions: list[ThemeContributionOut]


class ThemesResponse(BaseModel):
    portfolio_id: int
    max_hops: int
    decay: float
    methodology: str
    themes: list[ThemeOut]


class ShockRequest(BaseModel):
    ticker: str
    max_hops: int = 3
    decay: float = Field(default=0.5, gt=0, le=1)


class ShockHitOut(BaseModel):
    ticker: str
    name: str
    weight: float
    hops: int
    impact: float
    path: PathOut


class ShockResponse(BaseModel):
    portfolio_id: int
    ticker: str
    name: str
    max_hops: int
    decay: float
    portfolio_impact_percentage: float
    methodology: str
    hits: list[ShockHitOut]


class CompanyOut(BaseModel):
    ticker: str
    company_name: str
    sector: str
    asset_class: str
    description: str | None = None
    status: str
    source: str
    held_in: list[int] = []


class CompanyCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=40)
    company_name: str = Field(min_length=1, max_length=200)
    sector: str = Field(min_length=1, max_length=80)
    asset_class: str
    description: str | None = Field(default=None, max_length=2000)


class ExposureCreate(BaseModel):
    ticker: str
    exposed_to_ticker: str
    via: str
    exposure_sector: str
    note: str = Field(min_length=1, max_length=2000)


class ExposureOut(BaseModel):
    id: int
    ticker: str
    exposed_to_ticker: str
    via: str
    exposure_sector: str
    note: str
    status: str
    source: str
    confidence: float | None = None


class HoldingCreate(BaseModel):
    ticker: str
    weight: float = Field(gt=0, lt=1)
    shares: int = Field(default=1, ge=0)


class HoldingOut(BaseModel):
    ticker: str
    company_name: str
    sector: str
    weight: float
    shares: int


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProposalsResponse(BaseModel):
    companies: list[CompanyOut]
    exposures: list[ExposureOut]


class AgentRunRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=2000)
    portfolio_id: int | None = None
    max_steps: int = Field(default=8, ge=1, le=16)


class AgentStep(BaseModel):
    tool: str
    arguments: dict[str, Any]
    result: Any


class AgentRunResponse(BaseModel):
    summary: str
    model: str
    steps: list[AgentStep]
    proposed_company_tickers: list[str]
    proposed_exposure_ids: list[int]
