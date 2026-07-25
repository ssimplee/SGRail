import { useCallback, useRef, useState } from "react";

/** Maximum number of retry attempts before giving up. */
const MAX_RETRIES = 3;

/** Backoff delays in milliseconds for each retry attempt (1s, 2s, 4s). */
const BACKOFF_DELAYS = [1000, 2000, 4000];

export interface UseRetryOptions {
  /** The async function to call on each retry */
  fn: () => Promise<void>;
  /** Optional callback when max retries are exhausted */
  onMaxRetriesReached?: () => void;
}

export interface UseRetryResult {
  /** Trigger a retry attempt with exponential backoff */
  retry: () => void;
  /** Number of retry attempts made so far */
  retryCount: number;
  /** Whether a retry is currently in progress (waiting or executing) */
  isRetrying: boolean;
}

/**
 * Hook for retry with exponential backoff.
 * Caps at 3 retries with delays: 1s, 2s, 4s.
 */
export function useRetry({ fn, onMaxRetriesReached }: UseRetryOptions): UseRetryResult {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retry = useCallback(() => {
    if (isRetrying) return;

    setRetryCount((prev) => {
      const attempt = prev + 1;

      if (attempt > MAX_RETRIES) {
        onMaxRetriesReached?.();
        return prev;
      }

      setIsRetrying(true);
      const delay = BACKOFF_DELAYS[attempt - 1] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];

      timerRef.current = setTimeout(async () => {
        try {
          await fn();
        } finally {
          setIsRetrying(false);
        }
      }, delay);

      return attempt;
    });
  }, [fn, isRetrying, onMaxRetriesReached]);

  return { retry, retryCount, isRetrying };
}
