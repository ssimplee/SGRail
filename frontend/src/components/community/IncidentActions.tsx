import { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle, CircleCheck, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { interactWithIncident } from "@/services/incidents.api";
import type { InteractionAction } from "@/types/incident.types";

interface IncidentActionsProps {
  incidentId: string;
  likeCount: number;
  dislikeCount: number;
  confirmCount: number;
  onChanged?: () => void;
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
  onChanged,
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

      const countKey = getCountKey(action);
      if (countKey) {
        const delta = action.startsWith("remove_") ? -1 : 1;
        setCounts((prev) => ({
          ...prev,
          [countKey]: Math.max(prev[countKey] + delta, 0),
        }));
      }

      try {
        const result = await interactWithIncident(incidentId, { action });

        if (action === "resolve") {
          toast.success("Incident marked as resolved");
        } else if (action === "report_abusive") {
          toast.success(
            result.removed
              ? "Report removed from the public feed"
              : "Report submitted"
          );
        } else if (result.removed) {
          toast.success("Report removed from the public feed");
        }
        onChanged?.();
      } catch (error: unknown) {
        // Revert optimistic update on error
        if (countKey) {
          const delta = action.startsWith("remove_") ? 1 : -1;
          setCounts((prev) => ({
            ...prev,
            [countKey]: Math.max(prev[countKey] + delta, 0),
          }));
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
    [incidentId, inFlight, onChanged]
  );

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Like button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("like")}
        aria-label={`Add like (${counts.like})`}
        className="gap-1 text-xs text-muted-foreground hover:text-green-600"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span>{counts.like}</span>
      </Button>
      {counts.like > 0 && (
        <UndoCountButton
          label="Remove one like"
          disabled={inFlight !== null}
          onClick={() => handleInteraction("remove_like")}
        />
      )}

      {/* Dislike button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("dislike")}
        aria-label={`Add dislike (${counts.dislike})`}
        className="gap-1 text-xs text-muted-foreground hover:text-red-600"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span>{counts.dislike}</span>
      </Button>
      {counts.dislike > 0 && (
        <UndoCountButton
          label="Remove one dislike"
          disabled={inFlight !== null}
          onClick={() => handleInteraction("remove_dislike")}
        />
      )}

      {/* Confirm still happening button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={inFlight !== null}
        onClick={() => handleInteraction("confirm")}
        aria-label={`Add confirmation still happening (${counts.confirm})`}
        className="gap-1 text-xs text-muted-foreground hover:text-blue-600"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        <span>{counts.confirm}</span>
      </Button>
      {counts.confirm > 0 && (
        <UndoCountButton
          label="Remove one confirmation"
          disabled={inFlight !== null}
          onClick={() => handleInteraction("remove_confirm")}
        />
      )}

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

function getCountKey(action: InteractionAction): "like" | "dislike" | "confirm" | null {
  if (action === "like" || action === "remove_like") return "like";
  if (action === "dislike" || action === "remove_dislike") return "dislike";
  if (action === "confirm" || action === "remove_confirm") return "confirm";
  return null;
}

function UndoCountButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="-ml-2 h-6 w-6 text-muted-foreground hover:text-foreground"
    >
      <X className="h-3 w-3" />
    </Button>
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
