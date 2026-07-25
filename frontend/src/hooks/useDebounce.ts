import { useState, useEffect } from "react";

/**
 * Debounces a value by the specified delay.
 * Returns the debounced value which only updates after the delay has elapsed
 * since the last change to the input value.
 *
 * Validates: Requirements 3.7, 34.4
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
