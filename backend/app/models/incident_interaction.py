"""IncidentInteraction model — user actions on incidents."""

from datetime import datetime

from app.extensions import db


class IncidentInteraction(db.Model):
    """A user's interaction (like, dislike, confirm, etc.) with an incident."""

    __tablename__ = "incident_interaction"

    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(
        db.String, db.ForeignKey("incident.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.String, db.ForeignKey("user.id"), nullable=False, index=True
    )
    action = db.Column(
        db.String, nullable=False
    )  # "like" | "dislike" | "confirm" | "resolve" | "report_abusive"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint: one action type per user per incident
    __table_args__ = (
        db.UniqueConstraint(
            "incident_id", "user_id", "action", name="uq_incident_user_action"
        ),
    )

    # Relationships
    incident = db.relationship("Incident", back_populates="interactions")

    def __repr__(self) -> str:
        return f"<IncidentInteraction {self.user_id} → {self.incident_id}: {self.action}>"
