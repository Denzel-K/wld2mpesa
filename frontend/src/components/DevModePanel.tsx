/**
 * DevModePanel.tsx — Developer simulation log panel
 *
 * Slides up from the bottom when Dev Mode is toggled.
 * Shows all simulation log entries in real time so you can
 * see exactly what the app is doing at each step.
 */

import { useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_STYLES = {
  info:    'text-blue-400',
  warn:    'text-yellow-400',
  error:   'text-red-400',
  success: 'text-green-400',
};

export default function DevModePanel() {
  const { simulationLogs, clearSimLogs, toggleDevMode } = usePaymentStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simulationLogs]);

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-900 rounded-t-2xl shadow-2xl z-50 animate-slide-up max-h-64 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-gray-300 font-semibold">
            SIMULATION LOGS ({simulationLogs.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearSimLogs} className="text-gray-500 hover:text-gray-300">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={toggleDevMode} className="text-gray-500 hover:text-gray-300">
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
