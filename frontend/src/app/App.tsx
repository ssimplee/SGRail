import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./providers";
import { AppRoutes } from "./router";
import { useResponsive } from "@/hooks/useResponsive";
import { BottomNav } from "@/components/common/BottomNav";
import { SideNav } from "@/components/common/SideNav";
import { AlertBanner } from "@/components/common/AlertBanner";

/**
 * App layout shell that renders navigation and route content.
 * - Mobile (< 768px): bottom nav with full-height content above it
 * - Desktop (>= 768px): side nav rail with content offset to the right
 *
 * Validates: Requirements 28.1, 29.1
 */
function AppLayout() {
  const { isMobile } = useResponsive();

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop side nav */}
      {!isMobile && <SideNav />}

      {/* Main content area */}
      <main
        className={`flex flex-col flex-1 overflow-hidden ${
          isMobile ? "pb-16" : "pl-20"
        }`}
      >
        <AlertBanner />
        <div className="flex-1 overflow-hidden">
          <AppRoutes />
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <BottomNav />}
    </div>
  );
}

/**
 * Root App component.
 * Wraps the entire application in providers and the router.
 */
export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AppProviders>
  );
}
