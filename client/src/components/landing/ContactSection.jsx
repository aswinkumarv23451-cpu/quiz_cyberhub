import { useEffect, useRef } from 'react';
import { contactInfo, socialLinks } from '../../data/eventContent';

/**
 * ContactSection — Module 13B (Refined)
 *
 * Official CyberHub contact information.
 * Uses only supplied official phone numbers and Instagram URL.
 * All links are clickable: tel:// for phones, external link for Instagram.
 * Style: Deep charcoal surface, antique brass framing, warm gold highlights.
 */

export default function ContactSection() {
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
      id="contact"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-charcoal-deep border-t border-gold-900/40 overflow-hidden"
    >
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-30" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="reveal-item opacity-0 translate-y-6 transition-all duration-700 max-w-2xl mb-14">
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400 mb-3">
            <span className="w-6 h-px bg-gold-500/80" />
            <span>DISPATCH &amp; QUERIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
            Expedition <span className="gold-text-gradient">Contact</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-parchment-300/80 leading-relaxed font-sans">
            Reach out to our club officials for any competition-related questions or organizer inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Phone contacts */}
          {contactInfo.contacts.map((c, i) => (
            <a
              key={c.role}
              href={c.tel}
              className={`reveal-item opacity-0 translate-y-6 transition-all duration-700
                group flex items-start gap-5 p-6 rounded-2xl
                bg-charcoal-900/90 border border-gold-900/40 hover:border-gold-500/50
                hover:bg-charcoal-850 shadow-lg shadow-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400`}
              style={{ transitionDelay: `${(i + 1) * 100}ms` }}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gold-950/80 border border-gold-700/50
                flex items-center justify-center text-gold-400 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold text-gold-400 uppercase tracking-widest mb-1">
                  {c.role}
                </div>
                <div className="text-base sm:text-lg font-bold text-parchment-100 group-hover:text-gold-300 font-mono transition-colors">
                  {c.phone}
                </div>
                <div className="text-xs text-bronze-400 mt-1">Tap to call organizer</div>
              </div>
            </a>
          ))}

          {socialLinks.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal-item opacity-0 translate-y-6 transition-all duration-700 delay-300
                group flex items-start gap-5 p-6 rounded-2xl
                bg-charcoal-900/90 border border-transparent
                hover:-translate-y-0.5
                shadow-lg shadow-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400
                instagram-card-hover"
            >
              {/* Instagram Icon — gradient badge */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-transform"
                style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest mb-1 instagram-label">
                  OFFICIAL INSTAGRAM
                </div>
                <div className="text-base font-bold text-parchment-100 group-hover:text-white font-mono transition-colors">
                  @cyberhub_svce
                </div>
                <div className="text-xs text-bronze-400 mt-1 flex items-center gap-1">
                  Follow for updates
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </div>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

