import { useEffect, useRef, useState, type RefObject } from "react";
import styled from "styled-components";
import type {
  AudioClip,
  GraphNode,
  PortfolioAudio,
} from "../hooks/usePortfolioData";

export interface AudioFirstPortfolio {
  id: number;
  name: string;
  holdings: GraphNode[];
  sectors: GraphNode[];
  audio: PortfolioAudio;
}

interface AudioFirstModeProps {
  portfolio: AudioFirstPortfolio;
}

type Clip = "holdings" | "risk";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  width: 100%;
  max-width: 480px;
  padding: 32px;
  max-height: 100vh;
  overflow-y: auto;
`;

const TitleWrap = styled.div`
  text-align: center;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #1a1d2e;
  letter-spacing: -0.3px;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PlayButton = styled.button<{ $active: boolean }>`
  width: 100%;
  min-height: 56px;
  padding: 0 24px;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: #1a1d2e;
  border-radius: 12px;
  transition: all 0.2s ease;
  background: ${(props) =>
    props.$active ? "rgba(61, 143, 176, 0.22)" : "rgba(255, 255, 255, 0.6)"};
  border: ${(props) =>
    props.$active
      ? "1px solid rgba(61, 143, 176, 0.45)"
      : "1px solid rgba(26, 32, 53, 0.15)"};

  &:hover {
    border-color: rgba(61, 143, 176, 0.45);
    background: rgba(255, 255, 255, 0.85);
  }
`;

const Transcript = styled.p`
  font-size: 14px;
  line-height: 1.7;
  color: #1a1d2e;
`;

const clipAudio = (ref: RefObject<HTMLAudioElement | null>) => {
  const element = ref.current;
  if (!element) return;
  element.pause();
  element.currentTime = 0;
};

export function AudioFirstMode({ portfolio }: AudioFirstModeProps) {
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const holdingsRef = useRef<HTMLAudioElement | null>(null);
  const riskRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    clipAudio(holdingsRef);
    clipAudio(riskRef);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveClip(null);
  }, [portfolio.id]);

  const handlePlay = (clip: Clip) => {
    const target = clip === "holdings" ? holdingsRef : riskRef;
    const other = clip === "holdings" ? riskRef : holdingsRef;

    clipAudio(other);
    void target.current?.play().catch(() => {});
    setActiveClip(clip);
  };

  const transcripts: Record<Clip, AudioClip> = {
    holdings: portfolio.audio.holdings,
    risk: portfolio.audio.risk,
  };
  const transcript = activeClip ? transcripts[activeClip].transcript : null;

  return (
    <Column>
      <TitleWrap aria-live="polite">
        <Title>{portfolio.name}</Title>
      </TitleWrap>

      <ButtonGroup>
        <PlayButton
          type="button"
          $active={activeClip === "holdings"}
          aria-pressed={activeClip === "holdings"}
          onClick={() => handlePlay("holdings")}
        >
          Play Holdings Overview
        </PlayButton>
        <PlayButton
          type="button"
          $active={activeClip === "risk"}
          aria-pressed={activeClip === "risk"}
          onClick={() => handlePlay("risk")}
        >
          Play Risk Narration
        </PlayButton>
      </ButtonGroup>

      <Transcript aria-live="polite">
        {transcript ?? "Select a clip to hear the portfolio breakdown."}
      </Transcript>

      <audio
        ref={holdingsRef}
        src={`${BASE_URL}${portfolio.audio.holdings.url}`}
        preload="none"
      />
      <audio
        ref={riskRef}
        src={`${BASE_URL}${portfolio.audio.risk.url}`}
        preload="none"
      />
    </Column>
  );
}
