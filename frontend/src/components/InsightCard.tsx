import { useState } from "react";
import styled, { keyframes } from "styled-components";
import type {
  PortfolioAudio,
  PortfolioInsight,
} from "../hooks/usePortfolioData";

interface InsightCardProps {
  portfolioId: number;
  insight: PortfolioInsight;
  audio: PortfolioAudio;
}

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.85);
  }
`;

const Card = styled.div`
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 340px;
  max-height: 55vh;
  overflow-y: auto;
  z-index: 20;
  padding: 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(220, 60, 60, 0.25);
  box-shadow: 0 8px 32px rgba(220, 60, 60, 0.1),
    0 2px 8px rgba(26, 32, 53, 0.08);
`;

const Pill = styled.button`
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  cursor: pointer;
  font-family: inherit;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(220, 60, 60, 0.35);
  box-shadow: 0 4px 16px rgba(220, 60, 60, 0.12);
`;

const PillDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(220, 60, 60, 0.8);
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const PillText = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1a1d2e;
`;

const MinimizeButton = styled.button`
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 16px;
  color: #888899;
  cursor: pointer;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const HeaderLeft = styled.div`
  padding-right: 12px;
`;

const RiskLabel = styled.div`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(220, 60, 60, 0.8);
  font-weight: 600;
  margin-bottom: 4px;
`;

const SectorName = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #1a1d2e;
`;

const ScoreBox = styled.div`
  text-align: right;
  flex-shrink: 0;
`;

const Percentage = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: rgba(220, 60, 60, 0.9);
`;

const ScoreLabel = styled.div`
  font-size: 9px;
  color: #888899;
`;

const DividerRed = styled.div`
  height: 1px;
  background: rgba(220, 60, 60, 0.12);
  margin: 14px 0;
`;

const DividerNeutral = styled.div`
  height: 1px;
  background: rgba(26, 32, 53, 0.08);
  margin: 14px 0;
`;

const SectionLabel = styled.div`
  font-size: 10px;
  color: #888899;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
`;

const NoteItem = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const NoteDot = styled.span`
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 6px;
  border-radius: 50%;
  background: rgba(220, 60, 60, 0.7);
`;

const NoteText = styled.div`
  font-size: 12px;
  color: #444455;
  line-height: 1.6;
`;

const AnalysisText = styled.div`
  font-size: 12px;
  color: #1a1d2e;
  line-height: 1.7;
`;

export function InsightCard({
  portfolioId,
  insight,
  audio,
}: InsightCardProps) {
  const [minimized, setMinimized] = useState(false);
  const [activePortfolioId, setActivePortfolioId] = useState(portfolioId);

  if (activePortfolioId !== portfolioId) {
    setActivePortfolioId(portfolioId);
    setMinimized(false);
  }

  const riskTranscript = audio.risk.transcript;

  if (minimized) {
    return (
      <Pill
        type="button"
        role="button"
        tabIndex={0}
        aria-expanded="false"
        aria-label={`Concentration risk ${insight.percentage.toFixed(
          0
        )}% — click to expand`}
        onClick={() => setMinimized(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMinimized(false);
          }
        }}
      >
        <PillDot />
        <PillText>
          Concentration Risk · {insight.percentage.toFixed(0)}%
        </PillText>
      </Pill>
    );
  }

  return (
    <Card
      role="region"
      aria-label="Concentration risk insight"
      aria-live="polite"
    >
      <MinimizeButton
        type="button"
        aria-label="Minimize concentration risk card"
        aria-expanded="true"
        onClick={() => setMinimized(true)}
      >
        −
      </MinimizeButton>
      <Header>
        <HeaderLeft>
          <RiskLabel>Concentration Risk</RiskLabel>
          <SectorName>{insight.sector}</SectorName>
        </HeaderLeft>
        <ScoreBox>
          <Percentage
            aria-label={`${insight.percentage.toFixed(
              0
            )} percent exposure score`}
          >
            {insight.percentage.toFixed(0)}%
          </Percentage>
          <ScoreLabel>exposure score</ScoreLabel>
        </ScoreBox>
      </Header>

      <DividerRed />

      <SectionLabel>Why this matters</SectionLabel>
      {insight.exposure_notes.map((note) => (
        <NoteItem key={note}>
          <NoteDot />
          <NoteText>{note}</NoteText>
        </NoteItem>
      ))}

      <DividerNeutral />

      <SectionLabel>Analysis</SectionLabel>
      <AnalysisText>{riskTranscript}</AnalysisText>
    </Card>
  );
}
