import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styled from "styled-components";
import { api, ApiError } from "../../api/client";
import {
  ASSET_CLASS_LABEL,
  GROUP_COLOR,
  VIA_LABEL,
  VIA_TO_GROUP,
  assetClassOf,
  sectorColor,
} from "../../config/visualConfig";
import { useAssetNames } from "../../hooks/useAssetNames";
import type { GraphNode } from "../../hooks/usePortfolioData";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorText,
  Heading,
  Input,
  Muted,
  Row,
  SectionLabel,
  Stack,
} from "../ui/primitives";

const Dot = styled.span<{ $color: string }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  flex-shrink: 0;
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  font-size: 12.5px;

  dt {
    color: ${(p) => p.theme.textMuted};
  }

  dd {
    margin: 0;
    color: ${(p) => p.theme.text};
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

const LinkCard = styled(Card)<{ $accent: string }>`
  border-left: 3px solid ${(p) => p.$accent};
`;

const HoldingRow = styled.li`
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid ${(p) => p.theme.border};
  font-size: 12.5px;
  color: ${(p) => p.theme.text};

  button.name {
    all: unset;
    cursor: pointer;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:focus-visible {
      outline: 2px solid ${(p) => p.theme.focus};
    }
  }
`;

function NodeDetails({ node }: { node: GraphNode }) {
  const { graph, portfolioId, portfolioName, selectNode, openTool, refresh, online } =
    useExplorer();
  const nameOf = useAssetNames();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [weight, setWeight] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const ticker = node.ticker ?? node.label;
  const isHolding = node.type === "holding";

  useEffect(() => {
    closeRef.current?.focus();
  }, [node.id]);

  const links = graph.edges.filter(
    (edge) =>
      edge.type !== "belongs_to_sector" &&
      (edge.source === node.id || edge.target === node.id)
  );
  const assetClass = assetClassOf(node);

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      selectNode(null);
      refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "That did not work.");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") selectNode(null);
  };

  return (
    <Stack $gap={12} onKeyDown={onKeyDown} aria-label={`Details for ${node.label}`}>
      <Row $gap={8} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <Heading>{node.label}</Heading>
          <Row $gap={6} style={{ marginTop: 4 }} $wrap>
            <Badge $tone="muted">{ticker}</Badge>
            {!isHolding && <Badge $tone="warning">not held · {node.hop ?? "?"} hop{node.hop === 1 ? "" : "s"} out</Badge>}
            {node.status === "proposed" && <Badge $tone="warning">proposed</Badge>}
          </Row>
        </div>
        <Button
          ref={closeRef}
          type="button"
          $variant="ghost"
          $small
          onClick={() => selectNode(null)}
          aria-label="Close details"
        >
          ✕
        </Button>
      </Row>
      <Facts>
        <dt>Asset class</dt>
        <dd>{ASSET_CLASS_LABEL[assetClass]}</dd>
        <dt>Sector</dt>
        <dd>
          <Dot $color={sectorColor(node.sector)} />
          {node.sector ?? "Unknown"}
        </dd>
        {isHolding && (
          <>
            <dt>Weight</dt>
            <dd>{((node.weight ?? 0) * 100).toFixed(1)}% of portfolio</dd>
          </>
        )}
      </Facts>
      <Row $gap={6} $wrap>
        <Button type="button" $small $variant="ghost" onClick={() => openTool("paths", { source: ticker })}>
          Find paths
        </Button>
        <Button type="button" $small $variant="ghost" onClick={() => openTool("shock", { ticker })}>
          Shock it
        </Button>
        <Button
          type="button"
          $small
          $variant="ghost"
          onClick={() =>
            openTool("agent", {
              instruction: `Find well-documented suppliers, customers and financing relationships for ${node.label} (${ticker}) and connect them to the graph.`,
            })
          }
        >
          Expand with agent
        </Button>
      </Row>
      {online && isHolding && (
        <Button
          type="button"
          $small
          $variant="danger"
          onClick={() => act(() => api.removeHolding(portfolioId, ticker))}
        >
          Remove from {portfolioName}
        </Button>
      )}
      {online && !isHolding && node.status !== "proposed" && (
        <Row $gap={8}>
          <Input
            type="number"
            min={1}
            max={99}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            aria-label="Weight percent"
            style={{ width: 72 }}
          />
          <Button
            type="button"
            $small
            onClick={() => act(() => api.addHolding(portfolioId, ticker, weight / 100))}
          >
            Hold at {weight}%
          </Button>
        </Row>
      )}
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <Divider />
      <SectionLabel>Connections ({links.length})</SectionLabel>
      {links.length === 0 && <Muted>No connections at this depth.</Muted>}
      {links.map((edge) => {
        const outgoing = edge.source === node.id;
        const other = (outgoing ? edge.target : edge.source).split(":").slice(1).join(":");
        const group = VIA_TO_GROUP[edge.type] ?? "cash_flow";
        const id = Number(edge.id.split(":")[1]);
        return (
          <LinkCard key={edge.id} $accent={GROUP_COLOR[group]}>
            <Row $gap={6} $wrap style={{ marginBottom: 4 }}>
              <strong>
                {outgoing ? "→" : "←"} {nameOf(other)}
              </strong>
              <Badge $tone="muted">{VIA_LABEL[edge.type] ?? edge.type}</Badge>
              {edge.status === "proposed" && <Badge $tone="warning">proposed</Badge>}
              {edge.origin === "agent" && edge.status !== "proposed" && <Badge>agent</Badge>}
              {edge.origin === "user" && <Badge>added by you</Badge>}
            </Row>
            <Muted>{edge.note}</Muted>
            {online && edge.origin === "user" && (
              <Button
                type="button"
                $small
                $variant="danger"
                style={{ marginTop: 8 }}
                onClick={() => act(() => api.deleteExposure(id))}
              >
                Delete connection
              </Button>
            )}
          </LinkCard>
        );
      })}
    </Stack>
  );
}

function Overview() {
  const { graph, insight, selectNode, setHighlight } = useExplorer();
  const holdings = graph.nodes
    .filter((node) => node.type === "holding")
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const external = graph.nodes.filter((node) => node.type === "exposure").length;
  const links = graph.edges.filter((edge) => edge.type !== "belongs_to_sector").length;

  return (
    <Stack $gap={12}>
      <Heading>{graph.portfolio_name}</Heading>
      <Muted>
        {holdings.length} holdings · {links} connections
        {external > 0 && ` · ${external} linked assets you don't hold`}
      </Muted>
      {insight && (
        <Card
          as="button"
          type="button"
          $interactive
          onClick={() =>
            setHighlight({
              label: `Concentration: ${insight.sector}`,
              nodeIds: [
                `sector:${insight.sector}`,
                ...insight.contributing_tickers.map((t) => `holding:${t}`),
              ],
              edgeIds: insight.exposure_edge_ids.map((id) => `exposure:${id}`),
            })
          }
          aria-label={`Biggest hidden concentration: ${insight.sector}, ${insight.percentage} percent. Show on graph.`}
        >
          <SectionLabel>Biggest hidden concentration</SectionLabel>
          <Row $gap={8} style={{ justifyContent: "space-between", margin: "6px 0" }}>
            <strong style={{ fontSize: 14 }}>{insight.sector}</strong>
            <strong style={{ fontSize: 20 }}>{insight.percentage.toFixed(0)}%</strong>
          </Row>
          {insight.exposure_notes.slice(0, 2).map((note) => (
            <Muted key={note} style={{ marginTop: 4 }}>
              {note}
            </Muted>
          ))}
        </Card>
      )}
      <SectionLabel>Holdings</SectionLabel>
      <ul style={{ margin: 0, padding: 0 }}>
        {holdings.map((node) => (
          <HoldingRow key={node.id}>
            <Dot $color={sectorColor(node.sector)} />
            <button className="name" type="button" onClick={() => selectNode(node)}>
              {node.label}
            </button>
            <span>{((node.weight ?? 0) * 100).toFixed(1)}%</span>
          </HoldingRow>
        ))}
      </ul>
      <Muted>Select any node on the graph to inspect it.</Muted>
    </Stack>
  );
}

export function InspectPanel() {
  const { selectedNode } = useExplorer();
  return selectedNode ? <NodeDetails node={selectedNode} /> : <Overview />;
}
