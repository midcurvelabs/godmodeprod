"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface OutputBlockProps {
  content: string;
  language?: "markdown" | "json" | "text";
}

export function OutputBlock({ content, language = "text" }: OutputBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-bg-primary border border-border rounded-lg p-4 group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-bg-elevated border border-border text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all"
        title="Copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre
        className={`text-sm whitespace-pre-wrap ${
          language === "json" ? "font-mono" : "font-sans"
        } text-text-primary`}
      >
        {content}
      </pre>
    </div>
  );
}
