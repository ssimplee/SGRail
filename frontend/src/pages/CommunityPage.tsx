import { useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { IncidentFilters, type IncidentFilterValues } from "@/components/community/IncidentFilters";
import { IncidentCard } from "@/components/community/IncidentCard";
import { IncidentActions } from "@/components/community/IncidentActions";
import { IncidentSubmitForm } from "@/components/community/IncidentSubmitForm";
import { useIncidentList, useCreateIncident } from "@/features/incidents/useIncidents";
import { useResponsive } from "@/hooks/useResponsive";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Community incidents page with filterable incident feed, interactive actions,
 * and a submit form dialog.
 * Single-column on mobile, wider with visible filter sidebar on desktop.
 *
 * Validates: Requirements 17.1, 18.1, 22.1, 23.1, 28.3, 29.3
 */
export function CommunityPage() {
  const { t } = useTranslation();
  const { isDesktop } = useResponsive();
  const [filters, setFilters] = useState<IncidentFilterValues>({});
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useIncidentList({
    station: filters.station,
    line: filters.line,
    category: filters.category,
    page,
  });

  const createIncident = useCreateIncident();

  const incidents = data?.incidents ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSubmitReport = (reportData: Parameters<typeof createIncident.mutate>[0]) => {
    createIncident.mutate(reportData, {
      onSuccess: () => {
        toast.success("Incident reported successfully");
        setIsFormOpen(false);
      },
      onError: (err: unknown) => {
        // Handle moderation rejection errors from backend (422)
        if (isModerationError(err)) {
          const reasons = getSubmissionRejectionReasons(err);
          toast.error("Report rejected", {
            description: reasons.length > 0
              ? reasons.join(". ")
              : "Your report did not pass moderation checks.",
          });
        } else if (isImageError(err)) {
          const reasons = getSubmissionRejectionReasons(err);
          toast.error("Photo rejected", {
            description: reasons[0] ?? "The selected image could not be used.",
          });
        } else {
          toast.error("Failed to submit report. Please try again.");
        }
      },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <header className="shrink-0 border-b px-4 py-3 md:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {t("community.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            View and report MRT incidents. Help fellow commuters stay informed.
          </p>
        </div>
        <Button
          onClick={() => setIsFormOpen(true)}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("community.newReport")}</span>
        </Button>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar filters */}
        {isDesktop && (
          <div className="shrink-0 border-r p-4 overflow-y-auto">
            <IncidentFilters values={filters} onChange={setFilters} />
          </div>
        )}

        {/* Feed column */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mobile filters (inline) */}
          {!isDesktop && (
            <IncidentFilters values={filters} onChange={setFilters} />
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading incidents…
              </span>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                {error?.message || "Failed to load incidents"}
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && incidents.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No incidents reported matching these filters.
              </p>
            </div>
          )}

          {/* Incident cards with actions */}
          {!isLoading && !isError && incidents.length > 0 && (
            <div className="flex flex-col gap-3">
              {incidents.map((incident) => (
                <div key={incident.id} className="flex flex-col gap-1">
                  <IncidentCard incident={incident} />
                  <div className="px-4 pb-2">
                    <IncidentActions
                      incidentId={incident.id}
                      likeCount={incident.likeCount}
                      dislikeCount={incident.dislikeCount}
                      confirmCount={incident.confirmCount}
                      onChanged={() => void refetch()}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Report Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report an Incident</DialogTitle>
            <DialogDescription>
              Help fellow commuters by reporting an MRT incident. All reports are
              moderated before publication.
            </DialogDescription>
          </DialogHeader>
          <IncidentSubmitForm
            onSubmit={handleSubmitReport}
            isLoading={createIncident.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Check if an error is a moderation rejection (422) */
function isModerationError(error: unknown): boolean {
  if (error !== null && typeof error === "object" && "response" in error) {
    const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
    return (
      axiosError.response?.status === 422 &&
      axiosError.response?.data?.error === "moderation_rejected"
    );
  }
  return false;
}

function isImageError(error: unknown): boolean {
  if (error !== null && typeof error === "object" && "response" in error) {
    const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
    return (
      axiosError.response?.status === 422 &&
      axiosError.response?.data?.error === "image_rejected"
    );
  }
  return false;
}

/** Extract user-facing submission rejection reasons from backend errors. */
function getSubmissionRejectionReasons(error: unknown): string[] {
  if (error !== null && typeof error === "object" && "response" in error) {
    const axiosError = error as {
      response?: { data?: { reason?: string; reasons?: string[] } };
    };
    const data = axiosError.response?.data;
    if (data?.reasons) return data.reasons;
    if (data?.reason === "profanity_detected") {
      return ["Please remove vulgar or abusive words from the title or description"];
    }
    if (data?.reason) return [data.reason];
  }
  return [];
}
