"""Station model."""

from app.extensions import db


class Station(db.Model):
    """MRT station with map coordinates and real-world location."""

    __tablename__ = "station"

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    map_x = db.Column(db.Float)
    map_y = db.Column(db.Float)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    is_interchange = db.Column(db.Boolean, default=False)
    facilities = db.Column(db.JSON)
    accessibility_status = db.Column(db.String)
    exits = db.Column(db.JSON)

    # Relationships
    lines = db.relationship("StationLine", back_populates="station", lazy="dynamic")
    crowd_readings = db.relationship(
        "CrowdReading", back_populates="station", lazy="dynamic"
    )

    def __repr__(self) -> str:
        return f"<Station {self.id}: {self.name}>"
