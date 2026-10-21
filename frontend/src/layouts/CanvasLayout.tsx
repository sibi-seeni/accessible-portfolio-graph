import { useState } from "react";
import styled from "styled-components";
import { AudioNarrationBar } from "../components/AudioNarrationBar";
import { GraphStage } from "../components/GraphStage";
import { InsightCard } from "../components/InsightCard";
import { GraphControls, LayoutSwitch } from "../components/LayoutControls";
import { Legend } from "../components/Legend";
import { ModeToggle } from "../components/ModeToggle";
import { NewPortfolio } from "../components/NewPortfolio";
import { ParticleField } from "../components/ParticleField";
import { PortfolioSelector } from "../components/PortfolioSelector";
import { QueryPanel } from "../components/QueryPanel";
import { ToolBody, ToolTabs } from "../components/tools/ToolTabs";
import { Badge, Button } from "../components/ui/primitives";
import { graphs as fixtureGraphs } from "../mocks/fixtures";
import { useExplorer } from "../state/ExplorerContext";
import { TOOL_LABEL } from "../state/tools";
import type { LayoutProps } from "./types";

const Shell = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: ${(p) => p.theme.bg};
`;

const Sidebar = styled.aside`
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 260px;
  z-index: 10;
  padding: 28px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
`;

const TitleRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Title = styled.h1`
  color: ${(p) => p.theme.text};
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  text-shadow: 0 1px 3px rgba(240, 240, 235, 0.8);
`;

const Main = styled.main`
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
`;

const GraphLayer = styled.div<{ $isActive: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: ${(p) => (p.$isActive ? "auto" : "none")};
  transition: opacity 0.7s ease,
    transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.7s ease;
  opacity: ${(p) => (p.$isActive ? 1 : 0.05)};
  transform: ${(p) => (p.$isActive ? "scale(1)" : "scale(0.88)")};
  filter: ${(p) => (p.$isActive ? "none" : "blur(1px) saturate(0.3)")};
  z-index: ${(p) => (p.$isActive ? 2 : 1)};
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

const Dock = styled.div`
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
`;

const Glass = styled.div`
  background: ${(p) => p.theme.surface};
  backdrop-filter: ${(p) => p.theme.surfaceBlur};
  -webkit-backdrop-filter: ${(p) => p.theme.surfaceBlur};
  border: 1px solid ${(p) => p.theme.border};
  box-shadow: ${(p) => p.theme.shadow};
  border-radius: 14px;
`;

const DockBar = styled(Glass)`
  padding: 6px 8px;
`;

const Drawer = styled(Glass)`
  position: absolute;
  top: 18px;
  right: 18px;
  bottom: 18px;
  width: 380px;
  max-width: calc(100vw - 36px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DrawerHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px 16px;
  border-bottom: 1px solid ${(p) => p.theme.border};
  font-weight: 650;
  font-size: 13px;
  color: ${(p) => p.theme.text};
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

export function CanvasLayout(props: LayoutProps) {
  const { activeTool, selectedNode, online, highlight } = useExplorer();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Picking a tool or a node opens the drawer.
  const [lastTool, setLastTool] = useState(activeTool);
  const [lastNode, setLastNode] = useState(selectedNode);
  if (activeTool !== lastTool || selectedNode !== lastNode) {
    setLastTool(activeTool);
    setLastNode(selectedNode);
    if (activeTool !== lastTool || selectedNode) setDrawerOpen(true);
  }

  return (
    <Shell>
      <a
        href="#graph-main"
        style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}
        onFocus={(event) => {
          event.currentTarget.style.left = "16px";
        }}
        onBlur={(event) => {
          event.currentTarget.style.left = "-9999px";
        }}
      >
        Skip to graph
      </a>
      {props.mode === "audio" && props.narrationPortfolio && (
        <AudioNarrationBar portfolio={props.narrationPortfolio} />
      )}
      <Sidebar role="navigation" aria-label="Portfolio controls">
        <TitleRow>
          <Title>Xposure</Title>
          <LayoutSwitch layout={props.layout} onChange={props.onLayoutChange} />
        </TitleRow>
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
      </Sidebar>
      <Main id="graph-main" role="main" aria-label="Portfolio graph visualization">
        <ParticleField />
        {props.portfolios.map((portfolio) => {
          const isActive = portfolio.id === props.selectedPortfolioId;
          // Inactive layers show the bundled demo graph as a ghost, when there is one.
          if (!isActive && !fixtureGraphs[portfolio.id]) return null;
          return (
            <GraphLayer key={portfolio.id} $isActive={isActive}>
              <GraphStage
                portfolioId={portfolio.id}
                active={isActive}
                graphData={isActive ? props.graph : undefined}
                contributingTickers={props.insight?.contributing_tickers ?? []}
                queryResult={props.queryResult}
                isAudioVisualMode={props.mode === "audio"}
              />
            </GraphLayer>
          );
        })}
        <Vignette />
        <Dock>
          <DockBar>
            <ToolTabs onSelect={() => setDrawerOpen(true)} />
          </DockBar>
          <DockBar>
            <GraphControls />
          </DockBar>
          {!online && <Badge $tone="warning">offline · demo data</Badge>}
        </Dock>
        {drawerOpen ? (
          <Drawer role="complementary" aria-label={`${TOOL_LABEL[activeTool]} tool`}>
            <DrawerHead>
              <span>
                {TOOL_LABEL[activeTool]}
                {highlight && (
                  <Badge style={{ marginLeft: 8 }}>{highlight.label}</Badge>
                )}
              </span>
              <Button
                type="button"
                $variant="ghost"
                $small
                onClick={() => setDrawerOpen(false)}
                aria-label="Close tool panel"
              >
                ✕
              </Button>
            </DrawerHead>
            <DrawerBody>
              <ToolBody />
            </DrawerBody>
          </Drawer>
        ) : (
          props.insight &&
          props.audio && (
            <InsightCard
              portfolioId={props.selectedPortfolioId}
              insight={props.insight}
              audio={props.audio}
            />
          )
        )}
        {props.loading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 13,
              color: "#888899",
              zIndex: 30,
            }}
          >
            Loading portfolio data…
          </div>
        )}
      </Main>
    </Shell>
  );
}
