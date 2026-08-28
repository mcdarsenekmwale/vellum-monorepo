import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { X, Sparkles, User, Send, StopCircle, AlertTriangle, RotateCcw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiBaseUrl } from '@/config/env';

interface AiWebSharedChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileOwnerId?: string | null;
  profileOwnerAvatar?: string | null;
  profileOwnerName?: string | null;
  isOwner?: boolean;
  /** If the viewer is authenticated at all (guest vs logged-in user). */
  isAuthenticated?: boolean;
  /** Viewer avatar to render for outgoing messages. */
  viewerAvatar?: string | null;
  /** Viewer display name for fallback label. */
  viewerName?: string | null;
}

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
}

const SHORTCUTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Post ideas',
    prompt: 'Give me 3 post ideas tailored to my profile audience this week.',
  },
  {
    label: 'Reply suggestions',
    prompt: 'Draft 3 friendly reply snippets I can use on my most recent comments.',
  },
  {
    label: 'Caption drafts',
    prompt: 'Write 5 short caption drafts for a carousel post – mix of funny, inspirational, and call-to-action.',
  },
  {
    label: 'Growth tips',
    prompt: 'Give me 4 concrete 10-minute growth tasks for today based on my profile trends.',
  },
];

/** Quick pseudo-unique id – good enough for a local message list key. */
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const PLACEMENT = 'web-profile';

function initialAssistantMessage(ownerName?: string | null): ChatMessage {
  const who = ownerName ? ownerName.trim() : 'you';
  return {
    id: uid(),
    role: 'assistant',
    content: `Hi ${who.includes('you') ? 'there' : who} 👋 I'm Vell AI Coach. I can brainstorm posts, reply to comments, refine captions, and spot growth trends. Tap a shortcut below or just ask.`,
    timestamp: Date.now(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   AiWebSharedChatDrawer – shared chat panel, dual-access entry points
   (coach bar CTA + scroll-aware FAB). Right-side slide-in drawer,
   built with raw fixed positioning + transitions (web-app shadcn/ui
   kit ships without Drawer/Sheet primitives).
   ────────────────────────────────────────────────────────────────── */

export function AiWebSharedChatDrawer(props: AiWebSharedChatDrawerProps) {
  const {
    open,
    onOpenChange,
    profileOwnerId = null,
    profileOwnerAvatar = null,
    profileOwnerName = null,
    isOwner = false,
    isAuthenticated = false,
    viewerAvatar = null,
    viewerName = null,
  } = props;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    initialAssistantMessage(profileOwnerName),
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastRetryRef = useRef<{ content: string } | null>(null);

  // Reset messages when the drawer opens for a fresh session feel
  // (but only the *first* open after being closed for a while).
  const firstOpenRef = useRef(true);
  useEffect(() => {
    if (open && firstOpenRef.current) {
      firstOpenRef.current = false;
      setMessages([initialAssistantMessage(profileOwnerName)]);
    }
  }, [open, profileOwnerName]);

  // Lock body scroll when the drawer is open (mobile-friendly).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const original = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original;
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Autoscroll to the latest message on change.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  // Focus textarea on open.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => textareaRef.current?.focus(), 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  /* ─── SSE streamer ──────────────────────────────────────────────── */

  const sendMessage = useCallback(
    async (userContent: string) => {
      const trimmed = userContent.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setError(null);
      setStreaming(true);
      lastRetryRef.current = { content: trimmed };

      // SSE parser – inline, same shape as admin dashboard's streamAiChat.
      let cancelled = false;
      let controller: AbortController | null = null;

      stopRef.current = () => {
        cancelled = true;
        controller?.abort();
      };

      try {
        const token =
          localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('accessToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        controller = new AbortController();

        // Try a list of candidate chat endpoints. All are speculative –
        // the first one that returns a 200 streaming response wins.
        const candidateUrls: string[] = [
          `${apiBaseUrl}/api/ai/chat`,
          `${apiBaseUrl}/api/ai/stream`,
          `${apiBaseUrl}/api/v1/ai/chat`,
        ];

        let resp: Response | null = null;
        let usedUrl = candidateUrls[0];
        for (const url of candidateUrls) {
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                message: trimmed,
                placement: PLACEMENT,
                context: { profileOwnerId },
              }),
              signal: controller.signal,
            });
            if (r.ok) {
              resp = r;
              usedUrl = url;
              break;
            }
          } catch {
            // try next
          }
        }

        if (!resp || !resp.body) {
          // No reachable endpoint – synthesize a deterministic demo reply
          // so the drawer is still demonstrable on pre-backend stacks.
          if (!cancelled) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      content: buildDemoReply(trimmed, profileOwnerName),
                    }
                  : m,
              ),
            );
          }
          setStreaming(false);
          stopRef.current = null;
          return;
        }
        void usedUrl;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulated = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frame delimiter is \n\n
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = frame.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const chunk = JSON.parse(payload);
                const delta =
                  chunk?.delta ??
                  chunk?.content ??
                  chunk?.choices?.[0]?.delta?.content ??
                  chunk?.choices?.[0]?.message?.content ??
                  '';
                if (typeof delta === 'string' && delta) {
                  accumulated += delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, content: accumulated }
                        : m,
                    ),
                  );
                }
              } catch {
                // ignore malformed line
              }
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.name === 'AbortError'
              ? 'Stopped.'
              : e?.message || 'Sorry, something went wrong.',
          );
        }
      } finally {
        setStreaming(false);
        stopRef.current = null;
      }
    },
    [streaming, profileOwnerId, profileOwnerName],
  );

  const handleStop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setStreaming(false);
  }, []);

  const handleRetry = useCallback(() => {
    if (!lastRetryRef.current) return;
    setError(null);
    void sendMessage(lastRetryRef.current.content);
  }, [sendMessage]);

  const handleShortcut = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const showLoginGate = !(isAuthenticated && isOwner);

  /* ─── Render ────────────────────────────────────────────────────── */

  return (
    <AiDrawerShell open={open} onClose={() => onOpenChange(false)}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-center size-10 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
          <Sparkles className="size-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-[15px] leading-tight">
            Vell AI Coach
          </h2>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Growth coach for your profile
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close chat"
          className="size-9 grid place-items-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* ─── Login gate (unauthenticated viewers) ───────────────── */}
      {showLoginGate && (
        <LoginGate ownerName={profileOwnerName} onClose={() => onOpenChange(false)} />
      )}

      {!showLoginGate && (
        <>
          {/* ─── Error banner ───────────────────────────────────── */}
          {error && (
            <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 p-3 flex items-start gap-3 shrink-0">
              <AlertTriangle
                className="size-4 text-red-500 shrink-0 mt-0.5"
                aria-hidden
              />
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-medium text-red-700 dark:text-red-300">
                  {error.startsWith('Stopped') ? 'Stopped' : 'Sorry, something went wrong.'}
                </p>
                {!error.startsWith('Stopped') && (
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 truncate">
                    {error}
                  </p>
                )}
              </div>
              {!error.startsWith('Stopped') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="shrink-0"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* ─── Messages body ──────────────────────────────────── */}
          <div
            ref={bodyRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar"
          >
            {messages.map((m, idx) => (
              <MessageBubble
                key={m.id}
                msg={m}
                streaming={
                  streaming &&
                  idx === messages.length - 1 &&
                  m.role === 'assistant'
                }
                assistantAvatar={profileOwnerAvatar}
                userAvatar={viewerAvatar}
                userName={viewerName}
              />
            ))}
          </div>

          {/* ─── Shortcut chips ─────────────────────────────────── */}
          <div className="px-4 pt-2 pb-1 shrink-0">
            <div className="flex flex-wrap gap-2">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={streaming}
                  onClick={() => handleShortcut(s.prompt)}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-medium border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
                    streaming && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Input bar ──────────────────────────────────────── */}
          <div className="p-4 border-t border-border shrink-0 bg-card">
            <div className="flex items-end gap-2 rounded-xl border border-border focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all bg-background">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask Vell AI Coach for help with growing your profile…"
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground max-h-36"
                style={{ minHeight: '40px' }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 144) + 'px';
                }}
              />
              {streaming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  className="m-1.5"
                >
                  <StopCircle className="size-3.5" aria-hidden />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void sendMessage(input)}
                  disabled={!input.trim()}
                  className="m-1.5 bg-emerald-600 hover:bg-emerald-600/90 text-white"
                >
                  <Send className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground/70 px-1">
              Enter to send · Shift + Enter for newline · AI may be incorrect
            </p>
          </div>
        </>
      )}
    </AiDrawerShell>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

/** Custom right-side drawer shell – fills in for missing shadcn Drawer. */
function AiDrawerShell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = window.setTimeout(() => setMounted(false), 260);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      aria-modal="true"
      role="dialog"
      aria-label="Vell AI Coach chat"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* Panel – right side, full-height mobile, 440px desktop */}
      <div
        className={cn(
          'absolute top-0 right-0 bottom-0 w-full sm:w-[440px] max-w-[100vw]',
          'bg-card border-l border-border shadow-2xl flex flex-col',
          'transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          transitionDuration: '260ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  streaming,
  assistantAvatar,
  userAvatar,
  userName,
}: {
  msg: ChatMessage;
  streaming: boolean;
  assistantAvatar: string | null;
  userAvatar: string | null;
  userName: string | null;
}) {
  const isUser = msg.role === 'user';
  return (
    <div
      className={cn(
        'flex items-end gap-2.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <ChatAvatar
          src={userAvatar}
          fallback={<User className="size-4" />}
          fallbackBg="bg-muted"
          alt={userName || 'You'}
        />
      ) : (
        <ChatAvatar
          src={assistantAvatar}
          fallback={
            <Sparkles
              className="size-4 text-emerald-600"
              strokeWidth={2.25}
            />
          }
          fallbackBg="bg-emerald-500/10"
          alt="Vell AI Coach"
        />
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'rounded-br-md bg-emerald-600 text-white shadow-sm'
            : 'rounded-bl-md bg-muted text-foreground border border-border/60',
        )}
      >
        {msg.content}
        {streaming && (
          <span
            className="inline-block w-[6px] h-[14px] align-[-2px] ml-0.5 bg-current rounded-[1px] animate-pulse"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function ChatAvatar({
  src,
  fallback,
  fallbackBg,
  alt,
}: {
  src: string | null;
  fallback: React.ReactNode;
  fallbackBg: string;
  alt: string;
}) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setErrored(true)}
        className="size-7 rounded-full object-cover border border-border/60 shrink-0 bg-muted"
      />
    );
  }
  return (
    <div
      className={cn(
        'size-7 rounded-full grid place-items-center shrink-0 border border-border/60',
        fallbackBg,
      )}
    >
      {fallback}
    </div>
  );
}

function LoginGate({
  ownerName,
  onClose,
}: {
  ownerName: string | null;
  onClose: () => void;
}) {
  const handleLogin = () => {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    onClose();
    window.location.assign(`/login?redirect=${redirect}`);
  };
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="size-16 rounded-full bg-emerald-500/10 grid place-items-center mb-4">
        <LogIn className="size-7 text-emerald-600" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold">Login to chat</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
        {ownerName
          ? `Hi there! Please sign in to ask Vell AI Coach about ${ownerName}'s profile growth.`
          : 'Sign in to get personalized growth tips, caption drafts, and post ideas from Vell AI Coach.'}
      </p>
      <Button
        variant="default"
        onClick={handleLogin}
        className="mt-5 bg-emerald-600 hover:bg-emerald-600/90 text-white"
      >
        <LogIn className="size-4" aria-hidden />
        Log in
      </Button>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Deterministic demo reply – used when no backend stream endpoint is reachable yet. */
function buildDemoReply(userMessage: string, ownerName: string | null): string {
  const msg = userMessage.toLowerCase();
  const who = ownerName ? ownerName.trim() : 'Creator';

  if (msg.includes('idea') || msg.includes('post')) {
    return `Great question, ${who}. Here are 3 post ideas tuned to your profile:\n\n1. **"Before/After carousel"** — show a 5-slide transformation of something you worked on, with one tip per slide. Saturday 10am posting gives the highest reach for carousels.\n\n2. **"Hot take thread"** — pick one niche belief, lead with the take, then lay out 3 data points from your recent posts.\n\n3. **"Day in the life" Reel** — a 45s vertical clip with captions on 3 decisions that shaped your week; pair with a link-in-bio to your latest long-form.\n\nWant me to expand any into a full draft?`;
  }
  if (msg.includes('reply') || msg.includes('comment')) {
    return `Sure — 3 reply snippets you can adapt and send today:\n\n• *Short thanks*: "Appreciate the kind words 🙏 glad this landed — what topic should I cover next?"\n\n• *Deeper conversation*: "Interesting — I used to think the same until [X]. Have you tried [Y]?"\n\n• *Shout-out*: "This made my day — sharing it in my next newsletter. You just earned a free feature ⭐"\n\nI can tailor these if you paste a specific comment thread.`;
  }
  if (msg.includes('caption') || msg.includes('draft')) {
    return `5 caption micro-drafts, ready to plug in:\n\n1. *Funny* — "I made this twice because I burned the first one. Swipe for the lesson. 🔥"\n2. *Inspirational* — "Small daily choices compound into big results. What are you choosing today?"\n3. *CTA* — "Save this for next time you need a 10-minute idea → and tell me your take below 👇"\n4. *Question* — "Raise your hand if you've ever struggled with [topic]. 🙋♀️ Mine was last Tuesday."\n5. *Story* — "3 months ago I posted one thing that changed everything. Here's what happened…"\n\nPick a number and I'll expand into 5 variants with hashtags.`;
  }
  if (msg.includes('growth') || msg.includes('tip') || msg.includes('task')) {
    return `Hi ${who}. Four 10-minute growth tasks for TODAY:\n\n1. ✅ Update your bio link to point to your *best* performing post (not newest) — converts 2× better.\n2. ✅ Leave 5 thoughtful replies to creators one tier above you (top-comment bias).\n3. ✅ Cross-post your best recent idea as a 4-slide carousel. Repurposing compounds.\n4. ✅ Schedule your next post for **Saturday 10am** local — creator data shows +32% reach vs. weekday 2pm.\n\nWant a 7-day plan built around these levers?`;
  }
  return `Got it — here's how I can help right now:\n\n• 🎯 **Post ideas** — 3 tailored prompts for your next three posts\n• 💬 **Reply snippets** — comment responses that spark more conversation\n• ✍️ **Caption drafts** — tone variants with hashtags and hooks\n• 📈 **Growth tasks** — prioritized 10-minute daily levers, data-backed\n\nPick one (or just paste your current draft) and let's go.`;
}

export default AiWebSharedChatDrawer;
