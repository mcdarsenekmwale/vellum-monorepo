import { useState, useRef, useEffect } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface ShimmerVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src?: string;
  poster?: string;
  className?: string;
  wrapperClassName?: string;
  showErrorState?: boolean;
  aspectRatio?: string;
}

export default function ShimmerVideo({
  src,
  poster,
  className,
  wrapperClassName,
  showErrorState = true,
  aspectRatio,
  ...props
}: ShimmerVideoProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setStatus('loading');
  }, [src]);

  const handleLoadedData = () => {
    setStatus('loaded');
    props.onLoadedData?.(undefined as any);
  };

  const handleError = () => {
    setStatus('error');
    props.onError?.(undefined as any);
  };

  const wrapperStyle = aspectRatio
    ? { aspectRatio, position: 'relative' as const }
    : { position: 'relative' as const };

  return (
    <div className={cn('relative overflow-hidden bg-muted', wrapperClassName)} style={wrapperStyle}>
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
            'absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted gap-2',
            className
          )}
          aria-label="Video failed to load"
        >
          <VideoOff className="size-10 text-muted-foreground opacity-50" />
          <span className="text-sm text-muted-foreground">Video unavailable</span>
        </div>
      )}

      {src && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          onLoadedData={handleLoadedData}
          onError={handleError}
          onCanPlay={handleLoadedData}
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
