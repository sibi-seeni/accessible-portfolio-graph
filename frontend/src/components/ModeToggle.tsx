import styled from "styled-components";

export type Mode = "visual" | "audio";

interface ModeToggleProps {
  mode: Mode;
  onToggle: (mode: Mode) => void;
}

const SectionLabel = styled.div`
  color: #555;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin: 0 0 12px 0;
`;

const Group = styled.div`
  display: flex;
  width: 100%;
`;

const Item = styled.button<{ $active: boolean; $first: boolean }>`
  flex: 1;
  padding: 10px 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border: none;
  background: ${(props) => (props.$active ? "#3D8FB0" : "#1a1d25")};
  color: ${(props) => (props.$active ? "#ffffff" : "#666")};
  border-radius: ${(props) =>
    props.$first ? "6px 0 0 6px" : "0 6px 6px 0"};
`;

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div>
      <SectionLabel>Mode</SectionLabel>
      <Group role="group" aria-label="Display mode">
        <Item
          type="button"
          $first
          $active={mode === "visual"}
          aria-pressed={mode === "visual"}
          onClick={() => onToggle("visual")}
        >
          Visual
        </Item>
        <Item
          type="button"
          $first={false}
          $active={mode === "audio"}
          aria-pressed={mode === "audio"}
          onClick={() => onToggle("audio")}
        >
          Audio-First
        </Item>
      </Group>
    </div>
  );
}
