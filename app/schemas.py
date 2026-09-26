from pydantic import BaseModel, model_serializer


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

    @model_serializer
    def _serialize(self) -> dict[str, object]:
        data: dict[str, object] = {"id": self.id, "type": self.type, "label": self.label}
        if self.ticker is not None:
            data["ticker"] = self.ticker
        if self.sector is not None:
            data["sector"] = self.sector
        if self.weight is not None:
            data["weight"] = self.weight
        return data


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    exposure_sector: str | None = None
    note: str | None = None

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
