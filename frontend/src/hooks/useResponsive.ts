import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export interface ResponsiveState {
  isMobile: boolean;
  isDesktop: boolean;
}

/**
 * Hook that returns responsive state based on viewport width.
 * Mobile: < 768px, Desktop: >= 768px.
 */
export function useResponsive(): ResponsiveState {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return {
    isMobile,
    isDesktop: !isMobile,
  };
}
