import { useState, useRef, useEffect } from 'react';

/**
 * Premium Cinematic Full-Screen Hero — Module 13B (Refined)
 *
 * VISUAL POLISH:
 *   - Multi-layer vignette: radial sides + vertical band behind text
 *   - Inline text-shadow on ROUND 1 and TECHNOLOGY COMPETITION for clear legibility
 *   - Text wrapper has a subtle scrim so copy always passes contrast on any video frame
 *   - Video remains dominant; overlays are tasteful, NOT opaque boxes
 */
export default function HeroSection({ onOpenRegister, onOpenLogin }) {
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoaded(true);
        })
        .catch(() => {
          setVideoError(true);
        });
    }
  }, []);

  return (
    <section
      id="hero"
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-charcoal-950"
    >
      {/* ── BACKGROUND LAYER ── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
        {/* Base Fallback Image */}
        <img
          src="/assets/round1-hero-fallback.jpeg"
          alt="Round 1 Expedition Hero Visual"
          className="absolute inset-0 w-full h-full object-cover object-center"
          aria-hidden="true"
        />

        {/* Cinematic Video */}
        {!videoError && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/assets/round1-hero-fallback.jpeg"
            onCanPlay={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          >
            <source src="/assets/round1-hero.mp4" type="video/mp4" />
          </video>
        )}

        {/* ── CINEMATIC OVERLAYS ── */}

        {/* 1. Edge vignette — darkens left/right + top/bottom corners, leaves center clear */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 120% 90% at 50% 50%, transparent 30%, rgba(9,10,13,0.55) 70%, rgba(9,10,13,0.92) 100%)',
          }}
        />

        {/* 2. Top dark band — anchors the nav */}
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-950/85 via-transparent to-transparent pointer-events-none" />

        {/* 3. Bottom fade — blends into next section */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/30 to-transparent pointer-events-none" />

        {/* 4. Left-side text scrim — directional gradient gives the text column contrast */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(9,10,13,0.72) 0%, rgba(9,10,13,0.42) 55%, transparent 100%)',
          }}
        />

        {/* 5. Coordinate line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent pointer-events-none" />
      </div>

      {/* ── HERO CONTENT ── */}
      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 sm:py-32 flex flex-col justify-center min-h-screen">
        <div className="max-w-3xl space-y-6 sm:space-y-8">

          {/* Expedition Eyebrow */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-charcoal-900/80 border border-gold-600/40 backdrop-blur-md shadow-lg shadow-black/40">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.25em] text-gold-300 uppercase font-mono">
              CYBERHUB EXPEDITION PRESENTS
            </span>
          </div>

          {/* Main Headings — text-shadow for crisp legibility on any video frame */}
          <div className="space-y-2">
            <h1
              className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight text-white uppercase font-pirate leading-none"
              style={{ textShadow: '0 2px 24px rgba(0,0,0,0.90), 0 1px 4px rgba(0,0,0,1)' }}
            >
              ROUND <span style={{ color: '#D4AF37', textShadow: '0 2px 20px rgba(212,175,55,0.55), 0 1px 4px rgba(0,0,0,1)' }}>1</span>
            </h1>
            <h2
              className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-wider sm:tracking-widest text-parchment-100 uppercase font-pirate"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,1)' }}
            >
              TECHNOLOGY COMPETITION
            </h2>
          </div>

          {/* Description */}
          <p
            className="text-sm sm:text-base md:text-lg text-parchment-200/95 leading-relaxed max-w-2xl font-sans"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.85)' }}
          >
            A premier competitive expedition built to test problem-solving, core computer science mastery, web security awareness, and analytical thinking.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={onOpenRegister}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-sm font-extrabold tracking-wider text-charcoal-950 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 rounded-lg shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 uppercase font-sans"
            >
              <span>REGISTER NOW</span>
              <svg
                className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center justify-center px-8 py-4 text-sm font-semibold tracking-wider text-parchment-100 hover:text-white bg-charcoal-900/80 hover:bg-charcoal-800 border border-gold-700/60 hover:border-gold-500/80 rounded-lg backdrop-blur-md shadow-md shadow-black/50 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 uppercase font-sans"
            >
              LOGIN
            </button>
          </div>

          {/* Expedition Meta Badges */}
          <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-parchment-300 font-mono tracking-wider border-t border-gold-900/40">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              <span>TEAM SIZE • 2–3 MEMBERS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              <span>FORMAT • ONLINE EXPEDITION</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              <span>STAGE • ROUND 01</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center space-y-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono tracking-widest uppercase text-gold-400">
          EXPLORE EXPEDITION
        </span>
        <div className="w-5 h-8 rounded-full border border-gold-800/80 flex items-start justify-center p-1">
          <div className="w-1 h-2 bg-gold-400 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
