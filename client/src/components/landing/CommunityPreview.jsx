import { socialLinks } from '../../data/eventContent';

/**
 * Community Preview Component — Module 13B (Refined)
 *
 * Heading: COMMUNITY
 * Highlights: CyberHub expedition crew network, official WhatsApp group for participants.
 * Official Instagram URL from eventContent.js — no invented URLs.
 * Style: Dark wood/charcoal guildhall aesthetic with gold & emerald accents.
 */
export default function CommunityPreview({ whatsappGroupLink }) {
  return (
    <section id="community" className="relative py-24 sm:py-32 bg-wood-grain border-t border-gold-900/40 overflow-hidden">
      {/* Subtle cartographic grid overlay */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-30" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-2xl bg-charcoal-900/95 border border-gold-900/50 p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-2xl shadow-black/60">
          {/* Subtle gold ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10 space-y-6">
            <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-widest text-gold-400">
              <span className="w-6 h-px bg-gold-500/80" />
              <span>THE EXPEDITION CREW</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-parchment-100 uppercase font-pirate">
              CREW &amp; <span className="gold-text-gradient">COMMUNITY</span>
            </h2>

            <p className="text-sm sm:text-base text-parchment-300/85 leading-relaxed font-sans">
              CyberHub connects ambitious students, competitive coders, and cybersecurity enthusiasts into a focused peer network. All official competition notices, team coordination instructions, and live updates are published through the verified CyberHub channel.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-charcoal-950/80 border border-gold-900/40">
                <span className="text-xs font-mono font-bold text-gold-400 block mb-1">
                  OFFICIAL COMMUNICATION
                </span>
                <p className="text-xs text-parchment-400/80 leading-normal font-sans">
                  Real-time organizer updates, rule clarifications, and event schedule notifications.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-charcoal-950/80 border border-gold-900/40">
                <span className="text-xs font-mono font-bold text-emerald-400 block mb-1">
                  PARTICIPANT HUB
                </span>
                <p className="text-xs text-parchment-400/80 leading-normal font-sans">
                  Dedicated channel for all registered team leads and members to stay synchronized.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              {whatsappGroupLink && (
                <a
                  href={whatsappGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-6 py-3.5 text-xs font-bold tracking-wider text-charcoal-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-md transition shadow-md shadow-emerald-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 uppercase font-sans"
                >
                  <span>JOIN OFFICIAL WHATSAPP GROUP</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="instagram-btn inline-flex items-center space-x-2.5 px-6 py-3.5 text-xs font-bold tracking-wider text-white rounded-md transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 uppercase font-sans shadow-md shadow-pink-950/40 hover:shadow-pink-900/60"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>FOLLOW @cyberhub_svce</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

