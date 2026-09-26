"""Tests for the audio generation script.

Snowflake narration, the database, and ElevenLabs synthesis are all mocked.
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import generate_audio as ga


class FakeSession:
    def __enter__(self) -> "FakeSession":
        return self

    def __exit__(self, *args: object) -> bool:
        return False


@pytest.fixture
def audio_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> dict[str, list]:
    audio_dir = tmp_path / "audio"
    manifest_path = audio_dir / "manifest.json"
    monkeypatch.setattr(ga, "AUDIO_DIR", audio_dir)
    monkeypatch.setattr(ga, "MANIFEST_PATH", manifest_path)

    calls: dict[str, list] = {"holdings": [], "risk": []}

    monkeypatch.setattr(
        ga, "generate_holdings_narration", lambda pid: f"holdings text {pid}"
    )
    monkeypatch.setattr(
        ga, "generate_risk_narration", lambda pid, insight: f"risk text {pid}"
    )
    monkeypatch.setattr(
        ga, "get_portfolio_insight", lambda session, pid: SimpleNamespace(id=pid)
    )
    monkeypatch.setattr(ga, "SessionLocal", FakeSession)

    def fake_holdings(text: str, path: Path) -> Path:
        calls["holdings"].append((text, path.name))
        path.write_bytes(b"holdings-mp3")
        return path

    def fake_risk(text: str, path: Path) -> Path:
        calls["risk"].append((text, path.name))
        path.write_bytes(b"risk-mp3")
        return path

    monkeypatch.setattr(ga, "synthesize_holdings", fake_holdings)
    monkeypatch.setattr(ga, "synthesize_risk", fake_risk)
    return calls


def _run(argv: list[str]) -> None:
    sys.argv = ["generate_audio", *argv]
    ga.main()


def test_generates_all_files_and_manifest(
    audio_env: dict[str, list], monkeypatch: pytest.MonkeyPatch
) -> None:
    _run([])

    manifest = json.loads(ga.MANIFEST_PATH.read_text())
    assert set(manifest) == {"1", "2", "3"}

    for portfolio_id in (1, 2, 3):
        entry = manifest[str(portfolio_id)]
        assert entry["holdings_text"] == f"holdings text {portfolio_id}"
        assert entry["risk_text"] == f"risk text {portfolio_id}"
        assert entry["holdings_file"] == f"portfolio_{portfolio_id}_holdings.mp3"
        assert entry["risk_file"] == f"portfolio_{portfolio_id}_risk.mp3"
        assert (ga.AUDIO_DIR / entry["holdings_file"]).read_bytes() == b"holdings-mp3"
        assert (ga.AUDIO_DIR / entry["risk_file"]).read_bytes() == b"risk-mp3"

    assert len(audio_env["holdings"]) == 3
    assert len(audio_env["risk"]) == 3


def test_skips_existing_files_without_force(audio_env: dict[str, list]) -> None:
    _run([])
    audio_env["holdings"].clear()
    audio_env["risk"].clear()

    _run([])

    assert audio_env["holdings"] == []
    assert audio_env["risk"] == []
    assert ga.MANIFEST_PATH.exists()


def test_force_regenerates(audio_env: dict[str, list]) -> None:
    _run([])
    audio_env["holdings"].clear()
    audio_env["risk"].clear()

    _run(["--force"])

    assert len(audio_env["holdings"]) == 3
    assert len(audio_env["risk"]) == 3
