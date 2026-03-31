from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_mock: bool = False
    openai_proxy_url: str | None = None

    make_webhook_url: str | None = None
    admin_dashboard_base_url: str = "http://localhost:3000"
    admin_api_token: str | None = None

    allowed_origins: str = ""

    db_enabled: bool = False
    db_host: str | None = None
    db_port: int = 3306
    db_user: str | None = None
    db_password: str | None = None
    db_name: str | None = None
    db_table_prefix: str = "bai_"
    db_auto_create_tables: bool = True

    @field_validator("openai_api_key", "openai_model", "make_webhook_url", "admin_dashboard_base_url", "admin_api_token", "allowed_origins", mode="before")
    @classmethod
    def _strip_strings(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("openai_mock", "db_enabled", "db_auto_create_tables", mode="before")
    @classmethod
    def _strip_bools(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


settings = Settings()
