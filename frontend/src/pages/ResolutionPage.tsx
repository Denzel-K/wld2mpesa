/**
 * ResolutionPage.tsx — Conflict Resolution Centre
 *
 * Shows: pipeline diagram of what failed, legal/resolution options,
 * auto-refund status, and escalation path if auto-refund fails.
 */

import { useState, useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { fetchTransactionDetail, initiateRefund, cancelTransaction, retryTransaction } from '@/lib/api';
import type { TransactionDetail } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, Loader2,
  Shield, ArrowLeftRight, Zap, Send, RotateCcw,
  MessageSquare, FileText, AlertCircle, ChevronRight, ExternalLink, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STAGES = [
  {
    key: 'WLD_RECEIVED',
    label: 'WLD → World Chain',
    description: 'Your WLD was sent to the platform wallet on World Chain (EVM L2)',
    icon: Shield,
  },
  {
    key: 'DEX_SWAP',
    label: 'DEX Swap (WLD → USDC)',
    description: 'WLD is swapped for USDC on a decentralised exchange for liquidity rebalancing',
    icon: ArrowLeftRight,
  },
  {
    key: 'OFFRAMP_INITIATED',
    label: 'Bitnob Off-ramp',
    description: 'USDC is converted to KES via Bitnob and queued for mobile money payout',
    icon: Zap,
  },
  {
    key: 'MPESA_SENT',
    label: 'M-Pesa Disbursement',
    description: 'KES is disbursed to the recipient via Safaricom M-Pesa / Daraja API',
    icon: Send,
  },
];

function stageReachedIndex(status: string): number {
  const map: Record<string, number> = {
    INITIATED: -1,
    PENDING_CONFIRMATION: 0,
    CONFIRMED: 0,
    SWAP_COMPLETED: 1,
    OFFRAMP_INITIATED: 2,
    MPESA_SENT: 3,
    SETTLED: 3,
    FAILED: -1,
  };
  return map[status] ?? -1;
}

const STATUS_LABELS: Record<string, string> = {
  INITIATED: 'Initiated',
  PENDING_CONFIRMATION: 'Pending Blockchain Confirmation',
  CONFIRMED: 'WLD Confirmed On-Chain',
  SWAP_COMPLETED: 'DEX Swap Completed',
  OFFRAMP_INITIATED: 'Off-ramp Initiated',
  MPESA_SENT: 'KES Sent to Recipient',
  SETTLED: 'Fully Settled',
  FAILED: 'Failed',
};

export default function ResolutionPage() {
  const { selectedTransactionId, walletAddress, setScreen, setRetryTransactionId } = usePaymentStore();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundPolling, setRefundPolling] = useState(false);
  const [refundDone, setRefundDone] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const refundPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryDone, setRetryDone] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'actions' | 'pipeline' | 'legal' | 'escalate'>('actions');

  useEffect(() => {
    if (!selectedTransactionId) {
      setScreen('home');
      return;
    }
    fetchTransactionDetail(selectedTransactionId)
      .then(setDetail)
      .catch((e) => setError(e?.message ?? 'Failed to load transaction'))
      .finally(() => setLoading(false));
  }, [selectedTransactionId]);

  const handleRefund = async () => {
    if (!walletAddress || !detail || !selectedTransactionId) return;
    setRefundLoading(true); setRefundError(null);
    try {
      await initiateRefund(selectedTransactionId, walletAddress);
      setDetail((d) => d ? { ...d, refundStatus: 'REFUND_INITIATED' } : d);
      setRefundLoading(false);
      setRefundPolling(true);
      refundPollRef.current = setInterval(async () => {
        try {
          const updated = await fetchTransactionDetail(selectedTransactionId);
          if (updated.refundStatus === 'REFUNDED') {
            clearInterval(refundPollRef.current!);
            setRefundPolling(false);
            setRefundDone(true);
            setDetail(updated);
          } else if (updated.refundStatus === 'REFUND_FAILED') {
            clearInterval(refundPollRef.current!);
            setRefundPolling(false);
            setRefundError('On-chain refund failed. Your WLD has NOT been returned. Contact support at support@wld2mpesa.app');
            setDetail(updated);
          }
        } catch { /* ignore poll errors */ }
      }, 4000);
    } catch (e: any) {
      setRefundLoading(false);
      setRefundError(e?.message ?? 'Refund request failed. Please contact support at support@wld2mpesa.app');
    }
  };

  useEffect(() => () => { if (refundPollRef.current) clearInterval(refundPollRef.current); }, []);

  const handleCancel = async () => {
    if (!walletAddress || !detail || !selectedTransactionId) return;
    setCancelLoading(true); setCancelError(null);
    try {
      await cancelTransaction(selectedTransactionId, walletAddress);
      setCancelDone(true);
      setDetail((d) => d ? { ...d, status: 'FAILED', failureReason: 'Cancelled by user — no WLD was transferred' } : d);
    } catch (e: any) {
      setCancelError(e?.message ?? 'Cancellation failed. Please try again.');
    } finally { setCancelLoading(false); }
  };

  const handleRetry = async () => {
    if (!walletAddress || !detail || !selectedTransactionId) return;
    setRetryLoading(true); setRetryError(null);
    try {
      await retryTransaction(selectedTransactionId, walletAddress);
      setRetryDone(true);
      setRetryTransactionId(selectedTransactionId);
      setTimeout(() => setScreen('status'), 800);
    } catch (e: any) {
      setRetryError(e?.message ?? 'Retry failed. Please contact support.');
    } finally { setRetryLoading(false); }
  };

  if (!selectedTransactionId) return null;

  const status = detail?.status;
  const reachedIdx = detail ? stageReachedIndex(detail.status) : -1;
  const isInitiated = status === 'INITIATED';
  const isFailed = status === 'FAILED';
  const isPendingConfirm = status === 'PENDING_CONFIRMATION';
  const isStuckMidPipeline = status === 'CONFIRMED' || status === 'SWAP_COMPLETED' || status === 'OFFRAMP_INITIATED' || status === 'MPESA_SENT';
  const wldAlreadySent = isPendingConfirm || isStuckMidPipeline || isFailed;
  const canRefund = wldAlreadySent && detail?.refundStatus == null && !refundDone;
  const isSettled = status === 'SETTLED';

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in pb-12">

      {/* Header */}
      <header className="bg-orange-500 px-5 pt-12 pb-10 rounded-b-[2.5rem] relative overflow-hidden shadow-[0_20px_40px_rgba(249,115,22,0.3)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <button
          onClick={() => setScreen('home')}
          className="flex items-center gap-2 text-white/70 text-xs font-black uppercase tracking-widest mb-6 hover:text-white transition-colors relative z-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-xl">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-black font-display tracking-tight">Conflict Resolution</h1>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-0.5">
              Transaction Issue Centre
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5 space-y-4">

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading transaction...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center">{error}</div>
        ) : detail ? (
          <>
            {/* Summary Card */}
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Amount</span>
                <span className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(detail.kesAmount, 'KES')}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">WLD Sent</span>
                <span className="text-xs font-black text-orange-400">{detail.wldAmount ? `${parseFloat(detail.wldAmount).toFixed(4)} WLD` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Status</span>
                <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                  detail.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'
                )}>{detail.status.replace(/_/g, ' ')}</span>
              </div>
              {detail.failureReason && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Failure Reason</span>
                  <p className="text-xs text-red-400 font-normal mt-1 leading-relaxed">{detail.failureReason}</p>
                </div>
              )}
            </div>

            {/* Tab Selector */}
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] gap-1">
              {([
                { key: 'actions', label: 'Actions' },
                { key: 'pipeline', label: 'Pipeline' },
                { key: 'legal', label: 'Legal' },
                { key: 'escalate', label: 'Escalate' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
                    activeSection === key
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Actions Section */}
            {activeSection === 'actions' && (
              <div className="space-y-3">

                {/* Status-aware context banner */}
                <div className={cn('p-3 rounded-2xl border', isInitiated ? 'bg-blue-500/10 border-blue-500/20' : isSettled ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' : isFailed ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20')}>
                  <p className={cn('text-[9px] font-black uppercase tracking-widest', isInitiated ? 'text-blue-400' : isSettled ? 'text-[var(--accent)]' : isFailed ? 'text-red-400' : 'text-orange-400')}>
                    {STATUS_LABELS[status ?? ''] ?? status}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-1 font-normal leading-relaxed">
                    {isInitiated && 'No WLD has left your wallet yet. You can safely cancel this transaction.'}
                    {isPendingConfirm && 'WLD was sent but blockchain confirmation is pending. Retry to re-check and continue the pipeline.'}
                    {isStuckMidPipeline && `Pipeline stalled at ${STATUS_LABELS[status ?? ''] ?? status}. Retry re-kicks the pipeline from this stage.`}
                    {isFailed && (detail?.refundStatus ? `Refund status: ${detail.refundStatus.replace(/_/g, ' ')}` : 'Transaction failed. Request a refund to recover your WLD.')}
                    {isSettled && 'This transaction completed successfully. No action required.'}
                  </p>
                </div>

                {/* INITIATED — Cancel */}
                {isInitiated && !cancelDone && (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={cancelLoading}
                      className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {cancelLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</> : <><X className="w-4 h-4" /> Cancel Transaction</>}
                    </button>
                    {cancelError && <p className="text-[9px] text-red-400 font-bold text-center">{cancelError}</p>}
                  </>
                )}
                {cancelDone && (
                  <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                    <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wide">Cancelled — No WLD Deducted</p>
                  </div>
                )}

                {/* PENDING_CONFIRMATION / stuck — Retry */}
                {(isPendingConfirm || isStuckMidPipeline) && (
                  <>
                    {!retryDone ? (
                      <button
                        onClick={handleRetry}
                        disabled={retryLoading}
                        className="w-full py-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {retryLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying Pipeline...</> : <><RotateCcw className="w-4 h-4" /> Retry Pipeline</>}
                      </button>
                    ) : (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-wide">Retry Initiated — Redirecting to live tracker...</p>
                      </div>
                    )}
                    {retryError && <p className="text-[9px] text-red-400 font-bold text-center">{retryError}</p>}
                  </>
                )}

                {/* WLD sent — Refund */}
                {canRefund && !refundPolling && !refundDone && (
                  <>
                    <button
                      onClick={handleRefund}
                      disabled={refundLoading}
                      className="w-full py-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {refundLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Refund Request...</> : <><RotateCcw className="w-4 h-4" /> Request WLD Refund</>}
                    </button>
                    {refundError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl">
                        <p className="text-[9px] text-red-400 font-bold">{refundError}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Refund polling state */}
                {refundPolling && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-wide">Refund Broadcast — Awaiting On-Chain Confirmation</p>
                      <p className="text-[9px] text-orange-300 font-normal mt-0.5">Keep this screen open. Checking blockchain every 4 seconds...</p>
                    </div>
                  </div>
                )}

                {/* Refund confirmed */}
                {refundDone && (
                  <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wide">Refund Confirmed On-Chain</p>
                      <p className="text-[9px] text-[var(--text-secondary)] font-normal mt-0.5">
                        {detail?.wldAmount ? `${parseFloat(detail.wldAmount).toFixed(4)} WLD` : 'WLD'} transferred back to your wallet.
                        {detail?.refundTxHash && detail.refundTxHash !== 'N/A' && (
                          <> <button onClick={() => window.open(`https://worldscan.org/tx/${detail.refundTxHash}`, '_blank')} className="text-[var(--accent)] underline">Verify on WorldScan</button></>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Refund failed */}
                {!refundPolling && (detail?.refundStatus === 'REFUND_FAILED' || (refundError && !refundDone)) && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">Refund Failed — Action Required</p>
                      <p className="text-[9px] text-red-300 font-normal mt-0.5">
                        {refundError || 'Automatic refund could not be processed. Your WLD has NOT been returned.'}
                        {' '}Use the Escalate tab below to contact support.
                      </p>
                    </div>
                  </div>
                )}

                {isSettled && (
                  <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
                    <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wide">Transaction Settled — No Action Required</p>
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Section */}
            {activeSection === 'pipeline' && (
              <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4">
                <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                  Pipeline Breakdown
                </p>
                <div className="relative">
                  <div className="absolute left-[13px] top-2 bottom-2 w-px bg-[var(--border-color)]" />
                  {PIPELINE_STAGES.map(({ key, label, description, icon: Icon }, idx) => {
                    const stepData = detail.steps?.find((s) => s.step === key);
                    const done = stepData?.done ?? false;
                    const isFailing = !done && idx === reachedIdx + 1 && detail.status === 'FAILED';
                    const isNext = !done && !isFailing && reachedIdx === idx - 1;

                    return (
                      <div key={key} className={cn('mb-4 last:mb-0 rounded-xl p-3 transition-all', isFailing ? 'bg-red-500/5 border border-red-500/20' : 'bg-transparent')}>
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 z-10 border',
                            done ? 'bg-[var(--accent)] border-[var(--accent)]' :
                              isFailing ? 'bg-red-500/20 border-red-500' :
                                isNext ? 'bg-orange-500/10 border-orange-500/40' :
                                  'bg-[var(--bg-primary)] border-[var(--border-color)]'
                          )}>
                            {done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> :
                              isFailing ? <AlertCircle className="w-3.5 h-3.5 text-red-500" /> :
                                <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)]/30" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn('text-[10px] font-black uppercase tracking-wide',
                                done ? 'text-[var(--accent)]' :
                                  isFailing ? 'text-red-400' : 'text-[var(--text-secondary)]/50'
                              )}>{label}</p>
                              {isFailing && <span className="text-[8px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">FAILED HERE</span>}
                              {done && <span className="text-[8px] font-black text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">DONE</span>}
                            </div>
                            <p className={cn('text-[9px] font-normal mt-0.5 leading-relaxed',
                              done ? 'text-[var(--text-secondary)]' : isFailing ? 'text-red-300' : 'text-[var(--text-secondary)]/30'
                            )}>{description}</p>
                            {stepData?.timestamp && (
                              <p className="text-[9px] text-[var(--accent)] font-bold mt-1 opacity-70">
                                {new Date(stepData.timestamp).toLocaleString('en-KE', { hour12: true })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legal Section */}
            {activeSection === 'legal' && (
              <div className="space-y-3">
                <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">Your Rights</p>
                  {[
                    {
                      title: 'Right to Refund',
                      body: 'If your WLD was debited but the M-Pesa disbursement failed, you are entitled to a full refund of the WLD amount paid (minus confirmed network gas fees, if any). Refunds are processed automatically within 1–5 minutes.',
                    },
                    {
                      title: 'Right to Dispute',
                      body: 'If an automatic refund fails, you can escalate via our support channel. We maintain a full audit trail (transaction ID, blockchain hash, Bitnob payout ID) to investigate any discrepancy.',
                    },
                    {
                      title: 'Partial Settlement Protection',
                      body: 'If M-Pesa received funds but our system shows a failure, we will reconcile using the Daraja API M-Pesa receipt number and Bitnob confirmation before issuing any reversal.',
                    },
                    {
                      title: 'Data & Privacy',
                      body: 'All transaction data is retained for 7 years per Kenyan CBK (Central Bank of Kenya) guidelines. Your wallet address is pseudonymous and we never share personal details with third parties.',
                    },
                  ].map(({ title, body }) => (
                    <div key={title} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-[var(--border-color)]">
                      <p className="text-[10px] font-black text-[var(--text-primary)] mb-1">{title}</p>
                      <p className="text-[9px] text-[var(--text-secondary)] font-normal leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
                <div className="card bg-orange-500/5 border border-orange-500/20 p-4">
                  <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-2">Applicable Regulations</p>
                  <div className="space-y-1.5">
                    {[
                      'CBK National Payment System Act (Kenya)',
                      'Safaricom M-Pesa User Terms & Conditions',
                      'Bitnob Virtual Asset Service Provider (VASP) Terms',
                      'World Chain Smart Contract Terms of Use',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <FileText className="w-3 h-3 text-orange-400 flex-shrink-0" />
                        <span className="text-[9px] text-orange-300 font-normal">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Escalation Section */}
            {activeSection === 'escalate' && (
              <div className="space-y-3">
                <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4 space-y-3">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">Escalation Options</p>
                  {[
                    {
                      Icon: MessageSquare,
                      title: 'Live Chat Support',
                      sub: 'Response within 2 hours',
                      action: () => { /* open intercom/chat */ },
                      color: 'text-blue-400',
                      bg: 'bg-blue-500/10',
                    },
                    {
                      Icon: FileText,
                      title: 'Email Support',
                      sub: 'support@wld2mpesa.app',
                      action: () => { window.location.href = `mailto:support@wld2mpesa.app?subject=Transaction Dispute: ${selectedTransactionId}&body=Transaction ID: ${selectedTransactionId}%0AStatus: ${detail.status}%0AAmount: KSh ${detail.kesAmount}`; },
                      color: 'text-purple-400',
                      bg: 'bg-purple-500/10',
                    },
                    {
                      Icon: ExternalLink,
                      title: 'View On WorldScan',
                      sub: detail.txHash ? 'Verify on-chain transaction' : 'No tx hash yet',
                      action: () => {
                        if (detail.txHash) window.open(`https://worldscan.org/tx/${detail.txHash}`, '_blank');
                      },
                      color: 'text-[var(--accent)]',
                      bg: 'bg-[var(--accent)]/10',
                      disabled: !detail.txHash,
                    },
                  ].map(({ Icon, title, sub, action, color, bg, disabled }) => (
                    <button
                      key={title}
                      onClick={disabled ? undefined : action}
                      disabled={disabled}
                      className={cn(
                        'w-full flex items-center gap-4 p-3 rounded-xl border border-[var(--border-color)] transition-all active:scale-95',
                        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-[var(--accent)] cursor-pointer'
                      )}
                    >
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                        <Icon className={cn('w-4 h-4', color)} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-black text-[var(--text-primary)]">{title}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] font-normal mt-0.5">{sub}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/30" />
                    </button>
                  ))}
                </div>

                {/* Reference for support */}
                <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">Reference Numbers</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">Transaction ID</span>
                      <span className="text-[var(--text-primary)] font-black">{selectedTransactionId.slice(0, 24)}...</span>
                    </div>
                    {detail.txHash && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Chain Tx</span>
                        <span className="text-[var(--accent)]">{detail.txHash.slice(0, 14)}...</span>
                      </div>
                    )}
                    {detail.offrampId && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Bitnob ID</span>
                        <span className="text-[var(--text-primary)]">{detail.offrampId.slice(0, 14)}...</span>
                      </div>
                    )}
                    {detail.mpesaReceiptNumber && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">M-Pesa Receipt</span>
                        <span className="text-[var(--accent)]">{detail.mpesaReceiptNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </>
        ) : null}
      </div>
    </div>
  );
}
