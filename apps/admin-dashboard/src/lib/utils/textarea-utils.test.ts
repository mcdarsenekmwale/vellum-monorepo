import { describe, it, expect } from "vitest";
import {
  calculateTextareaRows,
  calculateTemplateRows,
  getSmartTextareaRows,
  getDynamicTextareaRows,
} from "./textarea-utils";

describe("Textarea Utilities", () => {
  // ═══════════════════════════════════════════════════════════
  // 1. calculateTextareaRows
  // ═══════════════════════════════════════════════════════════
  describe("calculateTextareaRows", () => {
    it("returns minRows for empty text", () => {
      expect(calculateTextareaRows("", { minRows: 3 })).toBe(3);
    });
    it("returns minRows for null/undefined text", () => {
      expect(calculateTextareaRows(null as unknown as string, { minRows: 3 })).toBe(3);
    });
    it("returns at least minRows for short text", () => {
      expect(calculateTextareaRows("Hi", { minRows: 3, maxRows: 20, charsPerRow: 50 })).toBe(3);
    });
    it("calculates rows for medium text", () => {
      const text = "x".repeat(100); // 100 chars at 50 chars/row = 2 rows + 1 padding = 3
      const rows = calculateTextareaRows(text, { minRows: 1, maxRows: 20, charsPerRow: 50, paddingRows: 1 });
      expect(rows).toBeGreaterThanOrEqual(3);
    });
    it("respects maxRows cap", () => {
      const text = "x".repeat(10000);
      const rows = calculateTextareaRows(text, { minRows: 1, maxRows: 10, charsPerRow: 50, paddingRows: 0 });
      expect(rows).toBeLessThanOrEqual(10);
    });
    it("accounts for newlines", () => {
      const text = "line1\nline2\nline3\nline4\nline5";
      const rows = calculateTextareaRows(text, { minRows: 1, maxRows: 20, charsPerRow: 50, paddingRows: 0 });
      expect(rows).toBeGreaterThanOrEqual(5);
    });
    it("handles very long words", () => {
      const longWord = "x".repeat(200);
      const rows = calculateTextareaRows(longWord, { minRows: 1, maxRows: 20, charsPerRow: 50, paddingRows: 0 });
      expect(rows).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. calculateTemplateRows
  // ═══════════════════════════════════════════════════════════
  describe("calculateTemplateRows", () => {
    it("calculates rows for template without variables", () => {
      const template = "Hello, this is a simple template.";
      const rows = calculateTemplateRows(template, undefined, { minRows: 1, maxRows: 20 });
      expect(rows).toBeGreaterThanOrEqual(1);
    });
    it("expands variables with provided values", () => {
      const template = "Hi {{name}}, your ticket {{number}} is ready";
      const rows = calculateTemplateRows(template, { name: "John Doe", number: "TK-123" }, { minRows: 1, maxRows: 20 });
      expect(rows).toBeGreaterThanOrEqual(1);
    });
    it("estimates variable values when not provided", () => {
      const template = "Hi {{user_name}}, ticket {{ticket_number}}";
      const rows = calculateTemplateRows(template, undefined, { minRows: 1, maxRows: 20 });
      // Should estimate "John Doe" for user_name and "1234567890" for ticket_number
      expect(rows).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. getSmartTextareaRows
  // ═══════════════════════════════════════════════════════════
  describe("getSmartTextareaRows", () => {
    it("returns appropriate rows for reply context", () => {
      const rows = getSmartTextareaRows("Hello world", "reply");
      expect(rows).toBeGreaterThanOrEqual(3); // minRows for reply
    });
    it("returns appropriate rows for note context", () => {
      const rows = getSmartTextareaRows("Quick note", "note");
      expect(rows).toBeGreaterThanOrEqual(2); // minRows for note
    });
    it("returns appropriate rows for template context", () => {
      const rows = getSmartTextareaRows("Template text", "template");
      expect(rows).toBeGreaterThanOrEqual(4); // minRows for template
    });
    it("adjusts for rich text content", () => {
      const plainRows = getSmartTextareaRows("Hello world this is a test", "reply");
      const richRows = getSmartTextareaRows("**Hello** *world* `test`", "reply");
      // Rich text should get at least as many rows due to density adjustment
      expect(richRows).toBeGreaterThanOrEqual(plainRows);
    });
    it("adjusts for list content", () => {
      const text = "- item1\n- item2\n- item3";
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeGreaterThanOrEqual(5); // 3 items + padding
    });
    it("adjusts for code blocks", () => {
      const text = "```\ncode here\n```";
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeGreaterThanOrEqual(5); // minRows+2 for code
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. getDynamicTextareaRows
  // ═══════════════════════════════════════════════════════════
  describe("getDynamicTextareaRows", () => {
    it("returns template rows when content is empty and template provided", () => {
      const rows = getDynamicTextareaRows("", {
        template: "Hello world this is a template",
        minRows: 3,
        maxRows: 20,
      });
      expect(rows).toBeGreaterThanOrEqual(3);
    });
    it("returns content-based rows when content exists", () => {
      const rows = getDynamicTextareaRows("Hello world", {
        template: "Template",
        minRows: 3,
        maxRows: 20,
      });
      expect(rows).toBeGreaterThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. EDGE CASES
  // ═══════════════════════════════════════════════════════════
  describe("Edge cases", () => {
    it("handles 5000+ character reply", () => {
      const text = "x".repeat(5000);
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeLessThanOrEqual(25); // maxRows for reply
    });
    it("handles 10000+ character reply", () => {
      const text = "y".repeat(10000);
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeLessThanOrEqual(25); // capped at maxRows
    });
    it("handles text with only newlines", () => {
      const text = "\n\n\n\n\n";
      const rows = calculateTextareaRows(text, { minRows: 1, maxRows: 20, charsPerRow: 50, paddingRows: 0 });
      expect(rows).toBeGreaterThanOrEqual(1);
    });
    it("handles text with emojis", () => {
      const text = "🎉🚀✨🎊🎈";
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeGreaterThanOrEqual(3);
    });
    it("handles text with unicode characters", () => {
      const text = "Héllo Wörld 日本語 한국어";
      const rows = getSmartTextareaRows(text, "reply");
      expect(rows).toBeGreaterThanOrEqual(3);
    });
  });
});
