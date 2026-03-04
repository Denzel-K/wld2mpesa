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
import { payWithMiniKit, verifyWithWorldId } from '@/lib/minikit';
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
        const proof = await verifyWithWorldId('wld2mpesa-pay', tx.transactionId);
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
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <header className="bg-mpesa-green px-4 pt-10 pb-6">
        <button onClick={() => setScreen('payment-form')} className="text-white/80 mb-4 flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <h2 className="text-white text-xl font-bold">Confirm Payment</h2>
        <p className="text-white/70 text-sm">Review before confirming with World App</p>
      </header>

      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4">

        {/* Merchant info */}
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-mpesa-green-light rounded-full flex items-center justify-center">
              {transactionType === 'send' || transactionType === 'pochi' ? <Phone className="w-6 h-6 text-mpesa-green" /> :
                transactionType === 'paybill' ? <CreditCard className="w-6 h-6 text-mpesa-green" /> :
                  <Store className="w-6 h-6 text-mpesa-green" />}
            </div>
            <div>
              <p className="text-xs text-mpesa-gray-dark font-medium">Paying to</p>
              <p className="text-lg font-bold text-gray-900">
                {transactionType === 'send' || transactionType === 'pochi' ? phoneNumber :
                  transactionType === 'paybill' ? `${tillNumber} (Acc: ${accountNumber})` :
                    `Till ${tillNumber}`}
              </p>
              <p className="text-xs text-mpesa-gray-dark uppercase tracking-wider font-bold">
                {transactionType === 'send' ? 'M-Pesa Send Money' :
                  transactionType === 'pochi' ? 'Pochi la Biashara' :
                    transactionType === 'paybill' ? 'Lipa na M-Pesa Paybill' :
                      'Lipa na M-Pesa Buy Goods'}
              </p>
            </div>
          </div>
        </div>

        {/* Amount breakdown */}
        <div className="card">
          <p className="text-xs font-semibold text-mpesa-gray-dark uppercase tracking-wide mb-3">
            Breakdown
          </p>
          {[
            { label: (transactionType === 'send' || transactionType === 'pochi') ? 'Recipient receives' : 'Business receives', value: formatKes(kes), bold: true },
            { label: 'Rate', value: `1 WLD = ${rate ? formatKes(rate.wldPriceKes) : '…'}` },
            {
              label: 'Fees',
              value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).feeKes),
              breakdown: [
                { label: 'Service Fee (0.5%)', value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).ourFee) },
                { label: 'Safaricom Cost', value: formatKes(calculateWldAmount(kes, rate?.wldPriceKes || 1).safaricomFee) }
              ]
            },
            { label: 'You pay (WLD)', value: formatWld(tx.wldAmount), bold: true, green: true },
          ].map(({ label, value, bold, green, breakdown }: any) => (
            <div key={label} className="flex flex-col py-2 border-b border-mpesa-gray-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mpesa-gray-dark">{label}</span>
                <span className={`text-sm ${bold ? 'font-bold' : ''} ${green ? 'text-mpesa-green' : 'text-gray-800'}`}>
                  {value}
                </span>
              </div>
              {breakdown && (
                <div className="flex flex-col gap-1 mt-1 pl-4 border-l-2 border-mpesa-green-light">
                  {breakdown.map((b: any) => (
                    <div key={b.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-mpesa-gray-dark">{b.label}</span>
                      <span className="text-[10px] font-semibold text-gray-500">{b.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Transaction ID */}
        <div className="card flex items-center justify-between">
          <span className="text-xs text-mpesa-gray-dark">Reference</span>
          <span className="text-xs font-mono text-gray-700">{shortTxId(tx.transactionId)}</span>
        </div>

        {/* World ID option */}
        <button
          onClick={() => setUseWorldId((v) => !v)}
          className={`card flex items-center gap-3 w-full text-left transition-all ${useWorldId ? 'ring-2 ring-mpesa-green' : ''
            }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${useWorldId ? 'bg-mpesa-green' : 'bg-mpesa-green-light'
            }`}>
            <Shield className={`w-5 h-5 ${useWorldId ? 'text-white' : 'text-mpesa-green'}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Verify with World ID</p>
            <p className="text-xs text-mpesa-gray-dark">Optional — prove you're a unique human</p>
          </div>
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${useWorldId ? 'border-mpesa-green bg-mpesa-green' : 'border-mpesa-gray-border'
            }`}>
            {useWorldId && <span className="text-white text-xs font-bold">✓</span>}
          </div>
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex-1" />

        {/* Pay button */}
        <button
          className="btn-mpesa"
          onClick={handlePay}
          disabled={loading}
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Verifying World ID…
            </span>
          ) : loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Confirming…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Pay {formatWld(tx.wldAmount)}
              <ChevronRight className="w-5 h-5" />
            </span>
          )}
        </button>

        <p className="text-center text-xs text-mpesa-gray-dark">
          Your World App PIN / biometric will be requested
        </p>
      </div>
    </div>
  );
}
