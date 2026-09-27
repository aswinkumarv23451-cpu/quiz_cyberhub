import { useState, useEffect, useRef, useCallback } from 'react';
import { clubInfo } from '../../data/eventContent';

/**
 * Premium CyberHub Navbar — Module 13B (Refined)
 *
 * Navigation: HOME, MISSION, EVENTS, COMMUNITY + INFO dropdown
 * INFO contains: About CyberHub, Event Flow, Rules, Instructions, Contact
 * Actions: REGISTER, LOGIN (Strictly NO Admin Login)
 * Behavior: Transparent overlay initially, backdrop blur after scroll, mobile hamburger menu
 * Style: Deep charcoal backdrop, warm gold navigation accents, antique brass CTA
 */
export default function Navbar({ onOpenRegister, onOpenLogin }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close info dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainLinks = [
    { label: 'HOME', href: '#hero' },
    { label: 'MISSION', href: '#mission' },
    { label: 'EVENTS', href: '#events' },
    { label: 'COMMUNITY', href: '#community' },
  ];

  const infoLinks = [
    { label: 'About CyberHub', href: '#about' },
    { label: 'Event Flow', href: '#eventflow' },
    { label: 'Rules & Conduct', href: '#rules' },
    { label: 'Instructions', href: '#instructions' },
    { label: 'Contact', href: '#contact' },
  ];

  const handleNavClick = useCallback((e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    setInfoOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-charcoal-950/95 backdrop-blur-md border-b border-gold-900/40 shadow-xl shadow-black/50 py-3.5'
          : 'bg-gradient-to-b from-charcoal-950/90 via-charcoal-950/40 to-transparent border-b border-gold-900/10 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">

          {/* CyberHub Brand with real logo */}
          <a
            href="#hero"
            onClick={(e) => handleNavClick(e, '#hero')}
            className="group flex items-center space-x-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded-md py-1 px-1.5"
            aria-label="CyberHub Cryptic Tide Home"
          >
            <img
              src={clubInfo.logoPath}
              alt="CyberHub Logo"
              className="w-9 h-9 rounded-lg object-cover border border-gold-600/40 shadow-md group-hover:border-gold-400 transition-colors"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-wider text-parchment-100 group-hover:text-gold-300 transition-colors font-pirate">
                CYBER<span className="gold-text-gradient">HUB</span>
              </span>
              <span className="text-[10px] tracking-widest text-bronze-400 uppercase -mt-1 font-mono">
                CRYPTIC TIDE
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {mainLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="px-3.5 py-1.5 text-xs font-semibold tracking-wider text-parchment-300 hover:text-gold-300 transition-colors rounded-md hover:bg-charcoal-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                {item.label}
              </a>
            ))}

            {/* INFO Dropdown */}
            <div ref={infoRef} className="relative">
              <button
                onClick={() => setInfoOpen((v) => !v)}
                className={`flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold tracking-wider transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400
                  ${infoOpen ? 'text-gold-300 bg-charcoal-900/80 border border-gold-800/40' : 'text-parchment-300 hover:text-gold-300 hover:bg-charcoal-900/60'}`}
                aria-expanded={infoOpen}
                aria-haspopup="true"
              >
                INFO
                <svg
                  className={`w-3 h-3 text-gold-400 transition-transform duration-200 ${infoOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {infoOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-charcoal-900/95 backdrop-blur-md border border-gold-900/60 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-50">
                  {infoLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className="block px-4 py-2.5 text-xs font-semibold text-parchment-300 hover:text-gold-300 hover:bg-charcoal-800/80 transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-2.5">
            <button
              id="navbar-login-btn"
              onClick={onOpenLogin}
              className="px-4 py-1.5 text-xs font-bold tracking-wider text-parchment-200 hover:text-white border border-gold-900/60 hover:border-gold-600/80 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 uppercase font-sans"
            >
              LOGIN
            </button>
            <button
              id="navbar-register-btn"
              onClick={onOpenRegister}
              className="px-5 py-1.5 text-xs font-bold tracking-wider text-charcoal-950 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 rounded-md transition shadow-md shadow-gold-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 uppercase font-sans"
            >
              REGISTER
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            id="navbar-mobile-menu-btn"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden p-2 text-parchment-300 hover:text-gold-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gold-900/40 bg-charcoal-950/98 backdrop-blur-md">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col space-y-1">
            {[...mainLinks, ...infoLinks].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="px-4 py-2.5 text-sm font-semibold tracking-wide text-parchment-300 hover:text-gold-300 hover:bg-charcoal-900/60 rounded-lg transition-colors"
              >
                {item.label}
              </a>
            ))}

            <div className="pt-3 flex flex-col space-y-2 border-t border-gold-900/30">
              <button
                id="mobile-login-btn"
                onClick={() => { setMobileMenuOpen(false); onOpenLogin(); }}
                className="w-full py-2.5 text-sm font-bold tracking-wider text-parchment-200 border border-gold-800/60 rounded-lg transition hover:text-white hover:border-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                LOGIN
              </button>
              <button
                id="mobile-register-btn"
                onClick={() => { setMobileMenuOpen(false); onOpenRegister(); }}
                className="w-full py-2.5 text-sm font-bold tracking-wider text-charcoal-950 bg-gradient-to-r from-gold-300 to-gold-500 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 shadow-md shadow-gold-950/50"
              >
                REGISTER
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
