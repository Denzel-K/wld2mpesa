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
      <div className="w-full bg-[var(--accent)] pt-20 pb-16 flex flex-col items-center rounded-b-[4rem] relative overflow-hidden shadow-[0_20px_40px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-[3rem] flex items-center justify-center mb-8 border border-white/20 shadow-2xl animate-scale-in">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-12 h-12 text-[var(--accent)]" />
          </div>
        </div>
        <h2 className="text-white text-4xl font-black font-display tracking-tight">Payment Sent!</h2>
        <p className="text-white/60 text-sm mt-2 font-black uppercase tracking-[0.2em]">
          {getSuccessMessage()}
        </p>
      </div>

      <div className="flex-1 px-8 pt-10 pb-12 flex flex-col gap-6 w-full max-w-md">
        {/* Amount card */}
        <div className="card text-center py-10 bg-[var(--bg-secondary)] border-[var(--border-color)] shadow-xl">
          <p className="text-6xl font-black text-[var(--text-primary)] font-display tracking-tighter">{formatKes(kes)}</p>
          <p className="text-[var(--text-secondary)] text-sm mt-3 font-medium">{getRecipientLabel()}</p>
          {pendingTransaction?.wldAmount && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 rounded-full border border-[var(--accent)]/20">
              <span className="text-xs font-black text-[var(--accent)] uppercase tracking-wider">
                Deduced {formatWld(pendingTransaction.wldAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Receipt details */}
        {transactionStatus?.mpesaReceiptNumber && (
          <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-8 shadow-xl">
            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-3">
              M-Pesa Receipt
            </p>
            <p className="text-3xl font-black font-mono text-[var(--text-primary)] tracking-tight">
              {transactionStatus.mpesaReceiptNumber}
            </p>
            <p className="text-[10px] text-[var(--accent)] font-black uppercase tracking-widest mt-2">
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
          className="w-full py-5 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-3 text-[var(--text-primary)] font-black uppercase tracking-widest text-xs hover:border-[var(--accent)] transition-all active:scale-95 mb-4 shadow-lg group"
          onClick={() => {
            navigator.share?.({
              title: 'WLD2Mpesa Payment',
              text: `I paid ${formatKes(kes)} ${getRecipientLabel()} using Worldcoin!\nReceipt: ${transactionStatus?.mpesaReceiptNumber ?? 'N/A'}`,
            }).catch(() => { });
          }}
        >
          <Share2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          Share Receipt
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button className="h-16 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center gap-3 text-[var(--text-primary)] font-black uppercase tracking-widest text-xs hover:border-[var(--accent)] transition-all active:scale-95 shadow-lg" onClick={() => reset()}>
            <RotateCcw className="w-4 h-4" />
            New
          </button>
          <button className="btn-mpesa h-16 shadow-[0_10px_20px_var(--accent-glow)] flex items-center justify-center gap-3 active:scale-95" onClick={() => { window.location.href = '/'; }}>
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
