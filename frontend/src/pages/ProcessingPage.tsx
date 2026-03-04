/**
 * ProcessingPage.tsx — Transitional screen shown during MiniKit pay()
 *
 * Displayed between ConfirmationPage triggering pay() and
 * the response coming back. Shows animated feedback.
 */

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function ProcessingPage() {
  // Prevent accidental back navigation during processing
  useEffect(() => {
    const handler = (e: PopStateEvent) => { e.preventDefault(); };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-[var(--bg-primary)] animate-fade-in px-8 text-center">
      {/* Pulsing logo */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-[var(--accent)] blur-3xl opacity-20 animate-pulse" />
        <div className="w-32 h-32 rounded-[3rem] bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center shadow-2xl relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-[0_0_30px_var(--accent-glow)]">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black text-[var(--text-primary)] mb-4 tracking-tight font-display">
        Waiting for World App
      </h2>
      <p className="text-lg text-[var(--text-secondary)] font-medium max-w-xs leading-relaxed">
        Please confirm the payment request in your World App using your PIN or Biometrics.
      </p>

      {/* Step indicator */}
      <div className="mt-12 flex flex-col gap-4 w-full max-w-sm">
        {[
          { label: 'Initializing Secure Channel', done: true },
          { label: 'Awaiting User Authorization', active: true },
          { label: 'Broadcasting to World Chain', done: false },
        ].map(({ label, done, active }) => (
          <div key={label} className="flex items-center gap-5 p-5 bg-[var(--bg-secondary)]/50 rounded-3xl border border-[var(--border-color)]">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]' : active ? 'bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20' : 'bg-[var(--text-secondary)]/10'
              }`}>
              {done ? (
                <span className="text-white text-sm font-black">✓</span>
              ) : active ? (
                <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
              ) : null}
            </div>
            <span className={`text-sm font-black uppercase tracking-widest ${active ? 'text-[var(--text-primary)]' : done ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]/40'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-12 p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
          Don't close this window
        </p>
      </div>
    </div>
  );
}
