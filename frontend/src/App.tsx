import { useMemo, useState } from "react";
import styled from "styled-components";
import {
  audio as fixtureAudio,
  graphs as fixtureGraphs,
} from "./mocks/fixtures";
import { PortfolioSelector } from "./components/PortfolioSelector";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { PortfolioGraph, type HoldingNode } from "./components/PortfolioGraph";
import { HoldingDetailPanel } from "./components/HoldingDetailPanel";
import { InsightCard } from "./components/InsightCard";
import { QueryPanel, type QueryResult } from "./components/QueryPanel";
import { Legend } from "./components/Legend";
import { AudioNarrationBar } from "./components/AudioNarrationBar";
import { ParticleField } from "./components/ParticleField";
import {
  usePortfolioData,
  type PortfolioAudio,
  type PortfolioGraph as PortfolioGraphData,
} from "./hooks/usePortfolioData";
import { GlobalStyles } from "./styles/GlobalStyles";

const Shell = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
`;

const Sidebar = styled.aside`
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 260px;
  z-index: 10;
  pointer-events: auto;
  padding: 28px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  background: none;
  border: none;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(26, 32, 53, 0.15);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(26, 32, 53, 0.25);
  }
`;

const Title = styled.h1`
  color: #1a1d2e;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  text-shadow: 0 1px 3px rgba(240, 240, 235, 0.8);
  pointer-events: auto;
`;

const Main = styled.main`
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const LoadingText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  color: #888899;
  z-index: 30;
`;

const GraphLayer = styled.div<{ $isActive: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: ${(props) => (props.$isActive ? "auto" : "none")};
  transition: opacity 0.7s ease,
    transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.7s ease;
  opacity: ${(props) => (props.$isActive ? 1 : 0.05)};
  transform: ${(props) => (props.$isActive ? "scale(1)" : "scale(0.88)")};
  filter: ${(props) => (props.$isActive ? "none" : "blur(1px) saturate(0.3)")};
  z-index: ${(props) => (props.$isActive ? 2 : 1)};
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 70%,
    rgba(200, 200, 195, 0.35) 100%
  );
`;

function App() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("visual");
  const [selectedNode, setSelectedNode] = useState<HoldingNode | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const { portfolios, graph, insight, audio, loading } =
    usePortfolioData(selectedPortfolioId);

  const activeGraph =
    graph ?? (fixtureGraphs[selectedPortfolioId] as PortfolioGraphData);
  const activeAudio =
    audio ?? (fixtureAudio[selectedPortfolioId] as PortfolioAudio);
  const currentPortfolio = useMemo(
    () => ({
      id: selectedPortfolioId,
      name: activeGraph.portfolio_name,
      holdings: activeGraph.nodes.filter((node) => node.type === "holding"),
      sectors: activeGraph.nodes.filter((node) => node.type === "sector"),
      audio: activeAudio,
    }),
    [selectedPortfolioId, activeGraph, activeAudio]
  );
  const contributingTickers = insight?.contributing_tickers ?? [];
  const queryHighlightNodeIds = queryResult?.highlight_node_ids ?? [];
  const queryHighlightEdgeIds = queryResult?.highlight_edge_ids ?? [];

  const handleSelect = (id: number) => {
    setSelectedNode(null);
    setSelectedPortfolioId(id);
  };

  return (
    <>
      <GlobalStyles />
      <Shell>
        <a
          href="#graph-main"
          style={{
            position: "absolute",
            left: "-9999px",
            top: "auto",
            width: "1px",
            height: "1px",
            overflow: "hidden",
          }}
          onFocus={(event) => {
            event.currentTarget.style.left = "16px";
          }}
          onBlur={(event) => {
            event.currentTarget.style.left = "-9999px";
          }}
        >
          Skip to graph
        </a>
        {mode === "audio" && (
          <AudioNarrationBar portfolio={currentPortfolio} />
        )}
        <Sidebar role="navigation" aria-label="Portfolio controls">
          <Title>Xposure</Title>
          <PortfolioSelector
            portfolios={portfolios}
            selectedId={selectedPortfolioId}
            onSelect={handleSelect}
          />
          <ModeToggle mode={mode} onToggle={setMode} />
          <QueryPanel
            portfolioId={selectedPortfolioId}
            onResult={setQueryResult}
          />
          <Legend />
        </Sidebar>
        <Main
          id="graph-main"
          role="main"
          aria-label="Portfolio graph visualization"
        >
          <ParticleField />
          {portfolios.map((portfolio) => {
            const isActive = portfolio.id === selectedPortfolioId;
            return (
              <GraphLayer key={portfolio.id} $isActive={isActive}>
                <PortfolioGraph
                  portfolioId={portfolio.id}
                  graphData={isActive ? activeGraph : undefined}
                  onNodeClick={setSelectedNode}
                  selectedNodeId={selectedNode?.id ?? null}
                  contributingTickers={contributingTickers}
                  queryHighlightNodeIds={queryHighlightNodeIds}
                  queryHighlightEdgeIds={queryHighlightEdgeIds}
                  isAudioVisualMode={mode === "audio"}
                />
              </GraphLayer>
            );
          })}
          <Vignette />
          {selectedNode && (
            <HoldingDetailPanel
              node={selectedNode}
              graph={activeGraph}
              onClose={() => setSelectedNode(null)}
            />
          )}
          {insight && audio && (
            <InsightCard
              portfolioId={selectedPortfolioId}
              insight={insight}
              audio={audio}
            />
          )}
          {loading && <LoadingText>Loading portfolio data…</LoadingText>}
        </Main>
      </Shell>
    </>
  );
}

export default App;
