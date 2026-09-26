"""Tests for GET /portfolio/{id}/audio.

These tests never call Snowflake or ElevenLabs. Manifest and MP3 fixtures are
written to a temporary directory; the real generated demo audio is only read,
never modified.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import audio
from app.main import app

client = TestClient(app)


@pytest.fixture
def temp_audio(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    audio_dir = tmp_path / "audio"
    audio_dir.mkdir()
    monkeypatch.setattr(audio, "AUDIO_DIR", audio_dir)
    monkeypatch.setattr(audio, "MANIFEST_PATH", audio_dir / "manifest.json")
    return audio_dir


def _write_portfolio(audio_dir: Path, portfolio_id: int) -> dict[str, str]:
    entry = {
        "holdings_text": f"Holdings transcript for {portfolio_id}.",
        "risk_text": f"Risk transcript for {portfolio_id}.",
        "holdings_file": f"portfolio_{portfolio_id}_holdings.mp3",
        "risk_file": f"portfolio_{portfolio_id}_risk.mp3",
    }
    manifest_path = audio_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest[str(portfolio_id)] = entry
    manifest_path.write_text(json.dumps(manifest))
    (audio_dir / entry["holdings_file"]).write_bytes(b"holdings-mp3")
    (audio_dir / entry["risk_file"]).write_bytes(b"risk-mp3")
    return entry


def test_get_audio_returns_200(temp_audio: Path) -> None:
    _write_portfolio(temp_audio, 1)
    response = client.get("/portfolio/1/audio")
    assert response.status_code == 200


def test_get_audio_response_shape(temp_audio: Path) -> None:
    _write_portfolio(temp_audio, 1)
    body = client.get("/portfolio/1/audio").json()

    assert body["portfolio_id"] == 1
    for section in ("holdings", "risk"):
        assert set(body[section]) == {"url", "transcript"}
        assert body[section]["transcript"]
        assert body[section]["url"]


def test_audio_urls_point_to_static_audio(temp_audio: Path) -> None:
    _write_portfolio(temp_audio, 2)
    body = client.get("/portfolio/2/audio").json()

    assert body["holdings"]["url"] == "/static/audio/portfolio_2_holdings.mp3"
    assert body["risk"]["url"] == "/static/audio/portfolio_2_risk.mp3"
    for section in ("holdings", "risk"):
        assert not body[section]["url"].startswith("/Users/")
        assert body[section]["url"].startswith("/static/audio/")


def test_transcripts_match_manifest(temp_audio: Path) -> None:
    entry = _write_portfolio(temp_audio, 1)
    body = client.get("/portfolio/1/audio").json()
    assert body["holdings"]["transcript"] == entry["holdings_text"]
    assert body["risk"]["transcript"] == entry["risk_text"]


def test_unknown_portfolio_returns_404() -> None:
    assert client.get("/portfolio/999/audio").status_code == 404


def test_missing_manifest_returns_503(temp_audio: Path) -> None:
    response = client.get("/portfolio/1/audio")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_missing_manifest_entry_returns_503(temp_audio: Path) -> None:
    _write_portfolio(temp_audio, 1)
    response = client.get("/portfolio/2/audio")
    assert response.status_code == 503
    assert "portfolio 2" in response.json()["detail"]


def test_missing_audio_file_returns_503(temp_audio: Path) -> None:
    entry = _write_portfolio(temp_audio, 1)
    (temp_audio / entry["risk_file"]).unlink()

    response = client.get("/portfolio/1/audio")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_invalid_manifest_filename_returns_503(temp_audio: Path) -> None:
    _write_portfolio(temp_audio, 1)
    manifest_path = temp_audio / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["1"]["holdings_file"] = "../secret.mp3"
    manifest_path.write_text(json.dumps(manifest))

    assert client.get("/portfolio/1/audio").status_code == 503


@pytest.mark.skipif(
    not (audio.AUDIO_DIR / "portfolio_1_holdings.mp3").is_file(),
    reason="pre-generated demo audio is not present",
)
def test_static_serves_returned_mp3_url() -> None:
    body = client.get("/portfolio/1/audio").json()
    response = client.get(body["holdings"]["url"])
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/mpeg")
    assert response.content
