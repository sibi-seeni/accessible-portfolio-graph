"""Tests for POST /portfolio/{id}/query.

Snowflake and ElevenLabs are mocked. No network access.
"""

import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import query, tts
from app.main import app
from app.narration import NarrationError

client = TestClient(app)


class NarrateRecorder:
    def __init__(self, answer: str = "Mocked spoken answer.") -> None:
        self.answer = answer
        self.calls: list[dict[str, Any]] = []

    def __call__(self, context: dict[str, Any], instruction: str) -> str:
        self.calls.append(context)
        return self.answer


class FakeTextToSpeech:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def convert(self, **kwargs: Any):
        self.calls.append(kwargs)
        return iter([b"ID3", b"mp3data"])


class FakeElevenLabsClient:
    def __init__(self) -> None:
        self.text_to_speech = FakeTextToSpeech()


@pytest.fixture
def narrate(monkeypatch: pytest.MonkeyPatch) -> NarrateRecorder:
    recorder = NarrateRecorder()
    monkeypatch.setattr(query, "_narrate", recorder)
    return recorder


@pytest.fixture
def audio_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> tuple[Path, FakeElevenLabsClient]:
    live_dir = tmp_path / "live"
    eleven = FakeElevenLabsClient()
    monkeypatch.setattr(tts, "LIVE_AUDIO_DIR", live_dir)
    monkeypatch.setattr(tts, "_build_client", lambda: eleven)
    monkeypatch.setattr(tts, "narration_voice_id", lambda: "narration-voice")
    return live_dir, eleven


def test_query_returns_answer_and_audio_url(
    narrate: NarrateRecorder, audio_env: tuple[Path, FakeElevenLabsClient]
) -> None:
    live_dir, eleven = audio_env
    response = client.post(
        "/portfolio/1/query", json={"question": "what do I own?"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "portfolio_summary"
    assert body["answer"] == "Mocked spoken answer."
    assert body["warning"] is None
    assert body["highlight_node_ids"]
    assert body["highlight_edge_ids"] == []
    assert re.fullmatch(r"/static/audio/live/[0-9a-f]{32}\.mp3", body["audio_url"])
    assert (live_dir / Path(body["audio_url"]).name).read_bytes() == b"ID3mp3data"
    assert eleven.text_to_speech.calls[0]["voice_id"] == "narration-voice"


def test_query_audio_filename_is_uuid_not_question_text(
    narrate: NarrateRecorder, audio_env: tuple[Path, FakeElevenLabsClient]
) -> None:
    response = client.post(
        "/portfolio/1/query",
        json={"question": "why do I have semiconductor exposure? secret-token"},
    )
    url = response.json()["audio_url"]
    assert "semiconductor" not in url
    assert "secret-token" not in url
    assert re.fullmatch(r"/static/audio/live/[0-9a-f]{32}\.mp3", url)


def test_unsupported_question_makes_no_api_calls(
    monkeypatch: pytest.MonkeyPatch, audio_env: tuple[Path, FakeElevenLabsClient]
) -> None:
    _, eleven = audio_env

    def explode(*args: Any, **kwargs: Any) -> str:
        raise AssertionError("Snowflake must not be called for unsupported questions")

    monkeypatch.setattr(query, "_narrate", explode)

    response = client.post(
        "/portfolio/1/query", json={"question": "what is the weather today?"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "unsupported"
    assert body["audio_url"] is None
    assert body["warning"] is None
    assert body["highlight_node_ids"] == []
    assert eleven.text_to_speech.calls == []


def test_tts_failure_returns_text_with_warning(
    narrate: NarrateRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        tts, "_build_client", lambda: (_ for _ in ()).throw(tts.TTSError("boom"))
    )

    response = client.post(
        "/portfolio/1/query", json={"question": "what is my biggest hidden risk?"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Mocked spoken answer."
    assert body["audio_url"] is None
    assert body["warning"]
    assert body["highlight_edge_ids"]


def test_snowflake_failure_returns_502(
    monkeypatch: pytest.MonkeyPatch, audio_env: tuple[Path, FakeElevenLabsClient]
) -> None:
    def fail(*args: Any, **kwargs: Any) -> str:
        raise NarrationError("primary: boom | fallback: boom")

    monkeypatch.setattr(query, "_narrate", fail)

    response = client.post(
        "/portfolio/1/query", json={"question": "what is my biggest hidden risk?"}
    )

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert "unavailable" in detail.lower()
    assert "boom" not in detail


def test_invalid_portfolio_returns_404(narrate: NarrateRecorder) -> None:
    response = client.post("/portfolio/999/query", json={"question": "what do I own?"})
    assert response.status_code == 404
    assert narrate.calls == []


def test_question_is_required() -> None:
    assert client.post("/portfolio/1/query", json={}).status_code == 422
