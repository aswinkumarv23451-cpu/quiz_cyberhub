import { useState, useEffect, useRef } from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import MissionPreview from './MissionPreview';
import AboutCyberHub from './AboutCyberHub';
import EventFlow from './EventFlow';
import RulesSection from './RulesSection';
import InstructionsSection from './InstructionsSection';
import EventsPreview from './EventsPreview';
import CommunityPreview from './CommunityPreview';
import ContactSection from './ContactSection';
import Footer from './Footer';
import AuthRegisterModal from './AuthRegisterModal';

/**
 * PublicLandingPage — Module 13B
 *
 * Premium Professional CyberHub Event Website.
 *
 * Page order:
 *   1. HERO
 *   2. MISSION
 *   3. ABOUT CYBERHUB
 *   4. EVENT FLOW
 *   5. RULES
 *   6. INSTRUCTIONS
 *   7. EVENTS
 *   8. COMMUNITY
 *   9. CONTACT
 *  10. FOOTER
 *
 * Parallax:
 *   - A single scroll listener sets CSS custom properties on :root.
 *   - Components use `.parallax-slow` / `.parallax-medium` classes which
 *     consume these custom properties via CSS.
 *   - Disabled entirely when prefers-reduced-motion is set.
 */
export default function PublicLandingPage({
  healthStatus,
  // Existing Auth Props
  session,
  isCheckingAuth,
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
  handleLogout,
  // Existing Registration Props
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('register'); // 'register' | 'login'
  const prefersReducedRef = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const openRegister = () => {
    setModalTab('register');
    setIsModalOpen(true);
  };

  const openLogin = () => {
    setModalTab('login');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // ── Parallax scroll engine ────────────────────────────────────────────────
  // Uses only CSS custom properties + transform — no layout triggers.
  // Mobile: reduced intensity to prevent heavy movement on small screens.
  // Respects prefers-reduced-motion (exits immediately when set).
  useEffect(() => {
    if (prefersReducedRef.current) return;

    let rafId = null;

    // Reduce intensity on mobile (< 768px) — 40% of desktop rates
    const isMobile = window.innerWidth < 768;
    const slowRate   = isMobile ? 0.07 : 0.18;
    const mediumRate = isMobile ? 0.11 : 0.28;

    const updateParallax = () => {
      const sy = window.scrollY;
      const slow   = -(sy * slowRate).toFixed(2);
      const medium = -(sy * mediumRate).toFixed(2);
      document.documentElement.style.setProperty('--parallax-slow',   `${slow}px`);
      document.documentElement.style.setProperty('--parallax-medium', `${medium}px`);
      rafId = null;
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateParallax);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateParallax(); // set initial values

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      document.documentElement.style.removeProperty('--parallax-slow');
      document.documentElement.style.removeProperty('--parallax-medium');
    };
  }, []);

  // ── Custom skull cursor — canvas pre-render for cross-browser fidelity ──
  // Only activates on desktop / pointer devices. Falls back to CSS `auto`
  // if the image fails to load or canvas is unavailable.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mq.matches) return; // touch / mobile — leave native cursor untouched

    const CURSOR_SIZE = 32; // rendered px — professional & unobtrusive
    // Hotspot: near the top of the skull image (matches the apex of the skull)
    const HOTSPOT_X = 16;
    const HOTSPOT_Y = 2;

    let applied = false;

    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = CURSOR_SIZE;
        canvas.height = CURSOR_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High-quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, CURSOR_SIZE, CURSOR_SIZE);

        const dataUrl = canvas.toDataURL('image/png');
        document.body.style.cursor = `url(${dataUrl}) ${HOTSPOT_X} ${HOTSPOT_Y}, auto`;
        applied = true;
      } catch {
        // canvas tainted or unavailable — CSS image-set() rule still applies
      }
    };

    img.onerror = () => {
      // Image failed to load — CSS `auto` fallback is already in place
    };

    // Cross-origin flag not needed for same-origin assets, but safe to add
    img.src = '/assets/skull-cursor.jpeg';

    return () => {
      if (applied) {
        document.body.style.cursor = '';
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-charcoal-950 text-parchment-100 flex flex-col font-sans selection:bg-gold-500/25 selection:text-gold-200">

      {/* 1. Header & Navigation */}
      <Navbar onOpenRegister={openRegister} onOpenLogin={openLogin} />

      {/* 2. Main Landmark */}
      <main className="flex-1 w-full">

        {/* Full-Screen Hero */}
        <HeroSection onOpenRegister={openRegister} onOpenLogin={openLogin} />

        {/* The Mission Section */}
        <MissionPreview />

        {/* About CyberHub */}
        <AboutCyberHub />

        {/* Event Flow */}
        <EventFlow />

        {/* Rules & Conduct */}
        <RulesSection />

        {/* Instructions */}
        <InstructionsSection />

        {/* Events Preview Section */}
        <EventsPreview onOpenRegister={openRegister} />

        {/* Community Preview Section */}
        <CommunityPreview whatsappGroupLink={regEventInfo?.whatsappGroupLink} />

        {/* Contact Section */}
        <ContactSection />
      </main>

      {/* 3. Footer */}
      <Footer
        healthStatus={healthStatus}
        onOpenRegister={openRegister}
        onOpenLogin={openLogin}
      />

      {/* 4. Integrated Login & Free Registration Modal */}
      <AuthRegisterModal
        isOpen={isModalOpen}
        onClose={closeModal}
        activeTab={modalTab}
        setActiveTab={setModalTab}
        // Login props
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
        session={session}
        isCheckingAuth={isCheckingAuth}
        handleLogout={handleLogout}
        // Registration props
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
    </div>
  );
}
