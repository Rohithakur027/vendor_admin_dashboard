"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type FileType = "pdf" | "image" | "unknown";

export function detectFileType(url: string): FileType {
  if (!url) return "unknown";
  const clean = url.toLowerCase().split("?")[0];
  if (clean.endsWith(".pdf") || clean.includes("/raw/upload/")) return "pdf";
  if (/\.(jpe?g|png|webp)/.test(clean) || (clean.includes("/image/upload/") && !clean.endsWith(".pdf"))) return "image";
  return "unknown";
}

export function getViewableUrl(url: string): string {
  return url;
}

export interface UseDocumentViewerReturn {
  fileType: FileType;
  viewableUrl: string;
  zoom: number;
  rotation: number;
  page: number;
  numPages: number | null;
  isFullscreen: boolean;
  loading: boolean;
  error: string | null;
  retryKey: number;
  pan: { x: number; y: number };
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  prevPage: () => void;
  nextPage: () => void;
  toggleFullscreen: () => void;
  retry: () => void;
  setNumPages: (n: number) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function useDocumentViewer(url: string, onClose?: () => void): UseDocumentViewerReturn {
  const fileType = detectFileType(url);
  const viewableUrl = getViewableUrl(url);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Use refs to avoid stale closures in drag handlers
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panRef = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(+(z + 0.25).toFixed(2), 5)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(+(z - 0.25).toFixed(2), 0.25)), []);

  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const rotateLeft = useCallback(() => {
    setRotation(r => (r - 90 + 360) % 360);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const rotateRight = useCallback(() => {
    setRotation(r => (r + 90) % 360);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const prevPage = useCallback(() => setPage(p => Math.max(p - 1, 1)), []);
  const nextPage = useCallback(() => setPage(p => Math.min(p + 1, numPages ?? 1)), [numPages]);
  const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey(k => k + 1);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) { setIsFullscreen(false); return; }
        onClose?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, onClose]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, []);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    isDragging.current = true;
    dragStart.current = { x: t.clientX - panRef.current.x, y: t.clientY - panRef.current.y };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    setPan({ x: t.clientX - dragStart.current.x, y: t.clientY - dragStart.current.y });
  }, []);

  const onTouchEnd = useCallback(() => { isDragging.current = false; }, []);

  return {
    fileType, viewableUrl, zoom, rotation, page, numPages,
    isFullscreen, loading, error, retryKey, pan,
    zoomIn, zoomOut, fitToScreen, rotateLeft, rotateRight,
    prevPage, nextPage, toggleFullscreen, retry,
    setNumPages, setLoading, setError,
    onMouseDown, onMouseMove, onMouseUp,
    onTouchStart, onTouchMove, onTouchEnd,
  };
}
