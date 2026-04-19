/**
 * HomePage.tsx — Landing screen (Premium Redesign)
 */

import { useState, useEffect } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, convertKesTo, cn } from '@/lib/utils';
import { fetchTransactionHistory, fetchUser } from '@/lib/api';
import {
  Loader2,
  Send,
  Store,
  CreditCard,
  User,
  TrendingUp,
  Shield,
  History,
  LogOut
} from 'lucide-react';
import CurrencySelector from '@/components/CurrencySelector';

const ACTIONS = [
  { id: 'send', label: 'Send Money', icon: Send, sub: 'To M-Pesa Number', color: 'bg-blue-600' },
  { id: 'pochi', label: 'Pochi la Biashara', icon: User, sub: 'Small Business', color: 'bg-blue-600' },
  { id: 'till', label: 'Till Number', icon: Store, sub: 'Buy Goods', color: 'bg-blue-600' },
  { id: 'paybill', label: 'Paybill', icon: CreditCard, sub: 'Bills & Utilities', color: 'bg-blue-600' },
];

export default function HomePage() {
  const {
    rate, rateLoading, rateError,
    setScreen,
    selectedCurrency, setSelectedCurrency, setTransactionType,
    walletAddress, userName, balanceWld, setBalanceWld,
    logout
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
      
      // Also fetch user explicitly to ensure balance changes are reflected
      fetchUser(walletAddress).then(user => {
        if (user?.balanceWld) {
          setBalanceWld(user.balanceWld);
        }
      }).catch(console.error);
    }
  }, [walletAddress]);

  const handleAction = (id: string) => {
    setTransactionType(id as any);
    setScreen('payment-form');
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in pb-32">
      {/* Premium Header */}
      <header className="bg-[var(--accent)] px-6 pt-12 pb-16 rounded-b-[3rem] relative overflow-hidden shadow-[0_25px_50px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/20 rounded-full -ml-12 -mb-12 blur-2xl" />

        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] font-black tracking-[0.3em] uppercase mb-1">
              Welcome back
            </span>
            <h1 className="text-white text-3xl font-black font-display tracking-tight">
              {userName ? userName.split(' ')[0] : 'WLD2Mpesa'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl hover:bg-white/20 transition-colors active:scale-95"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Balance Card (3 Columns) */}
        <div className="relative z-20 bg-white/10 backdrop-blur-2xl rounded-[1.5rem] py-6 px-4 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            {/* Column 1: WLD (Prominent) */}
            <div className="flex-1 flex flex-col">
              <span className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-1.5">WLD Balance</span>
              <div className="flex items-baseline gap-1">
                <span className="text-white text-xl font-black font-display tracking-tight">
                  {balanceWld ? parseFloat(balanceWld).toFixed(2) : '0.00'}
                </span>
                <span className="text-white/60 text-[10px] font-black">WLD</span>
              </div>
            </div>

            {/* Column 2: Currency Dropdown (Subtle) */}
            <div className="flex flex-col items-center px-4 border-x border-white/10">
               <span className="text-white/40 text-[8px] font-black uppercase tracking-widest mb-2">Rates</span>
               <select 
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg text-white text-[10px] font-black px-2 py-1 outline-none appearance-none cursor-pointer"
               >
                 <option value="KES">KES</option>
                 <option value="USD">USD</option>
                 <option value="EUR">EUR</option>
                 <option value="GBP">GBP</option>
               </select>
            </div>

            {/* Column 3: KES Equivalent (Prominent) */}
            <div className="flex-1 flex flex-col items-end">
              <span className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-1.5">{selectedCurrency} Value</span>
              <div className="flex items-baseline gap-1">
                <span className="text-white text-xl font-black font-display tracking-tight">
                  {rate && !rateLoading && balanceWld 
                    ? convertKesTo(parseFloat(balanceWld) * rate.wldPriceKes, selectedCurrency, rate.usdKesRate).toFixed(2) 
                    : '0.00'}
                </span>
                <span className="text-white/60 text-[10px] font-black">{selectedCurrency}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Action Grid */}
      <div className="px-5 -mt-8 relative z-20">
        <div className="card grid grid-cols-2 gap-4 p-4 shadow-xl mb-6 border-[var(--border-color)]">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="group flex flex-col items-center p-4 rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--accent)] transition-all duration-500 active:scale-95 border border-[var(--border-color)] hover:border-transparent"
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500 text-white",
                action.color
              )}>
                <action.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-white transition-colors">{action.label}</span>
              <span className="text-[9px] text-[var(--text-secondary)] mt-0.5 group-hover:text-white/70 transition-colors uppercase tracking-wider">{action.sub}</span>
            </button>
          ))}
        </div>

        {/* Currency & Rates Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Market Rates</h3>
            <span className="text-[10px] font-black text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-full animate-pulse border border-[var(--accent)]/20">LIVE FEED</span>
          </div>

          <div className="card space-y-5 border-[var(--border-color)]">
            <CurrencySelector />

            {rateLoading ? (
              <div className="flex items-center justify-center py-6 gap-3 text-[var(--text-secondary)]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Syncing World Chain...</span>
              </div>
            ) : rateError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold text-center">
                {rateError}
              </div>
            ) : rate ? (
              <div className="flex flex-col items-start justify-start">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-2xl flex items-center justify-center border border-[var(--accent)]/20">
                    <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-wider">Spot Rate</p>
                    <p className="text-lg font-black text-[var(--text-primary)] font-display">
                      1 WLD = {formatCurrency(convertKesTo(rate.wldPriceKes, selectedCurrency), selectedCurrency)}
                    </p>
                  </div>
                </div>
                <div className="text-right w-full mt-2">
                  <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mb-1">Source</p>
                  <p className="text-[10px] font-black text-[var(--accent)] uppercase">{rate.source}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="mt-12 mb-8">
          <div className="flex items-center justify-between mb-6 px-3">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Recent Activity</h3>
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
              {['All'].map((f) => (
                <button
                  key={f}
                  className="text-[10px] px-4 py-1.5 rounded-lg font-black transition-all bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Syncing Explorer...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-20 gap-4">
                <History className="w-12 h-12" />
                <p className="text-xs font-black uppercase tracking-widest">No activity found</p>
              </div>
            ) : (
              history.map((tx) => (
                <div
                  key={tx.transactionId}
                  className="card flex items-center gap-5 hover:bg-[var(--bg-secondary)] transition-all cursor-pointer border-[var(--border-color)] active:scale-95 group"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                    tx.transactionType === 'paybill' ? 'bg-blue-600' :
                      tx.transactionType === 'send' ? 'bg-[var(--accent)]' :
                        tx.transactionType === 'till' ? 'bg-[var(--accent)]-dark' : 'bg-orange-500'
                  )}>
                    {tx.transactionType === 'paybill' ? <CreditCard className="w-6 h-6" /> :
                      tx.transactionType === 'send' ? <Send className="w-6 h-6" /> :
                        tx.transactionType === 'till' ? <Store className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-[var(--text-primary)]">
                      {tx.transactionType === 'paybill' && `Bill: ${tx.accountNumber || 'Unknown'}`}
                      {tx.transactionType === 'send' && `Send: ${tx.phoneNumber || 'Unknown'}`}
                      {tx.transactionType === 'till' && `Till: ${tx.tillNumber || 'Unknown'}`}
                      {tx.transactionType === 'pochi' && `Pochi: ${tx.phoneNumber || 'Unknown'}`}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-tighter mt-0.5">
                      {new Date(tx.steps?.[0]?.timestamp || Date.now()).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[var(--text-primary)]">-{formatCurrency(tx.kesAmount, selectedCurrency)}</p>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest mt-0.5",
                      tx.status === 'SETTLED' ? "text-[var(--accent)]" :
                        tx.status === 'FAILED' ? "text-red-500" : "text-orange-500"
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
    </div>
  );
}
