/**
 * StatusPage.tsx — Live transaction status with step-by-step tracker
 *
 * Polls GET /api/payment/status/:id every 3 seconds until SETTLED or FAILED.
 * Shows the full pipeline: WLD received → off-ramp → M-Pesa sent → settled.
 */

import { useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { getTransactionStatus, fetchTransactionDetail } from '@/lib/api';
import { formatKes, formatWld } from '@/lib/utils';
import { Loader2, CheckCircle2, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import type { TransactionStatus } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;

// Status order for progress calculation
const STATUS_ORDER = [
  'INITIATED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'SWAP_COMPLETED',
  'OFFRAMP_INITIATED',
  'MPESA_SENT',
  'SETTLED',
];

const getProgressPercent = (status: string): number => {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return Math.round((idx / (STATUS_ORDER.length - 1)) * 100);
};

const getStepLabels = (type: string) => {
  const isSend = type === 'send' || type === 'pochi';
  const isPaybill = type === 'paybill';

  return {
    WLD_RECEIVED: 'WLD received on World Chain',
    DEX_SWAP: 'Rebalancing liquidity (WLD → USDC)',
    OFFRAMP_INITIATED: isSend ? 'Off-ramping to M-Pesa' :
      isPaybill ? 'Off-ramping to Paybill' :
        'Off-ramping to Till',
    MPESA_SENT: isSend ? 'Sending KES to recipient' :
      isPaybill ? 'Sending KES to Paybill' :
        'Sending KES to Till',
    SETTLED: 'Payment complete!',
  };
};

export default function StatusPage() {
  const {
    pendingTransaction, transactionStatus,
    setTransactionStatus, setStatusPolling, statusPolling,
    setScreen, addSimLog, kesAmount, tillNumber, phoneNumber, transactionType,
    retryTransactionId, setRetryTransactionId, setSelectedTransactionId,
  } = usePaymentStore();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // retryDetail holds tx data loaded from API when in retry mode
  const retryDetailRef = useRef<{ kesAmount: number; wldAmount: string; transactionType: string; tillNumber?: string | null; phoneNumber?: string | null } | null>(null);

  const isRetryMode = !!retryTransactionId && !pendingTransaction;
  const txId = retryTransactionId ?? pendingTransaction?.transactionId;

  // In retry mode: load detail so we can show summary
  useEffect(() => {
    if (!isRetryMode || !retryTransactionId) return;
    fetchTransactionDetail(retryTransactionId).then((d) => {
      retryDetailRef.current = {
        kesAmount: d.kesAmount,
        wldAmount: d.wldAmount ?? '0',
        transactionType: d.transactionType,
        tillNumber: d.tillNumber,
        phoneNumber: d.phoneNumber,
      };
    }).catch(() => {});
  }, [retryTransactionId, isRetryMode]);

  // Start polling
  useEffect(() => {
    if (!txId) return;

    const stopPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setStatusPolling(false);
    };

    const poll = async () => {
      try {
        const status = await getTransactionStatus(txId);
        setTransactionStatus(status);
        addSimLog('info', `Status poll: ${status.status}`);

        if (status.status === 'SETTLED') {
          addSimLog('success', `Payment settled! M-Pesa receipt: ${status.mpesaReceiptNumber}`);
          stopPolling();
          setRetryTransactionId(null);
          setScreen('success');
        } else if (status.status === 'FAILED') {
          addSimLog('error', `Payment failed: ${status.failureReason}`);
          stopPolling();
          if (isRetryMode) {
            setSelectedTransactionId(txId);
            setRetryTransactionId(null);
            setScreen('resolution');
          } else {
            setScreen('failure');
          }
        }
      } catch (err) {
        addSimLog('error', `Status poll error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    };

    setStatusPolling(true);
    poll();
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [txId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!txId) {
    setScreen('home');
    return null;
  }

  const retryDetail = retryDetailRef.current;
  const kes = isRetryMode ? (retryDetail?.kesAmount ?? 0) : (parseFloat(kesAmount) || 0);
  const displayType = isRetryMode ? (retryDetail?.transactionType ?? 'till') : transactionType;
  const displayTill = isRetryMode ? retryDetail?.tillNumber : tillNumber;
  const displayPhone = isRetryMode ? retryDetail?.phoneNumber : phoneNumber;
  const displayWld = isRetryMode ? (retryDetail?.wldAmount ?? '0') : (pendingTransaction?.wldAmount ?? '0');

  const steps = transactionStatus?.steps ?? [];
  const progressPercent = getProgressPercent(transactionStatus?.status ?? 'PENDING_CONFIRMATION');

  return (
    <div className="flex flex-col min-h-screen animate-fade-in bg-[var(--bg-primary)]">
      {/* Header */}
      <header className={`px-8 pt-16 pb-12 rounded-b-[4rem] relative overflow-hidden shadow-[0_20px_40px_var(--accent-glow)] ${isRetryMode ? 'bg-orange-500' : 'bg-[var(--accent)]'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/20 shadow-xl">
            {statusPolling
              ? isRetryMode
                ? <RotateCcw className="w-8 h-8 text-white animate-spin" />
                : <Loader2 className="w-8 h-8 text-white animate-spin" />
              : <CheckCircle2 className="w-8 h-8 text-white" />
            }
          </div>
          <div className="flex-1">
            {isRetryMode && (
              <span className="text-[8px] font-black uppercase tracking-[0.3em] bg-white/20 text-white px-2 py-0.5 rounded-full mb-2 inline-block">
                Pipeline Retry
              </span>
            )}
            <h2 className="text-white text-xl font-black font-display tracking-tight">
              {isRetryMode ? 'Retrying Pipeline' : 'Processing Payment'}
            </h2>
            <p className="text-white/60 text-xs font-black uppercase tracking-[0.2em] mt-1">
              {isRetryMode ? 'Re-processing from last known stage' : '1–5 minutes · Stay on this screen'}
            </p>
            <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider mt-2">
              {progressPercent}% complete
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-6 pt-8 pb-12 flex flex-col gap-5">

        {/* Summary Card */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)] font-display tracking-tight">{formatKes(kes)}</p>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-2.5">
                Recipient: {displayType === 'send' || displayType === 'pochi' ? displayPhone :
                  displayType === 'paybill' ? `Paybill ${displayTill}` :
                    `Till ${displayTill}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Total Dedicated</p>
              <p className="text-lg font-bold text-[var(--accent)] font-display">
                {displayWld ? formatWld(displayWld) : '…'}
              </p>
            </div>
          </div>
          {isRetryMode && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center gap-2">
              <RotateCcw className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <p className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                Tx: {txId?.slice(0, 20)}...
              </p>
            </div>
          )}
        </div>

        {/* Step tracker */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl">
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.25em] mb-6">
            Transaction Journey
          </p>
          <div className="relative pl-3">
            {/* Vertical line with gradient */}
            <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[var(--accent)] via-[var(--accent)]/30 to-[var(--border-color)]/20" />

            {Object.entries(getStepLabels(displayType)).map(([stepKey, label], idx) => {
              const stepData = steps.find((s) => s.step === stepKey);
              const done = stepData?.done ?? false;
              const isNext = !done && steps.filter((s) => s.done).length === idx;

              return (
                <div key={stepKey} className="flex items-start gap-5 mb-6 last:mb-0 relative">
                  {/* Step dot */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 z-10 transition-all duration-500 shadow-lg ${done
                    ? 'bg-[var(--accent)] scale-110 shadow-[0_0_15px_var(--accent-glow)]'
                    : isNext
                      ? 'bg-[var(--bg-primary)] border border-[var(--accent)]'
                      : 'bg-[var(--bg-primary)] border border-[var(--border-color)]'
                    }`}>
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : isNext ? (
                      <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-ping" />
                    ) : (
                      <Clock className="w-3 h-3 text-[var(--text-secondary)]/30" />
                    )}
                  </div>

                  <div className="pt-0.5">
                    <p className={`text-xs font-bold uppercase tracking-wider transition-colors duration-500 ${done ? 'text-[var(--accent)]' : isNext ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>
                      {label}
                    </p>
                    {stepData?.timestamp && (
                      <p className="text-[9px] text-[var(--text-secondary)] font-bold mt-1 uppercase tracking-tighter opacity-60">
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
            Internal Ref: {txId}
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
      <div className="flex items-start gap-4 p-5 bg-red-400/5 border border-red-400/20 rounded-2xl shadow-lg animate-shake">
        <AlertCircle className="w-7 h-7 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">Critical Failure</p>
          <p className="text-xs text-red-400 font-normal">{status.failureReason ?? 'Payment could not be completed at this time.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl shadow-[0_10px_30px_var(--accent-glow)] animate-pulse">
      <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin flex-shrink-0" />
      <div>
        <p className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.25em] mb-1">Current Activity</p>
        <p className="text-xs text-[var(--text-primary)] font-bold uppercase tracking-wider">
          {s.replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  );
}
