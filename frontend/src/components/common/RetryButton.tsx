import React from "react";
import { RefreshCw } from "lucide-react";

export interface RetryButtonProps {
  /** Callback invoked when the user clicks retry */
  onRetry: () => void;
  /** Whether a retry is currently in progress */
  isLoading: boolean;
}

/**
 * A button that triggers a retry action.
 * Shows a refresh icon and "Retry" text. Disabled while loading.
 */
export function RetryButton({ onRetry, isLoading }: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={isLoading ? "Retrying…" : "Retry"}
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span>{isLoading ? "Retrying…" : "Retry"}</span>
    </button>
  );
}
