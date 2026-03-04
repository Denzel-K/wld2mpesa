/**
 * HomePage.tsx — Landing screen (Premium Redesign)
 */

import { useState, useEffect } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, convertKesTo, cn } from '@/lib/utils';
import { fetchTransactionHistory } from '@/lib/api';
import {
  Loader2,
  Send,
  Store,
  CreditCard,
  User,
  ChevronRight,
  TrendingUp,
  Shield,
  Zap,
  History
} from 'lucide-react';
import CurrencySelector from '@/components/CurrencySelector';

const ACTIONS = [
  { id: 'send', label: 'Send Money', icon: Send, sub: 'To M-Pesa Number', color: 'bg-mpesa-green' },
  { id: 'pochi', label: 'Pochi la Biashara', icon: User, sub: 'Small Business', color: 'bg-orange-500' },
  { id: 'till', label: 'Till Number', icon: Store, sub: 'Buy Goods', color: 'bg-mpesa-green-dark' },
  { id: 'paybill', label: 'Paybill', icon: CreditCard, sub: 'Bills & Utilities', color: 'bg-blue-600' },
];

export default function HomePage() {
  const {
    rate, rateLoading, rateError,
    setScreen, toggleDevMode, devMode,
    selectedCurrency, setTransactionType,
    walletAddress
  } = usePaymentStore();

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      setHistoryLoading(true);
      fetchTransactionHistory(walletAddress)
        .then(setHistory)
        .catch(console.error)
        .finally(() => setHistoryLoading(false));
    }
  }, [walletAddress]);

  const handleAction = (id: string) => {
    setTransactionType(id as any);
    setScreen('payment-form');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 animate-fade-in pb-32">
      {/* Premium Header */}
      <header className="bg-mpesa-green px-6 pt-12 pb-20 rounded-b-[3rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
              Global Fintech
            </span>
            <h1 className="text-white text-2xl font-800 font-display">WLD2Mpesa</h1>
          </div>
          <button
            onClick={toggleDevMode}
            className="bg-white/10 hover:bg-white/20 text-white/80 text-[10px] px-3 py-1.5 rounded-full border border-white/20 transition-all font-bold"
          >
            {devMode ? '• SIMULATION ACTIVE' : 'DEV MODE'}
          </button>
        </div>

        {/* Balance Card (WLD + Selected Currency) */}
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-1">Your Balance</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-white text-4xl font-800 font-display tracking-tight">
              {rate && !rateLoading ? (
                <span>{convertKesTo(1000, selectedCurrency).toFixed(2)}</span>
              ) : '0.00'}
            </h2>
            <span className="text-white/80 font-bold text-lg">{selectedCurrency}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="px-2 py-0.5 bg-white/20 rounded-full text-white text-[10px] font-bold">
              ≈ {rate ? (1000 / rate.wldPriceKes).toFixed(4) : '0.0000'} WLD
            </div>
          </div>
        </div>
      </header>

      {/* Action Grid */}
      <div className="px-6 -mt-12 relative z-20">
        <div className="card glass grid grid-cols-2 gap-4 p-4 shadow-xl mb-6">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="group flex flex-col items-center p-4 rounded-2xl hover:bg-white transition-all duration-300 active:scale-95 border border-transparent hover:border-gray-100"
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform text-white",
                action.color
              )}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-800">{action.label}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{action.sub}</span>
            </button>
          ))}
        </div>

        {/* Currency & Rates Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-gray-800">Exchange Rates</h3>
            <span className="text-[10px] font-bold text-mpesa-green bg-mpesa-green-light px-2 py-0.5 rounded-full">LIVE</span>
          </div>

          <div className="card space-y-4 shadow-sm border-gray-100">
            <CurrencySelector />

            {rateLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Syncing with World Chain...</span>
              </div>
            ) : rateError ? (
              <div className="p-3 bg-red-50 text-red-500 rounded-xl text-xs font-medium text-center">
                {rateError}
              </div>
            ) : rate ? (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-mpesa-green-soft rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-mpesa-green" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Current WLD Price</p>
                    <p className="text-sm font-bold text-gray-800">
                      1 WLD = {formatCurrency(rate.wldPriceKes, selectedCurrency)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Source</p>
                  <p className="text-[10px] font-bold text-mpesa-green">{rate.source}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Security & Speed Trust Markers */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm opacity-60">
            <Shield className="w-6 h-6 text-mpesa-green" />
            <div>
              <p className="text-[10px] font-bold text-gray-800">Secure</p>
              <p className="text-[8px] text-gray-400">World ID Verified</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm opacity-60">
            <Zap className="w-6 h-6 text-orange-400" />
            <div>
              <p className="text-[10px] font-bold text-gray-800">Instant</p>
              <p className="text-[8px] text-gray-400">&lt; 3m Settlement</p>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="mt-10 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Transaction History</h3>
            <div className="flex bg-gray-200/50 p-1 rounded-lg">
              {['Day', 'Week', 'Month', 'Year'].map((f) => (
                <button
                  key={f}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-md font-bold transition-all",
                    f === 'Week' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[10px] font-bold">Syncing Ledger...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-3 grayscale">
                <History className="w-8 h-8" />
                <p className="text-[10px] font-bold">No transactions found</p>
              </div>
            ) : (
              history.map((tx) => (
                <div
                  key={tx.transactionId}
                  className="card flex items-center gap-4 hover:bg-white transition-colors cursor-pointer border-gray-50 shadow-sm"
                  onClick={() => {
                    // Could show tx details modal
                  }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                    tx.transactionType === 'paybill' ? 'bg-blue-600' :
                      tx.transactionType === 'send' ? 'bg-mpesa-green' :
                        tx.transactionType === 'till' ? 'bg-mpesa-green-dark' : 'bg-orange-500'
                  )}>
                    {tx.transactionType === 'paybill' ? <CreditCard className="w-5 h-5" /> :
                      tx.transactionType === 'send' ? <Send className="w-5 h-5" /> :
                        tx.transactionType === 'till' ? <Store className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">
                      {tx.transactionType === 'paybill' && `Bill: ${tx.accountNumber || 'Unknown'}`}
                      {tx.transactionType === 'send' && `Pochi: ${tx.phoneNumber || 'Unknown'}`}
                      {tx.transactionType === 'till' && `Buy Goods: ${tx.tillNumber || 'Unknown'}`}
                      {tx.transactionType === 'pochi' && `Pochi: ${tx.phoneNumber || 'Unknown'}`}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {new Date(tx.steps?.[0]?.timestamp || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-800">-{formatCurrency(tx.kesAmount, selectedCurrency)}</p>
                    <p className={cn(
                      "text-[10px] font-bold",
                      tx.status === 'SETTLED' ? "text-mpesa-green" :
                        tx.status === 'FAILED' ? "text-red-500" : "text-orange-400"
                    )}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-12 z-50">
        <button
          className="btn-mpesa w-full py-5 shadow-2xl h-16 group"
          onClick={() => setScreen('payment-form')}
          disabled={rateLoading}
        >
          {rateLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <span>Quick Payment</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
