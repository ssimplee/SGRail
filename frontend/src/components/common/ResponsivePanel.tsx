import React from "react";
import { useResponsive } from "@/hooks/useResponsive";
import { BottomSheet } from "./BottomSheet";
import { SidePanel } from "./SidePanel";

export interface ResponsivePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional description for accessibility */
  description?: string;
}

/**
 * Responsive panel wrapper that renders:
 * - BottomSheet (slide-up drawer) on mobile viewports (< 768px)
 * - SidePanel (right-side sheet) on desktop viewports (>= 768px)
 *
 * Same props interface — the viewport determines the presentation.
 */
export function ResponsivePanel({
  open,
  onClose,
  title,
  children,
  description,
}: ResponsivePanelProps) {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        description={description}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      {children}
    </SidePanel>
  );
}
