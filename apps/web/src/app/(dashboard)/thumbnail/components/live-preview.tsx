"use client";

interface Host {
  id: string;
  name: string;
}

interface LivePreviewProps {
  photos: Record<string, string>;
  hosts: Host[];
  hostOrder: string[];
  episodeNumber: number;
  subtitle: string;
  textSize: "small" | "medium" | "large";
  stripePosition: "top" | "middle" | "bottom";
}

const TEXT_SIZES = {
  small: "text-lg",
  medium: "text-2xl",
  large: "text-3xl",
} as const;

export function LivePreview({
  photos,
  hosts,
  hostOrder,
  episodeNumber,
  subtitle,
  textSize,
  stripePosition,
}: LivePreviewProps) {
  const hostMap = Object.fromEntries(hosts.map((h) => [h.id, h]));
  const orderedHosts = hostOrder.map((id) => hostMap[id]).filter(Boolean);

  return (
    <div>
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted mb-3">
        Live Preview
      </h3>
      {/* 16:9 preview container */}
      <div className="relative aspect-video bg-bg-primary rounded-lg border border-border overflow-hidden">
        {/* Red stripe */}
        <div
          className={`absolute left-0 right-0 h-12 bg-accent/90 z-10 ${
            stripePosition === "top" ? "top-0" :
            stripePosition === "middle" ? "top-1/2 -translate-y-1/2" :
            "bottom-0"
          }`}
        />

        {/* Host photos */}
        <div className="absolute inset-0 flex items-end justify-center gap-2 pb-14 px-4 z-20">
          {orderedHosts.map((host) => {
            const url = photos[host.id];
            return (
              <div key={host.id} className="flex flex-col items-center">
                <div className="w-24 h-32 bg-bg-elevated rounded overflow-hidden border border-border">
                  {url ? (
                    <img src={url} alt={host.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">
                      {host.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Episode number */}
        <div className="absolute top-3 left-4 z-30">
          <span className="font-display text-xl text-white/90">
            EP. {String(episodeNumber).padStart(2, "0")}
          </span>
        </div>

        {/* Subtitle */}
        <div className="absolute bottom-3 left-4 right-4 z-30 text-center">
          <p className={`font-display ${TEXT_SIZES[textSize]} text-white uppercase leading-tight drop-shadow-lg`}>
            {subtitle || "Your headline here"}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-text-muted mt-1.5 text-center">
        1920 x 1080 — Scaled preview
      </p>
    </div>
  );
}
