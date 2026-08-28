// ─── Component: AutoHeightReadonlyTextarea ────────────────────────────────────

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AutoHeightReadonlyTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  className?: string;
  minRows?: number;
  maxRows?: number;
  lineHeight?: number;
  paddingY?: number;
}

export function AutoHeightReadonlyTextarea({
  value,
  className,
  minRows = 1,
  maxRows = 20,
  lineHeight = 24, // pixels
  paddingY = 12, // pixels (top + bottom padding)
  ...props
}: AutoHeightReadonlyTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(minRows);

  // ─── Calculate rows based on content ───
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // ─── Step 1: Get the actual rendered height ───
    // Reset height to auto to get accurate scrollHeight
    el.style.height = 'auto';
    
    // ─── Step 2: Calculate content height ───
    const contentHeight = el.scrollHeight;
    const availableHeight = contentHeight - paddingY; // Subtract padding
    
    // ─── Step 3: Calculate number of rows ───
    let calculatedRows = Math.ceil(availableHeight / lineHeight);
    
    // ─── Step 4: Clamp to min/max ───
    calculatedRows = Math.max(minRows, Math.min(calculatedRows, maxRows));
    
    // ─── Step 5: Apply ───
    setRows(calculatedRows);
    el.style.height = `${calculatedRows * lineHeight + paddingY}px`;
    
  }, [value, minRows, maxRows, lineHeight, paddingY]);

  // ─── Recalculate on font size changes ───
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      // Recalculate when element size changes
      el.style.height = 'auto';
      const contentHeight = el.scrollHeight;
      const availableHeight = contentHeight - paddingY;
      let calculatedRows = Math.ceil(availableHeight / lineHeight);
      calculatedRows = Math.max(minRows, Math.min(calculatedRows, maxRows));
      setRows(calculatedRows);
      el.style.height = `${calculatedRows * lineHeight + paddingY}px`;
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [minRows, maxRows, lineHeight, paddingY]);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        disabled
        readOnly
        className={cn(
          "w-full resize-none overflow-y-auto",
          "bg-transparent",
          "text-sm leading-relaxed text-foreground/90",
          "focus:outline-none focus:ring-0",
          "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
          className
        )}
        style={{
          height: 'auto',
          minHeight: `${minRows * lineHeight + paddingY}px`,
          maxHeight: `${maxRows * lineHeight + paddingY}px`,
          paddingTop: `${paddingY / 2}px`,
          paddingBottom: `${paddingY / 2}px`,
          lineHeight: `${lineHeight}px`,
        }}
        {...props}
      />
      
      {/* ─── Optional: Show content length indicator ─── */}
      <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/50 pointer-events-none">
        {value.length} chars
      </div>
    </div>
  );
}
