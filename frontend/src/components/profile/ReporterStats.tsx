import { useQuery } from "@tanstack/react-query";
import { FileCheck, FileText, Loader2, Shield } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentUser, type UserProfile } from "@/services/user.api";

/**
 * Badge colour mapping based on badge level.
 */
function getBadgeColour(badge: string): string {
  switch (badge) {
    case "super_reporter":
      return "text-amber-500";
    case "trusted_commuter":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Format badge name for display.
 */
function formatBadgeName(badge: string): string {
  switch (badge) {
    case "super_reporter":
      return "Super Reporter";
    case "trusted_commuter":
      return "Trusted Commuter";
    default:
      return "Regular";
  }
}

/**
 * ReporterStats — displays the user's reliability score, badge, and report counts.
 *
 * Shows:
 * - Shield icon coloured by badge level
 * - Reliability score (0–100) with a progress bar
 * - Number of reports submitted
 * - Number of reports confirmed
 *
 * Validates: Requirements 25.1, 25.2
 */
export function ReporterStats() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !user) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
            Failed to load reporter stats. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  const badgeColour = getBadgeColour(user.badge);
  const badgeName = formatBadgeName(user.badge);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Reporter Stats</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Badge and score */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
            <Shield className={`size-6 ${badgeColour}`} aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{badgeName}</span>
              <span className="text-sm font-bold tabular-nums">
                {user.reliabilityScore}
                <span className="text-xs font-normal text-muted-foreground">
                  /100
                </span>
              </span>
            </div>
            <Progress
              value={user.reliabilityScore}
              aria-label={`Reliability score: ${user.reliabilityScore} out of 100`}
            />
          </div>
        </div>

        {/* Report counts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums leading-tight">
                {user.reportCount}
              </span>
              <span className="text-xs text-muted-foreground">
                reports submitted
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <FileCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums leading-tight">
                {user.confirmCount}
              </span>
              <span className="text-xs text-muted-foreground">
                reports confirmed
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
