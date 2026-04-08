"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { SlideRenderer } from "@/components/slides/slide-templates";
import type { Slide, SlideStyle } from "@godmodeprod/shared";

export default function SlideDeckPage() {
  const params = useParams();
  const episodeId = params.episodeId as string;

  const [slides, setSlides] = useState<Slide[]>([]);
  const [style, setStyle] = useState<SlideStyle>({ brandColor: "#E8001D", font: "Inter", layout: "minimal" });
  const [showName, setShowName] = useState("");
  const [episodeLabel, setEpisodeLabel] = useState("");
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/slides?episode_id=${episodeId}`);
        const json = await res.json();
        if (json.slides) {
          const content = json.slides.content as { slides?: Slide[] };
          setSlides(content.slides || []);
          setStyle(json.slides.style || { brandColor: "#E8001D", font: "Inter", layout: "minimal" });
        }

        // Fetch episode info for the label
        const epRes = await fetch(`/api/episodes/${episodeId}`);
        const epJson = await epRes.json();
        if (epJson.episode) {
          setEpisodeLabel(
            `EP ${String(epJson.episode.episode_number).padStart(2, "0")} — ${epJson.episode.title}`
          );
          // Fetch show name
          const showRes = await fetch(`/api/shows/${epJson.episode.show_id}`);
          const showJson = await showRes.json();
          if (showJson.show) setShowName(showJson.show.name);
        }
      } catch {
        setError("Failed to load slides");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [episodeId]);

  const goNext = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  const goToSlide = useCallback((i: number) => {
    setCurrent(i);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(slides.length - 1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, goToSlide, slides.length]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0A0A0A] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm opacity-50">Loading slides...</p>
        </div>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0A0A0A] text-white">
        <div className="text-center">
          <p className="text-xl mb-2">{error || "No slides found"}</p>
          <p className="text-sm opacity-50">Generate slides from the Prep page first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#0A0A0A] overflow-hidden relative select-none">
      {/* Current slide */}
      <div className="w-full h-full">
        <SlideRenderer
          slide={slides[current]}
          style={style}
          showName={showName}
          episodeLabel={episodeLabel}
          slideNumber={current + 1}
          totalSlides={slides.length}
        />
      </div>

      {/* Click zones for navigation */}
      <div
        className="absolute left-0 top-0 w-1/3 h-full cursor-w-resize z-10"
        onClick={goPrev}
      />
      <div
        className="absolute right-0 top-0 w-1/3 h-full cursor-e-resize z-10"
        onClick={goNext}
      />

      {/* Progress dots (bottom center, visible on hover) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-0 hover:opacity-100 transition-opacity z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              backgroundColor: i === current ? style.brandColor : "rgba(255,255,255,0.2)",
              transform: i === current ? "scale(1.5)" : "scale(1)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
