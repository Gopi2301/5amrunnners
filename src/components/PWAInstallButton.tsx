import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-medium">
        <Check className="w-3.5 h-3.5" />
        <span>Installed</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-xl bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414] font-semibold transition active:scale-95 shadow-sm ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="w-4 h-4 stroke-[2.5]" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 hover:bg-neutral-100 text-neutral-800 text-xs font-medium transition active:scale-95 ${
            compact ? 'px-3 py-1.5' : 'px-4 py-2'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-neutral-200 text-[#141414]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FF9F1C] flex items-center justify-center font-bold text-[#141414]">
                    🏃
                  </div>
                  <h3 className="text-base font-bold">Install 5Am Runners</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-neutral-600 my-4 bg-[#FAF9F6] p-4 rounded-xl border border-neutral-200">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#FF9F1C] text-[#141414] font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Tap the <strong>Share</strong> icon in the bottom Safari toolbar (box with upward arrow).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#FF9F1C] text-[#141414] font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Scroll down in the action sheet and select <strong>&quot;Add to Home Screen&quot;</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#FF9F1C] text-[#141414] font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>Tap <strong>Add</strong> at top right to launch full-screen like a native app!</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-[#141414] py-2.5 text-xs font-semibold text-[#FAF9F6] hover:bg-neutral-800 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
