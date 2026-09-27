import styled from "styled-components";

interface Portfolio {
  id: number;
  name: string;
}

interface PortfolioSelectorProps {
  portfolios: Portfolio[];
  selectedId: number;
  onSelect: (id: number) => void;
}

const SectionLabel = styled.div`
  color: #555;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin: 0 0 12px 0;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.button<{ $selected: boolean }>`
  width: 100%;
  padding: 12px 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  border-radius: 6px;
  background: ${(props) => (props.$selected ? "#3D8FB0" : "transparent")};
  color: ${(props) => (props.$selected ? "#ffffff" : "#888")};
  font-weight: ${(props) => (props.$selected ? 700 : 400)};
  border: ${(props) => (props.$selected ? "none" : "1px solid #333")};

  ${(props) =>
    !props.$selected &&
    `
      &:hover {
        border-color: #3D8FB0;
        color: #ccc;
      }
    `}
`;

export function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
}: PortfolioSelectorProps) {
  return (
    <div>
      <SectionLabel>Portfolios</SectionLabel>
      <List>
        {portfolios.map((portfolio) => (
          <Item
            key={portfolio.id}
            type="button"
            $selected={portfolio.id === selectedId}
            aria-pressed={portfolio.id === selectedId}
            onClick={() => onSelect(portfolio.id)}
          >
            {portfolio.name}
          </Item>
        ))}
      </List>
    </div>
  );
}
