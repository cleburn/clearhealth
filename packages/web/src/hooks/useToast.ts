/**
 * ClearHealth Web — Toast Hook
 *
 * Simple toast notification state management.
 * Uses React state to manage toast queue — no global store.
 */

"use client";

import { useState, useCallback } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

let toastCounter = 0;

/** Global toast state for cross-component access */
let globalAddToast: ((toast: Omit<ToastMessage, "id">) => void) | null = null;
let _globalDismissToast: ((id: string) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register global accessors
  globalAddToast = addToast;
  _globalDismissToast = dismissToast;

  return { toasts, addToast, dismissToast };
}

/** Fire a toast from anywhere (requires ToastProvider to be mounted) */
export function toast(message: Omit<ToastMessage, "id">): void {
  if (globalAddToast) {
    globalAddToast(message);
  }
}
