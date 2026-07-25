import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional description for accessibility */
  description?: string;
}

/**
 * A desktop-friendly side panel that slides in from the right using the shadcn Sheet component.
 * Used on viewports >= 768px.
 */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  description,
}: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        aria-labelledby="side-panel-title"
        aria-describedby={description ? "side-panel-description" : undefined}
      >
        <SheetHeader>
          <SheetTitle id="side-panel-title">{title}</SheetTitle>
          {description && (
            <SheetDescription id="side-panel-description">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="overflow-y-auto flex-1 px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
