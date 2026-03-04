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
    <div className="flex flex-col min-h-screen items-center justify-center bg-white animate-fade-in px-6">
      {/* Pulsing logo */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-mpesa-green-light flex items-center justify-center animate-pulse-green">
          <div className="w-16 h-16 rounded-full bg-mpesa-green flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
        Waiting for World App
      </h2>
      <p className="text-sm text-mpesa-gray-dark text-center max-w-xs">
        Confirm the payment in your World App with your PIN or biometric
      </p>

      {/* Step indicator */}
      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        {[
          { label: 'Preparing transaction', done: true },
          { label: 'Awaiting World App confirmation', active: true },
          { label: 'Broadcasting to World Chain', done: false },
        ].map(({ label, done, active }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              done ? 'bg-mpesa-green' : active ? 'bg-mpesa-green-light ring-2 ring-mpesa-green' : 'bg-mpesa-gray-border'
            }`}>
              {done ? (
                <span className="text-white text-xs font-bold">✓</span>
              ) : active ? (
                <Loader2 className="w-3 h-3 text-mpesa-green animate-spin" />
              ) : null}
            </div>
            <span className={`text-sm ${active ? 'text-gray-900 font-medium' : done ? 'text-mpesa-green' : 'text-mpesa-gray-dark'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
