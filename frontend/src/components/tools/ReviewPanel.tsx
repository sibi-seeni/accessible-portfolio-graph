import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { Proposals } from "../../api/types";
import { ASSET_CLASS_LABEL, VIA_LABEL, type AssetClass } from "../../config/visualConfig";
import { useAssetNames } from "../../hooks/useAssetNames";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Badge,
  Button,
  Card,
  CheckLabel,
  ErrorText,
  Muted,
  Row,
  SectionLabel,
  Spinner,
  Stack,
} from "../ui/primitives";

export function ReviewPanel() {
  const { refresh, refreshKey, reloadProposals, showProposed, setShowProposed, setHighlight, online } =
    useExplorer();
  const nameOf = useAssetNames();
  const [proposals, setProposals] = useState<Proposals | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProposals(await api.proposals());
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not load proposals.");
    }
  }, []);

  useEffect(() => {
    if (!online) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey, online]);

  const decide = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
      reloadProposals();
      refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Review failed.");
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    if (!proposals) return;
    setBusy("all");
    try {
      for (const exposure of proposals.exposures) await api.reviewExposure(exposure.id, true);
      const fresh = await api.proposals();
      for (const company of fresh.companies) await api.reviewCompany(company.ticker, true);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Review failed.");
    } finally {
      await load();
      reloadProposals();
      refresh();
      setBusy(null);
    }
  };

  const total = (proposals?.companies.length ?? 0) + (proposals?.exposures.length ?? 0);

  return (
    <Stack $gap={12} aria-label="Review proposals">
      <Muted>
        Proposals come from the agent. Approving a relationship also approves any
        proposed company it needs; rejecting a company rejects its relationships.
      </Muted>
      <CheckLabel>
        <input
          type="checkbox"
          checked={showProposed}
          onChange={(e) => setShowProposed(e.target.checked)}
        />
        Show proposals on the graph (dashed)
      </CheckLabel>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {online && !proposals && !error && <Spinner aria-label="Loading proposals" />}
      {proposals && total === 0 && <Muted>Nothing waiting for review.</Muted>}
      {total > 1 && (
        <Button type="button" $variant="ghost" disabled={busy !== null} onClick={approveAll}>
          {busy === "all" ? <Spinner /> : `Approve all ${total}`}
        </Button>
      )}
      {proposals && proposals.exposures.length > 0 && (
        <Stack $gap={8}>
          <SectionLabel>Relationships</SectionLabel>
          {proposals.exposures.map((exposure) => (
            <Card
              key={exposure.id}
              onMouseEnter={() =>
                setHighlight({
                  label: "Proposal",
                  nodeIds: [],
                  edgeIds: [`exposure:${exposure.id}`],
                })
              }
            >
              <strong>
                {nameOf(exposure.ticker)} → {nameOf(exposure.exposed_to_ticker)}
              </strong>
              <Row $gap={6} $wrap style={{ margin: "6px 0" }}>
                <Badge>{VIA_LABEL[exposure.via] ?? exposure.via}</Badge>
                <Badge $tone="muted">{exposure.exposure_sector}</Badge>
                {exposure.confidence !== null && (
                  <Badge $tone={exposure.confidence >= 0.8 ? "accent" : "warning"}>
                    {Math.round(exposure.confidence * 100)}% confident
                  </Badge>
                )}
              </Row>
              <Muted>{exposure.note}</Muted>
              <Row $gap={8} style={{ marginTop: 8 }}>
                <Button
                  type="button"
                  $small
                  $variant="success"
                  disabled={busy !== null}
                  onClick={() => decide(`e${exposure.id}`, () => api.reviewExposure(exposure.id, true))}
                  aria-label={`Approve ${exposure.ticker} to ${exposure.exposed_to_ticker}`}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  $small
                  $variant="danger"
                  disabled={busy !== null}
                  onClick={() => decide(`e${exposure.id}`, () => api.reviewExposure(exposure.id, false))}
                  aria-label={`Reject ${exposure.ticker} to ${exposure.exposed_to_ticker}`}
                >
                  Reject
                </Button>
                {busy === `e${exposure.id}` && <Spinner />}
              </Row>
            </Card>
          ))}
        </Stack>
      )}
      {proposals && proposals.companies.length > 0 && (
        <Stack $gap={8}>
          <SectionLabel>Companies</SectionLabel>
          {proposals.companies.map((company) => (
            <Card key={company.ticker}>
              <strong>
                {company.company_name} ({company.ticker})
              </strong>
              <Row $gap={6} $wrap style={{ margin: "6px 0" }}>
                <Badge $tone="muted">{company.sector}</Badge>
                <Badge $tone="muted">
                  {ASSET_CLASS_LABEL[company.asset_class as AssetClass] ?? company.asset_class}
                </Badge>
              </Row>
              {company.description && <Muted>{company.description}</Muted>}
              <Row $gap={8} style={{ marginTop: 8 }}>
                <Button
                  type="button"
                  $small
                  $variant="success"
                  disabled={busy !== null}
                  onClick={() => decide(`c${company.ticker}`, () => api.reviewCompany(company.ticker, true))}
                  aria-label={`Approve ${company.company_name}`}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  $small
                  $variant="danger"
                  disabled={busy !== null}
                  onClick={() => decide(`c${company.ticker}`, () => api.reviewCompany(company.ticker, false))}
                  aria-label={`Reject ${company.company_name}`}
                >
                  Reject
                </Button>
              </Row>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
