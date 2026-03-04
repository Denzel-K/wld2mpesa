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
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <header className="bg-mpesa-green px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            {statusPolling
              ? <Loader2 className="w-5 h-5 text-white animate-spin" />
              : <CheckCircle2 className="w-5 h-5 text-white" />
            }
          </div>
          <div>
            <h2 className="text-white text-xl font-bold">Processing Payment</h2>
            <p className="text-white/70 text-sm">1–5 minutes · don't close the app</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4">

        {/* Summary */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatKes(kes)}</p>
              <p className="text-sm text-mpesa-gray-dark">
                → {transactionType === 'send' || transactionType === 'pochi' ? phoneNumber :
                  transactionType === 'paybill' ? `Paybill ${tillNumber}` :
                    `Till ${tillNumber}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-mpesa-gray-dark">You paid</p>
              <p className="text-base font-semibold text-mpesa-green">
                {pendingTransaction.wldAmount ? formatWld(pendingTransaction.wldAmount) : '…'}
              </p>
            </div>
          </div>
        </div>

        {/* Step tracker */}
        <div className="card">
          <p className="text-xs font-semibold text-mpesa-gray-dark uppercase tracking-wide mb-4">
            Payment progress
          </p>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-mpesa-gray-border" />

            {Object.entries(getStepLabels(transactionType)).map(([stepKey, label], idx) => {
              const stepData = steps.find((s) => s.step === stepKey);
              const done = stepData?.done ?? false;
              const isNext = !done && steps.filter((s) => s.done).length === idx;

              return (
                <div key={stepKey} className="flex items-start gap-4 mb-5 last:mb-0 relative">
                  {/* Step dot */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${done
                    ? 'bg-mpesa-green'
                    : isNext
                      ? 'bg-white border-2 border-mpesa-green'
                      : 'bg-white border-2 border-mpesa-gray-border'
                    }`}>
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isNext ? (
                      <Loader2 className="w-4 h-4 text-mpesa-green animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-mpesa-gray-dark" />
                    )}
                  </div>

                  <div className="pt-1">
                    <p className={`text-sm font-medium ${done ? 'text-mpesa-green' : isNext ? 'text-gray-900' : 'text-mpesa-gray-dark'}`}>
                      {label}
                    </p>
                    {stepData?.timestamp && (
                      <p className="text-xs text-mpesa-gray-dark mt-0.5">
                        {new Date(stepData.timestamp).toLocaleTimeString('en-KE')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* M-Pesa receipt (shows after settlement) */}
        {transactionStatus?.mpesaReceiptNumber && (
          <div className="card bg-mpesa-green-light border border-mpesa-green">
            <p className="text-xs font-semibold text-mpesa-green-dark uppercase tracking-wide mb-1">
              M-Pesa Receipt
            </p>
            <p className="text-lg font-bold text-mpesa-green font-mono">
              {transactionStatus.mpesaReceiptNumber}
            </p>
          </div>
        )}

        {/* Status badge */}
        {transactionStatus && (
          <StatusBadge status={transactionStatus} />
        )}

        <div className="flex-1" />

        <p className="text-center text-xs text-mpesa-gray-dark">
          Transaction ID: {pendingTransaction.transactionId}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const { status: s } = status;

  if (s === 'FAILED') {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{status.failureReason ?? 'Payment failed'}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-mpesa-green-light border border-mpesa-green rounded-xl">
      <Loader2 className="w-4 h-4 text-mpesa-green animate-spin flex-shrink-0" />
      <p className="text-sm text-mpesa-green font-medium">
        {s.replace(/_/g, ' ')}
      </p>
    </div>
  );
}
