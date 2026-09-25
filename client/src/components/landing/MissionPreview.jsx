/**
 * Mission Preview Component
 *
 * Heading: THE MISSION
 * Four feature cards:
 *   1. CORE COMPUTER SCIENCE
 *   2. WEB SECURITY
 *   3. PROBLEM SOLVING
 *   4. TECHNICAL THINKING
 *
 * Visual style: Premium, futuristic, consistent with hero, clean glassmorphism cards.
 */
export default function MissionPreview() {
  const missions = [
    {
      id: 'cs',
      badge: 'PILLAR 01',
      title: 'CORE COMPUTER SCIENCE',
      description:
        'Demonstrate mastery across algorithmic fundamentals, data structures, computation theory, and systems architecture under time pressure.',
      icon: (
        <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
      ),
    },
    {
      id: 'sec',
      badge: 'PILLAR 02',
      title: 'WEB SECURITY',
      description:
        'Identify attack vectors, evaluate protocol defenses, verify authentication integrity, and dissect modern application security challenges.',
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      id: 'ps',
      badge: 'PILLAR 03',
      title: 'PROBLEM SOLVING',
      description:
        'Deconstruct complex technical puzzles, optimize algorithmic paths, and formulate decisive, bug-free solutions with precision and speed.',
      icon: (
        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      id: 'tt',
      badge: 'PILLAR 04',
      title: 'TECHNICAL THINKING',
      description:
        'Synthesize system design tradeoffs, diagnostic troubleshooting logic, and architectural reasoning required for enterprise-grade software.',
      icon: (
        <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
  ];

  return (
    <section id="mission" className="relative py-24 sm:py-32 bg-parchment-dark border-t border-gold-900/40 overflow-hidden">
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-50" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-16 sm:mb-20">
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
            <span className="w-6 h-px bg-gold-500/80" />
            <span>EXPEDITION PILLARS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
            THE <span className="gold-text-gradient">MISSION</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
            Engineered to evaluate well-rounded technical capability. Expedition crews face challenging scenarios testing core computing foundation, cyber defense awareness, and rapid critical reasoning.
          </p>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {missions.map((card) => (
            <div
              key={card.id}
              className="group relative p-6 sm:p-7 rounded-xl bg-charcoal-900/85 hover:bg-charcoal-850 border border-gold-900/40 hover:border-gold-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 shadow-lg shadow-black/40 flex flex-col justify-between"
            >
              {/* Subtle top border glow on hover */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold-500/0 to-transparent group-hover:via-gold-500/50 transition-all duration-300" />

              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-lg bg-gold-950/80 border border-gold-800/50 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {card.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-gold-400 group-hover:text-gold-300 transition-colors">
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-parchment-100 tracking-wide font-pirate group-hover:text-gold-200 transition-colors">
                  {card.title}
                </h3>

                <p className="mt-3 text-xs sm:text-sm text-parchment-300/80 leading-relaxed font-sans">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gold-900/40 flex items-center justify-between text-parchment-400 group-hover:text-gold-300 text-xs font-mono transition-colors">
                <span>EVALUATION PROTOCOL</span>
                <span className="text-gold-400">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
