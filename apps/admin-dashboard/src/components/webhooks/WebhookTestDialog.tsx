// components/webhooks/WebhookTestDialog.tsx

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Check,
  X,
  Loader2,
  Send,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Globe,
  Shield,
  FileJson,
  RefreshCw,
  Code2,
  Terminal,
  Activity,
  Webhook,
  Cloud,
  Settings,
  Plus,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TeamsCardPreview } from "./TeamsCardPreview";

// ─── Types ───

import { TestStatus, PayloadFormat, WebhookConfig, LogEntry, TestResult } from "@/lib/api/services";

interface WebhookTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookConfig;
  onTest?: (data: {
    event?: string;
    payload?: unknown;
    overrideUrl?: string;
    headers?: Record<string, string>;
  }) => Promise<TestResult>;
}

// ─── Event Presets ───

const EVENT_PRESETS = {
  user: {
    created: {
      event: "user.created",
      payload: {
        id: "usr_123456",
        email: "john.doe@example.com",
        name: "John Doe",
        createdAt: new Date().toISOString(),
      },
    },
    updated: {
      event: "user.updated",
      payload: {
        id: "usr_123456",
        email: "john.doe@example.com",
        name: "John Doe",
        updatedAt: new Date().toISOString(),
      },
    },
    deleted: {
      event: "user.deleted",
      payload: {
        id: "usr_123456",
        deletedAt: new Date().toISOString(),
      },
    },
  },
  ticket: {
    created: {
      event: "ticket.created",
      payload: {
        id: "tkt_123456",
        number: "TKT-2024-001",
        subject: "Support issue with login",
        status: "NEW",
        priority: "HIGH",
        createdAt: new Date().toISOString(),
      },
    },
    updated: {
      event: "ticket.updated",
      payload: {
        id: "tkt_123456",
        number: "TKT-2024-001",
        status: "IN_PROGRESS",
        updatedAt: new Date().toISOString(),
      },
    },
    resolved: {
      event: "ticket.resolved",
      payload: {
        id: "tkt_123456",
        number: "TKT-2024-001",
        status: "RESOLVED",
        resolvedAt: new Date().toISOString(),
      },
    },
  },
  article: {
    published: {
      event: "article.published",
      payload: {
        id: "art_123456",
        title: "Getting Started with Vellum",
        slug: "getting-started-with-vellum",
        author: "Jane Smith",
        publishedAt: new Date().toISOString(),
      },
    },
  },
};

// ─── Main Component ───

export function WebhookTestDialog({ open, onOpenChange, webhook, onTest }: WebhookTestDialogProps) {
  // ─── State ───
  const [activeTab, setActiveTab] = useState<string>("payload");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [payloadFormat, setPayloadFormat] = useState<PayloadFormat>(
    (webhook?.format as PayloadFormat) || "json",
  );
  const [payload, setPayload] = useState<string>("");
  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>(
    webhook?.headers || {},
  );
  const [responseBody, setResponseBody] = useState<string>("");
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [eventCategory, setEventCategory] = useState<string>("user");
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [targetUrl, setTargetUrl] = useState<string>(webhook?.url || "");
  const [isLoading, setIsLoading] = useState(false);

  // ─── Determine webhook type ───
  const webhookType = useMemo(() => {
    if (!webhook?.type) return "OUTGOING";
    return webhook.type;
  }, [webhook]);

  const isOutgoing = webhookType === "OUTGOING";
  const teamsCardType = webhook?.teamsCardType ?? null;
  const teamsCardTemplate = webhook?.teamsCardTemplate ?? null;

  // ─── Event options ───
  const eventOptions = useMemo(() => {
    const events: Record<string, { label: string; payload: any; event: string }> = {};
    const categories = Object.keys(EVENT_PRESETS);
    for (const cat of categories) {
      const presets = (EVENT_PRESETS as any)[cat];
      for (const [key, value] of Object.entries(presets)) {
        const id = `${cat}.${key}`;
        events[id] = {
          label: `${cat}.${key}`,
          payload: (value as any).payload,
          event: (value as any).event,
        };
      }
    }
    return events;
  }, []);

  const selectedEventName = useMemo(() => {
    if (!selectedEvent) return "manual";
    return eventOptions[selectedEvent]?.event ?? selectedEvent;
  }, [selectedEvent, eventOptions]);

  const samplePayloadForTeams = useMemo((): Record<string, unknown> => {
    try {
      if (!payload) return {};
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") return parsed;
      return {};
    } catch {
      return {};
    }
  }, [payload]);

  // ─── Sync from props on open ───
  useEffect(() => {
    if (!open) return;
    if (webhook?.url) setTargetUrl(webhook.url);
    if (webhook?.headers) setCustomHeaders(webhook.headers);
    if (webhook?.format) setPayloadFormat(webhook.format as PayloadFormat);
  }, [open, webhook]);

  // ─── Initialize payload from selected event ───
  useEffect(() => {
    if (selectedEvent && eventOptions[selectedEvent]) {
      const option = eventOptions[selectedEvent];
      const payloadObj = { ...option.payload };
      if (includeTimestamp) {
        payloadObj.timestamp = new Date().toISOString();
      }
      setPayload(JSON.stringify(payloadObj, null, 2));
    }
  }, [selectedEvent, includeTimestamp, eventOptions]);

  // ─── Load sample payload on first open ───
  useEffect(() => {
    if (open && !payload) {
      const defaultEvent = "user.created";
      setSelectedEvent(defaultEvent);
      if (eventOptions[defaultEvent]) {
        const option = eventOptions[defaultEvent];
        setPayload(JSON.stringify(option.payload, null, 2));
      }
    }
  }, [open, eventOptions, payload]);

  // ─── Reset test state on open ───
  useEffect(() => {
    if (open) {
      setTestStatus("idle");
      setTestResult(null);
      setResponseBody("");
      setResponseHeaders({});
      setLogs([]);
    }
  }, [open]);

  // ─── Handle test execution ───
  const handleTest = useCallback(async () => {
    if (!webhook || !onTest) return;

    setIsLoading(true);
    setTestStatus("loading");
    setTestResult(null);
    setResponseBody("");
    setResponseHeaders({});
    setLogs([]);

    try {
      // ─── Build parsed payload ───
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        parsedPayload = payload;
      }

      // ─── Merge headers ───
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...customHeaders,
      };
      if (includeSignature && webhook?.secret) {
        const timestamp = new Date().toISOString();
        const signature = `sha256=${btoa(
          JSON.stringify(parsedPayload ?? "") + timestamp + webhook.secret,
        )}`;
        headers["X-Webhook-Signature"] = signature;
        headers["X-Webhook-Timestamp"] = timestamp;
      }

      // ─── Execute via API (TestResult shape) ───
      const selEvent = selectedEvent ? eventOptions[selectedEvent]?.event : undefined;
      const result: TestResult = await onTest({
        event: selEvent,
        payload: parsedPayload,
        overrideUrl: targetUrl !== webhook.url ? targetUrl : undefined,
        headers,
      });

      // ─── Populate from TestResult ───
      setResponseBody(result.responseBody ?? "");
      setResponseHeaders(result.responseHeaders ?? {});
      if (result.logs && result.logs.length > 0) {
        setLogs(result.logs);
      }


      const statusCode = result.statusCode ?? (result.status === "success" ? 200 : 500);
      setTestStatus((result.success || result.status === "success") ? "success" : "error");
      setTestResult({
        ...result,
        statusCode,
      });

      if (result.success || result.status === "success") {
        toast.success(
           ` ${result?.message ? result.message+" " : `Test completed — status ${statusCode}`}${
            result.responseTime ? ` in ${result.responseTime}ms` : ""
          }`,
        );
      } else {
        toast.error((result?.message ? result.message+" " : "") + (result?.errorMessage ? result.errorMessage+" " : `Test failed — status ${statusCode}`));
      }
    } catch (error: any) {
      const errMsg = error?.message || "Failed to send test request";
      setTestStatus("error");
      const errResult: TestResult = {
        status: "error",
        errorMessage: errMsg,
        timestamp: new Date().toISOString(),
        logs: [
          {
            id: `err-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "error",
            data: errMsg,
          },
        ],
      };
      setTestResult(errResult);
      setLogs(errResult.logs!);
      toast.error("Test failed: " + errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [
    webhook,
    onTest,
    payload,
    customHeaders,
    targetUrl,
    selectedEvent,
    eventOptions,
    includeSignature,
  ]);

  // ─── Copy payload to clipboard ───
  const handleCopyPayload = useCallback(() => {
    navigator.clipboard.writeText(payload);
    toast.success("Payload copied to clipboard");
  }, [payload]);

  // ─── Status variants ───
  const getStatusVariant = (status: TestStatus) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "error":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "loading":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Webhook className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold flex items-center gap-2.5 flex-wrap">
                  <span className="truncate">
                    Test Webhook: {webhook?.name || "Unnamed Webhook"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      webhookType === "INCOMING"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        : "bg-purple-500/10 text-purple-500 border-purple-500/20",
                    )}
                  >
                    {webhookType === "INCOMING" ? "Incoming" : "Outgoing"}
                  </Badge>
                  {isOutgoing && teamsCardType && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/20 gap-1"
                    >
                      <MessageSquare className="size-2.5" />
                      Teams {teamsCardType === "ADAPTIVE" ? "Adaptive" : "Message"} Card
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3 min-w-0 pt-1">
                  <span className="font-medium text-foreground shrink-0">URL:</span>
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <code className="text-xs text-muted-foreground cursor-pointer select-all truncate min-w-0 max-w-3xl block">
                          {webhook?.url || "N/A"}
                        </code>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-[500px] break-all font-mono text-xs"
                      >
                        {webhook?.url || "N/A"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {testStatus !== "idle" && (
                <Badge variant="outline" className={cn("gap-1", getStatusVariant(testStatus))}>
                  {testStatus === "loading" && <Loader2 className="size-3 animate-spin" />}
                  {testStatus === "success" && <Check className="size-3" />}
                  {testStatus === "error" && <X className="size-3" />}
                  {testStatus === "loading"
                    ? "Testing..."
                    : testStatus === "success"
                      ? "Success"
                      : "Failed"}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col mt-2">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList
              className={cn(
                "grid w-full",
                isOutgoing && teamsCardType ? "grid-cols-5" : "grid-cols-4",
              )}
            >
              <TabsTrigger value="payload" className="gap-1.5">
                <FileJson className="size-3.5" />
                Payload
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-1.5">
                <Settings className="size-3.5" />
                Config
              </TabsTrigger>
              <TabsTrigger value="response" className="gap-1.5">
                <Activity className="size-3.5" />
                Response
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <Terminal className="size-3.5" />
                Logs
              </TabsTrigger>
              {isOutgoing && teamsCardType && (
                <TabsTrigger value="teams" className="gap-1.5">
                  <MessageSquare className="size-3.5" />
                  Teams Preview
                </TabsTrigger>
              )}
            </TabsList>

            {/* ─── Payload Tab ─── */}
            <TabsContent
              value="payload"
              className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Request Payload
                      </Label>
                      <Badge variant="outline" className="text-[10px]">
                        {payloadFormat.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopyPayload}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy payload</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex-1 relative min-h-[220px]">
                    <Textarea
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      className="font-mono text-xs h-full resize-none"
                      spellCheck={false}
                      placeholder="Enter JSON payload..."
                    />
                    <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                      {payload.length} chars
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Event Presets
                    </Label>
                    <div className="flex gap-2">
                      <Select value={eventCategory} onValueChange={setEventCategory}>
                        <SelectTrigger className="flex-1 h-9">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User Events</SelectItem>
                          <SelectItem value="ticket">Ticket Events</SelectItem>
                          <SelectItem value="article">Article Events</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                        <SelectTrigger className="flex-1 h-9">
                          <SelectValue placeholder="Event" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(eventOptions)
                            .filter(([k]) => k.startsWith(eventCategory))
                            .map(([key, option]) => (
                              <SelectItem key={key} value={key}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-timestamp"
                          checked={includeTimestamp}
                          onCheckedChange={setIncludeTimestamp}
                        />
                        <Label htmlFor="include-timestamp" className="text-xs cursor-pointer">
                          Include timestamp
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-signature"
                          checked={includeSignature}
                          disabled={!webhook?.secret}
                          onCheckedChange={setIncludeSignature}
                        />
                        <Label htmlFor="include-signature" className="text-xs cursor-pointer">
                          Sign request (HMAC)
                          {!webhook?.secret && (
                            <span className="ml-1 text-muted-foreground">(no secret)</span>
                          )}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Payload Format
                    </Label>
                    <Select
                      value={payloadFormat}
                      onValueChange={(v) => setPayloadFormat(v as PayloadFormat)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="form">Form Data</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                        <SelectItem value="plain">Plain Text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Quick Actions
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          const sample = {
                            test: true,
                            timestamp: new Date().toISOString(),
                            data: {
                              id: "test_123",
                              type: "webhook_test",
                            },
                          };
                          setPayload(JSON.stringify(sample, null, 2));
                        }}
                      >
                        <RefreshCw className="size-3 mr-1" />
                        Reset Sample
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(payload);
                            setPayload(JSON.stringify(parsed, null, 2));
                            toast.success("Payload formatted");
                          } catch {
                            toast.error("Invalid JSON");
                          }
                        }}
                      >
                        <Code2 className="size-3 mr-1" />
                        Format JSON
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ─── Config Tab ─── */}
            <TabsContent value="config" className="flex-1 overflow-y-auto mt-4 pr-1">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Globe className="size-3.5" />
                    Target URL
                  </Label>
                  <Input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Overrides the saved webhook URL for this test only.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Shield className="size-3.5" />
                    Custom Headers
                  </Label>
                  <div className="space-y-2">
                    {Object.entries(customHeaders).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        No custom headers configured.
                      </p>
                    )}
                    {Object.entries(customHeaders).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Input
                          value={key}
                          onChange={(e) => {
                            const updated = { ...customHeaders };
                            delete updated[key];
                            updated[e.target.value] = value;
                            setCustomHeaders(updated);
                          }}
                          placeholder="Header name"
                          className="flex-1 font-mono text-xs"
                        />
                        <Input
                          value={value}
                          onChange={(e) => {
                            setCustomHeaders({
                              ...customHeaders,
                              [key]: e.target.value,
                            });
                          }}
                          placeholder="Header value"
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            const updated = { ...customHeaders };
                            delete updated[key];
                            setCustomHeaders(updated);
                          }}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setCustomHeaders({
                          ...customHeaders,
                          ["X-Custom-Header"]: "",
                        });
                      }}
                    >
                      <Plus className="size-3.5" />
                      Add Header
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {webhookType === "INCOMING" ? (
                      <Server className="size-5 text-blue-500" />
                    ) : (
                      <Cloud className="size-5 text-purple-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {webhookType === "INCOMING" ? "Incoming Webhook" : "Outgoing Webhook"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {webhookType === "INCOMING"
                          ? "Receives data from external services into Vellum"
                          : "Sends Vellum event data to external services"}
                      </p>
                    </div>
                    {webhook?.secret && (
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                        <Shield className="size-2.5" />
                        HMAC Secret configured
                      </Badge>
                    )}
                  </div>
                  {(webhook?.allowedIps?.length ?? 0) > 0 && (
                    <div className="pt-3 border-t border-border/60">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        IP Allowlist
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {webhook!.allowedIps!.map((ip) => (
                          <Badge key={ip} variant="secondary" className="font-mono text-[10px]">
                            {ip}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {isOutgoing && (
                    <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Retry attempts: </span>
                        <span className="font-medium tabular-nums">
                          {webhook?.retryMaxAttempts ?? 3}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Backoff: </span>
                        <span className="font-medium tabular-nums">
                          {webhook?.retryBackoffDelay ?? 1000}ms
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── Response Tab ─── */}
            <TabsContent
              value="response"
              className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0"
            >
              {testStatus === "idle" ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="grid size-16 place-items-center rounded-full bg-muted/30 mb-4">
                    <Send className="size-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No test has been run yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Configure your payload and click &quot;Send Test&quot; to see the response here
                  </p>
                </div>
              ) : testStatus === "loading" ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="mt-4 text-sm font-medium text-muted-foreground">
                    Sending test request...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">POST {targetUrl}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col space-y-4 min-h-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status
                      </div>
                      <div className="mt-1.5">
                        <Badge
                          variant={testStatus === "success" ? "default" : "destructive"}
                          className="gap-1"
                        >
                          {testStatus === "success" ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <AlertCircle className="size-3" />
                          )}
                          {testResult?.statusCode ?? "Error"}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Response Time
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {testResult?.responseTime ?? 0}ms
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Event
                      </div>
                      <div className="mt-1 text-sm font-semibold truncate">{selectedEventName}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Timestamp
                      </div>
                      <div className="mt-1 text-xs font-medium tabular-nums">
                        {testResult?.timestamp
                          ? new Date(testResult.timestamp).toLocaleTimeString()
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {testResult?.errorMessage && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="size-4" />
                        Error
                      </div>
                      <p className="mt-1 text-xs font-mono break-words">
                        {testResult.errorMessage}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Response Body
                        </Label>
                        {responseBody && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => setShowRawResponse(!showRawResponse)}
                          >
                            {showRawResponse ? (
                              <EyeOff className="size-3" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                            {showRawResponse ? "Hide Raw" : "Show Raw"}
                          </Button>
                        )}
                      </div>
                      {responseBody && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(responseBody);
                            toast.success("Response copied");
                          }}
                        >
                          <Copy className="size-3" />
                          Copy
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 min-h-[160px] overflow-auto rounded-lg border bg-muted/20 p-4">
                      <pre className="font-mono text-xs whitespace-pre-wrap break-all">
                        {responseBody
                          ? showRawResponse
                            ? responseBody
                            : (() => {
                                try {
                                  const parsed = JSON.parse(responseBody);
                                  return JSON.stringify(parsed, null, 2);
                                } catch {
                                  return responseBody;
                                }
                              })()
                          : "No response body"}
                      </pre>
                    </div>
                  </div>

                  {Object.keys(responseHeaders).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Response Headers
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(responseHeaders).map(([key, value]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="gap-1 font-mono text-[10px]"
                          >
                            <span className="text-muted-foreground">{key}:</span>
                            {String(value).length > 60 ? String(value).slice(0, 60) + "…" : value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ─── Logs Tab ─── */}
            <TabsContent value="logs" className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0">
              {logs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="grid size-16 place-items-center rounded-full bg-muted/30 mb-4">
                    <Clock className="size-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No logs available yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Per-attempt logs will appear here after each test execution
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto space-y-2 font-mono text-xs pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "rounded-lg border p-3",
                        log.type === "error" && "border-rose-500/20 bg-rose-500/5",
                        log.type === "request" && "border-blue-500/20 bg-blue-500/5",
                        log.type === "response" && "border-emerald-500/20 bg-emerald-500/5",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              log.type === "error" && "border-rose-500/30 text-rose-500",
                              log.type === "request" && "border-blue-500/30 text-blue-500",
                              log.type === "response" && "border-emerald-500/30 text-emerald-500",
                            )}
                          >
                            {log.type.toUpperCase()}
                          </Badge>
                          {log.statusCode && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                log.statusCode >= 200 && log.statusCode < 300
                                  ? "border-emerald-500/30 text-emerald-500"
                                  : "border-rose-500/30 text-rose-500",
                              )}
                            >
                              {log.statusCode}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                        {typeof log.data === "string"
                          ? log.data
                          : JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── Teams Preview Tab ─── */}
            {isOutgoing && teamsCardType && (
              <TabsContent value="teams" className="flex-1 overflow-y-auto mt-4 pr-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 space-y-3">
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare className="size-4 text-teal-500" />
                        Teams Card Settings
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Card Type</span>
                          <Badge variant="outline" className="text-[10px]">
                            {teamsCardType === "ADAPTIVE" ? "Adaptive Card" : "Message Card"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Custom Template</span>
                          <span className="font-medium">
                            {teamsCardTemplate ? "Yes" : "Default"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Sample Event</span>
                          <span className="font-mono text-[10px]">{selectedEventName}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This preview renders the Teams card that will be sent when the webhook fires.
                      Placeholders like <code className="font-mono">{"{{event}}"}</code> and{" "}
                      <code className="font-mono">{"{{timestamp}}"}</code> are substituted with live
                      values from the payload.
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <TeamsCardPreview
                      cardType={teamsCardType}
                      template={teamsCardTemplate}
                      sampleEvent={selectedEventName}
                      samplePayload={samplePayloadForTeams}
                      className="min-h-[320px]"
                    />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-4 mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1 shrink-0">
              <div className="size-1.5 rounded-full bg-emerald-500" />
              <span>{payload.length} chars</span>
            </div>
            <div className="h-3 w-px bg-border shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              <Globe className="size-3 shrink-0" />
              <span className="text-ellipsis whitespace-nowrap overflow-hidden max-w-sm">
                {targetUrl}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleTest}
              disabled={isLoading || !targetUrl || !onTest}
              className="gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
