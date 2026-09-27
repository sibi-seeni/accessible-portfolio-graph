import * as Tone from "tone";
import {
  NODE_TONE_DURATION_SEC,
  SECTOR_NOTES,
  positionToPan,
} from "../config/sonificationConfig";

let synth: Tone.Synth | null = null;
let panner: Tone.Panner | null = null;

function getVoice(): { synth: Tone.Synth; panner: Tone.Panner } {
  if (!synth || !panner) {
    panner = new Tone.Panner(0).toDestination();
    synth = new Tone.Synth().connect(panner);
  }
  return { synth, panner };
}

export async function playNodeTone(
  sectorName: string,
  x: number,
  canvasWidth: number
): Promise<void> {
  const note = SECTOR_NOTES[sectorName];
  if (!note) {
    console.warn(
      `No sonification note mapped for sector "${sectorName}" — skipping.`
    );
    return;
  }

  try {
    await Tone.start();
  } catch {
    // ignore audio-context unlock failures
  }

  const voice = getVoice();
  voice.panner.pan.value = positionToPan(x, canvasWidth);
  voice.synth.triggerAttackRelease(note, NODE_TONE_DURATION_SEC);
}
