import { describe, it, expect } from "vitest";
import { RICH_TEXT_FORMATS, type RichTextFormat } from "./variable-engine";

// ─── Helper: simulate applyFormat logic from the ticket detail page ───
function applyFormatToText(
  reply: string,
  start: number,
  end: number,
  format: RichTextFormat
): { text: string; cursorPos: number } {
  const selectedText = reply.substring(start, end);

  if (start === end) {
    // No selection - insert preview
    const newText = reply.slice(0, start) + format.preview + reply.slice(start);
    return { text: newText, cursorPos: start + format.preview.length };
  }

  let formatted = selectedText;
  if (format.type === "link") {
    formatted = `[${selectedText}](url)`;
  } else if (format.type === "image") {
    formatted = `![${selectedText}](image-url)`;
  } else if (format.type === "bulletList") {
    formatted = selectedText.split("\n").map((line) => `- ${line}`).join("\n");
  } else if (format.type === "numberList") {
    formatted = selectedText.split("\n").map((line, i) => `${i + 1}. ${line}`).join("\n");
  } else if (format.type === "horizontalRule") {
    formatted = "---";
  } else {
    formatted = format.prefix + selectedText + format.suffix;
  }

  const newText = reply.slice(0, start) + formatted + reply.slice(end);
  return { text: newText, cursorPos: start + formatted.length };
}

describe("Rich Text Formatting Tests", () => {
  // ═══════════════════════════════════════════════════════════
  // 1. FORMAT DEFINITIONS
  // ═══════════════════════════════════════════════════════════
  describe("Format definitions", () => {
    it("defines all 14 required formats", () => {
      const types = RICH_TEXT_FORMATS.map((f) => f.type);
      expect(types).toContain("bold");
      expect(types).toContain("italic");
      expect(types).toContain("underline");
      expect(types).toContain("strikethrough");
      expect(types).toContain("code");
      expect(types).toContain("link");
      expect(types).toContain("image");
      expect(types).toContain("quote");
      expect(types).toContain("heading1");
      expect(types).toContain("heading2");
      expect(types).toContain("heading3");
      expect(types).toContain("bulletList");
      expect(types).toContain("numberList");
      expect(types).toContain("horizontalRule");
      expect(RICH_TEXT_FORMATS.length).toBe(14);
    });

    it("each format has prefix, suffix, and preview", () => {
      for (const format of RICH_TEXT_FORMATS) {
        expect(format.prefix).toBeDefined();
        expect(format.suffix).toBeDefined();
        expect(format.preview).toBeDefined();
        expect(typeof format.prefix).toBe("string");
        expect(typeof format.suffix).toBe("string");
        expect(typeof format.preview).toBe("string");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. INDIVIDUAL FORMAT TESTS
  // ═══════════════════════════════════════════════════════════
  describe("Bold formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
    it("wraps selected text with **", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("**Hello** world");
    });
    it("inserts preview when no selection", () => {
      const result = applyFormatToText("Hello", 5, 5, format);
      expect(result.text).toBe("Hello**Bold**");
    });
  });

  describe("Italic formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "italic")!;
    it("wraps selected text with *", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("*Hello* world");
    });
    it("inserts preview when no selection", () => {
      const result = applyFormatToText("Hello", 5, 5, format);
      expect(result.text).toBe("Hello*Italic*");
    });
  });

  describe("Underline formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "underline")!;
    it("wraps selected text with __", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("__Hello__ world");
    });
  });

  describe("Strikethrough formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "strikethrough")!;
    it("wraps selected text with ~~", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("~~Hello~~ world");
    });
  });

  describe("Code formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "code")!;
    it("wraps selected text with backticks", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("`Hello` world");
    });
  });

  describe("Quote formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "quote")!;
    it("prefixes selected text with > ", () => {
      const result = applyFormatToText("Hello world", 0, 5, format);
      expect(result.text).toBe("> Hello world");
    });
  });

  describe("Heading formats", () => {
    it("heading1 prefixes with # ", () => {
      const format = RICH_TEXT_FORMATS.find((f) => f.type === "heading1")!;
      const result = applyFormatToText("Title here", 0, 5, format);
      expect(result.text).toBe("# Title here");
    });
    it("heading2 prefixes with ## ", () => {
      const format = RICH_TEXT_FORMATS.find((f) => f.type === "heading2")!;
      const result = applyFormatToText("Title here", 0, 5, format);
      expect(result.text).toBe("## Title here");
    });
    it("heading3 prefixes with ### ", () => {
      const format = RICH_TEXT_FORMATS.find((f) => f.type === "heading3")!;
      const result = applyFormatToText("Title here", 0, 5, format);
      expect(result.text).toBe("### Title here");
    });
  });

  describe("Bullet list formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "bulletList")!;
    it("prefixes each line with - ", () => {
      const result = applyFormatToText("item1\nitem2\nitem3", 0, 17, format);
      expect(result.text).toBe("- item1\n- item2\n- item3");
    });
    it("handles single line", () => {
      const result = applyFormatToText("single item", 0, 11, format);
      expect(result.text).toBe("- single item");
    });
  });

  describe("Numbered list formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "numberList")!;
    it("numbers each line", () => {
      const result = applyFormatToText("item1\nitem2\nitem3", 0, 17, format);
      expect(result.text).toBe("1. item1\n2. item2\n3. item3");
    });
    it("numbers single line", () => {
      const result = applyFormatToText("single item", 0, 11, format);
      expect(result.text).toBe("1. single item");
    });
  });

  describe("Link formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "link")!;
    it("wraps selected text as markdown link", () => {
      const result = applyFormatToText("Click here", 0, 10, format);
      expect(result.text).toBe("[Click here](url)");
    });
  });

  describe("Image formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "image")!;
    it("wraps selected text as markdown image", () => {
      const result = applyFormatToText("alt text", 0, 8, format);
      expect(result.text).toBe("![alt text](image-url)");
    });
  });

  describe("Horizontal rule formatting", () => {
    const format = RICH_TEXT_FORMATS.find((f) => f.type === "horizontalRule")!;
    it("replaces selection with ---", () => {
      const result = applyFormatToText("some text", 0, 9, format);
      expect(result.text).toBe("---");
    });
    it("inserts --- when no selection", () => {
      const result = applyFormatToText("text", 4, 4, format);
      expect(result.text).toBe("text---");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. EDGE CASES FOR FORMATTING
  // ═══════════════════════════════════════════════════════════
  describe("Formatting edge cases", () => {
    it("handles formatting at start of text", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      const result = applyFormatToText("Hello world", 0, 5, bold);
      expect(result.text).toBe("**Hello** world");
      expect(result.cursorPos).toBe(9);
    });
    it("handles formatting at end of text", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      const result = applyFormatToText("Hello world", 6, 11, bold);
      expect(result.text).toBe("Hello **world**");
      expect(result.cursorPos).toBe(15);
    });
    it("handles formatting entire text", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      const result = applyFormatToText("Hello", 0, 5, bold);
      expect(result.text).toBe("**Hello**");
    });
    it("handles formatting with empty selection (inserts preview)", () => {
      const italic = RICH_TEXT_FORMATS.find((f) => f.type === "italic")!;
      const result = applyFormatToText("Hello", 2, 2, italic);
      expect(result.text).toBe("He*Italic*llo");
    });
    it("handles multiple format applications", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      // First: bold "Hello"
      let result = applyFormatToText("Hello world", 0, 5, bold);
      expect(result.text).toBe("**Hello** world");
      // Second: bold "world" (note: positions shifted)
      result = applyFormatToText(result.text, 10, 15, bold);
      expect(result.text).toBe("**Hello** **world**");
    });
    it("handles formatting with special characters in selection", () => {
      const code = RICH_TEXT_FORMATS.find((f) => f.type === "code")!;
      const result = applyFormatToText("const x = {a: 1}", 0, 17, code);
      expect(result.text).toBe("`const x = {a: 1}`");
    });
    it("handles formatting with emojis in selection", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      // "Hello 🎉 world" — 🎉 is 2 UTF-16 code units, so "Hello " is 6 chars, "Hello 🎉" is 8
      const result = applyFormatToText("Hello 🎉 world", 0, 8, bold);
      expect(result.text).toBe("**Hello 🎉** world");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. PERFORMANCE
  // ═══════════════════════════════════════════════════════════
  describe("Performance", () => {
    it("handles rapid repeated formatting operations (100 iterations)", () => {
      const bold = RICH_TEXT_FORMATS.find((f) => f.type === "bold")!;
      let text = "Hello world";
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const result = applyFormatToText(text, 0, 5, bold);
        text = result.text;
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
