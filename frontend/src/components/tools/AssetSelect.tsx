import { useMemo } from "react";
import { useExplorer } from "../../state/ExplorerContext";
import { FieldLabel, Select } from "../ui/primitives";

interface AssetSelectProps {
  label: string;
  value: string;
  onChange: (ticker: string) => void;
  placeholder?: string;
}

// Holdings of the current portfolio first, then every other known company.
export function AssetSelect({ label, value, onChange, placeholder }: AssetSelectProps) {
  const { graph, companies } = useExplorer();

  const { held, others } = useMemo(() => {
    const heldNodes = graph.nodes
      .filter((node) => node.type === "holding" && node.ticker)
      .map((node) => ({ ticker: node.ticker as string, name: node.label }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const heldSet = new Set(heldNodes.map((node) => node.ticker));
    const rest = new Map<string, string>();
    for (const company of companies) {
      if (!heldSet.has(company.ticker)) rest.set(company.ticker, company.company_name);
    }
    for (const node of graph.nodes) {
      if (node.type === "exposure" && node.ticker && !heldSet.has(node.ticker)) {
        rest.set(node.ticker, rest.get(node.ticker) ?? node.label);
      }
    }
    return {
      held: heldNodes,
      others: [...rest.entries()]
        .map(([ticker, name]) => ({ ticker, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [graph, companies]);

  return (
    <FieldLabel>
      {label}
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder ?? "Choose an asset…"}</option>
        <optgroup label="In this portfolio">
          {held.map((asset) => (
            <option key={asset.ticker} value={asset.ticker}>
              {asset.name} ({asset.ticker})
            </option>
          ))}
        </optgroup>
        {others.length > 0 && (
          <optgroup label="Other companies in the graph">
            {others.map((asset) => (
              <option key={asset.ticker} value={asset.ticker}>
                {asset.name} ({asset.ticker})
              </option>
            ))}
          </optgroup>
        )}
      </Select>
    </FieldLabel>
  );
}
