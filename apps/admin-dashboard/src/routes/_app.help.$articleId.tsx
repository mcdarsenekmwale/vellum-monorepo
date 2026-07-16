import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileText,
  Zap,
  ChevronRight,
  Share2,
  ThumbsUp,
  MessageCircle,
  BookMarked,
  Shield,
  Code,
  Users,
  BarChart3,
  Sparkles,
  LifeBuoy,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useHelpArticleBySlug, useHelpArticles } from "@/lib/api/hooks";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Users,
  Shield,
  Code,
  BarChart3,
  Sparkles,
  Zap,
  FileText,
  LifeBuoy,
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || FileText;
}

export const Route = createFileRoute("/_app/help/$articleId")({
  head: ({ params }) => ({ meta: [{ title: `Help · ${params.articleId} · Vellum Admin` }] }),
  component: HelpArticleDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Article not found.
      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/help">Back to Help Center</Link>
        </Button>
      </div>
    </div>
  ),
});

function HelpArticleDetail() {
  const { articleId } = Route.useParams();
  const { data: article, isLoading, isError } = useHelpArticleBySlug(articleId);
  const { data: relatedArticles } = useHelpArticles({
    category: article?.category,
  });
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  const related = relatedArticles?.filter((a) => a.id !== article?.id).slice(0, 4) ?? [];

  const handleHelpful = (type: "yes" | "no") => {
    setFeedback(type);
    toast.success(type === "yes" ? "Thanks for your feedback!" : "Sorry we couldn't help. We'll improve this article.");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.description,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    toast.success(bookmarked ? "Bookmark removed" : "Article bookmarked");
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/help">
            <ArrowLeft className="size-4" /> Back to Help Center
          </Link>
        </Button>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/help">
            <ArrowLeft className="size-4" /> Back to Help Center
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-10 text-center">
          <BookOpen className="mx-auto size-10 text-muted-foreground/40" />
          <h3 className="mt-3 text-sm font-medium">Article not found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The article you're looking for doesn't exist or has been moved.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/help">Browse help articles</Link>
          </Button>
        </div>
      </div>
    );
  }

  const Icon = getIcon(article.icon);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link to="/help">
          <ArrowLeft className="size-4" /> Back to Help Center
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article className="lg:col-span-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {article.readMinutes} min read
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3.5" />
                    {article.category}
                  </span>
                  {article.popular && (
                    <Badge variant="secondary" className="gap-1 h-5 text-[11px]">
                      <Zap className="size-3" /> Popular
                    </Badge>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    Updated {format(new Date(article.updatedAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {article.description}
            </p>
          </div>

          <Separator />

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {article.content.map((paragraph, index) => (
              <p
                key={index}
                id={`section-${index}`}
                className="text-sm leading-relaxed text-foreground/90 mb-4 scroll-mt-20"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Was this helpful?</span>
              <Button
                variant={feedback === "yes" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => handleHelpful("yes")}
                disabled={feedback !== null}
              >
                <ThumbsUp className="size-3.5" /> Yes
              </Button>
              <Button
                variant={feedback === "no" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => handleHelpful("no")}
                disabled={feedback !== null}
              >
                <MessageCircle className="size-3.5" /> No
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleShare}>
                <Share2 className="size-3.5" /> Share
              </Button>
              <Button
                variant={bookmarked ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8"
                onClick={handleBookmark}
              >
                <BookMarked className="size-3.5" /> {bookmarked ? "Bookmarked" : "Bookmark"}
              </Button>
            </div>
          </div>

          <SectionCard className="p-5">
            <div className="flex items-start gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <LifeBuoy className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">Still need help?</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Can't find what you're looking for? Our support team is here to help.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="gap-1.5" asChild>
                    <Link to="/help" search={{ ticket: "open" }}>
                      <MessageCircle className="size-3.5" /> Contact support
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="mailto:support@vellum.app">Email us</a>
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </article>

        <aside className="lg:col-span-4 space-y-6">
          {related.length > 0 && (
            <SectionCard title="Related articles" className="p-5">
              <div className="space-y-2">
                {related.map((relatedArticle) => {
                  const RelIcon = getIcon(relatedArticle.icon);
                  return (
                    <Link
                      key={relatedArticle.id}
                      to="/help/$articleId"
                      params={{ articleId: relatedArticle.slug }}
                      className="group flex items-start gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors"
                    >
                      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <RelIcon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                          {relatedArticle.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {relatedArticle.readMinutes} min read
                        </div>
                      </div>
                      <ChevronRight className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0 mt-0.5" />
                    </Link>
                  );
                })}
              </div>
            </SectionCard>
          )}

          <SectionCard title="In this article" className="p-5">
            <nav className="space-y-1">
              {article.content.slice(0, 5).map((_, index) => (
                <a
                  key={index}
                  href={`#section-${index}`}
                  className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                >
                  Section {index + 1}
                </a>
              ))}
            </nav>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
