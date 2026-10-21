import styled from "styled-components";

export type Mode = "visual" | "audio";

interface ModeToggleProps {
  mode: Mode;
  onToggle: (mode: Mode) => void;
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

const Group = styled.div`
  display: inline-flex;
  width: 100%;
  padding: 3px;
  border-radius: 10px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: ${(p) => p.theme.surface};
  border: 1px solid ${(p) => p.theme.border};
  box-shadow: ${(p) => p.theme.shadow};
`;

const Item = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 8px 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border: none;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: ${(props) =>
    props.$active ? props.theme.accentSoft : "transparent"};
  color: ${(props) =>
    props.$active ? props.theme.text : props.theme.textMuted};
  font-weight: ${(props) => (props.$active ? 600 : 400)};
  box-shadow: ${(props) =>
    props.$active ? "0 2px 6px rgba(61, 143, 176, 0.2)" : "none"};
`;

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <Wrapper>
      <SectionLabel>Mode</SectionLabel>
      <Group role="group" aria-label="Display mode selection">
        <Item
          type="button"
          $active={mode === "visual"}
          aria-pressed={mode === "visual"}
          aria-label="Visual mode"
          onClick={() => onToggle("visual")}
        >
          Visual
        </Item>
        <Item
          type="button"
          $active={mode === "audio"}
          aria-pressed={mode === "audio"}
          aria-label="Audio-Visual mode"
          onClick={() => onToggle("audio")}
        >
          Audio-Visual
        </Item>
      </Group>
    </Wrapper>
  );
}
