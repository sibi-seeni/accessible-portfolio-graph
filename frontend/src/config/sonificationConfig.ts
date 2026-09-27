// Integrated audio-visual sonification config.
// Sector identity is carried by a fixed per-sector pitch (note); horizontal node
// position is carried by stereo pan (see positionToPan). See frontend AGENTS.md.

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

export const NODE_TONE_DURATION_SEC = 0.35;

export function positionToPan(x: number, canvasWidth: number): number {
  const t = Math.max(0, Math.min(1, x / canvasWidth)); // clamp 0-1
  return t * 2 - 1; // map to -1 (hard left) .. 1 (hard right)
}
