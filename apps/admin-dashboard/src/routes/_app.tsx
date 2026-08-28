"use client";

import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/dashboard/command-palette";
import { ErrorBoundary, InlineError } from "@/components/dashboard/error-boundary";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { getRouterAuth, waitForAuthReady } from "@/lib/auth/context";
import { canVisit } from "@/lib/auth/rbac";
import { AdminGlobalAIFAB } from "@/components/ai/admin-global-fab";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    await waitForAuthReady(8000);
    const auth = getRouterAuth();
    if (!auth || !auth.isReady) return;
    if (!auth.isAuthenticated) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
      });
    }
    if (!canVisit(auth.user?.role, location.pathname)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AppShell,
  errorComponent: RouteError,
  pendingComponent: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6">
      <InlineError
        error={error}
        title="This page didn't load"
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
      <div className="mt-3 flex justify-center">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
          <RotateCcw className="size-3.5" /> Full reload
        </Button>
      </div>
    </div>
  );
}

function AppShell() {
  const { open, setOpen } = useCommandPalette();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar onOpenPalette={() => setOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <ErrorBoundary boundary="app_outlet">
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </SidebarInset>
      <CommandPalette open={open} onOpenChange={setOpen} />
      {/* Global AI Assistant FAB — appears on every admin page (auth-guarded in component) */}
      {/* Keyboard shortcut: ⌘/Ctrl + K toggles the chat sheet (see admin-global-fab.tsx listener) */}
      <AdminGlobalAIFAB />
    </SidebarProvider>
  );
}
