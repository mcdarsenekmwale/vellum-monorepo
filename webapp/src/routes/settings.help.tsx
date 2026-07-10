import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { ArrowLeft, ChevronDown, Mail } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Vellum" },
      { name: "description", content: "Frequently asked questions and support for Vellum." },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  {
    question: "How do I publish a story?",
    answer:
      "Tap the Create button in the sidebar (or the compose icon on mobile) to open the editor. Add a title, body, and cover image, then choose Publish when you are ready. Drafts are saved automatically as you write.",
  },
  {
    question: "How do bookmarks work?",
    answer:
      "Tap the bookmark icon on any story to save it to your Saved tab. Bookmarks are private and sync across your devices when you are signed in to the same account.",
  },
  {
    question: "Can I change my username?",
    answer:
      "Yes. Go to Settings → Edit profile to update your handle. Usernames must be unique and can only be changed once every 30 days.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Account deletion is permanent and cannot be undone. Open Settings → Privacy, then scroll to the bottom and select Delete account. You will be asked to confirm before any data is removed.",
  },
  {
    question: "How do I report inappropriate content?",
    answer:
      "Open the story, tap the more (•••) menu in the top right, then choose Report. Choose a reason and submit. Our moderation team reviews every report within 24 hours.",
  },
];

function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpen((prev) => (prev === index ? null : index));
  };

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

        <h1 className="text-3xl font-display italic mb-2">Help Center</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Answers to common questions about using Vellum.
        </p>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mb-10">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={index}>
                <button
                  onClick={() => toggle(index)}
                  className="w-full flex items-center justify-between gap-4 p-4 hover:bg-muted transition-colors text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium">{faq.question}</span>
                  <ChevronDown
                    className={`size-5 text-muted-foreground shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.8}
                  />
                </button>
                {isOpen && (
                  <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
            Still need help?
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button className="w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left">
              <div className="size-10 rounded-full bg-muted grid place-items-center shrink-0">
                <Mail className="size-5" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Contact Us</p>
                <p className="text-xs text-muted-foreground">
                  Reach out to our support team and we will get back to you within 24 hours.
                </p>
              </div>
              <span className="text-sm font-semibold text-accent">Email</span>
            </button>
          </div>
        </section>
      </div>
    </WebShell>
  );
}
