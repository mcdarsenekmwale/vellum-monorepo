import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  interpolateCannedVariables,
  resolveVariable,
  type VariableContext,
} from "./variable-engine";

// ─── Shared test context ───
const baseCtx: VariableContext = {
  ticketNumber: "TK-20107878677700",
  ticketId: "ticket-uuid-123",
  subject: "Login page not loading on Safari",
  description: "When I try to access the login page on Safari 17, it shows a blank screen.",
  message: "The login page is completely blank on Safari",
  status: "IN_PROGRESS",
  priority: "HIGH",
  type: "BUG",
  userName: "John Doe",
  userEmail: "john.doe@example.com",
  userHandle: "john_doe",
  userPlan: "PRO",
  userRole: "USER",
  userJoinedAt: "2024-01-15T10:00:00Z",
  agentName: "Jane Smith",
  agentEmail: "jane.smith@vellbase.com",
  agentId: "agent-456",
  agentRole: "SUPPORT_ADMIN",
  departmentName: "Engineering",
  teamName: "Frontend",
  ticketUrl: "https://admin.vellbase.com/support/tickets/ticket-uuid-123",
  ticketCreatedAt: "2025-08-20T09:00:00Z",
  ticketUpdatedAt: "2025-08-22T14:30:00Z",
  workspaceName: "Vellbase",
  companyName: "Vellbase",
  supportEmail: "support@vellbase.com",
};

describe("Variable Replacement Engine", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. VARIABLE FORMAT TESTS
  // ═══════════════════════════════════════════════════════════
  describe("1. Variable Format Tests", () => {
    describe("{{var}} format (double-brace)", () => {
      it("resolves {{user_name}}", () => {
        expect(interpolateCannedVariables("Hello {{user_name}}", baseCtx)).toBe("Hello John Doe");
      });
      it("resolves {{ticket_number}}", () => {
        expect(interpolateCannedVariables("Ref: {{ticket_number}}", baseCtx)).toBe("Ref: TK-20107878677700");
      });
      it("resolves {{issue_title}}", () => {
        expect(interpolateCannedVariables("Re: {{issue_title}}", baseCtx)).toBe("Re: Login page not loading on Safari");
      });
      it("resolves multiple variables in one line", () => {
        const result = interpolateCannedVariables("Hi {{user_name}}, ticket {{ticket_number}} is {{status}}", baseCtx);
        expect(result).toBe("Hi John Doe, ticket TK-20107878677700 is IN_PROGRESS");
      });
      it("resolves variables with spaces in name {{ user_name }}", () => {
        expect(interpolateCannedVariables("Hello {{ user_name }}", baseCtx)).toBe("Hello John Doe");
      });
      it("resolves variables with hyphens {{user-name}}", () => {
        expect(interpolateCannedVariables("Hello {{user-name}}", baseCtx)).toBe("Hello John Doe");
      });
    });

    describe("{var} format (single-brace, legacy)", () => {
      it("resolves {user_name}", () => {
        expect(interpolateCannedVariables("Hello {user_name}", baseCtx)).toBe("Hello John Doe");
      });
      it("resolves {ticket_number}", () => {
        expect(interpolateCannedVariables("Ref: {ticket_number}", baseCtx)).toBe("Ref: TK-20107878677700");
      });
      it("resolves {name}", () => {
        expect(interpolateCannedVariables("Hi {name}", baseCtx)).toBe("Hi John Doe");
      });
      it("resolves {agent_name}", () => {
        expect(interpolateCannedVariables("From: {agent_name}", baseCtx)).toBe("From: Jane Smith");
      });
      it("does NOT replace non-variable curly braces (e.g. JSON)", () => {
        expect(interpolateCannedVariables('{"key": "value"}', baseCtx)).toBe('{"key": "value"}');
      });
    });

    describe("%var% format (percent)", () => {
      it("resolves %user_name%", () => {
        expect(interpolateCannedVariables("Hello %user_name%", baseCtx)).toBe("Hello John Doe");
      });
      it("resolves %ticket_number%", () => {
        expect(interpolateCannedVariables("Ref: %ticket_number%", baseCtx)).toBe("Ref: TK-20107878677700");
      });
      it("resolves %issue_title%", () => {
        expect(interpolateCannedVariables("Re: %issue_title%", baseCtx)).toBe("Re: Login page not loading on Safari");
      });
      it("resolves multiple %var% in one line", () => {
        const result = interpolateCannedVariables("Hi %name%, your ticket %ticket_id% is %status%", baseCtx);
        expect(result).toBe("Hi John Doe, your ticket ticket-uuid-123 is IN_PROGRESS");
      });
    });

    describe("[[var]] format (double-bracket)", () => {
      it("resolves [[user_name]]", () => {
        expect(interpolateCannedVariables("Hello [[user_name]]", baseCtx)).toBe("Hello John Doe");
      });
      it("resolves [[ticket_number]]", () => {
        expect(interpolateCannedVariables("Ref: [[ticket_number]]", baseCtx)).toBe("Ref: TK-20107878677700");
      });
      it("resolves [[issue_title]]", () => {
        expect(interpolateCannedVariables("Re: [[issue_title]]", baseCtx)).toBe("Re: Login page not loading on Safari");
      });
    });

    describe("Mixed formats in same text", () => {
      it("resolves all 4 formats simultaneously", () => {
        const text = "Hi {{user_name}}, ref {ticket_number}, status %status%, issue [[issue_title]]";
        const result = interpolateCannedVariables(text, baseCtx);
        expect(result).toBe("Hi John Doe, ref TK-20107878677700, status IN_PROGRESS, issue Login page not loading on Safari");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. VARIABLE ALIAS TESTS (30+ per context)
  // ═══════════════════════════════════════════════════════════
  describe("2. Variable Alias Tests", () => {
    describe("User name aliases", () => {
      const aliases = ["user_name", "name", "customer_name", "username", "user", "requester_name", "requester", "full_name", "display_name"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "John Doe"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("John Doe");
        });
      }
    });

    describe("User email aliases", () => {
      const aliases = ["user_email", "email", "customer_email", "requester_email"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "john.doe@example.com"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("john.doe@example.com");
        });
      }
    });

    describe("User handle aliases", () => {
      const aliases = ["user_handle", "handle", "username_handle"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "john_doe"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("john_doe");
        });
      }
    });

    describe("User plan aliases", () => {
      const aliases = ["user_plan", "plan", "customer_plan"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "PRO"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("PRO");
        });
      }
    });

    describe("User role aliases", () => {
      const aliases = ["user_role", "role", "customer_role"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "USER"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("USER");
        });
      }
    });

    describe("Ticket number aliases", () => {
      const aliases = ["ticket_number", "ticket_id", "ticketnumber", "ticketid", "id", "ticket_no", "ticket_num", "issue_number", "issue_id"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          const result = resolveVariable(alias, baseCtx);
          expect(result).not.toBeNull();
          expect(result).toBeTruthy();
        });
      }
      it("resolves {{ticket_number}} → TK-20107878677700", () => {
        expect(resolveVariable("ticket_number", baseCtx)).toBe("TK-20107878677700");
      });
      it("resolves {{ticket_id}} → ticket-uuid-123", () => {
        expect(resolveVariable("ticket_id", baseCtx)).toBe("ticket-uuid-123");
      });
    });

    describe("Ticket subject / issue title aliases", () => {
      const aliases = ["subject", "issue_title", "ticket_subject", "ticket_title", "title", "issue", "issue_summary"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "Login page not loading on Safari"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("Login page not loading on Safari");
        });
      }
    });

    describe("Ticket description aliases", () => {
      const aliases = ["description", "ticket_description", "issue_description", "message", "ticket_message", "ticket_body"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          const result = resolveVariable(alias, baseCtx);
          expect(result).not.toBeNull();
        });
      }
    });

    describe("Ticket status aliases", () => {
      const aliases = ["status", "ticket_status", "issue_status"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "IN_PROGRESS"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("IN_PROGRESS");
        });
      }
    });

    describe("Ticket priority aliases", () => {
      const aliases = ["priority", "ticket_priority", "urgency", "priority_level"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "HIGH"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("HIGH");
        });
      }
    });

    describe("Ticket type aliases", () => {
      const aliases = ["type", "ticket_type", "issue_type"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "BUG"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("BUG");
        });
      }
    });

    describe("Agent name aliases", () => {
      const aliases = ["agent_name", "agent", "support_agent", "staff_name"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "Jane Smith"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("Jane Smith");
        });
      }
    });

    describe("Agent email aliases", () => {
      const aliases = ["agent_email", "staff_email"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "jane.smith@vellbase.com"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("jane.smith@vellbase.com");
        });
      }
    });

    describe("Department aliases", () => {
      const aliases = ["department", "department_name", "dept"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "Engineering"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("Engineering");
        });
      }
    });

    describe("Team aliases", () => {
      const aliases = ["team", "team_name", "group"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "Frontend"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("Frontend");
        });
      }
    });

    describe("Organization aliases", () => {
      const aliases = ["workspace", "workspace_name", "company", "company_name", "organization"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} → "Vellbase"`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe("Vellbase");
        });
      }
    });

    describe("URL aliases", () => {
      const aliases = ["ticket_url", "url", "ticket_link", "link", "reference_url", "view_link"];
      for (const alias of aliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          const result = resolveVariable(alias, baseCtx);
          expect(result).not.toBeNull();
        });
      }
    });

    describe("Date/Time aliases", () => {
      const dateAliases = ["date", "today", "current_date"];
      const timeAliases = ["time", "current_time"];
      const datetimeAliases = ["datetime", "current_datetime"];
      const yearAliases = ["year", "current_year"];
      const monthAliases = ["month", "current_month"];

      for (const alias of dateAliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          expect(resolveVariable(alias, baseCtx)).not.toBeNull();
        });
      }
      for (const alias of timeAliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          expect(resolveVariable(alias, baseCtx)).not.toBeNull();
        });
      }
      for (const alias of datetimeAliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          expect(resolveVariable(alias, baseCtx)).not.toBeNull();
        });
      }
      for (const alias of yearAliases) {
        it(`resolves {{${alias}}} → current year`, () => {
          expect(resolveVariable(alias, baseCtx)).toBe(String(new Date().getFullYear()));
        });
      }
      for (const alias of monthAliases) {
        it(`resolves {{${alias}}} (not null)`, () => {
          expect(resolveVariable(alias, baseCtx)).not.toBeNull();
        });
      }
    });

    describe("Case insensitivity", () => {
      it("resolves {{USER_NAME}} (uppercase)", () => {
        expect(resolveVariable("USER_NAME", baseCtx)).toBe("John Doe");
      });
      it("resolves {{User_Name}} (PascalCase)", () => {
        expect(resolveVariable("User_Name", baseCtx)).toBe("John Doe");
      });
      it("resolves {{ticket NUMBER}} (with space)", () => {
        expect(resolveVariable("ticket NUMBER", baseCtx)).toBe("TK-20107878677700");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. MISSING VARIABLE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("3. Missing Variable Tests", () => {
    it("leaves unknown {{variable}} intact", () => {
      expect(interpolateCannedVariables("Hello {{unknown_var}}", baseCtx)).toBe("Hello {{unknown_var}}");
    });
    it("leaves unknown {variable} intact", () => {
      expect(interpolateCannedVariables("Hello {unknown_var}", baseCtx)).toBe("Hello {unknown_var}");
    });
    it("leaves unknown %variable% intact", () => {
      expect(interpolateCannedVariables("Hello %unknown_var%", baseCtx)).toBe("Hello %unknown_var%");
    });
    it("leaves unknown [[variable]] intact", () => {
      expect(interpolateCannedVariables("Hello [[unknown_var]]", baseCtx)).toBe("Hello [[unknown_var]]");
    });
    it("leaves resolved and unresolved variables in same text", () => {
      const result = interpolateCannedVariables("Hi {{user_name}}, your {{unknown}} is ready", baseCtx);
      expect(result).toBe("Hi John Doe, your {{unknown}} is ready");
    });
    it("returns null from resolveVariable for unknown", () => {
      expect(resolveVariable("totally_made_up_var", baseCtx)).toBeNull();
    });
    it("handles context with null/undefined values", () => {
      const sparseCtx: VariableContext = { userName: null };
      const result = interpolateCannedVariables("Hi {{user_name}}", sparseCtx);
      // null resolves to null, so placeholder stays
      expect(result).toBe("Hi {{user_name}}");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. MULTI-LINE TEMPLATE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("4. Multi-Line Template Tests", () => {
    it("resolves variables across multiple lines", () => {
      const template = `Hi {{user_name}},\n\nYour ticket {{ticket_number}} has been updated.\nStatus: {{status}}\n\nRegards,\n{{agent_name}}`;
      const expected = `Hi John Doe,\n\nYour ticket TK-20107878677700 has been updated.\nStatus: IN_PROGRESS\n\nRegards,\nJane Smith`;
      expect(interpolateCannedVariables(template, baseCtx)).toBe(expected);
    });
    it("resolves variables in multi-line with blank lines", () => {
      const template = `Hello {{name}},\n\n\nYour issue "{{issue_title}}" is being reviewed.\n\n\nTicket: {{ticket_number}}`;
      const expected = `Hello John Doe,\n\n\nYour issue "Login page not loading on Safari" is being reviewed.\n\n\nTicket: TK-20107878677700`;
      expect(interpolateCannedVariables(template, baseCtx)).toBe(expected);
    });
    it("resolves variables at start, middle, and end of multi-line text", () => {
      const template = `{{user_name}}\n---\nTicket {{ticket_number}}: {{issue_title}}\nAssigned to {{agent_name}}`;
      const expected = `John Doe\n---\nTicket TK-20107878677700: Login page not loading on Safari\nAssigned to Jane Smith`;
      expect(interpolateCannedVariables(template, baseCtx)).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. SPECIAL CHARACTERS AND SPACES TESTS
  // ═══════════════════════════════════════════════════════════
  describe("5. Special Characters and Spaces Tests", () => {
    it("handles variables with leading/trailing spaces", () => {
      expect(interpolateCannedVariables("Hi {{  user_name  }}", baseCtx)).toBe("Hi John Doe");
    });
    it("handles variables with tabs", () => {
      expect(interpolateCannedVariables("Hi {{\tuser_name\t}}", baseCtx)).toBe("Hi John Doe");
    });
    it("handles text with special characters around variables", () => {
      expect(interpolateCannedVariables("Hi {{user_name}}! (Ref: #{{ticket_number}})", baseCtx)).toBe("Hi John Doe! (Ref: #TK-20107878677700)");
    });
    it("handles values with special characters", () => {
      const ctx: VariableContext = { ...baseCtx, userName: "O'Brien & Smith" };
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi O'Brien & Smith");
    });
    it("handles values with HTML-like content", () => {
      const ctx: VariableContext = { ...baseCtx, userName: "<script>alert(1)</script>" };
      // The engine should NOT sanitize — it's plain text replacement
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi <script>alert(1)</script>");
    });
    it("handles variables adjacent to text without spaces", () => {
      expect(interpolateCannedVariables("Dear{{user_name}},ref{{ticket_number}}", baseCtx)).toBe("DearJohn Doe,refTK-20107878677700");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. EDGE CASES
  // ═══════════════════════════════════════════════════════════
  describe("6. Edge Cases", () => {
    it("handles empty string", () => {
      expect(interpolateCannedVariables("", baseCtx)).toBe("");
    });
    it("handles text with no variables", () => {
      expect(interpolateCannedVariables("Just plain text", baseCtx)).toBe("Just plain text");
    });
    it("handles text with only a variable", () => {
      expect(interpolateCannedVariables("{{user_name}}", baseCtx)).toBe("John Doe");
    });
    it("handles empty variable {{}}", () => {
      expect(interpolateCannedVariables("Hello {{}}", baseCtx)).toBe("Hello {{}}");
    });
    it("handles very long text (5000+ chars) with variables", () => {
      const padding = "x".repeat(5000);
      const text = `Hi {{user_name}}, ${padding} {{ticket_number}}`;
      const result = interpolateCannedVariables(text, baseCtx);
      expect(result).toContain("John Doe");
      expect(result).toContain("TK-20107878677700");
      expect(result).toContain(padding);
    });
    it("handles text with only formatting markers and no variables", () => {
      const text = "**bold** *italic* ~~strike~~ `code`";
      expect(interpolateCannedVariables(text, baseCtx)).toBe(text);
    });
    it("handles emojis in text", () => {
      expect(interpolateCannedVariables("Hi {{user_name}} 🎉🚀", baseCtx)).toBe("Hi John Doe 🎉🚀");
    });
    it("handles emojis in variable values", () => {
      const ctx: VariableContext = { ...baseCtx, userName: "John 🎉 Doe" };
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi John 🎉 Doe");
    });
    it("handles mixed formatting and variables", () => {
      const text = "**{{user_name}}**, your ticket *{{ticket_number}}* is `{{status}}`";
      const expected = "**John Doe**, your ticket *TK-20107878677700* is `IN_PROGRESS`";
      expect(interpolateCannedVariables(text, baseCtx)).toBe(expected);
    });
    it("handles unicode characters", () => {
      const ctx: VariableContext = { ...baseCtx, userName: "José García-Müller" };
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi José García-Müller");
    });
    it("handles newlines and tabs in variable values", () => {
      const ctx: VariableContext = { ...baseCtx, description: "Line 1\nLine 2\tTabbed" };
      const result = interpolateCannedVariables("Desc: {{description}}", ctx);
      expect(result).toBe("Desc: Line 1\nLine 2\tTabbed");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. PERFORMANCE TESTS
  // ═══════════════════════════════════════════════════════════
  describe("7. Performance Tests", () => {
    it("replaces 100+ variables in <100ms", () => {
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push("{{user_name}} {{ticket_number}} {{issue_title}}");
      }
      const text = parts.join(" ");
      const start = performance.now();
      const result = interpolateCannedVariables(text, baseCtx);
      const elapsed = performance.now() - start;
      expect(result).toContain("John Doe");
      expect(elapsed).toBeLessThan(100);
    });

    it("handles 10,000+ character text in <100ms", () => {
      const padding = "A".repeat(10000);
      const text = `Hi {{user_name}}, ${padding} Ref: {{ticket_number}}`;
      const start = performance.now();
      const result = interpolateCannedVariables(text, baseCtx);
      const elapsed = performance.now() - start;
      expect(result).toContain("John Doe");
      expect(result).toContain("TK-20107878677700");
      expect(elapsed).toBeLessThan(100);
    });

    it("handles 50+ unique variables in one text", () => {
      const vars = [
        "user_name", "name", "customer_name", "username", "user",
        "user_email", "email", "user_handle", "handle", "user_plan",
        "user_role", "ticket_number", "ticket_id", "id", "ticket_no",
        "subject", "issue_title", "ticket_subject", "description", "message",
        "status", "priority", "type", "agent_name", "agent",
        "agent_email", "department", "department_name", "team", "team_name",
        "workspace", "company", "ticket_url", "url", "date",
        "time", "year", "month", "day", "hour",
        "minute", "datetime", "timestamp", "support_email", "staff_name",
        "support_agent", "urgency", "dept", "group", "organization",
      ];
      const text = vars.map((v) => `{{${v}}}`).join(" | ");
      const start = performance.now();
      const result = interpolateCannedVariables(text, baseCtx);
      const elapsed = performance.now() - start;
      // Should not contain any {{...}} (all resolved or at least attempted)
      expect(elapsed).toBeLessThan(100);
      // Most should be resolved (some date/time ones always resolve)
      expect(result).toContain("John Doe");
      expect(result).toContain("TK-20107878677700");
    });

    it("handles rapid repeated calls (100 iterations)", () => {
      const text = "Hi {{user_name}}, ticket {{ticket_number}}: {{issue_title}}";
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        interpolateCannedVariables(text, baseCtx);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500); // 100 iterations in <500ms
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. PARTIAL CONTEXT TESTS
  // ═══════════════════════════════════════════════════════════
  describe("8. Partial Context Tests", () => {
    it("works with minimal context (only userName)", () => {
      const ctx: VariableContext = { userName: "Alice" };
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi Alice");
      // Other variables stay as placeholders
      expect(interpolateCannedVariables("Ticket: {{ticket_number}}", ctx)).toBe("Ticket: {{ticket_number}}");
    });
    it("works with empty context", () => {
      const ctx: VariableContext = {};
      expect(interpolateCannedVariables("Hi {{user_name}}", ctx)).toBe("Hi {{user_name}}");
    });
    it("falls back from description to message", () => {
      const ctx: VariableContext = { message: "Fallback message" };
      expect(interpolateCannedVariables("{{description}}", ctx)).toBe("Fallback message");
    });
    it("falls back from agent email to support email", () => {
      const ctx: VariableContext = { supportEmail: "support@vellbase.com" };
      expect(interpolateCannedVariables("{{support_email}}", ctx)).toBe("support@vellbase.com");
    });
  });
});
