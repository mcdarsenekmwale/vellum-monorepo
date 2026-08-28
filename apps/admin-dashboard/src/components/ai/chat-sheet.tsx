import { useState, useRef, useEffect, useCallback, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sparkles,
  User,
  Send,
  Square,
  MoreHorizontal,
  Download,
  Trash2,
  FileText,
  Shield,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useAiChatRunner,
  useAISettings,
  useUpdateAISettings,
  AI_MODEL_OPTIONS,
  type ChatMessage,
  type AISettings,
  type AIModelName,
  type SSEEventMap,
} from "@/lib/api/hooks";
import { ToolCallCard } from "./tool-call-card";
import { QuickActionsGrid } from "./quick-actions-grid";
import { ModelSwitchDialog } from "./model-switch-dialog";

export interface ChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LocalMessage = ChatMessage & {
  id: string;
  streaming?: boolean;
  toolCallUi?: Array<SSEEventMap["tool_call"] & { confirmed?: boolean; acknowledged?: boolean }>;
};

const CHIPS = [
  { label: "Summarize tickets", prompt: "Summarize my open support tickets by priority." },
  { label: "Flag risky users", prompt: "Find users at churn risk and suggest outreach." },
  { label: "Mod sweep", prompt: "Moderation sweep: flag last 100 comments by risk." },
  { label: "Weekly report", prompt: "Draft a weekly analytics summary I can share." },
  { label: "Article idea", prompt: "Suggest 3 trending article ideas with titles and tags." },
  { label: "Model switch", prompt: "Compare the top 3 models for admin tool-calling workflows." },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgoShort(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ChatSheet({ open, onOpenChange }: ChatSheetProps) {
  const navigate = useNavigate();
  const runner = useAiChatRunner();
  const { data: settingsRaw } = useAISettings();
  const updateSettings = useUpdateAISettings();

  const settings = settingsRaw as unknown as AISettings | undefined;

  const [tab, setTab] = useState<"chat" | "quick">("chat");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [abortStream, setAbortStream] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Current model value — derived from settings or fallback */
  const currentModel: AIModelName =
    (settings?.modelConfig?.model as AIModelName) ?? "gpt-4o";
  const currentModelLabel =
    AI_MODEL_OPTIONS.find((o) => o.value === currentModel)?.label ?? String(currentModel);

  /* Auto-scroll to bottom when messages change */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  /* Reset streaming flag when sheet closes */
  useEffect(() => {
    if (!open) {
      setStreaming(false);
      setAbortStream(false);
    } else {
      /* Focus textarea on open */
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  /* ---- Model pill dropdown change ---- */
  const handleModelChange = async (newModel: string) => {
    const target = newModel as AIModelName;
    const payload: Partial<AISettings> = {
      ...((settings ?? {}) as AISettings),
      modelConfig: {
        model: target,
        temperature: settings?.modelConfig?.temperature ?? 0.7,
        maxTokens: settings?.modelConfig?.maxTokens ?? 2048,
        customPrompt: settings?.modelConfig?.customPrompt,
      },
    };
    updateSettings.mutate(payload as AISettings, {
      onSuccess: () => {
        const label = AI_MODEL_OPTIONS.find((o) => o.value === target)?.label ?? target;
        toast.success(`Model updated to ${label}`);
      },
      onError: (err) => {
        toast.error(`Failed to update model: ${(err as Error).message || "Unknown error"}`);
      },
    });
  };

  /* ---- Send a chat round ---- */
  const submitRound = useCallback(
    async (contentOverride?: string, quickActionName?: string) => {
      const userContent = contentOverride ?? input.trim();
      if (!userContent || streaming) return;

      setInlineError(null);

      const userMsg: LocalMessage = {
        id: uid(),
        role: "user",
        content: userContent,
      };
      const assistantId = uid();
      const assistantMsg: LocalMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        toolCallUi: [],
      };

      const nextMessages: LocalMessage[] = [...messages, userMsg, assistantMsg];
      setMessages(nextMessages);
      setInput("");
      setStreaming(true);
      setAbortStream(false);

      /* Build confirmedToolCalls from any user-confirmed tool calls in the last assistant message */
      const confirmedToolCalls = messages
        .flatMap((m) => m.toolCallUi ?? [])
        .filter((tc) => tc.confirmed && !tc.acknowledged)
        .map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.arguments }));

      try {
        const reqMessages: Array<Pick<ChatMessage, "role" | "content" | "tool_call_id">> =
          nextMessages
            .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "tool")
            .map((m) => ({
              role: m.role,
              content: m.content,
              tool_call_id: m.tool_call_id,
            }));

        const result = await runner.runRound({
          conversationId,
          placement: "admin-fab",
          messages: reqMessages,
          confirmedToolCalls: confirmedToolCalls.length ? confirmedToolCalls : undefined,
          quickActionName,
        });

        if (abortStream) {
          setStreaming(false);
          return;
        }

        if (result.meta?.conversationId) {
          setConversationId(result.meta.conversationId);
        }

        if (result.error) {
          setInlineError(`${result.error.code}: ${result.error.message}`);
          toast.error("Chat request failed");
        }

        /* Merge chunks into assistant content */
        const merged = result.chunks.join("");
        /* Merge tool calls */
        const toolCalls = (result.toolCalls ?? []).map((tc) => ({
          ...tc,
          requiresConfirmation: tc.requiresConfirmation ?? false,
          acknowledged: !tc.requiresConfirmation,
          confirmed: !tc.requiresConfirmation,
        }));

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: merged,
                  streaming: false,
                  toolCallUi: toolCalls,
                }
              : m
          )
        );
      } catch (err) {
        setInlineError(`Unexpected error: ${(err as Error).message || String(err)}`);
        toast.error("Chat request exception");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [input, messages, streaming, conversationId, runner, abortStream]
  );

  /* ---- Tool call confirm/cancel ---- */
  const confirmToolCall = (assistantMsgId: string, toolCallId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantMsgId || !m.toolCallUi) return m;
        return {
          ...m,
          toolCallUi: m.toolCallUi.map((tc) =>
            tc.id === toolCallId ? { ...tc, confirmed: true } : tc
          ),
        };
      })
    );
    toast.success("Tool call confirmed. It will run on your next chat submit.");
  };

  const cancelToolCall = (assistantMsgId: string, toolCallId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantMsgId || !m.toolCallUi) return m;
        return {
          ...m,
          toolCallUi: m.toolCallUi.filter((tc) => tc.id !== toolCallId),
        };
      })
    );
    toast("Tool call cancelled", { description: "It won't be executed." });
  };

  /* ---- Chip click — send synthetic opener ---- */
  const sendChip = (prompt: string) => submitRound(prompt);

  /* ---- Quick action callback (from QuickActionsGrid) ---- */
  const runQuickAction = (msg: string, name?: string) => {
    submitRound(msg, name);
  };

  /* ---- Menu actions ---- */
  const clearConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setInlineError(null);
    toast.success("Conversation cleared");
  };

  const exportChat = () => {
    const lines: string[] = [];
    lines.push(`Admin AI Assistant conversation export`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    if (conversationId) lines.push(`Conversation ID: ${conversationId}`);
    lines.push("");
    for (const m of messages) {
      const roleLabel = m.role.toUpperCase();
      lines.push(`--- [${roleLabel}]${" " + (m.id || "")} ---`);
      if (m.content) lines.push(m.content);
      if (m.toolCallUi?.length) {
        for (const tc of m.toolCallUi) {
          lines.push(
            `  Tool: ${tc.name}${tc.requiresConfirmation ? " (needs confirm)" : " (auto)"}`
          );
          lines.push(`  Args: ${JSON.stringify(tc.arguments)}`);
        }
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-ai-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Chat exported");
  };

  const jumpToActivity = () => {
    onOpenChange(false);
    navigate({ to: "/_app/ai-activity" });
  };

  /* ---- Textarea keyboard handling ---- */
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !streaming) {
      e.preventDefault();
      submitRound();
    }
  };

  /* ---- Streaming stop (UI-only flag) ---- */
  const stopStreaming = () => {
    setAbortStream(true);
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
    toast("Stopped — any further chunks will be ignored.");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          {/* ---- HEADER ---- */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-500" />
                  Admin Ops Assistant
                </SheetTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"
                >
                  <Shield className="size-2.5 mr-1" />
                  Admin
                </Badge>
              </div>
              <SheetDescription className="mt-1 text-xs text-muted-foreground">
                Chat, quick actions, and tool-calling workflow.
              </SheetDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Model pill */}
              <Select
                value={currentModel}
                onValueChange={handleModelChange}
                disabled={updateSettings.isPending}
              >
                <SelectTrigger className="h-8 w-[150px] text-xs px-2.5 gap-1.5">
                  <BrainFallback className="size-3 text-emerald-500" />
                  <SelectValue placeholder={currentModelLabel} />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={clearConversation} className="gap-2 text-xs">
                    <Trash2 className="size-3.5" />
                    Clear conversation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportChat} className="gap-2 text-xs">
                    <Download className="size-3.5" />
                    Export chat (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={jumpToActivity} className="gap-2 text-xs">
                    <FileText className="size-3.5" />
                    Jump to AI activity
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ---- TABS ---- */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "chat" | "quick")}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] grid-cols-2 shrink-0">
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-1.5 text-xs">
                <ZapFallback className="size-3.5" />
                Quick actions
              </TabsTrigger>
            </TabsList>

            {/* ---- CHAT TAB ---- */}
            <TabsContent value="chat" className="flex-1 min-h-0 mt-3 flex flex-col gap-0 data-[state=active]:flex">
              {/* Scroll area */}
              <ScrollArea ref={scrollRef} className="flex-1 min-h-0 px-5">
                <div className="py-2 space-y-4 min-h-[200px]">
                  {messages.length === 0 && !inlineError && (
                    <EmptyChat onChip={sendChip} />
                  )}

                  {inlineError && (
                    <Alert variant="destructive" className="my-2 py-3">
                      <XCircle className="size-4" />
                      <AlertTitle className="text-xs font-medium">Chat error</AlertTitle>
                      <AlertDescription className="text-[11px] mt-0.5">
                        {inlineError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {messages.map((m) =>
                    m.role === "user" ? (
                      <UserBubble key={m.id} content={m.content} />
                    ) : m.role === "assistant" ? (
                      <AssistantBubble
                        key={m.id}
                        content={m.content}
                        streaming={m.streaming}
                        toolCalls={m.toolCallUi ?? []}
                        onConfirm={(tcId) => confirmToolCall(m.id, tcId)}
                        onCancel={(tcId) => cancelToolCall(m.id, tcId)}
                      />
                    ) : null
                  )}

                  {streaming && messages.length > 0 && !messages[messages.length - 1].streaming && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                      <Loader2 className="size-3.5 animate-spin" />
                      Processing…
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chips row */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 pt-2 pb-2 shrink-0">
                  {CHIPS.map((c) => (
                    <Button
                      key={c.label}
                      variant="secondary"
                      size="sm"
                      onClick={() => sendChip(c.prompt)}
                      disabled={streaming}
                      className="h-7 rounded-full px-3 text-[11px] gap-1.5"
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-5 py-3 border-t shrink-0 space-y-2 bg-muted/20">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Admin Ops Assistant…"
                  className="min-h-[64px] max-h-[160px] resize-none text-sm"
                  disabled={streaming}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] text-muted-foreground">
                    <kbd className="rounded border bg-background px-1 py-0.5 font-mono">Enter</kbd> send{" "}
                    ·{" "}
                    <kbd className="rounded border bg-background px-1 py-0.5 font-mono">Shift+Enter</kbd> newline
                    {conversationId && (
                      <span className="ml-2 opacity-70">
                        · conv {conversationId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {streaming ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={stopStreaming}
                        className="gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                      >
                        <Square className="size-3.5 fill-current" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => submitRound()}
                        disabled={!input.trim()}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Send className="size-3.5" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ---- QUICK ACTIONS TAB ---- */}
            <TabsContent value="quick" className="flex-1 min-h-0 mt-3 overflow-y-auto px-5 pb-5 data-[state=active]:block">
              <QuickActionsGrid
                onRunQuickAction={runQuickAction}
                onSwitchToChatTab={() => setTab("chat")}
                onOpenModelDialog={() => setModelDialogOpen(true)}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ModelSwitchDialog
        open={modelDialogOpen}
        onOpenChange={(v) => setModelDialogOpen(v)}
      />
    </>
  );
}

/* ─────────────── SUBCOMPONENTS ─────────────── */

function BrainFallback({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}

function ZapFallback({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
        <div className="whitespace-pre-wrap break-words leading-relaxed">{content}</div>
      </div>
      <Avatar className="size-8 shrink-0 border bg-slate-100 dark:bg-slate-800">
        <AvatarFallback className="text-[10px] text-foreground bg-transparent">
          <User className="size-3.5" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function AssistantBubble({
  content,
  streaming,
  toolCalls,
  onConfirm,
  onCancel,
}: {
  content: string;
  streaming?: boolean;
  toolCalls: Array<SSEEventMap["tool_call"] & { confirmed?: boolean; acknowledged?: boolean }>;
  onConfirm: (toolCallId: string) => void;
  onCancel: (toolCallId: string) => void;
}) {
  return (
    <div className="flex items-start justify-start gap-2.5">
      <Avatar className="size-8 shrink-0 border bg-emerald-500/10">
        <AvatarFallback className="bg-transparent">
          <Sparkles className="size-3.5 text-emerald-500" />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[88%] space-y-2 min-w-0">
        {toolCalls.length > 0 && (
          <div className="space-y-2">
            {toolCalls.map((tc) => (
              <ToolCallCard
                key={tc.id}
                name={tc.name}
                arguments={tc.arguments}
                requiresConfirmation={tc.requiresConfirmation ?? false}
                acknowledged={tc.acknowledged}
                onConfirm={() => onConfirm(tc.id)}
                onCancel={() => onCancel(tc.id)}
              />
            ))}
          </div>
        )}
        {(!content && streaming) || content ? (
          <div
            className={cn(
              "rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm shadow-sm",
              "bg-card"
            )}
          >
            {!content && streaming ? (
              <span className="inline-block h-[1em] w-[2px] animate-pulse bg-emerald-500 align-middle" />
            ) : (
              <>
                <div className="whitespace-pre-wrap break-words leading-relaxed">{content}</div>
                {streaming && (
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-emerald-500 align-middle" />
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyChat({ onChip }: { onChip: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
      <div className="grid size-14 place-items-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <Sparkles className="size-6 text-emerald-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Admin Ops Assistant</h3>
        <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
          Ask about tickets, moderation, analytics, users — anything. I can run tool
          calls to read data or propose write actions for your approval.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
        {CHIPS.slice(0, 4).map((c) => (
          <Button
            key={c.label}
            variant="secondary"
            size="sm"
            onClick={() => onChip(c.prompt)}
            className="h-7 rounded-full px-3 text-[11px]"
          >
            {c.label}
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tip: press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">⌘K</kbd> anytime to open me.
      </p>
    </div>
  );
}
