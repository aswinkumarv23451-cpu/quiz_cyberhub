import { useEffect } from 'react';

/**
 * Premium Auth & Team Registration Modal
 *
 * Houses the existing working Login (OTP) and Free Team Registration flows
 * without duplicating backend services, validation, or state logic.
 * Accessible with Esc key handling, backdrop click, and focus trap.
 *
 * VISUAL POLISH:
 *   - Modal surface: deep charcoal panel with distinct gold/bronze border + shadow glow
 *   - Inputs: darker bg with visible bronze border, bright parchment text, gold focus ring
 *   - Member cards: contrasting bg with gold border
 *   - Labels: bright parchment, clearly above each field
 *   - Buttons: gold gradient primary, charcoal secondary — strong hierarchy
 *   - Checkbox/radio: gold accent, readable label
 *   - Mobile: scrollable modal, no horizontal overflow
 */
export default function AuthRegisterModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  // Login props
  email,
  setEmail,
  otp,
  setOtp,
  loginStep,
  setLoginStep,
  loginLoading,
  loginMessage,
  setLoginMessage,
  cooldown,
  handleRequestOtp,
  handleVerifyOtp,
  session,
  isCheckingAuth,
  handleLogout,
  // Registration props
  regEventInfo,
  teamName,
  setTeamName,
  college,
  setCollege,
  department,
  setDepartment,
  whatsappJoined,
  setWhatsappJoined,
  members,
  handleMemberChange,
  handleSetLead,
  handleAddMember,
  handleRemoveMember,
  handleRegisterSubmit,
  regLoading,
  regMessage,
  setRegMessage,
  registrationSuccess,
  resetRegistrationForm,
}) {
  // Handle Esc key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ── Shared style tokens ─────────────────────────────────────────── */
  const inputCls =
    'w-full px-3 py-2.5 bg-charcoal-950/90 border border-bronze-500/40 rounded-lg text-sm text-parchment-100 placeholder-parchment-500/50 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40 transition';

  const inputSmCls =
    'w-full px-2.5 py-2 bg-charcoal-950/90 border border-bronze-500/40 rounded-lg text-xs text-parchment-100 placeholder-parchment-500/50 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40 transition';

  const labelCls = 'block text-xs font-semibold text-parchment-200 mb-1.5 tracking-wide';

  const primaryBtnCls =
    'w-full py-3 px-4 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 disabled:opacity-50 disabled:hover:from-gold-300 text-charcoal-950 text-sm font-extrabold rounded-lg transition-all shadow-lg shadow-gold-900/30 hover:shadow-gold-800/50 uppercase font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300';

  const sectionCardCls =
    'space-y-3 bg-charcoal-950/70 p-4 rounded-xl border border-gold-800/35 shadow-inner shadow-black/20';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── MODAL PANEL ── */}
      <div
        className="relative max-w-xl w-full rounded-2xl p-6 sm:p-8 my-8 text-parchment-100 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(168deg, #161210 0%, #0e0c0a 40%, #0a0908 100%)',
          border: '1px solid rgba(168, 132, 84, 0.35)',
          boxShadow: '0 0 60px rgba(0,0,0,0.7), 0 0 30px rgba(120,90,40,0.12), inset 0 1px 0 rgba(212,175,55,0.08)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 text-parchment-400 hover:text-white hover:bg-charcoal-800/80 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1 mb-6 pr-8">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gold-400">
            CYBERHUB EXPEDITION PORTAL
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-black tracking-tight text-parchment-100 font-pirate">
            {activeTab === 'register' ? 'Team Registration' : 'Participant Login'}
          </h2>
          <p className="text-xs text-parchment-300/80">
            {activeTab === 'register'
              ? 'Free entry • 2 to 3 members per expedition crew'
              : 'Secure one-time passcode authentication'}
          </p>
        </div>

        {/* Tab Switcher */}
        {!session && (
          <div className="flex border-b border-gold-700/30 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                if (setRegMessage) setRegMessage(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition font-pirate ${
                activeTab === 'login'
                  ? 'border-gold-400 text-gold-300'
                  : 'border-transparent text-parchment-400/70 hover:text-parchment-200'
              }`}
            >
              Sign In (OTP)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                if (setLoginMessage) setLoginMessage(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition font-pirate ${
                activeTab === 'register'
                  ? 'border-gold-400 text-gold-300'
                  : 'border-transparent text-parchment-400/70 hover:text-parchment-200'
              }`}
            >
              Register Team (Free)
            </button>
          </div>
        )}

        {/* ── TAB 1: LOGIN (MODULE 3) ── */}
        {activeTab === 'login' && (
          <div className="space-y-4">
            {loginMessage && (
              <div
                className={`p-3 rounded-lg text-sm border ${
                  loginMessage.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                }`}
              >
                {loginMessage.text}
              </div>
            )}

            {isCheckingAuth ? (
              <div className="text-center py-6 text-parchment-400 text-sm">
                Verifying session...
              </div>
            ) : session ? (
              <div className={sectionCardCls}>
                <div className="border-b border-gold-800/30 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Authenticated Session
                  </span>
                  <h3 className="text-lg font-bold text-parchment-100 mt-1">
                    {session.user?.name || 'User'}
                  </h3>
                  <p className="text-sm text-parchment-300">{session.user?.email}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-gold-900/25">
                    <span className="text-parchment-400">Assigned Role:</span>
                    <span className="font-mono font-bold text-gold-300">
                      {session.role}
                    </span>
                  </div>
                  {session.team && (
                    <div className="flex justify-between py-1 border-b border-gold-900/25">
                      <span className="text-parchment-400">Team:</span>
                      <span className="font-medium text-parchment-200">
                        {session.team.name}
                      </span>
                    </div>
                  )}
                  {session.event && (
                    <div className="flex justify-between py-1">
                      <span className="text-parchment-400">Event Status:</span>
                      <span className="font-medium text-emerald-400">
                        {session.event.status}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loginLoading}
                  className="w-full mt-4 py-2.5 px-4 bg-charcoal-800 hover:bg-charcoal-700 text-parchment-200 text-sm font-semibold rounded-lg border border-gold-800/40 hover:border-gold-600/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  {loginLoading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            ) : loginStep === 'email' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label htmlFor="modal-email" className={labelCls}>
                    Registered Email Address
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lead@college.edu"
                    className={inputCls}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || !email.trim()}
                  className={primaryBtnCls}
                >
                  {loginLoading ? 'Sending code...' : 'Request Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-xs text-parchment-300">
                  Enter the 6-digit verification code sent to{' '}
                  <span className="text-gold-300 font-semibold">{email}</span>.
                </div>

                <div>
                  <label htmlFor="modal-otp" className={labelCls}>
                    Verification Code
                  </label>
                  <input
                    id="modal-otp"
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className={`${inputCls} font-mono text-center tracking-widest !text-lg`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || otp.trim().length !== 6}
                  className={primaryBtnCls}
                >
                  {loginLoading ? 'Verifying...' : 'Verify Code & Sign In'}
                </button>

                <div className="flex items-center justify-between text-xs text-parchment-400 pt-2 border-t border-gold-900/30">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('email');
                      setOtp('');
                    }}
                    className="hover:text-parchment-100 transition"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || loginLoading}
                    onClick={handleRequestOtp}
                    className="hover:text-gold-300 disabled:opacity-40 transition font-mono"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 2: TEAM REGISTRATION (MODULE 4 & PRODUCTION UPDATE) ── */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            {regMessage && (
              <div
                className={`p-3 rounded-lg text-sm border ${
                  regMessage.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                }`}
              >
                {regMessage.text}
              </div>
            )}

            {regEventInfo.loading ? (
              <div className="text-center py-6 text-parchment-400 text-sm">
                Checking event registration status...
              </div>
            ) : !regEventInfo.open ? (
              <div className="bg-amber-950/40 border border-amber-700/60 text-amber-300 p-4 rounded-lg text-sm text-center">
                Team registration is currently closed for upcoming competitions.
              </div>
            ) : registrationSuccess ? (
              /* Success Confirmation */
              <div className={sectionCardCls} style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
                <div className="border-b border-gold-800/30 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Registration Submitted
                  </span>
                  <h3 className="text-xl font-bold text-parchment-100 mt-1">
                    {registrationSuccess.teamName}
                  </h3>
                  <p className="text-xs text-parchment-400">
                    {registrationSuccess.college} • {registrationSuccess.department}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-gold-900/25">
                    <span className="text-parchment-400">Status:</span>
                    <span className="font-semibold text-amber-400">
                      {registrationSuccess.registrationStatus}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gold-900/25">
                    <span className="text-parchment-400">Members Registered:</span>
                    <span className="font-medium text-parchment-200">
                      {registrationSuccess.memberCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gold-900/25">
                    <span className="text-parchment-400">Registration Fee:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      FREE
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gold-900/25">
                    <span className="text-parchment-400">WhatsApp Group:</span>
                    <span className="font-medium text-emerald-400">
                      Confirmed Joined
                    </span>
                  </div>
                </div>

                <div className="text-xs text-parchment-300 bg-charcoal-950/60 p-3 rounded-lg border border-gold-900/30">
                  Your registration has been submitted for administrative verification. Once approved, the designated Team Lead can sign in using their registered email. Competition instructions and announcements will be shared in the official WhatsApp group.
                </div>

                <button
                  type="button"
                  onClick={resetRegistrationForm}
                  className="w-full py-2.5 px-4 bg-gold-600 hover:bg-gold-500 text-charcoal-950 text-sm font-bold rounded-lg transition shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  Register Another Team
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                {/* Event Tag */}
                <div className="text-xs text-gold-300 bg-gold-950/40 p-3 rounded-lg border border-gold-700/40 flex items-center justify-between">
                  <span>
                    Event: <span className="font-semibold text-gold-200">{regEventInfo.data?.name || 'Round 1'}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">FREE ENTRY</span>
                </div>

                {/* Team Details */}
                <div className={sectionCardCls}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400 font-pirate">
                    Team Information
                  </h4>
                  <div>
                    <label className={labelCls}>Team Name</label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Black Pearl Navigators"
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>College</label>
                      <input
                        type="text"
                        required
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="e.g. SVCE"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. CSE / IT"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                {/* Members Section */}
                <div className={sectionCardCls}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold-400 font-pirate">
                      Team Members (2 or 3)
                    </h4>
                    <span className="text-xs text-parchment-400">Designate 1 Team Lead</span>
                  </div>

                  {members.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-charcoal-900/60 rounded-xl border border-bronze-600/25 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-gold-900/25 pb-2">
                        <span className="font-semibold text-parchment-200">
                          Member {idx + 1}
                        </span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="modalTeamLeadSelector"
                            checked={m.isLead}
                            onChange={() => handleSetLead(idx)}
                            className="text-gold-500 focus:ring-0 accent-gold-400"
                          />
                          <span
                            className={`text-xs ${
                              m.isLead ? 'text-gold-300 font-bold' : 'text-parchment-400'
                            }`}
                          >
                            Team Lead
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={m.name}
                          onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                          className={inputSmCls}
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          value={m.email}
                          onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                          className={inputSmCls}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="WhatsApp Phone (10 digits)"
                          value={m.phone}
                          onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                          className={inputSmCls}
                        />
                        <input
                          type="text"
                          required
                          placeholder="Roll / Register Number"
                          value={m.registerNumber}
                          onChange={(e) =>
                            handleMemberChange(idx, 'registerNumber', e.target.value)
                          }
                          className={`${inputSmCls} uppercase`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center space-x-2 pt-1">
                    {members.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddMember}
                        className="text-xs py-2 px-3.5 bg-charcoal-800 hover:bg-charcoal-700 text-gold-300 rounded-lg border border-gold-800/40 hover:border-gold-600/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                      >
                        + Add 3rd Member
                      </button>
                    )}
                    {members.length === 3 && (
                      <button
                        type="button"
                        onClick={handleRemoveMember}
                        className="text-xs py-2 px-3.5 bg-charcoal-800 hover:bg-charcoal-700 text-rose-400 rounded-lg border border-rose-900/40 hover:border-rose-700/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      >
                        ✕ Remove 3rd Member
                      </button>
                    )}
                  </div>
                </div>

                {/* Official WhatsApp Group Section */}
                <div className={sectionCardCls}>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-pirate">
                      Official WhatsApp Group
                    </h4>
                    <p className="text-xs text-parchment-300/80 mt-1 font-sans">
                      Join the official WhatsApp group to receive competition instructions and important announcements.
                    </p>
                  </div>

                  <div>
                    <a
                      href={regEventInfo.whatsappGroupLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-950/40 transition uppercase font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      JOIN WHATSAPP GROUP
                    </a>
                  </div>

                  <div className="pt-2 border-t border-gold-900/30">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={whatsappJoined}
                        onChange={(e) => setWhatsappJoined(e.target.checked)}
                        className="w-4 h-4 rounded border-bronze-500/50 bg-charcoal-950 text-emerald-500 focus:ring-1 focus:ring-gold-400/40 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                      />
                      <span className="text-xs text-parchment-100 font-medium">
                        I have joined the official WhatsApp group
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading || !whatsappJoined}
                  className={primaryBtnCls}
                >
                  {regLoading ? 'Processing Registration...' : 'Submit Registration'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
