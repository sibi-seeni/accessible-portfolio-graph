import { useEffect, useState, type FormEvent } from "react";
import styled, { keyframes } from "styled-components";

export interface QueryResult {
  intent: string;
  answer: string;
  audio_url: string;
  warning: string | null;
  highlight_node_ids: string[];
  highlight_edge_ids: string[];
}

interface QueryPanelProps {
  portfolioId: number;
  onResult: (result: QueryResult | null) => void;
}

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

const dotPulse = keyframes`
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  pointer-events: auto;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PanelLabel = styled.div`
  color: #888899;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const InputBar = styled.form`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(26, 32, 53, 0.15);
  border-radius: 26px;
  padding: 6px 6px 6px 18px;
  box-shadow: 0 8px 24px rgba(26, 32, 53, 0.12);
`;

const Input = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1a1d2e;
  font-family: inherit;

  &::placeholder {
    color: #888899;
  }
`;

const SubmitButton = styled.button`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(61, 143, 176, 0.85);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  padding: 0;

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const LoadingDots = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;

const Dot = styled.span<{ $delay: string }>`
  animation: ${dotPulse} 1s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay};
`;

const AnswerCard = styled.div`
  position: relative;
  width: 100%;
  max-height: 280px;
  margin-top: 10px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(26, 32, 53, 0.12);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 8px 24px rgba(26, 32, 53, 0.1);
`;

const WarningBanner = styled.div`
  background: rgba(230, 160, 40, 0.12);
  border-left: 3px solid rgba(230, 160, 40, 0.7);
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 11px;
  color: #7a5a10;
`;

const AnswerText = styled.div`
  font-size: 13px;
  color: #1a1d2e;
  line-height: 1.6;
`;

const AudioPlayer = styled.audio`
  margin-top: 12px;
  width: 100%;
  height: 32px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 16px;
  color: #888899;
  cursor: pointer;
`;

export function QueryPanel({ portfolioId, onResult }: QueryPanelProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(null);
    onResult(null);
    setQuestion("");
  }, [portfolioId, onResult]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/portfolio/${portfolioId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data: QueryResult = await res.json();
      setResult(data);
      onResult(data);
    } catch {
      setResult(null);
      onResult(null);
    } finally {
      setLoading(false);
    }
  };

  const closeResult = () => {
    setResult(null);
    onResult(null);
  };

  return (
    <>
      <Panel>
        <FieldGroup>
          <PanelLabel>Ask a Question</PanelLabel>
          <InputBar onSubmit={handleSubmit}>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this portfolio's risk…"
              aria-label="Ask a question about this portfolio"
            />
            <SubmitButton
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Submit question"
            >
              {loading ? (
                <LoadingDots aria-hidden="true">
                  <Dot $delay="0s">·</Dot>
                  <Dot $delay="0.2s">·</Dot>
                  <Dot $delay="0.4s">·</Dot>
                </LoadingDots>
              ) : (
                "→"
              )}
            </SubmitButton>
          </InputBar>
        </FieldGroup>
        {result && (
          <AnswerCard role="region" aria-label="Answer to your question">
            <CloseButton
              type="button"
              aria-label="Close answer"
              onClick={closeResult}
            >
              ×
            </CloseButton>
            {result.warning !== null && (
              <WarningBanner role="alert">{result.warning}</WarningBanner>
            )}
            <AnswerText>{result.answer}</AnswerText>
            {result.audio_url && (
              <AudioPlayer
                key={result.audio_url}
                src={`${BASE_URL}${result.audio_url}`}
                controls
                autoPlay
              />
            )}
          </AnswerCard>
        )}
      </Panel>
    </>
  );
}
