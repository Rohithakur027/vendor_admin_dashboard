"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, RefreshCw, ExternalLink, X, Maximize2, Minimize2, Download, FileText } from "lucide-react";
import { useDocumentViewer, type FileType } from "./useDocumentViewer";
import { DocumentToolbar } from "./DocumentToolbar";

// Image viewer is loaded client-side only (it uses browser-only APIs).
const ImageViewer = dynamic(
  () => import("./ImageViewer").then(m => ({ default: m.ImageViewer })),
  { ssr: false }
);
// PDF viewer is now an iframe to Mozilla's hosted pdf.js — also client-only
// because it accesses window during render.
const PDFViewer = dynamic(
  () => import("./PDFViewer").then(m => ({ default: m.PDFViewer })),
  { ssr: false }
);

interface DocumentViewerProps {
  url: string;
  fileName?: string;
  fileTypeHint?: FileType;
  onClose: () => void;
  /**
   * Optional resolver that swaps the auth-gated `url` for a short-lived
   * public URL. Required for PDFs served from a token-protected backend
   * endpoint, because the embedded Mozilla viewer fetches the file from a
   * different origin and cannot send our bearer token.
   */
  previewLinkResolver?: () => Promise<string>;
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

// Slim toolbar for the PDF case — Mozilla's viewer ships its own zoom / page /
// rotation controls, so we only expose download, fullscreen, and close here to
// avoid duplicating UI that doesn't act on the iframe.
function PDFToolbar({
  fileName, isFullscreen, onToggleFullscreen, onDownload, onClose,
}: {
  fileName?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-2 h-12 bg-zinc-900 border-b border-zinc-700 shrink-0 select-none">
      <div className="flex items-center gap-1.5 min-w-0 pr-2">
        <FileText className="w-4 h-4 text-red-400 shrink-0" />
        {fileName && (
          <span className="text-zinc-300 text-xs truncate max-w-[160px] md:max-w-[260px]">{fileName}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex items-center justify-center w-8 h-8 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onDownload}
          title="Download"
          className="flex items-center justify-center w-8 h-8 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="flex items-center justify-center w-8 h-8 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function DocumentViewer({ url, fileName, fileTypeHint, onClose, previewLinkResolver }: DocumentViewerProps) {
  const viewer = useDocumentViewer(url, onClose);
  const {
    viewableUrl, zoom, rotation, page, numPages,
    isFullscreen, loading, error, retryKey, pan,
    zoomIn, zoomOut, fitToScreen, rotateLeft, rotateRight,
    prevPage, nextPage, toggleFullscreen, retry,
    setLoading, setError,
    onMouseDown, onMouseMove, onMouseUp,
    onTouchStart, onTouchMove, onTouchEnd,
  } = viewer;

  // Caller can override auto-detection when the URL (e.g. a proxy path) has no
  // recognisable extension and detectFileType() would return "unknown".
  const fileType: FileType = fileTypeHint ?? viewer.fileType;

  const isDrivePreview = false;

  // For PDFs, resolve a public signed URL (if a resolver is provided) so the
  // cross-origin Mozilla viewer can actually fetch the file. For other types
  // (image / unknown) we keep the passed-in URL as-is.
  const [pdfPublicUrl, setPdfPublicUrl] = useState<string | null>(null);
  const [resolvingPreview, setResolvingPreview] = useState(false);

  const resolverRef = useRef(previewLinkResolver);
  useEffect(() => { resolverRef.current = previewLinkResolver; }, [previewLinkResolver]);

  useEffect(() => {
    if (fileType !== "pdf" || !resolverRef.current) {
      setPdfPublicUrl(null);
      return;
    }
    const resolver = resolverRef.current;
    let cancelled = false;
    setResolvingPreview(true);
    setError(null);
    resolver()
      .then(publicUrl => { if (!cancelled) setPdfPublicUrl(publicUrl); })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to prepare preview link");
      })
      .finally(() => { if (!cancelled) setResolvingPreview(false); });
    return () => { cancelled = true; };
  // url is the stable identity here — the resolver itself may change every
  // render in the parent (fresh closure), so we deliberately don't depend on
  // it. retryKey re-fires the effect on user-triggered retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileType, url, retryKey]);

  // For PDFs we hand Mozilla's viewer the public URL when we have one;
  // otherwise fall back to the original (works only when same-origin / public).
  const pdfSrcUrl = fileType === "pdf" ? (pdfPublicUrl ?? viewableUrl) : viewableUrl;

  async function handleDownload() {
    const downloadUrl = fileType === "pdf" ? pdfSrcUrl : viewableUrl;
    try {
      const res  = await fetch(downloadUrl);
      const blob = await res.blob();
      const a    = document.createElement("a");
      a.href     = URL.createObjectURL(blob);
      a.download = fileName ?? "document";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(downloadUrl, "_blank");
    }
  }

  const isPdf       = fileType === "pdf";
  const showSpinner = loading || (isPdf && resolvingPreview);
  const pdfReady    = isPdf && (!previewLinkResolver || pdfPublicUrl !== null);

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
        {isPdf ? (
          <PDFToolbar
            fileName={fileName}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onDownload={handleDownload}
            onClose={onClose}
          />
        ) : (
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
        )}

        {/* Viewer area */}
        <div className="relative flex-1 overflow-hidden">
          {showSpinner && <Spinner />}
          {error && !showSpinner && (
            <ErrorState message={error} onRetry={retry} url={pdfSrcUrl} />
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

          {isPdf && pdfReady && (
            <PDFViewer
              url={pdfSrcUrl}
              retryKey={retryKey}
              onLoad={() => setLoading(false)}
              onError={e => { setLoading(false); setError(e?.message ?? "Failed to load PDF."); }}
            />
          )}

          {fileType === "unknown" && !loading && !error && (
            isDrivePreview ? (
              <iframe
                src={viewableUrl}
                title={fileName ?? "Document"}
                className="w-full h-full border-0 bg-white"
                allow="autoplay"
              />
            ) : (
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
            )
          )}
        </div>
      </div>
    </div>
  );
}
