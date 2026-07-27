import { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Clock,
  Camera,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ReporterBadge } from "./ReporterBadge";
import type { Incident } from "@/types/incident.types";
import { INCIDENT_CATEGORIES } from "@/types/incident.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IncidentCardProps {
  incident: Incident;
}

/** Max description characters shown before truncation */
const DESCRIPTION_MAX_LENGTH = 120;
const DEFAULT_API_BASE_URL = "http://localhost:5000/api/v1";

/**
 * Card displaying a single incident report with title, description,
 * station, category badge, time ago, and like/dislike/confirm counts.
 *
 * Validates: Requirements 17.1, 19.1
 */
export function IncidentCard({ incident }: IncidentCardProps) {
  const [imageOpen, setImageOpen] = useState(false);
  const categoryLabel =
    INCIDENT_CATEGORIES.find((c) => c.value === incident.category)?.label ??
    incident.category;
  const photoSrc = incident.photoUrl ? resolveIncidentPhotoUrl(incident.photoUrl) : null;

  const truncatedDescription =
    incident.description.length > DESCRIPTION_MAX_LENGTH
      ? incident.description.slice(0, DESCRIPTION_MAX_LENGTH) + "…"
      : incident.description;

  const timeAgo = formatDistanceToNow(new Date(incident.createdAt), {
    addSuffix: true,
  });

  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: category badge + time */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          {categoryLabel}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
        {incident.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-3">
        {truncatedDescription}
      </p>

      {/* Community trust labels */}
      {incident.trustState && incident.trustState !== "unverified" && (
        <div className="mb-3">
          <TrustBadge trustState={incident.trustState} />
        </div>
      )}

      {/* Photo thumbnail */}
      {photoSrc && (
        <>
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            className="mb-3 block overflow-hidden rounded-md border bg-muted text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Open photo for ${incident.title}`}
          >
            <img
              src={photoSrc}
              alt={`Photo for incident: ${incident.title}`}
              className="h-36 w-full object-cover transition-transform hover:scale-[1.02]"
              loading="lazy"
            />
            <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
              <Camera className="size-3.5" />
              Click to enlarge
            </span>
          </button>

          <Dialog open={imageOpen} onOpenChange={setImageOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{incident.title}</DialogTitle>
                <DialogDescription>{categoryLabel}</DialogDescription>
              </DialogHeader>
              <img
                src={photoSrc}
                alt={`Larger photo for incident: ${incident.title}`}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Station and line info */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {incident.stationId}
        </span>
        {incident.lineCode && (
          <span className="rounded bg-muted px-1.5 py-0.5">
            {incident.lineCode}
          </span>
        )}
      </div>

      {/* Footer: reporter badge + interaction counts */}
      <div className="flex items-center justify-between border-t pt-3">
        {/* Reporter */}
        <ReporterBadge
          badge={incident.reporter?.badge ?? "regular"}
          displayName={incident.reporter?.displayName}
          isAnonymous={incident.isAnonymous}
        />

        {/* Interaction counts */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ThumbsUp className="h-3.5 w-3.5" />
            {incident.likeCount}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ThumbsDown className="h-3.5 w-3.5" />
            {incident.dislikeCount}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5" />
            {incident.confirmCount}
          </span>
        </div>
      </div>
    </article>
  );
}

function TrustBadge({ trustState }: { trustState: NonNullable<Incident["trustState"]> }) {
  if (trustState === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
        <ShieldCheck className="size-3.5" />
        Verified by commuters
      </span>
    );
  }
  if (trustState === "disputed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        <ShieldAlert className="size-3.5" />
        Disputed by commuters
      </span>
    );
  }
  return null;
}

function resolveIncidentPhotoUrl(photoUrl: string): string {
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;

  const apiBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
  if (apiBase.startsWith("http")) {
    return new URL(photoUrl, apiBase).toString();
  }
  return photoUrl;
}
