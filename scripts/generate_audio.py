"""Pre-generate narration MP3 files and a manifest for the 3 demo portfolios.

For each portfolio this generates a holdings narration and a risk narration via
Snowflake Cortex, synthesizes both with ElevenLabs, and writes:

    static/audio/portfolio_<id>_holdings.mp3
    static/audio/portfolio_<id>_risk.mp3

Narration text and file names are recorded in static/audio/manifest.json.
Existing MP3 files are reused unless --force is supplied.

Run with:

    .venv/bin/python scripts/generate_audio.py [--force]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.db import SessionLocal
from app.insight import get_portfolio_insight
from app.narration import generate_holdings_narration, generate_risk_narration
from app.tts import synthesize_holdings, synthesize_risk

AUDIO_DIR = Path(__file__).resolve().parents[1] / "static" / "audio"
MANIFEST_PATH = AUDIO_DIR / "manifest.json"
PORTFOLIO_IDS = (1, 2, 3)


def _load_manifest() -> dict[str, dict[str, str]]:
    if not MANIFEST_PATH.exists():
        return {}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def _save_manifest(manifest: dict[str, dict[str, str]]) -> None:
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _generate_entry(
    portfolio_id: int, manifest: dict[str, dict[str, str]], force: bool
) -> dict[str, str]:
    holdings_path = AUDIO_DIR / f"portfolio_{portfolio_id}_holdings.mp3"
    risk_path = AUDIO_DIR / f"portfolio_{portfolio_id}_risk.mp3"
    key = str(portfolio_id)

    if (
        not force
        and key in manifest
        and holdings_path.exists()
        and risk_path.exists()
    ):
        print(f"Portfolio {portfolio_id}: audio already exists, skipping.")
        return manifest[key]

    print(f"Portfolio {portfolio_id}: generating holdings narration...")
    holdings_text = generate_holdings_narration(portfolio_id)

    print(f"Portfolio {portfolio_id}: generating risk narration...")
    with SessionLocal() as session:
        insight = get_portfolio_insight(session, portfolio_id)
    if insight is None:
        raise SystemExit(f"Portfolio {portfolio_id} was not found.")
    risk_text = generate_risk_narration(portfolio_id, insight)

    if force or not holdings_path.exists():
        print(f"Portfolio {portfolio_id}: synthesizing holdings audio...")
        synthesize_holdings(holdings_text, holdings_path)
    else:
        print(f"Portfolio {portfolio_id}: keeping existing holdings audio.")

    if force or not risk_path.exists():
        print(f"Portfolio {portfolio_id}: synthesizing risk audio...")
        synthesize_risk(risk_text, risk_path)
    else:
        print(f"Portfolio {portfolio_id}: keeping existing risk audio.")

    return {
        "holdings_text": holdings_text,
        "risk_text": risk_text,
        "holdings_file": holdings_path.name,
        "risk_file": risk_path.name,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate MP3 files even if they already exist.",
    )
    args = parser.parse_args()

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = _load_manifest()

    for portfolio_id in PORTFOLIO_IDS:
        manifest[str(portfolio_id)] = _generate_entry(
            portfolio_id, manifest, args.force
        )
        _save_manifest(manifest)

    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
