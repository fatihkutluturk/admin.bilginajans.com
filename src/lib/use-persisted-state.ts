"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useState backed by localStorage. SSR-safe — returns defaultValue during SSR,
 * reads localStorage only after hydration.
 *
 * Supports primitives, objects, arrays, and Set (serialized as arrays).
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const fullKey = `wpadmin:${key}`;
  const isSet = defaultValue instanceof Set;

  // Initialize from localStorage (client only)
  const [value, setValueRaw] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(fullKey);
      if (stored === null) return defaultValue;
      const parsed = JSON.parse(stored);
      // Restore Set from array
      if (isSet && Array.isArray(parsed)) return new Set(parsed) as T;
      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  // Write to localStorage on change
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip writing on first render to avoid overwriting with default during SSR hydration
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      const toStore = value instanceof Set ? Array.from(value) : value;
      localStorage.setItem(fullKey, JSON.stringify(toStore));
    } catch {
      // Storage full or unavailable — fail silently
    }
  }, [fullKey, value]);

  // Wrapped setter that handles functional updates
  const setValue = useCallback(
    (update: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const next = typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
        return next;
      });
    },
    []
  );

  return [value, setValue];
}

/**
 * Clear all persisted state for a given prefix.
 * Useful for "reset" functionality.
 */
export function clearPersistedState(prefix?: string) {
  if (typeof window === "undefined") return;
  const fullPrefix = prefix ? `wpadmin:${prefix}` : "wpadmin:";
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(fullPrefix));
  keys.forEach((k) => localStorage.removeItem(k));
}
