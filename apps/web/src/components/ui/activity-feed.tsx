"use client";

import { useEffect, useState } from "react";
import type { ActivityLog } from "@godmodeprod/shared";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ActivityFeed({
  showId,
  episodeId,
}: {
  showId: string;
  episodeId?: string;
}) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ show_id: showId });
      if (episodeId) params.set("episode_id", episodeId);
      const res = await fetch(`/api/activity?${params}`);
      const json = await res.json();
      setActivities(json.activities || []);
      setLoading(false);
    }
    load();
  }, [showId, episodeId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-bg-elevated rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No activity yet. Actions will appear here as you use the platform.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((a) => (
        <div
          key={a.id}
          className="px-3 py-2 rounded hover:bg-bg-elevated transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {a.action}
            </span>
            <span className="text-[11px] text-text-muted font-mono">
              {timeAgo(a.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
