/**
 * SuccessPage.tsx — Payment settled screen
 */

import { usePaymentStore } from '@/stores/paymentStore';
import { formatKes, formatWld } from '@/lib/utils';
import { CheckCircle2, Share2, RotateCcw, Home } from 'lucide-react';

export default function SuccessPage() {
  const { transactionStatus, pendingTransaction, kesAmount, tillNumber, phoneNumber, accountNumber, transactionType, reset } = usePaymentStore();

  const kes = parseFloat(kesAmount) || 0;

  const getRecipientLabel = () => {
    switch (transactionType) {
      case 'send': return `to ${phoneNumber}`;
      case 'pochi': return `to Pochi ${phoneNumber}`;
      case 'paybill': return `to Paybill ${tillNumber} (Acc: ${accountNumber})`;
      default: return `to Till ${tillNumber}`;
    }
  };

  const getSuccessMessage = () => {
    switch (transactionType) {
      case 'send': return 'Funds sent to the recipient';
      case 'pochi': return 'Funds sent to the business';
      case 'paybill': return 'Payment sent to the utility';
      default: return 'KES has been deposited to the Till';
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center bg-[var(--bg-primary)] animate-fade-in">
      {/* Success animation */}
      <div className="w-full bg-[var(--accent)] pt-16 pb-12 flex flex-col items-center rounded-b-[2rem] relative overflow-hidden shadow-[0_20px_40px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl animate-scale-in">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </div>
        <h2 className="text-white text-xl font-bold font-display tracking-tight">Payment Sent!</h2>
        <p className="text-white/60 text-xs mt-2 font-bold uppercase tracking-[0.2em]">
          {getSuccessMessage()}
        </p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-12 flex flex-col gap-5 w-full max-w-md">
        {/* Amount card */}
        <div className="card text-center py-8 bg-[var(--bg-secondary)] border-[var(--border-color)] shadow-xl">
          <p className="text-3xl font-bold text-[var(--text-primary)] font-display tracking-tighter">{formatKes(kes)}</p>
          <p className="text-[var(--text-secondary)] text-xs mt-2 font-normal">{getRecipientLabel()}</p>
          {pendingTransaction?.wldAmount && (
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20">
              <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
                Deduced {formatWld(pendingTransaction.wldAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Receipt details */}
        {transactionStatus?.mpesaReceiptNumber && (
          <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl">
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.25em] mb-2">
              M-Pesa Receipt
            </p>
            <p className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight">
              {transactionStatus.mpesaReceiptNumber}
            </p>
            <p className="text-[9px] text-[var(--accent)] font-bold uppercase tracking-widest mt-1.5">
              Payment Confirmed
            </p>
          </div>
        )}

        {/* Transaction ID Meta */}
        <div className="space-y-3">
          {pendingTransaction && (
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] flex items-center justify-between p-5 opacity-60">
              <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Transaction ID</span>
              <span className="text-[10px] font-black text-[var(--text-primary)] font-mono">{pendingTransaction.transactionId}</span>
            </div>
          )}

          {transactionStatus?.settledAt && (
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] flex items-center justify-between p-5 opacity-60">
              <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Settled at</span>
              <span className="text-[10px] font-black text-[var(--text-primary)]">
                {new Date(transactionStatus.settledAt).toLocaleTimeString('en-KE')}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Share button */}
        <button
          className="w-full py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-3 text-[var(--text-primary)] font-bold uppercase tracking-widest text-[10px] hover:border-[var(--accent)] transition-all active:scale-95 mb-3 shadow-lg group"
          onClick={() => {
            navigator.share?.({
              title: 'WLD2Mpesa Payment',
              text: `I paid ${formatKes(kes)} ${getRecipientLabel()} using Worldcoin!\nReceipt: ${transactionStatus?.mpesaReceiptNumber ?? 'N/A'}`,
            }).catch(() => { });
          }}
        >
          <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          Share Receipt
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button className="h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-2 text-[var(--text-primary)] font-bold uppercase tracking-widest text-[9px] hover:border-[var(--accent)] transition-all active:scale-95 shadow-lg" onClick={() => reset()}>
            <RotateCcw className="w-4 h-4" />
            New
          </button>
          <button className="btn-mpesa h-14 shadow-[0_10px_20px_var(--accent-glow)] flex items-center justify-center gap-2 active:scale-95 text-[9px] font-bold uppercase tracking-widest" onClick={() => { window.location.href = '/'; }}>
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
