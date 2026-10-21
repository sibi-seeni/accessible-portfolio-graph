import styled from "styled-components";
import { AudioNarrationBar } from "../components/AudioNarrationBar";
import { GraphStage } from "../components/GraphStage";
import { GraphControls, LayoutSwitch } from "../components/LayoutControls";
import { Legend } from "../components/Legend";
import { ModeToggle } from "../components/ModeToggle";
import { NewPortfolio } from "../components/NewPortfolio";
import { PortfolioSelector } from "../components/PortfolioSelector";
import { QueryPanel } from "../components/QueryPanel";
import { ToolBody, ToolTabs } from "../components/tools/ToolTabs";
import { Badge } from "../components/ui/primitives";
import { useExplorer } from "../state/ExplorerContext";
import type { LayoutProps } from "./types";

const Shell = styled.div<{ $offset: boolean }>`
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 390px;
  grid-template-rows: 52px minmax(0, 1fr);
  grid-template-areas:
    "top top top"
    "rail stage inspector";
  height: 100vh;
  /* Room for the fixed audio narration bar in audio mode. */
  padding-top: ${(p) => (p.$offset ? "104px" : "0")};
  background: ${(p) => p.theme.bg};
  color: ${(p) => p.theme.text};

  @media (max-width: 1100px) {
    grid-template-columns: 230px minmax(0, 1fr) 340px;
  }

  @media (max-width: 860px) {
    height: auto;
    min-height: 100vh;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto 65vh auto;
    grid-template-areas:
      "top"
      "rail"
      "stage"
      "inspector";
  }
`;

const Top = styled.header`
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.surface};
  min-width: 0;

  @media (max-width: 860px) {
    flex-wrap: wrap;
    padding: 10px 16px;
  }
`;

const Brand = styled.h1`
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -0.2px;
  margin-right: 8px;
`;

const Spacer = styled.div`
  flex: 1;
`;

const Rail = styled.nav`
  grid-area: rail;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 18px 16px 24px;
  overflow-y: auto;
  border-right: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.surface};
`;

const Stage = styled.main`
  grid-area: stage;
  position: relative;
  min-width: 0;
  overflow: hidden;
  background-color: ${(p) => p.theme.bg};
  background-image: radial-gradient(${(p) => p.theme.border} 1px, transparent 1px);
  background-size: 22px 22px;
`;

const StageCaption = styled.div`
  position: absolute;
  left: 14px;
  bottom: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  pointer-events: none;
`;

const Inspector = styled.aside`
  grid-area: inspector;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.surface};

  @media (max-width: 860px) {
    border-left: none;
    border-top: 1px solid ${(p) => p.theme.border};
  }
`;

const InspectorTabs = styled.div`
  padding: 8px 10px;
  border-bottom: 1px solid ${(p) => p.theme.border};
`;

const InspectorBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const Loading = styled.div`
  position: absolute;
  top: 14px;
  left: 14px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
`;

export function WorkspaceLayout(props: LayoutProps) {
  const { online, highlight } = useExplorer();
  const holdings = props.graph.nodes.filter((n) => n.type === "holding").length;
  const linked = props.graph.nodes.filter((n) => n.type === "exposure").length;

  return (
    <>
      {props.mode === "audio" && props.narrationPortfolio && (
        <AudioNarrationBar portfolio={props.narrationPortfolio} />
      )}
      <Shell $offset={props.mode === "audio"}>
        <Top>
          <Brand>Xposure</Brand>
          <GraphControls />
          <Spacer />
          {!online && <Badge $tone="warning">offline · demo data</Badge>}
          <LayoutSwitch layout={props.layout} onChange={props.onLayoutChange} />
        </Top>
        <Rail aria-label="Portfolio controls">
          <div>
            <PortfolioSelector
              portfolios={props.portfolios}
              selectedId={props.selectedPortfolioId}
              onSelect={props.onSelectPortfolio}
            />
            <div style={{ marginTop: 10 }}>
              <NewPortfolio onCreated={props.onPortfolioCreated} disabled={!online} />
            </div>
          </div>
          <ModeToggle mode={props.mode} onToggle={props.onModeChange} />
          <QueryPanel portfolioId={props.selectedPortfolioId} onResult={props.onQueryResult} />
          <Legend />
        </Rail>
        <Stage id="graph-main" aria-label="Portfolio graph visualization">
          <GraphStage
            portfolioId={props.selectedPortfolioId}
            active
            graphData={props.graph}
            contributingTickers={props.insight?.contributing_tickers ?? []}
            queryResult={props.queryResult}
            isAudioVisualMode={props.mode === "audio"}
          />
          {props.loading && <Loading>Loading…</Loading>}
          <StageCaption>
            {holdings} holdings{linked > 0 && ` · ${linked} linked assets`}
            {highlight && <Badge>{highlight.label}</Badge>}
          </StageCaption>
        </Stage>
        <Inspector aria-label="Inspector">
          <InspectorTabs>
            <ToolTabs />
          </InspectorTabs>
          <InspectorBody>
            <ToolBody />
          </InspectorBody>
        </Inspector>
      </Shell>
    </>
  );
}
