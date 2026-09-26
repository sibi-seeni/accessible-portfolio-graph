from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str | None = None

    snowflake_account_url: str | None = None
    snowflake_pat: str | None = None
    snowflake_model: str = "openai-gpt-5.4"
    snowflake_fallback_model: str = "openai-gpt-5-mini"

    elevenlabs_api_key: str | None = None
    elevenlabs_narration_voice_id: str | None = None
    elevenlabs_alert_voice_id: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
