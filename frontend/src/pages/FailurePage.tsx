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
      <div className="w-full bg-red-500 pt-20 pb-16 flex flex-col items-center rounded-b-[4rem] relative overflow-hidden shadow-[0_20px_40px_rgba(239,68,68,0.3)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-[3rem] flex items-center justify-center mb-8 border border-white/20 shadow-2xl animate-shake">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>
        <h2 className="text-white text-4xl font-black font-display tracking-tight">Payment Failed</h2>
        <p className="text-white/60 text-sm mt-2 font-black uppercase tracking-[0.2em] text-center px-12">
          Your WLD has not been deducted
        </p>
      </div>

      <div className="flex-1 px-8 pt-10 pb-12 flex flex-col gap-6 w-full max-w-md">
        {/* What was attempted */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-widest">Amount</span>
            <span className="text-lg font-black text-[var(--text-primary)] font-display">{formatKes(kes)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-widest">{getRecipientLabel()}</span>
            <span className="text-sm font-black text-[var(--text-primary)]">{getRecipientValue()}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="card bg-red-500/5 border border-red-500/20 p-6 shadow-lg">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em] mb-2">Error Reason</p>
          <p className="text-sm text-red-400 font-medium leading-relaxed">{reason}</p>
        </div>

        {/* Common reasons */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl">
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-4">
            Common causes
          </p>
          <div className="space-y-3">
            {[
              'Payment cancelled in World App',
              'Insufficient WLD balance',
              'Invalid Till number',
              'Network timeout — try again',
            ].map((item) => (
              <div key={item} className="flex items-start gap-4 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 mt-1.5" />
                <span className="text-sm text-[var(--text-secondary)] font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <button
          className="btn-mpesa py-6 h-20 shadow-[0_20px_40px_var(--accent-glow)] flex items-center justify-center gap-4 active:scale-95 group"
          onClick={() => setScreen('payment-form')}
        >
          <RotateCcw className="w-6 h-6 group-hover:-rotate-180 transition-transform duration-700" />
          <span className="text-xl font-black">Try Again</span>
        </button>

        <button
          className="h-16 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-3 text-[var(--text-primary)] font-black uppercase tracking-widest text-[10px] hover:border-[var(--accent)] transition-all active:scale-95 mt-4 opacity-60"
          onClick={() => { window.location.href = '/'; }}
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}
