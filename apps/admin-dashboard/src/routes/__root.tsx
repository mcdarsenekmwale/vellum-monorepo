"use client";

import { Outlet, Link, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientAuthWrapper } from "@/lib/auth/client-wrapper";
import { AuthBridge } from "@/lib/auth/auth-bridge";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/dashboard/error-boundary";
import { setupGlobalErrorHandlers } from "@/lib/monitoring/error-monitor";
import { useEffect } from "react";

export type RootRouterContext = {
  queryClient: QueryClient;
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display italic text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RootRouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ClientAuthWrapper>
        <ErrorBoundary boundary="root">
          <AuthBridge />
          <Outlet />
          <Toaster richColors position="top-right" />
        </ErrorBoundary>
      </ClientAuthWrapper>
    </QueryClientProvider>
  );
}