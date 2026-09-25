import { useEffect, useRef } from 'react';
import { clubInfo } from '../../data/eventContent';

/**
 * AboutCyberHub — Module 13B (Refined)
 *
 * Professional club identity section using only official club information.
 * Style: Deep charcoal surface, antique brass framing, warm gold accents.
 */

const pillars = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Technology',
    badge: 'DOMAIN I',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    label: 'Cybersecurity',
    badge: 'DOMAIN II',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: 'Innovation',
    badge: 'DOMAIN III',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'Community',
    badge: 'DOMAIN IV',
  },
];

export default function AboutCyberHub() {
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
      { threshold: 0.12 }
    );

    const els = sectionRef.current?.querySelectorAll('.reveal-item');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-charcoal-deep border-t border-gold-900/40 overflow-hidden"
    >
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-30" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text Content */}
          <div className="space-y-8">
            <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700">
              <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-4">
                <span className="w-6 h-px bg-gold-500/80" />
                <span>EXPEDITION GUILD</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
                About <span className="gold-text-gradient">CyberHub</span>
              </h2>
            </div>

            <p className="reveal-item opacity-0 translate-y-6 transition-all duration-700 delay-100
              text-sm sm:text-base text-parchment-300/90 leading-relaxed font-sans">
              {clubInfo.description}
            </p>

            <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700 delay-150 flex items-center gap-3 pt-2">
              <img
                src={clubInfo.logoPath}
                alt="CyberHub Official Crest"
                className="w-10 h-10 rounded-lg object-cover border border-gold-600/40 shadow-sm"
              />
              <div>
                <span className="text-xs text-gold-300 font-mono font-bold block">{clubInfo.fullName}</span>
                <span className="text-[11px] text-bronze-400 font-mono block">{clubInfo.college}</span>
              </div>
            </div>
          </div>

          {/* Right: Pillar Cards */}
          <div className="grid grid-cols-2 gap-4">
            {pillars.map((p, i) => (
              <div
                key={p.label}
                className="reveal-item opacity-0 translate-y-6 transition-all duration-700
                  p-5 rounded-xl bg-charcoal-900/90 border border-gold-900/40 hover:border-gold-500/50 hover:bg-charcoal-850 hover:-translate-y-0.5
                  flex flex-col gap-3 group cursor-default shadow-lg shadow-black/40"
                style={{ transitionDelay: `${(i + 2) * 100}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-gold-950/80 border border-gold-800/50 flex items-center justify-center text-gold-300 group-hover:scale-105 transition-transform">
                    {p.icon}
                  </div>
                  <span className="text-[9px] font-mono text-bronze-400 tracking-wider">
                    {p.badge}
                  </span>
                </div>
                <span className="text-sm font-bold tracking-wide text-parchment-100 font-pirate group-hover:text-gold-300 transition-colors">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

