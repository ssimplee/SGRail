"""TrainTiming model — first/last train times for a station line."""

from datetime import datetime

from app.extensions import db


class TrainTiming(db.Model):
    """First and last train times for a station line in a given direction."""

    __tablename__ = "train_timing"

    id = db.Column(db.Integer, primary_key=True)
    station_line_id = db.Column(
        db.Integer, db.ForeignKey("station_line.id"), nullable=False, index=True
    )
    direction = db.Column(db.String, nullable=False)  # "A" or "B"
    service_day_type = db.Column(
        db.String, nullable=False
    )  # "weekday" | "saturday" | "sunday_ph"
    first_train = db.Column(db.Time)
    last_train = db.Column(db.Time)
    destination = db.Column(db.String)
    source = db.Column(db.String)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    station_line = db.relationship("StationLine", back_populates="timings")

    def __repr__(self) -> str:
        return f"<TrainTiming {self.station_line_id} dir={self.direction} {self.service_day_type}>"
