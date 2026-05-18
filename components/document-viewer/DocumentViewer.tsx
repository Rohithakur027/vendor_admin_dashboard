"use client";

import dynamic from "next/dynamic";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useDocumentViewer, type FileType } from "./useDocumentViewer";
import { DocumentToolbar } from "./DocumentToolbar";

// Load both viewers client-side only — they rely on browser APIs
const ImageViewer = dynamic(
  () => import("./ImageViewer").then(m => ({ default: m.ImageViewer })),
  { ssr: false }
);
const PDFViewer = dynamic(
  () => import("./PDFViewer").then(m => ({ default: m.PDFViewer })),
  { ssr: false }
);

interface DocumentViewerProps {
  url: string;
  fileName?: string;
  fileTypeHint?: FileType;
  onClose: () => void;
}

function Spinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 z-10">
      <div className="w-10 h-10 rounded-full border-4 border-zinc-200 border-t-blue-500 animate-spin" />
    </div>
  );
}

function ErrorState({ message, onRetry, url }: { message: string; onRetry: () => void; url: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-50 z-10 p-6">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-sm font-semibold text-zinc-600 text-center max-w-sm">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-zinc-700 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Open in tab
        </a>
      </div>
    </div>
  );
}

export function DocumentViewer({ url, fileName, fileTypeHint, onClose }: DocumentViewerProps) {
  const viewer = useDocumentViewer(url, onClose);
  const {
    viewableUrl, zoom, rotation, page, numPages,
    isFullscreen, loading, error, retryKey, pan,
    zoomIn, zoomOut, fitToScreen, rotateLeft, rotateRight,
    prevPage, nextPage, toggleFullscreen, retry,
    setNumPages, setLoading, setError,
    onMouseDown, onMouseMove, onMouseUp,
    onTouchStart, onTouchMove, onTouchEnd,
  } = viewer;

  // Caller can override auto-detection when the URL (e.g. a proxy path) has no
  // recognisable extension and detectFileType() would return "unknown".
  const fileType: FileType = fileTypeHint ?? viewer.fileType;

  async function handleDownload() {
    try {
      const res = await fetch(viewableUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName ?? "document";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(viewableUrl, "_blank");
    }
  }

  return (
    // Backdrop
    <div
      className={[
        "fixed inset-0 z-[300]",
        isFullscreen ? "" : "flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-10",
      ].join(" ")}
      onClick={isFullscreen ? undefined : onClose}
    >
      {/* Modal shell */}
      <div
        className={[
          "flex flex-col bg-white overflow-hidden shadow-2xl",
          isFullscreen
            ? "fixed inset-0"
            : "w-full max-w-4xl rounded-xl",
        ].join(" ")}
        style={isFullscreen ? undefined : { height: "min(90vh, 820px)" }}
        onClick={e => e.stopPropagation()}
      >
        <DocumentToolbar
          fileName={fileName}
          fileType={fileType}
          zoom={zoom}
          isFullscreen={isFullscreen}
          page={page}
          numPages={numPages}
          canZoomIn={zoom < 5}
          canZoomOut={zoom > 0.25}
          canPrevPage={page > 1}
          canNextPage={numPages !== null && page < numPages}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitToScreen={fitToScreen}
          onRotateLeft={rotateLeft}
          onRotateRight={rotateRight}
          onPrevPage={prevPage}
          onNextPage={nextPage}
          onToggleFullscreen={toggleFullscreen}
          onDownload={handleDownload}
          onClose={onClose}
        />

        {/* Viewer area */}
        <div className="relative flex-1 overflow-hidden">
          {loading && <Spinner />}
          {error && !loading && (
            <ErrorState message={error} onRetry={retry} url={viewableUrl} />
          )}

          {fileType === "image" && (
            <ImageViewer
              url={viewableUrl}
              zoom={zoom}
              rotation={rotation}
              pan={pan}
              retryKey={retryKey}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError("Failed to load image. The file may be unavailable."); }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />
          )}

          {fileType === "pdf" && (
            <PDFViewer
              url={viewableUrl}
              page={page}
              zoom={zoom}
              retryKey={retryKey}
              onDocumentLoad={n => { setNumPages(n); setLoading(false); }}
              onPageLoad={() => setLoading(false)}
              onError={e => { setLoading(false); setError(e?.message ?? "Failed to load PDF."); }}
            />
          )}

          {fileType === "unknown" && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-50">
              <p className="text-sm font-semibold text-zinc-500">Cannot preview this file type.</p>
              <a
                href={viewableUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
