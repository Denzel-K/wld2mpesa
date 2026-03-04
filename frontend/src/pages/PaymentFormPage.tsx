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
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in">
      {/* Premium Header */}
      <header className="px-8 pt-16 pb-8 flex items-center justify-between bg-[var(--bg-primary)]/80 backdrop-blur-2xl sticky top-0 z-50 border-b border-[var(--border-color)]">
        <button
          onClick={() => step === 'amount' ? setScreen('home') : setStep(step === 'details' ? 'amount' : 'details')}
          className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)] transition-all border border-[var(--border-color)] active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">{getStepTitle()}</h2>
          <div className="flex gap-2 mt-1">
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'amount' ? "w-8 bg-[var(--accent)]" : "w-2 bg-[var(--text-secondary)]/20")} />
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'details' ? "w-8 bg-[var(--accent)]" : "w-2 bg-[var(--text-secondary)]/20")} />
            <div className={cn("h-1 rounded-full transition-all duration-500", step === 'confirm' ? "w-8 bg-[var(--accent)]" : "w-2 bg-[var(--text-secondary)]/20")} />
          </div>
        </div>
        <div className="w-12" /> {/* Spacer */}
      </header>

      <div className="flex-1 px-8 pt-8 pb-32 flex flex-col relative overflow-hidden">

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="animate-slide-up">
            <h1 className="text-4xl font-black font-display text-[var(--text-primary)] mb-4 tracking-tight">How much?</h1>
            <p className="text-[var(--text-secondary)] text-lg mb-10 font-medium">Enter the amount you want to transfer.</p>

            <div className="relative mb-12">
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-4xl font-black text-[var(--accent)] font-display tracking-tight">KSh</span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={kesAmount}
                  onChange={(e) => setKesAmount(e.target.value)}
                  className="w-full bg-transparent text-7xl font-black font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/10"
                />
              </div>

              {conversion && (
                <div className="flex items-center gap-4 p-5 bg-[var(--accent)]/5 rounded-[2rem] border border-[var(--accent)]/20 animate-scale-in">
                  <div className="w-10 h-10 bg-[var(--accent)] rounded-2xl flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[var(--accent)] uppercase tracking-wider">
                      ≈ {formatWld(conversion.wldAmount)}
                    </p>
                    <p className="text-[10px] text-[var(--accent)]/60 font-black uppercase tracking-tighter">Incl. 0.5% + M-Pesa fees</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
              {[500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setKesAmount(String(amt))}
                  className={cn(
                    "py-5 rounded-3xl text-sm font-black transition-all border font-display tracking-wide",
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
            <h1 className="text-4xl font-black font-display text-[var(--text-primary)] mb-4 tracking-tight">Who to?</h1>
            <p className="text-[var(--text-secondary)] text-lg mb-10 font-medium">Enter the recipient's details.</p>

            <div className="space-y-6 mb-10">
              <div className="flex items-center gap-5 p-6 bg-[var(--bg-secondary)] rounded-[2.5rem] border border-[var(--border-color)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-primary)] transition-all shadow-xl">
                {transactionType === 'paybill' || transactionType === 'till' ? <Store className="w-8 h-8 text-[var(--text-secondary)]" /> : <Phone className="w-8 h-8 text-[var(--text-secondary)]" />}
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
                  className="w-full bg-transparent text-3xl font-black font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/20"
                />
              </div>

              {transactionType === 'paybill' && (
                <div className="flex items-center gap-5 p-6 bg-[var(--bg-secondary)] rounded-[2.5rem] border border-[var(--border-color)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-primary)] transition-all shadow-xl">
                  <User className="w-8 h-8 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-transparent text-3xl font-black font-display text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/20"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="animate-slide-up">
            <h1 className="text-4xl font-black font-display text-[var(--text-primary)] mb-4 tracking-tight">Review</h1>
            <p className="text-[var(--text-secondary)] text-lg mb-10 font-medium">Check all details before proceeding.</p>

            <div className="card p-0 overflow-hidden mb-8 border-[var(--border-color)] shadow-2xl">
              <div className="bg-[var(--accent)] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2 relative z-10">Total to Pay</p>
                <div className="flex items-baseline gap-3 relative z-10">
                  <h2 className="text-5xl font-black font-display tracking-tight">{formatWld(conversion?.wldAmount || 0)}</h2>
                </div>
              </div>

              <div className="p-8 space-y-6 bg-[var(--card-bg)]">
                <div className="flex justify-between items-center pb-6 border-b border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Recipient Receives</span>
                  <span className="text-lg font-black text-[var(--text-primary)] font-display">{formatCurrency(kes, 'KES')}</span>
                </div>

                {transactionType === 'paybill' && (
                  <>
                    <div className="flex justify-between items-center pb-6 border-b border-[var(--border-color)]">
                      <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Business Number</span>
                      <span className="text-lg font-black text-[var(--text-primary)] font-display">{tillNumber}</span>
                    </div>
                    <div className="flex justify-between items-center pb-6 border-b border-[var(--border-color)]">
                      <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Account No</span>
                      <span className="text-lg font-black text-[var(--text-primary)] font-display">{accountNumber}</span>
                    </div>
                  </>
                )}

                {transactionType === 'till' && (
                  <div className="flex justify-between items-center pb-6 border-b border-[var(--border-color)]">
                    <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Till Number</span>
                    <span className="text-lg font-black text-[var(--text-primary)] font-display">{tillNumber}</span>
                  </div>
                )}

                {(transactionType === 'send' || transactionType === 'pochi') && (
                  <div className="flex justify-between items-center pb-6 border-b border-[var(--border-color)]">
                    <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Phone Number</span>
                    <span className="text-lg font-black text-[var(--text-primary)] font-display">{phoneNumber}</span>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-[var(--text-secondary)] font-black uppercase tracking-wider">Total Fees</span>
                    <span className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(conversion?.feeKes || 0, 'KES')}</span>
                  </div>
                  <div className="flex flex-col gap-3 pl-4 border-l-2 border-[var(--accent)]/30">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">Service Fee (0.5%)</span>
                      <span className="text-[10px] font-black text-[var(--text-primary)]">{formatCurrency(conversion?.ourFee || 0, 'KES')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">Network Cost</span>
                      <span className="text-[10px] font-black text-orange-500 uppercase">{formatCurrency(conversion?.safaricomFee || 0, 'KES')}</span>
                    </div>
                  </div>
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
        <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pt-16 z-50">
          <button
            className={cn(
              "btn-mpesa w-full h-20 shadow-[0_20px_40px_var(--accent-glow)] group",
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
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-xl font-black">
                  {step === 'amount' ? 'Continue' : step === 'details' ? 'Review Details' : 'Initialize Transfer'}
                </span>
                <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-500" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
