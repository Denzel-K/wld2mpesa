/**
 * TransactionDetailModal.tsx — Full transaction detail modal
 *
 * For SETTLED: shows complete pipeline journey (all steps + timestamps + amounts).
 * For non-settled: shows conflict resolution options + auto-refund.
 */

import { useState, useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { fetchTransactionDetail, initiateRefund, cancelTransaction, retryTransaction } from '@/lib/api';
import type { TransactionDetail } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  X, CheckCircle2, AlertCircle, Loader2,
  Send, Store, CreditCard, User, ArrowLeftRight,
  Shield, Zap, AlertTriangle, RotateCcw, ExternalLink, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  transactionId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  INITIATED: 'Initiated',
  PENDING_CONFIRMATION: 'Pending Blockchain Confirmation',
  CONFIRMED: 'WLD Confirmed On-Chain',
  SWAP_COMPLETED: 'DEX Swap Completed',
  OFFRAMP_INITIATED: 'Off-ramp to Bitnob Initiated',
  MPESA_SENT: 'KES Sent to Recipient',
  SETTLED: 'Fully Settled',
  FAILED: 'Failed',
};

const PIPELINE_STAGES = [
  { key: 'WLD_RECEIVED', label: 'WLD Received', icon: Shield, phase: 'Blockchain' },
  { key: 'DEX_SWAP', label: 'DEX Swap (WLD → USDC)', icon: ArrowLeftRight, phase: 'Liquidity' },
  { key: 'OFFRAMP_INITIATED', label: 'Bitnob Off-ramp', icon: Zap, phase: 'Off-ramp' },
  { key: 'MPESA_SENT', label: 'M-Pesa Disbursement', icon: Send, phase: 'Payout' },
  { key: 'SETTLED', label: 'Settlement Complete', icon: CheckCircle2, phase: 'Done' },
];

function typeIcon(type: string) {
  if (type === 'paybill') return CreditCard;
  if (type === 'send') return Send;
  if (type === 'till') return Store;
  return User;
}

function typeColor(type: string) {
  if (type === 'paybill') return 'bg-blue-600';
  if (type === 'till') return 'bg-purple-600';
  if (type === 'pochi') return 'bg-orange-500';
  return 'bg-[var(--accent)]';
}

function recipientLabel(tx: TransactionDetail): string {
  if (tx.transactionType === 'send' || tx.transactionType === 'pochi') return tx.phoneNumber ?? 'Unknown';
  if (tx.transactionType === 'paybill') return `${tx.tillNumber} • Acct: ${tx.accountNumber}`;
  return tx.tillNumber ?? 'Unknown';
}

function shortHash(hash: string): string {
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function TransactionDetailModal({ transactionId, onClose }: Props) {
  const { walletAddress, setScreen, setSelectedTransactionId, setRetryTransactionId } = usePaymentStore();
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
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTransactionDetail(transactionId)
      .then(setDetail)
      .catch((e) => setError(e?.message ?? 'Failed to load transaction'))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const handleRefund = async () => {
    if (!walletAddress || !detail) return;
    setRefundLoading(true); setRefundError(null);
    try {
      await initiateRefund(transactionId, walletAddress);
      setDetail((d) => d ? { ...d, refundStatus: 'REFUND_INITIATED' } : d);
      setRefundLoading(false);
      setRefundPolling(true);
      // Poll until on-chain result is known
      refundPollRef.current = setInterval(async () => {
        try {
          const updated = await fetchTransactionDetail(transactionId);
          if (updated.refundStatus === 'REFUNDED') {
            clearInterval(refundPollRef.current!);
            setRefundPolling(false);
            setRefundDone(true);
            setDetail(updated);
          } else if (updated.refundStatus === 'REFUND_FAILED') {
            clearInterval(refundPollRef.current!);
            setRefundPolling(false);
            setRefundError('On-chain refund failed. Your WLD has NOT been returned. Please use Conflict Resolution to escalate.');
            setDetail(updated);
          }
        } catch { /* ignore poll errors */ }
      }, 4000);
    } catch (e: any) {
      setRefundLoading(false);
      setRefundError(e?.message ?? 'Refund request failed. Please contact support.');
    }
  };

  useEffect(() => () => { if (refundPollRef.current) clearInterval(refundPollRef.current); }, []);

  const handleCancel = async () => {
    if (!walletAddress || !detail) return;
    setCancelLoading(true); setCancelError(null);
    try {
      await cancelTransaction(transactionId, walletAddress);
      setCancelDone(true);
      setDetail((d) => d ? { ...d, status: 'FAILED', failureReason: 'Cancelled by user — no WLD was transferred' } : d);
    } catch (e: any) {
      setCancelError(e?.message ?? 'Cancellation failed. Please try again.');
    } finally { setCancelLoading(false); }
  };

  const handleRetry = async () => {
    if (!walletAddress || !detail) return;
    setRetryLoading(true); setRetryError(null);
    try {
      await retryTransaction(transactionId, walletAddress);
      setRetryDone(true);
      setRetryTransactionId(transactionId);
      setTimeout(() => { onClose(); setScreen('status'); }, 800);
    } catch (e: any) {
      setRetryError(e?.message ?? 'Retry failed. Please contact support.');
    } finally { setRetryLoading(false); }
  };

  const handleResolve = () => {
    setSelectedTransactionId(transactionId);
    setScreen('resolution');
    onClose();
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const status = detail?.status;
  const isSettled = status === 'SETTLED';
  const isFailed = status === 'FAILED';
  const isInitiated = status === 'INITIATED';
  const isPendingConfirm = status === 'PENDING_CONFIRMATION';
  // WLD already sent — pipeline stalled mid-flight
  const isStuckMidPipeline = status === 'CONFIRMED' || status === 'SWAP_COMPLETED' || status === 'OFFRAMP_INITIATED' || status === 'MPESA_SENT';
  const wldAlreadySent = isPendingConfirm || isStuckMidPipeline || isFailed;
  const canRefund = wldAlreadySent && detail?.refundStatus == null && !refundDone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-t-3xl max-h-[92vh] overflow-y-auto border-t border-[var(--border-color)] shadow-2xl animate-slide-up-sheet">

        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-primary)] z-10 px-5 pt-4 pb-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {detail && (
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white', typeColor(detail.transactionType))}>
                {(() => { const Icon = typeIcon(detail.transactionType); return <Icon className="w-4 h-4" />; })()}
              </div>
            )}
            <div>
              <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Transaction Details</p>
              <p className="text-[9px] text-[var(--text-secondary)] font-bold mt-0.5 font-mono">
                {shortHash(transactionId)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors">
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading...</span>
          </div>
        ) : error ? (
          <div className="m-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center">{error}</div>
        ) : detail ? (
          <div className="px-5 pt-4 pb-8 space-y-4">

            {/* Status Badge */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl border',
              isSettled ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' :
                isFailed ? 'bg-red-500/10 border-red-500/30' :
                  'bg-orange-500/10 border-orange-500/30'
            )}>
              {isSettled ? <CheckCircle2 className="w-5 h-5 text-[var(--accent)] flex-shrink-0" /> :
                isFailed ? <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" /> :
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin flex-shrink-0" />}
              <div>
                <p className={cn('text-[10px] font-black uppercase tracking-widest',
                  isSettled ? 'text-[var(--accent)]' : isFailed ? 'text-red-500' : 'text-orange-500'
                )}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </p>
                {detail.refundStatus && (
                  <p className="text-[9px] text-orange-400 font-bold mt-0.5 uppercase tracking-wide">
                    Refund: {detail.refundStatus.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            </div>

            {/* Amount Summary */}
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4 space-y-2.5">
              <Row label="Recipient" value={recipientLabel(detail)} />
              <Row label="KES Amount" value={formatCurrency(detail.kesAmount, 'KES')} bold accent />
              {detail.wldAmount && <Row label="WLD Paid" value={`${parseFloat(detail.wldAmount).toFixed(6)} WLD`} />}
              {detail.feeKes != null && <Row label="Total Fees" value={formatCurrency(detail.feeKes, 'KES')} />}
              {detail.platformFeeKes != null && <Row label="Service & settlement fee" value={formatCurrency(detail.platformFeeKes, 'KES')} />}
              {detail.safaricomFeeKes != null && <Row label={`M-Pesa ${detail.transactionType} rail fee`} value={formatCurrency(detail.safaricomFeeKes, 'KES')} />}
              {detail.wldRate && <Row label="Rate Used" value={`1 WLD = KSh ${parseFloat(detail.wldRate).toFixed(2)}`} />}
            </div>

            {/* The quote records customer charges separately from platform reserves. */}
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4 space-y-2">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">Platform cost reserves</p>
              {detail.bitnobFeeKes != null && <Row label="Off-ramp reserve" value={formatCurrency(detail.bitnobFeeKes, 'KES')} />}
              {detail.dexFeeKes != null && <Row label="DEX reserve" value={formatCurrency(detail.dexFeeKes, 'KES')} />}
              {detail.gasBufferKes != null && <Row label="World Chain gas reserve" value={formatCurrency(detail.gasBufferKes, 'KES')} />}
              {detail.netPlatformRevenueKes != null && <Row label="Protected margin" value={formatCurrency(detail.netPlatformRevenueKes, 'KES')} bold accent />}
              <p className="pt-2 text-[9px] text-[var(--text-secondary)]">Final provider debits are reconciled after settlement; reserves are not additional customer charges.</p>
            </div>

            {/* Pipeline Journey */}
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4">Transaction Journey</p>
              <div className="relative">
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-[var(--border-color)]" />
                {PIPELINE_STAGES.map(({ key, label, icon: Icon, phase }, idx) => {
                  const stepData = detail.steps?.find((s) => s.step === key);
                  const done = stepData?.done ?? false;
                  const isActive = !done && (detail.steps?.filter((s) => s.done).length ?? 0) === idx;
                  return (
                    <div key={key} className="flex items-start gap-3 mb-3 last:mb-0 relative">
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 z-10 border transition-all',
                        done ? 'bg-[var(--accent)] border-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]' :
                          isActive ? 'bg-orange-500/20 border-orange-500' :
                            'bg-[var(--bg-primary)] border-[var(--border-color)]'
                      )}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> :
                          isActive ? <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" /> :
                            <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)]/30" />}
                      </div>
                      <div className="pt-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-[10px] font-bold uppercase tracking-wide truncate',
                            done ? 'text-[var(--accent)]' :
                              isActive ? 'text-orange-400' :
                                'text-[var(--text-secondary)]/40'
                          )}>{label}</p>
                          <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0',
                            done ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--border-color)] text-[var(--text-secondary)]/40'
                          )}>{phase}</span>
                        </div>
                        {stepData?.timestamp && (
                          <p className="text-[9px] text-[var(--text-secondary)] font-bold mt-0.5 opacity-60">
                            {new Date(stepData.timestamp).toLocaleString('en-KE', { hour12: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Technical Details */}
            <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-4 space-y-2">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">Audit Trail</p>
              {detail.createdAt && <TimestampRow label="Initiated" value={detail.createdAt} />}
              {detail.confirmedAt && <TimestampRow label="Blockchain Confirmed" value={detail.confirmedAt} />}
              {detail.offrampAt && <TimestampRow label="Off-ramp Started" value={detail.offrampAt} />}
              {detail.mpesaSentAt && <TimestampRow label="M-Pesa Sent" value={detail.mpesaSentAt} />}
              {detail.settledAt && <TimestampRow label="Settled" value={detail.settledAt} />}
              {detail.txHash && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">On-Chain Tx</span>
                  <button
                    onClick={() => copyToClipboard(detail.txHash!, 'txHash')}
                    className="flex items-center gap-1.5 text-[9px] font-black text-[var(--accent)] font-mono hover:opacity-70 transition-opacity"
                  >
                    {shortHash(detail.txHash)}
                    {copied === 'txHash' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
              {detail.mpesaReceiptNumber && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">M-Pesa Receipt</span>
                  <button
                    onClick={() => copyToClipboard(detail.mpesaReceiptNumber!, 'receipt')}
                    className="flex items-center gap-1.5 text-[9px] font-black text-[var(--accent)] font-mono hover:opacity-70 transition-opacity"
                  >
                    {detail.mpesaReceiptNumber}
                    {copied === 'receipt' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
              {detail.offrampId && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Bitnob ID</span>
                  <span className="text-[9px] font-black text-[var(--text-primary)] font-mono">{shortHash(detail.offrampId)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1">
                <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Ref ID</span>
                <button
                  onClick={() => copyToClipboard(transactionId, 'txId')}
                  className="flex items-center gap-1.5 text-[9px] font-black text-[var(--text-primary)] font-mono hover:opacity-70 transition-opacity"
                >
                  {shortHash(transactionId)}
                  {copied === 'txId' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Failure Reason */}
            {isFailed && detail.failureReason && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-1.5">
                <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Failure Reason</p>
                <p className="text-xs text-red-400 font-normal leading-relaxed">{detail.failureReason}</p>
              </div>
            )}

            {/* Refund Status Banners */}
            {(refundDone || detail.refundStatus === 'REFUND_INITIATED') && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-start gap-3">
                <RotateCcw className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-wide">Refund Broadcast — Awaiting Confirmation</p>
                  <p className="text-[9px] text-orange-300 font-normal mt-0.5">
                    The on-chain WLD transfer has been broadcast. Confirm arrival in your wallet in 1–2 minutes.
                  </p>
                </div>
              </div>
            )}
            {detail.refundStatus === 'REFUNDED' && (
              <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl space-y-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wide">Refund Sent On-Chain</p>
                    <p className="text-[9px] text-[var(--text-secondary)] font-normal mt-0.5">
                      {detail.wldAmount ? `${parseFloat(detail.wldAmount).toFixed(4)} WLD` : 'WLD'} transferred back to your wallet.
                      If not showing, check WorldScan below.
                    </p>
                  </div>
                </div>
                {detail.refundTxHash && detail.refundTxHash !== 'N/A' && (
                  <button
                    onClick={() => window.open(`https://worldscan.org/tx/${detail.refundTxHash}`, '_blank')}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)]/20 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> Verify Refund on WorldScan
                  </button>
                )}
              </div>
            )}
            {detail.refundStatus === 'REFUND_FAILED' && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">Refund Failed — Action Required</p>
                  <p className="text-[9px] text-red-300 font-normal mt-0.5">
                    The automatic refund could not complete. Your WLD has NOT been returned yet.
                    Please use Conflict Resolution to escalate to support.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons — context-aware per transaction status */}
            <div className="space-y-2.5 pt-1">

              {/* INITIATED — no WLD sent, offer Cancel */}
              {isInitiated && !cancelDone && (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">No WLD Transferred Yet</p>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1 font-normal leading-relaxed">
                      This transaction was initiated but no WLD has left your wallet. You can cancel it safely.
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="w-full py-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {cancelLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</>
                      : <><AlertCircle className="w-4 h-4" /> Cancel Transaction</>}
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

              {/* PENDING_CONFIRMATION / mid-pipeline stuck — offer Retry + Refund */}
              {(isPendingConfirm || isStuckMidPipeline) && (
                <>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">
                      {isPendingConfirm ? 'Awaiting Blockchain Confirmation' : 'Pipeline Stalled'}
                    </p>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1 font-normal leading-relaxed">
                      {isPendingConfirm
                        ? 'WLD transfer was initiated but the blockchain confirmation is pending. Retry to re-check and continue the pipeline.'
                        : `Reached ${STATUS_LABELS[status!] ?? status} but did not complete. Retry re-kicks the pipeline from this stage.`
                      }
                    </p>
                  </div>
                  {!retryDone ? (
                    <button
                      onClick={handleRetry}
                      disabled={retryLoading}
                      className="w-full py-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {retryLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying Pipeline...</>
                        : <><RotateCcw className="w-4 h-4" /> Retry Pipeline</>}
                    </button>
                  ) : (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-wide">Retry Initiated — Check status in a few minutes</p>
                    </div>
                  )}
                  {retryError && <p className="text-[9px] text-red-400 font-bold text-center">{retryError}</p>}
                </>
              )}

              {/* Refund — for FAILED or stuck where WLD was sent */}
              {canRefund && !refundPolling && !refundDone && (
                <button
                  onClick={handleRefund}
                  disabled={refundLoading}
                  className="w-full py-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {refundLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Refund Request...</>
                    : <><RotateCcw className="w-4 h-4" /> Auto-Refund WLD</>}
                </button>
              )}
              {refundPolling && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-wide">Refund Broadcast — Awaiting On-Chain Confirmation</p>
                    <p className="text-[9px] text-orange-300 font-normal mt-0.5">Do not close this screen. Checking blockchain every 4s...</p>
                  </div>
                </div>
              )}
              {refundDone && (
                <div className="p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wide">Refund Confirmed On-Chain</p>
                    <p className="text-[9px] text-[var(--text-secondary)] font-normal mt-0.5">
                      {detail?.wldAmount ? `${parseFloat(detail.wldAmount).toFixed(4)} WLD` : 'WLD'} transferred back to your wallet.
                    </p>
                  </div>
                </div>
              )}
              {refundError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-[9px] text-red-400 font-bold">{refundError}</p>
                </div>
              )}

              {/* Conflict Resolution Centre — for all non-settled non-initiated */}
              {!isSettled && !isInitiated && (
                <button
                  onClick={handleResolve}
                  className="w-full py-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-[var(--accent)] transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  Conflict Resolution Centre
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">{label}</span>
      <span className={cn(
        'text-right',
        bold ? 'text-sm font-black' : 'text-[10px] font-bold',
        accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
      )}>{value}</span>
    </div>
  );
}

function TimestampRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">{label}</span>
      <span className="text-[9px] font-bold text-[var(--text-primary)] tabular-nums">
        {new Date(value).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short', hour12: true })}
      </span>
    </div>
  );
}
