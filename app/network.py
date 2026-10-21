"""Multi-hop traversal over the exposure graph.

The one-hop insight in `app.insight` stays the headline metric. This module
adds the questions a single hop cannot answer:

- neighbourhood: which assets sit within N hops of a portfolio's holdings,
- paths: every simple route between two assets, up to N hops,
- themes: sector/theme exposure where each extra hop is discounted by `decay`,
- shock: which holdings sit near a stressed asset, and by how much.

Edges are curated statements "ticker is exposed to exposed_to_ticker". Theme
exposure follows that direction (a holding inherits the themes of what it is
exposed to). Paths, neighbourhoods and shocks treat edges as undirected,
because a shock can travel either way along a dependency (a lithium shortage
hits Tesla, and weaker NVIDIA demand hits data centres), and each step reports
whether it was walked forwards or backwards.

All functions are pure and deterministic: inputs are plain dataclasses, ties
are broken by hop count, then edge ids, then ticker.

This is a structural map of curated relationships, not a risk model. Decay is
a presentation discount for distance, not an estimated correlation.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Iterable, Sequence

MAX_HOPS_LIMIT = 5
MAX_PATHS_LIMIT = 25


@dataclass(frozen=True)
class NetEdge:
    id: int
    ticker: str
    exposed_to_ticker: str
    via: str
    exposure_sector: str
    note: str


@dataclass(frozen=True)
class NetHolding:
    ticker: str
    sector: str
    weight: Decimal


@dataclass(frozen=True)
class PathStep:
    edge: NetEdge
    forward: bool  # True when walked ticker -> exposed_to_ticker

    @property
    def start(self) -> str:
        return self.edge.ticker if self.forward else self.edge.exposed_to_ticker

    @property
    def end(self) -> str:
        return self.edge.exposed_to_ticker if self.forward else self.edge.ticker


@dataclass(frozen=True)
class Path:
    steps: tuple[PathStep, ...]

    @property
    def tickers(self) -> list[str]:
        if not self.steps:
            return []
        return [self.steps[0].start] + [step.end for step in self.steps]

    @property
    def edge_ids(self) -> list[int]:
        return [step.edge.id for step in self.steps]

    @property
    def hops(self) -> int:
        return len(self.steps)


@dataclass(frozen=True)
class Neighbourhood:
    hop_by_ticker: dict[str, int]
    edges: list[NetEdge]


@dataclass
class ThemeContribution:
    ticker: str
    weight: Decimal
    strength: Decimal
    hops: int  # 0 = held directly in / anchoring the theme
    edge_ids: list[int] = field(default_factory=list)


@dataclass
class ThemeScore:
    sector: str
    score: Decimal
    contributions: list[ThemeContribution]


@dataclass
class ShockHit:
    ticker: str
    weight: Decimal
    hops: int
    impact: Decimal
    path: Path


def clamp_hops(max_hops: int) -> int:
    return max(1, min(MAX_HOPS_LIMIT, max_hops))


def _undirected(edges: Iterable[NetEdge]) -> dict[str, list[PathStep]]:
    adjacency: dict[str, list[PathStep]] = {}
    for edge in sorted(edges, key=lambda e: e.id):
        adjacency.setdefault(edge.ticker, []).append(PathStep(edge, True))
        adjacency.setdefault(edge.exposed_to_ticker, []).append(PathStep(edge, False))
    return adjacency


def neighbourhood(
    seeds: Iterable[str], edges: Sequence[NetEdge], depth: int
) -> Neighbourhood:
    """Breadth-first expansion from `seeds`.

    An edge is included when it touches a node discovered at hop < depth, so
    depth=1 returns every edge that touches a seed (the classic portfolio view).
    """
    adjacency = _undirected(edges)
    hop_by_ticker = {ticker: 0 for ticker in sorted(set(seeds))}
    included: dict[int, NetEdge] = {}
    queue = deque(hop_by_ticker)
    while queue:
        ticker = queue.popleft()
        hop = hop_by_ticker[ticker]
        if hop >= depth:
            continue
        for step in adjacency.get(ticker, []):
            included[step.edge.id] = step.edge
            if step.end not in hop_by_ticker:
                hop_by_ticker[step.end] = hop + 1
                queue.append(step.end)
    return Neighbourhood(
        hop_by_ticker=hop_by_ticker,
        edges=[included[edge_id] for edge_id in sorted(included)],
    )


def find_paths(
    source: str,
    target: str,
    edges: Sequence[NetEdge],
    max_hops: int = 3,
    limit: int = 10,
) -> list[Path]:
    """All simple paths between two tickers, shortest first."""
    if source == target:
        return []
    max_hops = clamp_hops(max_hops)
    limit = max(1, min(MAX_PATHS_LIMIT, limit))
    adjacency = _undirected(edges)
    found: list[Path] = []

    def walk(ticker: str, visited: set[str], steps: list[PathStep]) -> None:
        if len(steps) >= max_hops:
            return
        for step in adjacency.get(ticker, []):
            if step.end in visited:
                continue
            next_steps = steps + [step]
            if step.end == target:
                found.append(Path(tuple(next_steps)))
                continue
            visited.add(step.end)
            walk(step.end, visited, next_steps)
            visited.remove(step.end)

    walk(source, {source}, [])
    found.sort(key=lambda path: (path.hops, path.edge_ids))
    return found[:limit]


def theme_scores(
    holdings: Sequence[NetHolding],
    edges: Sequence[NetEdge],
    max_hops: int = 3,
    decay: Decimal = Decimal("0.5"),
) -> list[ThemeScore]:
    """Multi-hop generalisation of `app.insight.compute_theme_scores`.

    For every holding, walk outgoing edges up to `max_hops`. An edge reached at
    hop k carries its theme with strength decay**(k-1); a holding keeps its
    strongest route per theme. Direct membership (holding sector, or anchoring a
    theme edge from another holding) has strength 1. With max_hops=1 the scores
    equal the one-hop combined weights exactly.
    """
    if not holdings:
        return []
    max_hops = clamp_hops(max_hops)
    held = {holding.ticker for holding in holdings}
    outgoing: dict[str, list[NetEdge]] = {}
    for edge in sorted(edges, key=lambda e: e.id):
        outgoing.setdefault(edge.ticker, []).append(edge)

    best: dict[str, dict[str, ThemeContribution]] = {}

    def offer(sector: str, holding: NetHolding, strength: Decimal, hops: int, edge_ids: list[int]) -> None:
        per_holding = best.setdefault(sector, {})
        current = per_holding.get(holding.ticker)
        candidate = ThemeContribution(holding.ticker, holding.weight, strength, hops, edge_ids)
        if current is None or (strength, -hops) > (current.strength, -current.hops):
            per_holding[holding.ticker] = candidate

    for holding in holdings:
        offer(holding.sector, holding, Decimal(1), 0, [])

    for edge in edges:
        if edge.ticker in held and edge.exposed_to_ticker in held:
            anchor = next(h for h in holdings if h.ticker == edge.exposed_to_ticker)
            offer(edge.exposure_sector, anchor, Decimal(1), 0, [edge.id])

    for holding in holdings:
        # Breadth-first so the first time a node is reached is via its fewest hops.
        frontier: list[tuple[str, list[int]]] = [(holding.ticker, [])]
        visited = {holding.ticker}
        for hop in range(1, max_hops + 1):
            strength = decay ** (hop - 1)
            next_frontier: list[tuple[str, list[int]]] = []
            for ticker, route in frontier:
                for edge in outgoing.get(ticker, []):
                    edge_route = route + [edge.id]
                    offer(edge.exposure_sector, holding, strength, hop, edge_route)
                    if edge.exposed_to_ticker not in visited:
                        visited.add(edge.exposed_to_ticker)
                        next_frontier.append((edge.exposed_to_ticker, edge_route))
            frontier = next_frontier

    scores = []
    for sector, per_holding in best.items():
        contributions = sorted(
            per_holding.values(),
            key=lambda c: (c.hops, -c.weight * c.strength, c.ticker),
        )
        score = sum((c.weight * c.strength for c in contributions), Decimal(0))
        scores.append(ThemeScore(sector, score, contributions))
    scores.sort(key=lambda s: (-s.score, s.sector))
    return scores


def shock(
    shocked: str,
    holdings: Sequence[NetHolding],
    edges: Sequence[NetEdge],
    max_hops: int = 3,
    decay: Decimal = Decimal("0.5"),
) -> list[ShockHit]:
    """Holdings within `max_hops` of a stressed asset, nearest first.

    Impact is decay**hops (1 for the shocked asset itself), multiplied by the
    holding weight when summed into a portfolio figure by the caller.
    """
    max_hops = clamp_hops(max_hops)
    adjacency = _undirected(edges)
    routes: dict[str, tuple[PathStep, ...]] = {shocked: ()}
    queue = deque([shocked])
    while queue:
        ticker = queue.popleft()
        route = routes[ticker]
        if len(route) >= max_hops:
            continue
        for step in adjacency.get(ticker, []):
            if step.end not in routes:
                routes[step.end] = route + (step,)
                queue.append(step.end)

    hits = []
    for holding in holdings:
        route = routes.get(holding.ticker)
        if route is None:
            continue
        hops = len(route)
        hits.append(
            ShockHit(
                ticker=holding.ticker,
                weight=holding.weight,
                hops=hops,
                impact=decay**hops,
                path=Path(route),
            )
        )
    hits.sort(key=lambda hit: (hit.hops, -hit.weight, hit.ticker))
    return hits
