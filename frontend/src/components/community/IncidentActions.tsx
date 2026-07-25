import { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle, CircleCheck, Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { interactWithIncident } from "@/services/incidents.api";
import type { InteractionAction } from "@/types/incident.types";

interface IncidentActionsProps {
  incidentId: string;
  likeCount: number;
  dislikeCount: number;
  confirmCount: number;
}

/**
 * Interaction action buttons for an incident report.
 * Supports like, dislike, confirm-still-happening, mark-resolved, and report-abusive.
 * Uses optimistic UI updates and gracefully handles 409 duplicate action errors.
 *
 * Validates: Requirements 19.1, 19.2, 19.3
 */
export function IncidentActions({
  incidentId,
  likeCount,
  dislikeCount,
  confirmCount,
}: IncidentActionsProps) {
  const [counts, setCounts] = useState({
    like: likeCount,
    dislike: dislikeCount,
    confirm: confirmCount,
  });
  const [inFlight, setInFlight] = useState<InteractionAction | null>(null);

  const handleInteraction = useCallback(
    async (action: InteractionAction) => {
      if (inFlight) return;

      setInFlight(action);

      // Optimistic update for countable actions
      const countKey = action === "like" ? "like" : action === "dislike" ? "dislike" : action === "confirm" ? "confirm" : null;
      if (countKey) {
        setCounts((prev) => ({ ...prev, [countKey]: prev[countKey] + 1 }));
      }

      try {
        await interactWithIncident(incidentId, { action });

        if (action === "resolve") {
          toast.success("Incident marked as resolved");
        } else if (action === "report_abusive") {
          toast.success("Report submitted");
        }
      } catch (error: unknown) {
        // Revert optimistic update on error
        if (countKey) {
          setCounts((prev) => ({ ...prev, [countKey]: prev[countKey] - 1 }));
        }

        // Handle 409 duplicate action gracefully
        if (isDuplicateActionError(error)) {
          toast.error("Already voted");
        } else {
          toast.error("Action failed. Please try again.");
        }
      } finally {
        setInFlight(null);
      }
    },
    [incidentId, inFlight]
  );

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Like button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("like")}
        aria-label={`Like (${counts.like})`}
        className="gap-1 text-xs text-muted-foreground hover:text-green-600"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span>{counts.like}</span>
      </Button>

      {/* Dislike button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("dislike")}
        aria-label={`Dislike (${counts.dislike})`}
        className="gap-1 text-xs text-muted-foreground hover:text-red-600"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span>{counts.dislike}</span>
      </Button>

      {/* Confirm still happening button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("confirm")}
        aria-label={`Confirm still happening (${counts.confirm})`}
        className="gap-1 text-xs text-muted-foreground hover:text-blue-600"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span>{counts.confirm}</span>
      </Button>

      {/* Mark resolved button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("resolve")}
        aria-label="Mark as resolved"
        className="text-xs text-muted-foreground hover:text-emerald-600"
      >
        <CircleCheck className="h-3.5 w-3.5" />
      </Button>

      {/* Report abusive button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("report_abusive")}
        aria-label="Report abusive"
        className="text-xs text-muted-foreground hover:text-orange-600"
      >
        <Flag className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Check if an error is a 409 duplicate action response */
function isDuplicateActionError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "response" in error
  ) {
    const axiosError = error as { response?: { status?: number } };
    return axiosError.response?.status === 409;
  }
  return false;
}
