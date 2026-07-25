"""Centralised error handlers for the SGRail API.

Registers global JSON error responses for common HTTP status codes.
Ensures no internal stack traces are exposed in production responses.

Validates: Requirements 37.1, 37.7
"""

from flask import Flask, current_app, jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask) -> None:
    """Register global error handlers that return consistent JSON responses."""

    @app.errorhandler(400)
    def bad_request(e: HTTPException):
        return jsonify({
            "error": "bad_request",
            "message": _get_description(e),
        }), 400

    @app.errorhandler(404)
    def not_found(e: HTTPException):
        return jsonify({
            "error": "not_found",
            "message": "Resource not found",
        }), 404

    @app.errorhandler(409)
    def conflict(e: HTTPException):
        return jsonify({
            "error": "conflict",
            "message": _get_description(e),
        }), 409

    @app.errorhandler(413)
    def payload_too_large(e: HTTPException):
        return jsonify({
            "error": "payload_too_large",
            "message": "File too large",
        }), 413

    @app.errorhandler(422)
    def unprocessable(e: HTTPException):
        return jsonify({
            "error": "unprocessable",
            "message": _get_description(e),
        }), 422

    @app.errorhandler(429)
    def rate_limited(e: HTTPException):
        return jsonify({
            "error": "rate_limited",
            "message": "Too many requests. Try again later.",
        }), 429

    @app.errorhandler(500)
    def internal_error(e: Exception):
        # Log the full exception for debugging but never expose stack traces
        current_app.logger.exception("Internal server error")
        return jsonify({
            "error": "internal_error",
            "message": "An unexpected error occurred.",
        }), 500


def _get_description(e: HTTPException) -> str:
    """Extract a safe description from an HTTPException."""
    if hasattr(e, "description") and e.description:
        return str(e.description)
    return "An error occurred."
