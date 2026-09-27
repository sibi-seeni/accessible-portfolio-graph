import { useState } from "react";
import styled from "styled-components";
import type { AssetClass } from "../config/visualConfig";

const LegendRoot = styled.div`
  margin-top: 8px;
`;

const LegendBox = styled.div`
  position: relative;
  width: 100%;
  background: rgba(240, 240, 235, 0.88);
  border: 1px solid rgba(26, 32, 53, 0.15);
  border-radius: 10px;
  padding: 14px 18px;
  min-width: 200px;
`;

const LegendTitle = styled.div`
  color: #888899;
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
  color: #1a1d2e;
`;

const LegendDivider = styled.div`
  height: 1px;
  background: rgba(26, 32, 53, 0.12);
  margin: 10px 0;
`;

const LegendMinimizeButton = styled.button`
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 16px;
  color: #888899;
  cursor: pointer;
`;

const LegendPill = styled.button`
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(26, 32, 53, 0.15);
  border-radius: 24px;
  padding: 10px 18px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(26, 32, 53, 0.08);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #1a1d2e;
`;

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
  const fill = "#444455";

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

export function Legend() {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <LegendRoot>
        <LegendPill
          type="button"
          role="button"
          tabIndex={0}
          aria-label="Expand legend"
          onClick={() => setMinimized(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMinimized(false);
            }
          }}
        >
          <svg width={14} height={14} viewBox="0 0 20 20" aria-hidden="true">
            <circle cx={10} cy={10} r={6} fill="#444455" />
          </svg>
          Legend
        </LegendPill>
      </LegendRoot>
    );
  }

  return (
    <LegendRoot>
      <LegendBox>
        <LegendMinimizeButton
          type="button"
          aria-label="Minimize legend"
          onClick={() => setMinimized(true)}
        >
          −
        </LegendMinimizeButton>
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
    </LegendRoot>
  );
}
