import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { usePreferencesStore } from "@/store/preferencesStore";

/**
 * Global query client instance shared across the app.
 * Configured with sensible defaults for an MRT companion app.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — reasonable for transit data
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Applies the persisted dark-mode preference to <html> for the lifetime of
 * the app, not just while the Profile settings screen is mounted — without
 * this, the theme would silently revert to light on every navigation away
 * from Accessibility Settings.
 */
function useDarkModeSync() {
  const darkMode = usePreferencesStore((state) => state.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
}

/**
 * Wraps the app in required providers:
 * - QueryClientProvider (TanStack React Query)
 * - Toaster (Sonner toast notifications)
 * - Dark mode sync (applies the persisted theme preference app-wide)
 * - Future providers (i18n) can be added here.
 *
 * Validates: Requirements 28.1, 29.1
 */
export function AppProviders({ children }: AppProvidersProps) {
  useDarkModeSync();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
