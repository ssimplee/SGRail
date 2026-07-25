import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

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
 * Wraps the app in required providers:
 * - QueryClientProvider (TanStack React Query)
 * - Toaster (Sonner toast notifications)
 * - Future providers (i18n, theme) can be added here.
 *
 * Validates: Requirements 28.1, 29.1
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
