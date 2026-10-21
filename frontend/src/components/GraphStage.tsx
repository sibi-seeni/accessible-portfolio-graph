import type { PortfolioGraph as PortfolioGraphData } from "../hooks/usePortfolioData";
import { useExplorer } from "../state/ExplorerContext";
import { PortfolioGraph } from "./PortfolioGraph";
import type { QueryResult } from "./QueryPanel";

interface GraphStageProps {
  portfolioId: number;
  active: boolean;
  graphData?: PortfolioGraphData;
  contributingTickers: string[];
  queryResult: QueryResult | null;
  isAudioVisualMode: boolean;
}

// The graph wired to explorer state: tool highlights win over question
// highlights, and only tool highlights dim the rest of the graph.
export function GraphStage({
  portfolioId,
  active,
  graphData,
  contributingTickers,
  queryResult,
  isAudioVisualMode,
}: GraphStageProps) {
  const { highlight, selectedNode, selectNode } = useExplorer();
  const toolHighlight = active ? highlight : null;

  return (
    <PortfolioGraph
      portfolioId={portfolioId}
      graphData={graphData}
      onNodeClick={selectNode}
      selectedNodeId={active ? selectedNode?.id ?? null : null}
      contributingTickers={toolHighlight ? [] : contributingTickers}
      queryHighlightNodeIds={toolHighlight?.nodeIds ?? queryResult?.highlight_node_ids ?? []}
      queryHighlightEdgeIds={toolHighlight?.edgeIds ?? queryResult?.highlight_edge_ids ?? []}
      isAudioVisualMode={isAudioVisualMode}
      dimOthers={Boolean(toolHighlight)}
    />
  );
}
