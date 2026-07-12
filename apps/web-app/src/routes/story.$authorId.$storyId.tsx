import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { X, Heart, Send } from "lucide-react";
import { useSocial } from "@/lib/social-store";
import { useStoriesByAuthor, useStories } from "@/hooks/useApi";

function formatStoryTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Less than 1h";
  return `${hours}h left`;
}

export const Route = createFileRoute("/story/$authorId/$storyId")({
  component: StoryViewer,
});

function StoryViewer() {
  const { authorId, storyId } = Route.useParams();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };
  const { markStoryViewed, isStoryViewed, toggleLike, isLiked } = useSocial();

  const { data: authorStoriesData, isLoading: authorStoriesLoading } =
    useStoriesByAuthor(authorId);
  const { data: allStoriesData } = useStories();

  const authorStories = useMemo(() => {
    if (!authorStoriesData) return [];
    return authorStoriesData.filter(
      (s) => new Date(s.expiresAt).getTime() > Date.now()
    );
  }, [authorStoriesData]);

  const validAuthorsWithStories = useMemo(() => {
    if (!allStoriesData) return [];
    const valid = allStoriesData.filter(
      (s) => new Date(s.expiresAt).getTime() > Date.now()
    );
    const uniqueAuthors = new Map<
      string,
      { id: string; handle: string; name: string; avatar?: string }
    >();
    valid.forEach((s) => {
      if (s.author && !uniqueAuthors.has(s.authorId)) {
        uniqueAuthors.set(s.authorId, s.author);
      }
    });
    return Array.from(uniqueAuthors.values());
  }, [allStoriesData]);

  const validAuthorIndex = validAuthorsWithStories.findIndex(
    (a) => a.id === authorId
  );

  const getInitialStoryIndex = useCallback(() => {
    if (!authorStories.length) return 0;
    if (storyId) {
      const idx = authorStories.findIndex((s) => s.id === storyId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  }, [authorStories, storyId]);

  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedProgressRef = useRef<number>(0);

  useEffect(() => {
    if (authorStories.length > 0) {
      const idx = getInitialStoryIndex();
      setCurrentStoryIdx(idx);
      setProgress(authorStories.map(() => 0));
    }
  }, [authorStories, getInitialStoryIndex]);

  const currentStory = authorStories[currentStoryIdx];

  const goToNext = useCallback(() => {
    if (currentStoryIdx < authorStories.length - 1) {
      setProgress((prev) => {
        const next = [...prev];
        next[currentStoryIdx] = 1;
        return next;
      });
      setCurrentStoryIdx((prev) => prev + 1);
    } else {
      const nextAuthorIdx = validAuthorIndex + 1;
      if (nextAuthorIdx < validAuthorsWithStories.length) {
        const nextAuthor = validAuthorsWithStories[nextAuthorIdx];
        const nextAuthorStories = allStoriesData?.filter(
          (s) =>
            s.authorId === nextAuthor.id &&
            new Date(s.expiresAt).getTime() > Date.now()
        );
        if (nextAuthorStories && nextAuthorStories.length > 0) {
          navigate({
            to: "/story/$authorId/$storyId",
            params: {
              authorId: nextAuthor.id,
              storyId: nextAuthorStories[0].id,
            },
          });
        } else {
          goBack();
        }
      } else {
        goBack();
      }
    }
  }, [
    currentStoryIdx,
    authorStories,
    validAuthorIndex,
    validAuthorsWithStories,
    navigate,
    goBack,
    allStoriesData,
  ]);

  const goToPrev = useCallback(() => {
    if (currentStoryIdx > 0) {
      setProgress((prev) => {
        const next = [...prev];
        next[currentStoryIdx - 1] = 0;
        return next;
      });
      setCurrentStoryIdx((prev) => prev - 1);
    } else {
      const prevAuthorIdx = validAuthorIndex - 1;
      if (prevAuthorIdx >= 0) {
        const prevAuthor = validAuthorsWithStories[prevAuthorIdx];
        const prevStories = allStoriesData?.filter(
          (s) =>
            s.authorId === prevAuthor.id &&
            new Date(s.expiresAt).getTime() > Date.now()
        );
        if (prevStories && prevStories.length > 0) {
          navigate({
            to: "/story/$authorId/$storyId",
            params: {
              authorId: prevAuthor.id,
              storyId: prevStories[prevStories.length - 1].id,
            },
          });
        } else {
          goBack();
        }
      } else {
        goBack();
      }
    }
  }, [
    currentStoryIdx,
    validAuthorIndex,
    validAuthorsWithStories,
    navigate,
    goBack,
    allStoriesData,
  ]);

  useEffect(() => {
    if (!currentStory || paused) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    markStoryViewed(currentStory.id);

    const duration = currentStory.duration;

    setProgress((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        if (i < currentStoryIdx) next[i] = 1;
        else if (i > currentStoryIdx) next[i] = 0;
      }
      return next;
    });

    startTimeRef.current =
      performance.now() - pausedProgressRef.current * duration;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const p = Math.min(elapsed / duration, 1);

      setProgress((prev) => {
        const next = [...prev];
        next[currentStoryIdx] = p;
        return next;
      });

      if (p < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        goToNext();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [currentStoryIdx, currentStory, paused, markStoryViewed, goToNext]);

  useEffect(() => {
    if (paused && currentStory) {
      pausedProgressRef.current = progress[currentStoryIdx] || 0;
    }
  }, [paused, currentStory, progress, currentStoryIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, goBack]);

  if (authorStoriesLoading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <p className="text-white text-lg">Loading story...</p>
      </div>
    );
  }

  if (!currentStory || authorStories.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <p className="text-white text-lg">Story not available</p>
        <button
          onClick={goBack}
          className="ml-6 text-amber-500 font-semibold hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  const storyLiked = isLiked(`story:${currentStory.id}`);

  const handleLike = () => {
    toggleLike(`story:${currentStory.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="relative w-full max-w-md h-full md:h-auto md:aspect-[9/16] md:max-h-[90vh] overflow-hidden">
        <img
          src={currentStory.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 flex flex-row">
          <button
            className="flex-1 focus:outline-none"
            onClick={goToPrev}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            aria-label="Previous story"
          />
          <button
            className="flex-1 focus:outline-none"
            onClick={goToNext}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            aria-label="Next story"
          />
        </div>

        <div className="absolute top-0 left-0 right-0 pt-12 px-3">
          <div className="flex gap-1 mb-3">
            {authorStories.map((_, idx) => (
              <div
                key={idx}
                className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-[width] duration-75 ease-linear"
                  style={{ width: `${(progress[idx] || 0) * 100}%` }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  currentStory.author?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    currentStory.author?.name || "User"
                  )}&background=random`
                }
                alt=""
                className="w-9 h-9 rounded-full border-2 border-white/30 object-cover"
              />
              <div>
                <p className="text-white text-sm font-semibold">
                  {currentStory.author?.name}
                </p>
                <p className="text-white/60 text-xs">
                  {formatStoryTimeLeft(currentStory.expiresAt)}
                </p>
              </div>
            </div>
            <button
              onClick={goBack}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
        </div>

        {currentStory.caption && (
          <div className="absolute bottom-24 left-0 right-0 px-5">
            <p className="text-white text-base font-medium drop-shadow-lg">
              {currentStory.caption}
            </p>
          </div>
        )}

        <div className="absolute bottom-6 left-0 right-0 px-5 flex items-center gap-3">
          <div className="flex-1 flex items-center bg-transparent border border-white/50 rounded-full px-4 py-2.5">
            <span className="text-white/70 text-sm">Send message</span>
          </div>
          <button
            onClick={handleLike}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Like story"
          >
            <Heart
              size={28}
              className={storyLiked ? "text-red-500" : "text-white"}
              fill={storyLiked ? "#ef4444" : "none"}
            />
          </button>
          <button
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Share"
          >
            <Send size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
