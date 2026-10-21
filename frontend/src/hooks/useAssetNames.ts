import { useExplorer } from "../state/ExplorerContext";

// Display name for any ticker the graph or company registry knows about.
export function useAssetNames(): (ticker: string) => string {
  const { graph, companies } = useExplorer();
  return (ticker: string) =>
    graph.nodes.find((node) => node.ticker === ticker)?.label ??
    companies.find((company) => company.ticker === ticker)?.company_name ??
    ticker;
}
