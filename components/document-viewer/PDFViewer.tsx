"use client";

import { useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Serve the worker as a plain static file from /public so the browser can
// actually load it as a Worker script. The new URL(..., import.meta.url)
// approach produces a bundled path that Next.js/Turbopack can't serve as a
// standalone script, causing PDF.js to hang silently.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PDF_OPTIONS = {
  cMapUrl:    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

const BASE_WIDTH = 680;

interface PDFViewerProps {
  url: string;
  page: number;
  zoom: number;
  retryKey: number;
  onDocumentLoad: (numPages: number) => void;
  onPageLoad: () => void;
  onError: (error: Error) => void;
}

export function PDFViewer({
  url, page, zoom, retryKey, onDocumentLoad, onPageLoad, onError,
}: PDFViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-auto flex flex-col items-center py-6 gap-4 bg-zinc-200"
    >
      <Document
        key={`${url}__${retryKey}`}
        file={url}
        options={PDF_OPTIONS}
        onLoadSuccess={({ numPages }) => onDocumentLoad(numPages)}
        onLoadError={onError}
        loading={null}
        error={null}
      >
        <div
          className="shadow-xl rounded-sm overflow-hidden"
          style={{ width: BASE_WIDTH * zoom }}
        >
          <Page
            pageNumber={page}
            width={BASE_WIDTH * zoom}
            onRenderSuccess={onPageLoad}
            onRenderError={onError}
            renderAnnotationLayer
            renderTextLayer
            loading={null}
          />
        </div>
      </Document>
    </div>
  );
}
