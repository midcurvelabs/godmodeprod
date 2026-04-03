"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function CopyButton({ text, label, size = "sm", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const iconSize = size === "sm" ? 11 : 14;
  const textSize = size === "sm" ? "text-[11px]" : "text-sm";

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2 py-1 rounded ${textSize} transition-colors ${
        copied
          ? "text-success"
          : "text-text-muted hover:text-text-secondary"
      } ${className}`}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      {label !== undefined ? (copied ? "Copied!" : label) : (copied ? "Copied!" : "Copy")}
    </button>
  );
}
