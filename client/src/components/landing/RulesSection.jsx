import { useState, useEffect, useRef } from 'react';
import { rules } from '../../data/eventContent';

/**
 * RulesSection — Module 13B (Refined)
 *
 * Displays all official competition rules organized by category:
 *   - General Event Rules
 *   - Round 1 — Test-Based Selection Round
 *   - Round 2 — Website Creation Challenge
 *   - Code of Conduct
 *
 * BUG FIX:
 *   - Eliminated dynamic `opacity-0` key remount that trapped switched tabs in zero-opacity.
 *   - Full ARIA tablist/tab semantics + keyboard navigation (ArrowLeft/Right, Home/End).
 *   - Instant, reliable content display for every tab.
 *
 * DESIGN:
 *   - Antique brass framing, weathered parchment panels, gold navigational motifs.
 */

export default function RulesSection() {
  const [activeTab, setActiveTab] = useState(0);
  const sectionRef = useRef(null);
  const tabRefs = useRef([]);

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

    const els = sectionRef.current?.querySelectorAll('.reveal-header');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (index + 1) % rules.length;
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (index - 1 + rules.length) % rules.length;
      setActiveTab(prev);
      tabRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(0);
      tabRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(rules.length - 1);
      tabRefs.current[rules.length - 1]?.focus();
    }
  };

  const activeRuleSet = rules[activeTab] || rules[0];

  return (
    <section
      id="rules"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-wood-grain border-t border-gold-900/40 overflow-hidden"
    >
      {/* Decorative compass rose backdrop watermark */}
      <div
        className="parallax-slow absolute -top-20 -right-20 w-96 h-96 pointer-events-none opacity-5 select-none"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full text-gold-400">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="100,10 108,80 178,100 108,120 100,190 92,120 22,100 92,80" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
          <polygon points="100,25 106,85 165,100 106,115 100,175 94,115 35,100 94,85" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="reveal-header opacity-0 translate-y-6 transition-all duration-700 max-w-2xl mb-12">
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
            <span className="w-6 h-px bg-gold-500/80" />
            <span>EXPEDITION CODEX</span>
            <span className="w-2 h-2 rotate-45 border border-gold-500/80 bg-gold-400/20" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
            Rules &amp; <span className="gold-text-gradient">Conduct</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
            Every navigator in this elite technology expedition must adhere to the official charter. Select a category below to inspect all mandatory guidelines.
          </p>
        </div>

        {/* Tab Navigation List */}
        <div
          role="tablist"
          aria-label="Competition Rules Categories"
          className="flex flex-wrap gap-2 sm:gap-3 mb-8 border-b border-gold-800/30 pb-3"
        >
          {rules.map((r, i) => {
            const isActive = i === activeTab;
            // Clear, unambiguous labels
            let label = r.category;
            if (label.includes('—')) {
              label = label.split('—')[0].trim();
            }

            return (
              <button
                key={r.category}
                ref={(el) => (tabRefs.current[i] = el)}
                role="tab"
                id={`tab-${i}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${i}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className={`relative px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400
                  ${isActive
                    ? 'bg-gradient-to-r from-gold-500/20 via-gold-500/10 to-transparent text-gold-300 border border-gold-500/50 shadow-md shadow-gold-950/50'
                    : 'text-parchment-400/70 hover:text-parchment-200 hover:bg-charcoal-900/60 border border-transparent'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-gold-400 ring-2 ring-gold-400/40' : 'bg-parchment-600'}`} />
                  {label}
                </span>
                {isActive && (
                  <span className="absolute bottom-[-13px] left-1/2 -translate-x-1/2 w-4 h-1 bg-gold-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Rules Panel (Guaranteed visible, no dynamic opacity traps) */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="transition-opacity duration-300 opacity-100"
        >
          {/* Category Badge & Anchor Details */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gold-900/30">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wide uppercase bg-gold-500/10 text-gold-300 border border-gold-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
              {activeRuleSet.category}
            </div>
            <span className="text-xs font-mono text-bronze-400/80">
              ARTICLE {activeTab + 1} OF {rules.length} • {activeRuleSet.items.length} DIRECTIVES
            </span>
          </div>

          {/* Directives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRuleSet.items.map((rule, idx) => {
              const colonIdx = rule.indexOf(':');
              const hasPrefix = colonIdx > 0 && colonIdx < 50 && !rule.startsWith('Round') && !rule.startsWith('Access');
              const prefix = hasPrefix ? rule.slice(0, colonIdx) : null;
              const body = hasPrefix ? rule.slice(colonIdx + 1).trim() : rule;

              return (
                <div
                  key={idx}
                  className="flex gap-4 p-5 rounded-xl bg-charcoal-900/80 border border-gold-900/40 hover:border-gold-500/40 hover:bg-charcoal-850 transition-all duration-200 group shadow-md shadow-black/30"
                >
                  <div className="flex-shrink-0 mt-1">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gold-950/80 border border-gold-700/50 text-[11px] font-mono font-bold text-gold-300">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1">
                    {prefix && (
                      <span className="text-gold-200 text-xs sm:text-sm font-semibold tracking-wide">
                        {prefix}:{' '}
                      </span>
                    )}
                    <span className="text-parchment-200/90 text-xs sm:text-sm leading-relaxed">
                      {body}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

