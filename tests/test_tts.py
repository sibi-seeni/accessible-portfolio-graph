"""Unit tests for ElevenLabs TTS. The SDK client is fully mocked."""

from pathlib import Path

import pytest

from app import tts
from app.config import Settings
from app.tts import (
    TTSError,
    alert_voice_id,
    narration_voice_id,
    synthesize_holdings,
    synthesize_risk,
    text_to_speech,
)


class FakeTextToSpeech:
    def __init__(self, owner: "FakeClient") -> None:
        self._owner = owner

    def convert(self, **kwargs):
        self._owner.calls.append(kwargs)
        if self._owner.error is not None:
            raise self._owner.error
        return iter(self._owner.chunks)


class FakeClient:
    def __init__(self, chunks=(b"ID3", b"mp3data"), error: Exception | None = None):
        self.calls: list[dict] = []
        self.chunks = list(chunks)
        self.error = error
        self.text_to_speech = FakeTextToSpeech(self)


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> FakeClient:
    client = FakeClient()
    monkeypatch.setattr(tts, "_build_client", lambda: client)
    return client


def test_text_to_speech_writes_file_and_creates_dirs(
    tmp_path: Path, fake_client: FakeClient
) -> None:
    output = tmp_path / "nested" / "out.mp3"
    result = text_to_speech("Hello there.", "voice-1", output)

    assert result == output
    assert output.read_bytes() == b"ID3mp3data"
    assert output.parent.is_dir()


def test_text_to_speech_calls_convert_with_expected_args(
    tmp_path: Path, fake_client: FakeClient
) -> None:
    text_to_speech("Hello there.", "voice-1", tmp_path / "out.mp3")
    call = fake_client.calls[0]
    assert call["voice_id"] == "voice-1"
    assert call["text"] == "Hello there."
    assert call["output_format"] == "mp3_44100_128"
    assert call["model_id"] == tts.MODEL_ID


def test_text_to_speech_rejects_empty_text(
    tmp_path: Path, fake_client: FakeClient
) -> None:
    with pytest.raises(TTSError, match="empty narration"):
        text_to_speech("   ", "voice-1", tmp_path / "out.mp3")


def test_text_to_speech_rejects_empty_voice(
    tmp_path: Path, fake_client: FakeClient
) -> None:
    with pytest.raises(TTSError, match="voice_id is required"):
        text_to_speech("Hello.", "", tmp_path / "out.mp3")


def test_text_to_speech_wraps_sdk_errors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = FakeClient(error=RuntimeError("quota exceeded"))
    monkeypatch.setattr(tts, "_build_client", lambda: client)
    with pytest.raises(TTSError, match="quota exceeded"):
        text_to_speech("Hello.", "voice-1", tmp_path / "out.mp3")


def test_missing_api_key_fails_clearly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tts, "get_settings", lambda: Settings(elevenlabs_api_key=None)
    )
    with pytest.raises(TTSError, match="ELEVENLABS_API_KEY"):
        tts._build_client()


def test_missing_voice_ids_fail_clearly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tts,
        "get_settings",
        lambda: Settings(
            elevenlabs_narration_voice_id=None, elevenlabs_alert_voice_id=None
        ),
    )
    with pytest.raises(TTSError, match="ELEVENLABS_NARRATION_VOICE_ID"):
        narration_voice_id()
    with pytest.raises(TTSError, match="ELEVENLABS_ALERT_VOICE_ID"):
        alert_voice_id()


def test_wrappers_use_configured_voices(
    tmp_path: Path, fake_client: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        tts,
        "get_settings",
        lambda: Settings(
            elevenlabs_api_key="key",
            elevenlabs_narration_voice_id="narration-voice",
            elevenlabs_alert_voice_id="alert-voice",
        ),
    )

    synthesize_holdings("holdings text", tmp_path / "holdings.mp3")
    synthesize_risk("risk text", tmp_path / "risk.mp3")

    assert [call["voice_id"] for call in fake_client.calls] == [
        "narration-voice",
        "alert-voice",
    ]
