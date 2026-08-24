// lib/support/variable-engine.ts

export interface VariableContext {
  ticketNumber?: string;
  ticketId?: string;
  subject?: string;
  description?: string | null;
  message?: string;
  status?: string;
  priority?: string;
  type?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userHandle?: string | null;
  userPlan?: string | null;
  userRole?: string | null;
  userJoinedAt?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  agentId?: string | null;
  agentRole?: string | null;
  departmentName?: string | null;
  teamName?: string | null;
  ticketUrl?: string;
  ticketCreatedAt?: string;
  ticketUpdatedAt?: string;
  workspaceName?: string | null;
  companyName?: string | null;
  supportEmail?: string | null;
}

export interface RichTextFormat {
  type:
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "code"
    | "link"
    | "image"
    | "quote"
    | "heading1"
    | "heading2"
    | "heading3"
    | "bulletList"
    | "numberList"
    | "horizontalRule";
  prefix: string;
  suffix: string;
  preview: string;
}

export const RICH_TEXT_FORMATS: RichTextFormat[] = [
  { type: "bold", prefix: "**", suffix: "**", preview: "**Bold**" },
  { type: "italic", prefix: "*", suffix: "*", preview: "*Italic*" },
  { type: "underline", prefix: "__", suffix: "__", preview: "__Underline__" },
  { type: "strikethrough", prefix: "~~", suffix: "~~", preview: "~~Strikethrough~~" },
  { type: "code", prefix: "`", suffix: "`", preview: "`code`" },
  { type: "link", prefix: "[", suffix: "](url)", preview: "[Link text](url)" },
  { type: "image", prefix: "![", suffix: "](image-url)", preview: "![Alt text](image-url)" },
  { type: "quote", prefix: "> ", suffix: "", preview: "> Quote" },
  { type: "heading1", prefix: "# ", suffix: "", preview: "# Heading 1" },
  { type: "heading2", prefix: "## ", suffix: "", preview: "## Heading 2" },
  { type: "heading3", prefix: "### ", suffix: "", preview: "### Heading 3" },
  { type: "bulletList", prefix: "- ", suffix: "", preview: "- List item" },
  { type: "numberList", prefix: "1. ", suffix: "", preview: "1. Numbered item" },
  { type: "horizontalRule", prefix: "---", suffix: "", preview: "---" },
];

/**
 * Resolves a variable name to its value from the context
 */
export function resolveVariable(rawName: string, ctx: VariableContext): string | null {
  const key = rawName.trim().toLowerCase().replace(/[\s-]/g, "_");

  // ─── User variables ───
  const userMap: Record<string, string | undefined> = {
    user_name: ctx.userName ?? undefined,
    name: ctx.userName ?? undefined,
    customer_name: ctx.userName ?? undefined,
    username: ctx.userName ?? undefined,
    user: ctx.userName ?? undefined,
    requester_name: ctx.userName ?? undefined,
    requester: ctx.userName ?? undefined,
    full_name: ctx.userName ?? undefined,
    display_name: ctx.userName ?? undefined,
    user_email: ctx.userEmail ?? undefined,
    email: ctx.userEmail ?? undefined,
    customer_email: ctx.userEmail ?? undefined,
    requester_email: ctx.userEmail ?? undefined,
    user_handle: ctx.userHandle ?? undefined,
    handle: ctx.userHandle ?? undefined,
    username_handle: ctx.userHandle ?? undefined,
    user_plan: ctx.userPlan ?? undefined,
    plan: ctx.userPlan ?? undefined,
    customer_plan: ctx.userPlan ?? undefined,
    user_role: ctx.userRole ?? undefined,
    role: ctx.userRole ?? undefined,
    customer_role: ctx.userRole ?? undefined,
    user_joined: ctx.userJoinedAt ?? undefined,
    joined: ctx.userJoinedAt ?? undefined,
    joined_at: ctx.userJoinedAt ?? undefined,
    customer_since: ctx.userJoinedAt ?? undefined,
  };

  // ─── Ticket variables ───
  const ticketMap: Record<string, string | undefined> = {
    ticket_number: ctx.ticketNumber ?? undefined,
    ticket_id: ctx.ticketId ?? undefined,
    ticketnumber: ctx.ticketNumber ?? undefined,
    ticketid: ctx.ticketId ?? undefined,
    id: ctx.ticketId ?? undefined,
    ticket_no: ctx.ticketNumber ?? undefined,
    ticket_num: ctx.ticketNumber ?? undefined,
    issue_number: ctx.ticketNumber ?? undefined,
    issue_id: ctx.ticketId ?? undefined,
    subject: ctx.subject ?? undefined,
    issue_title: ctx.subject ?? undefined,
    ticket_subject: ctx.subject ?? undefined,
    ticket_title: ctx.subject ?? undefined,
    title: ctx.subject ?? undefined,
    issue: ctx.subject ?? undefined,
    issue_summary: ctx.subject ?? undefined,
    description: ctx.description ?? ctx.message ?? undefined,
    ticket_description: ctx.description ?? ctx.message ?? undefined,
    issue_description: ctx.description ?? ctx.message ?? undefined,
    message: ctx.message ?? undefined,
    ticket_message: ctx.message ?? undefined,
    ticket_body: ctx.message ?? undefined,
    status: ctx.status ?? undefined,
    ticket_status: ctx.status ?? undefined,
    issue_status: ctx.status ?? undefined,
    priority: ctx.priority ?? undefined,
    ticket_priority: ctx.priority ?? undefined,
    urgency: ctx.priority ?? undefined,
    type: ctx.type ?? undefined,
    ticket_type: ctx.type ?? undefined,
    issue_type: ctx.type ?? undefined,
    created_at: ctx.ticketCreatedAt ?? undefined,
    ticket_created: ctx.ticketCreatedAt ?? undefined,
    updated_at: ctx.ticketUpdatedAt ?? undefined,
    ticket_updated: ctx.ticketUpdatedAt ?? undefined,
    last_updated: ctx.ticketUpdatedAt ?? undefined,
    ticket_last_updated: ctx.ticketUpdatedAt ?? undefined,
    priority_level: ctx.priority ?? undefined,
    resolution_time: ctx.ticketCreatedAt ? new Date(new Date(ctx.ticketCreatedAt).getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString() : undefined,
    follow_up_time: ctx.ticketCreatedAt ? new Date(new Date(ctx.ticketUpdatedAt ?? ctx.ticketCreatedAt).getTime() + ( 24 * 60 * 60 * 1000)).toISOString() : undefined,
    last_activity_date: ctx.ticketUpdatedAt ?? undefined,
  };

  // ─── Agent variables ───
  const agentMap: Record<string, string | undefined> = {
    agent_name: ctx.agentName ?? undefined,
    agent: ctx.agentName ?? undefined,
    support_agent: ctx.agentName ?? undefined,
    staff_name: ctx.agentName ?? undefined,
    agent_email: ctx.agentEmail ?? undefined,
    support_email: ctx.agentEmail ?? ctx.supportEmail ?? undefined,
    staff_email: ctx.agentEmail ?? undefined,
    agent_id: ctx.agentId ?? undefined,
    agent_role: ctx.agentRole ?? undefined,
    staff_role: ctx.agentRole ?? undefined,
  };

  // ─── Organization variables ───
  const orgMap: Record<string, string | undefined> = {
    department: ctx.departmentName ?? undefined,
    department_name: ctx.departmentName ?? undefined,
    dept: ctx.departmentName ?? undefined,
    team: ctx.teamName ?? undefined,
    team_name: ctx.teamName ?? undefined,
    group: ctx.teamName ?? undefined,
    workspace: ctx.workspaceName ?? undefined,
    workspace_name: ctx.workspaceName ?? undefined,
    company: ctx.companyName ?? undefined,
    company_name: ctx.companyName ?? undefined,
    organization: ctx.companyName ?? undefined,
  };

  // ─── URL variables ───
  const urlMap: Record<string, string | undefined> = {
    ticket_url: ctx.ticketUrl ?? undefined,
    url: ctx.ticketUrl ?? undefined,
    ticket_link: ctx.ticketUrl ?? undefined,
    link: ctx.ticketUrl ?? undefined,
    reference_url: ctx.ticketUrl ?? undefined,
    view_link: ctx.ticketUrl ?? undefined,
  };

  // ─── Date/Time variables ───
  const now = new Date();
  const dateMap: Record<string, string | undefined> = {
    date: now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    today: now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    current_date: now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    time: now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    current_time: now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    datetime: now.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    current_datetime: now.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    year: String(now.getFullYear()),
    current_year: String(now.getFullYear()),
    month: now.toLocaleString(undefined, { month: "long" }),
    current_month: now.toLocaleString(undefined, { month: "long" }),
    day: String(now.getDate()),
    current_day: String(now.getDate()),
    hour: String(now.getHours()),
    current_hour: String(now.getHours()),
    minute: String(now.getMinutes()),
    current_minute: String(now.getMinutes()),
    timestamp: now.toISOString(),
    current_timestamp: now.toISOString(),
  };

  const fullMap = { ...userMap, ...ticketMap, ...agentMap, ...orgMap, ...urlMap, ...dateMap };

  if (key in fullMap && fullMap[key] !== undefined) {
    return fullMap[key];
  }

  // Try snake_case conversion
  const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (snakeKey in fullMap && fullMap[snakeKey] !== undefined) {
    return fullMap[snakeKey];
  }

  // Try kebab-case conversion
  const kebabKey = key.replace(/_/g, "-");
  if (kebabKey in fullMap && fullMap[kebabKey] !== undefined) {
    return fullMap[kebabKey];
  }

  // Try PascalCase conversion
  const pascalKey = key.replace(/(^|_)(\w)/g, (_, __, char) => char.toUpperCase());
  if (pascalKey in fullMap && fullMap[pascalKey] !== undefined) {
    return fullMap[pascalKey];
  }

  return null;
}

/**
 * Interpolates all variable patterns in text:
 * - {{variable_name}}
 * - {variable_name}
 * - %variable_name%
 * - [[variable_name]]
 */
export function interpolateCannedVariables(text: string, ctx: VariableContext): string {
  let result = text;

  // Pattern 1: {{variable_name}}
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName: string) => {
    const value = resolveVariable(varName, ctx);
    return value ?? match;
  });

  // Pattern 2: {variable_name} (legacy)
  const legacyPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  result = result.replace(legacyPattern, (match, varName: string) => {
    const value = resolveVariable(varName, ctx);
    return value ?? match;
  });

  // Pattern 3: %variable_name%
  result = result.replace(/%([^%]+)%/g, (match, varName: string) => {
    const value = resolveVariable(varName, ctx);
    return value ?? match;
  });

  // Pattern 4: [[variable_name]]
  result = result.replace(/\[\[([^\]]+)\]\]/g, (match, varName: string) => {
    const value = resolveVariable(varName, ctx);
    return value ?? match;
  });

  return result;
}