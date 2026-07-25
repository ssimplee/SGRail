"""Flask extensions initialised here and bound to the app in create_app().

Rate limiting (Req 37.4):
- Incident submission endpoints: limited via app.config['RATE_LIMIT_INCIDENTS']
- AI chat endpoints: limited via app.config['RATE_LIMIT_AI']
- Applied as decorators on specific routes when those blueprints are registered.
"""

from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
)

cors = CORS()
