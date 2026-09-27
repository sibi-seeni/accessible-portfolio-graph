# Frontend AGENTS.md — Accessible Portfolio Graph (Person B)

Read this before generating any code. It reflects the REAL backend responses
(hit live on 2026-09-26), not just the roadmap doc's prose — several things
differ from what was originally assumed. Do not invent endpoints, fields, or
scope beyond what's documented here.

## Tech stack

- React (function components, hooks)
- `react-force-graph` for the graph visualization
- `tone.js` for sonification
- styled-components for styling
- Repo layout: frontend lives in `/frontend` (or `/app`) as a subfolder of the
  same repo as the backend, not a separate repo.

## API contract (confirmed against real responses)

```
GET  /health                        -> { status: "ok" }
GET  /portfolios                    -> [{ id, name }, ...]
GET  /portfolio/{id}/graph          -> { portfolio_id, portfolio_name, nodes, edges }
GET  /portfolio/{id}/insight        -> see shape below
GET  /portfolio/{id}/audio          -> { portfolio_id, holdings: {url, transcript}, risk: {url, transcript} }
POST /portfolio/{id}/query
```

Set `.env` with the backend's local base URL before wiring real fetches
(placeholder until confirmed: `http://localhost:8000`).

### `/portfolio/{id}/graph` — NOT flat holdings-only

Nodes come in two `type`s:
- `"holding"` — an actual asset. Fields: `id`, `type`, `label`, `ticker`,
  `sector`, `weight`.
- `"sector"` — a hub node, one per distinct sector in this portfolio. Fields:
  `id` (`"sector:<Name>"`), `type`, `label`.

Edges come in two `type` categories:
- `"belongs_to_sector"` — structural edge linking a holding to its sector hub.
  `label` and `note` are always `null`.
- One of the 7 `via` exposure types (`demand_driver`, `operating_dependency`,
  `housing_cycle`, `lending`, `credit_market`, `financing_dependency`,
  `supply_chain`) — holding-to-holding, with `label`, `exposure_sector`, and a
  human-readable `note`.

**Decision:** render sector nodes as real hub nodes in the graph (not
hidden/collapsed) — a holding can have sector-level indirect dependency
that's worth seeing as its own hub (e.g. a mining company having indirect
dependency to battery manufacturing). See Visual Config below for styling.

There is **no `asset_class` field** anywhere in the payload. Asset class is
looked up client-side from `TICKER_ASSET_CLASS` in
`src/config/visualConfig.ts` — do not try to infer it from ticker naming
patterns at runtime; the lookup table is the source of truth for this static
3-portfolio scope.

### `/portfolio/{id}/insight` — has extra fields, and `narration` is null

Real shape:
```json
{
  "portfolio_id": 1,
  "portfolio_name": "...",
  "sector": "...",
  "percentage": 60.0,
  "direct_tickers": ["..."],
  "indirect_tickers": ["...", "..."],
  "contributing_tickers": ["...", "..."],
  "exposure_edge_ids": [1, 2],
  "exposure_notes": ["...", "..."],
  "methodology": "...",
  "narration": null
}
```

`narration` is `null` on every portfolio checked. **Decision:** for the
visual-mode highlight card text, reuse the `risk` transcript from the
`/audio` response for the same portfolio instead of `narration`.

**Critical:** `insight.sector` is label text only — it is NOT guaranteed to
match an existing `sector:<Name>` node id. Portfolio 3's insight sector is
`"Battery & Critical Minerals"`, a cross-cutting theme that has no matching
sector node in that portfolio's graph (real sector nodes there are
Automotive, Energy, Industrials, Materials & Mining). **Highlight/pulse logic
must key off `contributing_tickers` -> holding node ids only.** Never attempt
to resolve `insight.sector` to a sector node for highlighting.

### `/portfolio/{id}/audio` — two clips, not one

Real shape:
```json
{
  "portfolio_id": 1,
  "holdings": { "url": "...", "transcript": "..." },
  "risk": { "url": "...", "transcript": "..." }
}
```

**Decision:** audio-first mode presents both clips with user-driven
selection (two buttons/keys — "Holdings overview" / "Risk & concentration"),
not auto-sequential playback.

## Visual mode spec (locked)

- **Color = sector.** Full palette for all 13 sectors across the 3 demo
  portfolios is in `SECTOR_COLOR` (`src/config/visualConfig.ts`). Sector hub
  nodes use their own sector's color; holding nodes use their `sector` field
  to look up the same palette.
- **Shape = asset class**, for holding nodes only: circle = public equity,
  square = private equity, house = real estate, diamond = private credit,
  hexagon = infrastructure. Lookup via `TICKER_ASSET_CLASS` +
  `ASSET_CLASS_SHAPE`. One legend chip per shape (5 total).
- **Sector hub nodes**: larger neutral circle (no asset-class shape), colored
  by `SECTOR_COLOR[sector]`, labeled with the sector name. See
  `SECTOR_NODE_STYLE`.
- **`belongs_to_sector` edges**: thin gray/neutral line
  (`SECTOR_MEMBERSHIP_EDGE_STYLE`), kept visually separate from the 3
  via-group line styles below.
- **`via` exposure edges**: grouped into 3 line styles via `VIA_TO_GROUP` +
  `GROUP_LINE_STYLE` — cash-flow-linked (`demand_driver`,
  `operating_dependency`, `supply_chain`) = dashed; financing-linked
  (`lending`, `credit_market`, `financing_dependency`) = dotted;
  `housing_cycle` = solid-thin. Do not render 7 distinct line styles.
- Selecting a holding shows: sector, exposure notes, asset class, and (where
  relevant) the `via` label in plain language.
- On portfolio select: animate graph in, then fetch `/insight`, highlight
  `contributing_tickers` (red/pulsing), show the `risk` audio transcript (see
  above) as the highlight card text.

## Audio-first mode spec (mostly unchanged from v1)

Accessibility fundamentals, keyboard nav, ARIA, and NL query flow are
unchanged from the v1 plan. Sonification stays simple: one tone per sector,
volume/pitch scales with exposure %, one alert chime before risk narration.
**Do not** add a distinct sound per `via` type — resist this scope creep
unless everything else is done early. The sonification cue for the flagged
insight should visibly map to the same `sector` + `percentage` numbers shown
on the visual mode's highlight card.

Two audio clips per portfolio (see above) — surface both as user-selectable,
not auto-played in sequence.

## Fixture

`src/mocks/fixtures.ts` contains the real (not guessed) responses for all 3
portfolios, pulled live from the backend on 2026-09-27. Build both UI shells
against this before wiring the real fetch calls.

## Scope reminders

- 3 portfolios, 5–7 holdings each, no live market data, no auth.
- If a real response ever contradicts something in this doc, that's a
  conversation with Person A (backend) — don't quietly work around a schema
  mismatch.
