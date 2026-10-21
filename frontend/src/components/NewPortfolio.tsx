import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { Button, ErrorText, Input, Row, Stack } from "./ui/primitives";

export function NewPortfolio({
  onCreated,
  disabled,
}: {
  onCreated: (id: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const portfolio = await api.createPortfolio(name.trim());
      setName("");
      setOpen(false);
      setError(null);
      onCreated(portfolio.id);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "Could not create the portfolio.");
    }
  };

  if (!open) {
    return (
      <Button type="button" $variant="ghost" $small disabled={disabled} onClick={() => setOpen(true)}>
        + New portfolio
      </Button>
    );
  }

  return (
    <Stack as="form" onSubmit={submit} $gap={6} aria-label="New portfolio">
      <Row $gap={6}>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Portfolio name"
          aria-label="Portfolio name"
        />
        <Button type="submit" $small disabled={!name.trim()}>
          Create
        </Button>
      </Row>
      <Button type="button" $variant="ghost" $small onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </Stack>
  );
}
