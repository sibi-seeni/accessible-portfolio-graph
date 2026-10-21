// Response shapes for the explorer endpoints added alongside the original
// graph / insight / audio / query contract (see frontend/AGENTS.md).

export interface PathStep {
  edge_id: string;
  from_ticker: string;
  to_ticker: string;
  via: string;
  exposure_sector: string;
  note: string;
  forward: boolean;
}

export interface GraphPath {
  hops: number;
  tickers: string[];
  node_ids: string[];
  edge_ids: string[];
  steps: PathStep[];
}

export interface PathsResponse {
  portfolio_id: number;
  source: string;
  target: string;
  max_hops: number;
  paths: GraphPath[];
}

export interface ThemeContribution {
  ticker: string;
  name: string;
  weight: number;
  strength: number;
  hops: number;
  edge_ids: string[];
}

export interface Theme {
  sector: string;
  percentage: number;
  one_hop_percentage: number;
  contributions: ThemeContribution[];
}

export interface ThemesResponse {
  portfolio_id: number;
  max_hops: number;
  decay: number;
  methodology: string;
  themes: Theme[];
}

export interface ShockHit {
  ticker: string;
  name: string;
  weight: number;
  hops: number;
  impact: number;
  path: GraphPath;
}

export interface ShockResponse {
  portfolio_id: number;
  ticker: string;
  name: string;
  max_hops: number;
  decay: number;
  portfolio_impact_percentage: number;
  methodology: string;
  hits: ShockHit[];
}

export type ReviewStatus = "approved" | "proposed" | "rejected";

export interface Company {
  ticker: string;
  company_name: string;
  sector: string;
  asset_class: string;
  description: string | null;
  status: ReviewStatus;
  source: string;
  held_in: number[];
}

export interface Exposure {
  id: number;
  ticker: string;
  exposed_to_ticker: string;
  via: string;
  exposure_sector: string;
  note: string;
  status: ReviewStatus;
  source: string;
  confidence: number | null;
}

export interface Holding {
  ticker: string;
  company_name: string;
  sector: string;
  weight: number;
  shares: number;
}

export interface Proposals {
  companies: Company[];
  exposures: Exposure[];
}

export interface Meta {
  via_values: string[];
  asset_classes: string[];
  sectors: string[];
}

export interface AgentStep {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface AgentRun {
  summary: string;
  model: string;
  steps: AgentStep[];
  proposed_company_tickers: string[];
  proposed_exposure_ids: number[];
}

// A set of node/edge ids to emphasise on the graph, with a caption.
export interface Highlight {
  label: string;
  nodeIds: string[];
  edgeIds: string[];
}
