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
    <div className="flex flex-col min-h-screen items-center bg-white animate-fade-in">
      {/* Success animation */}
      <div className="w-full bg-mpesa-green pt-16 pb-12 flex flex-col items-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
          <CheckCircle2 className="w-12 h-12 text-mpesa-green" />
        </div>
        <h2 className="text-white text-2xl font-bold">Payment Sent!</h2>
        <p className="text-white/80 text-sm mt-1">
          {getSuccessMessage()}
        </p>
      </div>

      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4 w-full max-w-md">
        {/* Amount card */}
        <div className="card text-center py-6">
          <p className="text-4xl font-bold text-gray-900">{formatKes(kes)}</p>
          <p className="text-mpesa-gray-dark text-sm mt-1">sent {getRecipientLabel()}</p>
          {pendingTransaction?.wldAmount && (
            <p className="text-mpesa-green text-sm font-medium mt-2">
              You paid {formatWld(pendingTransaction.wldAmount)}
            </p>
          )}
        </div>

        {/* Receipt details */}
        {transactionStatus?.mpesaReceiptNumber && (
          <div className="card">
            <p className="text-xs font-semibold text-mpesa-gray-dark uppercase tracking-wide mb-2">
              M-Pesa Receipt Number
            </p>
            <p className="text-xl font-bold font-mono text-gray-900">
              {transactionStatus.mpesaReceiptNumber}
            </p>
            <p className="text-xs text-mpesa-gray-dark mt-1">
              Save this for your records
            </p>
          </div>
        )}

        {/* Transaction ID */}
        {pendingTransaction && (
          <div className="card flex items-center justify-between">
            <span className="text-xs text-mpesa-gray-dark">Transaction ID</span>
            <span className="text-xs font-mono text-gray-700">{pendingTransaction.transactionId}</span>
          </div>
        )}

        {/* Settlement time */}
        {transactionStatus?.settledAt && (
          <div className="card flex items-center justify-between">
            <span className="text-xs text-mpesa-gray-dark">Settled at</span>
            <span className="text-xs text-gray-700">
              {new Date(transactionStatus.settledAt).toLocaleTimeString('en-KE')}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Share button */}
        <button
          className="btn-ghost flex items-center justify-center gap-2"
          onClick={() => {
            navigator.share?.({
              title: 'WLD2Mpesa Payment',
              text: `I paid ${formatKes(kes)} ${getRecipientLabel()} using Worldcoin!\nReceipt: ${transactionStatus?.mpesaReceiptNumber ?? 'N/A'}`,
            }).catch(() => { });
          }}
        >
          <Share2 className="w-4 h-4" />
          Share Receipt
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => reset()}>
            <RotateCcw className="w-4 h-4" />
            New
          </button>
          <button className="btn-mpesa flex items-center justify-center gap-2" onClick={() => { window.location.href = '/'; }}>
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
