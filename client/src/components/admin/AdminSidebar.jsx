/**
 * AdminSidebar — Responsive navigation sidebar / mobile drawer.
 *
 * Navigation Items:
 * 1. Overview
 * 2. Registrations
 * 3. Questions
 * 4. Live Monitoring
 * 5. Leaderboard
 * 6. Exports
 * 7. Test Reset
 */
export default function AdminSidebar({
  activeTab,
  onSelectTab,
  isOpenOnMobile,
  onCloseMobile,
}) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊', desc: 'Event status & controls' },
    { id: 'registrations', label: 'Registrations', icon: '👥', desc: 'Teams & approvals' },
    { id: 'questions', label: 'Questions', icon: '📝', desc: 'Question bank & reorder' },
    { id: 'monitoring', label: 'Live Monitoring', icon: '📡', desc: 'Real-time team activity' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆', desc: 'Standings & scores' },
    { id: 'exports', label: 'Exports', icon: '⬇️', desc: 'CSV reports' },
    { id: 'test-reset', label: 'Test Reset', icon: '🛠️', desc: 'Dev cleanup utility', isDanger: true },
  ];

  const handleItemClick = (id) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenOnMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0B1320] border-r border-slate-800/80 p-4 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenOnMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Admin Navigation"
      >
        <div className="space-y-6">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 lg:hidden">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Navigation
            </span>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-1" role="tablist" aria-orientation="vertical">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-between gap-3 ${
                    isActive
                      ? item.isDanger
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-xs'
                        : 'bg-indigo-600 text-white shadow-xs'
                      : item.isDanger
                      ? 'text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 border border-transparent'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer info */}
        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono space-y-1">
          <div>Round 1 • Engine v1.0</div>
          <div>Role: AUTHORITATIVE ADMIN</div>
        </div>
      </aside>
    </>
  );
}
