"use client";

interface ImageViewerProps {
  url: string;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  retryKey: number;
  onLoad: () => void;
  onError: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function ImageViewer({
  url, zoom, rotation, pan, retryKey, onLoad, onError,
  onMouseDown, onMouseMove, onMouseUp,
  onTouchStart, onTouchMove, onTouchEnd,
}: ImageViewerProps) {
  const canPan = zoom > 1;

  return (
    <div
      className="w-full h-full overflow-hidden flex items-center justify-center bg-zinc-100"
      style={{ cursor: canPan ? "grab" : "default" }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={retryKey}
        src={url}
        alt="Document preview"
        draggable={false}
        onLoad={onLoad}
        onError={onError}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="max-w-full max-h-full object-contain select-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: "center center",
          cursor: canPan ? "grab" : "default",
          userSelect: "none",
          WebkitUserDrag: "none",
        } as React.CSSProperties}
      />
    </div>
  );
}
