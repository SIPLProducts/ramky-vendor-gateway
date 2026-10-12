import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fitRotatedImage, rotateClockwise } from '@/lib/image-rotation';

interface ImagePreviewProps {
  src: string;
  alt: string;
}

/** Remount for each source, keeping orientation local to a single viewing session. */
export function ImagePreview(props: ImagePreviewProps) {
  return <RotatableImage key={props.src} {...props} />;
}

function RotatableImage({ src, alt }: ImagePreviewProps) {
  const [rotation, setRotation] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setViewport({ width: Math.max(0, element.clientWidth - 24), height: Math.max(0, element.clientHeight - 24) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const size = fitRotatedImage(naturalSize.width, naturalSize.height, viewport.width, viewport.height, rotation);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-end border-b bg-muted/40 px-2 py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Rotate image clockwise" disabled={!size} onClick={() => setRotation(rotateClockwise)}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate 90° clockwise</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div ref={container} className="relative h-[min(60vh,600px)] min-w-0 overflow-hidden bg-muted/20">
        <img
          src={src}
          alt={alt}
          onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="absolute left-1/2 top-1/2 max-w-none object-contain"
          style={{ width: size?.width, height: size?.height, visibility: size ? 'visible' : 'hidden', transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        />
      </div>
    </div>
  );
}