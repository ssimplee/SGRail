import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, X } from "lucide-react";
import { useServiceAlerts } from "@/features/alerts/useServiceAlerts";
import { DataSourceLabel } from "./DataSourceLabel";
import type { ServiceAlert } from "@/services/alerts.api";

/**
 * Network-wide train service disruption banner.
 *
 * Renders nothing when service is normal, the feed is unavailable, or the
 * user has dismissed the current set of alerts. Major disruptions are
 * styled red and minor delays amber.
 */

/** Identity for a set of alerts, so dismissal resets when the alerts change. */
function alertsSignature(alerts: ServiceAlert[]): string {
  return alerts.map((a) => `${a.lineCode}:${a.status}:${a.createdAt}`).join("|");
}

export function AlertBanner() {
  const { t } = useTranslation();
  const { data } = useServiceAlerts();
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);

  const alerts = data?.alerts ?? [];
  if (alerts.length === 0) return null;

  const signature = alertsSignature(alerts);
  if (signature === dismissedSignature) return null;

  const hasMajor = alerts.some((a) => a.severity === "major");
  const Icon = hasMajor ? AlertTriangle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative z-50 flex items-start gap-2 px-3 py-2 border-b text-xs ${
        hasMajor
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {hasMajor ? t("alerts.majorTitle") : t("alerts.minorTitle")}
          </span>
          {data?.source && (
            <DataSourceLabel source={data.source} updatedAt={data.retrievedAt} />
          )}
        </div>

        <ul className="space-y-1">
          {alerts.map((alert) => (
            <li key={`${alert.lineCode}-${alert.createdAt}`}>
              <span className="font-medium">{alert.lineCode}</span>
              {alert.direction && alert.direction !== "Both" && (
                <span> · {t("alerts.towards", { direction: alert.direction })}</span>
              )}
              <span> — {alert.message}</span>
              {alert.freePublicBusStationIds.length > 0 && (
                <span className="block opacity-80">
                  {t("alerts.freeBus", {
                    count: alert.freePublicBusStationIds.length,
                  })}
                </span>
              )}
              {alert.freeMrtShuttleStationIds.length > 0 && (
                <span className="block opacity-80">
                  {t("alerts.freeShuttle", {
                    count: alert.freeMrtShuttleStationIds.length,
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setDismissedSignature(signature)}
        aria-label={t("alerts.dismiss")}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
