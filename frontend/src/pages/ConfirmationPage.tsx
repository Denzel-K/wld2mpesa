/**
 * ConfirmationPage.tsx — Review + MiniKit pay() trigger
 *
 * Shows full payment breakdown and triggers native World App
 * confirmation (biometric/PIN) via MiniKit.commandsAsync.pay().
 *
 * Optional: World ID verification before payment.
 */

import { useState } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { confirmPayment } from '@/lib/api';
import { payWithMiniKit, verifyWithWorldId, PAY_ACTION_ID } from '@/lib/minikit';
import { formatKes, formatWld, shortTxId, calculateWldAmount } from '@/lib/utils';
import { ArrowLeft, Shield, ChevronRight, Loader2, AlertCircle, Store, Phone, CreditCard } from 'lucide-react';

export default function ConfirmationPage() {
  const {
    pendingTransaction, kesAmount, tillNumber, phoneNumber, accountNumber, transactionType, rate,
    setScreen, setPendingTransaction,
    addSimLog, setLoading, loading, setError, error,
  } = usePaymentStore();

  const [useWorldId, setUseWorldId] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!pendingTransaction) {
    setScreen('payment-form');
    return null;
  }

  const tx = pendingTransaction;
  const kes = parseFloat(kesAmount) || 0;

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    addSimLog('info', `Starting payment for ${tx.transactionId}`);

    try {
      // Step 1: Optional World ID verification
      let worldIdProof = undefined;
      if (useWorldId) {
        setVerifying(true);
        addSimLog('info', 'Requesting World ID proof…');
        const proof = await verifyWithWorldId(PAY_ACTION_ID, tx.transactionId);
        setVerifying(false);
        if (!proof) {
          setError('World ID verification cancelled or failed');
          addSimLog('error', 'World ID verification failed');
          setLoading(false);
          return;
        }
        worldIdProof = proof;
        addSimLog('success', 'World ID proof obtained');
      }

      // Step 2: MiniKit pay() — triggers native World App confirmation
      setScreen('processing');
      addSimLog('info', `Calling MiniKit pay(): ${formatWld(tx.wldAmount)} → ${tx.payToAddress}`);
      const payResult = await payWithMiniKit(tx.payToAddress, tx.wldAmount, tx.transactionId);

      if (!payResult.success) {
        addSimLog('error', `MiniKit pay() failed: ${payResult.error}`);
        setPendingTransaction(null);
        setScreen('failure');
        setError(payResult.error ?? 'Payment was cancelled');
        setLoading(false);
        return;
      }

      addSimLog('success', `WLD sent! TxHash: ${payResult.txHash}`);

      // Step 3: Notify backend
      addSimLog('info', 'Notifying backend of confirmed payment…');
      const confirmation = await confirmPayment({
        transactionId: tx.transactionId,
        txHash: payResult.txHash ?? '0xSIMULATED',
        miniKitPayload: { ...(payResult.payload as Record<string, unknown>), worldIdProof },
      });

      addSimLog('success', `Backend confirmed: status=${confirmation.status}, ETA ${confirmation.estimatedSettlementMinutes}min`);

      // Go to status polling screen
      setScreen('status');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      addSimLog('error', `Payment error: ${msg}`);
      setError(msg);
      setScreen('failure');
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in">
      {/* Header */}
      <header className="bg-[var(--accent)] px-8 pt-16 pb-12 rounded-b-[4rem] relative overflow-hidden shadow-[0_20px_40px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <button onClick={() => setScreen('payment-form')} className="text-white/70 mb-6 flex items-center gap-2 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Edit</span>
        </button>
        <h2 className="text-white text-3xl font-black font-display tracking-tight">Final Confirmation</h2>
        <p className="text-white/60 text-sm font-medium mt-1 uppercase tracking-wide">Review before broadcasting</p>
      </header>

      <div className="flex-1 px-8 pt-8 pb-32 flex flex-col gap-6">

        {/* Merchant info */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-6 shadow-xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-[var(--accent)]/10 rounded-3xl flex items-center justify-center border border-[var(--accent)]/20 shadow-lg">
              {transactionType === 'send' || transactionType === 'pochi' ? <Phone className="w-8 h-8 text-[var(--accent)]" /> :
                transactionType === 'paybill' ? <CreditCard className="w-8 h-8 text-[var(--accent)]" /> :
                  <Store className="w-8 h-8 text-[var(--accent)]" />}
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-1">Recipient</p>
              <p className="text-2xl font-black text-[var(--text-primary)] font-display tracking-tight">
                {transactionType === 'send' || transactionType === 'pochi' ? phoneNumber :
                  transactionType === 'paybill' ? `${tillNumber} (Acc: ${accountNumber})` :
                    `Till ${tillNumber}`}
              </p>
              <p className="text-[10px] text-[var(--accent)] uppercase tracking-widest font-black mt-1">
                {transactionType === 'send' ? 'M-Pesa Direct' :
                  transactionType === 'pochi' ? 'Pochi la Biashara' :
                    transactionType === 'paybill' ? 'Lipa na M-Pesa Paybill' :
                      'Lipa na M-Pesa Buy Goods'}
              </p>
            </div>
          </div>
        </div>

        {/* Amount breakdown */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] p-8 shadow-xl">
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mb-6">
            Payment Summary
          </p>
          {[
            { label: 'Settlement Amount', value: formatKes(kes), bold: true },
            { label: 'Current Rate', value: `1 WLD = ${rate ? formatKes(rate.wldPriceKes) : '…'}` },
            {
              label: 'Total Fees',
              value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).feeKes),
              breakdown: [
                { label: 'Processing (0.5%)', value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).ourFee) },
                { label: 'Network Cost', value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).safaricomFee) }
              ]
            },
            { label: 'Total Dedicated (WLD)', value: formatWld(tx.wldAmount), bold: true, green: true },
          ].map(({ label, value, bold, green, breakdown }: any) => (
            <div key={label} className="flex flex-col py-4 border-b border-[var(--border-color)]/50 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-tight">{label}</span>
                <span className={`text-sm ${bold ? 'font-black' : 'font-bold'} ${green ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  {value}
                </span>
              </div>
              {breakdown && (
                <div className="flex flex-col gap-3 mt-4 pl-4 border-l-2 border-[var(--accent)]/30">
                  {breakdown.map((b: any) => (
                    <div key={b.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">{b.label}</span>
                      <span className="text-[10px] font-black text-[var(--text-primary)]">{b.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reference */}
        <div className="card bg-[var(--bg-secondary)] border-[var(--border-color)] flex items-center justify-between p-6 opacity-60">
          <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em]">Transaction Reference</span>
          <span className="text-[10px] font-black text-[var(--text-primary)] font-mono tracking-widest">{shortTxId(tx.transactionId)}</span>
        </div>

        {/* World ID option */}
        <button
          onClick={() => setUseWorldId((v) => !v)}
          className={`card bg-[var(--bg-secondary)] border-[var(--border-color)] flex items-center gap-5 w-full text-left transition-all p-6 shadow-xl relative overflow-hidden ${useWorldId ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/5' : ''
            }`}
        >
          {useWorldId && <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)]/10 to-transparent" />}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${useWorldId ? 'bg-[var(--accent)] shadow-[0_0_20px_var(--accent-glow)]' : 'bg-[var(--accent)]/10 border border-[var(--accent)]/20 shadow-lg'
            }`}>
            <Shield className={`w-6 h-6 ${useWorldId ? 'text-white' : 'text-[var(--accent)]'}`} />
          </div>
          <div className="flex-1 relative z-10">
            <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">World ID Verification</p>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter mt-1">Optional Proof of Personhood</p>
          </div>
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${useWorldId ? 'border-transparent bg-[var(--accent)]' : 'border-[var(--border-color)]'
            }`}>
            {useWorldId && <span className="text-white text-xs font-black">✓</span>}
          </div>
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-[2rem] shadow-lg animate-shake">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-400 font-black uppercase tracking-wider">{error}</p>
          </div>
        )}

        <div className="flex-1" />

        {/* Pay button */}
        <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pt-16 z-50">
          <button
            className="btn-mpesa py-6 shadow-[0_20px_40px_var(--accent-glow)] h-20 group"
            onClick={handlePay}
            disabled={loading}
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-4">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-xl font-black">VERIFYING...</span>
              </span>
            ) : loading ? (
              <span className="flex items-center justify-center gap-4">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span className="text-xl font-black">CONFIRMING...</span>
              </span>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-xl font-black">PAY {formatWld(tx.wldAmount)}</span>
                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-500" />
              </div>
            )}
          </button>
        </div>

        <p className="text-center text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-24 opacity-40">
          SECURED BY WORLD APP NATIVE SDK
        </p>
      </div>
    </div>
  );
}
