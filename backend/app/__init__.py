"""Flask application factory for SGRail backend."""

import os

from dotenv import load_dotenv
from flask import Flask

from .config import config_by_name
from .errors import register_error_handlers
from .extensions import cors, db, limiter


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application.

    Args:
        config_name: One of 'development', 'testing', or 'production'.
                     Defaults to the FLASK_ENV environment variable or 'development'.
    """
    load_dotenv()

    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Initialise extensions
    db.init_app(app)
    limiter.init_app(app)

    # Configure CORS restricted to the configured frontend origin only (Req 37.6)
    cors.init_app(
        app,
        origins=[app.config["FRONTEND_ORIGIN"]],
        supports_credentials=True,
    )

    # Register global JSON error handlers (Req 37.7)
    register_error_handlers(app)

    # Register blueprints
    _register_blueprints(app)

    # Serve uploaded files (e.g. incident photos)
    uploads_path = os.path.join(app.root_path, '..', 'uploads')
    from flask import send_from_directory

    @app.route('/uploads/<filename>')
    def serve_upload(filename):
        return send_from_directory(uploads_path, filename)

    # Import models so they are registered with SQLAlchemy
    from . import models  # noqa: F401

    # Create database tables
    with app.app_context():
        db.create_all()

    return app


def _register_blueprints(app: Flask) -> None:
    """Register route blueprints with the app."""
    from .routes.alerts import alerts_bp
    from .routes.assistant import assistant_bp
    from .routes.crowd import crowd_bp
    from .routes.health import health_bp
    from .routes.incidents import incidents_bp
    from .routes.routes import routes_bp
    from .routes.stations import stations_bp
    from .routes.users import users_bp

    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(stations_bp, url_prefix="/api/v1")
    app.register_blueprint(routes_bp, url_prefix="/api/v1")
    app.register_blueprint(crowd_bp, url_prefix="/api/v1")
    app.register_blueprint(incidents_bp, url_prefix="/api/v1")
    app.register_blueprint(assistant_bp, url_prefix="/api/v1")
    app.register_blueprint(alerts_bp, url_prefix="/api/v1")
    app.register_blueprint(users_bp)  # users_bp already has url_prefix="/api/v1/users"
