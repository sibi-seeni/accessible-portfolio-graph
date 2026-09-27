import { useEffect, useRef } from "react";
import * as Tone from "tone";
import type { GraphNode } from "./usePortfolioData";
import {
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  NOTE_DURATION_SEC,
  NOTE_GAP_SEC,
  SECTOR_NOTES,
} from "../config/sonificationConfig";

export interface SonifiablePortfolio {
  id: number;
  holdings: GraphNode[];
}

interface SectorTotal {
  sectorName: string;
  totalWeight: number;
}

const STEP_MS = (NOTE_DURATION_SEC + NOTE_GAP_SEC) * 1000;
const WEIGHT_PERCENT_MAX = 50;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function gainForWeight(totalWeight: number): number {
  const weightPercent = totalWeight * 100;
  const clamped = Math.min(Math.max(weightPercent, 0), WEIGHT_PERCENT_MAX);
  const ratio = clamped / WEIGHT_PERCENT_MAX;
  return MIN_GAIN_DB + ratio * (MAX_GAIN_DB - MIN_GAIN_DB);
}

function groupBySector(holdings: GraphNode[]): SectorTotal[] {
  const totals = new Map<string, number>();

  holdings.forEach((holding) => {
    if (!holding.sector) return;
    totals.set(
      holding.sector,
      (totals.get(holding.sector) ?? 0) + (holding.weight ?? 0)
    );
  });

  return Array.from(totals, ([sectorName, totalWeight]) => ({
    sectorName,
    totalWeight,
  })).sort((a, b) => b.totalWeight - a.totalWeight);
}

export function useSonification(
  portfolio: SonifiablePortfolio,
  enabled: boolean
) {
  const synthRef = useRef<Tone.Synth | null>(null);
  const isCancelledRef = useRef(false);
  const runIdRef = useRef(0);

  const getSynth = (): Tone.Synth => {
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth().toDestination();
    }
    return synthRef.current;
  };

  const playSectorSequence = async (): Promise<void> => {
    if (!enabled) return;

    const synth = getSynth();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    isCancelledRef.current = false;

    const ordered = groupBySector(portfolio.holdings);

    for (const { sectorName, totalWeight } of ordered) {
      if (isCancelledRef.current || runIdRef.current !== runId) return;

      const note = SECTOR_NOTES[sectorName];
      if (!note) {
        console.warn(
          `No sonification note mapped for sector "${sectorName}" — skipping.`
        );
        continue;
      }

      synth.volume.value = gainForWeight(totalWeight);
      synth.triggerAttackRelease(note, NOTE_DURATION_SEC);
      await delay(STEP_MS);
    }
  };

  const playAlertChime = async (): Promise<void> => {
    if (!enabled) return;

    const synth = getSynth();
    const now = Tone.now();
    synth.volume.value = MAX_GAIN_DB;
    synth.triggerAttackRelease("C5", 0.15, now);
    synth.triggerAttackRelease("E5", 0.15, now + 0.15);
    await delay(300);
  };

  useEffect(() => {
    isCancelledRef.current = true;
    if (enabled) {
      void playSectorSequence();
    }
    return () => {
      isCancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.id, enabled]);

  return { playSectorSequence, playAlertChime };
}
