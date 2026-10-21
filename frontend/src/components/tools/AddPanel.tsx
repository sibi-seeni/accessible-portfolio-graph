import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { ASSET_CLASS_LABEL, VIA_LABEL, type AssetClass } from "../../config/visualConfig";
import { useExplorer } from "../../state/ExplorerContext";
import {
  Body,
  Button,
  CheckLabel,
  Divider,
  ErrorText,
  FieldLabel,
  Heading,
  Input,
  Muted,
  Row,
  Select,
  Spinner,
  Stack,
  TextArea,
} from "../ui/primitives";
import { AssetSelect } from "./AssetSelect";

const ASSET_CLASSES = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];

function CompanyForm() {
  const { portfolioId, portfolioName, meta, refresh, openTool, online } = useExplorer();
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("public_equity");
  const [description, setDescription] = useState("");
  const [addToPortfolio, setAddToPortfolio] = useState(true);
  const [weight, setWeight] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ ticker: string; name: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const company = await api.createCompany({
        ticker,
        company_name: name,
        sector,
        asset_class: assetClass,
        description: description || null,
      });
      if (addToPortfolio) {
        await api.addHolding(portfolioId, company.ticker, weight / 100);
      }
      setCreated({ ticker: company.ticker, name: company.company_name });
      setTicker("");
      setName("");
      setDescription("");
      refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not add the company.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack as="form" onSubmit={submit} $gap={10} aria-label="Add a company">
      <Heading>Add a company</Heading>
      <Row $gap={10}>
        <FieldLabel style={{ flex: "0 0 36%" }}>
          Ticker / ID
          <Input
            required
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="TSM or PRIVATE_FUND"
          />
        </FieldLabel>
        <FieldLabel>
          Name
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Taiwan Semiconductor" />
        </FieldLabel>
      </Row>
      <Row $gap={10}>
        <FieldLabel>
          Sector
          <Input
            required
            list="xposure-sectors"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Semiconductors"
          />
          <datalist id="xposure-sectors">
            {meta?.sectors.map((option) => <option key={option} value={option} />)}
          </datalist>
        </FieldLabel>
        <FieldLabel>
          Asset class
          <Select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
            {ASSET_CLASSES.map((value) => (
              <option key={value} value={value}>
                {ASSET_CLASS_LABEL[value]}
              </option>
            ))}
          </Select>
        </FieldLabel>
      </Row>
      <FieldLabel>
        Description (optional)
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldLabel>
      <Row $gap={10}>
        <CheckLabel style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={addToPortfolio}
            onChange={(e) => setAddToPortfolio(e.target.checked)}
          />
          Hold it in {portfolioName}
        </CheckLabel>
        {addToPortfolio && (
          <FieldLabel style={{ flex: "0 0 92px" }}>
            Weight %
            <Input
              type="number"
              min={1}
              max={99}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            />
          </FieldLabel>
        )}
      </Row>
      {addToPortfolio && (
        <Muted>Other holdings are scaled down proportionally so weights still add to 100%.</Muted>
      )}
      <Button type="submit" disabled={!online || saving || !ticker || !name || !sector}>
        {saving ? <Spinner /> : "Add company"}
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {created && (
        <Stack $gap={8} aria-live="polite">
          <Body>
            Added {created.name}. It has no connections yet; draw one below or let
            the agent research them.
          </Body>
          <Button
            type="button"
            $variant="ghost"
            onClick={() =>
              openTool("agent", {
                instruction: `Add well-documented supplier, customer, demand and financing relationships between ${created.name} (${created.ticker}) and the companies already in the graph, especially holdings of ${portfolioName}.`,
              })
            }
          >
            Ask the agent to connect {created.ticker}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function ConnectionForm() {
  const { meta, refresh, online } = useExplorer();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [via, setVia] = useState("supply_chain");
  const [theme, setTheme] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      await api.createExposure({
        ticker: source,
        exposed_to_ticker: target,
        via,
        exposure_sector: theme,
        note,
      });
      setNote("");
      setDone(true);
      refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not add the connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack as="form" onSubmit={submit} $gap={10} aria-label="Add a connection">
      <Heading>Add a connection</Heading>
      <Muted>Read it as "From is exposed to To through this relationship".</Muted>
      <AssetSelect label="From" value={source} onChange={setSource} />
      <AssetSelect label="To" value={target} onChange={setTarget} />
      <Row $gap={10}>
        <FieldLabel>
          Relationship
          <Select value={via} onChange={(e) => setVia(e.target.value)}>
            {(meta?.via_values ?? Object.keys(VIA_LABEL)).map((value) => (
              <option key={value} value={value}>
                {VIA_LABEL[value] ?? value}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel>
          Shared theme
          <Input
            required
            list="xposure-sectors"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Semiconductors"
          />
        </FieldLabel>
      </Row>
      <FieldLabel>
        Why (one or two sentences)
        <TextArea required value={note} onChange={(e) => setNote(e.target.value)} />
      </FieldLabel>
      <Button
        type="submit"
        disabled={!online || saving || !source || !target || source === target || !theme || !note}
      >
        {saving ? <Spinner /> : "Add connection"}
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {done && <Muted aria-live="polite">Connection added to the graph.</Muted>}
    </Stack>
  );
}

export function AddPanel() {
  const { online } = useExplorer();
  return (
    <Stack $gap={16}>
      {!online && <ErrorText>Adding data needs the backend running.</ErrorText>}
      <CompanyForm />
      <Divider />
      <ConnectionForm />
    </Stack>
  );
}
