import React, { useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
 * WaitingScreen — Round 1 Waiting Area
 *
 * Requirements:
 *  1. Completely stable, zero-flicker loading. No re-animating/flashing on poll.
 *  2. NO skulls — sophisticated ornaments: navigation astrolabe / filigree, anchor, compass.
 *  3. Richer color palette: midnight navy, muted teal, ocean blue, authentic parchment/cream,
 *     deep bronze, with gold strictly as refined accent.
 *  4. Smooth subtle animations (trickling sand, gentle ambient rock/float).
 *  5. Fully responsive (360px–1440px+).
 *  6. Respects prefers-reduced-motion.
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLE_ID = 'ws-waiting-styles';
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ws-float {
      0%, 100% { transform: translateY(0px); }
      50%      { transform: translateY(-5px); }
    }
    @keyframes ws-rock {
      0%, 100% { transform: rotate(-1.5deg); }
      50%      { transform: rotate(1.5deg); }
    }
    @keyframes ws-sand-fall {
      0%   { height: 0px; opacity: 0; }
      10%  { opacity: 1; }
      85%  { opacity: 1; }
      100% { height: 26px; opacity: 0; }
    }
    @keyframes ws-sand-pile {
      0%   { height: 2px; }
      100% { height: 16px; }
    }
    @keyframes ws-glow {
      0%, 100% { filter: drop-shadow(0 0 6px rgba(212,175,55,0.3)); }
      50%      { filter: drop-shadow(0 0 14px rgba(212,175,55,0.55)); }
    }
    @keyframes ws-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.5; transform: scale(0.85); }
    }

    .ws-page-container {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
      background-image: url('/assets/waiting-bg.jpg');
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      background-color: #0b1522;
    }
    .ws-scroll {
      animation: ws-float 6s ease-in-out infinite;
      will-change: transform;
    }
    .ws-hourglass {
      animation: ws-rock 5s ease-in-out infinite, ws-glow 3.5s ease-in-out infinite;
      will-change: transform, filter;
    }
    .ws-sand-stream {
      animation: ws-sand-fall 2.4s ease-in infinite;
    }
    .ws-sand-pile-anim {
      animation: ws-sand-pile 2.4s ease-out infinite alternate;
    }
    .ws-status-dot {
      animation: ws-dot 2.5s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .ws-scroll, .ws-hourglass,
      .ws-sand-stream, .ws-sand-pile-anim,
      .ws-status-dot {
        animation: none !important;
        transform: none !important;
        filter: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ── SVG Hourglass with Sand Stream ── */
function Hourglass() {
  return (
    <svg
      viewBox="0 0 80 140"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="hg-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAD284" />
          <stop offset="35%" stopColor="#B3892B" />
          <stop offset="70%" stopColor="#7A5612" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
        <linearGradient id="hg-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(180,215,245,0.2)" />
          <stop offset="40%" stopColor="rgba(215,235,255,0.45)" />
          <stop offset="100%" stopColor="rgba(140,180,210,0.15)" />
        </linearGradient>
        <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ECC254" />
          <stop offset="60%" stopColor="#C99418" />
          <stop offset="100%" stopColor="#8C5C04" />
        </linearGradient>
        <clipPath id="hg-clip-top">
          <polygon points="12,22 68,22 55,68 25,68" />
        </clipPath>
        <clipPath id="hg-clip-bot">
          <polygon points="25,72 55,72 68,118 12,118" />
        </clipPath>
      </defs>

      {/* Top Cap */}
      <rect x="6" y="10" width="68" height="12" rx="4" fill="url(#hg-brass)" />
      <circle cx="14" cy="16" r="3" fill="#5E3F0A" />
      <circle cx="66" cy="16" r="3" fill="#5E3F0A" />

      {/* Bottom Cap */}
      <rect x="6" y="118" width="68" height="12" rx="4" fill="url(#hg-brass)" />
      <circle cx="14" cy="124" r="3" fill="#5E3F0A" />
      <circle cx="66" cy="124" r="3" fill="#5E3F0A" />

      {/* Brass Pillars */}
      <rect x="7" y="22" width="6" height="96" rx="3" fill="url(#hg-brass)" />
      <rect x="67" y="22" width="6" height="96" rx="3" fill="url(#hg-brass)" />

      {/* Top Bulb */}
      <polygon
        points="12,22 68,22 55,68 25,68"
        fill="url(#hg-glass)"
        stroke="rgba(190,225,250,0.5)"
        strokeWidth="1"
      />
      <line
        x1="24"
        y1="28"
        x2="32"
        y2="60"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Top Sand Fill */}
      <g clipPath="url(#hg-clip-top)">
        <polygon points="14,24 66,24 52,65 28,65" fill="url(#hg-sand)" opacity="0.65" />
        <rect x="20" y="23" width="40" height="5" fill="#F0CD68" opacity="0.5" rx="1" />
      </g>

      {/* Neck */}
      <ellipse cx="40" cy="70" rx="4" ry="3.5" fill="#B3892B" opacity="0.95" />

      {/* Animated Sand Stream */}
      <rect
        className="ws-sand-stream"
        x="38.5"
        y="70"
        width="3"
        height="0"
        fill="#ECC254"
        rx="1"
        style={{ transformOrigin: '40px 70px' }}
      />

      {/* Bottom Pile */}
      <g clipPath="url(#hg-clip-bot)">
        <rect x="18" y="114" width="44" height="4" rx="2" fill="url(#hg-sand)" opacity="0.8" />
        <rect
          className="ws-sand-pile-anim"
          x="26"
          y="96"
          width="28"
          height="2"
          rx="2"
          fill="url(#hg-sand)"
          opacity="0.9"
          style={{ transformOrigin: '40px 116px' }}
        />
      </g>

      {/* Bottom Bulb */}
      <polygon
        points="25,72 55,72 68,118 12,118"
        fill="url(#hg-glass)"
        stroke="rgba(190,225,250,0.4)"
        strokeWidth="1"
        fillOpacity="0.3"
      />
      <line
        x1="56"
        y1="80"
        x2="62"
        y2="112"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Nautical Corner Filigree & Astrolabe Star Ornament (NO SKULLS) ── */
function NauticalCornerOrnament({ flip = false }) {
  const id = flip ? 'nco-r' : 'nco-l';
  return (
    <svg
      viewBox="0 0 74 74"
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        transform: flip ? 'scaleX(-1)' : undefined,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
      }}
    >
      <defs>
        <linearGradient id={`${id}-bronze`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4B155" />
          <stop offset="45%" stopColor="#8A6425" />
          <stop offset="100%" stopColor="#4A3414" />
        </linearGradient>
        <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2E6A78" />
          <stop offset="100%" stopColor="#14363F" />
        </linearGradient>
      </defs>

      {/* Corner bracket curve */}
      <path
        d="M 6,40 C 6,22 20,8 38,6 L 24,6 C 14,6 6,14 6,24 Z"
        fill={`url(#${id}-bronze)`}
      />
      <path
        d="M 4,46 C 4,23 23,4 46,4"
        fill="none"
        stroke={`url(#${id}-bronze)`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M 8,38 C 8,21 21,8 38,8"
        fill="none"
        stroke="#E6CE8A"
        strokeWidth="1"
        strokeOpacity="0.8"
      />

      {/* Decorative maritime wave scroll */}
      <path
        d="M 8,30 C 13,25 17,26 19,21 C 21,17 19,13 25,10 C 29,8 35,8 40,5"
        fill="none"
        stroke={`url(#${id}-teal)`}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Celestial 4-point Navigation Star */}
      <g transform="translate(26, 26)">
        <circle
          cx="0"
          cy="0"
          r="10"
          fill="none"
          stroke={`url(#${id}-bronze)`}
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.65"
        />
        {/* Star Points */}
        <polygon points="0,-14 2.5,-3 0,0 -2.5,-3" fill="#F0DC9C" />
        <polygon points="0,14 2.5,3 0,0 -2.5,3" fill="#A88132" />
        <polygon points="14,0 3,2.5 0,0 3,-2.5" fill="#C99E44" />
        <polygon points="-14,0 -3,2.5 0,0 -3,-2.5" fill="#8A6425" />
        {/* Diagonal flares */}
        <polygon points="7,-7 1.5,-1.5 0,0 1.5,-1.5" fill="#D4AF37" opacity="0.85" />
        <polygon points="-7,-7 -1.5,-1.5 0,0 -1.5,-1.5" fill="#9C752B" opacity="0.85" />
        <polygon points="7,7 1.5,1.5 0,0 1.5,1.5" fill="#9C752B" opacity="0.85" />
        <polygon points="-7,7 -1.5,1.5 0,0 -1.5,1.5" fill="#6B4B18" opacity="0.85" />
        {/* Center brass pivot */}
        <circle cx="0" cy="0" r="2.5" fill="#FFF2CE" />
      </g>

      {/* Corner rivets */}
      <circle cx="8" cy="46" r="2" fill="#D4AF37" stroke="#4A3414" strokeWidth="0.8" />
      <circle cx="46" cy="8" r="2" fill="#D4AF37" stroke="#4A3414" strokeWidth="0.8" />
    </svg>
  );
}

/* ── Anchor Ornament (Bottom Left) ── */
function AnchorEmblem() {
  return (
    <svg
      viewBox="0 0 60 70"
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
      }}
    >
      <defs>
        <linearGradient id="anc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CDB15D" />
          <stop offset="50%" stopColor="#7E5C1B" />
          <stop offset="100%" stopColor="#4A340D" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="8" r="6" fill="none" stroke="url(#anc-g)" strokeWidth="3.5" />
      <line x1="30" y1="14" x2="30" y2="58" stroke="url(#anc-g)" strokeWidth="4" strokeLinecap="round" />
      <line x1="14" y1="22" x2="46" y2="22" stroke="url(#anc-g)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="14" cy="22" r="3.5" fill="url(#anc-g)" />
      <circle cx="46" cy="22" r="3.5" fill="url(#anc-g)" />
      <path d="M30,58 Q14,58 14,48" fill="none" stroke="url(#anc-g)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30,58 Q46,58 46,48" fill="none" stroke="url(#anc-g)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="14" cy="46" r="3.5" fill="url(#anc-g)" />
      <circle cx="46" cy="46" r="3.5" fill="url(#anc-g)" />
    </svg>
  );
}

/* ── Compass Rose Ornament (Bottom Right) ── */
function CompassEmblem() {
  return (
    <svg
      viewBox="0 0 70 70"
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
      }}
    >
      <defs>
        <radialGradient id="cmp-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E2C76D" />
          <stop offset="50%" stopColor="#8C661D" />
          <stop offset="100%" stopColor="#4C350D" />
        </radialGradient>
      </defs>
      <circle cx="35" cy="35" r="32" fill="none" stroke="url(#cmp-g)" strokeWidth="2.5" />
      <circle cx="35" cy="35" r="28" fill="none" stroke="#2B4D5E" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
      {/* Cardinal Points */}
      <polygon points="35,5 31,30 39,30" fill="#E2C76D" />
      <polygon points="35,65 31,40 39,40" fill="#755214" />
      <polygon points="65,35 40,31 40,39" fill="#996F1D" />
      <polygon points="5,35 30,31 30,39" fill="#996F1D" />
      {/* Intermediate Points */}
      <polygon points="57,13 41,31 51,31" fill="#7E5D1D" opacity="0.75" />
      <polygon points="13,13 29,31 19,31" fill="#7E5D1D" opacity="0.75" />
      <polygon points="57,57 41,39 51,39" fill="#7E5D1D" opacity="0.75" />
      <polygon points="13,57 29,39 19,39" fill="#7E5D1D" opacity="0.75" />
      {/* Center Pivot */}
      <circle cx="35" cy="35" r="5" fill="url(#cmp-g)" />
      <circle cx="35" cy="35" r="2.5" fill="#FFF2CE" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Main WaitingScreen Component
 * Wrapped in React.memo to ensure zero re-render / zero flicker when props stay unchanged.
 * ───────────────────────────────────────────────────────────────────────────── */
function WaitingScreen({
  teamName,
  onCheckStatus,
  onLogout,
  isChecking = false,
}) {
  useEffect(() => {
    ensureStyles();
  }, []);

  return (
    <div
      className="ws-page-container"
      role="main"
      aria-label="Cryptic Tide Waiting Area"
    >
      {/* Atmospheric oceanic vignette */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(8,16,28,0.55) 100%),
            linear-gradient(to bottom, rgba(6,12,22,0.4) 0%, transparent 35%, rgba(6,12,22,0.5) 100%)
          `,
        }}
      />

      {/* ── Central Aged Parchment Scroll ── */}
      <div
        className="ws-scroll"
        role="region"
        aria-labelledby="waiting-title"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '620px',
          minWidth: '280px',
          /* Authentic parchment palette: cream, vellum, aged parchment with subtle bronze depth */
          background: `
            radial-gradient(ellipse at 25% 15%, rgba(255,250,235,0.65) 0%, transparent 45%),
            radial-gradient(ellipse at 75% 85%, rgba(200,175,130,0.3) 0%, transparent 50%),
            linear-gradient(174deg, #F8F3E8 0%, #F1E5CF 22%, #E6D4B5 52%, #DAC4A0 78%, #E7DBC2 92%, #F3EBD9 100%)
          `,
          borderRadius: '6px',
          boxShadow: `
            0 0 0 2px rgba(82, 58, 32, 0.7),
            0 0 0 5px rgba(25, 45, 60, 0.25),
            0 12px 50px rgba(5, 12, 22, 0.85),
            0 24px 80px rgba(3, 8, 16, 0.65),
            inset 0 0 45px rgba(110, 75, 30, 0.14)
          `,
          clipPath: `polygon(
            0% 2%, 1.5% 0.5%, 3% 1.5%, 4.5% 0%, 6% 1%, 7.5% 0.2%, 9% 1.2%,
            91% 1.2%, 92.5% 0.2%, 94% 1%, 95.5% 0%, 97% 1.5%, 98.5% 0.5%, 100% 2%,
            100% 98%, 98.5% 99.5%, 97% 98.5%, 95.5% 100%, 94% 99%, 92.5% 99.8%, 91% 98.8%,
            9% 98.8%, 7.5% 99.8%, 6% 99%, 4.5% 100%, 3% 98.5%, 1.5% 99.5%, 0% 98%
          )`,
        }}
      >
        {/* Top Corner Ornaments — Elegant Nautical Astrolabe Filigree (NO SKULLS) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-8px',
            left: '-6px',
            width: '74px',
            height: '74px',
            zIndex: 20,
          }}
        >
          <NauticalCornerOrnament flip={false} />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-6px',
            width: '74px',
            height: '74px',
            zIndex: 20,
          }}
        >
          <NauticalCornerOrnament flip={true} />
        </div>

        {/* Bottom Corner Ornaments — Anchor & Compass Rose */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '8px',
            width: '52px',
            height: '60px',
            zIndex: 20,
            opacity: 0.9,
          }}
        >
          <AnchorEmblem />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '6px',
            width: '62px',
            height: '62px',
            zIndex: 20,
            opacity: 0.9,
          }}
        >
          <CompassEmblem />
        </div>

        {/* Rolled Scroll Curls (Left & Right) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '8%',
            bottom: '8%',
            left: '-8px',
            width: '18px',
            background:
              'linear-gradient(to right, rgba(65,42,20,0.7) 0%, rgba(185,158,122,0.85) 30%, rgba(225,208,175,0.95) 55%, rgba(175,145,108,0.8) 80%, rgba(65,42,20,0.5) 100%)',
            borderRadius: '50%',
            boxShadow: '-3px 0 10px rgba(0,0,0,0.45)',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '8%',
            bottom: '8%',
            right: '-8px',
            width: '18px',
            background:
              'linear-gradient(to left, rgba(65,42,20,0.7) 0%, rgba(185,158,122,0.85) 30%, rgba(225,208,175,0.95) 55%, rgba(175,145,108,0.8) 80%, rgba(65,42,20,0.5) 100%)',
            borderRadius: '50%',
            boxShadow: '3px 0 10px rgba(0,0,0,0.45)',
          }}
        />

        {/* Inner Content Container */}
        <div
          style={{
            padding: 'clamp(40px, 8vw, 56px) clamp(48px, 10vw, 76px) clamp(52px, 10vw, 68px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 0,
          }}
        >
          {/* Hourglass with Gentle Ambient Rocking & Sand Flow */}
          <div
            className="ws-hourglass"
            aria-label="Sand timer hourglass"
            style={{
              width: 'clamp(62px, 13vw, 86px)',
              height: 'clamp(106px, 22vw, 150px)',
              marginBottom: '14px',
              flexShrink: 0,
            }}
          >
            <Hourglass />
          </div>

          {/* Heading — Stately Display Serif in Rich Ink */}
          <h1
            id="waiting-title"
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: 'clamp(1.45rem, 4vw, 2.25rem)',
              fontWeight: 700,
              color: '#1C150C',
              letterSpacing: '0.03em',
              lineHeight: 1.18,
              marginBottom: '10px',
              textShadow: '0 1px 2px rgba(255,245,215,0.5)',
            }}
          >
            Cryptic Tide Waiting Area
          </h1>

          {/* Team Badge — Subdued Navy / Teal Capsule */}
          {teamName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '12px',
                padding: '4px 14px',
                borderRadius: '20px',
                background: 'rgba(15, 32, 52, 0.08)',
                border: '1px solid rgba(25, 55, 80, 0.28)',
                fontSize: 'clamp(0.68rem, 1.8vw, 0.8rem)',
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
                color: '#1A374F',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span aria-hidden="true">⚓</span>
              <span>Crew: {teamName}</span>
            </div>
          )}

          {/* Primary Message */}
          <p
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: 'clamp(0.82rem, 2.1vw, 1rem)',
              fontWeight: 600,
              fontStyle: 'italic',
              color: '#241A10',
              lineHeight: 1.6,
              marginBottom: '8px',
              maxWidth: '410px',
            }}
          >
            Cryptic Tide has not started yet. Please wait for the organizer.
          </p>

          {/* Secondary Explanation */}
          <p
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: 'clamp(0.72rem, 1.7vw, 0.86rem)',
              fontStyle: 'italic',
              color: '#4C3928',
              lineHeight: 1.65,
              marginBottom: '22px',
              maxWidth: '370px',
              opacity: 0.9,
            }}
          >
            The quiz will become accessible immediately once the administrator starts the round.
          </p>

          {/* Monitoring Status Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '22px',
              fontSize: '0.68rem',
              fontFamily: 'monospace',
              color: '#3C4D58',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span
              className="ws-status-dot"
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isChecking ? '#C99418' : '#2D7D66',
                boxShadow: isChecking
                  ? '0 0 7px rgba(201,148,24,0.85)'
                  : '0 0 7px rgba(45,125,102,0.85)',
              }}
            />
            <span>{isChecking ? 'Checking event status…' : 'Monitoring for signal…'}</span>
          </div>

          {/* Actions: Physical-Style Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {/* Check Status — Antique Bronze Plaque with Gold Inset */}
            <button
              id="ws-btn-check"
              type="button"
              onClick={onCheckStatus}
              disabled={isChecking}
              aria-label="Check event status again"
              style={{
                padding: '9px 22px',
                borderRadius: '22px',
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(0.72rem, 1.7vw, 0.82rem)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: isChecking ? 'not-allowed' : 'pointer',
                opacity: isChecking ? 0.65 : 1,
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: '2px solid #7D5C28',
                background:
                  'linear-gradient(to bottom, #4A341E 0%, #2E1F11 50%, #3E2B18 100%)',
                color: '#EAD396',
                boxShadow:
                  'inset 0 1px 0 rgba(240,215,150,0.25), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.55), 0 0 0 1px rgba(150,110,40,0.25)',
              }}
              onMouseEnter={(e) => {
                if (!isChecking) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    'inset 0 1px 0 rgba(240,215,150,0.3), inset 0 -1px 0 rgba(0,0,0,0.5), 0 8px 22px rgba(0,0,0,0.65), 0 0 14px rgba(212,175,55,0.25)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  'inset 0 1px 0 rgba(240,215,150,0.25), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.55), 0 0 0 1px rgba(150,110,40,0.25)';
              }}
            >
              {isChecking ? 'Checking…' : 'Check Status Again'}
            </button>

            {/* Sign Out — Deep Midnight Ocean Plaque */}
            <button
              id="ws-btn-signout"
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              style={{
                padding: '9px 22px',
                borderRadius: '22px',
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(0.72rem, 1.7vw, 0.82rem)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: '2px solid rgba(48, 80, 110, 0.75)',
                background:
                  'linear-gradient(to bottom, #172738 0%, #0E1A26 50%, #152332 100%)',
                color: '#B5D1E8',
                boxShadow:
                  'inset 0 1px 0 rgba(160,205,250,0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.55), 0 0 0 1px rgba(60,100,140,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  'inset 0 1px 0 rgba(160,205,250,0.25), inset 0 -1px 0 rgba(0,0,0,0.5), 0 8px 22px rgba(0,0,0,0.65), 0 0 12px rgba(70,130,190,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  'inset 0 1px 0 rgba(160,205,250,0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.55), 0 0 0 1px rgba(60,100,140,0.25)';
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(WaitingScreen);
