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

const Wrapper = styled.div`
  pointer-events: auto;
`;

const SectionLabel = styled.div`
  color: #888899;
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
  padding: 10px 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  border-radius: 10px;
  transition: all 0.2s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: ${(props) =>
    props.$selected ? "rgba(61, 143, 176, 0.22)" : "rgba(255, 255, 255, 0.45)"};
  border: ${(props) =>
    props.$selected
      ? "1px solid rgba(61, 143, 176, 0.45)"
      : "1px solid rgba(26, 32, 53, 0.12)"};
  color: #1a1d2e;
  font-weight: ${(props) => (props.$selected ? 600 : 400)};
  box-shadow: ${(props) =>
    props.$selected
      ? "0 4px 16px rgba(61, 143, 176, 0.18)"
      : "0 2px 8px rgba(26, 32, 53, 0.06)"};

  ${(props) =>
    !props.$selected &&
    `
      &:hover {
        background: rgba(255, 255, 255, 0.65);
        border-color: rgba(61, 143, 176, 0.35);
        box-shadow: 0 4px 16px rgba(26, 32, 53, 0.1);
      }
    `}
`;

export function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
}: PortfolioSelectorProps) {
  return (
    <Wrapper>
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
    </Wrapper>
  );
}
