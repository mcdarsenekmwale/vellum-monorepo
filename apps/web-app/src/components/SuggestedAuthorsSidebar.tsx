"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, RefreshCw, AlertCircle, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { useLoginPrompt } from "@/components/LoginPrompt";
import { useAuthState } from "@/hooks/useApi";
import type { SuggestedAuthor } from "@/lib/api";
import { useI18n } from "./providers/I18nProvider";
import { cn } from "@/lib/utils";

interface SuggestedAuthorsSidebarProps {
  limit?: number;
  suggestedAuthors?: SuggestedAuthor[];
}

type LoadingState = "idle" | "loading" | "error" | "success";

interface AuthorState {
  followLoading: boolean;
  isLeaving: boolean;
  isEntering: boolean;
  followSuccess?: boolean;
}

export function SuggestedAuthorsSidebar({ limit = 5, suggestedAuthors = [] }: SuggestedAuthorsSidebarProps) {
  const { t } = useI18n();
  const [authors, setAuthors] = useState<SuggestedAuthor[]>(suggestedAuthors);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [authorStates, setAuthorStates] = useState<Record<string, AuthorState>>({});
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isAuthenticated } = useAuthState();
  const { promptLogin, LoginPromptComponent } = useLoginPrompt();

  // ─── Track followed author IDs to prevent duplicates ───
  const followedAuthorIds = useMemo(() => {
    return new Set(authors.filter(a => followedIds.has(a.id)).map(a => a.id));
  }, [authors, followedIds]);

  const fetchSuggested = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const response = await apiClient.getSuggestedAuthors(limit, 0);
      
      // Filter out any already followed authors
      const filteredAuthors = response.data.filter(
        (author) => !followedIds.has(author.id)
      );
      
      setAuthors(filteredAuthors);

      const initialStates: Record<string, AuthorState> = {};
      filteredAuthors.forEach((a) => {
        initialStates[a.id] = { 
          followLoading: false, 
          isLeaving: false, 
          isEntering: false 
        };
      });
      setAuthorStates(initialStates);

      setLoadingState("success");
    } catch (err: any) {
      console.error("[SuggestedAuthorsSidebar] Failed to load:", err);
      setError(err.message || "Failed to load suggestions");
      setLoadingState("error");
    }
  }, [limit, followedIds]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  // ─── Cleanup timeouts on unmount ───
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleRetry = () => {
    fetchSuggested();
  };

  // ─── Fetch replacement author ───
  const fetchReplacement = useCallback(async (authorId: string): Promise<SuggestedAuthor | null> => {
    try {
      const response = await apiClient.getSuggestedAuthorReplacement(authorId);
      return response;
    } catch (err) {
      console.error("[SuggestedAuthorsSidebar] Failed to fetch replacement:", err);
      return null;
    }
  }, []);

  // ─── Handle follow with smooth animation ───
  const handleFollow = async (author: SuggestedAuthor) => {
    if (!isAuthenticated) {
      promptLogin("follow this author");
      return;
    }

    // Prevent duplicate follow attempts
    if (followedIds.has(author.id)) {
      toast.info(`You're already following ${author.name}`);
      return;
    }

    // Set loading state
    setAuthorStates((prev) => ({
      ...prev,
      [author.id]: { 
        ...prev[author.id], 
        followLoading: true, 
        isLeaving: false,
        isEntering: false 
      },
    }));

    try {
      // ─── Step 1: Follow the author ───
      await apiClient.toggleFollow(author.id);
      
      // Add to followed set
      setFollowedIds((prev) => new Set(prev).add(author.id));
      
      toast.success(`You're now following ${author.name}`);

      // ─── Step 2: Trigger exit animation ───
      setAuthorStates((prev) => ({
        ...prev,
        [author.id]: { 
          ...prev[author.id], 
          followLoading: false, 
          isLeaving: true,
          followSuccess: true 
        },
      }));

      // ─── Step 3: After animation completes, remove or replace ───
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(async () => {
        // Try to get a replacement author
        const replacement = await fetchReplacement(author.id);

        setAuthors((prev) => {
          const currentAuthors = [...prev];
          const index = currentAuthors.findIndex((a) => a.id === author.id);
          
          if (index === -1) return prev;

          // Remove the followed author
          currentAuthors.splice(index, 1);

          // If we have a replacement and it's not already in the list
          if (replacement && !currentAuthors.some(a => a.id === replacement.id)) {
            // Add replacement at the same position
            currentAuthors.splice(index, 0, replacement);
            
            // Initialize state for the new author
            setAuthorStates((states) => {
              const newStates = { ...states };
              // Remove old author state
              delete newStates[author.id];
              // Add new author state
              newStates[replacement.id] = { 
                followLoading: false, 
                isLeaving: false, 
                isEntering: true,
                followSuccess: false 
              };
              return newStates;
            });

            // Remove entering animation after a delay
            setTimeout(() => {
              setAuthorStates((states) => ({
                ...states,
                [replacement.id]: { 
                  ...states[replacement.id], 
                  isEntering: false 
                },
              }));
            }, 300);
          } else {
            // Just remove the author
            setAuthorStates((states) => {
              const newStates = { ...states };
              delete newStates[author.id];
              return newStates;
            });
          }

          return currentAuthors;
        });

        animationTimeoutRef.current = null;
      }, 500); // Wait for exit animation to complete

    } catch (err: any) {
      console.error("[SuggestedAuthorsSidebar] Follow failed:", err);
      toast.error(err.message || "Failed to follow author");
      
      // Reset state on error
      setAuthorStates((prev) => ({
        ...prev,
        [author.id]: { 
          ...prev[author.id], 
          followLoading: false, 
          isLeaving: false,
          isEntering: false 
        },
      }));
    }
  };

  // ─── Loading state ───
  if (loadingState === "loading") {
    return (
      <div className="mb-8 overflow-hidden" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            {t("home.suggestedForYou")}
          </span>
        </div>
        <div className="space-y-4 overflow-hidden" style={{ minHeight: `${Math.min(limit, 5) * 60}px` }}>
          {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 overflow-hidden">
              <div className="size-11 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
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

  // ─── Error state ───
  if (loadingState === "error") {
    return (
      <div className="mb-8 overflow-hidden" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            {t("home.suggestedForYou")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center overflow-hidden">
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

  // ─── Empty state ───
  if (authors.length === 0) {
    return (
      <div className="mb-8 overflow-hidden" ref={containerRef}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-semibold">
            {t("home.suggestedForYou")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 text-center overflow-hidden">
          <div className="size-12 rounded-full bg-primary/10 grid place-items-center mx-auto mb-3">
            <Check className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">
            You're following all suggested authors.
          </p>
        </div>
        <LoginPromptComponent />
      </div>
    );
  }

  // ─── Main render ───
  return (
    <div 
      className="mb-4 overflow-hidden" 
      ref={containerRef}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground font-semibold">
          {isAuthenticated ? t("home.suggestedForYou") : "Featured writers"}
        </span>
      </div>
      
      {/* ─── Fixed height container with overflow hidden ─── */}
      <div 
        className="space-y-4 overflow-hidden" 
        style={{ 
          minHeight: `${Math.max(authors.length, 1) * 60}px`,
          maxHeight: `${Math.min(authors.length, limit) * 60 + 20}px`
        }}
      >
        {authors.map((author) => {
          const state = authorStates[author.id] || {
            followLoading: false,
            isLeaving: false,
            isEntering: false,
          };

          const isFollowing = followedIds.has(author.id);

          return (
            <div
              key={author.id}
              className={cn(
                "flex items-center gap-3 transition-all duration-300 ease-in-out overflow-hidden",
                state.isLeaving && "opacity-0 -translate-x-4 scale-95 max-h-0 -mb-4",
                state.isEntering && "opacity-0 translate-x-4 scale-95 animate-in fade-in slide-in-from-right-4",
                !state.isLeaving && !state.isEntering && "opacity-100 translate-x-0 scale-100 max-h-16"
              )}
              style={{
                transitionProperty: "all",
                transitionDuration: "300ms",
                transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <Link
                to="/author/$id"
                params={{ id: author.handle }}
                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity overflow-hidden"
              >
                <Avatar
                  src={author.avatar}
                  alt={author.name}
                  name={author.name}
                  handle={author.handle}
                  size="md"
                  className="size-10 shrink-0"
                />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-[13px] font-semibold truncate">
                    {author.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{author.handle}
                  </p>
                </div>
              </Link>

              {isAuthenticated && !isFollowing && (
                <button
                  onClick={() => handleFollow(author)}
                  title={`Follow ${author.name}`}
                  disabled={state.followLoading || state.isLeaving}
                  className={cn(
                    "flex-none text-xs font-semibold text-accent hover:opacity-70",
                    "disabled:opacity-50 disabled:cursor-not-allowed transition-opacity",
                    "cursor-pointer p-1.5 rounded-full hover:bg-accent/10 shrink-0"
                  )}
                  aria-label={`Follow ${author.name}`}
                >
                  {state.followLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </button>
              )}

              {isAuthenticated && isFollowing && (
                <span className="flex-none text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                  <Check className="size-3.5 text-emerald-500" />
                  Following
                </span>
              )}
            </div>
          );
        })}
      </div>
      <LoginPromptComponent />
    </div>
  );
}