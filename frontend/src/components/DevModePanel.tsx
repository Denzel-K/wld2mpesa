/**
 * DevModePanel.tsx — Developer debug log panel
 *
 * Slides up from the bottom when Dev Mode is toggled.
 * Shows debug log entries in real time for troubleshooting.
 */

import { useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_STYLES = {
  info:    'text-[var(--accent)]',
  warn:    'text-yellow-400',
  error:   'text-red-400',
  success: 'text-emerald-400',
};

export default function DevModePanel() {
  const { simulationLogs, clearSimLogs, toggleDevMode } = usePaymentStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simulationLogs]);

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-950 rounded-t-2xl shadow-2xl z-50 animate-slide-up max-h-64 flex flex-col border-t border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] font-display">
            DEBUG LOGS ({simulationLogs.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearSimLogs} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={toggleDevMode} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
        {simulationLogs.length === 0 ? (
          <p className="text-gray-600 italic">No logs yet…</p>
        ) : (
          simulationLogs.map((log, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <span className="text-gray-600 flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('en-KE', { hour12: false })}
              </span>
              <span className={cn('flex-1', LEVEL_STYLES[log.level])}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
