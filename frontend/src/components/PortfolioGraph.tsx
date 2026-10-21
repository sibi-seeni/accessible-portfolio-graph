import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type Ref,
} from "react";
import styled, { useTheme } from "styled-components";
import ForceGraph2D from "react-force-graph-2d";
import { graphs } from "../mocks/fixtures";
import type {
  GraphEdge as PortfolioGraphEdge,
  GraphNode as PortfolioGraphNode,
  PortfolioGraph as PortfolioGraphData,
} from "../hooks/usePortfolioData";
import { playNodeTone } from "../hooks/useGraphSonification";
import {
  ASSET_CLASS_SHAPE,
  VIA_TO_GROUP,
  assetClassOf,
  sectorColor,
} from "../config/visualConfig";

export interface HoldingNode {
  id: string;
  type: "holding";
  label: string;
  ticker: string;
  sector: string;
  weight: number;
  asset_class?: string;
}

interface SectorNode {
  id: string;
  type: "sector";
  label: string;
}

// An asset linked to the portfolio that it does not hold.
interface ExternalNode {
  id: string;
  type: "exposure";
  label: string;
  ticker: string;
  sector?: string;
  asset_class?: string;
  hop?: number;
  status?: string;
}

type GraphNode = HoldingNode | SectorNode | ExternalNode;

type GraphNodeObject = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type GraphLinkObject = Omit<PortfolioGraphEdge, "source" | "target"> & {
  source: string | GraphNodeObject;
  target: string | GraphNodeObject;
};

interface D3Force {
  strength: (value: number) => void;
  distance: (accessor: (link: GraphLinkObject) => number) => void;
}

interface ForceGraphHandle {
  d3Force: (name: string) => D3Force | undefined;
  d3ReheatSimulation: () => void;
  zoomToFit: (durationMs?: number, padding?: number) => void;
}

interface TypedForceGraphProps {
  ref?: Ref<ForceGraphHandle | undefined>;
  graphData: { nodes: PortfolioGraphNode[]; links: PortfolioGraphEdge[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeLabel?: () => string;
  nodeCanvasObjectMode?: () => "replace";
  nodeCanvasObject?: (
    node: GraphNodeObject,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => void;
  linkCanvasObjectMode?: () => "replace";
  linkCanvasObject?: (
    link: GraphLinkObject,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => void;
  nodePointerAreaPaint?: (
    node: GraphNodeObject,
    color: string,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => void;
  d3AlphaDecay?: number;
  d3VelocityDecay?: number;
  warmupTicks?: number;
  cooldownTicks?: number;
  onEngineStop?: () => void;
  onNodeClick?: (node: GraphNodeObject) => void;
  onNodeHover?: (node: GraphNodeObject | null) => void;
  onBackgroundClick?: () => void;
  linkDirectionalParticles?: (link: GraphLinkObject) => number;
  linkDirectionalParticleWidth?: (link: GraphLinkObject) => number;
  linkDirectionalParticleSpeed?: number;
  linkDirectionalParticleColor?: (link: GraphLinkObject) => string;
}

const TypedForceGraph2D = ForceGraph2D as unknown as FC<TypedForceGraphProps>;

interface PortfolioGraphProps {
  portfolioId: number;
  graphData?: PortfolioGraphData | null;
  onNodeClick?: (node: PortfolioGraphNode | null) => void;
  selectedNodeId?: string | null;
  contributingTickers?: string[];
  queryHighlightNodeIds?: string[];
  queryHighlightEdgeIds?: string[];
  isAudioVisualMode?: boolean;
  // Fade everything outside the highlight (paths, shocks, themes).
  dimOthers?: boolean;
}

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.accent};
    outline-offset: -2px;
    border-radius: 8px;
  }
`;

const SECTOR_RADIUS = 18;
const EXTERNAL_RADIUS = 7;

function holdingRadius(weight: number | undefined): number {
  return 8 + (weight ?? 0.1) * 32;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function drawHoldingShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  r: number
): void {
  switch (shape) {
    case "square":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "house":
      ctx.moveTo(x - r, y + r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x + r, y - r * 0.3);
      ctx.lineTo(x, y - r * 1.3);
      ctx.lineTo(x - r, y - r * 0.3);
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      break;
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  fontSize: number,
  label: string,
  color: string,
  bold: boolean,
  pillFill: string
): void {
  const pillPadX = 5;
  const pillPadY = 2;

  ctx.font = `${bold ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(label).width;

  const pillX = x - textWidth / 2 - pillPadX;
  const pillY = centerY - fontSize / 2 - pillPadY;
  const pillW = textWidth + pillPadX * 2;
  const pillH = fontSize + pillPadY * 2;
  const rad = 4;

  ctx.fillStyle = pillFill;
  ctx.beginPath();
  ctx.moveTo(pillX + rad, pillY);
  ctx.lineTo(pillX + pillW - rad, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + rad);
  ctx.lineTo(pillX + pillW, pillY + pillH - rad);
  ctx.quadraticCurveTo(
    pillX + pillW,
    pillY + pillH,
    pillX + pillW - rad,
    pillY + pillH
  );
  ctx.lineTo(pillX + rad, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - rad);
  ctx.lineTo(pillX, pillY + rad);
  ctx.quadraticCurveTo(pillX, pillY, pillX + rad, pillY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(label, x, centerY);
}

interface EdgeStyle {
  strokeStyle: string;
  lineWidth: number;
  alpha: number;
  dash: number[];
}

function getEdgeStyle(
  link: GraphLinkObject,
  structuralColor: string,
  proposedColor: string
): EdgeStyle {
  if (link.type === "belongs_to_sector") {
    return { strokeStyle: structuralColor, lineWidth: 1.2, alpha: 0.6, dash: [] };
  }
  if (link.status === "proposed") {
    return { strokeStyle: proposedColor, lineWidth: 1.4, alpha: 0.85, dash: [3, 3] };
  }

  const group = VIA_TO_GROUP[link.type] ?? "cash_flow";
  if (group === "financing") {
    return { strokeStyle: "#8B6DAF", lineWidth: 1.2, alpha: 0.7, dash: [2, 4] };
  }
  if (group === "housing_cycle") {
    return { strokeStyle: "#C97B3D", lineWidth: 1, alpha: 0.6, dash: [] };
  }
  return { strokeStyle: "#3D8FB0", lineWidth: 1.2, alpha: 0.7, dash: [6, 3] };
}

function drawQueryHighlightRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  baseR: number
): void {
  const t = Date.now() / 1000;
  const pulse = (Math.sin(t * 3) + 1) / 2;
  const ringRadius = baseR + 7 + pulse * 6;
  const ringAlpha = 0.7 - pulse * 0.4;

  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(212, 175, 55, ${ringAlpha})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
}

export function PortfolioGraph({
  portfolioId,
  graphData,
  onNodeClick,
  selectedNodeId,
  contributingTickers = [],
  queryHighlightNodeIds = [],
  queryHighlightEdgeIds = [],
  isAudioVisualMode = false,
  dimOthers = false,
}: PortfolioGraphProps) {
  const theme = useTheme();
  const fixtureGraph = graphs[portfolioId] as PortfolioGraphData | undefined;
  const source = graphData ?? fixtureGraph;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphHandle | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const data = useMemo(
    () => ({
      nodes: (source?.nodes ?? []).map((node) => ({ ...node })),
      links: (source?.edges ?? []).map((edge) => ({ ...edge })),
    }),
    [source]
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setSize({ width: rect.width, height: rect.height });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) {
      canvas.setAttribute(
        "aria-label",
        "Interactive portfolio graph. Use the holding detail panel for accessible node information."
      );
      canvas.setAttribute("role", "img");
      canvas.setAttribute("tabIndex", isAudioVisualMode && graphData ? "0" : "-1");
    }
  }, [size.width, size.height, isAudioVisualMode, graphData]);

  useEffect(() => {
    if (!isAudioVisualMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedNodeId(null);
    }
  }, [isAudioVisualMode]);

  useEffect(() => {
    const forceGraph = graphRef.current;
    if (!forceGraph) return;

    forceGraph.d3Force("charge")?.strength(-300);
    forceGraph.d3Force("link")?.distance((link) =>
      link.type === "belongs_to_sector" ? 100 : 160
    );
    forceGraph.d3ReheatSimulation();
  }, [portfolioId, size.width, size.height, data]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      graphRef.current?.zoomToFit(400, 60);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [portfolioId, data.nodes.length]);

  const highlightedNodes = useMemo(
    () => new Set(queryHighlightNodeIds),
    [queryHighlightNodeIds]
  );
  const highlightedEdges = useMemo(
    () => new Set(queryHighlightEdgeIds),
    [queryHighlightEdgeIds]
  );
  const isDimmed = useCallback(
    (nodeId: string) => dimOthers && !highlightedNodes.has(nodeId),
    [dimOthers, highlightedNodes]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNodeObject, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      ctx.save();
      ctx.globalAlpha = isDimmed(node.id) ? 0.18 : 1;

      if (node.type === "sector") {
        const color = sectorColor(node.label);

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, SECTOR_RADIUS, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        if (highlightedNodes.has(node.id)) {
          drawQueryHighlightRing(ctx, x, y, SECTOR_RADIUS);
        }

        drawLabel(
          ctx,
          x,
          y + 32,
          11,
          node.label,
          theme.graph.sectorLabel,
          true,
          theme.graph.sectorPill
        );
        ctx.restore();
        return;
      }

      const shape = ASSET_CLASS_SHAPE[assetClassOf(node)];

      if (node.type === "exposure") {
        const color = sectorColor(node.sector);
        ctx.beginPath();
        drawHoldingShape(ctx, shape, x, y, EXTERNAL_RADIUS);
        ctx.fillStyle = theme.graph.externalFill;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(node.status === "proposed" ? [2, 2] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        if (highlightedNodes.has(node.id)) {
          drawQueryHighlightRing(ctx, x, y, EXTERNAL_RADIUS);
        }
        if (node.id === selectedNodeId) {
          ctx.beginPath();
          ctx.arc(x, y, EXTERNAL_RADIUS + 5, 0, Math.PI * 2);
          ctx.strokeStyle = theme.accent;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        drawLabel(
          ctx,
          x,
          y + EXTERNAL_RADIUS + 12,
          8,
          truncate(node.label, 16),
          theme.graph.label,
          false,
          theme.graph.labelPill
        );
        ctx.restore();
        return;
      }

      const color = sectorColor(node.sector);
      const r = holdingRadius(node.weight);

      ctx.beginPath();
      drawHoldingShape(ctx, shape, x, y, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (highlightedNodes.has(node.id)) {
        drawQueryHighlightRing(ctx, x, y, r);
      }

      if (contributingTickers.includes(node.ticker)) {
        const t = Date.now() / 1000;

        [0, 0.4].forEach((phaseOffset) => {
          const pulse = (Math.sin(t * 2.5 + phaseOffset) + 1) / 2;
          const ringRadius = r + 6 + pulse * 8;
          const ringAlpha = 0.6 - pulse * 0.5;

          ctx.beginPath();
          ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(220, 60, 60, ${ringAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.stroke();
        });

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(220, 60, 60, 0.15)";
        ctx.fill();
      }

      if (node.id === selectedNodeId) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(61, 143, 176, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x, y, r + 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(61, 143, 176, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      if (isAudioVisualMode && node.id === focusedNodeId) {
        ctx.beginPath();
        ctx.arc(x, y, r + 12, 0, Math.PI * 2);
        ctx.strokeStyle = theme.focus;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawLabel(
        ctx,
        x,
        y + r + 14,
        9,
        truncate(node.label, 14),
        theme.graph.label,
        false,
        theme.graph.labelPill
      );
      ctx.restore();
    },
    [
      selectedNodeId,
      contributingTickers,
      highlightedNodes,
      focusedNodeId,
      isAudioVisualMode,
      isDimmed,
      theme,
    ]
  );

  const linkCanvasObject = useCallback(
    (link: GraphLinkObject, ctx: CanvasRenderingContext2D) => {
      const source = link.source;
      const target = link.target;
      if (typeof source !== "object" || typeof target !== "object") return;

      const { strokeStyle, lineWidth, alpha, dash } = getEdgeStyle(
        link,
        theme.graph.structuralEdge,
        theme.graph.proposedEdge
      );
      const highlighted = highlightedEdges.has(link.id);

      ctx.setLineDash(dash);
      ctx.globalAlpha = dimOthers && !highlighted ? alpha * 0.15 : alpha;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;

      if (highlighted) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = ctx.lineWidth + 1.5;
        ctx.strokeStyle = "rgba(212, 175, 55, 0.9)";
      }

      ctx.beginPath();
      ctx.moveTo(source.x ?? 0, source.y ?? 0);
      ctx.lineTo(target.x ?? 0, target.y ?? 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
    [highlightedEdges, dimOthers, theme]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isAudioVisualMode || !graphData) return;

    const holdings = data.nodes
      .filter((node) => node.type === "holding")
      .map((node) => ({
        id: node.id,
        sector: node.sector ?? "",
        x: (node as { x?: number }).x ?? 0,
      }));
    if (holdings.length === 0) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const ordered = [...holdings].sort((a, b) => a.x - b.x);
      const currentIndex = focusedNodeId
        ? ordered.findIndex((node) => node.id === focusedNodeId)
        : -1;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? delta === 1
            ? 0
            : ordered.length - 1
          : (currentIndex + delta + ordered.length) % ordered.length;
      const next = ordered[nextIndex];
      setFocusedNodeId(next.id);
      void playNodeTone(next.sector, next.x, size.width);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (!focusedNodeId) return;
      const focused = data.nodes.find(
        (node) => node.id === focusedNodeId && node.type === "holding"
      );
      if (!focused) return;
      event.preventDefault();
      onNodeClick?.(focused);
    }
  };

  const focusedNode = focusedNodeId
    ? data.nodes.find((node) => node.id === focusedNodeId) ?? null
    : null;
  const focusedAnnouncement = focusedNode
    ? `${focusedNode.ticker ?? focusedNode.label}, ${
        focusedNode.sector ?? "unknown"
      } sector, ${assetClassOf(focusedNode).replace(/_/g, " ")}, ${Math.round(
        (focusedNode.weight ?? 0) * 100
      )}% of portfolio`
    : "";

  return (
    <Container
      ref={containerRef}
      tabIndex={isAudioVisualMode && graphData ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      {size.width > 0 && size.height > 0 && (
        <TypedForceGraph2D
          ref={graphRef}
          graphData={data}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={() => ""}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            const r =
              node.type === "sector"
                ? SECTOR_RADIUS
                : node.type === "exposure"
                  ? EXTERNAL_RADIUS
                  : holdingRadius(node.weight);
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r + 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkCanvasObjectMode={() => "replace"}
          linkCanvasObject={linkCanvasObject}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={100}
          cooldownTicks={0}
          linkDirectionalParticles={(link) =>
            link.type === "belongs_to_sector" ||
            link.status === "proposed" ||
            (dimOthers && !highlightedEdges.has(link.id))
              ? 0
              : 2
          }
          linkDirectionalParticleWidth={(link) =>
            link.type === "belongs_to_sector" ? 0 : 2
          }
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={(link) => {
            const group = VIA_TO_GROUP[link.type];
            if (group === "cash_flow") return "#3D8FB0";
            if (group === "financing") return "#8B6DAF";
            if (group === "housing_cycle") return "#C97B3D";
            return "#ffffff";
          }}
          onNodeClick={(node) => {
            if (node.type === "holding") {
              if (isAudioVisualMode) {
                void playNodeTone(node.sector, node.x ?? 0, size.width);
              }
              onNodeClick?.(node);
            } else if (node.type === "exposure") {
              onNodeClick?.(node);
            } else {
              onNodeClick?.(null);
            }
          }}
          onNodeHover={(node) => {
            if (!isAudioVisualMode) return;
            if (!node) {
              setHoveredNodeId(null);
              return;
            }
            if (node.type !== "holding") return;
            if (node.id === hoveredNodeId) return;
            setHoveredNodeId(node.id);
            void playNodeTone(node.sector, node.x ?? 0, size.width);
          }}
          onBackgroundClick={() => onNodeClick?.(null)}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        aria-label="Graph status"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        {source
          ? `${source.portfolio_name} portfolio graph loaded with ${
              source.nodes.filter((node) => node.type === "holding").length
            } holdings and ${
              source.edges.filter((edge) => edge.type !== "belongs_to_sector")
                .length
            } exposure connections${
              source.nodes.some((node) => node.type === "exposure")
                ? ` and ${
                    source.nodes.filter((node) => node.type === "exposure").length
                  } linked assets not held`
                : ""
            }.`
          : "Loading graph..."}
      </div>
      {isAudioVisualMode && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Focused holding"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
        >
          {focusedAnnouncement}
        </div>
      )}
    </Container>
  );
}
