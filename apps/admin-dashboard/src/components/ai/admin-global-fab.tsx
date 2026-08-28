import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { ChatSheet } from "./chat-sheet";
import { api } from "@/lib/api/client";
import { getRouterAuth } from "@/lib/auth/context";

/**
 * Global floating AI Assistant button (bottom-right of admin app).
 *
 * Keyboard shortcut: ⌘/Ctrl + K toggles the chat sheet.
 *   -> listener is attached via useEffect window 'keydown' below.
 *
 * Amber notification badge appears when there are open support tickets
 * older than 72 hours (queried once on mount + when sheet closes).
 */
export function AdminGlobalAIFAB() {
  const [open, setOpen] = useState(false);
  const [showSuggestionBadge, setShowSuggestionBadge] = useState(false);
  const [isClient, setIsClient] = useState(false);

  /* Guard: render only on client (this component uses window/keydown + localStorage). */
  useEffect(() => {
    setIsClient(true);
  }, []);

  /* --- Auth guard --- */
  const isAuthenticated = (() => {
    try {
      const auth = getRouterAuth();
      if (auth && typeof auth.isAuthenticated === "boolean") {
        return auth.isAuthenticated;
      }
    } catch {
      /* auth bridge not ready yet — fallback to localStorage token probe. */
    }
    try {
      return !!localStorage.getItem("vellbase.admin.session.v1");
    } catch {
      return false;
    }
  })();

  /* --- Check for old open tickets once on mount and when sheet closes --- */
  const checkOldTickets = useCallback(async () => {
    try {
      const res = (await api<any>("/admin/support/tickets", {
        query: {
          status: "open",
          olderThanHours: "72",
          limit: "1",
        },
      })) as unknown as { data?: unknown[]; total?: number };
      const list: unknown[] =
        (Array.isArray(res) ? res : (res?.data as unknown[]) ?? []) ?? [];
      setShowSuggestionBadge(list.length > 0 || (res?.total ?? 0) > 0);
    } catch {
      /* API might not expose olderThanHours — silently ignore. */
      setShowSuggestionBadge(false);
    }
  }, []);

  useEffect(() => {
    if (isClient) checkOldTickets();
  }, [isClient, checkOldTickets]);

  /* --- ⌘/Ctrl + K keyboard toggle --- */
  useEffect(() => {
    if (!isClient) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isClient]);

  /* When sheet closes, refresh the badge */
  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (!v) {
        checkOldTickets();
      }
    },
    [checkOldTickets]
  );

  if (!isClient || !isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Global AI Assistant FAB — z-50 bottom-right, 56×56 (w-14 h-14) */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            aria-label="Open AI Assistant (⌘K)"
            onClick={() => setOpen(true)}
            className={[
              "fixed bottom-6 right-6 z-50",
              "w-14 h-14 rounded-full p-0",
              "bg-gradient-to-br from-emerald-500 to-emerald-600",
              "hover:from-emerald-400 hover:to-emerald-500",
              "text-white shadow-xl shadow-emerald-500/20",
              "transition-all duration-200",
              "hover:scale-105 active:scale-95",
              "ring-0 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
            ].join(" ")}
          >
            <Sparkles className="size-6" strokeWidth={2.25} />
            {/* Amber 10×10 dot badge for old-open-tickets suggestion */}
            {showSuggestionBadge && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 grid size-2.5 place-items-center"
              >
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/70 opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-amber-500 ring-2 ring-background" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          <p>
            AI Assistant{" "}
            <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </p>
        </TooltipContent>
      </Tooltip>

      <ChatSheet open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
