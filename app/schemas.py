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

    @model_serializer
    def _serialize(self) -> dict[str, object]:
        data: dict[str, object] = {"id": self.id, "type": self.type, "label": self.label}
        if self.ticker is not None:
            data["ticker"] = self.ticker
        if self.sector is not None:
            data["sector"] = self.sector
        return data


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    note: str | None = None


class PortfolioGraph(BaseModel):
    portfolio_id: int
    portfolio_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
