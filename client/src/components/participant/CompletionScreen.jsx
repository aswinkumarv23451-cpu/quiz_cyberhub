import { useEffect, useRef } from 'react';

/**
 * CompletionScreen Component (Module 13C Polished Cinematic Finishing State)
 *
 * Requirements:
 * - Subtle ambient gold particle & glow animation (respects prefers-reduced-motion).
 * - Animated expedition treasure seal / checkmark reveal.
 * - Exact required message:
 *   "The round 1 is successfully finished and the results will be announced in the WhatsApp group."
 * - Displays team name.
 * - Secure sign-out option.
 * - STRICTLY DOES NOT SHOW: Score, Leaderboard, Other teams, Correct answers.
 */
export default function CompletionScreen({ teamName, onLogout }) {
  const canvasRef = useRef(null);

  // Subtle Golden Treasure Sparks / Particle Ambient Animation
  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate subtle rising gold dust particles
    const particleCount = Math.min(35, Math.floor(width / 20));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      speedY: Math.random() * 0.4 + 0.2,
      speedX: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * 0.02 + 0.01,
      pulseDir: 1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.alpha += p.pulse * p.pulseDir;
        if (p.alpha >= 0.8) p.pulseDir = -1;
        if (p.alpha <= 0.2) p.pulseDir = 1;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.alpha})`;
        ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full max-w-xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Background Ambient Canvas for Gold Dust Particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Main Expedition Completion Vault Card */}
      <div
        className="relative z-10 overflow-hidden rounded-3xl border border-gold-600/40 text-parchment-100 shadow-2xl"
        style={{
          background: 'linear-gradient(168deg, #16110D 0%, #0F0B08 45%, #080605 100%)',
          boxShadow: '0 0 70px rgba(0,0,0,0.9), 0 0 35px rgba(212,175,55,0.12), inset 0 1px 0 rgba(212,175,55,0.2)',
        }}
      >
        {/* Subtle Map Grid / Cartography overlay */}
        <div className="absolute inset-0 bg-cartography opacity-10 pointer-events-none" />

        {/* Top Gold & Emerald Shimmer Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-bronze-700 via-gold-400 to-emerald-500" />

        <div className="relative p-6 sm:p-9 md:p-11 text-center space-y-7">
          {/* Animated Expedition Treasure Seal Reveal */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            {/* Outer Rotating Compass/Glow Ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-gold-500/40 animate-spin"
              style={{ animationDuration: '24s' }}
            />
            {/* Pulsing Emerald/Gold Ambient Halo */}
            <div className="absolute inset-2 rounded-full bg-emerald-950/70 border border-emerald-500/50 shadow-lg shadow-emerald-900/40" />
            {/* Checkmark Icon */}
            <svg
              className="relative w-12 h-12 text-emerald-400 drop-shadow-[0_2px_8px_rgba(16,185,129,0.5)] transform scale-100 transition-transform duration-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Heading & Metadata */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/50 inline-block">
              VOYAGE COMPLETED • CRYPTIC TIDE
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-parchment-100 font-pirate pt-1">
              Expedition Concluded
            </h1>
            {teamName && (
              <p className="text-sm sm:text-base text-gold-300 font-medium">
                Expedition Crew: <span className="text-parchment-100 font-bold">{teamName}</span>
              </p>
            )}
          </div>

          {/* EXACT Required Official Completion Message */}
          <div className="p-5 sm:p-6 rounded-2xl bg-charcoal-950/90 border border-gold-800/40 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gold-400" />
            <p className="text-sm sm:text-base font-semibold text-emerald-300 leading-relaxed pl-1">
              The round 1 is successfully finished and the results will be announced in the WhatsApp group.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-parchment-400/90 max-w-md mx-auto leading-relaxed">
            All submitted responses have been sealed and stored. Official deliberations are underway, and event coordinators will post qualifying teams in the WhatsApp community.
          </p>

          {/* Sign Out / Exit Action */}
          <div className="pt-2 border-t border-gold-900/30">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-charcoal-900 to-charcoal-950 hover:from-charcoal-800 hover:to-charcoal-900 text-parchment-200 hover:text-white text-xs sm:text-sm font-bold rounded-xl border border-bronze-700/60 hover:border-gold-500/80 transition-all shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Sign Out Securely
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
