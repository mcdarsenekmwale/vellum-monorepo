import { useState, useRef, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface ShimmerImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  showErrorState?: boolean;
  aspectRatio?: string;
}

export default function ShimmerImage({
  src,
  alt,
  className,
  wrapperClassName,
  showErrorState = true,
  aspectRatio,
  ...props
}: ShimmerImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setStatus('loading');
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [src]);

  const handleLoad = () => {
    setStatus('loaded');
    props.onLoad?.(undefined as any);
  };

  const handleError = () => {
    setStatus('error');
    props.onError?.(undefined as any);
  };

  const wrapperStyle = aspectRatio
    ? { aspectRatio, position: 'relative' as const }
    : { position: 'relative' as const };

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)} style={wrapperStyle}>
      {status === 'loading' && (
        <div
          className={cn(
            'shimmer absolute inset-0 z-0',
            className
          )}
          aria-hidden="true"
        />
      )}

      {status === 'error' && showErrorState && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center bg-muted',
            className
          )}
          aria-label="Image failed to load"
        >
          <ImageOff className="size-8 text-muted-foreground opacity-50" />
        </div>
      )}

      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'relative z-10 transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      )}
    </div>
  );
}
