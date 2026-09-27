import { useState } from "react";
import styled from "styled-components";
import { portfolios } from "./mocks/fixtures";
import { PortfolioSelector } from "./components/PortfolioSelector";
import { ModeToggle, type Mode } from "./components/ModeToggle";
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
  flex: 1;
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

function App() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("visual");

  return (
    <>
      <GlobalStyles />
      <Shell>
        <Sidebar>
          <Title>Portfolio Graph</Title>
          <PortfolioSelector
            portfolios={portfolios}
            selectedId={selectedPortfolioId}
            onSelect={setSelectedPortfolioId}
          />
          <ModeToggle mode={mode} onToggle={setMode} />
        </Sidebar>
        <Main>
          {mode === "visual" ? (
            <Placeholder>
              Graph renders here — Portfolio {selectedPortfolioId}
            </Placeholder>
          ) : (
            <Placeholder>Audio mode coming soon</Placeholder>
          )}
        </Main>
      </Shell>
    </>
  );
}

export default App;
