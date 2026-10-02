import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <aside
      aria-label="Offline status"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 flex items-center gap-2.5 rounded-xl bg-[#141414] text-[#FAF9F6] border border-[#FF9F1C] px-4 py-2.5 text-xs font-medium shadow-xl animate-in slide-in-from-bottom-2"
    >
      <WifiOff className="w-4 h-4 text-[#FF9F1C] shrink-0" />
      <div>
        <p className="font-semibold text-[#FF9F1C]">Offline Mode</p>
        <p className="text-neutral-300 text-[11px]">
          Displaying cached runs and leaderboards. Strava sync requires an active internet connection.
        </p>
      </div>
    </aside>
  );
};
