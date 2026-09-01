import { useEffect, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiWebProfileFABProps {
  /** Controlled or uncontrolled – click handler toggles via parent. */
  onOpenChange: (open: boolean) => void;
  isOpen?: boolean;
  /** Minimum scrollTop before the button becomes visible (default 300). */
  threshold?: number;
  className?: string;
}

/**
 * Scroll-aware floating action button – the *second* entry point to the
 * shared AI chat drawer (dual-access UX: inline coach bar + scroll FAB).
 *
 * 44×44 touch target. Sticky fixed bottom-right (bottom-6 right-6).
 * Hidden at page top; reveals once the user scrolls past `threshold` px.
 */
export function AiWebProfileFAB({
  onOpenChange,
  isOpen = false,
  threshold = 300,
  className,
}: AiWebProfileFABProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Initialize to current scroll (SSR-hydration safe).
    setVisible(window.scrollY >= threshold);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setVisible(window.scrollY >= threshold);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold]);

  const handleClick = useCallback(() => {
    onOpenChange(!isOpen);
  }, [onOpenChange, isOpen]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Open Vell AI Coach"
      aria-expanded={isOpen}
      className={cn(
        'fixed z-40 right-6 bottom-6 size-11 rounded-full',
        'grid place-items-center',
        'bg-accent text-white shadow-lg shadow-accent-900/20',
        'ring-1 ring-accent-400/30',
        'transition-all duration-300 ease-out',
        'hover:scale-105 hover:shadow-xl hover:shadow-accent-900/25',
        'active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-2 focus:ring-offset-background',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none',
        className,
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <Sparkles className="size-5" strokeWidth={2.25} aria-hidden />
      {/* Subtle pulse ring to draw attention on reveal */}
      {visible && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-accent-400/30 animate-ping"
          style={{ animationDuration: '1.6s', animationIterationCount: 1 }}
        />
      )}
    </button>
  );
}

export default AiWebProfileFAB;
