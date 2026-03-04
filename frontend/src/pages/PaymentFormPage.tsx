/**
 * PaymentFormPage.tsx — Premium Stepwise Transaction Flow
 */

import { useState, useEffect, useRef } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { initiatePayment } from '@/lib/api';
import {
  formatCurrency,
  formatWld,
  calculateWldAmount,
  isValidTillNumber,
  isValidKesAmount,
  cn,
} from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Zap,
  Phone,
  Store,
  User
} from 'lucide-react';

const FEE_PERCENT = 0.5;

type Step = 'amount' | 'details' | 'confirm';

export default function PaymentFormPage() {
  const {
    rate, kesAmount, tillNumber, phoneNumber, accountNumber, transactionType,
    setKesAmount, setTillNumber, setPhoneNumber, setAccountNumber,
    setScreen, setPendingTransaction,
    addSimLog, loading, setLoading, setError, error,
    walletAddress,
  } = usePaymentStore();

  const [step, setStep] = useState<Step>('amount');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getStepTitle = () => {
    switch (transactionType) {
      case 'send': return 'Send Money';
      case 'pochi': return 'Pochi la Biashara';
      case 'paybill': return 'Paybill';
      default: return 'Buy Goods';
    }
  };

  const getDetailsPlaceholder = () => {
    switch (transactionType) {
      case 'send': return 'Recipient Phone Number';
      case 'pochi': return 'Business Phone Number';
      case 'paybill': return 'Business Number (Paybill)';
      default: return 'Till Number';
    }
  };

  // Focus input on step change
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [step]);

  // Parse numeric KES value
  const kes = parseFloat(kesAmount.replace(/,/g, '')) || 0;

  // Live conversion
  const conversion = rate && kes > 0
    ? calculateWldAmount(kes, rate.wldPriceKes, FEE_PERCENT)
    : null;

  useEffect(() => { setLocalError(null); }, [kesAmount, tillNumber, step, phoneNumber, accountNumber]);

  const handleNext = async () => {
    if (step === 'amount') {
      if (!isValidKesAmount(kes)) {
        setLocalError('Enter an amount between KSh 10 and KSh 150,000');
        return;
      }
      setStep('details');
    } else if (step === 'details') {
      if (transactionType === 'paybill') {
        if (!/^\d{5,7}$/.test(tillNumber)) {
          setLocalError('Paybill must be 5–7 digits');
          return;
        }
        if (!accountNumber) {
          setLocalError('Account number is required');
          return;
        }
      } else if (transactionType === 'send' || transactionType === 'pochi') {
        if (!/^(\+254|0)[17]\d{8}$/.test(phoneNumber)) {
          setLocalError('Enter a valid M-Pesa phone number');
          return;
        }
      } else {
        if (!isValidTillNumber(tillNumber)) {
          setLocalError('Till number must be 5–6 digits');
          return;
        }
      }
      setStep('confirm');
    } else {
      handleInitiate();
    }
  };

  const handleInitiate = async () => {
    if (!rate) {
      setLocalError('Rate not loaded — please wait');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      addSimLog('info', `Initiating ${transactionType}: KES ${kes}`);
      const tx = await initiatePayment({
        kesAmount: kes,
        transactionType,
        tillNumber: transactionType === 'paybill' || transactionType === 'till' ? tillNumber.trim() : undefined,
        phoneNumber: transactionType === 'send' || transactionType === 'pochi' ? phoneNumber.trim() : undefined,
        accountNumber: transactionType === 'paybill' ? accountNumber.trim() : undefined,
        walletAddress: walletAddress || '0xUNKNOWN',
      });
      setPendingTransaction(tx);
      addSimLog('success', `Transaction created: ${tx.transactionId}`);
      setScreen('confirmation');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate payment';
      setLocalError(msg);
      setStep('details'); // Go back to details to fix if error
      addSimLog('error', `Initiation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="flex flex-col min-h-screen bg-white animate-fade-in">
      {/* Premium Header */}
      <header className="px-6 pt-12 pb-6 flex items-center justify-between">
        <button
          onClick={() => step === 'amount' ? setScreen('home') : setStep(step === 'details' ? 'amount' : 'details')}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-sm font-800 font-display text-gray-800">{getStepTitle()}</h2>
          <div className="flex gap-1 mt-1">
            <div className={cn("step-dot", step === 'amount' ? "w-4 bg-mpesa-green" : "bg-gray-200")} />
            <div className={cn("step-dot", step === 'details' ? "w-4 bg-mpesa-green" : "bg-gray-200")} />
            <div className={cn("step-dot", step === 'confirm' ? "w-4 bg-mpesa-green" : "bg-gray-200")} />
          </div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <div className="flex-1 px-6 pt-4 pb-24 flex flex-col relative overflow-hidden">

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-800 font-display text-gray-900 mb-2">How much?</h1>
            <p className="text-gray-400 text-sm mb-8">Enter the amount you want to transfer.</p>

            <div className="relative mb-8">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-800 text-mpesa-green font-display">KSh</span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={kesAmount}
                  onChange={(e) => setKesAmount(e.target.value)}
                  className="w-full bg-transparent text-6xl font-800 font-display text-gray-900 focus:outline-none placeholder:text-gray-100"
                />
              </div>

              {conversion && (
                <div className="flex items-center gap-2 p-3 bg-mpesa-green-soft rounded-2xl animate-scale-in">
                  <div className="w-6 h-6 bg-mpesa-green rounded-full flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs font-bold text-mpesa-green">
                    ≈ {formatWld(conversion.wldAmount)}
                  </p>
                  <span className="text-[10px] text-mpesa-green/60 font-medium">Incl. 0.5% + M-Pesa fees</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-8">
              {[100, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setKesAmount(String(amt))}
                  className={cn(
                    "py-3 rounded-2xl text-xs font-bold transition-all border",
                    kes === amt
                      ? "bg-mpesa-green text-white border-mpesa-green shadow-button"
                      : "bg-white text-gray-500 border-gray-100 hover:border-mpesa-green/30"
                  )}
                >
                  {formatCurrency(amt, 'KES')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-800 font-display text-gray-900 mb-2">Who to?</h1>
            <p className="text-gray-400 text-sm mb-8">Enter the recipient's details.</p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-[2rem] border border-gray-100 focus-within:border-mpesa-green focus-within:bg-white transition-all">
                {transactionType === 'paybill' || transactionType === 'till' ? <Store className="w-6 h-6 text-gray-400" /> : <Phone className="w-6 h-6 text-gray-400" />}
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  placeholder={getDetailsPlaceholder()}
                  value={transactionType === 'send' || transactionType === 'pochi' ? phoneNumber : tillNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (transactionType === 'send' || transactionType === 'pochi') {
                      setPhoneNumber(val.slice(0, 12));
                    } else {
                      setTillNumber(val.slice(0, 7));
                    }
                  }}
                  className="w-full bg-transparent text-2xl font-800 font-display text-gray-900 focus:outline-none placeholder:text-gray-200"
                />
              </div>

              {transactionType === 'paybill' && (
                <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-[2rem] border border-gray-100 focus-within:border-mpesa-green focus-within:bg-white transition-all">
                  <User className="w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-transparent text-2xl font-800 font-display text-gray-900 focus:outline-none placeholder:text-gray-200"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-800 font-display text-gray-900 mb-2">Review</h1>
            <p className="text-gray-400 text-sm mb-8">Check all details before proceeding.</p>

            <div className="card shadow-lg p-0 overflow-hidden mb-8 border-gray-50">
              <div className="bg-mpesa-green p-6 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Total to Pay</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-800 font-display">{formatWld(conversion?.wldAmount || 0)}</h2>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-xs text-gray-400 font-medium">Recipient Receives</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(kes, 'KES')}</span>
                </div>

                {transactionType === 'paybill' && (
                  <>
                    <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                      <span className="text-xs text-gray-400 font-medium">Business Number</span>
                      <span className="text-sm font-bold text-gray-800">{tillNumber}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                      <span className="text-xs text-gray-400 font-medium">Account No</span>
                      <span className="text-sm font-bold text-gray-800">{accountNumber}</span>
                    </div>
                  </>
                )}

                {transactionType === 'till' && (
                  <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                    <span className="text-xs text-gray-400 font-medium">Till Number</span>
                    <span className="text-sm font-bold text-gray-800">{tillNumber}</span>
                  </div>
                )}

                {(transactionType === 'send' || transactionType === 'pochi') && (
                  <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                    <span className="text-xs text-gray-400 font-medium">Phone Number</span>
                    <span className="text-sm font-bold text-gray-800">{phoneNumber}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-xs text-gray-400 font-medium">Transaction Type</span>
                  <span className="text-xs font-bold text-mpesa-green uppercase">{transactionType}</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 font-medium">Total Fees</span>
                    <span className="text-sm font-bold text-gray-800">{formatCurrency(conversion?.feeKes || 0, 'KES')}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-mpesa-green/20">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-400">Service Fee (0.5%)</span>
                      <span className="text-[10px] font-bold text-gray-500">{formatCurrency(conversion?.ourFee || 0, 'KES')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-400">Safaricom Cost</span>
                      <span className="text-[10px] font-bold text-orange-400">{formatCurrency(conversion?.safaricomFee || 0, 'KES')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                Your payment is secured by World Chain. Funds are released to the merchant only after on-chain confirmation.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {displayError && (
          <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">{displayError}</p>
          </div>
        )}

        {/* Sticky Action Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white z-50">
          <button
            className={cn(
              "btn-mpesa w-full h-16 shadow-2xl group",
              loading && "opacity-80"
            )}
            onClick={handleNext}
            disabled={
              loading ||
              (step === 'amount' && !kesAmount) ||
              (step === 'details' && (
                (transactionType === 'send' || transactionType === 'pochi') ? !phoneNumber : !tillNumber
              ))
            }
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <span className="font-800">
                  {step === 'amount' ? 'Next' : step === 'details' ? 'Next' : 'Confirm & Pay'}
                </span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
