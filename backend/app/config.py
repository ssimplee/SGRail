"""Environment-based configuration for the Flask backend."""

import os


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

    # AI provider: "rule_based" | "openai" | "gemini" | "anthropic"
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
