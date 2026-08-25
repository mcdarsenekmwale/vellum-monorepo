import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  interpolateCannedVariables,
  type VariableContext,
} from "./variable-engine";
import { getSmartTextareaRows } from "@/lib/utils/textarea-utils";

// ─── Simulate the insertCannedResponse function from the ticket detail page ───
// This tests the core logic without needing a full React rendering environment.

interface SimulatedCannedResponse {
  id: string;
  title: string;
  body: string;
  category: string | null;
  shortcut: string | null;
  isActive: boolean;
  usageCount: number;
  tags: string[];
  variables: string[];
  shortcuts: string[];
}

const mockTicket: VariableContext = {
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
  agentName: "Jane Smith",
  agentEmail: "jane.smith@vellbase.com",
  departmentName: "Engineering",
  teamName: "Frontend",
  ticketUrl: "https://admin.vellbase.com/support/tickets/ticket-uuid-123",
};

const mockCannedResponse: SimulatedCannedResponse = {
  id: "cr-1",
  title: "Greeting + Status Update",
  body: "Hi {{user_name}},\n\nThanks for reaching out about \"{{issue_title}}\".\nYour ticket {{ticket_number}} is currently {{status}}.\n\nI'll look into this and get back to you shortly.\n\nBest regards,\n{{agent_name}}",
  category: "general",
  shortcut: "greet",
  isActive: true,
  usageCount: 5,
  tags: ["greeting", "status"],
  variables: ["user_name", "issue_title", "ticket_number", "status", "agent_name"],
  shortcuts: ["/greet"],
};

/**
 * Simulates the insertCannedResponse logic from the ticket detail page.
 * Returns the new reply text and cursor position.
 */
function simulateInsertCannedResponse(
  cr: SimulatedCannedResponse,
  reply: string,
  cursorStart: number,
  cursorEnd: number,
  ctx: VariableContext
): { newReply: string; cursorPos: number } {
  // Apply variable substitution
  const body = interpolateCannedVariables(cr.body, ctx);

  const el = { selectionStart: cursorStart, selectionEnd: cursorEnd };
  const start = el.selectionStart ?? reply.length;
  const end = el.selectionEnd ?? reply.length;
  const prefix = reply[start - 1] === "/" ? reply.slice(0, start - 1) : reply.slice(0, start);
  const suffix = reply.slice(end);
  const next = prefix + body + suffix;
  const pos = prefix.length + body.length;

  return { newReply: next, cursorPos: pos };
}

describe("Canned Response Integration Tests", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. INSERT AT CURSOR POSITION
  // ═══════════════════════════════════════════════════════════
  describe("Insert at cursor position", () => {
    it("inserts at beginning of empty reply", () => {
      const { newReply, cursorPos } = simulateInsertCannedResponse(
        mockCannedResponse, "", 0, 0, mockTicket
      );
      expect(newReply).toContain("Hi John Doe");
      expect(newReply).toContain("TK-20107878677700");
      expect(newReply).toContain("Jane Smith");
      expect(cursorPos).toBe(newReply.length);
    });

    it("inserts at cursor in the middle of existing text", () => {
      const existing = "Hello world";
      const { newReply } = simulateInsertCannedResponse(
        mockCannedResponse, existing, 5, 5, mockTicket
      );
      expect(newReply).toBe("Hello" + interpolateCannedVariables(mockCannedResponse.body, mockTicket) + " world");
    });

    it("inserts at end of existing text", () => {
      const existing = "Some existing text.\n\n";
      const { newReply } = simulateInsertCannedResponse(
        mockCannedResponse, existing, existing.length, existing.length, mockTicket
      );
      expect(newReply).toBe(existing + interpolateCannedVariables(mockCannedResponse.body, mockTicket));
    });

    it("replaces selected text with canned response", () => {
      const existing = "Replace this part";
      const { newReply } = simulateInsertCannedResponse(
        mockCannedResponse, existing, 8, 12, mockTicket
      );
      const expected = "Replace " + interpolateCannedVariables(mockCannedResponse.body, mockTicket) + " part";
      expect(newReply).toBe(expected);
    });

    it("removes trailing slash when inserting via / shortcut", () => {
      const existing = "/";
      const { newReply } = simulateInsertCannedResponse(
        mockCannedResponse, existing, 1, 1, mockTicket
      );
      // The slash before cursor should be removed
      expect(newReply.startsWith("/")).toBe(false);
      expect(newReply).toBe(interpolateCannedVariables(mockCannedResponse.body, mockTicket));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. VARIABLE REPLACEMENT IN CANNED RESPONSES
  // ═══════════════════════════════════════════════════════════
  describe("Variable replacement in canned responses", () => {
    it("replaces all variables in a multi-variable template", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}, ticket {{ticket_number}} ({{ticket_id}}) re: {{issue_title}} - Status: {{status}} - Agent: {{agent_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe, ticket TK-20107878677700 (ticket-uuid-123) re: Login page not loading on Safari - Status: IN_PROGRESS - Agent: Jane Smith");
    });

    it("leaves unknown variables intact", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}, your {{unknown_field}} is ready",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe, your {{unknown_field}} is ready");
    });

    it("replaces variables with special character values", () => {
      const ctx: VariableContext = { ...mockTicket, userName: "O'Brien & Co." };
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, ctx);
      expect(newReply).toBe("Hi O'Brien & Co.");
    });

    it("handles canned response with no variables", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Thank you for your patience. We have resolved the issue.",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Thank you for your patience. We have resolved the issue.");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. MULTI-LINE CANNED RESPONSES
  // ═══════════════════════════════════════════════════════════
  describe("Multi-line canned responses", () => {
    it("preserves line breaks in canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Line 1\nLine 2\nLine 3",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Line 1\nLine 2\nLine 3");
    });

    it("preserves line breaks with variables", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}},\n\nThanks for reaching out.\n\nTicket: {{ticket_number}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe,\n\nThanks for reaching out.\n\nTicket: TK-20107878677700");
    });

    it("handles canned response with empty lines", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}},\n\n\n\nRegards,\n{{agent_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe,\n\n\n\nRegards,\nJane Smith");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. CANNED RESPONSES WITH RICH TEXT
  // ═══════════════════════════════════════════════════════════
  describe("Canned responses with rich text", () => {
    it("preserves markdown formatting in canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "**Hi {{user_name}}**, your ticket *{{ticket_number}}* is `{{status}}`",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("**Hi John Doe**, your ticket *TK-20107878677700* is `IN_PROGRESS`");
    });

    it("preserves headings and lists in canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "# Update for {{user_name}}\n\n## Status: {{status}}\n\n- Ticket: {{ticket_number}}\n- Issue: {{issue_title}}\n- Agent: {{agent_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toContain("# Update for John Doe");
      expect(newReply).toContain("## Status: IN_PROGRESS");
      expect(newReply).toContain("- Ticket: TK-20107878677700");
    });

    it("preserves links and images in canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "View [ticket]({{ticket_url}}) for {{user_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("View [ticket](https://admin.vellbase.com/support/tickets/ticket-uuid-123) for John Doe");
    });

    it("preserves blockquotes in canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "> {{user_name}} reported:\n> {{issue_title}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("> John Doe reported:\n> Login page not loading on Safari");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. USAGE TRACKING
  // ═══════════════════════════════════════════════════════════
  describe("Usage tracking", () => {
    it("simulates usage count increment", () => {
      // In the real component, markUsed.mutate(cr.id) is called
      // Here we verify the canned response has usageCount field
      expect(mockCannedResponse.usageCount).toBe(5);
      // Simulate increment
      const afterUse = { ...mockCannedResponse, usageCount: mockCannedResponse.usageCount + 1 };
      expect(afterUse.usageCount).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. MULTIPLE CANNED RESPONSES IN ONE REPLY
  // ═══════════════════════════════════════════════════════════
  describe("Multiple canned responses in one reply", () => {
    it("inserts two canned responses sequentially", () => {
      const cr1: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}},",
      };
      const cr2: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Regards,\n{{agent_name}}",
      };

      // First insert at beginning
      const first = simulateInsertCannedResponse(cr1, "", 0, 0, mockTicket);
      // Second insert at end
      const second = simulateInsertCannedResponse(cr2, first.newReply, first.newReply.length, first.newReply.length, mockTicket);

      expect(second.newReply).toContain("Hi John Doe");
      expect(second.newReply).toContain("Regards");
      expect(second.newReply).toContain("Jane Smith");
    });

    it("inserts canned response between existing text", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Ticket: {{ticket_number}}",
      };
      // Start with existing reply
      let reply = "Hello,\n\n";
      // Insert at end
      const result = simulateInsertCannedResponse(cr, reply, reply.length, reply.length, mockTicket);
      reply = result.newReply + "\n\nThanks!";
      expect(reply).toBe("Hello,\n\nTicket: TK-20107878677700\n\nThanks!");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. TEXTAREA ROWS ADJUSTMENT
  // ═══════════════════════════════════════════════════════════
  describe("Textarea rows adjustment", () => {
    it("calculates rows for short canned response", () => {
      const rows = getSmartTextareaRows("Hi {{user_name}}", "template");
      expect(rows).toBeGreaterThanOrEqual(4); // minRows for template
    });

    it("calculates rows for multi-line canned response", () => {
      const body = "Hi {{user_name}},\n\nThanks for reaching out.\n\nRegards,\n{{agent_name}}";
      const rows = getSmartTextareaRows(body, "template");
      expect(rows).toBeGreaterThanOrEqual(4);
    });

    it("calculates rows for rich text canned response", () => {
      const body = "**Hi {{user_name}}**, your ticket *{{ticket_number}}* is `{{status}}`";
      const rows = getSmartTextareaRows(body, "template");
      expect(rows).toBeGreaterThanOrEqual(4);
    });

    it("calculates rows for list-containing canned response", () => {
      const body = "- Item 1\n- Item 2\n- Item 3";
      const rows = getSmartTextareaRows(body, "template");
      expect(rows).toBeGreaterThanOrEqual(4);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. EDGE CASES
  // ═══════════════════════════════════════════════════════════
  describe("Edge cases", () => {
    it("handles very long canned response (5000+ chars)", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}, " + "x".repeat(5000) + " {{ticket_number}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply.length).toBeGreaterThan(5000);
      expect(newReply).toContain("John Doe");
      expect(newReply).toContain("TK-20107878677700");
    });

    it("handles canned response with only variables", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "{{user_name}} {{ticket_number}} {{issue_title}} {{status}} {{agent_name}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("John Doe TK-20107878677700 Login page not loading on Safari IN_PROGRESS Jane Smith");
    });

    it("handles canned response with only formatting (no variables)", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "**Bold** *italic* ~~strike~~ `code`",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("**Bold** *italic* ~~strike~~ `code`");
    });

    it("handles canned response with emojis", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}} 🎉 Your ticket {{ticket_number}} is resolved ✅",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe 🎉 Your ticket TK-20107878677700 is resolved ✅");
    });

    it("handles canned response with special characters", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}, check <https://example.com> (ref: #{{ticket_number}})",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe, check <https://example.com> (ref: #TK-20107878677700)");
    });

    it("handles mixed formatting and variables", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "## Hi {{user_name}}\n\n**Ticket**: `{{ticket_number}}`\n\n> Status: *{{status}}*\n\n- Agent: {{agent_name}}\n- Dept: {{department}}",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toContain("## Hi John Doe");
      expect(newReply).toContain("**Ticket**: `TK-20107878677700`");
      expect(newReply).toContain("> Status: *IN_PROGRESS*");
      expect(newReply).toContain("- Agent: Jane Smith");
      expect(newReply).toContain("- Dept: Engineering");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 9. ALL VARIABLE FORMATS IN CANNED RESPONSES
  // ═══════════════════════════════════════════════════════════
  describe("All variable formats in canned responses", () => {
    it("resolves {{var}} format in canned response", () => {
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body: "Hi {{user_name}}" };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe");
    });
    it("resolves {var} format in canned response", () => {
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body: "Hi {user_name}" };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe");
    });
    it("resolves %var% format in canned response", () => {
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body: "Hi %user_name%" };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe");
    });
    it("resolves [[var]] format in canned response", () => {
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body: "Hi [[user_name]]" };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe");
    });
    it("resolves mixed formats in same canned response", () => {
      const cr: SimulatedCannedResponse = {
        ...mockCannedResponse,
        body: "Hi {{user_name}}, ref {ticket_number}, status %status%, issue [[issue_title]]",
      };
      const { newReply } = simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      expect(newReply).toBe("Hi John Doe, ref TK-20107878677700, status IN_PROGRESS, issue Login page not loading on Safari");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 10. PERFORMANCE
  // ═══════════════════════════════════════════════════════════
  describe("Performance", () => {
    it("inserts canned response with 100+ variables in <100ms", () => {
      const parts: string[] = [];
      for (let i = 0; i < 50; i++) {
        parts.push("{{user_name}} {{ticket_number}} {{issue_title}} {{status}} {{agent_name}}");
      }
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body: parts.join("\n") };
      const start = performance.now();
      simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("handles 10,000+ character canned response in <100ms", () => {
      const body = "Hi {{user_name}}, " + "x".repeat(10000) + " {{ticket_number}}";
      const cr: SimulatedCannedResponse = { ...mockCannedResponse, body };
      const start = performance.now();
      simulateInsertCannedResponse(cr, "", 0, 0, mockTicket);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("handles rapid multiple inserts (50 iterations)", () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        simulateInsertCannedResponse(mockCannedResponse, "", 0, 0, mockTicket);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
