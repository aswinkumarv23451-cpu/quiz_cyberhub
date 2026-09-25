/**
 * Events Preview Component — Module 13B (Refined)
 *
 * Heading: EVENTS
 * Content: Structured preview of the competition format and progression track.
 * Style: Deep ocean navy tone with antique gold framing.
 * Strictly NO invented dates.
 */
export default function EventsPreview({ onOpenRegister }) {
  const tracks = [
    {
      step: 'STAGE 01',
      title: 'Round 1: Online Technical Challenge',
      format: 'Online Assessment',
      status: 'REGISTRATION OPEN',
      description:
        'A comprehensive timed challenge testing computing fundamentals, algorithm speed, and security instincts. Teams compete simultaneously under live monitoring.',
      highlight: true,
    },
    {
      step: 'STAGE 02',
      title: 'Advanced Qualifier Rounds',
      format: 'Selective Progression',
      status: 'UPCOMING',
      description:
        'Top-ranking teams from Round 1 advance to the next technical phase. Further event announcements and progression criteria will be released to qualified teams.',
      highlight: false,
    },
  ];

  return (
    <section id="events" className="relative py-24 sm:py-32 bg-navy-950 border-t border-gold-900/40 overflow-hidden">
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-30" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
              <span className="w-6 h-px bg-gold-500/80" />
              <span>COMPETITION TRACK</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
              EXPEDITION <span className="gold-text-gradient">EVENTS</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
              Round 1 operates as the premier gateway challenge. Teams collaborate online to solve intensive timed problems and earn their position on the official leaderboard.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRegister}
            className="self-start md:self-auto px-6 py-3 text-xs font-bold tracking-wider text-charcoal-950 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 rounded-md transition shadow-md shadow-gold-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 uppercase font-sans"
          >
            ENTER ROUND 1
          </button>
        </div>

        {/* Tracks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tracks.map((track) => (
            <div
              key={track.step}
              className={`p-7 sm:p-8 rounded-xl border transition-all duration-300 ${
                track.highlight
                  ? 'bg-charcoal-900/90 border-gold-500/50 shadow-xl shadow-gold-950/30'
                  : 'bg-charcoal-900/50 border-gold-900/30 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold tracking-widest text-gold-400">
                  {track.step}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                    track.highlight
                      ? 'bg-gold-500/15 text-gold-300 border-gold-500/40'
                      : 'bg-charcoal-800 text-parchment-400 border-gold-900/40'
                  }`}
                >
                  {track.status}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-parchment-100 font-pirate">
                {track.title}
              </h3>

              <div className="mt-2 text-xs font-mono text-bronze-300">
                Format: <span className="text-parchment-200 font-semibold">{track.format}</span>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-parchment-300/80 leading-relaxed font-sans">
                {track.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

