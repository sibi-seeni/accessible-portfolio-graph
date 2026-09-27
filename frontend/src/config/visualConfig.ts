// Locked visual decisions for the graph. See project decisions doc for rationale.
// Do not infer asset class from naming heuristics at runtime — this table is the
// source of truth (backend has no asset_class field).

export type AssetClass = "public_equity" | "private_equity" | "real_estate" | "private_credit" | "infrastructure";

export const ASSET_CLASS_SHAPE: Record<AssetClass, string> = {
  public_equity: "circle",
  private_equity: "square",
  real_estate: "house",
  private_credit: "diamond",
  infrastructure: "hexagon",
};

export const TICKER_ASSET_CLASS: Record<string, AssetClass> = {
  // Public equity
  JPM: "public_equity",
  LEN: "public_equity",
  NEE: "public_equity",
  NVDA: "public_equity",
  ALB: "public_equity",
  CAT: "public_equity",
  ENPH: "public_equity",
  F: "public_equity",
  GM: "public_equity",
  TSLA: "public_equity",
  XOM: "public_equity",
  // Private equity
  PRIVATE_AI_CO: "private_equity",
  PRIVATE_HOMEBUILDER: "private_equity",
  // Real estate
  DATA_CENTER_FUND: "real_estate",
  MULTIFAMILY_FUND: "real_estate",
  // Private credit
  RE_CREDIT_FUND: "private_credit",
  // Infrastructure
  INFRA_FUND: "infrastructure",
};

// Full sector palette across all 3 demo portfolios.
export const SECTOR_COLOR: Record<string, string> = {
  Financials: "#4A6FA5",
  Homebuilding: "#C97B3D",
  "Residential Real Estate": "#5FA777",
  "Real Estate Credit": "#8B6DAF",
  "Digital Infrastructure": "#3D8FB0",
  "Energy Infrastructure": "#4FA37D",
  Semiconductors: "#76B04A",
  Software: "#B0954F",
  Utilities: "#5E7EBF",
  Automotive: "#D46A6A",
  Energy: "#D4A24A",
  Industrials: "#8A8F99",
  "Materials & Mining": "#A0623D",
};

// Sector hub nodes: larger neutral circle, no asset-class shape, colored by SECTOR_COLOR.
export const SECTOR_NODE_STYLE = {
  shape: "circle",
  radiusMultiplier: 1.8, // relative to a standard holding node
  fill: "neutral", // use SECTOR_COLOR[sectorName] for the fill, not a fixed neutral hex
};

// `via` edge grouping -> line style. 7 via types collapse into 3 visual treatments.
export type ViaGroup = "cash_flow" | "financing" | "housing_cycle";

export const VIA_TO_GROUP: Record<string, ViaGroup> = {
  demand_driver: "cash_flow",
  operating_dependency: "cash_flow",
  supply_chain: "cash_flow",
  lending: "financing",
  credit_market: "financing",
  financing_dependency: "financing",
  housing_cycle: "housing_cycle",
};

export const GROUP_LINE_STYLE: Record<ViaGroup, string> = {
  cash_flow: "dashed",
  financing: "dotted",
  housing_cycle: "solid-thin",
};

// belongs_to_sector edges are structural, not a `via` exposure — separate style,
// not part of the 3 groups above.
export const SECTOR_MEMBERSHIP_EDGE_STYLE = {
  stroke: "#999999",
  style: "thin-solid",
};

// IMPORTANT: insight.sector is label text only. It is NOT guaranteed to match an
// existing sector node id (e.g. portfolio 3's "Battery & Critical Minerals" is a
// cross-cutting theme with no matching sector node). Highlight logic must key off
// insight.contributing_tickers -> holding node ids, never off insight.sector.
