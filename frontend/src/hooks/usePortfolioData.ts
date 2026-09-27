import { useEffect, useState } from "react";
import {
  audio as fixtureAudio,
  graphs as fixtureGraphs,
  insights as fixtureInsights,
  portfolios as fixturePortfolios,
} from "../mocks/fixtures";

export interface Portfolio {
  id: number;
  name: string;
}

export interface GraphNode {
  id: string;
  type: "holding" | "sector";
  label: string;
  ticker?: string;
  sector?: string;
  weight?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
  exposure_sector?: string;
  note: string | null;
}

export interface PortfolioGraph {
  portfolio_id: number;
  portfolio_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PortfolioInsight {
  portfolio_id: number;
  portfolio_name: string;
  sector: string;
  percentage: number;
  direct_tickers: string[];
  indirect_tickers: string[];
  contributing_tickers: string[];
  exposure_edge_ids: number[];
  exposure_notes: string[];
  methodology: string;
  narration: string | null;
}

export interface AudioClip {
  url: string;
  transcript: string;
}

export interface PortfolioAudio {
  portfolio_id: number;
  holdings: AudioClip;
  risk: AudioClip;
}

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export function usePortfolioData(portfolioId: number) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [graph, setGraph] = useState<PortfolioGraph | null>(null);
  const [insight, setInsight] = useState<PortfolioInsight | null>(null);
  const [audio, setAudio] = useState<PortfolioAudio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolios = async () => {
      try {
        const response = await fetch(`${BASE_URL}/portfolios`);
        const data = (await response.json()) as Portfolio[];
        if (!cancelled) setPortfolios(data);
      } catch {
        if (!cancelled) setPortfolios(fixturePortfolios);
      }
    };

    loadPortfolios();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      setLoading(true);
      try {
        const [graphResponse, insightResponse, audioResponse] =
          await Promise.all([
            fetch(`${BASE_URL}/portfolio/${portfolioId}/graph`),
            fetch(`${BASE_URL}/portfolio/${portfolioId}/insight`),
            fetch(`${BASE_URL}/portfolio/${portfolioId}/audio`),
          ]);

        const [graphData, insightData, audioData] = await Promise.all([
          graphResponse.json() as Promise<PortfolioGraph>,
          insightResponse.json() as Promise<PortfolioInsight>,
          audioResponse.json() as Promise<PortfolioAudio>,
        ]);

        if (cancelled) return;
        setGraph(graphData);
        setInsight(insightData);
        setAudio(audioData);
        setError(null);
      } catch {
        if (cancelled) return;
        setPortfolios(fixturePortfolios);
        setGraph(fixtureGraphs[portfolioId] as PortfolioGraph);
        setInsight(fixtureInsights[portfolioId] as PortfolioInsight);
        setAudio(fixtureAudio[portfolioId] as PortfolioAudio);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPortfolio();
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  return { portfolios, graph, insight, audio, loading, error };
}
