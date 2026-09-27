import { useState } from "react";
import styled from "styled-components";
import { portfolios } from "./mocks/fixtures";
import { PortfolioSelector } from "./components/PortfolioSelector";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { PortfolioGraph } from "./components/PortfolioGraph";
import { ParticleField } from "./components/ParticleField";
import { GlobalStyles } from "./styles/GlobalStyles";

const Shell = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0f1117;
`;

const Sidebar = styled.aside`
  width: 260px;
  flex-shrink: 0;
  height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #14171f;
  overflow-y: auto;
`;

const Title = styled.h1`
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
`;

const Main = styled.main`
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const Placeholder = styled.p`
  color: #ffffff;
  font-size: 16px;
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
  opacity: ${(props) => (props.$isActive ? 1 : 0.09)};
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
    transparent 50%,
    rgba(15, 17, 23, 0.75) 100%
  );
`;

function App() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("visual");

  const handleSelect = (id: number) => setSelectedPortfolioId(id);

  return (
    <>
      <GlobalStyles />
      <Shell>
        <Sidebar>
          <Title>Portfolio Graph</Title>
          <PortfolioSelector
            portfolios={portfolios}
            selectedId={selectedPortfolioId}
            onSelect={handleSelect}
          />
          <ModeToggle mode={mode} onToggle={setMode} />
        </Sidebar>
        <Main>
          {mode === "visual" ? (
            <>
              <ParticleField />
              {portfolios.map((portfolio) => {
                const isActive = portfolio.id === selectedPortfolioId;
                return (
                  <GraphLayer key={portfolio.id} $isActive={isActive}>
                    <PortfolioGraph portfolioId={portfolio.id} />
                  </GraphLayer>
                );
              })}
              <Vignette />
            </>
          ) : (
            <Placeholder>Audio mode coming soon</Placeholder>
          )}
        </Main>
      </Shell>
    </>
  );
}

export default App;
