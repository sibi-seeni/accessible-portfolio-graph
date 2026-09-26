"""Lookup for pre-generated portfolio audio.

Reads static/audio/manifest.json and verifies the referenced MP3 files exist.
This module never calls Snowflake or ElevenLabs and never regenerates audio.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.schemas import AudioItem, PortfolioAudioResponse

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
AUDIO_DIR = STATIC_DIR / "audio"
MANIFEST_PATH = AUDIO_DIR / "manifest.json"
STATIC_AUDIO_URL = "/static/audio"


class AudioUnavailableError(RuntimeError):
    """Raised when pre-generated audio cannot be served."""


def _load_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.is_file():
        raise AudioUnavailableError(
            "Pre-generated audio is unavailable: manifest.json is missing."
        )
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AudioUnavailableError(
            "Pre-generated audio is unavailable: manifest.json could not be read."
        ) from exc


def _audio_item(entry: dict[str, Any], text_key: str, file_key: str) -> AudioItem:
    filename = entry.get(file_key)
    transcript = entry.get(text_key)
    if not filename or not transcript:
        raise AudioUnavailableError(
            "Pre-generated audio is unavailable: manifest entry is incomplete."
        )
    if Path(filename).name != filename:
        raise AudioUnavailableError(
            "Pre-generated audio is unavailable: invalid audio filename."
        )
    if not (AUDIO_DIR / filename).is_file():
        raise AudioUnavailableError(
            f"Pre-generated audio is unavailable: {filename} is missing."
        )
    return AudioItem(url=f"{STATIC_AUDIO_URL}/{filename}", transcript=transcript)


def get_portfolio_audio(portfolio_id: int) -> PortfolioAudioResponse:
    """Return pre-generated holdings and risk audio metadata for a portfolio."""
    manifest = _load_manifest()
    entry = manifest.get(str(portfolio_id))
    if not isinstance(entry, dict):
        raise AudioUnavailableError(
            f"Pre-generated audio is unavailable for portfolio {portfolio_id}."
        )
    return PortfolioAudioResponse(
        portfolio_id=portfolio_id,
        holdings=_audio_item(entry, "holdings_text", "holdings_file"),
        risk=_audio_item(entry, "risk_text", "risk_file"),
    )
