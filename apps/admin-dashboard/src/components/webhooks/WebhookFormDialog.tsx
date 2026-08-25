import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  X,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  LayoutDashboard,
  Shield,
  Code2,
  Settings2,
  Users,
} from "lucide-react";
import { useCreateWebhook, useUpdateWebhook } from "@/lib/api/hooks";
import type { WebhookConfig } from "@/lib/api/services";
import {
  webhookCreateSchema,
  SUGGESTED_EVENTS,
  EVENT_CATEGORIES,
  configToFormValues,
  formValuesToCreatePayload,
  defaultFormValues,
  type WebhookCreateInput,
} from "./webhook.schema";
import { TeamsCardPreview } from "./TeamsCardPreview";
import { TemplatesPickerDialog } from "./TemplatesPickerDialog";
import type { WebhookTemplate } from "@/lib/api/services";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: WebhookConfig | null;
  onSuccess?: (webhook: WebhookConfig) => void;
}

type TabKey = "basic" | "auth" | "headers" | "advanced" | "teams";

export function WebhookFormDialog({
  open,
  onOpenChange,
  initial,
  onSuccess,
}: WebhookFormDialogProps) {
  const [tab, setTab] = useState<TabKey>("basic");
  const [showSecret, setShowSecret] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const isEdit = !!initial;

  const createMut = useCreateWebhook();
  const updateMut = useUpdateWebhook();
  const submitting = createMut.isPending || updateMut.isPending;

  const defaults = useMemo<WebhookCreateInput>(() => {
    if (initial) return configToFormValues(initial);
    return defaultFormValues();
  }, [initial]);

  const form = useForm<WebhookCreateInput>({
    resolver: zodResolver(webhookCreateSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const watchedType = form.watch("type");
  const watchedEvents = form.watch("events");
  const watchedTeamsType = form.watch("teamsCardType");

  const {
    fields: headerFields,
    append: appendHeader,
    remove: removeHeader,
  } = useFieldArray({
    control: form.control,
    name: "headers",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setTab("basic");
      setShowSecret(false);
    }
  }, [open, defaults, form]);

  const toggleEvent = (ev: string) => {
    const current = form.getValues("events") ?? [];
    const next = current.includes(ev) ? current.filter((e) => e !== ev) : [...current, ev];
    form.setValue("events", next, { shouldDirty: true, shouldValidate: true });
  };

  const generateSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    form.setValue("secret", `whsec_${hex}`, { shouldDirty: true });
  };

  const addIp = () => {
    const cur = form.getValues("allowedIps") ?? [];
    form.setValue("allowedIps", [...cur, ""], { shouldDirty: true });
  };
  const updateIp = (idx: number, v: string) => {
    const cur = [...(form.getValues("allowedIps") ?? [])];
    cur[idx] = v;
    form.setValue("allowedIps", cur, { shouldDirty: true });
  };
  const removeIp = (idx: number) => {
    const cur = [...(form.getValues("allowedIps") ?? [])];
    cur.splice(idx, 1);
    form.setValue("allowedIps", cur, { shouldDirty: true });
  };

  const applyTemplate = (tpl: WebhookTemplate) => {
    const v = form.getValues();
    form.setValue("name", v.name || tpl.name);
    form.setValue("type", tpl.type);
    form.setValue("format", tpl.format ?? v.format ?? "JSON");
    const mergedEvents = Array.from(new Set([...(tpl.events ?? []), ...(v.events ?? [])]));
    form.setValue("events", mergedEvents);
    if (tpl.teamsCardType) form.setValue("teamsCardType", tpl.teamsCardType);
    if (tpl.teamsCardTemplate) form.setValue("teamsCardTemplate", tpl.teamsCardTemplate);
    if (tpl.headers && Object.keys(tpl.headers).length > 0) {
      const entries = Object.entries(tpl.headers).map(([key, value]) => ({ key, value }));
      form.setValue("headers", entries);
    }
    setTab("basic");
    toast.success(`Applied template: ${tpl.name}`);
  };

  const onSubmit = async (values: WebhookCreateInput) => {
    const payload = formValuesToCreatePayload(values);
    try {
      let result: WebhookConfig;
      if (isEdit && initial) {
        result = await updateMut.mutateAsync({ id: initial.id, ...payload });
        toast.success("Webhook updated");
      } else {
        result = await createMut.mutateAsync(payload as any);
        toast.success("Webhook created");
      }
      onSuccess?.(result);
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save webhook");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <LayoutDashboard className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {isEdit ? "Edit webhook" : "Create webhook"}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5">
                    {isEdit
                      ? "Update the configuration for this endpoint."
                      : "Configure a new endpoint to receive or send event notifications."}
                  </DialogDescription>
                </div>
              </div>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 shrink-0"
                  onClick={() => setTplOpen(true)}
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Use template
                </Button>
              )}
            </div>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as TabKey)}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <TabsList className="grid w-full grid-cols-5 shrink-0">
                  <TabsTrigger value="basic" className="gap-1.5 text-xs">
                    <LayoutDashboard className="size-3.5" />
                    Basic
                  </TabsTrigger>
                  <TabsTrigger value="auth" className="gap-1.5 text-xs">
                    <Shield className="size-3.5" />
                    Auth
                  </TabsTrigger>
                  <TabsTrigger value="headers" className="gap-1.5 text-xs">
                    <Code2 className="size-3.5" />
                    Headers
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="gap-1.5 text-xs">
                    <Settings2 className="size-3.5" />
                    Advanced
                  </TabsTrigger>
                  <TabsTrigger
                    value="teams"
                    className="gap-1.5 text-xs"
                    disabled={watchedType !== "OUTGOING"}
                  >
                    <Users className="size-3.5" />
                    Teams
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="basic"
                  className="flex-1 overflow-y-auto mt-0 space-y-5 pb-2 pr-1 -mr-1"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Support ticket sync" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="OUTGOING">Outgoing (Vellbase → external)</SelectItem>
                              <SelectItem value="INCOMING">Incoming (external → Vellbase)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Outgoing webhooks send data outbound. Incoming receive it.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payload format</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="JSON">JSON</SelectItem>
                              <SelectItem value="FORM">Form / URL-encoded</SelectItem>
                              <SelectItem value="XML">XML</SelectItem>
                              <SelectItem value="PLAIN">Plain text</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchedType === "INCOMING" ? "Incoming endpoint path" : "Endpoint URL"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              watchedType === "INCOMING"
                                ? "/webhooks/inbound/crm"
                                : "https://api.example.com/hook"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {watchedType === "INCOMING"
                            ? "External services POST to this path on the Vellbase API."
                            : "Vellbase will POST event payloads to this URL."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="events"
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Trigger events
                          <span className="ml-2 text-[10px] text-muted-foreground normal-case">
                            {watchedEvents.length} selected
                          </span>
                        </FormLabel>
                        <div className="space-y-3">
                          {EVENT_CATEGORIES.map((cat) => {
                            const items = SUGGESTED_EVENTS.filter((e) => e.category === cat);
                            return (
                              <div key={cat}>
                                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                                  {cat}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {items.map((ev) => {
                                    const active = watchedEvents.includes(ev.value);
                                    return (
                                      <button
                                        type="button"
                                        key={ev.value}
                                        onClick={() => toggleEvent(ev.value)}
                                        className={cn(
                                          "rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors",
                                          active
                                            ? "border-primary/50 bg-primary/10 text-primary"
                                            : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/30",
                                        )}
                                      >
                                        {ev.value}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                              Custom events (comma separated)
                            </div>
                            <Controller
                              control={form.control}
                              name="events"
                              render={({ field }) => (
                                <Textarea
                                  rows={2}
                                  className="font-mono text-xs resize-none"
                                  value={field.value.join(", ")}
                                  onChange={(e) => {
                                    const next = e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                    field.onChange(next);
                                  }}
                                  placeholder="custom.event.foo, custom.event.bar"
                                />
                              )}
                            />
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 gap-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Active</FormLabel>
                          <FormDescription>
                            Enable this webhook to send/receive events immediately.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent
                  value="auth"
                  className="flex-1 overflow-y-auto mt-0 space-y-5 pb-2 pr-1 -mr-1"
                >
                  <FormField
                    control={form.control}
                    name="requiresAuth"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 gap-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">
                            {watchedType === "INCOMING"
                              ? "Require HMAC signature on ingress"
                              : "Sign outbound requests with HMAC"}
                          </FormLabel>
                          <FormDescription>
                            {watchedType === "INCOMING"
                              ? "Require external callers to sign requests using the shared secret."
                              : "Vellbase will add X-Webhook-Signature headers to outbound calls."}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shared secret</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              type={showSecret ? "text" : "password"}
                              placeholder="whsec_..."
                              className="font-mono text-xs"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowSecret((s) => !s)}
                            title={showSecret ? "Hide" : "Reveal"}
                          >
                            {showSecret ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={generateSecret}
                            title="Generate secure secret"
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                        </div>
                        <FormDescription>
                          Store this securely. Your service uses it to verify signatures.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Shield className="size-3.5 text-muted-foreground" />
                      IP allowlist
                      <span className="text-[10px] text-muted-foreground normal-case font-normal">
                        (leave empty to allow all)
                      </span>
                    </Label>
                    <div className="space-y-2">
                      {(form.watch("allowedIps") ?? []).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            className="font-mono text-xs"
                            placeholder="203.0.113.42 or 10.0.0.0/24"
                            value={(form.watch("allowedIps") ?? [])[idx] ?? ""}
                            onChange={(e) => updateIp(idx, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeIp(idx)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={addIp}
                      >
                        <Plus className="size-3.5" />
                        Add IP / CIDR
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only these source IPs will be allowed to hit an incoming webhook.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent
                  value="headers"
                  className="flex-1 overflow-y-auto mt-0 space-y-5 pb-2 pr-1 -mr-1"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Custom HTTP headers</Label>
                      <Badge variant="outline" className="text-[10px]">
                        {watchedType === "OUTGOING"
                          ? "Sent with each request"
                          : "Expected on ingress"}
                      </Badge>
                    </div>
                    {headerFields.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                        No custom headers configured.
                      </div>
                    )}
                    <div className="space-y-2">
                      {headerFields.map((f, idx) => (
                        <div
                          key={f.id}
                          className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2"
                        >
                          <FormField
                            control={form.control}
                            name={`headers.${idx}.key`}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="font-mono text-xs"
                                    placeholder="X-Custom-Header"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`headers.${idx}.value`}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="font-mono text-xs"
                                    placeholder="header-value"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHeader(idx)}
                            className="text-destructive size-8"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => appendHeader({ key: "", value: "" })}
                    >
                      <Plus className="size-3.5" />
                      Add header
                    </Button>
                  </div>

                  <Card className="bg-muted/20">
                    <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground text-sm">Header security note</p>
                      <p>
                        Secrets such as bearer tokens will be stored encrypted. Do not place payload
                        secrets in headers — use the HMAC secret on the Auth tab instead.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent
                  value="advanced"
                  className="flex-1 overflow-y-auto mt-0 space-y-5 pb-2 pr-1 -mr-1"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="retryMaxAttempts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum retry attempts</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={10} {...field} />
                          </FormControl>
                          <FormDescription>0 disables retries. Max 10.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="retryBackoffDelay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial backoff delay (ms)</FormLabel>
                          <FormControl>
                            <Input type="number" min={100} max={60000} {...field} />
                          </FormControl>
                          <FormDescription>
                            Exponential backoff starts from this value.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="teams"
                  className="flex-1 overflow-y-auto mt-0 space-y-5 pb-2 pr-1 -mr-1"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="teamsCardType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teams card format</FormLabel>
                            <Select
                              value={field.value ?? "MESSAGE"}
                              onValueChange={(v) =>
                                field.onChange(v === "MESSAGE" ? "MESSAGE" : "ADAPTIVE")
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MESSAGE">
                                  Message Card (Office 365 / legacy)
                                </SelectItem>
                                <SelectItem value="ADAPTIVE">
                                  Adaptive Card (modern / Power Automate)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Adaptive Cards are recommended for new Teams workflows.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="teamsTeamId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team ID (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  className="font-mono text-xs"
                                  placeholder="19:xxx@thread.tacv2"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="teamsChannelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Channel ID (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  className="font-mono text-xs"
                                  placeholder="19:yyy@thread.skype"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Card className="bg-muted/20">
                        <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground text-sm">
                            How Teams webhooks work
                          </p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>
                              Paste a Power Automate / Teams Incoming Webhook URL into the
                              <span className="font-mono"> Basic → Endpoint URL </span>field.
                            </li>
                            <li>
                              Vellbase renders the card and POSTs it as JSON to the URL on each
                              matching event.
                            </li>
                            <li>Use the preview to validate layout before saving.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                    <div>
                      <TeamsCardPreview
                        cardType={watchedTeamsType ?? "MESSAGE"}
                        template={form.watch("teamsCardTemplate")}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="shrink-0 border-t pt-4 mt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="gap-1.5">
                  <Save className="size-4" />
                  {isEdit ? "Save changes" : "Create webhook"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <TemplatesPickerDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        onSelect={(t) => applyTemplate(t)}
      />
    </>
  );
}
