import { type KeyboardEvent } from "react";
import styled from "styled-components";
import { useExplorer } from "../../state/ExplorerContext";
import { TOOL_LABEL, type ToolName } from "../../state/tools";
import { AddPanel } from "./AddPanel";
import { AgentPanel } from "./AgentPanel";
import { InspectPanel } from "./InspectPanel";
import { PathFinderPanel } from "./PathFinderPanel";
import { ReviewPanel } from "./ReviewPanel";
import { ShockPanel } from "./ShockPanel";
import { ThemesPanel } from "./ThemesPanel";

const TOOLS: ToolName[] = ["inspect", "paths", "shock", "themes", "add", "agent", "review"];

const TabList = styled.div`
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
`;

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 9px;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
  color: ${(p) => (p.$active ? p.theme.text : p.theme.textMuted)};
  background: ${(p) => (p.$active ? p.theme.accentSoft : "transparent")};

  &:hover {
    color: ${(p) => p.theme.text};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.focus};
    outline-offset: -2px;
  }
`;

const Count = styled.span`
  margin-left: 5px;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  background: ${(p) => p.theme.warning};
  color: #111;
`;

// `onSelect` lets the Canvas layout reopen its drawer even when the clicked
// tab is already the active one.
export function ToolTabs({ onSelect }: { onSelect?: () => void }) {
  const { activeTool, openTool, proposalCount } = useExplorer();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TOOLS.indexOf(activeTool);
    const next = TOOLS[(index + (event.key === "ArrowRight" ? 1 : -1) + TOOLS.length) % TOOLS.length];
    openTool(next);
    document.getElementById(`tool-tab-${next}`)?.focus();
  };

  return (
    <TabList role="tablist" aria-label="Analysis tools" onKeyDown={onKeyDown}>
      {TOOLS.map((tool) => (
        <Tab
          key={tool}
          id={`tool-tab-${tool}`}
          role="tab"
          type="button"
          aria-selected={activeTool === tool}
          aria-controls="tool-panel"
          tabIndex={activeTool === tool ? 0 : -1}
          $active={activeTool === tool}
          onClick={() => {
            openTool(tool);
            onSelect?.();
          }}
        >
          {TOOL_LABEL[tool]}
          {tool === "review" && proposalCount > 0 && (
            <Count aria-label={`${proposalCount} waiting`}>{proposalCount}</Count>
          )}
        </Tab>
      ))}
    </TabList>
  );
}

const PANELS: Record<ToolName, () => React.JSX.Element> = {
  inspect: InspectPanel,
  paths: PathFinderPanel,
  shock: ShockPanel,
  themes: ThemesPanel,
  add: AddPanel,
  agent: AgentPanel,
  review: ReviewPanel,
};

export function ToolBody() {
  const { activeTool } = useExplorer();
  const Panel = PANELS[activeTool];
  return (
    <div id="tool-panel" role="tabpanel" aria-labelledby={`tool-tab-${activeTool}`}>
      <Panel />
    </div>
  );
}
