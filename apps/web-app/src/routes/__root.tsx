import {
  Outlet,
  Link,
  createRootRouteWithContext,
  ErrorComponentProps,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SocialProvider } from "@/lib/social-store";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider, useI18n } from "@/components/providers/I18nProvider";
import { SettingsStoreProvider } from "@/components/providers/SettingsStore";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display italic text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("errors.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This story doesn't exist — or it's been unpublished.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-background transition-opacity hover:opacity-90"
          >
            Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display italic text-5xl text-foreground">Oops</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground break-words">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-muted"
          >
            Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <SettingsStoreProvider>
            <SocialProvider>
              <Outlet />
              <Toaster position="top-center" />
            </SocialProvider>
          </SettingsStoreProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
