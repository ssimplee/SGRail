import type { ReporterBadgeLevel } from "@/types/incident.types";

interface ReporterBadgeProps {
  badge: ReporterBadgeLevel;
  displayName?: string;
  isAnonymous?: boolean;
}

const BADGE_CONFIG: Record<
  ReporterBadgeLevel,
  { label: string; className: string }
> = {
  regular: {
    label: "Regular",
    className: "bg-gray-100 text-gray-700",
  },
  trusted_commuter: {
    label: "Trusted",
    className: "bg-blue-100 text-blue-700",
  },
  super_reporter: {
    label: "Super",
    className: "bg-amber-100 text-amber-700",
  },
};

/**
 * Small badge showing reporter reliability level with colour coding.
 * Regular = grey, Trusted Commuter = blue, Super Reporter = amber.
 *
 * Validates: Requirements 21.2
 */
export function ReporterBadge({
  badge,
  displayName,
  isAnonymous,
}: ReporterBadgeProps) {
  const config = BADGE_CONFIG[badge];
  const name = isAnonymous ? "Anonymous" : displayName || "User";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
        {name}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}
      >
        {config.label}
      </span>
    </div>
  );
}
