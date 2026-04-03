"use client";

import { useState, useRef, type DragEvent } from "react";
import { Upload, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onUpload: (content: string) => Promise<void>;
  uploading: boolean;
}

export function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [rawInput, setRawInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".txt") || file.name.endsWith(".md"))) {
      readFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) setRawInput(text);
    };
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (!rawInput.trim()) return;
    await onUpload(rawInput.trim());
    setRawInput("");
  }

  const wordCount = rawInput.trim() ? rawInput.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-1">
          Upload Transcript
        </h3>
        <p className="text-[11px] text-text-muted">
          Paste, drag a .txt/.md file, or click to upload.
        </p>
      </div>
      <div
        className={`flex-1 p-4 transition-colors ${dragging ? "bg-accent/5" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {rawInput ? (
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste your raw transcript here..."
            className="w-full h-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono text-[13px] leading-relaxed"
          />
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragging ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} className={`mb-2 ${dragging ? "text-accent" : "text-text-muted"}`} />
            <p className="text-sm text-text-secondary mb-1">
              {dragging ? "Drop transcript here" : "Drop .txt or .md file"}
            </p>
            <p className="text-[11px] text-text-muted">or click to browse, or paste below</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-text-muted">
            {wordCount > 0 ? `${wordCount.toLocaleString()} words` : "No content"}
          </span>
          {rawInput && !uploading && (
            <button
              onClick={() => setRawInput("")}
              className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {uploading ? (
          <div className="text-center py-2">
            <Loader2 size={18} className="animate-spin text-accent mx-auto mb-1" />
            <p className="text-xs text-text-secondary">Uploading...</p>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!rawInput.trim()}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            <Upload size={16} /> Upload & Process
          </button>
        )}
      </div>
    </div>
  );
}
