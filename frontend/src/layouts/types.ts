import type { AudioNarrationPortfolio } from "../components/AudioNarrationBar";
import type { Mode } from "../components/ModeToggle";
import type { QueryResult } from "../components/QueryPanel";
import type {
  Portfolio,
  PortfolioAudio,
  PortfolioGraph,
  PortfolioInsight,
} from "../hooks/usePortfolioData";
import type { LayoutName } from "../styles/theme";

export interface LayoutProps {
  layout: LayoutName;
  onLayoutChange: (layout: LayoutName) => void;
  portfolios: Portfolio[];
  selectedPortfolioId: number;
  onSelectPortfolio: (id: number) => void;
  onPortfolioCreated: (id: number) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  graph: PortfolioGraph;
  insight: PortfolioInsight | null;
  audio: PortfolioAudio | null;
  loading: boolean;
  queryResult: QueryResult | null;
  onQueryResult: (result: QueryResult | null) => void;
  narrationPortfolio: AudioNarrationPortfolio | null;
}
