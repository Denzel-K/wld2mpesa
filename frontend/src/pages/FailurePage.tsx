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
    <div className="flex flex-col min-h-screen items-center bg-[var(--bg-primary)] animate-fade-in">
      {/* Error header */}
      <div className="w-full bg-red-500 pt-16 pb-12 flex flex-col items-center rounded-b-[2rem] relative overflow-hidden shadow-[0_20px_40px_rgba(239,68,68,0.3)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl animate-shake">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <h2 className="text-white text-xl font-bold font-display tracking-tight">Payment Failed</h2>
        <p className="text-white/60 text-xs mt-2 font-bold uppercase tracking-[0.2em] text-center px-10">
          Your WLD has not been deducted
        </p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-12 flex flex-col gap-5 w-full max-w-md">
        {/* What was attempted */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Amount</span>
            <span className="text-base font-bold text-[var(--text-primary)] font-display">{formatKes(kes)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">{getRecipientLabel()}</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{getRecipientValue()}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="card bg-red-500/5 border border-red-500/20 p-5 shadow-lg">
          <p className="text-[9px] font-bold text-red-400 uppercase tracking-[0.25em] mb-1.5">Error Reason</p>
          <p className="text-xs text-red-400 font-normal leading-relaxed">{reason}</p>
        </div>

        {/* Common reasons */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-5 shadow-xl">
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.25em] mb-3">
            Common causes
          </p>
          <div className="space-y-2.5">
            {[
              'Payment cancelled in World App',
              'Insufficient WLD balance',
              'Invalid Till number',
              'Network timeout — try again',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 py-0.5">
                <div className="w-1 h-1 rounded-full bg-red-500/40 mt-1.5" />
                <span className="text-xs text-[var(--text-secondary)] font-normal">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <button
          className="btn-mpesa py-5 h-16 shadow-[0_15px_30px_var(--accent-glow)] flex items-center justify-center gap-3 active:scale-95 group"
          onClick={() => setScreen('payment-form')}
        >
          <RotateCcw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-700" />
          <span className="text-sm font-bold uppercase tracking-widest">Try Again</span>
        </button>

        <button
          className="h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-2 text-[var(--text-primary)] font-bold uppercase tracking-widest text-[9px] hover:border-[var(--accent)] transition-all active:scale-95 mt-3 opacity-60"
          onClick={() => { window.location.href = '/'; }}
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}
