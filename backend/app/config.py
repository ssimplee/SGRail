"""Environment-based configuration for the Flask backend."""

import os

from dotenv import load_dotenv

# Must run before any os.getenv() calls below. Loading .env here (rather
# than only in create_app()) guarantees it happens before this module's
# class attributes are evaluated at import time, regardless of import
# order or Werkzeug reloader subprocess timing.
load_dotenv()


class BaseConfig:
    """Base configuration shared across all environments."""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///mrt_app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # Data provider: "mock" | "live"
    DATA_PROVIDER = os.getenv("DATA_PROVIDER", "mock")

    # OneMap integration
    ONEMAP_EMAIL = os.getenv("ONEMAP_EMAIL", "")
    ONEMAP_PASSWORD = os.getenv("ONEMAP_PASSWORD", "")

    # LTA DataMall integration
    LTA_ACCOUNT_KEY = os.getenv("LTA_ACCOUNT_KEY", "")

    # AI provider: "rule_based" | "openai" | "gemini" | "anthropic" | "groq"
    AI_PROVIDER = os.getenv("AI_PROVIDER", "rule_based")
    AI_API_KEY = os.getenv("AI_API_KEY", "")

    # Upload settings
    UPLOAD_PROVIDER = os.getenv("UPLOAD_PROVIDER", "local")
    UPLOAD_MAX_MB = int(os.getenv("UPLOAD_MAX_MB", "5"))
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
    )

    # Rate limiting
    RATE_LIMIT_INCIDENTS = os.getenv("RATE_LIMIT_INCIDENTS", "10/hour")
    RATE_LIMIT_AI = os.getenv("RATE_LIMIT_AI", "30/hour")

    # AI cost control (see AIPLAN.md)
    # Max paid LLM calls per day before HybridProvider forces the free
    # rule-based path for every request (hard backstop against runaway cost).
    # 900 keeps a safety margin under Groq's free-tier request quota (1,000
    # requests / 12,000 tokens per rolling window, confirmed via the
    # x-ratelimit-* response headers) so our own cap binds first.
    AI_DAILY_CALL_CAP = int(os.getenv("AI_DAILY_CALL_CAP", "900"))
    # How long a cached LLM response may be reused for an identical message.
    AI_CACHE_TTL_SECONDS = int(os.getenv("AI_CACHE_TTL_SECONDS", "900"))


class DevelopmentConfig(BaseConfig):
    """Development configuration."""

    DEBUG = True
    SQLALCHEMY_ECHO = True


class TestingConfig(BaseConfig):
    """Testing configuration."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATE_LIMIT_INCIDENTS = "1000/hour"
    RATE_LIMIT_AI = "1000/hour"


class ProductionConfig(BaseConfig):
    """Production configuration."""

    DEBUG = False
    SQLALCHEMY_ECHO = False


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
