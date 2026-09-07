import { useState, useEffect } from 'react';
import { checkHealth } from './services/healthService';
import { requestOtp, verifyOtp, logout, getMe } from './services/authService';
import { getRegistrationEvent, registerTeam } from './services/registrationService';
import AdminDashboard from './components/AdminDashboard';
import QuizInterface from './components/QuizInterface';

function App() {
  // Navigation: 'login' | 'register'
  const [activeTab, setActiveTab] = useState('login');

  // System Health
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    data: null,
    error: null,
  });

  // Auth State (Module 3)
  const [session, setSession] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loginStep, setLoginStep] = useState('email'); // 'email' | 'otp'
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  // Registration State (Module 4)
  const [regEventInfo, setRegEventInfo] = useState({ loading: true, open: false, data: null });
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [members, setMembers] = useState([
    { name: '', email: '', phone: '', registerNumber: '', isLead: true },
    { name: '', email: '', phone: '', registerNumber: '', isLead: false },
  ]);
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(null);

  // Check health and session on mount
  useEffect(() => {
    checkHealth()
      .then((data) => setHealthStatus({ loading: false, data, error: null }))
      .catch((error) => setHealthStatus({ loading: false, data: null, error: error.message }));

    getMe()
      .then((res) => {
        if (res?.success && res?.user) {
          setSession(res);
        }
      })
      .catch(() => setSession(null))
      .finally(() => setIsCheckingAuth(false));

    // Load active registration event
    getRegistrationEvent()
      .then((res) => {
        setRegEventInfo({
          loading: false,
          open: Boolean(res?.registrationOpen),
          data: res?.event,
        });
      })
      .catch(() => {
        setRegEventInfo({ loading: false, open: false, data: null });
      });
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auth Handlers (Module 3)
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoginLoading(true);
    setLoginMessage(null);

    try {
      const res = await requestOtp(email.trim());
      setLoginMessage({
        type: 'success',
        text: res.message || 'If the account is eligible, an OTP has been sent.',
      });
      setLoginStep('otp');
      setCooldown(60);
    } catch (err) {
      setLoginMessage({
        type: 'error',
        text: err.message || 'Failed to request verification code.',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;

    setLoginLoading(true);
    setLoginMessage(null);

    try {
      const res = await verifyOtp(email.trim(), otp.trim());
      setSession(res);
      setLoginMessage({ type: 'success', text: 'Authentication successful!' });
      setLoginStep('email');
      setOtp('');
    } catch (err) {
      setLoginMessage({
        type: 'error',
        text: err.message || 'Invalid or expired verification code.',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoginLoading(true);
    try {
      await logout();
      setSession(null);
      setEmail('');
      setOtp('');
      setLoginStep('email');
      setLoginMessage({ type: 'success', text: 'Logged out successfully.' });
    } catch (err) {
      setLoginMessage({ type: 'error', text: err.message || 'Failed to logout.' });
    } finally {
      setLoginLoading(false);
    }
  };

  // Registration Handlers (Module 4)
  const handleMemberChange = (index, field, value) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSetLead = (index) => {
    setMembers((prev) =>
      prev.map((m, i) => ({
        ...m,
        isLead: i === index,
      }))
    );
  };

  const handleAddMember = () => {
    if (members.length >= 3) return;
    setMembers((prev) => [
      ...prev,
      { name: '', email: '', phone: '', registerNumber: '', isLead: false },
    ]);
  };

  const handleRemoveMember = () => {
    if (members.length <= 2) return;
    setMembers((prev) => {
      const updated = prev.slice(0, 2);
      // Ensure at least one lead exists
      if (!updated.some((m) => m.isLead)) {
        updated[0].isLead = true;
      }
      return updated;
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegMessage(null);

    try {
      // Format member objects for backend submission
      const formattedMembers = members.map((m) => ({
        name: m.name.trim(),
        email: m.email.trim(),
        phone: m.phone.trim(),
        registerNumber: m.registerNumber.trim(),
        role: m.isLead ? 'TEAM_LEAD' : 'MEMBER',
      }));

      const formData = new FormData();
      formData.append('teamName', teamName.trim());
      formData.append('college', college.trim());
      formData.append('department', department.trim());
      formData.append('paymentId', paymentId.trim());
      formData.append('members', JSON.stringify(formattedMembers));

      if (paymentProofFile) {
        formData.append('paymentProof', paymentProofFile);
      }

      const res = await registerTeam(formData);
      setRegistrationSuccess(res);
      setRegMessage({ type: 'success', text: res.message });
    } catch (err) {
      setRegMessage({
        type: 'error',
        text: err.message || 'Team registration failed. Please check your inputs.',
      });
    } finally {
      setRegLoading(false);
    }
  };

  const resetRegistrationForm = () => {
    setTeamName('');
    setCollege('');
    setDepartment('');
    setPaymentId('');
    setPaymentProofFile(null);
    setMembers([
      { name: '', email: '', phone: '', registerNumber: '', isLead: true },
      { name: '', email: '', phone: '', registerNumber: '', isLead: false },
    ]);
    setRegistrationSuccess(null);
    setRegMessage(null);
  };

  const calculatedFee = members.length * 50;

  // Render Admin Dashboard when authenticated as ADMIN
  if (session?.role === 'ADMIN') {
    return (
      <main className="min-h-screen p-4 sm:p-6 md:p-8 bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-start">
        <AdminDashboard session={session} onLogout={handleLogout} />
      </main>
    );
  }

  // Render Participant Quiz Interface when authenticated as TEAM_LEAD
  if (session?.role === 'TEAM_LEAD') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
        <QuizInterface session={session} onLogout={handleLogout} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-xl w-full space-y-6 bg-slate-900/80 p-6 md:p-8 rounded-xl border border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">
            Round 1 Competition
          </h1>
          <p className="text-sm text-slate-400">
            Technology Competition Platform
          </p>
        </div>

        {/* Tab Switcher */}
        {!session && (
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setRegMessage(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition ${
                activeTab === 'login'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign In (OTP)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setLoginMessage(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition ${
                activeTab === 'register'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Register Team
            </button>
          </div>
        )}

        {/* ----------------- TAB 1: LOGIN (MODULE 3) ----------------- */}
        {activeTab === 'login' && (
          <div className="space-y-4">
            {loginMessage && (
              <div
                className={`p-3 rounded text-sm border ${
                  loginMessage.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800'
                }`}
              >
                {loginMessage.text}
              </div>
            )}

            {isCheckingAuth ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                Verifying session...
              </div>
            ) : session ? (
              <div className="space-y-4 bg-slate-950/60 p-5 rounded-lg border border-slate-800">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Authenticated Session
                  </span>
                  <h2 className="text-lg font-bold text-slate-200 mt-1">
                    {session.user?.name || 'User'}
                  </h2>
                  <p className="text-sm text-slate-400">{session.user?.email}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Assigned Role:</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {session.role}
                    </span>
                  </div>
                  {session.team && (
                    <div className="flex justify-between py-1 border-b border-slate-850">
                      <span className="text-slate-400">Team:</span>
                      <span className="font-medium text-slate-300">
                        {session.team.name}
                      </span>
                    </div>
                  )}
                  {session.event && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Event Status:</span>
                      <span className="font-medium text-emerald-400">
                        {session.event.status}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  disabled={loginLoading}
                  className="w-full mt-4 py-2 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 text-sm font-medium rounded-md border border-slate-700 transition"
                >
                  {loginLoading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            ) : loginStep === 'email' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Registered Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lead@college.edu"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || !email.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-md transition"
                >
                  {loginLoading ? 'Sending code...' : 'Request Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-xs text-slate-400">
                  Enter the 6-digit verification code sent to{' '}
                  <span className="text-indigo-300 font-medium">{email}</span>.
                </div>

                <div>
                  <label
                    htmlFor="otp"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono text-center tracking-widest text-lg placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading || otp.trim().length !== 6}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-md transition"
                >
                  {loginLoading ? 'Verifying...' : 'Verify Code & Sign In'}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('email');
                      setOtp('');
                    }}
                    className="hover:text-slate-200 transition"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0 || loginLoading}
                    onClick={handleRequestOtp}
                    className="hover:text-indigo-400 disabled:opacity-40 transition"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: TEAM REGISTRATION (MODULE 4) ----------------- */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            {regMessage && (
              <div
                className={`p-3 rounded text-sm border ${
                  regMessage.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800'
                }`}
              >
                {regMessage.text}
              </div>
            )}

            {regEventInfo.loading ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                Checking event registration status...
              </div>
            ) : !regEventInfo.open ? (
              <div className="bg-amber-950/40 border border-amber-800 text-amber-300 p-4 rounded-lg text-sm text-center">
                Team registration is currently closed for upcoming competitions.
              </div>
            ) : registrationSuccess ? (
              /* Success Confirmation (No internal IDs exposed) */
              <div className="bg-slate-950/70 border border-emerald-800/80 p-5 rounded-lg space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Registration Submitted
                  </span>
                  <h3 className="text-xl font-bold text-slate-100 mt-1">
                    {registrationSuccess.teamName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {registrationSuccess.college} • {registrationSuccess.department}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-semibold text-amber-400">
                      {registrationSuccess.registrationStatus}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Members Registered:</span>
                    <span className="font-medium text-slate-200">
                      {registrationSuccess.memberCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Total Fee:</span>
                    <span className="font-mono text-emerald-400">
                      ₹{registrationSuccess.fee}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-900 p-3 rounded border border-slate-800">
                  Your registration and payment proof have been submitted for administrative verification. Once approved, the designated Team Lead can sign in using their registered email.
                </div>

                <button
                  type="button"
                  onClick={resetRegistrationForm}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md transition"
                >
                  Register Another Team
                </button>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                {/* Event Tag */}
                <div className="text-xs text-indigo-300 bg-indigo-950/40 p-2.5 rounded border border-indigo-900/60">
                  Event: <span className="font-semibold text-indigo-200">{regEventInfo.data?.name}</span> (₹50 per member)
                </div>

                {/* Team Details */}
                <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-lg border border-slate-850">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Team Information
                  </h4>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Cyber Ninjas"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">College</label>
                      <input
                        type="text"
                        required
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="e.g. PSG Tech"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Department</label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. CSE / IT"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Members Section */}
                <div className="space-y-4 bg-slate-950/40 p-3.5 rounded-lg border border-slate-850">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Team Members (2 or 3)
                    </h4>
                    <span className="text-xs text-slate-400">
                      Designate 1 Team Lead
                    </span>
                  </div>

                  {members.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900/60 rounded border border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                        <span className="font-semibold text-slate-300">
                          Member {idx + 1}
                        </span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="teamLeadSelector"
                            checked={m.isLead}
                            onChange={() => handleSetLead(idx)}
                            className="text-indigo-600 focus:ring-0"
                          />
                          <span
                            className={`text-xs ${
                              m.isLead ? 'text-indigo-400 font-bold' : 'text-slate-400'
                            }`}
                          >
                            Team Lead
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={m.name}
                          onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-750 rounded text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          value={m.email}
                          onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-750 rounded text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                        />
                        <input
                          type="tel"
                          required
                          placeholder="WhatsApp Phone (10 digits)"
                          value={m.phone}
                          onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-750 rounded text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Roll / Register Number"
                          value={m.registerNumber}
                          onChange={(e) =>
                            handleMemberChange(idx, 'registerNumber', e.target.value)
                          }
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-750 rounded text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none uppercase"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center space-x-2 pt-1">
                    {members.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddMember}
                        className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-indigo-300 rounded border border-slate-700 transition"
                      >
                        + Add 3rd Member
                      </button>
                    )}
                    {members.length === 3 && (
                      <button
                        type="button"
                        onClick={handleRemoveMember}
                        className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-rose-300 rounded border border-slate-700 transition"
                      >
                        ✕ Remove 3rd Member
                      </button>
                    )}
                  </div>
                </div>

                {/* Payment Section & Proof Upload */}
                <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-lg border border-slate-850">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Payment Verification
                    </h4>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Total Fee: ₹{calculatedFee} ({members.length} × ₹50)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Transaction / UTR / Reference ID
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentId}
                      onChange={(e) => setPaymentId(e.target.value)}
                      placeholder="e.g. UPI/NEFT/IMPS reference number"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Payment Proof Screenshot or PDF (Max 5 MB)
                    </label>
                    <input
                      type="file"
                      required
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-750 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading || !paymentProofFile}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-md transition"
                >
                  {regLoading ? 'Processing Registration...' : `Submit Registration (₹${calculatedFee})`}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Backend API & DB Health Status (Module 1, 2, 3 verification preserved) */}
        <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
          <p className="font-medium text-slate-300 mb-1">System Health:</p>
          {healthStatus.loading && (
            <span className="text-amber-400">Connecting to API...</span>
          )}
          {healthStatus.error && (
            <span className="text-rose-400">Server Offline: {healthStatus.error}</span>
          )}
          {healthStatus.data && (
            <span className="text-emerald-400 font-mono">
              API Online • DB Connected ({healthStatus.data.database?.database || 'active'})
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

export default App;
