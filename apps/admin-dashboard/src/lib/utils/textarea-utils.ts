// lib/utils/textarea-utils.ts

import { useState, useCallback } from "react";

/**
 * Calculates the optimal number of rows for a textarea based on content size
 * and template length. Provides dynamic, expandable behavior.
 */

interface TextareaSizeOptions {
  /** Minimum number of rows to display */
  minRows?: number;
  /** Maximum number of rows before scrolling */
  maxRows?: number;
  /** Number of characters per row (based on typical width) */
  charsPerRow?: number;
  /** Whether to account for newlines in the content */
  accountForNewlines?: boolean;
  /** Additional padding rows to add for comfort */
  paddingRows?: number;
  /** Whether to auto-expand as user types */
  autoExpand?: boolean;
}

const DEFAULT_OPTIONS: Required<TextareaSizeOptions> = {
  minRows: 3,
  maxRows: 20,
  charsPerRow: 50,
  accountForNewlines: true,
  paddingRows: 1,
  autoExpand: true,
};

/**
 * Calculate the number of rows needed for a given text content
 * 
 * @param text - The text content to measure
 * @param options - Configuration options
 * @returns The calculated row count
 */
export function calculateTextareaRows(
  text: string,
  options: TextareaSizeOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { minRows, maxRows, charsPerRow, accountForNewlines, paddingRows } = opts;

  if (!text || text.length === 0) {
    return minRows;
  }

  // ─── Step 1: Account for existing newlines ───
  let rowCount = 1;
  let segments = [text];

  if (accountForNewlines) {
    // Split by newlines to count explicit line breaks
    const lines = text.split('\n');
    // Filter out empty lines at the end
    const nonEmptyLines = lines.filter((line, index) => 
      index === lines.length - 1 || line.length > 0 || lines.slice(index + 1).some(l => l.length > 0)
    );
    
    // Each line is at least 1 row
    rowCount = nonEmptyLines.length;
    
    // For each line, calculate wrapping
    for (const line of nonEmptyLines) {
      if (line.length > 0) {
        // Calculate how many lines this line wraps to
        const wrappedLines = Math.ceil(line.length / charsPerRow);
        // Add the wrapped lines (subtract 1 because the line itself is already counted)
        rowCount += wrappedLines - 1;
      }
    }
  } else {
    // Simple character-based calculation
    rowCount = Math.ceil(text.length / charsPerRow);
  }

  // ─── Step 2: Handle very long words (no wrapping) ───
  // Check for words longer than charsPerRow
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length > charsPerRow) {
      // Add extra rows for long words
      const extraRows = Math.ceil((word.length - charsPerRow) / (charsPerRow * 0.8));
      rowCount += extraRows;
    }
  }

  // ─── Step 3: Apply padding ───
  rowCount += paddingRows;

  // ─── Step 4: Clamp to min/max ───
  return Math.min(Math.max(rowCount, minRows), maxRows);
}

/**
 * Calculate rows for a template (canned response) with variable placeholders
 * 
 * @param template - The template string with potential variable placeholders
 * @param variableValues - Optional values to estimate template expansion
 * @param options - Configuration options
 * @returns The calculated row count
 */
export function calculateTemplateRows(
  template: string,
  variableValues?: Record<string, string>,
  options: TextareaSizeOptions = {}
): number {
  // ─── Step 1: Expand variables with estimated values ───
  let expandedText = template;
  
  if (variableValues) {
    // Replace variables with their estimated values or the variable name as a placeholder
    expandedText = template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      // Use provided value, or use the variable name as a placeholder estimate
      const value = variableValues[trimmedName];
      if (value) {
        return value;
      }
      // Estimate the value length based on common patterns
      if (trimmedName.includes('name') || trimmedName.includes('Name')) {
        return 'John Doe';
      } else if (trimmedName.includes('email') || trimmedName.includes('Email')) {
        return 'john.doe@example.com';
      } else if (trimmedName.includes('number') || trimmedName.includes('Number')) {
        return '1234567890';
      } else if (trimmedName.includes('id') || trimmedName.includes('Id')) {
        return 'abc-123-def-456';
      } else if (trimmedName.includes('date') || trimmedName.includes('Date')) {
        return new Date().toLocaleDateString();
      } else if (trimmedName.includes('time') || trimmedName.includes('Time')) {
        return new Date().toLocaleTimeString();
      } else {
        // Use the variable name with underscores replaced with spaces as a placeholder
        return trimmedName.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
      }
    });
  }

  // ─── Step 2: Calculate rows using the main algorithm ───
  return calculateTextareaRows(expandedText, options);
}

/**
 * Get dynamic rows for a reply textarea based on content and context
 * 
 * @param content - The current text content
 * @param templateMetadata - Optional template metadata for estimation
 * @param options - Configuration options
 * @returns The optimal row count
 */
export function getDynamicTextareaRows(
  content: string,
  templateMetadata?: {
    template?: string;
    variables?: Record<string, string>;
    minRows?: number;
    maxRows?: number;
  },
  options: TextareaSizeOptions = {}
): number {
  // ─── Step 1: If there's a template and content is empty, use template estimation ───
  if (templateMetadata?.template && (!content || content.length === 0)) {
    return calculateTemplateRows(
      templateMetadata.template,
      templateMetadata.variables,
      {
        minRows: templateMetadata.minRows ?? 3,
        maxRows: templateMetadata.maxRows ?? 20,
        ...options,
      }
    );
  }

  // ─── Step 2: Otherwise, calculate based on current content ───
  const dynamicRows = calculateTextareaRows(content, {
    minRows: templateMetadata?.minRows ?? 3,
    maxRows: templateMetadata?.maxRows ?? 20,
    ...options,
  });

  // ─── Step 3: If content is empty but there's a template name, show template preview ───
  if (!content && templateMetadata?.template) {
    const previewText = `[Template: ${templateMetadata.template.slice(0, 50)}${templateMetadata.template.length > 50 ? '...' : ''}]`;
    const previewRows = calculateTextareaRows(previewText, { minRows: 1, maxRows: 3, ...options });
    return Math.max(previewRows, dynamicRows);
  }

  return dynamicRows;
}

/**
 * Smart rows calculator with adaptive behavior based on content type
 * 
 * @param content - The text content
 * @param context - Context about the textarea purpose
 * @param options - Configuration options
 * @returns The calculated row count
 */
export function getSmartTextareaRows(
  content: string,
  context: 'reply' | 'note' | 'template' | 'message',
  options: TextareaSizeOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Adjust parameters based on context
  switch (context) {
    case 'reply':
      // Replies should be comfortable for typing, allow more expansion
      opts.charsPerRow = 55;
      opts.minRows = 3;
      opts.maxRows = 25;
      opts.paddingRows = 2;
      break;
    case 'note':
      // Notes are usually shorter, more compact
      opts.charsPerRow = 50;
      opts.minRows = 2;
      opts.maxRows = 15;
      opts.paddingRows = 1;
      break;
    case 'template':
      // Templates can be long, show more initially
      opts.charsPerRow = 60;
      opts.minRows = 4;
      opts.maxRows = 30;
      opts.paddingRows = 1;
      break;
    case 'message':
      // General messages
      opts.charsPerRow = 50;
      opts.minRows = 3;
      opts.maxRows = 20;
      opts.paddingRows = 1;
      break;
    default:
      break;
  }

  // ─── Detect if content contains rich text formatting ───
  const hasRichText = /(\*\*|\*|__|~~|`|>|#|\[.*\]\(.*\)|!\[.*\]\(.*\))/.test(content);
  
  if (hasRichText) {
    // Rich text formatting adds visual density, slightly reduce chars per row
    opts.charsPerRow = Math.max(40, opts.charsPerRow - 10);
    opts.paddingRows = Math.min(3, opts.paddingRows + 1);
  }

  // ─── Detect if content has lists ───
  const hasLists = /^[-*]\s/m.test(content) || /^\d+\.\s/m.test(content);
  
  if (hasLists) {
    // Lists need more vertical space for readability
    opts.paddingRows = Math.min(4, opts.paddingRows + 2);
  }

  // ─── Detect if content has code blocks ───
  const hasCodeBlocks = /```[\s\S]*```|`[^`]+`/.test(content);
  
  if (hasCodeBlocks) {
    // Code blocks need more space
    opts.charsPerRow = Math.max(40, opts.charsPerRow - 10);
    opts.minRows = Math.min(10, opts.minRows + 2);
  }

  return calculateTextareaRows(content, opts);
}

/**
 * Utility hook for dynamic textarea rows
 * 
 * @param initialContent - Initial text content
 * @param options - Configuration options
 * @returns Object with current content, rows, and update function
 */
export function useDynamicTextareaRows(
  initialContent: string = '',
  options: TextareaSizeOptions = {}
) {
  const [content, setContent] = useState(initialContent);
  const [rows, setRows] = useState(() => calculateTextareaRows(initialContent, options));

  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    const newRows = calculateTextareaRows(newContent, options);
    setRows(newRows);
  }, [options]);

  return {
    content,
    rows,
    updateContent,
    setRows,
  };
}