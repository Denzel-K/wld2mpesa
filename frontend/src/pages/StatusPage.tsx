/**
 * StatusPage.tsx — Live transaction status with step-by-step tracker
 *
 * Polls GET /api/payment/status/:id every 3 seconds until SETTLED or FAILED.
 * Shows the full pipeline: WLD received → off-ramp → M-Pesa sent → settled.
 */

import { useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { getTransactionStatus } from '@/lib/api';
import { formatKes, formatWld } from '@/lib/utils';
import { Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { TransactionStatus } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;

const getStepLabels = (type: string) => {
  const isSend = type === 'send' || type === 'pochi';
  const isPaybill = type === 'paybill';

  return {
    WLD_RECEIVED: 'WLD received on World Chain',
    OFFRAMP_INITIATED: 'Converting WLD → KES',
    MPESA_SENT: isSend ? 'Sending to M-Pesa Number' :
      isPaybill ? 'Sending to M-Pesa Paybill' :
        'Sending to M-Pesa Till',
    SETTLED: 'Payment complete!',
  };
};

export default function StatusPage() {
  const {
    pendingTransaction, transactionStatus,
    setTransactionStatus, setStatusPolling, statusPolling,
    setScreen, addSimLog, kesAmount, tillNumber, phoneNumber, transactionType
  } = usePaymentStore();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const txId = pendingTransaction?.transactionId;

  // Start polling
  useEffect(() => {
    if (!txId) return;

    const poll = async () => {
      try {
        const status = await getTransactionStatus(txId);
        setTransactionStatus(status);
        addSimLog('info', `Status poll: ${status.status}`);

        if (status.status === 'SETTLED') {
          addSimLog('success', `Payment settled! M-Pesa receipt: ${status.mpesaReceiptNumber}`);
          stopPolling();
          setScreen('success');
        } else if (status.status === 'FAILED') {
          addSimLog('error', `Payment failed: ${status.failureReason}`);
          stopPolling();
          setScreen('failure');
        }
      } catch (err) {
        addSimLog('error', `Status poll error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    };

    const stopPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setStatusPolling(false);
    };

    setStatusPolling(true);
    poll(); // immediate first call
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [txId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pendingTransaction) {
    setScreen('home');
    return null;
  }

  const kes = parseFloat(kesAmount) || 0;
  const steps = transactionStatus?.steps ?? [];

  return (
    <div className="flex flex-col min-h-screen animate-fade-in bg-[var(--bg-primary)]">
      {/* Premium Header */}
      <header className="bg-[var(--accent)] px-8 pt-16 pb-12 rounded-b-[4rem] relative overflow-hidden shadow-[0_20px_40px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20 shadow-xl">
            {statusPolling
              ? <Loader2 className="w-8 h-8 text-white animate-spin" />
              : <CheckCircle2 className="w-8 h-8 text-white" />
            }
          </div>
          <div>
            <h2 className="text-white text-3xl font-black font-display tracking-tight">Processing Payment</h2>
            <p className="text-white/60 text-xs font-black uppercase tracking-[0.2em] mt-1">1–5 minutes · Stay on this screen</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-8 pt-8 pb-12 flex flex-col gap-6">

        {/* Summary Card */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-black text-[var(--text-primary)] font-display tracking-tight">{formatKes(kes)}</p>
              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-3">
                Recipient: {transactionType === 'send' || transactionType === 'pochi' ? phoneNumber :
                  transactionType === 'paybill' ? `Paybill ${tillNumber}` :
                    `Till ${tillNumber}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Total Dedicated</p>
              <p className="text-xl font-black text-[var(--accent)] font-display">
                {pendingTransaction.wldAmount ? formatWld(pendingTransaction.wldAmount) : '…'}
              </p>
            </div>
          </div>
        </div>

        {/* Step tracker */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-8 shadow-xl">
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-8">
            Transaction Journey
          </p>
          <div className="relative pl-4">
            {/* Vertical line with gradient */}
            <div className="absolute left-8 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[var(--accent)] via-[var(--accent)]/30 to-[var(--border-color)]/20" />

            {Object.entries(getStepLabels(transactionType)).map(([stepKey, label], idx) => {
              const stepData = steps.find((s) => s.step === stepKey);
              const done = stepData?.done ?? false;
              const isNext = !done && steps.filter((s) => s.done).length === idx;

              return (
                <div key={stepKey} className="flex items-start gap-6 mb-8 last:mb-0 relative">
                  {/* Step dot */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 z-10 transition-all duration-500 shadow-lg ${done
                    ? 'bg-[var(--accent)] scale-110 shadow-[0_0_15px_var(--accent-glow)]'
                    : isNext
                      ? 'bg-[var(--bg-primary)] border-2 border-[var(--accent)]'
                      : 'bg-[var(--bg-primary)] border-2 border-[var(--border-color)]'
                    }`}>
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isNext ? (
                      <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-ping" />
                    ) : (
                      <Clock className="w-4 h-4 text-[var(--text-secondary)]/30" />
                    )}
                  </div>

                  <div className="pt-0.5">
                    <p className={`text-sm font-black uppercase tracking-wider transition-colors duration-500 ${done ? 'text-[var(--accent)]' : isNext ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>
                      {label}
                    </p>
                    {stepData?.timestamp && (
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1 uppercase tracking-tighter opacity-60">
                        {new Date(stepData.timestamp).toLocaleTimeString('en-KE')}
                      </p>
                    )}
                    {isNext && (
                      <div className="flex gap-1 mt-2">
                        <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global status badge */}
        {transactionStatus && (
          <div className="mt-auto">
            <StatusBadge status={transactionStatus} />
          </div>
        )}

        <div className="mt-4 p-4 text-center">
          <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] opacity-40">
            Internal Ref: {pendingTransaction.transactionId}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const { status: s } = status;

  if (s === 'FAILED') {
    return (
      <div className="flex items-start gap-5 p-6 bg-red-400/5 border border-red-400/20 rounded-[2rem] shadow-lg animate-shake">
        <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Critical Failure</p>
          <p className="text-sm text-red-400 font-medium">{status.failureReason ?? 'Payment could not be completed at this time.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 p-6 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-[2.5rem] shadow-[0_10px_30px_var(--accent-glow)] animate-pulse">
      <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin flex-shrink-0" />
      <div>
        <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-[0.3em] mb-1">Current Activity</p>
        <p className="text-sm text-[var(--text-primary)] font-black uppercase tracking-wider">
          {s.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}
