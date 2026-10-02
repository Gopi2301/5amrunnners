import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ShieldCheck, LogIn, LogOut, Activity as ActivityIcon } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
}) => {
  const {
    currentUser,
    isAuthenticated,
    isAdmin,
    club,
    stravaStatus,
    logout,
    connectStravaOAuth,
    syncStravaRuns,
  } = useAuth();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleStravaClick = async () => {
    if (stravaStatus?.connected) {
      setIsSyncing(true);
      await syncStravaRuns();
      setIsSyncing(false);
    } else {
      await connectStravaOAuth();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#141414] text-[#FAF9F6] border-b border-neutral-800 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo and Club Brand */}
        <div
          onClick={() => setCurrentTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF9F1C] flex items-center justify-center font-black text-[#141414] text-xs tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
            5AM
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-sm md:text-base text-[#FAF9F6]">
                {club.name}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block truncate max-w-xs">
              {club.location}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'leaderboards', label: 'Leaderboards' },
            { id: 'runs', label: 'My Runs' },
            { id: 'profile', label: 'Profile' },
          ].map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[#FAF9F6] text-[#141414]'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          {isAdmin && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                currentTab === 'admin'
                  ? 'bg-[#FF9F1C] text-[#141414]'
                  : 'text-[#FF9F1C] hover:bg-neutral-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Actions Right */}
        <div className="flex items-center gap-2.5">
          <PWAInstallButton compact />

          {/* Strava Quick Badge */}
          {isAuthenticated && (
            <button
              onClick={handleStravaClick}
              disabled={isSyncing}
              title={stravaStatus?.connected ? 'Strava Active - Click to sync runs' : 'Connect with Strava (OAuth)'}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 disabled:opacity-50 ${
                stravaStatus?.connected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-[#FC5200]/50 bg-[#FC5200] text-white hover:bg-[#e04800] shadow-xs'
              }`}
            >
              <ActivityIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {stravaStatus?.connected
                  ? isSyncing
                    ? 'Syncing...'
                    : 'Strava Active'
                  : 'Connect Strava'}
              </span>
            </button>
          )}

          {/* User Profile / Login / Sign Out */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                onClick={() => setCurrentTab('profile')}
                title="View Profile Settings"
                className="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-neutral-800 transition"
              >
                <img
                  src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt={currentUser?.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-[#FF9F1C]"
                />
                <span className="text-xs font-semibold text-neutral-200 hidden lg:inline max-w-[120px] truncate">
                  {currentUser?.displayName}
                </span>
              </div>

              <button
                onClick={logout}
                title="Sign out of 5Am runners club"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition active:scale-95 shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414] text-xs font-bold transition shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
