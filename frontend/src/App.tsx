import { useState } from "react";
import styled from "styled-components";
import { portfolios } from "./mocks/fixtures";
import { PortfolioSelector } from "./components/PortfolioSelector";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { PortfolioGraph } from "./components/PortfolioGraph";
import { ParticleField } from "./components/ParticleField";
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
  height: 100%;
  width: 260px;
  z-index: 10;
  pointer-events: none;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: none;
  border: none;
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

const Placeholder = styled.p`
  color: #1a1d2e;
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
