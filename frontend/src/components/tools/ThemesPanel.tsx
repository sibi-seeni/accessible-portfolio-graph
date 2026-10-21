import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { Theme, ThemesResponse } from "../../api/types";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
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

export function ThemesPanel() {
  const { portfolioId, refreshKey, setHighlight, online } = useExplorer();
  const [maxHops, setMaxHops] = useState(3);
  const [decay, setDecay] = useState(0.5);
  const [data, setData] = useState<ThemesResponse | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    api
      .themes(portfolioId, maxHops, decay)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((exc) => {
        if (!cancelled) setError(exc instanceof ApiError ? exc.message : "Could not load themes.");
      });
    return () => {
      cancelled = true;
    };
  }, [portfolioId, maxHops, decay, refreshKey, online]);

  const show = (theme: Theme) => {
    setActive(theme.sector);
    setHighlight({
      label: theme.sector,
      nodeIds: [
        `sector:${theme.sector}`,
        ...theme.contributions.map((c) => `holding:${c.ticker}`),
      ],
      edgeIds: theme.contributions.flatMap((c) => c.edge_ids),
    });
  };

  return (
    <Stack $gap={12} aria-label="Multi-hop themes">
      <Muted>
        How much of the portfolio leans on each theme once you follow
        relationships several hops deep. The pale bar is the extra exposure that
        one-hop analysis misses.
      </Muted>
      <Row $gap={10}>
        <FieldLabel>
          Depth
          <Select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} hop{n === 1 ? "" : "s"}
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
      {!online && <Muted>Themes need the backend running.</Muted>}
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {online && !data && !error && <Spinner aria-label="Loading themes" />}
      {data && (
        <Stack $gap={8} role="list" aria-label="Themes ranked by exposure">
          {data.themes.slice(0, 10).map((theme) => {
            const gain = theme.percentage - theme.one_hop_percentage;
            return (
              <Card
                key={theme.sector}
                as="button"
                type="button"
                role="listitem"
                $interactive
                $active={active === theme.sector}
                aria-pressed={active === theme.sector}
                onClick={() => show(theme)}
                aria-label={`${theme.sector}: ${theme.percentage.toFixed(1)} percent, ${theme.one_hop_percentage.toFixed(1)} percent at one hop`}
              >
                <Row $gap={8} style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>{theme.sector}</strong>
                  <Row $gap={6}>
                    {gain > 0.05 && <Badge $tone="warning">+{gain.toFixed(1)} hidden</Badge>}
                    <span>{theme.percentage.toFixed(1)}%</span>
                  </Row>
                </Row>
                <Meter $value={theme.one_hop_percentage} $ghost={theme.percentage} />
                <Muted style={{ marginTop: 6 }}>
                  {theme.contributions
                    .map((c) => `${c.name}${c.hops > 1 ? ` (${c.hops} hops)` : ""}`)
                    .join(", ")}
                </Muted>
              </Card>
            );
          })}
          <Muted>{data.methodology}</Muted>
        </Stack>
      )}
    </Stack>
  );
}
