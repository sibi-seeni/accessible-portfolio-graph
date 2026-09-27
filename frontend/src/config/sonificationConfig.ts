// Locked sonification tuning. Pitch is keyed to sector name so a sector keeps the
// same note across all 3 demo portfolios. See frontend AGENTS.md — do not add a
// distinct sound per `via` exposure type.

export const SECTOR_NOTES: Record<string, string> = {
  Automotive: "C3",
  "Digital Infrastructure": "D3",
  Energy: "E3",
  "Energy Infrastructure": "F3",
  Financials: "G3",
  Homebuilding: "A3",
  Industrials: "B3",
  "Materials & Mining": "C4",
  "Real Estate Credit": "D4",
  "Residential Real Estate": "E4",
  Semiconductors: "F4",
  Software: "G4",
  Utilities: "A4",
};

export const MIN_GAIN_DB = -24;
export const MAX_GAIN_DB = -6;
export const NOTE_DURATION_SEC = 0.4;
export const NOTE_GAP_SEC = 0.15;
