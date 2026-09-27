import { useEffect, useRef, type KeyboardEvent } from "react";
import styled from "styled-components";
import {
  SECTOR_COLOR,
  TICKER_ASSET_CLASS,
  VIA_TO_GROUP,
  type AssetClass,
} from "../config/visualConfig";
import type { PortfolioGraph } from "../hooks/usePortfolioData";
import type { HoldingNode } from "./PortfolioGraph";

interface HoldingDetailPanelProps {
  node: HoldingNode;
  graph: PortfolioGraph;
  onClose: () => void;
}

const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  public_equity: "Public Equity",
  private_equity: "Private Equity",
  real_estate: "Real Estate",
  private_credit: "Private Credit",
  infrastructure: "Infrastructure",
};

const VIA_LABEL: Record<string, string> = {
  demand_driver: "Demand driver",
  operating_dependency: "Operating dependency",
  supply_chain: "Supply chain",
  lending: "Lending relationship",
  credit_market: "Credit market exposure",
  financing_dependency: "Financing dependency",
  housing_cycle: "Housing cycle",
};

const GROUP_COLOR: Record<string, string> = {
  cash_flow: "#3D8FB0",
  financing: "#8B6DAF",
  housing_cycle: "#C97B3D",
};

const Panel = styled.div`
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 300px;
  max-height: 70vh;
  overflow-y: auto;
  z-index: 20;
  padding: 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(26, 32, 53, 0.12);
  box-shadow: 0 8px 32px rgba(26, 32, 53, 0.12);
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 16px;
  color: #888899;
  cursor: pointer;
`;

const Name = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #1a1d2e;
  margin-bottom: 4px;
`;

const TickerBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(61, 143, 176, 0.12);
  color: #3d8fb0;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 16px;
`;

const InfoRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
`;

const InfoLabel = styled.div`
  font-size: 10px;
  color: #888899;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const InfoValue = styled.div`
  font-size: 13px;
  color: #1a1d2e;
  font-weight: 500;
`;

const SectorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => props.$color};
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(26, 32, 53, 0.08);
  margin: 16px 0;
`;

const SectionLabel = styled.div`
  font-size: 10px;
  color: #888899;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
`;

const EmptyText = styled.div`
  font-size: 12px;
  color: #888899;
  font-style: italic;
`;

const Chip = styled.div<{ $accent: string }>`
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: rgba(26, 32, 53, 0.04);
  border-left: 3px solid ${(props) => props.$accent};
`;

const ChipDirection = styled.div`
  font-size: 10px;
  color: #888899;
`;

const ChipVia = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #1a1d2e;
  margin: 2px 0 4px;
`;

const ChipNote = styled.div`
  font-size: 11px;
  color: #444455;
  line-height: 1.5;
`;

export function HoldingDetailPanel({
  node,
  graph,
  onClose,
}: HoldingDetailPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [node.id]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose();
    }
  };

  const exposureEdges = graph.edges.filter(
    (edge) =>
      edge.type !== "belongs_to_sector" &&
      (edge.source === node.id || edge.target === node.id)
  );
  const assetClass = TICKER_ASSET_CLASS[node.ticker] ?? "public_equity";

  return (
    <Panel
      role="dialog"
      aria-modal="true"
      aria-label={`Holding details for ${node.label}`}
      onKeyDown={handleKeyDown}
    >
      <CloseButton
        type="button"
        ref={closeRef}
        aria-label="Close holding details"
        onClick={onClose}
      >
        ×
      </CloseButton>
      <Name>{node.label}</Name>
      <TickerBadge>{node.ticker}</TickerBadge>

      <InfoRow>
        <InfoLabel role="heading" aria-level={3}>
          Asset Class
        </InfoLabel>
        <InfoValue>{ASSET_CLASS_LABEL[assetClass]}</InfoValue>
      </InfoRow>

      <InfoRow>
        <InfoLabel role="heading" aria-level={3}>
          Sector
        </InfoLabel>
        <SectorRow>
          <Dot $color={SECTOR_COLOR[node.sector] ?? "#888"} />
          <InfoValue>{node.sector}</InfoValue>
        </SectorRow>
      </InfoRow>

      <InfoRow>
        <InfoLabel role="heading" aria-level={3}>
          Weight
        </InfoLabel>
        <InfoValue>
          {(node.weight * 100).toFixed(0)}% of portfolio
        </InfoValue>
      </InfoRow>

      <Divider />

      <SectionLabel role="heading" aria-level={3}>
        Exposure Links
      </SectionLabel>
      {exposureEdges.length === 0 ? (
        <EmptyText>No direct exposure links</EmptyText>
      ) : (
        exposureEdges.map((edge) => {
          const group = VIA_TO_GROUP[edge.type] ?? "cash_flow";
          const outgoing = edge.source === node.id;
          return (
            <Chip key={edge.id} $accent={GROUP_COLOR[group] ?? "#3D8FB0"}>
              <ChipDirection>
                {outgoing ? "→ outgoing" : "← incoming"}
              </ChipDirection>
              <ChipVia>{VIA_LABEL[edge.type] ?? edge.type}</ChipVia>
              <ChipNote>{edge.note}</ChipNote>
            </Chip>
          );
        })
      )}
    </Panel>
  );
}
