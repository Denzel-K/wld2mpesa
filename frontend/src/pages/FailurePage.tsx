/**
 * FailurePage.tsx — Payment failed screen
 */

import { usePaymentStore } from '@/stores/paymentStore';
import { formatKes } from '@/lib/utils';
import { XCircle, RotateCcw, Home } from 'lucide-react';

export default function FailurePage() {
  const { error, kesAmount, tillNumber, phoneNumber, accountNumber, transactionType, transactionStatus, setScreen } = usePaymentStore();

  const kes = parseFloat(kesAmount) || 0;
  const reason =
    error ??
    transactionStatus?.failureReason ??
    'The payment could not be completed. Your WLD has not been deducted.';

  const getRecipientLabel = () => {
    switch (transactionType) {
      case 'send': return 'Phone Number';
      case 'pochi': return 'Business Phone';
      case 'paybill': return 'Paybill';
      default: return 'Till';
    }
  };

  const getRecipientValue = () => {
    switch (transactionType) {
      case 'send':
      case 'pochi': return phoneNumber || '—';
      case 'paybill': return `${tillNumber} (${accountNumber})` || '—';
      default: return tillNumber || '—';
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center bg-white animate-fade-in">
      {/* Error header */}
      <div className="w-full bg-mpesa-red pt-16 pb-12 flex flex-col items-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
          <XCircle className="w-12 h-12 text-mpesa-red" />
        </div>
        <h2 className="text-white text-2xl font-bold">Payment Failed</h2>
        <p className="text-white/80 text-sm mt-1 text-center px-8">
          Your WLD has not been deducted
        </p>
      </div>

      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4 w-full max-w-md">
        {/* What was attempted */}
        <div className="card">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-mpesa-gray-dark">Amount</span>
            <span className="text-sm font-semibold">{formatKes(kes)}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-mpesa-gray-dark">{getRecipientLabel()}</span>
            <span className="text-sm font-semibold">{getRecipientValue()}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="card bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Reason</p>
          <p className="text-sm text-red-700">{reason}</p>
        </div>

        {/* Common reasons */}
        <div className="card">
          <p className="text-xs font-semibold text-mpesa-gray-dark uppercase tracking-wide mb-2">
            Common causes
          </p>
          {[
            'Payment cancelled in World App',
            'Insufficient WLD balance',
            'Invalid Till number',
            'Network timeout — try again',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 py-1">
              <span className="text-mpesa-gray-dark text-xs mt-0.5">•</span>
              <span className="text-sm text-mpesa-gray-dark">{item}</span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <button
          className="btn-mpesa flex items-center justify-center gap-2"
          onClick={() => setScreen('payment-form')}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>

        <button
          className="btn-ghost flex items-center justify-center gap-2"
          onClick={() => { window.location.href = '/'; }}
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}
