import { useEffect, useRef } from 'react';
import { eventFlow } from '../../data/eventContent';

/**
 * EventFlow — Module 13B (Refined)
 *
 * Visual step-by-step expedition progression.
 * Style: Dark wood/charcoal background, antique gold waypoint connector line, brass waypoint markers.
 */

const stepIcons = {
  register: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  quiz: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  evaluate: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  build: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
};

export default function EventFlow() {
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
      { threshold: 0.08 }
    );

    const els = sectionRef.current?.querySelectorAll('.reveal-item');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="eventflow"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-wood-grain border-t border-gold-900/40 overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700 max-w-2xl mb-16 sm:mb-20">
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
            <span className="w-6 h-px bg-gold-500/80" />
            <span>EXPEDITION COURSE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
            Event <span className="gold-text-gradient">Flow</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
            A two-round structured competition — from team charter registration through to the final website creation challenge.
          </p>
        </div>

        {/* Steps — horizontal desktop / vertical mobile */}
        <div className="relative">
          {/* Desktop connector line */}
          <div
            className="hidden lg:block absolute top-[36px] left-[calc(12.5%-16px)] right-[calc(12.5%-16px)] h-px
              bg-gradient-to-r from-gold-500/50 via-gold-400/40 to-gold-600/50 z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative z-10">
            {eventFlow.map((item, i) => (
              <div
                key={item.step}
                className="reveal-item opacity-0 translate-y-8 transition-all duration-700 group"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="relative flex flex-col p-6 rounded-xl bg-charcoal-900/90 border border-gold-900/40 hover:border-gold-500/50 hover:bg-charcoal-850 transition-all duration-300 shadow-md shadow-black/40">
                  {/* Step circle with gold accent */}
                  <div className="w-16 h-16 rounded-full ring-2 ring-gold-600/50 bg-gold-950/80
                    flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 text-gold-300 shadow-md shadow-gold-950/50">
                    {stepIcons[item.icon]}
                  </div>

                  {/* Step number */}
                  <div className="text-xs font-mono font-bold text-gold-400 mb-1 tracking-widest uppercase">
                    WAYPOINT {item.step}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-parchment-100 font-pirate mb-1 group-hover:text-gold-200 transition-colors">
                    {item.title}
                  </h3>

                  {/* Subtitle */}
                  <div className="text-xs font-semibold text-bronze-300 tracking-wide mb-3">
                    {item.subtitle}
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-parchment-300/80 leading-relaxed font-sans">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

