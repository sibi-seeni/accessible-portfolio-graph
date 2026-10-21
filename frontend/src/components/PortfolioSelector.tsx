import { useRef, type KeyboardEvent } from "react";
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
  color: ${(p) => p.theme.textMuted};
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
    props.$selected ? props.theme.accentSoft : props.theme.surface};
  border: ${(props) =>
    props.$selected
      ? "1px solid rgba(61, 143, 176, 0.45)"
      : `1px solid ${props.theme.border}`};
  color: ${(p) => p.theme.text};
  font-weight: ${(props) => (props.$selected ? 600 : 400)};
  box-shadow: ${(props) =>
    props.$selected
      ? "0 4px 16px rgba(61, 143, 176, 0.18)"
      : "none"};

  ${(props) =>
    !props.$selected &&
    `
      &:hover {
        background: ${props.theme.surfaceRaised};
        border-color: rgba(61, 143, 176, 0.35);
        box-shadow: ${props.theme.shadow};
      }
    `}
`;

export function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
}: PortfolioSelectorProps) {
  const buttonRefs = useRef<HTMLButtonElement[]>([]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next =
      (index + delta + portfolios.length) % portfolios.length;
    buttonRefs.current[next]?.focus();
  };

  return (
    <Wrapper>
      <SectionLabel>Portfolios</SectionLabel>
      <List role="group" aria-label="Portfolio selection">
        {portfolios.map((portfolio, index) => (
          <Item
            key={portfolio.id}
            type="button"
            ref={(element) => {
              if (element) buttonRefs.current[index] = element;
            }}
            $selected={portfolio.id === selectedId}
            aria-pressed={portfolio.id === selectedId}
            aria-label={`Select ${portfolio.name} portfolio`}
            onClick={() => onSelect(portfolio.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {portfolio.name}
          </Item>
        ))}
      </List>
    </Wrapper>
  );
}
