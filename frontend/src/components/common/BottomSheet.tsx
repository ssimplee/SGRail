import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional description for accessibility (visually hidden if not provided) */
  description?: string;
}

/**
 * A mobile-friendly slide-up bottom sheet panel using the vaul Drawer component.
 * Used on viewports < 768px.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  description,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent
        aria-labelledby="bottom-sheet-title"
        aria-describedby={description ? "bottom-sheet-description" : undefined}
      >
        <DrawerHeader>
          <DrawerTitle id="bottom-sheet-title">{title}</DrawerTitle>
          {description && (
            <DrawerDescription id="bottom-sheet-description">
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
