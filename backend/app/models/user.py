"""User model — commuter profile with reliability and preferences."""

from datetime import datetime

from app.extensions import db


class User(db.Model):
    """Application user with reliability score, badge, and preferences."""

    __tablename__ = "user"

    id = db.Column(db.String, primary_key=True)
    display_name = db.Column(db.String)
    reliability_score = db.Column(db.Integer, default=50)  # 0–100
    badge = db.Column(
        db.String, default="regular"
    )  # "regular" | "trusted_commuter" | "super_reporter"
    preferred_language = db.Column(db.String, default="en")
    text_scale = db.Column(db.Float, default=1.0)
    high_contrast = db.Column(db.Boolean, default=False)
    colour_blind_labels = db.Column(db.Boolean, default=False)
    reduced_motion = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    incidents = db.relationship("Incident", back_populates="user", lazy="dynamic")
    saved_routes = db.relationship("SavedRoute", back_populates="user", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<User {self.id}: {self.display_name}>"
