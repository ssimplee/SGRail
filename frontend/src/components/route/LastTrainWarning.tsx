import { AlertTriangle, Clock, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Props for the LastTrainWarning component.
 */
export interface LastTrainWarningProps {
  warnings: Array<{
    type: string;
    station: string;
    line: string;
    [key: string]: string;
  }>;
}

/**
 * Get display configuration for a warning type.
 */
function getWarningConfig(type: string) {
  switch (type) {
    case "LAST_TRAIN_DEPARTED":
      return {
        icon: <AlertTriangle className="size-4 shrink-0 text-red-500" />,
        bgColour: "bg-red-50 border-red-200",
        textColour: "text-red-800",
        label: "Last train departed",
      };
    case "SERVICE_NOT_STARTED":
      return {
        icon: <Clock className="size-4 shrink-0 text-amber-500" />,
        bgColour: "bg-amber-50 border-amber-200",
        textColour: "text-amber-800",
        label: "Service not yet started",
      };
    case "TRANSFER_AT_RISK":
      return {
        icon: <Info className="size-4 shrink-0 text-amber-500" />,
        bgColour: "bg-amber-50 border-amber-200",
        textColour: "text-amber-800",
        label: "Transfer at risk",
      };
    default:
      return {
        icon: <Info className="size-4 shrink-0 text-gray-500" />,
        bgColour: "bg-gray-50 border-gray-200",
        textColour: "text-gray-800",
        label: type,
      };
  }
}

/**
 * Display last-train warnings for a route result.
 * Shows colour-coded alerts for each timing issue encountered.
 *
 * Validates: Requirements 14.2, 14.3, 14.4
 */
export function LastTrainWarning({ warnings }: LastTrainWarningProps) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="alert" aria-label="Last train warnings">
      {warnings.map((warning, index) => {
        const config = getWarningConfig(warning.type);
        return (
          <div
            key={`${warning.type}-${warning.station}-${index}`}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
              config.bgColour,
            )}
          >
            {config.icon}
            <div className={cn("flex flex-col gap-0.5", config.textColour)}>
              <span className="font-medium">{config.label}</span>
              <span className="text-xs opacity-80">
                {warning.station} ({warning.line} Line)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
