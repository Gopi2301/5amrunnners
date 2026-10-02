import React from 'react';
import { LayoutDashboard, Trophy, Footprints, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Club', icon: LayoutDashboard },
    { id: 'leaderboards', label: 'Rankings', icon: Trophy },
    { id: 'runs', label: 'My Runs', icon: Footprints },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#141414] border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto px-2" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-colors select-none ${
                isActive ? 'text-[#FF9F1C]' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-[#FAF9F6]' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
