import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/settings/about")({
  head: () => ({
    meta: [
      { title: "About — Vellum" },
      { name: "description", content: "About the Vellum reading platform." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Back to settings
        </Link>

        <section className="text-center py-12">
          <h1 className="font-display italic text-5xl mb-4">Vellum.</h1>
          <p className="text-sm text-muted-foreground mb-6">Version 1.0.0</p>

          <p className="text-sm text-foreground/80 leading-relaxed max-w-[480px] mx-auto mb-10">
            Vellum is a modern reading and storytelling platform built for writers and
            readers who care about typography, design, and the quiet pleasure of a well-made
            page. Publish stories, follow your favourite voices, and discover writing that
            lingers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
            <a href="#" className="hover:underline">
              Terms of Service
            </a>
            <a href="#" className="hover:underline">
              Open Source Licenses
            </a>
          </div>

          <p className="mt-10 text-xs text-muted-foreground">© 2026 Vellum</p>
        </section>
      </div>
    </WebShell>
  );
}
