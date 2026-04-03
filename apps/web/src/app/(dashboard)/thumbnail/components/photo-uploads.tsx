"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";

interface Host {
  id: string;
  name: string;
}

interface PhotoUploadsProps {
  hosts: Host[];
  photos: Record<string, string>;
  onPhotoChange: (hostId: string, url: string) => void;
}

function PhotoZone({
  host,
  photoUrl,
  onChange,
}: {
  host: Host;
  photoUrl: string;
  onChange: (url: string) => void;
}) {
  const [inputUrl, setInputUrl] = useState("");

  if (photoUrl) {
    return (
      <div className="relative">
        <div className="aspect-square bg-bg-elevated border border-border rounded-lg overflow-hidden">
          <img
            src={photoUrl}
            alt={host.name}
            className="w-full h-full object-cover"
          />
        </div>
        <button
          onClick={() => onChange("")}
          className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X size={12} />
        </button>
        <p className="text-xs text-text-secondary text-center mt-1.5">{host.name}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-square bg-bg-elevated border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center p-4">
        <ImageIcon size={24} className="text-text-muted mb-2" />
        <p className="text-xs text-text-muted mb-2">{host.name}</p>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste image URL..."
          className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputUrl.trim()) {
              onChange(inputUrl.trim());
              setInputUrl("");
            }
          }}
        />
        <button
          onClick={() => {
            if (inputUrl.trim()) {
              onChange(inputUrl.trim());
              setInputUrl("");
            }
          }}
          disabled={!inputUrl.trim()}
          className="mt-1.5 w-full px-2 py-1 rounded bg-bg-primary border border-border text-[11px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Add Photo
        </button>
      </div>
    </div>
  );
}

export function PhotoUploads({ hosts, photos, onPhotoChange }: PhotoUploadsProps) {
  return (
    <div>
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3">
        Host Photos
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {hosts.map((host) => (
          <PhotoZone
            key={host.id}
            host={host}
            photoUrl={photos[host.id] || ""}
            onChange={(url) => onPhotoChange(host.id, url)}
          />
        ))}
      </div>
    </div>
  );
}
