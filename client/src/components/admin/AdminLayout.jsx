import { useState } from 'react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import AdminOverview from './AdminOverview';
import AdminRegistrations from './AdminRegistrations';
import AdminQuestions from './AdminQuestions';
import AdminMonitoring from './AdminMonitoring';
import AdminLeaderboard from './AdminLeaderboard';
import AdminExports from './AdminExports';
import AdminTestReset from './AdminTestReset';

/**
 * AdminLayout — Main shell coordinating header, responsive sidebar/drawer, and section views.
 *
 * Sections:
 * 1. Overview
 * 2. Registrations
 * 3. Questions
 * 4. Live Monitoring
 * 5. Leaderboard
 * 6. Exports
 * 7. Test Reset
 */
export default function AdminLayout({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <AdminHeader
        session={session}
        onLogout={onLogout}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
      />

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex w-full relative">
        {/* Navigation Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpenOnMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Section View Container */}
        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden"
          role="main"
          aria-label="Admin Dashboard Content"
        >
          {activeTab === 'overview' && (
            <AdminOverview onNavigate={(tabId) => setActiveTab(tabId)} />
          )}
          {activeTab === 'registrations' && <AdminRegistrations />}
          {activeTab === 'questions' && <AdminQuestions />}
          {activeTab === 'monitoring' && <AdminMonitoring />}
          {activeTab === 'leaderboard' && <AdminLeaderboard />}
          {activeTab === 'exports' && <AdminExports />}
          {activeTab === 'test-reset' && <AdminTestReset />}
        </main>
      </div>
    </div>
  );
}
