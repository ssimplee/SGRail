"""Incident model — community-reported MRT incidents."""

from datetime import datetime

from app.extensions import db


class Incident(db.Model):
    """A community-reported MRT incident."""

    __tablename__ = "incident"

    id = db.Column(db.String, primary_key=True)  # UUID
    user_id = db.Column(db.String, db.ForeignKey("user.id"), nullable=False, index=True)
    station_id = db.Column(
        db.String, db.ForeignKey("station.id"), nullable=False, index=True
    )
    line_code = db.Column(db.String, nullable=True)
    category = db.Column(db.String, nullable=False)  # enum of 9 types
    title = db.Column(db.String, nullable=False)
    description = db.Column(db.String, nullable=False)
    photo_url = db.Column(db.String, nullable=True)
    incident_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(
        db.String, default="active"
    )  # "active" | "resolved" | "expired" | "removed"
    moderation_status = db.Column(
        db.String, default="pending"
    )  # "pending" | "approved" | "rejected" | "flagged"
    is_anonymous = db.Column(db.Boolean, default=False)
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    like_count = db.Column(db.Integer, default=0)
    dislike_count = db.Column(db.Integer, default=0)
    confirm_count = db.Column(db.Integer, default=0)

    # Relationships
    user = db.relationship("User", back_populates="incidents")
    interactions = db.relationship(
        "IncidentInteraction", back_populates="incident", lazy="dynamic"
    )

    def __repr__(self) -> str:
        return f"<Incident {self.id}: {self.title}>"
