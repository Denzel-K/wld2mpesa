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
  getFeeForAmount,
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

type Step = 'details' | 'amount' | 'confirm';

export default function PaymentFormPage() {
  const {
    rate, kesAmount, tillNumber, phoneNumber, accountNumber, transactionType,
    setKesAmount, setTillNumber, setPhoneNumber, setAccountNumber,
    setScreen, setPendingTransaction,
    addSimLog, loading, setLoading, setError, error,
    walletAddress,
  } = usePaymentStore();

  const [step, setStep] = useState<Step>('details');
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

  // Live conversion (uses tiered fee based on amount)
  const conversion = rate && kes > 0
    ? calculateWldAmount(kes, rate.wldPriceKes)
    : null;

  useEffect(() => { setLocalError(null); }, [kesAmount, tillNumber, step, phoneNumber, accountNumber]);

  const handleNext = async () => {
    if (step === 'details') {
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
      setStep('amount');
    } else if (step === 'amount') {
      if (!isValidKesAmount(kes)) {
        setLocalError('Enter an amount between KSh 10 and KSh 150,000');
        return;
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
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in">
      {/* Premium Header */}
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-[var(--bg-primary)]/80 backdrop-blur-2xl sticky top-0 z-50 border-b border-[var(--border-color)]">
        <button
          onClick={() => step === 'details' ? setScreen('home') : setStep(step === 'amount' ? 'details' : 'amount')}
          className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)] transition-all border border-[var(--border-color)] active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">{getStepTitle()}</h2>
          <div className="flex gap-1.5 mt-1">
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'details' ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--text-secondary)]/20")} />
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'amount' ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--text-secondary)]/20")} />
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'confirm' ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--text-secondary)]/20")} />
          </div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <div className="flex-1 px-6 pt-8 pb-24 flex flex-col relative overflow-hidden">

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold font-display text-[var(--text-primary)] mb-2 tracking-tight">How much?</h1>
            <p className="text-[var(--text-secondary)] text-sm mb-6 font-normal">Enter the amount you want to transfer.</p>

            <div className="relative mb-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-2xl font-bold text-[var(--accent)] font-display tracking-tight">KSh</span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={kesAmount}
                  onChange={(e) => setKesAmount(e.target.value)}
                  className="w-full bg-transparent text-4xl font-bold font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/10"
                />
              </div>

              {conversion && (
                <div className="flex items-center gap-4 p-4 bg-[var(--accent)]/5 rounded-2xl border border-[var(--accent)]/20 animate-scale-in">
                  <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--accent)] uppercase tracking-wider">
                      ≈ {formatWld(conversion.wldAmount)}
                    </p>
                    <p className="text-[9px] text-[var(--accent)]/60 font-bold uppercase tracking-tighter">Incl. {conversion?.feePercent ?? getFeeForAmount(kes)}% service + M-Pesa fees</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {[500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setKesAmount(String(amt))}
                  className={cn(
                    "py-4 rounded-xl text-xs font-bold transition-all border font-display tracking-wide",
                    kes === amt
                      ? "bg-[var(--accent)] text-white border-transparent shadow-[0_10px_20px_var(--accent-glow)] scale-[1.02]"
                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]/50"
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
            <h1 className="text-2xl font-bold font-display text-[var(--text-primary)] mb-2 tracking-tight">Who to?</h1>
            <p className="text-[var(--text-secondary)] text-sm mb-6 font-normal">Enter the recipient's details.</p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-primary)] transition-all shadow-lg">
                {transactionType === 'paybill' || transactionType === 'till' ? <Store className="w-7 h-7 text-[var(--text-secondary)]" /> : <Phone className="w-7 h-7 text-[var(--text-secondary)]" />}
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
                  className="w-full bg-transparent text-xl font-bold font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/20"
                />
              </div>

              {transactionType === 'paybill' && (
                <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-primary)] transition-all shadow-lg">
                  <User className="w-7 h-7 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-transparent text-xl font-bold font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/20"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold font-display text-[var(--text-primary)] mb-2 tracking-tight">Review</h1>
            <p className="text-[var(--text-secondary)] text-sm mb-6 font-normal">Check all details before proceeding.</p>

            <div className="card p-0 overflow-hidden mb-6 border-[var(--border-color)] shadow-xl">
              <div className="bg-[var(--accent)] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/60 mb-1.5 relative z-10">Total to Pay</p>
                <div className="flex items-baseline gap-2 relative z-10">
                  <h2 className="text-3xl font-bold font-display tracking-tight">{formatWld(conversion?.wldAmount || 0)}</h2>
                </div>
              </div>

              <div className="p-6 space-y-4 bg-[var(--card-bg)]">
                <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Recipient Receives</span>
                  <span className="text-base font-bold text-[var(--text-primary)] font-display">{formatCurrency(kes, 'KES')}</span>
                </div>

                {transactionType === 'paybill' && (
                  <>
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Business Number</span>
                      <span className="text-base font-bold text-[var(--text-primary)] font-display">{tillNumber}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Account No</span>
                      <span className="text-base font-bold text-[var(--text-primary)] font-display">{accountNumber}</span>
                    </div>
                  </>
                )}

                {transactionType === 'till' && (
                  <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Till Number</span>
                    <span className="text-base font-bold text-[var(--text-primary)] font-display">{tillNumber}</span>
                  </div>
                )}

                {(transactionType === 'send' || transactionType === 'pochi') && (
                  <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Phone Number</span>
                    <span className="text-base font-bold text-[var(--text-primary)] font-display">{phoneNumber}</span>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Total Fees</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {formatCurrency((conversion?.ourFee || 0) + (conversion?.safaricomFee || 0), 'KES')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pl-3 border-l-2 border-[var(--accent)]/30">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-tighter">Service Fee ({conversion?.feePercent ?? getFeeForAmount(kes)}%)</span>
                      <span className="text-[9px] font-bold text-[var(--text-primary)]">{formatCurrency(conversion?.ourFee || 0, 'KES')}</span>
                    </div>
                    {(conversion?.safaricomFee || 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-tighter">M-Pesa Network Fee</span>
                        <span className="text-[9px] font-bold text-[var(--text-primary)]">{formatCurrency(conversion?.safaricomFee || 0, 'KES')}</span>
                      </div>
                    )}
                  </div>
                  {rate && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-between items-center">
                      <span className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-tighter">Exchange Rate</span>
                      <span className="text-[9px] font-bold text-[var(--text-secondary)]">1 WLD = {formatCurrency(rate.wldPriceKes, 'KES')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-[var(--accent)]/5 rounded-[2rem] border border-[var(--accent)]/20 shadow-xl">
              <div className="bg-[var(--accent)]/10 p-2 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-[var(--accent)]" />
              </div>
              <p className="text-[10px] text-[var(--text-primary)] font-black uppercase tracking-wider leading-relaxed">
                Secured by World Chain. Funds released only after on-chain verification.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {displayError && (
          <div className="mt-6 flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-[2rem] animate-shake shadow-lg">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-400 font-black uppercase tracking-wider">{displayError}</p>
          </div>
        )}

        {/* Sticky Action Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pt-12 z-50">
          <button
            className={cn(
              "btn-mpesa w-full h-16 shadow-[0_15px_30px_var(--accent-glow)] group",
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
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold uppercase tracking-widest">
                  {step === 'details' ? 'Continue' : step === 'amount' ? 'Review Details' : 'Initialize Transfer'}
                </span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-500" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
