import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, ImagePlus, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useCategories } from "@/hooks/useApi";

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "New story — Vellum" },
      { name: "description", content: "Draft and publish a new story on Vellum." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/compose" } });
    }
  },
  component: ComposePage,
});

function ComposePage() {
  const nav = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [body, setBody] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (categories && categories.length > 0 && !section) {
      setSection(categories[0].name);
    }
  }, [categories, section]);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readMins = Math.max(1, Math.round(wordCount / 220));

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and body to publish");
      return;
    }
    const selectedCategory = categories?.find((c) => c.name === section);
    if (!selectedCategory) {
      toast.error("Please select a valid section");
      return;
    }

    const excerpt = body
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
      .substring(0, 200);

    setIsPublishing(true);
    try {
      await apiClient.createArticle({
        title: title.trim(),
        excerpt,
        body: body.trim().split("\n").filter(Boolean),
        categoryId: selectedCategory.id,
      });
      toast.success("Story published to your profile");
      nav({ to: "/profile" });
    } catch (err: any) {
      toast.error(err.message || "Failed to publish story");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <WebShell>
      <div className="max-w-[860px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => nav({ to: "/" })}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Cancel
          </button>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Draft · {readMins} min read
          </div>
          <button
            onClick={publish}
            disabled={isPublishing || categoriesLoading}
            className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
          >
            <Send className="size-3" />
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        </div>

        {/* Editor Card */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 space-y-6">
          {/* Cover image uploader */}
          <button className="w-full aspect-[21/9] rounded-2xl border-2 border-dashed border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors group">
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="size-7" strokeWidth={1.4} />
              <span className="text-xs font-bold uppercase tracking-widest">
                Add cover image
              </span>
              <span className="text-[10px] text-muted-foreground/70 normal-case tracking-normal">
                Recommended 1600 × 900 px
              </span>
            </div>
          </button>

          {/* Section picker */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Section
            </label>
            {categoriesLoading ? (
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.name)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest border transition-colors ${
                      section === s.name
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your title"
              className="w-full font-display italic text-4xl md:text-5xl leading-tight bg-transparent outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing your story…"
            rows={14}
            className="w-full bg-transparent outline-none resize-none text-base leading-relaxed placeholder:text-muted-foreground/50 border-t border-border pt-6"
          />

          {/* Footer bar */}
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
            <span>{wordCount} words</span>
            <button className="flex items-center gap-1 text-accent hover:opacity-80">
              <Sparkles className="size-3" />
              Suggest a title
            </button>
          </div>
        </div>
      </div>
    </WebShell>
  );
}
