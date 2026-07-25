"""External integration adapters (OneMap, LTA, AI, Mock).

Defines Protocol interfaces for all external data providers and factory
functions that return the appropriate implementation based on app config.
"""

from __future__ import annotations

from typing import Protocol


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


def get_crowd_provider() -> CrowdProvider:
    """Return the configured CrowdProvider implementation."""
    from app.config import BaseConfig

    if BaseConfig.DATA_PROVIDER == "live":
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
    from app.config import BaseConfig

    if BaseConfig.DATA_PROVIDER == "live":
        if BaseConfig.ONEMAP_EMAIL and BaseConfig.ONEMAP_PASSWORD:
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
    from app.config import BaseConfig

    if BaseConfig.DATA_PROVIDER == "live" and BaseConfig.LTA_ACCOUNT_KEY:
        from app.integrations.lta_client import LTADataMallClient

        return LTADataMallClient()

    from app.integrations.mock_adapter import MockRailDataProvider

    return MockRailDataProvider()


def get_ai_provider() -> AIProvider:
    """Return the configured AIProvider implementation.

    Returns a configured LLM provider when AI_PROVIDER and AI_API_KEY
    are set. Falls back to the rule-based assistant otherwise.
    """
    from app.config import BaseConfig

    if BaseConfig.AI_API_KEY:
        if BaseConfig.AI_PROVIDER == "openai":
            from app.integrations.ai_client import OpenAIProvider

            return OpenAIProvider(api_key=BaseConfig.AI_API_KEY)

        if BaseConfig.AI_PROVIDER == "gemini":
            from app.integrations.ai_client import GeminiProvider

            return GeminiProvider(api_key=BaseConfig.AI_API_KEY)

        if BaseConfig.AI_PROVIDER == "anthropic":
            from app.integrations.ai_client import AnthropicProvider

            return AnthropicProvider(api_key=BaseConfig.AI_API_KEY)

    # Fall back to rule-based assistant (Requirement 24.1, 24.3)
    from app.services.ai_orchestrator import RuleBasedAssistant

    return RuleBasedAssistant()
