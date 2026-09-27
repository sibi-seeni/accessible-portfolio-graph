import { useEffect, useRef, useState, type RefObject } from "react";
import styled from "styled-components";
import type { AudioClip, PortfolioAudio } from "../hooks/usePortfolioData";
import { useSonification } from "../hooks/useSonification";

export interface AudioNarrationPortfolio {
  id: number;
  name: string;
  audio: PortfolioAudio;
}

interface AudioNarrationBarProps {
  portfolio: AudioNarrationPortfolio;
}

type Clip = "holdings" | "risk";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

const Bar = styled.section`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(26, 32, 53, 0.12);
  box-shadow: 0 8px 24px rgba(26, 32, 53, 0.08);
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const NarrationButton = styled.button<{ $active: boolean }>`
  flex: 1 1 220px;
  min-height: 48px;
  padding: 0 20px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  color: #1a1d2e;
  border-radius: 12px;
  transition: all 0.2s ease;
  background: ${(props) =>
    props.$active ? "rgba(61, 143, 176, 0.22)" : "rgba(255, 255, 255, 0.5)"};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: ${(props) =>
    props.$active
      ? "1px solid rgba(61, 143, 176, 0.45)"
      : "1px solid rgba(26, 32, 53, 0.25)"};
  box-shadow: 0 1px 3px rgba(26, 32, 53, 0.08);

  &:hover {
    border-color: rgba(61, 143, 176, 0.45);
    background: rgba(255, 255, 255, 0.7);
  }
`;

const Transcript = styled.p`
  margin: 0;
  max-height: 54px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.55;
  color: #1a1d2e;
`;

const clipAudio = (ref: RefObject<HTMLAudioElement | null>) => {
  const element = ref.current;
  if (!element) return;
  element.pause();
  element.currentTime = 0;
};

export function AudioNarrationBar({ portfolio }: AudioNarrationBarProps) {
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const holdingsRef = useRef<HTMLAudioElement | null>(null);
  const riskRef = useRef<HTMLAudioElement | null>(null);
  const { playAlertChime } = useSonification();

  useEffect(() => {
    clipAudio(holdingsRef);
    clipAudio(riskRef);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveClip(null);
  }, [portfolio.id]);

  const handlePlay = async (clip: Clip) => {
    const target = clip === "holdings" ? holdingsRef : riskRef;
    const other = clip === "holdings" ? riskRef : holdingsRef;

    clipAudio(other);
    if (clip === "risk") {
      await playAlertChime();
    }
    void target.current?.play().catch(() => {});
    setActiveClip(clip);
  };

  const transcripts: Record<Clip, AudioClip> = {
    holdings: portfolio.audio.holdings,
    risk: portfolio.audio.risk,
  };
  const transcript = activeClip ? transcripts[activeClip].transcript : null;

  return (
    <Bar
      role="region"
      aria-label="Audio-visual narration controls"
    >
      <ButtonRow>
        <NarrationButton
          type="button"
          $active={activeClip === "holdings"}
          aria-pressed={activeClip === "holdings"}
          onClick={() => {
            void handlePlay("holdings");
          }}
        >
          Play Holdings Overview
        </NarrationButton>
        <NarrationButton
          type="button"
          $active={activeClip === "risk"}
          aria-pressed={activeClip === "risk"}
          onClick={() => {
            void handlePlay("risk");
          }}
        >
          Play Risk Narration
        </NarrationButton>
      </ButtonRow>

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
    </Bar>
  );
}
