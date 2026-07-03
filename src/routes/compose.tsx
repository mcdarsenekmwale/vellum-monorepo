import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { ChevronLeft, ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";

const sections = ["Culture", "Design", "Environment", "Music", "Architecture", "Technology"];

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "New story — Vellum" },
      { name: "description", content: "Draft and publish a new story on Vellum." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComposePage,
});

function ComposePage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [section, setSection] = useState(sections[0]);
  const [body, setBody] = useState("");

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readMins = Math.max(1, Math.round(wordCount / 220));

  const publish = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and body to publish");
      return;
    }
    toast.success("Story published to your profile");
    nav({ to: "/profile" });
  };

  return (
    <PhoneShell
      header={
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <button
            onClick={() => nav({ to: "/" })}
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Cancel
          </button>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Draft · {readMins} min
          </div>
          <button
            onClick={publish}
            className="rounded-full bg-accent text-accent-foreground px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
          >
            Publish
          </button>
        </nav>
      }
    >
      <section className="px-6 pt-4 pb-24 space-y-6">
        <button className="w-full aspect-[4/2.2] rounded-2xl border-2 border-dashed border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors">
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="size-6" strokeWidth={1.6} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Add cover image</span>
          </div>
        </button>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
            Section
          </label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                  section === s
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your title"
            className="w-full font-display italic text-3xl leading-tight bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Start writing…"
          rows={12}
          className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-muted-foreground/50"
        />

        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
          <span>{wordCount} words</span>
          <button className="flex items-center gap-1 text-accent">
            <Sparkles className="size-3" />
            Suggest a title
          </button>
        </div>
      </section>
    </PhoneShell>
  );
}
