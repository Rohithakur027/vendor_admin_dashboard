"use client";

const MOZILLA_VIEWER = "https://mozilla.github.io/pdf.js/web/viewer.html";

interface PDFViewerProps {
  url: string;
  retryKey: number;
  onLoad: () => void;
  onError: (error: Error) => void;
}

export function PDFViewer({ url, retryKey, onLoad, onError }: PDFViewerProps) {
  const src = `${MOZILLA_VIEWER}?file=${encodeURIComponent(url)}`;

  return (
    <iframe
      key={`${url}__${retryKey}`}
      src={src}
      title="PDF preview"
      className="w-full h-full border-0 bg-zinc-200"
      onLoad={() => onLoad()}
      onError={() => onError(new Error("Failed to load PDF viewer"))}
    />
  );
}
