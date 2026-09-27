// Hardcoded fixture built from REAL backend responses (not guessed from AGENTS.md prose).
// Source: live hits against /health, /portfolios, /portfolio/{id}/graph,
// /portfolio/{id}/insight, /portfolio/{id}/audio on 2026-09-27.
// If the backend schema changes, re-pull real responses — don't hand-edit shapes here.

export const health = { status: "ok" };

export const portfolios = [
  { id: 1, name: "AI Infrastructure" },
  { id: 2, name: "Housing Ecosystem" },
  { id: 3, name: "Energy Transition" },
];

export const graphs: Record<number, any> = {
  1: {
    portfolio_id: 1,
    portfolio_name: "AI Infrastructure",
    nodes: [
      { id: "holding:DATA_CENTER_FUND", type: "holding", label: "Hyperscale Data Center Fund", ticker: "DATA_CENTER_FUND", sector: "Digital Infrastructure", weight: 0.2 },
      { id: "holding:INFRA_FUND", type: "holding", label: "Renewable Infrastructure Fund", ticker: "INFRA_FUND", sector: "Energy Infrastructure", weight: 0.25 },
      { id: "holding:NEE", type: "holding", label: "NextEra Energy, Inc.", ticker: "NEE", sector: "Utilities", weight: 0.15 },
      { id: "holding:NVDA", type: "holding", label: "NVIDIA Corporation", ticker: "NVDA", sector: "Semiconductors", weight: 0.2 },
      { id: "holding:PRIVATE_AI_CO", type: "holding", label: "Private AI Software Co.", ticker: "PRIVATE_AI_CO", sector: "Software", weight: 0.2 },
      { id: "sector:Digital Infrastructure", type: "sector", label: "Digital Infrastructure" },
      { id: "sector:Energy Infrastructure", type: "sector", label: "Energy Infrastructure" },
      { id: "sector:Semiconductors", type: "sector", label: "Semiconductors" },
      { id: "sector:Software", type: "sector", label: "Software" },
      { id: "sector:Utilities", type: "sector", label: "Utilities" },
    ],
    edges: [
      { id: "belongs_to_sector:DATA_CENTER_FUND", source: "holding:DATA_CENTER_FUND", target: "sector:Digital Infrastructure", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:INFRA_FUND", source: "holding:INFRA_FUND", target: "sector:Energy Infrastructure", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:NEE", source: "holding:NEE", target: "sector:Utilities", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:NVDA", source: "holding:NVDA", target: "sector:Semiconductors", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:PRIVATE_AI_CO", source: "holding:PRIVATE_AI_CO", target: "sector:Software", type: "belongs_to_sector", label: null, note: null },
      { id: "exposure:1", source: "holding:NVDA", target: "holding:DATA_CENTER_FUND", type: "demand_driver", label: "demand_driver", exposure_sector: "Digital Infrastructure", note: "NVIDIA's accelerated-computing growth drives demand for high-density data-center capacity used to train and run AI models." },
      { id: "exposure:2", source: "holding:PRIVATE_AI_CO", target: "holding:DATA_CENTER_FUND", type: "demand_driver", label: "demand_driver", exposure_sector: "Digital Infrastructure", note: "The private AI software company depends on scalable compute infrastructure, creating indirect exposure to the data centers that host AI workloads." },
      { id: "exposure:3", source: "holding:DATA_CENTER_FUND", target: "holding:NEE", type: "operating_dependency", label: "operating_dependency", exposure_sector: "Utilities", note: "Hyperscale data centers require large and reliable electricity supplies, linking the real-estate investment to utility and power-generation capacity." },
      { id: "exposure:4", source: "holding:DATA_CENTER_FUND", target: "holding:INFRA_FUND", type: "operating_dependency", label: "operating_dependency", exposure_sector: "Energy Infrastructure", note: "Data-center growth increases demand for new generation and grid infrastructure, creating a connection to renewable infrastructure assets." },
    ],
  },
  2: {
    portfolio_id: 2,
    portfolio_name: "Housing Ecosystem",
    nodes: [
      { id: "holding:JPM", type: "holding", label: "JPMorgan Chase & Co.", ticker: "JPM", sector: "Financials", weight: 0.15 },
      { id: "holding:LEN", type: "holding", label: "Lennar Corporation", ticker: "LEN", sector: "Homebuilding", weight: 0.2 },
      { id: "holding:MULTIFAMILY_FUND", type: "holding", label: "Multifamily Housing Fund", ticker: "MULTIFAMILY_FUND", sector: "Residential Real Estate", weight: 0.25 },
      { id: "holding:PRIVATE_HOMEBUILDER", type: "holding", label: "Sunbelt Residential Partners", ticker: "PRIVATE_HOMEBUILDER", sector: "Homebuilding", weight: 0.2 },
      { id: "holding:RE_CREDIT_FUND", type: "holding", label: "Real Estate Credit Fund", ticker: "RE_CREDIT_FUND", sector: "Real Estate Credit", weight: 0.2 },
      { id: "sector:Financials", type: "sector", label: "Financials" },
      { id: "sector:Homebuilding", type: "sector", label: "Homebuilding" },
      { id: "sector:Real Estate Credit", type: "sector", label: "Real Estate Credit" },
      { id: "sector:Residential Real Estate", type: "sector", label: "Residential Real Estate" },
    ],
    edges: [
      { id: "belongs_to_sector:JPM", source: "holding:JPM", target: "sector:Financials", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:LEN", source: "holding:LEN", target: "sector:Homebuilding", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:MULTIFAMILY_FUND", source: "holding:MULTIFAMILY_FUND", target: "sector:Residential Real Estate", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:PRIVATE_HOMEBUILDER", source: "holding:PRIVATE_HOMEBUILDER", target: "sector:Homebuilding", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:RE_CREDIT_FUND", source: "holding:RE_CREDIT_FUND", target: "sector:Real Estate Credit", type: "belongs_to_sector", label: null, note: null },
      { id: "exposure:10", source: "holding:MULTIFAMILY_FUND", target: "holding:RE_CREDIT_FUND", type: "financing_dependency", label: "financing_dependency", exposure_sector: "Real Estate Credit", note: "Multifamily property values and returns depend partly on the availability and cost of real estate financing provided by credit markets." },
      { id: "exposure:6", source: "holding:LEN", target: "holding:MULTIFAMILY_FUND", type: "housing_cycle", label: "housing_cycle", exposure_sector: "Residential Real Estate", note: "Lennar and the multifamily fund are both exposed to household formation, housing affordability, and residential demand." },
      { id: "exposure:7", source: "holding:PRIVATE_HOMEBUILDER", target: "holding:MULTIFAMILY_FUND", type: "housing_cycle", label: "housing_cycle", exposure_sector: "Residential Real Estate", note: "The private homebuilder and multifamily fund depend on the same regional housing-demand and household-formation trends." },
      { id: "exposure:8", source: "holding:RE_CREDIT_FUND", target: "holding:MULTIFAMILY_FUND", type: "lending", label: "lending", exposure_sector: "Residential Real Estate", note: "The real estate credit fund finances residential properties similar to those owned by the multifamily fund, creating look-through exposure to the same property market." },
      { id: "exposure:9", source: "holding:JPM", target: "holding:RE_CREDIT_FUND", type: "credit_market", label: "credit_market", exposure_sector: "Real Estate Credit", note: "JPMorgan and the private real estate credit fund are both exposed to lending conditions, borrower credit quality, and interest-rate-sensitive real estate financing." },
    ],
  },
  3: {
    portfolio_id: 3,
    portfolio_name: "Energy Transition",
    nodes: [
      { id: "holding:ALB", type: "holding", label: "Albemarle Corporation", ticker: "ALB", sector: "Materials & Mining", weight: 0.25 },
      { id: "holding:CAT", type: "holding", label: "Caterpillar Inc.", ticker: "CAT", sector: "Industrials", weight: 0.1 },
      { id: "holding:ENPH", type: "holding", label: "Enphase Energy, Inc.", ticker: "ENPH", sector: "Energy", weight: 0.1 },
      { id: "holding:F", type: "holding", label: "Ford Motor Company", ticker: "F", sector: "Automotive", weight: 0.1 },
      { id: "holding:GM", type: "holding", label: "General Motors Company", ticker: "GM", sector: "Automotive", weight: 0.15 },
      { id: "holding:TSLA", type: "holding", label: "Tesla, Inc.", ticker: "TSLA", sector: "Automotive", weight: 0.2 },
      { id: "holding:XOM", type: "holding", label: "Exxon Mobil Corporation", ticker: "XOM", sector: "Energy", weight: 0.1 },
      { id: "sector:Automotive", type: "sector", label: "Automotive" },
      { id: "sector:Energy", type: "sector", label: "Energy" },
      { id: "sector:Industrials", type: "sector", label: "Industrials" },
      { id: "sector:Materials & Mining", type: "sector", label: "Materials & Mining" },
    ],
    edges: [
      { id: "belongs_to_sector:ALB", source: "holding:ALB", target: "sector:Materials & Mining", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:CAT", source: "holding:CAT", target: "sector:Industrials", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:ENPH", source: "holding:ENPH", target: "sector:Energy", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:F", source: "holding:F", target: "sector:Automotive", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:GM", source: "holding:GM", target: "sector:Automotive", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:TSLA", source: "holding:TSLA", target: "sector:Automotive", type: "belongs_to_sector", label: null, note: null },
      { id: "belongs_to_sector:XOM", source: "holding:XOM", target: "sector:Energy", type: "belongs_to_sector", label: null, note: null },
      { id: "exposure:11", source: "holding:TSLA", target: "holding:ALB", type: "supply_chain", label: "supply_chain", exposure_sector: "Battery & Critical Minerals", note: "Tesla's battery production depends on lithium supply from producers such as Albemarle." },
      { id: "exposure:12", source: "holding:GM", target: "holding:ALB", type: "supply_chain", label: "supply_chain", exposure_sector: "Battery & Critical Minerals", note: "General Motors' electric-vehicle plans depend on reliable lithium and battery-material supply." },
      { id: "exposure:13", source: "holding:F", target: "holding:ALB", type: "supply_chain", label: "supply_chain", exposure_sector: "Battery & Critical Minerals", note: "Ford's electric-vehicle ramp depends on lithium and battery-material supply from producers such as Albemarle." },
      { id: "exposure:14", source: "holding:ENPH", target: "holding:ALB", type: "supply_chain", label: "supply_chain", exposure_sector: "Battery & Critical Minerals", note: "Enphase's battery storage products depend on lithium-ion cell supply that traces back to critical-mineral producers." },
      { id: "exposure:15", source: "holding:ALB", target: "holding:CAT", type: "supply_chain", label: "supply_chain", exposure_sector: "Industrials", note: "Albemarle's lithium mining and processing operations depend on heavy equipment from suppliers such as Caterpillar." },
    ],
  },
};

export const insights: Record<number, any> = {
  1: {
    portfolio_id: 1,
    portfolio_name: "AI Infrastructure",
    sector: "Digital Infrastructure",
    percentage: 60.0,
    direct_tickers: ["DATA_CENTER_FUND"],
    indirect_tickers: ["NVDA", "PRIVATE_AI_CO"],
    contributing_tickers: ["DATA_CENTER_FUND", "NVDA", "PRIVATE_AI_CO"],
    exposure_edge_ids: [1, 2],
    exposure_notes: [
      "NVIDIA's accelerated-computing growth drives demand for high-density data-center capacity used to train and run AI models.",
      "The private AI software company depends on scalable compute infrastructure, creating indirect exposure to the data centers that host AI workloads.",
    ],
    methodology: "Curated direct and one-hop indirect exposure score based on portfolio weights.",
    narration: null,
  },
  2: {
    portfolio_id: 2,
    portfolio_name: "Housing Ecosystem",
    sector: "Residential Real Estate",
    percentage: 85.0,
    direct_tickers: ["MULTIFAMILY_FUND"],
    indirect_tickers: ["LEN", "PRIVATE_HOMEBUILDER", "RE_CREDIT_FUND"],
    contributing_tickers: ["MULTIFAMILY_FUND", "LEN", "PRIVATE_HOMEBUILDER", "RE_CREDIT_FUND"],
    exposure_edge_ids: [6, 7, 8],
    exposure_notes: [
      "Lennar and the multifamily fund are both exposed to household formation, housing affordability, and residential demand.",
      "The private homebuilder and multifamily fund depend on the same regional housing-demand and household-formation trends.",
      "The real estate credit fund finances residential properties similar to those owned by the multifamily fund, creating look-through exposure to the same property market.",
    ],
    methodology: "Curated direct and one-hop indirect exposure score based on portfolio weights.",
    narration: null,
  },
  3: {
    portfolio_id: 3,
    portfolio_name: "Energy Transition",
    // NOTE: "Battery & Critical Minerals" is a cross-cutting theme, NOT an actual
    // sector node in this portfolio's graph (real sector nodes: Automotive, Energy,
    // Industrials, Materials & Mining). Never try to resolve this to a sector-node
    // id for highlighting — use contributing_tickers instead. See frontend AGENTS.md.
    sector: "Battery & Critical Minerals",
    percentage: 80.0,
    direct_tickers: ["ALB"],
    indirect_tickers: ["TSLA", "GM", "F", "ENPH"],
    contributing_tickers: ["ALB", "TSLA", "GM", "F", "ENPH"],
    exposure_edge_ids: [11, 12, 13, 14],
    exposure_notes: [
      "Tesla's battery production depends on lithium supply from producers such as Albemarle.",
      "General Motors' electric-vehicle plans depend on reliable lithium and battery-material supply.",
      "Ford's electric-vehicle ramp depends on lithium and battery-material supply from producers such as Albemarle.",
      "Enphase's battery storage products depend on lithium-ion cell supply that traces back to critical-mineral producers.",
    ],
    methodology: "Curated direct and one-hop indirect exposure score based on portfolio weights.",
    narration: null,
  },
};

export const audio: Record<number, any> = {
  1: {
    portfolio_id: 1,
    holdings: {
      url: "/static/audio/portfolio_1_holdings.mp3",
      transcript: "AI Infrastructure holds a mix of public equities and fund investments across semiconductors, software, digital infrastructure, utilities, and energy infrastructure. The largest holding is Renewable Infrastructure Fund at 25 percent. NVIDIA Corporation represents 20 percent. Private AI Software Co. also represents 20 percent. Hyperscale Data Center Fund represents 20 percent. NextEra Energy, Inc. represents 15 percent. This is a concentrated portfolio with direct holdings in both operating businesses and infrastructure-focused funds.",
    },
    risk: {
      url: "/static/audio/portfolio_1_risk.mp3",
      transcript: "This portfolio has a mapped exposure score of 60 to digital infrastructure. The direct exposure comes from Hyperscale Data Center Fund. Indirect exposure comes from NVIDIA Corporation and Private AI Software Co. NVIDIA supports demand for high-density data center capacity used for AI training and inference. Private AI Software Co. also depends on scalable compute infrastructure hosted in data centers. These links matter because the portfolio's AI theme is not only tied to software and chips. It also relies on the underlying data center capacity that supports those workloads.",
    },
  },
  2: {
    portfolio_id: 2,
    holdings: {
      url: "/static/audio/portfolio_2_holdings.mp3",
      transcript: "Housing Ecosystem holds a mix of public equity, private investment, real estate fund exposure, and private credit fund exposure. The sectors are homebuilding, residential real estate, real estate credit, and financials. Direct holdings are Lennar Corporation at 20 percent, Sunbelt Residential Partners at 20 percent, Multifamily Housing Fund at 25 percent, Real Estate Credit Fund at 20 percent, and JPMorgan Chase & Co. at 15 percent. This portfolio is centered on housing-related assets, with added exposure to lending and financial services.",
    },
    risk: {
      url: "/static/audio/portfolio_2_risk.mp3",
      transcript: "This portfolio has a mapped exposure score of 85 to residential real estate. Direct exposure comes from Multifamily Housing Fund. Indirect exposure comes from Lennar Corporation, Sunbelt Residential Partners, and Real Estate Credit Fund. These links matter because they can respond to the same housing forces at the same time. Those forces include household formation, housing affordability, residential demand, and regional housing demand. Real Estate Credit Fund also adds look-through exposure because it finances residential properties similar to those owned by Multifamily Housing Fund. JPMorgan Chase & Co. is outside this mapped concentration.",
    },
  },
  3: {
    portfolio_id: 3,
    holdings: {
      url: "/static/audio/portfolio_3_holdings.mp3",
      transcript: "Energy Transition holds direct public equity investments across automotive, industrials, energy, and materials and mining. The largest holding is Albemarle Corporation at 25 percent of the portfolio. Tesla, Inc. represents 20 percent. General Motors Company is 15 percent. Ford Motor Company is 10 percent. Caterpillar Inc. is 10 percent. Exxon Mobil Corporation is 10 percent. Enphase Energy, Inc. is 10 percent. The mix is led by automotive holdings, with added exposure to industrial equipment, traditional energy, solar-related energy technology, and battery materials.",
    },
    risk: {
      url: "/static/audio/portfolio_3_risk.mp3",
      transcript: "This portfolio has a hidden concentration in battery and critical minerals. The mapped exposure score is 80. Direct exposure comes from Albemarle Corporation, which is held directly and sits in that sector. Indirect exposure comes through Tesla, Inc., General Motors Company, Ford Motor Company, and Enphase Energy, Inc. These holdings rely on lithium and related battery materials through their electric-vehicle or battery storage activities. These links matter because several investments can be affected by the same supply chain, even when they sit in different sectors.",
    },
  },
};
