import { useState, type FormEvent } from "react";
import styled from "styled-components";
import { api, ApiError } from "../../api/client";
import type { AgentRun, AgentStep } from "../../api/types";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
  Body,
  Button,
  Card,
  ErrorText,
  Muted,
  Row,
  SectionLabel,
  Spinner,
  Stack,
  TextArea,
} from "../ui/primitives";

const Presets = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Preset = styled.button`
  font-family: inherit;
  font-size: 11.5px;
  padding: 5px 9px;
  border-radius: 999px;
  cursor: pointer;
  color: ${(p) => p.theme.text};
  background: transparent;
  border: 1px dashed ${(p) => p.theme.borderStrong};

  &:hover {
    border-style: solid;
  }
`;

const StepLine = styled.li`
  list-style: none;
  font-size: 11.5px;
  line-height: 1.5;
  color: ${(p) => p.theme.textMuted};
  padding: 6px 0;
  border-top: 1px solid ${(p) => p.theme.border};
  overflow-wrap: anywhere;

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: ${(p) => p.theme.text};
  }
`;

const WRITE_TOOLS = new Set(["propose_company", "propose_exposure"]);

function describe(step: AgentStep): string {
  const args = step.arguments;
  switch (step.tool) {
    case "propose_company":
      return `${args.company_name} (${args.ticker}), ${args.sector}`;
    case "propose_exposure":
      return `${args.ticker} → ${args.exposed_to_ticker} via ${args.via} (${args.confidence})`;
    case "finish":
      return "done";
    default:
      return Object.values(args).join(", ");
  }
}

function outcome(step: AgentStep): string | null {
  const result = step.result as Record<string, unknown> | null;
  if (result && typeof result === "object" && "error" in result) return String(result.error);
  if (result && typeof result === "object" && "skipped" in result) return String(result.skipped);
  return null;
}

export function AgentPanel() {
  const {
    portfolioId,
    portfolioName,
    preset,
    openTool,
    refresh,
    reloadProposals,
    setShowProposed,
    online,
  } = useExplorer();
  const [instruction, setInstruction] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  if (preset && preset.nonce !== appliedNonce && preset.instruction) {
    setAppliedNonce(preset.nonce);
    setInstruction(preset.instruction);
  }

  const presets = [
    `Find well-documented suppliers of the holdings in ${portfolioName} and connect them.`,
    `Look for hidden links between ${portfolioName} and the other portfolios.`,
    "Add TSMC (TSM) and connect it to the companies that depend on it.",
  ];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!instruction.trim()) return;
    setRunning(true);
    setError(null);
    setRun(null);
    try {
      const result = await api.runAgent(instruction.trim(), portfolioId);
      setRun(result);
      if (result.proposed_exposure_ids.length || result.proposed_company_tickers.length) {
        setShowProposed(true);
        refresh();
      }
      reloadProposals();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "The agent run failed.");
    } finally {
      setRunning(false);
    }
  };

  const proposedCount =
    (run?.proposed_company_tickers.length ?? 0) + (run?.proposed_exposure_ids.length ?? 0);

  return (
    <Stack as="form" onSubmit={submit} $gap={12} aria-label="Connection agent">
      <Muted>
        The agent searches the graph, then drafts new companies and
        relationships as proposals. Nothing joins the graph until you approve it
        in Review.
      </Muted>
      <TextArea
        aria-label="Instruction for the agent"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. Add Microsoft and connect it to my AI holdings"
        rows={4}
      />
      <Presets aria-label="Example instructions">
        {presets.map((text) => (
          <Preset key={text} type="button" onClick={() => setInstruction(text)}>
            {text}
          </Preset>
        ))}
      </Presets>
      <Button type="submit" disabled={!online || running || !instruction.trim()}>
        {running ? (
          <>
            <Spinner /> Researching…
          </>
        ) : (
          "Run agent"
        )}
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {run && (
        <Stack $gap={10} aria-live="polite">
          <Card>
            <Row $gap={6} style={{ marginBottom: 6 }}>
              <Badge>{proposedCount} proposal{proposedCount === 1 ? "" : "s"}</Badge>
              <Badge $tone="muted">{run.model}</Badge>
            </Row>
            <Body>{run.summary}</Body>
          </Card>
          {proposedCount > 0 && (
            <Button type="button" $variant="ghost" onClick={() => openTool("review")}>
              Review proposals
            </Button>
          )}
          <SectionLabel>Trace</SectionLabel>
          <ol style={{ margin: 0, padding: 0 }}>
            {run.steps.map((step, index) => {
              const problem = outcome(step);
              return (
                <StepLine key={index}>
                  <code>{step.tool}</code>{" "}
                  {WRITE_TOOLS.has(step.tool) && !problem && <Badge>proposed</Badge>}{" "}
                  {describe(step)}
                  {problem && <div>↳ {problem}</div>}
                </StepLine>
              );
            })}
          </ol>
        </Stack>
      )}
    </Stack>
  );
}
