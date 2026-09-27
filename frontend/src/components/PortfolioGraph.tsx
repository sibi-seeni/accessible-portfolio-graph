import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type Ref,
} from "react";
import styled from "styled-components";
import ForceGraph2D from "react-force-graph-2d";
import { graphs } from "../mocks/fixtures";
import type {
  GraphEdge as PortfolioGraphEdge,
  GraphNode as PortfolioGraphNode,
  PortfolioGraph as PortfolioGraphData,
} from "../hooks/usePortfolioData";
import {
  ASSET_CLASS_SHAPE,
  SECTOR_COLOR,
  TICKER_ASSET_CLASS,
  VIA_TO_GROUP,
} from "../config/visualConfig";

export interface HoldingNode {
  id: string;
  type: "holding";
  label: string;
  ticker: string;
  sector: string;
  weight: number;
}

interface SectorNode {
  id: string;
  type: "sector";
  label: string;
}

type GraphNode = HoldingNode | SectorNode;

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
  onNodeClick?: (node: HoldingNode | null) => void;
  selectedNodeId?: string | null;
  contributingTickers?: string[];
  queryHighlightNodeIds?: string[];
  queryHighlightEdgeIds?: string[];
}

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const SECTOR_RADIUS = 18;

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

function getEdgeStyle(link: GraphLinkObject): EdgeStyle {
  if (link.type === "belongs_to_sector") {
    return { strokeStyle: "#b0b0b8", lineWidth: 1.2, alpha: 0.6, dash: [] };
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
}: PortfolioGraphProps) {
  const fixtureGraph = graphs[portfolioId] as PortfolioGraphData | undefined;
  const source = graphData ?? fixtureGraph;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphHandle | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

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
      canvas.setAttribute("tabIndex", "0");
    }
  }, [size.width, size.height]);

  useEffect(() => {
    const forceGraph = graphRef.current;
    if (!forceGraph) return;

    forceGraph.d3Force("charge")?.strength(-300);
    forceGraph.d3Force("link")?.distance((link) =>
      link.type === "belongs_to_sector" ? 100 : 160
    );
    forceGraph.d3ReheatSimulation();
  }, [portfolioId, size.width, size.height]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      graphRef.current?.zoomToFit(400, 60);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [portfolioId]);

  const nodeCanvasObject = useCallback(
    (node: GraphNodeObject, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      if (node.type === "sector") {
        const color = SECTOR_COLOR[node.label] ?? "#555";

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, SECTOR_RADIUS, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        if (queryHighlightNodeIds.includes(node.id)) {
          drawQueryHighlightRing(ctx, x, y, SECTOR_RADIUS);
        }

        drawLabel(
          ctx,
          x,
          y + 32,
          11,
          node.label,
          "#0f1117",
          true,
          "rgba(240, 240, 235, 0.85)"
        );
        return;
      }

      const assetClass = TICKER_ASSET_CLASS[node.ticker] ?? "public_equity";
      const shape = ASSET_CLASS_SHAPE[assetClass];
      const color = SECTOR_COLOR[node.sector] ?? "#888";
      const r = 8 + (node.weight ?? 0.1) * 32;

      ctx.beginPath();
      drawHoldingShape(ctx, shape, x, y, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (queryHighlightNodeIds.includes(node.id)) {
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

      drawLabel(
        ctx,
        x,
        y + r + 14,
        9,
        truncate(node.label, 14),
        "#1a1d2e",
        false,
        "rgba(240, 240, 235, 0.82)"
      );
    },
    [selectedNodeId, contributingTickers, queryHighlightNodeIds]
  );

  const linkCanvasObject = useCallback(
    (link: GraphLinkObject, ctx: CanvasRenderingContext2D) => {
      const source = link.source;
      const target = link.target;
      if (typeof source !== "object" || typeof target !== "object") return;

      const { strokeStyle, lineWidth, alpha, dash } = getEdgeStyle(link);

      ctx.setLineDash(dash);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;

      if (queryHighlightEdgeIds.includes(link.id)) {
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
    [queryHighlightEdgeIds]
  );

  return (
    <Container ref={containerRef}>
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
              node.type === "sector" ? 18 : 8 + (node.weight ?? 0.1) * 32;
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
            link.type === "belongs_to_sector" ? 0 : 2
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
              onNodeClick?.(node);
            } else {
              onNodeClick?.(null);
            }
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
            } exposure connections.`
          : "Loading graph..."}
      </div>
    </Container>
  );
}
