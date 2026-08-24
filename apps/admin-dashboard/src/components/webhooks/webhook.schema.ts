import { z } from "zod";
import type { WebhookType, WebhookFormat, TeamsCardType } from "@/lib/api/services";

export const webhookHeaderSchema = z.object({
  key: z.string().min(1, "Header name is required"),
  value: z.string().default(""),
});

export const webhookCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  type: z.enum(["INCOMING", "OUTGOING"]).default("OUTGOING"),
  url: z.string().url("Must be a valid URL").min(1, "Endpoint URL is required"),
  format: z.enum(["JSON", "FORM", "XML", "PLAIN"]).default("JSON"),
  events: z
    .array(z.string().min(1, "Each event must be non-empty"))
    .min(1, "At least one event is required"),
  isActive: z.boolean().default(true),
  secret: z.string().optional(),
  requiresAuth: z.boolean().default(true),
  headers: z.array(webhookHeaderSchema).default([]),
  allowedIps: z.array(z.string()).default([]),
  retryMaxAttempts: z.coerce.number().int().min(0).max(10).default(3),
  retryBackoffDelay: z.coerce.number().int().min(100).max(60_000).default(1000),
  teamsChannelId: z.string().optional(),
  teamsTeamId: z.string().optional(),
  teamsCardType: z.enum(["MESSAGE", "ADAPTIVE"]).optional(),
  teamsCardTemplate: z.record(z.string(), z.unknown()).optional(),
});

export const webhookUpdateSchema = webhookCreateSchema.partial().extend({
  id: z.string().min(1, "ID is required"),
});

export const webhookTestSchema = z.object({
  event: z.string().min(1, "Event name is required").default("manual.test"),
  overrideUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  headers: z.record(z.string(), z.string()).default({}),
  payload: z.unknown().default({ test: true, timestamp: new Date().toISOString() }),
});

export const headerEntrySchema = z.object({
  key: z.string().min(1, "Key required"),
  value: z.string(),
});

export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;
export type WebhookUpdateInput = z.infer<typeof webhookUpdateSchema>;
export type WebhookTestInput = z.infer<typeof webhookTestSchema>;
export type HeaderEntry = z.infer<typeof headerEntrySchema>;

export const SUGGESTED_EVENTS: Array<{ label: string; value: string; category: string }> = [
  { label: "User created", value: "user.created", category: "User" },
  { label: "User updated", value: "user.updated", category: "User" },
  { label: "User deleted", value: "user.deleted", category: "User" },
  { label: "Article published", value: "article.published", category: "Content" },
  { label: "Article updated", value: "article.updated", category: "Content" },
  { label: "Article deleted", value: "article.deleted", category: "Content" },
  { label: "Comment created", value: "comment.created", category: "Content" },
  { label: "Ticket created", value: "ticket.created", category: "Support" },
  { label: "Ticket updated", value: "ticket.updated", category: "Support" },
  { label: "Ticket resolved", value: "ticket.resolved", category: "Support" },
  { label: "Ticket closed", value: "ticket.closed", category: "Support" },
  { label: "Ticket replied", value: "ticket.replied", category: "Support" },
];

export const EVENT_CATEGORIES = Array.from(
  new Set(SUGGESTED_EVENTS.map((e) => e.category)),
);

export function defaultFormValues(
  initial?: Partial<WebhookCreateInput>,
): WebhookCreateInput {
  return {
    name: "",
    type: "OUTGOING",
    url: "",
    format: "JSON",
    events: [],
    isActive: true,
    secret: "",
    requiresAuth: true,
    headers: [],
    allowedIps: [],
    retryMaxAttempts: 3,
    retryBackoffDelay: 1000,
    teamsChannelId: "",
    teamsTeamId: "",
    teamsCardType: undefined,
    teamsCardTemplate: undefined,
    ...initial,
  };
}

export function configToFormValues(
  config: {
    name: string;
    type?: WebhookType;
    url: string;
    format?: WebhookFormat;
    events: string[];
    isActive?: boolean;
    secret?: string | null;
    requiresAuth?: boolean;
    headers?: Record<string, string> | null;
    allowedIps?: string[];
    retryMaxAttempts?: number;
    retryBackoffDelay?: number;
    teamsChannelId?: string | null;
    teamsTeamId?: string | null;
    teamsCardType?: TeamsCardType | null;
    teamsCardTemplate?: Record<string, unknown> | null;
  },
): WebhookCreateInput {
  const headerEntries: HeaderEntry[] = Object.entries(config.headers ?? {}).map(
    ([key, value]) => ({ key, value }),
  );
  return {
    name: config.name,
    type: (config.type as WebhookCreateInput["type"]) ?? "OUTGOING",
    url: config.url,
    format: (config.format as WebhookCreateInput["format"]) ?? "JSON",
    events: [...config.events],
    isActive: config.isActive ?? true,
    secret: config.secret ?? "",
    requiresAuth: config.requiresAuth ?? true,
    headers: headerEntries.length > 0 ? headerEntries : [],
    allowedIps: config.allowedIps ?? [],
    retryMaxAttempts: config.retryMaxAttempts ?? 3,
    retryBackoffDelay: config.retryBackoffDelay ?? 1000,
    teamsChannelId: config.teamsChannelId ?? "",
    teamsTeamId: config.teamsTeamId ?? "",
    teamsCardType: (config.teamsCardType as WebhookCreateInput["teamsCardType"]) ?? undefined,
    teamsCardTemplate: config.teamsCardTemplate ?? undefined,
  };
}

export function formValuesToCreatePayload(values: WebhookCreateInput) {
  const headersObj: Record<string, string> = {};
  for (const h of values.headers) {
    if (h.key.trim()) headersObj[h.key.trim()] = h.value;
  }
  return {
    name: values.name.trim(),
    type: values.type,
    url: values.url.trim(),
    format: values.format,
    events: values.events.map((e) => e.trim()).filter(Boolean),
    isActive: values.isActive,
    secret: values.secret?.trim() || undefined,
    requiresAuth: values.requiresAuth,
    headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
    allowedIps: values.allowedIps.map((s) => s.trim()).filter(Boolean),
    retryMaxAttempts: values.retryMaxAttempts,
    retryBackoffDelay: values.retryBackoffDelay,
    teamsChannelId: values.teamsChannelId?.trim() || undefined,
    teamsTeamId: values.teamsTeamId?.trim() || undefined,
    teamsCardType: values.teamsCardType,
    teamsCardTemplate: values.teamsCardTemplate,
  };
}
