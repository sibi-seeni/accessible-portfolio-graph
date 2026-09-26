"""ElevenLabs text-to-speech for the Accessible Portfolio Explorer.

All ElevenLabs SDK usage is isolated in this module. Narration text is produced
elsewhere (app.narration); this module only turns text into MP3 files.
"""

from __future__ import annotations

from pathlib import Path

from elevenlabs.client import ElevenLabs

from app.config import get_settings

MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"


class TTSError(RuntimeError):
    """Raised when audio cannot be synthesized."""


def _build_client() -> ElevenLabs:
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise TTSError("ELEVENLABS_API_KEY is not set. Add it to your .env file.")
    return ElevenLabs(api_key=settings.elevenlabs_api_key)


def narration_voice_id() -> str:
    voice_id = get_settings().elevenlabs_narration_voice_id
    if not voice_id:
        raise TTSError(
            "ELEVENLABS_NARRATION_VOICE_ID is not set. Add it to your .env file."
        )
    return voice_id


def alert_voice_id() -> str:
    voice_id = get_settings().elevenlabs_alert_voice_id
    if not voice_id:
        raise TTSError(
            "ELEVENLABS_ALERT_VOICE_ID is not set. Add it to your .env file."
        )
    return voice_id


def text_to_speech(text: str, voice_id: str, output_path: Path) -> Path:
    """Synthesize `text` with `voice_id` and write an MP3 to `output_path`."""
    if not text or not text.strip():
        raise TTSError("Cannot synthesize empty narration text.")
    if not voice_id:
        raise TTSError("A voice_id is required to synthesize narration.")

    client = _build_client()
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        audio = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=MODEL_ID,
            output_format=OUTPUT_FORMAT,
        )
        with output_path.open("wb") as handle:
            for chunk in audio:
                if chunk:
                    handle.write(chunk)
    except TTSError:
        raise
    except Exception as exc:  # noqa: BLE001 - wrap SDK failures clearly
        raise TTSError(f"ElevenLabs synthesis failed: {exc}") from exc

    return output_path


def synthesize_holdings(text: str, output_path: Path) -> Path:
    """Synthesize holdings narration using the narration voice."""
    return text_to_speech(text, narration_voice_id(), output_path)


def synthesize_risk(text: str, output_path: Path) -> Path:
    """Synthesize risk narration using the alert voice."""
    return text_to_speech(text, alert_voice_id(), output_path)
