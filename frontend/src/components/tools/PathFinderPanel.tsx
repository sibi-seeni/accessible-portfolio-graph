import { useEffect, useState, type FormEvent } from "react";
import styled from "styled-components";
import { api, ApiError } from "../../api/client";
import type { GraphPath } from "../../api/types";
import { VIA_LABEL } from "../../config/visualConfig";
import { useAssetNames } from "../../hooks/useAssetNames";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
  Button,
  Card,
  CheckLabel,
  ErrorText,
  FieldLabel,
  Muted,
  Row,
  Select,
  Spinner,
  Stack,
} from "../ui/primitives";
import { AssetSelect } from "./AssetSelect";

const Route = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
  overflow-wrap: anywhere;
`;

const Step = styled.div`
  color: ${(p) => p.theme.textMuted};
  font-size: 11.5px;
  line-height: 1.5;
`;

export function PathFinderPanel() {
  const { portfolioId, preset, setHighlight, showProposed, online } = useExplorer();
  const nameOf = useAssetNames();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [maxHops, setMaxHops] = useState(3);
  const [includeProposed, setIncludeProposed] = useState(showProposed);
  const [paths, setPaths] = useState<GraphPath[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  if (preset && preset.nonce !== appliedNonce && (preset.source || preset.target)) {
    setAppliedNonce(preset.nonce);
    if (preset.source) setSource(preset.source);
    if (preset.target) setTarget(preset.target);
    setPaths(null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaths(null);
  }, [portfolioId]);

  const show = (path: GraphPath, index: number) => {
    setActive(index);
    setHighlight({
      label: `${path.hops}-hop route`,
      nodeIds: path.node_ids,
      edgeIds: path.edge_ids,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!source || !target) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.paths(portfolioId, source, target, maxHops, includeProposed);
      setPaths(result.paths);
      if (result.paths[0]) show(result.paths[0], 0);
      else setHighlight(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not find paths.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack as="form" onSubmit={submit} $gap={12} aria-label="Path finder">
      <Muted>
        Trace every route between two assets through curated relationships,
        including ones that run through companies you don't hold.
      </Muted>
      <AssetSelect label="From" value={source} onChange={setSource} />
      <AssetSelect label="To" value={target} onChange={setTarget} />
      <Row $gap={10}>
        <FieldLabel>
          Max hops
          <Select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <CheckLabel style={{ flex: 1, marginTop: 18 }}>
          <input
            type="checkbox"
            checked={includeProposed}
            onChange={(e) => setIncludeProposed(e.target.checked)}
          />
          Include proposals
        </CheckLabel>
      </Row>
      <Button type="submit" disabled={!online || loading || !source || !target || source === target}>
        {loading ? <Spinner /> : "Find paths"}
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {paths && (
        <Stack $gap={8} role="list" aria-label="Paths found" aria-live="polite">
          {paths.length === 0 ? (
            <Muted>
              No route within {maxHops} hops. Try more hops, or ask the agent to
              look for missing links.
            </Muted>
          ) : (
            paths.map((path, index) => (
              <Card
                key={path.edge_ids.join("-")}
                as="button"
                type="button"
                role="listitem"
                $interactive
                $active={index === active}
                onClick={() => show(path, index)}
                aria-pressed={index === active}
              >
                <Row $gap={6} style={{ marginBottom: 6 }}>
                  <Badge>{path.hops} hop{path.hops === 1 ? "" : "s"}</Badge>
                </Row>
                <Route>{path.tickers.map(nameOf).join(" → ")}</Route>
                {path.steps.map((step) => (
                  <Step key={step.edge_id}>
                    {nameOf(step.from_ticker)} {step.forward ? "→" : "←"}{" "}
                    {nameOf(step.to_ticker)} · {VIA_LABEL[step.via] ?? step.via} ·{" "}
                    {step.exposure_sector}
                  </Step>
                ))}
              </Card>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}
