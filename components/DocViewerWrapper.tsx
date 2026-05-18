"use client";

import { pdfjs } from "react-pdf";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

// pdfjs-dist v4 requires an explicit worker — without this it throws
// "Invalid parameter object: need either .data, .range or .url"
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function DocViewerWrapper({ uri }: { uri: string }) {
  if (!uri) return null;

  return (
    <DocViewer
      documents={[{ uri }]}
      pluginRenderers={DocViewerRenderers}
      style={{ width: "100%", height: "100%", background: "#f8fafc" }}
      config={{
        header: { disableHeader: true, disableFileName: true, retainURLParams: false },
        csvDelimiter: ",",
        pdfZoom: { defaultZoom: 1.1, zoomJump: 0.2 },
        pdfVerticalScrollByDefault: true,
      }}
    />
  );
}
