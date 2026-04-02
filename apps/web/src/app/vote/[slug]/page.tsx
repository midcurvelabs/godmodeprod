"use client";

import { useState, useEffect, use } from "react";
import { ThumbsUp, ThumbsDown, ChevronRight, CheckCircle2 } from "lucide-react";

interface VoteTopic {
  id: string;
  title: string;
  context: string;
  angle: string;
  sources: Array<{ url: string; title: string }>;
}

export default function VotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [topics, setTopics] = useState<VoteTopic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const [loading, setLoading] = useState(true);
  const [showSlug, setShowSlug] = useState(slug);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShowSlug(slug);
  }, [slug]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch show by slug, then get episode topics
      const showRes = await fetch(`/api/shows`);
      const showJson = await showRes.json();
      const show = (showJson.shows || []).find(
        (s: { slug: string }) => s.slug === showSlug
      );
      if (!show) {
        setLoading(false);
        return;
      }

      // Get latest episode with docket_open status
      const epRes = await fetch(`/api/episodes?show_id=${show.id}`);
      const epJson = await epRes.json();
      const episodes = epJson.episodes || [];
      const activeEp = episodes.find(
        (e: { status: string }) =>
          e.status === "docket_open" || e.status === "created"
      );
      if (!activeEp) {
        setLoading(false);
        return;
      }

      // Get under_review topics
      const topicRes = await fetch(
        `/api/docket/topics?episode_id=${activeEp.id}&status=under_review`
      );
      const topicJson = await topicRes.json();
      setTopics(topicJson.topics || []);
      setLoading(false);
    }
    load();
  }, [showSlug]);

  function vote(direction: "up" | "down") {
    if (!topics[currentIndex]) return;
    setVotes((prev) => ({ ...prev, [topics[currentIndex].id]: direction }));

    if (currentIndex < topics.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setDone(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E8001D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center px-6">
        <div>
          <h1
            className="text-4xl font-bold text-[#E8001D] mb-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            NO TOPICS TO VOTE ON
          </h1>
          <p className="text-[#888888] text-sm">
            Check back later — the hosts haven&apos;t submitted topics yet.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center px-6">
        <div>
          <CheckCircle2 size={48} className="text-[#22C55E] mx-auto mb-4" />
          <h1
            className="text-4xl font-bold text-[#E8001D] mb-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VOTES SUBMITTED
          </h1>
          <p className="text-[#888888] text-sm mb-2">
            You voted on {Object.keys(votes).length} topic{Object.keys(votes).length > 1 ? "s" : ""}.
          </p>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <span className="text-[#22C55E]">
              {Object.values(votes).filter((v) => v === "up").length} up
            </span>
            <span className="text-[#EF4444]">
              {Object.values(votes).filter((v) => v === "down").length} down
            </span>
          </div>
        </div>
      </div>
    );
  }

  const topic = topics[currentIndex];

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-[#444444] font-medium">
            Topic {currentIndex + 1} of {topics.length}
          </span>
          <span className="text-[11px] text-[#444444]">
            {Math.round(((currentIndex) / topics.length) * 100)}% done
          </span>
        </div>
        <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E8001D] rounded-full transition-all duration-300"
            style={{
              width: `${(currentIndex / topics.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#111111] border border-[#2A2A2A] rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-3">{topic.title}</h2>

        {topic.context && (
          <p className="text-sm text-[#888888] mb-4 leading-relaxed">{topic.context}</p>
        )}

        {topic.angle && (
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-wider text-[#444444] font-medium">
              Angle
            </span>
            <p className="text-sm text-[#888888] mt-0.5">{topic.angle}</p>
          </div>
        )}

        {topic.sources && topic.sources.length > 0 && (
          <div className="mb-4">
            <span className="text-[11px] uppercase tracking-wider text-[#444444] font-medium">
              Sources
            </span>
            <div className="mt-1 space-y-1">
              {topic.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[#E8001D] hover:underline"
                >
                  <ChevronRight size={12} />
                  {s.title || s.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Vote buttons */}
      <div className="flex gap-6 mt-8">
        <button
          onClick={() => vote("down")}
          className="w-16 h-16 rounded-full bg-[#1A1A1A] border-2 border-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/20 transition-colors active:scale-95"
        >
          <ThumbsDown size={24} className="text-[#EF4444]" />
        </button>
        <button
          onClick={() => vote("up")}
          className="w-16 h-16 rounded-full bg-[#1A1A1A] border-2 border-[#22C55E] flex items-center justify-center hover:bg-[#22C55E]/20 transition-colors active:scale-95"
        >
          <ThumbsUp size={24} className="text-[#22C55E]" />
        </button>
      </div>

      {/* Skip */}
      <button
        onClick={() => {
          if (currentIndex < topics.length - 1) setCurrentIndex((prev) => prev + 1);
          else setDone(true);
        }}
        className="mt-4 text-sm text-[#444444] hover:text-[#888888] transition-colors"
      >
        Skip this topic
      </button>
    </div>
  );
}
