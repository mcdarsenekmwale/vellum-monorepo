import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AutoHeightReadonlyTextarea } from '@/components/ui/auto-height-readonly-textarea';
// ─── Implementation with Markdown/Formatted Text Support ────────────────────

function RichTextDisplay({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const MAX_HEIGHT = 200; // pixels

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setShouldTruncate(el.scrollHeight > MAX_HEIGHT);
    }
  }, [content]);

  const displayContent = isExpanded ? content : content.slice(0, 500);
  const showExpandButton = shouldTruncate || content.length > 500;

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        className={cn(
          "prose prose-sm max-w-none",
          !isExpanded && "max-h-[200px] overflow-hidden"
        )}
        style={{ 
          maxHeight: isExpanded ? 'none' : `${MAX_HEIGHT}px`,
          transition: 'max-height 0.3s ease'
        }}
      >
        <AutoHeightReadonlyTextarea
          value={displayContent}
          minRows={1}
          maxRows={isExpanded ? 20 : 8}
          className="text-sm font-normal"
        />
      </div>
      
      {showExpandButton && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 text-xs hover:text-primary cursor-pointer transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}

export default RichTextDisplay;
