"""CrowdReading model — crowd level observations for stations."""

from datetime import datetime

from app.extensions import db


class CrowdReading(db.Model):
    """A crowd level observation for a station at a point in time."""

    __tablename__ = "crowd_reading"

    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(
        db.String, db.ForeignKey("station.id"), nullable=False, index=True
    )
    level = db.Column(
        db.String, nullable=False
    )  # "low" | "moderate" | "crowded" | "very_crowded"
    confidence = db.Column(db.Float, default=0.5)  # 0.0–1.0
    source = db.Column(
        db.String, nullable=False
    )  # "official" | "historical" | "community" | "simulated"
    observed_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    user_id = db.Column(db.String, nullable=True)  # nullable, for community reports

    # Relationships
    station = db.relationship("Station", back_populates="crowd_readings")

    def __repr__(self) -> str:
        return f"<CrowdReading {self.station_id} level={self.level}>"
