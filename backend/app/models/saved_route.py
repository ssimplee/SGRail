"""SavedRoute model — user's saved frequent routes."""

from datetime import datetime

from app.extensions import db


class SavedRoute(db.Model):
    """A user's saved route between two stations."""

    __tablename__ = "saved_route"

    id = db.Column(db.String, primary_key=True)  # UUID
    user_id = db.Column(
        db.String, db.ForeignKey("user.id"), nullable=False, index=True
    )
    origin_station_id = db.Column(
        db.String, db.ForeignKey("station.id"), nullable=False
    )
    destination_station_id = db.Column(
        db.String, db.ForeignKey("station.id"), nullable=False
    )
    preference = db.Column(db.String, nullable=False)
    label = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship("User", back_populates="saved_routes")
    origin_station = db.relationship("Station", foreign_keys=[origin_station_id])
    destination_station = db.relationship(
        "Station", foreign_keys=[destination_station_id]
    )

    def __repr__(self) -> str:
        return f"<SavedRoute {self.origin_station_id} → {self.destination_station_id}>"
