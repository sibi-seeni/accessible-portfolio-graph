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
import {
  ASSET_CLASS_SHAPE,
  SECTOR_COLOR,
  TICKER_ASSET_CLASS,
  VIA_TO_GROUP,
  type AssetClass,
} from "../config/visualConfig";

interface HoldingNode {
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

interface ExposureEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
  note: string | null;
  exposure_sector?: string;
}

interface PortfolioGraphData {
  portfolio_id: number;
  portfolio_name: string;
  nodes: GraphNode[];
  edges: ExposureEdge[];
}

type GraphNodeObject = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type GraphLinkObject = Omit<ExposureEdge, "source" | "target"> & {
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
  graphData: { nodes: GraphNodeObject[]; links: GraphLinkObject[] };
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
  d3AlphaDecay?: number;
  d3VelocityDecay?: number;
  warmupTicks?: number;
  cooldownTicks?: number;
  onEngineStop?: () => void;
  linkDirectionalParticles?: (link: GraphLinkObject) => number;
  linkDirectionalParticleWidth?: (link: GraphLinkObject) => number;
  linkDirectionalParticleSpeed?: number;
  linkDirectionalParticleColor?: (link: GraphLinkObject) => string;
}

const TypedForceGraph2D = ForceGraph2D as unknown as FC<TypedForceGraphProps>;

interface PortfolioGraphProps {
  portfolioId: number;
}

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const LegendBox = styled.div`
  position: absolute;
  bottom: 24px;
  left: 24px;
  background: rgba(15, 17, 23, 0.85);
  border: 1px solid #2a2a3a;
  border-radius: 10px;
  padding: 14px 18px;
  min-width: 200px;
`;

const LegendTitle = styled.div`
  color: #555;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 8px;
`;

const LegendRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const LegendLabel = styled.span`
  font-size: 12px;
  color: #ccc;
`;

const LegendDivider = styled.div`
  height: 1px;
  background: #2a2a3a;
  margin: 10px 0;
`;

const SECTOR_RADIUS = 18;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const ASSET_CLASS_LEGEND: { assetClass: AssetClass; label: string }[] = [
  { assetClass: "public_equity", label: "Public Equity" },
  { assetClass: "private_equity", label: "Private Equity" },
  { assetClass: "real_estate", label: "Real Estate" },
  { assetClass: "private_credit", label: "Private Credit" },
  { assetClass: "infrastructure", label: "Infrastructure" },
];

interface ExposureLegendRow {
  label: string;
  stroke: string;
  dash?: string;
  opacity?: number;
}

const EXPOSURE_LEGEND: ExposureLegendRow[] = [
  { label: "Cash-flow linked", stroke: "#3D8FB0", dash: "6,3" },
  { label: "Financing linked", stroke: "#8B6DAF", dash: "2,4" },
  { label: "Housing cycle", stroke: "#C97B3D" },
  { label: "Sector membership", stroke: "#666666", opacity: 0.6 },
];

function AssetClassIcon({ assetClass }: { assetClass: AssetClass }) {
  const fill = "#888";

  switch (assetClass) {
    case "private_equity":
      return (
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <rect x={4} y={4} width={12} height={12} fill={fill} />
        </svg>
      );
    case "real_estate":
      return (
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <polygon points="10,2 18,10 18,18 2,18 2,10" fill={fill} />
        </svg>
      );
    case "private_credit":
      return (
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <polygon points="10,2 18,10 10,18 2,10" fill={fill} />
        </svg>
      );
    case "infrastructure":
      return (
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <polygon
            points="18,10 14,16.93 6,16.93 2,10 6,3.07 14,3.07"
            fill={fill}
          />
        </svg>
      );
    case "public_equity":
    default:
      return (
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx={10} cy={10} r={6} fill={fill} />
        </svg>
      );
  }
}

function Legend() {
  return (
    <LegendBox>
      <LegendTitle>Asset Class</LegendTitle>
      {ASSET_CLASS_LEGEND.map((row) => (
        <LegendRow key={row.assetClass}>
          <AssetClassIcon assetClass={row.assetClass} />
          <LegendLabel>{row.label}</LegendLabel>
        </LegendRow>
      ))}
      <LegendDivider />
      <LegendTitle>Exposure Type</LegendTitle>
      {EXPOSURE_LEGEND.map((row) => (
        <LegendRow key={row.label}>
          <svg width={32} height={12} aria-hidden="true">
            <line
              x1={1}
              y1={6}
              x2={31}
              y2={6}
              stroke={row.stroke}
              strokeWidth={2}
              strokeDasharray={row.dash}
              opacity={row.opacity}
            />
          </svg>
          <LegendLabel>{row.label}</LegendLabel>
        </LegendRow>
      ))}
    </LegendBox>
  );
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
  bold: boolean
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

  ctx.fillStyle = "rgba(15, 17, 23, 0.75)";
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
    return { strokeStyle: "#666666", lineWidth: 1.2, alpha: 1.0, dash: [] };
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

export function PortfolioGraph({ portfolioId }: PortfolioGraphProps) {
  const graph = graphs[portfolioId] as PortfolioGraphData | undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphHandle | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const graphData = useMemo(
    () => ({
      nodes: (graph?.nodes ?? []).map((node) => ({ ...node })),
      links: (graph?.edges ?? []).map((edge) => ({ ...edge })),
    }),
    [graph]
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
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(x, y, SECTOR_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        drawLabel(ctx, x, y + 32, 11, node.label, "#ffffff", true);
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

      drawLabel(ctx, x, y + r + 14, 9, truncate(node.label, 14), "#ccc", false);
    },
    []
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
      ctx.beginPath();
      ctx.moveTo(source.x ?? 0, source.y ?? 0);
      ctx.lineTo(target.x ?? 0, target.y ?? 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
    []
  );

  return (
    <Container ref={containerRef}>
      {size.width > 0 && size.height > 0 && (
        <TypedForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={() => ""}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={nodeCanvasObject}
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
        />
      )}
      <Legend />
    </Container>
  );
}
