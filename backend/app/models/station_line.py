"""StationLine model — a station's presence on a specific MRT line."""

from app.extensions import db


class StationLine(db.Model):
    """Represents a station on a particular line with direction info."""

    __tablename__ = "station_line"

    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(
        db.String, db.ForeignKey("station.id"), nullable=False, index=True
    )
    line_code = db.Column(db.String, nullable=False)
    station_code = db.Column(db.String, nullable=False)
    sequence = db.Column(db.Integer, nullable=False)
    direction_a = db.Column(db.String)
    direction_b = db.Column(db.String)

    # Relationships
    station = db.relationship("Station", back_populates="lines")
    timings = db.relationship(
        "TrainTiming", back_populates="station_line", lazy="dynamic"
    )

    def __repr__(self) -> str:
        return f"<StationLine {self.station_code} ({self.line_code})>"
