"""Service alert routes — network-wide train disruptions."""

from datetime import datetime, timezone

from flask import Blueprint, jsonify

from app.services import alert_service

alerts_bp = Blueprint("alerts", __name__)


@alerts_bp.route("/alerts", methods=["GET"])
def list_alerts():
    """Return current train service alerts.

    Returns:
        JSON with the alert list, a provenance label so the UI can badge
        demo data, and the retrieval timestamp.  An empty list means
        normal service — it is never an error.
    """
    alerts = alert_service.get_active_alerts()

    return jsonify(
        {
            "alerts": alerts,
            "source": alert_service.alerts_source(),
            "retrievedAt": datetime.now(timezone.utc).isoformat(),
        }
    )
