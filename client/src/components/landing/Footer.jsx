import { clubInfo, socialLinks, contactInfo } from '../../data/eventContent';

/**
 * Footer — Module 13B (Visual Polish)
 *
 * Premium multi-column layout:
 *   Col 1: Brand — Logo + Round 1 + description
 *   Col 2: Quick Navigation
 *   Col 3: Round 1 links (Event Flow, Rules, Instructions, Register, Login)
 *   Col 4: Connect — Instagram (gradient) + contacts
 *
 * Visual: Deep charcoal/dark-wood, antique gold headings, bronze borders,
 *         subtle compass watermark, generous spacing.
 */
export default function Footer({ healthStatus, onOpenRegister, onOpenLogin }) {
  const quickNav = [
    { label: 'Home',         href: '#hero' },
    { label: 'Mission',      href: '#mission' },
    { label: 'Events',       href: '#events' },
    { label: 'Community',    href: '#community' },
    { label: 'Rules',        href: '#rules' },
    { label: 'Instructions', href: '#instructions' },
  ];

  const round1Nav = [
    { label: 'Event Flow',    href: '#eventflow' },
    { label: 'Rules',         href: '#rules' },
    { label: 'Instructions',  href: '#instructions' },
  ];

  const handleNavClick = (e, href) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-charcoal-950 text-parchment-300 text-xs overflow-hidden border-t-2 border-gold-800/30">
      {/* Subtle cartographic grid texture */}
      <div className="absolute inset-0 bg-cartography pointer-events-none opacity-30" aria-hidden="true" />

      {/* Faint compass rose watermark */}
      <div
        className="parallax-slow absolute -bottom-16 -right-16 w-[420px] h-[420px] pointer-events-none select-none"
        aria-hidden="true"
        style={{ opacity: 0.035 }}
      >
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full text-gold-400">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="1" />
          <polygon points="100,10 106,85 170,100 106,115 100,190 94,115 30,100 94,85" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="0.75" />
          <polygon points="100,28 104,88 160,100 104,112 100,172 96,112 40,100 96,88" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── TOP: Divider bar with gold gradient ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/40 to-transparent mb-0" />

        {/* ── Main 4-column grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 pt-14 pb-12 border-b border-gold-900/25">

          {/* Column 1: Brand */}
          <div className="space-y-5">
            <div className="flex items-center space-x-3">
              <img
                src={clubInfo.logoPath}
                alt="CyberHub Official Logo"
                className="w-11 h-11 rounded-xl object-cover border border-gold-600/35 shadow-md shadow-black/40"
              />
              <div>
                <span className="font-black text-parchment-100 tracking-wider font-pirate text-base block leading-none">
                  CYBER<span className="text-gold-400">HUB</span>
                </span>
                <span className="text-[10px] font-mono text-bronze-300 tracking-widest uppercase block mt-0.5">
                  ROUND 1 EXPEDITION
                </span>
              </div>
            </div>

            <p className="text-xs text-parchment-400/75 leading-relaxed">
              CyberHub is the official technology and cybersecurity club of Sri Venkateswara College of Engineering. Fostering excellence through competitive engineering expeditions.
            </p>

            <div className="text-[11px] font-mono text-bronze-400/80 leading-normal">
              {clubInfo.college}
            </div>

            {/* Instagram button in brand column too */}
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="instagram-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider text-white uppercase transition-all duration-300 hover:-translate-y-px hover:shadow-pink-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                aria-label="CyberHub Official Instagram"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span>@cyberhub_svce</span>
              </a>
            )}
          </div>

          {/* Column 2: Quick Navigation */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-mono font-bold tracking-[0.2em] text-gold-400 uppercase flex items-center gap-2.5">
              <span className="w-4 h-px bg-gold-500/70" />
              QUICK NAVIGATION
            </h4>
            <ul className="space-y-3">
              {quickNav.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className="text-xs text-parchment-300/80 hover:text-gold-300 transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="text-gold-600/60 group-hover:text-gold-400 transition-colors text-[11px]">›</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Round 1 */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-mono font-bold tracking-[0.2em] text-gold-400 uppercase flex items-center gap-2.5">
              <span className="w-4 h-px bg-gold-500/70" />
              ROUND 1
            </h4>
            <ul className="space-y-3">
              {round1Nav.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className="text-xs text-parchment-300/80 hover:text-gold-300 transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="text-gold-600/60 group-hover:text-gold-400 transition-colors text-[11px]">›</span>
                    {item.label}
                  </a>
                </li>
              ))}
              {onOpenRegister && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="text-xs text-gold-400 hover:text-gold-200 font-semibold transition-colors inline-flex items-center gap-2 group text-left"
                  >
                    <span className="text-gold-500 text-[11px]">›</span>
                    Register (Free)
                  </button>
                </li>
              )}
              {onOpenLogin && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="text-xs text-parchment-300/80 hover:text-gold-300 transition-colors inline-flex items-center gap-2 group text-left"
                  >
                    <span className="text-gold-600/60 group-hover:text-gold-400 transition-colors text-[11px]">›</span>
                    Login / Verify
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: Connect */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-mono font-bold tracking-[0.2em] text-gold-400 uppercase flex items-center gap-2.5">
              <span className="w-4 h-px bg-gold-500/70" />
              CONNECT
            </h4>

            <div className="space-y-4">
              {/* Instagram prominent link */}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-bronze-400 uppercase tracking-wider">Official Instagram</div>
                    <div className="text-xs font-semibold text-parchment-200 group-hover:text-white transition-colors">@cyberhub_svce</div>
                  </div>
                </a>
              )}

              {/* Divider */}
              <div className="h-px bg-gold-900/30" />

              {/* Phone contacts */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-bronze-400/80 uppercase tracking-wider block">Official Contacts</span>
                {contactInfo.contacts.map((c) => (
                  <div key={c.role} className="space-y-0.5">
                    <div className="text-[10px] text-parchment-500 font-mono uppercase tracking-wider">{c.role}</div>
                    <a href={c.tel} className="text-xs font-mono font-semibold text-gold-300 hover:text-gold-200 transition-colors">
                      {c.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-7 text-[11px] text-parchment-500/60">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gold-700/60" />
            <span>© CyberHub • Round 1 — Official Technology Competition</span>
          </div>

          {/* Health Status (preserved) */}
          {healthStatus && (
            <div className="flex items-center space-x-2 font-mono text-[10px]">
              {healthStatus.loading && (
                <span className="text-amber-400/80 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  <span>Checking Core Status...</span>
                </span>
              )}
              {healthStatus.error && (
                <span className="text-red-500/70 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  <span>Platform: Standalone</span>
                </span>
              )}
              {healthStatus.data && (
                <span className="text-emerald-400/80 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>Network: Operational • Ready</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
