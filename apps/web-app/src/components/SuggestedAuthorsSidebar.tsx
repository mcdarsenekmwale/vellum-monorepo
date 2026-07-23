"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useLoginPrompt } from "@/components/LoginPrompt";
import { useAuthState } from "@/hooks/useApi";
import type { SuggestedAuthor } from "@/lib/api";

interface SuggestedAuthorsSidebarProps {
  limit?: number;
}

type LoadingState = "idle" | "loading" | "error" | "success";

interface AuthorState {
  followLoading: boolean;
  replacing: boolean;
}

export function SuggestedAuthorsSidebar({ limit = 5 }: SuggestedAuthorsSidebarProps) {
  const [authors, setAuthors] = useState<SuggestedAuthor[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [authorStates, setAuthorStates] = useState<Record<string, AuthorState>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useAuthState();
  const { promptLogin, LoginPromptComponent } = useLoginPrompt();

  const fetchSuggested = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const response = await apiClient.getSuggestedAuthors(limit, 0);
      setAuthors(response.data);

      const initialStates: Record<string, AuthorState> = {};
      response.data.forEach((a) => {
        initialStates[a.id] = { followLoading: false, replacing: false };
      });
      setAuthorStates(initialStates);

      setLoadingState("success");
    } catch (err: any) {
      console.error("[SuggestedAuthorsSidebar] Failed to load:", err);
      setError(err.message || "Failed to load suggestions");
      setLoadingState("error");
    }
  }, [limit]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  const handleRetry = () => {
    fetchSuggested();
  };

  const handleFollow = async (author: SuggestedAuthor) => {
    if (!isAuthenticated) {
      promptLogin("follow this author");
      return;
    }

    setAuthorStates((prev) => ({
      ...prev,
      [author.id]: { ...prev[author.id], followLoading: true, replacing: true },
    }));

    const previousAuthors = authors;
    const previousStates = authorStates;

    try {
      await apiClient.toggleFollow(author.id);

      toast.success(`You're now following ${author.name}`);

      const replacement = await apiClient.getSuggestedAuthorReplacement(author.id);

      setAuthors((prev) => {
        const index = prev.findIndex((a) => a.id === author.id);
        if (index === -1) return prev;

        const newAuthors = [...prev];

        if (replacement) {
          newAuthors[index] = replacement;
          setAuthorStates((states) => {
            const newStates = { ...states };
            delete newStates[author.id];
            newStates[replacement.id] = { followLoading: false, replacing: false };
            return newStates;
          });
        } else {
          newAuthors.splice(index, 1);
          setAuthorStates((states) => {
            const newStates = { ...states };
            delete newStates[author.id];
            return newStates;
          });
        }

        return newAuthors;
      });
    } catch (err: any) {
      console.error("[SuggestedAuthorsSidebar] Follow failed:", err);
      toast.error(err.message || "Failed to follow author");

      setAuthors(previousAuthors);
      setAuthorStates(previousStates);
    }
  };

  if (loadingState === "loading") {
    return (
      <div className="mb-8" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            Suggested for you
          </span>
        </div>
        <div className="space-y-4" style={{ minHeight: `${limit * 60}px` }}>
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-2 w-32 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <LoginPromptComponent />
      </div>
    );
  }

  if (loadingState === "error") {
    return (
      <div className="mb-8" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            Suggested for you
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="size-10 rounded-full bg-red-500/10 grid place-items-center mx-auto mb-3">
            <AlertCircle className="size-5 text-red-500" />
          </div>
          <p className="text-sm font-medium mb-1">Couldn't load suggestions</p>
          <p className="text-xs text-muted-foreground mb-3">
            {error || "Something went wrong."}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
        </div>
        <LoginPromptComponent />
      </div>
    );
  }

  if (authors.length === 0) {
    return (
      <div className="mb-8" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            Suggested for you
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          You're all caught up! No new suggestions right now.
        </p>
        <LoginPromptComponent />
      </div>
    );
  }

  return (
    <div className="mb-8" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground font-semibold">
          {isAuthenticated ? "Suggested for you" : "Featured writers"}
        </span>
      </div>
      <div className="space-y-4" style={{ minHeight: `${Math.max(authors.length, 1) * 60}px` }}>
        {authors.map((author) => {
          const state = authorStates[author.id] || {
            followLoading: false,
            replacing: false,
          };

          return (
            <div
              key={author.id}
              className={`flex items-center gap-3 transition-all duration-300 ${
                state.replacing ? "opacity-40" : "opacity-100"
              }`}
              style={{
                height: state.replacing ? undefined : "auto",
                overflow: state.replacing ? "hidden" : "visible",
              }}
            >
              <Link
                to="/author/$id"
                params={{ id: author.handle }}
                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
              >
                <img
                  src={
                    author.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=random`
                  }
                  alt={author.name}
                  className="size-11 rounded-full object-cover flex-none"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {author.handle}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {author.name}
                  </p>
                </div>
              </Link>

              {isAuthenticated && (
                <button
                  onClick={() => handleFollow(author)}
                  disabled={state.followLoading}
                  className="flex-none text-xs font-semibold text-accent hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  aria-label={`Follow ${author.name}`}
                >
                  {state.followLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <LoginPromptComponent />
    </div>
  );
}
