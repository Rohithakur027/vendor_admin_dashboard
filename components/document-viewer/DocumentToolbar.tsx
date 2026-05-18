"use client";

import {
  X, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2, Minimize2,
  Download, ChevronLeft, ChevronRight, Shrink, FileText, Image as ImageIcon,
} from "lucide-react";
import type { FileType } from "./useDocumentViewer";

interface DocumentToolbarProps {
  fileName?: string;
  fileType: FileType;
  zoom: number;
  isFullscreen: boolean;
  page: number;
  numPages: number | null;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canPrevPage: boolean;
  canNextPage: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleFullscreen: () => void;
  onDownload: () => void;
  onClose: () => void;
}

function Btn({
  onClick, disabled = false, title, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-zinc-700 mx-0.5 shrink-0" />;
}

export function DocumentToolbar({
  fileName, fileType, zoom, isFullscreen, page, numPages,
  canZoomIn, canZoomOut, canPrevPage, canNextPage,
  onZoomIn, onZoomOut, onFitToScreen, onRotateLeft, onRotateRight,
  onPrevPage, onNextPage, onToggleFullscreen, onDownload, onClose,
}: DocumentToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 h-12 bg-zinc-900 border-b border-zinc-700 shrink-0 select-none overflow-x-auto">
      {/* File info */}
      <div className="flex items-center gap-1.5 min-w-0 pr-2">
        {fileType === "pdf"
          ? <FileText className="w-4 h-4 text-red-400 shrink-0" />
          : <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
        }
        {fileName && (
          <span className="text-zinc-300 text-xs truncate max-w-[140px] md:max-w-[240px]">
            {fileName}
          </span>
        )}
      </div>

      {/* PDF navigation */}
      {fileType === "pdf" && (
        <>
          <Btn onClick={onPrevPage} disabled={!canPrevPage} title="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </Btn>
          <span className="text-zinc-400 text-xs whitespace-nowrap px-1 tabular-nums">
            {numPages === null ? "—" : `${page} / ${numPages}`}
          </span>
          <Btn onClick={onNextPage} disabled={!canNextPage} title="Next page">
            <ChevronRight className="w-4 h-4" />
          </Btn>
          <Divider />
        </>
      )}

      {/* Zoom */}
      <Btn onClick={onZoomOut} disabled={!canZoomOut} title="Zoom out">
        <ZoomOut className="w-4 h-4" />
      </Btn>
      <span className="text-zinc-400 text-xs w-10 text-center tabular-nums shrink-0">
        {Math.round(zoom * 100)}%
      </span>
      <Btn onClick={onZoomIn} disabled={!canZoomIn} title="Zoom in">
        <ZoomIn className="w-4 h-4" />
      </Btn>
      <Btn onClick={onFitToScreen} title="Fit to screen">
        <Shrink className="w-4 h-4" />
      </Btn>

      {/* Image-only: rotation */}
      {fileType === "image" && (
        <>
          <Divider />
          <Btn onClick={onRotateLeft} title="Rotate left">
            <RotateCcw className="w-4 h-4" />
          </Btn>
          <Btn onClick={onRotateRight} title="Rotate right">
            <RotateCw className="w-4 h-4" />
          </Btn>
        </>
      )}

      <Divider />

      {/* Fullscreen + Download */}
      <Btn onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        {isFullscreen
          ? <Minimize2 className="w-4 h-4" />
          : <Maximize2 className="w-4 h-4" />
        }
      </Btn>
      <Btn onClick={onDownload} title="Download">
        <Download className="w-4 h-4" />
      </Btn>

      {/* Close — far right */}
      <div className="ml-auto pl-1">
        <Btn onClick={onClose} title="Close (Esc)">
          <X className="w-4 h-4" />
        </Btn>
      </div>
    </div>
  );
}
