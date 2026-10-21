import { useEffect, useState, type FormEvent } from "react";
import styled from "styled-components";
import { api, ApiError } from "../../api/client";
import type { ShockResponse } from "../../api/types";
import { nodeIdFor, useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Meter,
  Muted,
  Row,
  Select,
  Spinner,
  Stack,
} from "../ui/primitives";
import { AssetSelect } from "./AssetSelect";
import { useAssetNames } from "../../hooks/useAssetNames";

const Big = styled.div`
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: ${(p) => p.theme.danger};
`;

export function ShockPanel() {
  const { portfolioId, graph, preset, setHighlight, online } = useExplorer();
  const nameOf = useAssetNames();
  const [ticker, setTicker] = useState("");
  const [maxHops, setMaxHops] = useState(3);
  const [decay, setDecay] = useState(0.5);
  const [result, setResult] = useState<ShockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  if (preset && preset.nonce !== appliedNonce && preset.ticker) {
    setAppliedNonce(preset.nonce);
    setTicker(preset.ticker);
    setResult(null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(null);
  }, [portfolioId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.shock(portfolioId, ticker, maxHops, decay);
      setResult(data);
      setHighlight({
        label: `Shock: ${data.name}`,
        nodeIds: [
          nodeIdFor(data.ticker, graph),
          ...data.hits.flatMap((hit) => hit.path.node_ids),
        ],
        edgeIds: data.hits.flatMap((hit) => hit.path.edge_ids),
      });
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not run the scenario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack as="form" onSubmit={submit} $gap={12} aria-label="Shock scenario">
      <Muted>
        Stress one asset and see which holdings sit within reach of it, and
        how much of the portfolio that is. Distance is discounted per hop.
      </Muted>
      <AssetSelect label="Stressed asset" value={ticker} onChange={setTicker} />
      <Row $gap={10}>
        <FieldLabel>
          Reach (hops)
          <Select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel>
          Discount per hop
          <Select value={decay} onChange={(e) => setDecay(Number(e.target.value))}>
            {[1, 0.75, 0.5, 0.25].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "None (×1)" : `×${n}`}
              </option>
            ))}
          </Select>
        </FieldLabel>
      </Row>
      <Button type="submit" disabled={!online || loading || !ticker}>
        {loading ? <Spinner /> : "Run scenario"}
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {result && (
        <Stack $gap={10} aria-live="polite">
          <div>
            <Big>{result.portfolio_impact_percentage.toFixed(1)}%</Big>
            <Muted>
              of {graph.portfolio_name} is connected to {result.name} within{" "}
              {result.max_hops} hop{result.max_hops === 1 ? "" : "s"}.
            </Muted>
          </div>
          {result.hits.length === 0 && (
            <Muted>No holdings are connected to this asset within that reach.</Muted>
          )}
          {result.hits.map((hit) => (
            <Card key={hit.ticker}>
              <Row $gap={8} style={{ justifyContent: "space-between" }}>
                <strong>{hit.name}</strong>
                <Badge $tone={hit.hops === 0 ? "danger" : "warning"}>
                  {hit.hops === 0 ? "held directly" : `${hit.hops} hop${hit.hops === 1 ? "" : "s"}`}
                </Badge>
              </Row>
              <Muted style={{ margin: "4px 0 6px" }}>
                {(hit.weight * 100).toFixed(1)}% weight × {hit.impact.toFixed(2)} ={" "}
                {(hit.weight * hit.impact * 100).toFixed(1)}%
                {hit.path.hops > 0 && ` · via ${hit.path.tickers.slice(1, -1).map(nameOf).join(", ") || "a direct link"}`}
              </Muted>
              <Meter $value={hit.weight * hit.impact * 100} $ghost={hit.weight * 100} />
            </Card>
          ))}
          <Muted>{result.methodology}</Muted>
        </Stack>
      )}
    </Stack>
  );
}
