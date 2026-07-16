"use client";

import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, getRouterAuth, waitForAuthReady } from "@/lib/auth/context";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth/login")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in · Vellum Admin" }] }),
  beforeLoad: async ({ search }) => {
    await waitForAuthReady(5000);
    const auth = getRouterAuth();
    if (auth?.isAuthenticated) {
      throw redirect({ to: search.redirect ?? "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("admin@vellum.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      await router.invalidate();
      navigate({ to: search.redirect ?? "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-xl overflow-hidden border border-border">
            <img src="/favicon.svg" alt="Vellum" className="size-8" />
          </div>
          <div>
            <h1 className="font-display italic text-3xl tracking-tight">Vellum</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin console for operators.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="surface-card space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Demo mode — try <code className="font-mono">admin@vellum.com</code>,{" "}
            <code className="font-mono">moderator@vellum.com</code>,{" "}
            <code className="font-mono">creator@vellum.com</code>, etc. Password:{" "}
            <code className="font-mono">password123</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
