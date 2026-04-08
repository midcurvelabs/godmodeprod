"use client";

import type { Slide, SlideStyle } from "@godmodeprod/shared";

interface SlideProps {
  slide: Slide;
  style: SlideStyle;
  showName?: string;
  episodeLabel?: string;
  slideNumber: number;
  totalSlides: number;
}

function SlideShell({
  style,
  episodeLabel,
  slideNumber,
  totalSlides,
  children,
}: {
  style: SlideStyle;
  episodeLabel?: string;
  slideNumber: number;
  totalSlides: number;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0A] text-white relative overflow-hidden">
      {/* Accent bar top */}
      <div className="h-1 w-full" style={{ backgroundColor: style.brandColor }} />

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-[8%] py-[4%]">
        {children}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-[8%] pb-6 text-sm opacity-40">
        {episodeLabel && <span>{episodeLabel}</span>}
        <span>
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  );
}

function TitleCardSlide({ slide, style, showName, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      {showName && (
        <p className="text-lg tracking-[0.2em] uppercase mb-4 opacity-50" style={{ color: style.brandColor }}>
          {showName}
        </p>
      )}
      <h1 className="text-6xl font-bold leading-tight mb-6">{slide.heading}</h1>
      {slide.bullets && slide.bullets.length > 0 && (
        <p className="text-2xl opacity-60 max-w-[70%]">{slide.bullets[0]}</p>
      )}
    </SlideShell>
  );
}

function TopicIntroSlide({ slide, style, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: style.brandColor }} />
        <span className="text-sm tracking-[0.15em] uppercase opacity-50">Topic</span>
      </div>
      <h2 className="text-5xl font-bold leading-tight mb-8">{slide.heading}</h2>
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="space-y-4 max-w-[75%]">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-4 text-xl opacity-70">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.brandColor }} />
              {b}
            </li>
          ))}
        </ul>
      )}
    </SlideShell>
  );
}

function DataPointSlide({ slide, style, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm tracking-[0.15em] uppercase opacity-50">Data</span>
      </div>
      <h2 className="text-3xl font-semibold mb-8 opacity-80">{slide.heading}</h2>
      {slide.data_value && (
        <div className="mb-6">
          <span className="text-8xl font-bold" style={{ color: style.brandColor }}>
            {slide.data_value}
          </span>
          {slide.data_label && (
            <p className="text-xl opacity-50 mt-2">{slide.data_label}</p>
          )}
        </div>
      )}
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="space-y-3 max-w-[70%]">
          {slide.bullets.map((b, i) => (
            <li key={i} className="text-lg opacity-60 flex items-start gap-3">
              <span className="text-text-muted shrink-0">&bull;</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      {slide.source && (
        <p className="text-sm opacity-30 mt-8">Source: {slide.source}</p>
      )}
    </SlideShell>
  );
}

function TalkingPointSlide({ slide, style, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-[2px]" style={{ backgroundColor: style.brandColor }} />
        <span className="text-sm tracking-[0.15em] uppercase opacity-50">Talking Point</span>
      </div>
      <h2 className="text-4xl font-bold leading-snug mb-8 max-w-[80%]">{slide.heading}</h2>
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="space-y-4 max-w-[75%]">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-4 text-xl opacity-70">
              <span className="font-mono font-bold shrink-0 opacity-40" style={{ color: style.brandColor }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </SlideShell>
  );
}

function QuoteSlide({ slide, style, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      <div className="flex flex-col items-start max-w-[80%]">
        <span className="text-8xl leading-none opacity-20 mb-4" style={{ color: style.brandColor }}>
          &ldquo;
        </span>
        <blockquote className="text-4xl font-semibold leading-snug mb-6 -mt-8">
          {slide.heading}
        </blockquote>
        {slide.source && (
          <p className="text-lg opacity-50">&mdash; {slide.source}</p>
        )}
      </div>
    </SlideShell>
  );
}

function CloserSlide({ slide, style, showName, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideShell style={style} episodeLabel={episodeLabel} slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2 className="text-5xl font-bold mb-8">{slide.heading}</h2>
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="space-y-4 max-w-[75%] mb-8">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-4 text-xl opacity-70">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.brandColor }} />
              {b}
            </li>
          ))}
        </ul>
      )}
      {showName && (
        <p className="text-xl tracking-[0.15em] uppercase opacity-30" style={{ color: style.brandColor }}>
          {showName}
        </p>
      )}
    </SlideShell>
  );
}

const TEMPLATE_MAP: Record<string, React.ComponentType<SlideProps>> = {
  title_card: TitleCardSlide,
  topic_intro: TopicIntroSlide,
  data_point: DataPointSlide,
  talking_point: TalkingPointSlide,
  quote: QuoteSlide,
  closer: CloserSlide,
};

export function SlideRenderer({ slide, style, showName, episodeLabel, slideNumber, totalSlides }: SlideProps) {
  const Template = TEMPLATE_MAP[slide.type] || TalkingPointSlide;
  return (
    <Template
      slide={slide}
      style={style}
      showName={showName}
      episodeLabel={episodeLabel}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
    />
  );
}
