"""Pytest fixtures for the SGRail backend test suite."""

import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture()
def app():
    """Create a test application instance."""
    app = create_app("testing")
    yield app


@pytest.fixture()
def client(app):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture()
def db(app):
    """Provide a clean database session for each test."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()
