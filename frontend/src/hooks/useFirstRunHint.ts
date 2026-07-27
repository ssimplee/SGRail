import { useCallback, useState } from "react";

/**
 * Read a dismissal flag without letting storage failures break rendering.
 * Safari in private mode throws on localStorage access, and the sensible
 * fallback is to show the hint — a repeated nudge is better than a crash.
 */
function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Not being able to remember the dismissal is not worth surfacing;
    // the hint simply returns on the next visit.
  }
}

export interface FirstRunHint {
  /** Whether the hint should currently be rendered */
  visible: boolean;
  /** Hide the hint and remember that choice across visits */
  dismiss: () => void;
}

/**
 * Show something once, until the user dismisses it — then never again.
 *
 * Used for onboarding nudges that stop being useful the moment the feature
 * has been discovered.
 */
export function useFirstRunHint(storageKey: string): FirstRunHint {
  const [visible, setVisible] = useState(() => !readDismissed(storageKey));

  const dismiss = useCallback(() => {
    setVisible(false);
    writeDismissed(storageKey);
  }, [storageKey]);

  return { visible, dismiss };
}
