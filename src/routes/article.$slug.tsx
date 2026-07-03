import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { ArticleActions } from "@/components/ArticleActions";
import { articles, type Comment } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { ChevronLeft, Send } from "lucide-react";

export const Route = createFileRoute("/article/$slug")({
  loader: ({ params }) => {
    const article = articles.find((a) => a.slug === params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Story not found — Vellum" }, { name: "robots", content: "noindex" }] };
    }
    const a = loaderData.article;
    return {
      meta: [
        { title: `${a.title} — Vellum` },
        { name: "description", content: a.excerpt },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.excerpt },
        { property: "og:image", content: a.cover },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: a.cover },
      ],
    };
  },
  component: ArticleDetail,
  notFoundComponent: () => (
    <PhoneShell>
      <div className="p-10 text-center space-y-4">
        <h1 className="font-display italic text-3xl">Story not found</h1>
        <Link to="/" className="text-accent text-sm font-bold uppercase tracking-widest">
          Back to feed
        </Link>
      </div>
    </PhoneShell>
  ),
});

function ArticleDetail() {
  const { article } = Route.useLoaderData();
  const { commentsFor, addComment } = useSocial();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const all = commentsFor(article.slug);
  const threads = useMemo(() => {
    const roots = all.filter((c) => !c.parentId);
    return roots.map((r) => ({
      root: r,
      replies: all.filter((c) => c.parentId === r.id),
    }));
  }, [all]);

  const submit = () => {
    if (!draft.trim()) return;
    addComment(article.slug, draft, replyTo?.id);
    setDraft("");
    setReplyTo(null);
  };

  return (
    <PhoneShell
      header={
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <Link to="/" className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Feed
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {article.readMinutes} min
          </div>
        </nav>
      }
    >
      <article className="animate-entry">
        <div className="relative w-full aspect-[4/5] bg-muted overflow-hidden">
          <img src={article.cover} alt={article.title} className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="px-6 pt-4 pb-6 -mt-10 relative">
          <div className="font-mono text-[10px] text-accent font-semibold uppercase tracking-widest mb-2">
            {article.category}
          </div>
          <h1 className="text-[32px] font-display italic leading-[1.05] text-balance mb-4">
            {article.title}
          </h1>

          <Link
            to="/author/$id"
            params={{ id: article.author.id }}
            className="flex items-center gap-3 py-4 border-y border-border"
          >
            <img src={article.author.avatar} alt="" className="size-10 rounded-full object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{article.author.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {article.author.publication ?? article.author.handle} · {article.publishedAgo}
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest border border-foreground rounded-full px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors">
              Follow
            </span>
          </Link>

          <div className="prose prose-sm max-w-none mt-6 space-y-4">
            <p className="font-display italic text-lg leading-relaxed text-foreground">
              {article.excerpt}
            </p>
            {article.body.map((p: string, i: number) => (
              <p key={i} className="text-[15px] leading-relaxed text-foreground/85">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-8 py-4 border-y border-border">
            <ArticleActions slug={article.slug} baseLikes={article.likes} />
          </div>
        </div>

        {/* Comments */}
        <section className="px-6 pb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-6">
            Discussion · {all.length}
          </h2>
          <div className="space-y-6">
            {threads.map(({ root, replies }) => (
              <CommentBlock
                key={root.id}
                comment={root}
                replies={replies}
                onReply={setReplyTo}
              />
            ))}
            {threads.length === 0 && (
              <p className="text-sm text-muted-foreground">Be the first to reply.</p>
            )}
          </div>
        </section>
      </article>

      {/* Comment composer */}
      <div className="absolute bottom-[68px] left-0 right-0 px-4 pb-2 pt-2 bg-background/95 backdrop-blur-xl border-t border-border z-20">
        {replyTo && (
          <div className="flex items-center justify-between px-2 pb-2 text-[11px]">
            <span className="text-muted-foreground">
              Replying to <span className="text-foreground font-medium">{replyTo.author.name}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-accent font-bold">
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={replyTo ? "Write a reply…" : "Join the discussion…"}
            className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="size-10 grid place-items-center rounded-full bg-accent text-accent-foreground disabled:opacity-40 shrink-0"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function CommentBlock({
  comment,
  replies,
  onReply,
}: {
  comment: Comment;
  replies: Comment[];
  onReply: (c: Comment) => void;
}) {
  return (
    <div className="flex gap-3">
      <img src={comment.author.avatar} alt="" className="size-8 rounded-full object-cover shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium truncate">{comment.author.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{comment.ago}</span>
        </div>
        <p className="text-sm text-foreground/85 leading-relaxed mt-0.5">{comment.body}</p>
        <button
          onClick={() => onReply(comment)}
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent mt-2"
        >
          Reply
        </button>

        {replies.length > 0 && (
          <div className="mt-4 space-y-4 border-l-2 border-border pl-4">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-3">
                <img src={r.author.avatar} alt="" className="size-7 rounded-full object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium truncate">{r.author.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{r.ago}</span>
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed mt-0.5">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
