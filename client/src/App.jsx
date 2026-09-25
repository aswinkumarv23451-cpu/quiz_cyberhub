import { useState, useEffect } from 'react';
import { checkHealth } from './services/healthService';
import { requestOtp, verifyOtp, logout, getMe } from './services/authService';
import { getRegistrationEvent, registerTeam } from './services/registrationService';
import AdminDashboard from './components/AdminDashboard';
import QuizInterface from './components/QuizInterface';
import PublicLandingPage from './components/landing/PublicLandingPage';

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

  // Registration State (Module 4 & Production Update)
  const [regEventInfo, setRegEventInfo] = useState({ loading: true, open: false, data: null, whatsappGroupLink: '' });
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [whatsappJoined, setWhatsappJoined] = useState(false);
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
          whatsappGroupLink: res?.whatsappGroupLink || '',
        });
      })
      .catch(() => {
        setRegEventInfo({ loading: false, open: false, data: null, whatsappGroupLink: '' });
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
    if (!whatsappJoined) {
      setRegMessage({
        type: 'error',
        text: 'You must confirm that you have joined the official WhatsApp group before registering.',
      });
      return;
    }

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

      const payload = {
        teamName: teamName.trim(),
        college: college.trim(),
        department: department.trim(),
        whatsapp_group_joined: true,
        members: formattedMembers,
      };

      const res = await registerTeam(payload);
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
    setWhatsappJoined(false);
    setMembers([
      { name: '', email: '', phone: '', registerNumber: '', isLead: true },
      { name: '', email: '', phone: '', registerNumber: '', isLead: false },
    ]);
    setRegistrationSuccess(null);
    setRegMessage(null);
  };

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
    <PublicLandingPage
      healthStatus={healthStatus}
      // Auth Props
      session={session}
      isCheckingAuth={isCheckingAuth}
      email={email}
      setEmail={setEmail}
      otp={otp}
      setOtp={setOtp}
      loginStep={loginStep}
      setLoginStep={setLoginStep}
      loginLoading={loginLoading}
      loginMessage={loginMessage}
      setLoginMessage={setLoginMessage}
      cooldown={cooldown}
      handleRequestOtp={handleRequestOtp}
      handleVerifyOtp={handleVerifyOtp}
      handleLogout={handleLogout}
      // Registration Props
      regEventInfo={regEventInfo}
      teamName={teamName}
      setTeamName={setTeamName}
      college={college}
      setCollege={setCollege}
      department={department}
      setDepartment={setDepartment}
      whatsappJoined={whatsappJoined}
      setWhatsappJoined={setWhatsappJoined}
      members={members}
      handleMemberChange={handleMemberChange}
      handleSetLead={handleSetLead}
      handleAddMember={handleAddMember}
      handleRemoveMember={handleRemoveMember}
      handleRegisterSubmit={handleRegisterSubmit}
      regLoading={regLoading}
      regMessage={regMessage}
      setRegMessage={setRegMessage}
      registrationSuccess={registrationSuccess}
      resetRegistrationForm={resetRegistrationForm}
    />
  );
}

export default App;
