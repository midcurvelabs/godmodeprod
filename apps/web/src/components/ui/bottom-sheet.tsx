"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Extra class applied to the sheet container. */
  className?: string;
}

export function BottomSheet({ open, onClose, title, children, className = "" }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      {/* Sheet */}
      <div
        className={`relative w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl bg-bg-surface border-t sm:border border-border max-h-[90vh] flex flex-col shadow-2xl animate-[slideUp_0.2s_ease-out] ${className}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Slide-down top sheet used on mobile for filters / configuration UI.
 */
export function TopSheet({ open, onClose, title, children, className = "" }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className={`relative w-full rounded-b-2xl bg-bg-surface border-b border-border max-h-[85vh] flex flex-col shadow-2xl ${className}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
