import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './views/DashboardView';
import { LeaderboardView } from './views/LeaderboardView';
import { MyRunsView } from './views/MyRunsView';
import { ProfileSettingsView } from './views/ProfileSettingsView';
import { AdminView } from './views/AdminView';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'leaderboards' | 'runs' | 'profile' | 'admin'>('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { isAuthenticated, club } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#141414] flex flex-col font-sans selection:bg-[#FF9F1C]/30">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab: string) => setCurrentTab(tab as any)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {/* Guest Banner if not signed in */}
        {!isAuthenticated && (
          <div className="bg-[#FF9F1C] text-[#141414] px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 max-w-2xl mx-auto flex-1">
              <span>🏃</span>
              <span>
                You are viewing {club.name} as a guest. Join the club to sync your Strava runs and join monthly leaderboards!
              </span>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-[#141414] text-[#FAF9F6] text-xs font-extrabold hover:bg-neutral-800 transition shrink-0"
            >
              Sign Up / Join
            </button>
          </div>
        )}

        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab: string) => setCurrentTab(tab as any)}
          />
        )}

        {currentTab === 'leaderboards' && <LeaderboardView />}

        {currentTab === 'runs' && (
          <MyRunsView />
        )}

        {currentTab === 'profile' && (
          <ProfileSettingsView
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'admin' && <AdminView />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        setCurrentTab={(tab: string) => setCurrentTab(tab as any)}
      />

      {/* Connectivity Indicator */}
      <OfflineIndicator />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
