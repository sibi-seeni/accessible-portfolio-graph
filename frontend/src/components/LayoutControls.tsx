import styled from "styled-components";
import type { LayoutName } from "../styles/theme";
import { useExplorer } from "../state/ExplorerContext";
import { Button, CheckLabel, Row, Segment, SegmentGroup } from "./ui/primitives";

export function LayoutSwitch({
  layout,
  onChange,
}: {
  layout: LayoutName;
  onChange: (layout: LayoutName) => void;
}) {
  return (
    <SegmentGroup role="group" aria-label="Layout">
      <Segment
        type="button"
        $active={layout === "canvas"}
        aria-pressed={layout === "canvas"}
        onClick={() => onChange("canvas")}
      >
        Canvas
      </Segment>
      <Segment
        type="button"
        $active={layout === "workspace"}
        aria-pressed={layout === "workspace"}
        onClick={() => onChange("workspace")}
      >
        Workspace
      </Segment>
    </SegmentGroup>
  );
}

const DepthLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  white-space: nowrap;
`;

// Depth controls how many hops beyond the holdings the graph pulls in.
export function GraphControls() {
  const { depth, setDepth, showProposed, setShowProposed, online, highlight, setHighlight } =
    useExplorer();
  return (
    <Row $gap={10} $wrap>
      <DepthLabel id="depth-label">Depth</DepthLabel>
      <SegmentGroup role="group" aria-labelledby="depth-label">
        {[1, 2, 3].map((value) => (
          <Segment
            key={value}
            type="button"
            $active={depth === value}
            aria-pressed={depth === value}
            disabled={!online}
            onClick={() => setDepth(value)}
            title={value === 1 ? "Holdings and their direct links" : `Pull in assets ${value} hops out`}
          >
            {value} hop{value === 1 ? "" : "s"}
          </Segment>
        ))}
      </SegmentGroup>
      <CheckLabel>
        <input
          type="checkbox"
          checked={showProposed}
          disabled={!online}
          onChange={(e) => setShowProposed(e.target.checked)}
        />
        Proposals
      </CheckLabel>
      {highlight && (
        <Button type="button" $small $variant="ghost" onClick={() => setHighlight(null)}>
          Clear “{highlight.label}”
        </Button>
      )}
    </Row>
  );
}
