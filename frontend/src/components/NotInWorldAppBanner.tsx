/**
 * NotInWorldAppBanner.tsx
 *
 * Shown at the top when running in a browser (not World App).
 * MiniKit pay() will simulate — safe for development.
 */

import { AlertTriangle } from 'lucide-react';

export default function NotInWorldAppBanner() {
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-yellow-800">
        <span className="font-semibold">Dev mode:</span> Running outside World App —
        payments are simulated
      </p>
    </div>
  );
}
