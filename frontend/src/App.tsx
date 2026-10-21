import { useCallback, useMemo, useState } from "react";
import { ThemeProvider } from "styled-components";
import {
  audio as fixtureAudio,
  graphs as fixtureGraphs,
} from "./mocks/fixtures";
import type { Mode } from "./components/ModeToggle";
import type { QueryResult } from "./components/QueryPanel";
import {
  usePortfolioData,
  type GraphNode,
  type PortfolioAudio,
  type PortfolioGraph as PortfolioGraphData,
} from "./hooks/usePortfolioData";
import { CanvasLayout } from "./layouts/CanvasLayout";
import { WorkspaceLayout } from "./layouts/WorkspaceLayout";
import { ExplorerProvider } from "./state/ExplorerContext";
import { GlobalStyles } from "./styles/GlobalStyles";
import { THEMES, type LayoutName } from "./styles/theme";

const LAYOUT_KEY = "xposure.layout";

function readLayout(): LayoutName {
  try {
    const stored = window.localStorage.getItem(LAYOUT_KEY);
    if (stored === "canvas" || stored === "workspace") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return "workspace";
}

function writeLayout(layout: LayoutName): void {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Not persisting the preference is fine.
  }
}

function emptyGraph(id: number, name: string): PortfolioGraphData {
  return { portfolio_id: id, portfolio_name: name, nodes: [], edges: [] };
}

function App() {
  const [layout, setLayout] = useState<LayoutName>(readLayout);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("visual");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [depth, setDepth] = useState(1);
  const [showProposed, setShowProposed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { portfolios, graph, insight, audio, loading, online } = usePortfolioData(
    selectedPortfolioId,
    { depth, includeProposed: showProposed, refreshKey }
  );

  const portfolioName =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId)?.name ?? "";
  const activeGraph =
    graph ??
    (fixtureGraphs[selectedPortfolioId] as PortfolioGraphData | undefined) ??
    emptyGraph(selectedPortfolioId, portfolioName);
  const activeAudio =
    audio ?? (fixtureAudio[selectedPortfolioId] as PortfolioAudio | undefined) ?? null;

  const narrationPortfolio = useMemo(
    () =>
      activeAudio
        ? { id: selectedPortfolioId, name: activeGraph.portfolio_name, audio: activeAudio }
        : null,
    [selectedPortfolioId, activeGraph.portfolio_name, activeAudio]
  );

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const handleSelect = (id: number) => {
    setSelectedNode(null);
    setSelectedPortfolioId(id);
  };

  const handleCreated = (id: number) => {
    refresh();
    handleSelect(id);
  };

  const handleLayout = (next: LayoutName) => {
    setLayout(next);
    writeLayout(next);
  };

  const layoutProps = {
    layout,
    onLayoutChange: handleLayout,
    portfolios,
    selectedPortfolioId,
    onSelectPortfolio: handleSelect,
    onPortfolioCreated: handleCreated,
    mode,
    onModeChange: setMode,
    graph: activeGraph,
    insight,
    audio: activeAudio,
    loading,
    queryResult,
    onQueryResult: setQueryResult,
    narrationPortfolio,
  };

  return (
    <ThemeProvider theme={THEMES[layout]}>
      <GlobalStyles />
      <ExplorerProvider
        portfolioId={selectedPortfolioId}
        graph={activeGraph}
        insight={insight}
        online={online}
        depth={depth}
        setDepth={setDepth}
        showProposed={showProposed}
        setShowProposed={setShowProposed}
        refreshKey={refreshKey}
        refresh={refresh}
        selectedNode={selectedNode}
        selectNode={setSelectedNode}
      >
        {layout === "canvas" ? (
          <CanvasLayout {...layoutProps} />
        ) : (
          <WorkspaceLayout {...layoutProps} />
        )}
      </ExplorerProvider>
    </ThemeProvider>
  );
}

export default App;
