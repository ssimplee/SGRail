"""Seed script to load JSON data into SQLite database.

Reads stations.json, timings.json, and graph.json from app/data/
and populates the Station, StationLine, and TrainTiming tables.

Usage:
    cd backend && python seed.py
"""

import json
import os
import sys
from datetime import time
from pathlib import Path

# Add the backend directory to sys.path so imports resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models import Station, StationLine, TrainTiming


DATA_DIR = Path(__file__).parent / "app" / "data"


def load_json(filename: str):
    """Load and parse a JSON file from the data directory."""
    filepath = DATA_DIR / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_time(time_str: str) -> time:
    """Parse a time string like '05:30' or '00:01' into a time object."""
    parts = time_str.split(":")
    hour = int(parts[0])
    minute = int(parts[1])
    # Handle times past midnight (e.g., "00:01" means 00:01)
    return time(hour=hour % 24, minute=minute)


def seed_stations(stations_data: list) -> dict:
    """Seed Station table and return a mapping of station_id -> Station."""
    station_map = {}
    for s in stations_data:
        station = Station(
            id=s["id"],
            name=s["name"],
            map_x=s["map_x"],
            map_y=s["map_y"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            is_interchange=s["is_interchange"],
            facilities=s.get("facilities", []),
            accessibility_status=s.get("accessibility_status", "full"),
            exits=s.get("exits", []),
        )
        db.session.add(station)
        station_map[s["id"]] = station

    db.session.flush()
    print(f"  ✓ Inserted {len(stations_data)} stations")
    return station_map


def seed_station_lines(stations_data: list) -> dict:
    """Seed StationLine table from station codes/lines data.

    Returns a mapping of (station_id, line_code, station_code) -> StationLine.
    """
    station_line_map = {}
    count = 0

    # Line direction mappings
    line_directions = {
        "NS": ("Marina South Pier", "Jurong East"),
        "EW": ("Pasir Ris", "Tuas Link"),
        "NE": ("Punggol", "HarbourFront"),
        "CC": ("Dhoby Ghaut", "HarbourFront"),
        "DT": ("Bukit Panjang", "Expo"),
        "TE": ("Woodlands North", "Sungei Bedok"),
        "CE": ("Bayfront", "Marina Bay"),
        "CG": ("Tanah Merah", "Changi Airport"),
        "BP": ("Choa Chu Kang", "Bukit Panjang"),
    }

    for s in stations_data:
        codes = s["codes"]
        lines = s["lines"]

        for code in codes:
            # Extract line code from station code (e.g., "NS1" -> "NS")
            line_code = ""
            for lc in lines:
                if code.startswith(lc):
                    line_code = lc
                    break

            if not line_code:
                # Try extracting from code prefix
                for lc in ["NS", "EW", "NE", "CC", "DT", "TE", "CE", "CG", "BP"]:
                    if code.startswith(lc):
                        line_code = lc
                        break

            if not line_code:
                continue

            # Extract sequence number
            seq_str = code[len(line_code):]
            try:
                sequence = int(seq_str)
            except ValueError:
                sequence = 0

            dirs = line_directions.get(line_code, ("", ""))

            station_line = StationLine(
                station_id=s["id"],
                line_code=line_code,
                station_code=code,
                sequence=sequence,
                direction_a=dirs[0],
                direction_b=dirs[1],
            )
            db.session.add(station_line)
            station_line_map[(s["id"], line_code, code)] = station_line
            count += 1

    db.session.flush()
    print(f"  ✓ Inserted {count} station-line entries")
    return station_line_map


def seed_timings(timings_data: list, station_line_map: dict):
    """Seed TrainTiming table from timings.json data."""
    count = 0

    for t in timings_data:
        # Find the matching StationLine
        key = (t["station_id"], t["line_code"], t["station_code"])
        station_line = station_line_map.get(key)

        if station_line is None:
            print(f"  ⚠ Warning: No StationLine found for {key}, skipping")
            continue

        timing = TrainTiming(
            station_line_id=station_line.id,
            direction=t["direction"],
            service_day_type=t["service_day_type"],
            first_train=parse_time(t["first_train"]),
            last_train=parse_time(t["last_train"]),
            destination=t["direction_name"],
            source=t.get("source", "official"),
        )
        db.session.add(timing)
        count += 1

    db.session.flush()
    print(f"  ✓ Inserted {count} train timing entries")


def main():
    """Main seed function."""
    print("=" * 60)
    print("SGRail Database Seed Script")
    print("=" * 60)

    app = create_app("development")

    with app.app_context():
        print("\n1. Dropping existing data...")
        TrainTiming.query.delete()
        StationLine.query.delete()
        Station.query.delete()
        db.session.commit()
        print("  ✓ Cleared existing data")

        print("\n2. Loading JSON data files...")
        stations_data = load_json("stations.json")
        timings_data = load_json("timings.json")
        graph_data = load_json("graph.json")
        print(f"  ✓ Loaded {len(stations_data)} stations")
        print(f"  ✓ Loaded {len(timings_data)} timing entries")
        print(f"  ✓ Loaded {len(graph_data['edges'])} graph edges")

        print("\n3. Seeding stations...")
        seed_stations(stations_data)

        print("\n4. Seeding station lines...")
        station_line_map = seed_station_lines(stations_data)

        print("\n5. Seeding train timings...")
        seed_timings(timings_data, station_line_map)

        print("\n6. Committing to database...")
        db.session.commit()
        print("  ✓ All data committed successfully")

        # Verify counts
        print("\n" + "=" * 60)
        print("Verification:")
        print(f"  Stations:      {Station.query.count()}")
        print(f"  StationLines:  {StationLine.query.count()}")
        print(f"  TrainTimings:  {TrainTiming.query.count()}")
        print("=" * 60)
        print("\n✅ Seed complete!")


if __name__ == "__main__":
    main()
