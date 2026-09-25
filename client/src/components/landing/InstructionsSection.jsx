import { useState, useEffect, useRef } from 'react';
import { instructions } from '../../data/eventContent';

/**
 * InstructionsSection — Module 13B (Refined)
 *
 * Displays official participant instructions organized by phase.
 * Style: Dark parchment base, antique gold phase selectors, brass step badges.
 */

const phaseIcons = {
  before: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  during: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  round2: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  submit: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
};

export default function InstructionsSection() {
  const [activePhase, setActivePhase] = useState(0);
  const sectionRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const els = sectionRef.current?.querySelectorAll('.reveal-item');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const current = instructions[activePhase];

  return (
    <section
      id="instructions"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-parchment-dark border-t border-gold-900/40 overflow-hidden"
    >
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-40" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700 max-w-2xl mb-12">
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
            <span className="w-6 h-px bg-gold-500/80" />
            <span>EXPEDITION PROTOCOL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
            Operational <span className="gold-text-gradient">Instructions</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
            Step-by-step navigator instructions for every phase of the competition.
          </p>
        </div>

        <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700 delay-100
          grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* Phase Selector */}
          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {instructions.map((phase, i) => {
              const isActive = i === activePhase;
              return (
                <button
                  key={phase.phase}
                  onClick={() => setActivePhase(i)}
                  className={`flex-shrink-0 flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left
                    transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400
                    ${isActive
                      ? 'bg-gradient-to-r from-gold-500/20 via-gold-500/10 to-transparent border-gold-500/50 text-gold-300 shadow-md shadow-gold-950/40'
                      : 'bg-charcoal-900/60 border-gold-900/30 text-parchment-400 hover:text-parchment-200 hover:bg-charcoal-850'
                    }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-gold-400' : 'text-bronze-400'}`}>
                    {phaseIcons[phase.icon]}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold leading-tight font-pirate">{phase.phase}</span>
                </button>
              );
            })}
          </div>

          {/* Steps Panel */}
          <div
            key={activePhase}
            className="p-6 sm:p-8 rounded-2xl border border-gold-900/50 bg-charcoal-900/90 shadow-xl shadow-black/50 min-h-[280px]"
          >
            <div className="flex items-center gap-3 mb-6 text-gold-300 border-b border-gold-900/30 pb-4">
              <div className="w-8 h-8 rounded-lg bg-gold-950/80 border border-gold-700/40 flex items-center justify-center text-gold-400">
                {phaseIcons[current.icon]}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-pirate tracking-wide text-parchment-100">{current.phase}</h3>
                <span className="text-[11px] font-mono text-bronze-400 uppercase tracking-widest">{current.steps.length} DIRECTIVES</span>
              </div>
            </div>

            <ol className="space-y-3.5">
              {current.steps.map((step, idx) => (
                <li key={idx} className="flex gap-4 group">
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gold-950/80 border border-gold-700/50 text-gold-300
                    flex items-center justify-center text-[10px] font-mono font-bold mt-0.5 shadow-sm">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-parchment-200/90 leading-relaxed font-sans">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

