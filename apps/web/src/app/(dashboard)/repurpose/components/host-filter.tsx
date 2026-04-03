"use client";

interface HostFilterProps {
  hosts: string[];
  selected: string | null; // null = all
  onChange: (host: string | null) => void;
}

export function HostFilter({ hosts, selected, onChange }: HostFilterProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onChange(null)}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          selected === null
            ? "bg-accent/15 text-accent"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        All
      </button>
      {hosts.map((host) => (
        <button
          key={host}
          onClick={() => onChange(host)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            selected === host
              ? "bg-accent/15 text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {host}
        </button>
      ))}
    </div>
  );
}
