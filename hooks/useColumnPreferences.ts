"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preferencesApi } from "@/lib/api";
import {
  type TableKey,
  type ColumnPrefValue,
  defaultColumnsFor,
  getTableSpec,
  MIN_VISIBLE_COLUMNS,
} from "@/lib/columnConfig";

interface State {
  columns: string[];   // ordered, visible only
  loading: boolean;
  loadedFromServer: boolean;
}

// Loads the user's saved column layout for a table key. Falls back to the
// spec defaults on miss/error/timeout. Saves are debounced 500ms.
export function useColumnPreferences(tableKey: TableKey) {
  const spec = getTableSpec(tableKey);
  const fallback = useMemo(() => defaultColumnsFor(tableKey), [tableKey]);

  const [state, setState] = useState<State>({
    columns: fallback,
    loading: true,
    loadedFromServer: false,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Hard fallback if the request takes > 2s.
    const failover = setTimeout(() => {
      if (cancelled) return;
      setState(prev => prev.loadedFromServer ? prev : { ...prev, loading: false });
    }, 2000);

    preferencesApi
      .get<ColumnPrefValue>(tableKey)
      .then(res => {
        if (cancelled) return;
        const saved = res.data?.value?.columns;
        const sanitized = Array.isArray(saved)
          ? sanitize(saved, spec.columns.map(c => c.key), fallback)
          : fallback;
        setState({ columns: sanitized, loading: false, loadedFromServer: true });
      })
      .catch(() => {
        if (!cancelled) setState({ columns: fallback, loading: false, loadedFromServer: false });
      })
      .finally(() => clearTimeout(failover));

    return () => { cancelled = true; clearTimeout(failover); };
    // tableKey is the only meaningful dep; fallback/spec come from it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const persist = useCallback((cols: string[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      preferencesApi.put<ColumnPrefValue>(tableKey, { columns: cols }).catch(() => { /* swallow */ });
    }, 500);
  }, [tableKey]);

  const setColumns = useCallback((next: string[]) => {
    const validKeys = new Set(spec.columns.map(c => c.key));
    const filtered = next.filter(k => validKeys.has(k));
    if (filtered.length < MIN_VISIBLE_COLUMNS) return false;
    setState(prev => ({ ...prev, columns: filtered }));
    persist(filtered);
    return true;
  }, [spec, persist]);

  const toggle = useCallback((key: string) => {
    setState(prev => {
      const isVisible = prev.columns.includes(key);
      let nextCols: string[];
      if (isVisible) {
        nextCols = prev.columns.filter(k => k !== key);
        if (nextCols.length < MIN_VISIBLE_COLUMNS) return prev;
      } else {
        nextCols = [...prev.columns, key];
      }
      persist(nextCols);
      return { ...prev, columns: nextCols };
    });
  }, [persist]);

  const reset = useCallback(() => {
    setState(prev => ({ ...prev, columns: fallback }));
    persist(fallback);
  }, [fallback, persist]);

  const visibleSet = useMemo(() => new Set(state.columns), [state.columns]);
  const isCustom   = useMemo(() => {
    if (state.columns.length !== fallback.length) return true;
    return state.columns.some((k, i) => k !== fallback[i]);
  }, [state.columns, fallback]);

  return {
    columns:    state.columns,
    visibleSet,
    loading:    state.loading,
    isCustom,
    isVisible:  (key: string) => visibleSet.has(key),
    setColumns,
    toggle,
    reset,
    totalCount: spec.columns.length,
  };
}

function sanitize(saved: unknown[], valid: string[], fallback: string[]): string[] {
  const validSet = new Set(valid);
  const cleaned = saved.filter((k): k is string => typeof k === "string" && validSet.has(k));
  // De-duplicate while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of cleaned) if (!seen.has(k)) { seen.add(k); result.push(k); }
  return result.length >= MIN_VISIBLE_COLUMNS ? result : fallback;
}
