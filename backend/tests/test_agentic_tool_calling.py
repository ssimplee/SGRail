"""Tests for the OpenAI-compatible tool-calling loop.

Stubs requests.post so no real network calls are made — covers the
call -> tool_calls -> execute -> re-call -> final-answer path, the
routeResults attachment, and the max-iteration safety valve.

Validates: AIPLAN.md, "Agentic tool-calling" (phase 12).
"""

import json
from unittest.mock import MagicMock, patch

from app.integrations.ai_client import (
    MAX_TOOL_ITERATIONS,
    OpenAIProvider,
    _openai_compatible_chat,
)


def _mock_response(payload: dict) -> MagicMock:
    """Build a fake requests.Response returning the given JSON body."""
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = payload
    return resp


def _tool_call_response(name: str, arguments: dict, call_id: str = "call_1") -> dict:
    """A Chat Completions response requesting one tool call."""
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": json.dumps(arguments),
                            },
                        }
                    ],
                }
            }
        ]
    }


def _final_response(reply_dict: dict) -> dict:
    """A Chat Completions response with a final plain-text (JSON envelope) answer."""
    return {
        "choices": [{"message": {"role": "assistant", "content": json.dumps(reply_dict)}}]
    }


class TestToolCallingLoop:
    def test_executes_tool_call_and_returns_final_answer(self, app):
        """Model requests plan_route, gets a real result, then answers."""
        with app.app_context():
            tool_request = _tool_call_response(
                "plan_route", {"origin": "Bishan", "destination": "Jurong East"}
            )
            final = _final_response(
                {
                    "reply": "Here's your route.",
                    "intent": "ROUTE",
                    "stationIds": ["bishan", "jurong-east"],
                    "lineCodes": ["NS"],
                }
            )

            with patch("app.integrations.ai_client.requests.post") as mock_post:
                mock_post.side_effect = [
                    _mock_response(tool_request),
                    _mock_response(final),
                ]

                result = _openai_compatible_chat(
                    "https://example.test/chat", "test-model", "fake-key",
                    "plan a route from Bishan to Jurong East", {},
                )

            assert mock_post.call_count == 2
            assert result["reply"] == "Here's your route."
            # The real computed route is attached programmatically, not
            # trusted from the model's own transcription.
            assert result["routeResults"] is not None
            assert len(result["routeResults"]) > 0
            assert result["routeResults"][0]["totalMinutes"] > 0

    def test_no_tool_call_returns_final_answer_directly(self, app):
        """A model that answers immediately (no tool_calls) works in one round trip."""
        with app.app_context():
            final = _final_response(
                {"reply": "I can help with MRT questions.", "intent": "OUT_OF_SCOPE"}
            )

            with patch("app.integrations.ai_client.requests.post") as mock_post:
                mock_post.return_value = _mock_response(final)

                result = _openai_compatible_chat(
                    "https://example.test/chat", "test-model", "fake-key", "hello", {}
                )

            assert mock_post.call_count == 1
            assert result["reply"] == "I can help with MRT questions."
            assert "routeResults" not in result

    def test_unknown_tool_name_reports_error_without_crashing(self, app):
        """A hallucinated/unknown tool name degrades to an error the model sees."""
        with app.app_context():
            tool_request = _tool_call_response("not_a_real_tool", {})
            final = _final_response({"reply": "Sorry, something went wrong.", "intent": "OUT_OF_SCOPE"})

            with patch("app.integrations.ai_client.requests.post") as mock_post:
                mock_post.side_effect = [
                    _mock_response(tool_request),
                    _mock_response(final),
                ]

                result = _openai_compatible_chat(
                    "https://example.test/chat", "test-model", "fake-key", "test", {}
                )

            assert mock_post.call_count == 2
            assert result["reply"] == "Sorry, something went wrong."

    def test_exceeding_max_iterations_falls_back_to_rule_based(self, app):
        """A model that keeps requesting tool calls forever is cut off and
        degrades to the rule-based assistant rather than looping forever."""
        with app.app_context():
            always_tool_call = _tool_call_response("get_crowd_level", {"station": "Bishan"})

            with patch("app.integrations.ai_client.requests.post") as mock_post:
                mock_post.return_value = _mock_response(always_tool_call)

                result = _openai_compatible_chat(
                    "https://example.test/chat", "test-model", "fake-key",
                    "how crowded is it", {},
                )

            assert mock_post.call_count == MAX_TOOL_ITERATIONS
            # Falls back to RuleBasedAssistant's structured response shape.
            assert "reply" in result
            assert "intent" in result

    def test_openai_provider_delegates_to_shared_loop(self, app):
        """OpenAIProvider.chat() uses the shared tool-calling loop, not a
        bespoke single-shot call."""
        with app.app_context():
            final = _final_response({"reply": "Hi there.", "intent": "OUT_OF_SCOPE"})

            with patch("app.integrations.ai_client.requests.post") as mock_post:
                mock_post.return_value = _mock_response(final)

                provider = OpenAIProvider(api_key="fake-key")
                result = provider.chat("hello", {})

            assert result["reply"] == "Hi there."
            # Confirms the request actually included tool definitions.
            _, kwargs = mock_post.call_args
            assert "tools" in kwargs["json"]
            assert kwargs["json"]["tools"][0]["function"]["name"] == "plan_route"
