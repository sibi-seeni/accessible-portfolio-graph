import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { Company, Highlight, Meta } from "../api/types";
import type {
  GraphNode,
  PortfolioGraph,
  PortfolioInsight,
} from "../hooks/usePortfolioData";

import type { ToolName } from "./tools";

export type { ToolName } from "./tools";

// Lets one panel open another pre-filled (e.g. "find paths from this node").
export interface ToolPreset {
  nonce: number;
  source?: string;
  target?: string;
  ticker?: string;
  instruction?: string;
}

interface ExplorerState {
  portfolioId: number;
  portfolioName: string;
  graph: PortfolioGraph;
  insight: PortfolioInsight | null;
  online: boolean;
  selectedNode: GraphNode | null;
  selectNode: (node: GraphNode | null) => void;
  highlight: Highlight | null;
  setHighlight: (highlight: Highlight | null) => void;
  depth: number;
  setDepth: (depth: number) => void;
  showProposed: boolean;
  setShowProposed: (show: boolean) => void;
  refresh: () => void;
  refreshKey: number;
  activeTool: ToolName;
  preset: ToolPreset | null;
  openTool: (tool: ToolName, preset?: Omit<ToolPreset, "nonce">) => void;
  meta: Meta | null;
  companies: Company[];
  proposalCount: number;
  reloadProposals: () => void;
}

const Context = createContext<ExplorerState | null>(null);

interface ProviderProps {
  portfolioId: number;
  graph: PortfolioGraph;
  insight: PortfolioInsight | null;
  online: boolean;
  depth: number;
  setDepth: (depth: number) => void;
  showProposed: boolean;
  setShowProposed: (show: boolean) => void;
  refreshKey: number;
  refresh: () => void;
  selectedNode: GraphNode | null;
  selectNode: (node: GraphNode | null) => void;
  children: ReactNode;
}

export function ExplorerProvider({
  portfolioId,
  graph,
  insight,
  online,
  depth,
  setDepth,
  showProposed,
  setShowProposed,
  refreshKey,
  refresh,
  selectedNode,
  selectNode,
  children,
}: ProviderProps) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>("inspect");
  const [preset, setPreset] = useState<ToolPreset | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [proposalsKey, setProposalsKey] = useState(0);

  // Highlights belong to one portfolio's graph.
  const [highlightPortfolio, setHighlightPortfolio] = useState(portfolioId);
  if (highlightPortfolio !== portfolioId) {
    setHighlightPortfolio(portfolioId);
    setHighlight(null);
  }

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    Promise.all([api.meta(), api.companies()])
      .then(([metaData, companyData]) => {
        if (cancelled) return;
        setMeta(metaData);
        setCompanies(companyData);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [online, refreshKey]);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    api
      .proposals()
      .then((data) => {
        if (!cancelled) {
          setProposalCount(data.companies.length + data.exposures.length);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [online, refreshKey, proposalsKey]);

  const openTool = useCallback(
    (tool: ToolName, next?: Omit<ToolPreset, "nonce">) => {
      setActiveTool(tool);
      if (next) setPreset({ ...next, nonce: Date.now() });
    },
    []
  );

  const reloadProposals = useCallback(() => setProposalsKey((k) => k + 1), []);

  // Selecting a node always brings its details into view.
  const selectAndInspect = useCallback(
    (node: GraphNode | null) => {
      selectNode(node);
      if (node) setActiveTool("inspect");
    },
    [selectNode]
  );

  const value = useMemo<ExplorerState>(
    () => ({
      portfolioId,
      portfolioName: graph.portfolio_name,
      graph,
      insight,
      online,
      selectedNode,
      selectNode: selectAndInspect,
      highlight,
      setHighlight,
      depth,
      setDepth,
      showProposed,
      setShowProposed,
      refresh,
      refreshKey,
      activeTool,
      preset,
      openTool,
      meta,
      companies,
      proposalCount,
      reloadProposals,
    }),
    [
      portfolioId,
      graph,
      insight,
      online,
      selectedNode,
      selectAndInspect,
      highlight,
      depth,
      setDepth,
      showProposed,
      setShowProposed,
      refresh,
      refreshKey,
      activeTool,
      preset,
      openTool,
      meta,
      companies,
      proposalCount,
      reloadProposals,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExplorer(): ExplorerState {
  const value = useContext(Context);
  if (!value) throw new Error("useExplorer must be used inside ExplorerProvider");
  return value;
}

// eslint-disable-next-line react-refresh/only-export-components
export function nodeIdFor(ticker: string, graph: PortfolioGraph): string {
  const held = graph.nodes.some((node) => node.id === `holding:${ticker}`);
  return held ? `holding:${ticker}` : `external:${ticker}`;
}
