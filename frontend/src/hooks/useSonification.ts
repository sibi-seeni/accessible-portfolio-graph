import { useRef } from "react";
import * as Tone from "tone";

const ALERT_CHIME_GAIN_DB = -6;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function useSonification() {
  const synthRef = useRef<Tone.Synth | null>(null);

  const getSynth = (): Tone.Synth => {
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth().toDestination();
    }
    return synthRef.current;
  };

  const playAlertChime = async (): Promise<void> => {
    const synth = getSynth();
    const now = Tone.now();
    synth.volume.value = ALERT_CHIME_GAIN_DB;
    synth.triggerAttackRelease("C5", 0.15, now);
    synth.triggerAttackRelease("E5", 0.15, now + 0.15);
    await delay(300);
  };

  return { playAlertChime };
}
