"""External integration adapters (OneMap, LTA, AI, Mock).

Defines Protocol interfaces for all external data providers and factory
functions that return the appropriate implementation based on app config.
"""

from __future__ import annotations

import threading
from typing import Protocol

from flask import current_app, has_app_context


class CrowdProvider(Protocol):
    """Interface for crowd-level data providers."""

    def get_station_crowd(self, station_id: str) -> dict:
        """Return crowd reading for a single station."""
        ...

    def get_all_crowd(self) -> list[dict]:
        """Return crowd readings for all stations."""
        ...


class LocationProvider(Protocol):
    """Interface for geolocation / mapping providers (e.g. OneMap)."""

    def search_address(self, query: str) -> list[dict]:
        """Search for addresses matching query string."""
        ...

    def reverse_geocode(self, lat: float, lng: float) -> dict | None:
        """Return address info for a coordinate pair."""
        ...

    def get_walking_route(self, origin: tuple, dest: tuple) -> dict:
        """Return walking route between two (lat, lng) tuples."""
        ...

    def get_nearby_transport(self, lat: float, lng: float) -> list[dict]:
        """Return nearby transport stops for a coordinate."""
        ...


class RailDataProvider(Protocol):
    """Interface for rail/transit open-data providers (e.g. LTA DataMall)."""

    def get_service_alerts(self) -> list[dict]:
        """Return current MRT/LRT service alerts."""
        ...

    def get_passenger_volume(self, station_id: str) -> dict | None:
        """Return passenger volume data for a station."""
        ...

    def get_station_reference(self) -> list[dict]:
        """Return official station reference list."""
        ...


class AIProvider(Protocol):
    """Interface for AI assistant backend providers."""

    def chat(self, message: str, context: dict) -> dict:
        """Process a user chat message and return AI response."""
        ...


# ---------------------------------------------------------------------------
# Factory functions
# ---------------------------------------------------------------------------


def _config_value(name: str, default=None):
    """Read config from the active Flask app, falling back to BaseConfig."""
    if has_app_context():
        return current_app.config.get(name, default)

    from app.config import BaseConfig

    return getattr(BaseConfig, name, default)


def get_crowd_provider() -> CrowdProvider:
    """Return the configured CrowdProvider implementation."""
    if _config_value("DATA_PROVIDER") == "live":
        # Future: return LTACrowdClient()
        pass

    from app.integrations.mock_adapter import MockCrowdProvider

    return MockCrowdProvider()


def get_location_provider() -> LocationProvider:
    """Return the configured LocationProvider implementation.

    Returns OneMapClient when DATA_PROVIDER is "live" and OneMap
    credentials (ONEMAP_EMAIL, ONEMAP_PASSWORD) are configured.
    Falls back to MockLocationProvider otherwise.
    """
    if _config_value("DATA_PROVIDER") == "live":
        if _config_value("ONEMAP_EMAIL") and _config_value("ONEMAP_PASSWORD"):
            from app.integrations.onemap_client import OneMapClient

            return OneMapClient()

    from app.integrations.mock_adapter import MockLocationProvider

    return MockLocationProvider()


def get_rail_data_provider() -> RailDataProvider:
    """Return the configured RailDataProvider implementation.

    Returns LTADataMallClient when DATA_PROVIDER is "live" and
    LTA_ACCOUNT_KEY is configured.  Falls back to MockRailDataProvider
    otherwise.
    """
    if _config_value("DATA_PROVIDER") == "live" and _config_value("LTA_ACCOUNT_KEY"):
        from app.integrations.lta_client import LTADataMallClient

        return LTADataMallClient()

    from app.integrations.mock_adapter import MockRailDataProvider

    return MockRailDataProvider()


def _build_llm_provider() -> AIProvider | None:
    """Construct the configured paid LLM provider, or None if unset."""
    ai_provider = _config_value("AI_PROVIDER")
    ai_api_key = _config_value("AI_API_KEY")

    if ai_provider == "openai":
        from app.integrations.ai_client import OpenAIProvider

        return OpenAIProvider(api_key=ai_api_key)

    if ai_provider == "gemini":
        from app.integrations.ai_client import GeminiProvider

        return GeminiProvider(api_key=ai_api_key)

    if ai_provider == "groq":
        from app.integrations.ai_client import GroqProvider

        return GroqProvider(api_key=ai_api_key)

    if ai_provider == "anthropic":
        from app.integrations.ai_client import AnthropicProvider

        return AnthropicProvider(api_key=ai_api_key)

    return None


# Lazily-built singleton so HybridProvider's cache and daily call counter
# persist across requests instead of resetting on every call. See AIPLAN.md.
_hybrid_provider: AIProvider | None = None
_hybrid_provider_lock = threading.Lock()


def get_ai_provider() -> AIProvider:
    """Return the configured AIProvider implementation.

    Returns a HybridProvider-wrapped LLM provider when AI_PROVIDER and
    AI_API_KEY are set (classify-first routing + cache + daily cap on top
    of the paid provider). Falls back to the rule-based assistant otherwise.
    """
    if _config_value("AI_API_KEY"):
        global _hybrid_provider
        if _hybrid_provider is None:
            with _hybrid_provider_lock:
                if _hybrid_provider is None:
                    inner = _build_llm_provider()
                    if inner is not None:
                        from app.integrations.ai_client import HybridProvider

                        _hybrid_provider = HybridProvider(inner)
        if _hybrid_provider is not None:
            return _hybrid_provider

    # Fall back to rule-based assistant (Requirement 24.1, 24.3)
    from app.services.ai_orchestrator import RuleBasedAssistant

    return RuleBasedAssistant()
