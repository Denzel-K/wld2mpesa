/**
 * HomePage.tsx — Dashboard (Balance + Actions + History)
 */

import { useState, useEffect } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, convertKesTo, cn } from '@/lib/utils';
import { fetchTransactionHistory, fetchBalance } from '@/lib/api';
import {
  Loader2, Send, Store, CreditCard, User,
  TrendingUp, Shield, History, LogOut, Eye, AlertTriangle, Clock
} from 'lucide-react';
import CurrencySelector from '@/components/CurrencySelector';
import TransactionDetailModal from '@/components/TransactionDetailModal';

const ACTIONS = [
  { id: 'send', label: 'Send Money', icon: Send, sub: 'To M-Pesa Number', color: 'bg-blue-600' },
  { id: 'pochi', label: 'Pochi la Biashara', icon: User, sub: 'Small Business', color: 'bg-blue-600' },
  { id: 'till', label: 'Till Number', icon: Store, sub: 'Buy Goods', color: 'bg-blue-600' },
  { id: 'paybill', label: 'Paybill', icon: CreditCard, sub: 'Bills & Utilities', color: 'bg-blue-600' },
];

const FILTERS = ['All', 'Settled', 'Pending', 'Failed'] as const;
type Filter = typeof FILTERS[number];

function txIcon(type: string) {
  if (type === 'paybill') return CreditCard;
  if (type === 'send') return Send;
  if (type === 'till') return Store;
  return User;
}
function txColor(type: string) {
  if (type === 'paybill') return 'bg-blue-600';
  if (type === 'till') return 'bg-purple-600';
  if (type === 'pochi') return 'bg-orange-500';
  return 'bg-[var(--accent)]';
}
function txLabel(tx: any): string {
  if (tx.transactionType === 'send') return `Send: ${tx.phoneNumber || 'Unknown'}`;
  if (tx.transactionType === 'pochi') return `Pochi: ${tx.phoneNumber || 'Unknown'}`;
  if (tx.transactionType === 'paybill') return `Bill: ${tx.accountNumber || tx.tillNumber || 'Unknown'}`;
  return `Till: ${tx.tillNumber || 'Unknown'}`;
}
function txTimestamp(tx: any): string {
  const raw = tx.createdAt || tx.steps?.[0]?.timestamp;
  if (!raw) return '';
  return new Date(raw).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short', hour12: true });
}

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
  const [filter, setFilter] = useState<Filter>('All');
  const [modalTxId, setModalTxId] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    // Fetch on-chain balance directly — never affected by failed transactions
    setBalanceLoading(true);
    fetchBalance(walletAddress)
      .then((b) => { if (b?.balanceWld) setBalanceWld(b.balanceWld); })
      .catch(console.error)
      .finally(() => setBalanceLoading(false));

    // Fetch transaction history
    setHistoryLoading(true);
    fetchTransactionHistory(walletAddress)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [walletAddress]);

  const handleAction = (id: string) => {
    setTransactionType(id as any);
    setScreen('payment-form');
  };

  const filteredHistory = history.filter((tx) => {
    if (filter === 'All') return true;
    if (filter === 'Settled') return tx.status === 'SETTLED';
    if (filter === 'Failed') return tx.status === 'FAILED';
    if (filter === 'Pending') return !['SETTLED', 'FAILED'].includes(tx.status);
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in pb-24">

      {/* Header */}
      <header className="bg-[var(--accent)] px-5 pt-12 pb-14 rounded-b-[3rem] relative overflow-hidden shadow-[0_25px_50px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-black/20 rounded-full -ml-10 -mb-10 blur-2xl" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <span className="text-white/60 text-[9px] font-black tracking-[0.3em] uppercase">Welcome back</span>
            <h1 className="text-white text-2xl font-black font-display tracking-tight mt-0.5">
              {userName ? userName.split(' ')[0] : 'WLD2Mpesa'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={() => logout()}
              className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-95"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="relative z-20 bg-white/10 backdrop-blur-2xl rounded-[1.25rem] py-4 px-4 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <span className="text-white/60 text-[9px] font-black uppercase tracking-widest">WLD Balance</span>
              <div className="flex items-baseline gap-1 mt-1">
                {balanceLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <>
                    <span className="text-white text-lg font-black font-display">
                      {balanceWld ? parseFloat(balanceWld).toFixed(2) : '0.00'}
                    </span>
                    <span className="text-white/60 text-[9px] font-black">WLD</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center px-3 border-x border-white/10">
              <span className="text-white/40 text-[8px] font-black uppercase tracking-widest mb-1.5">Rates</span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg text-white text-[9px] font-black px-2 py-1 outline-none appearance-none cursor-pointer"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div className="flex-1 flex flex-col items-end">
              <span className="text-white/60 text-[9px] font-black uppercase tracking-widest">{selectedCurrency} Value</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-white text-lg font-black font-display">
                  {rate && !rateLoading && balanceWld
                    ? convertKesTo(parseFloat(balanceWld) * rate.wldPriceKes, selectedCurrency, rate.usdKesRate).toFixed(2)
                    : '0.00'}
                </span>
                <span className="text-white/60 text-[9px] font-black">{selectedCurrency}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 -mt-7 relative z-20 space-y-4">

        {/* Action Grid */}
        <div className="card grid grid-cols-2 gap-3 p-3 shadow-xl border-[var(--border-color)]">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="group flex flex-col items-center p-3.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--accent)] transition-all duration-300 active:scale-95 border border-[var(--border-color)] hover:border-transparent"
            >
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center mb-2 text-white group-hover:bg-white/20 transition-all duration-300',
                action.color
              )}>
                <action.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-[var(--text-primary)] group-hover:text-white transition-colors">{action.label}</span>
              <span className="text-[8px] text-[var(--text-secondary)] mt-0.5 group-hover:text-white/70 transition-colors uppercase tracking-wide">{action.sub}</span>
            </button>
          ))}
        </div>

        {/* Market Rates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">Market Rates</h3>
            <span className="text-[8px] font-black text-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-1 rounded-full animate-pulse border border-[var(--accent)]/20">LIVE FEED</span>
          </div>

          <div className="card border-[var(--border-color)] p-4 space-y-4">
            <CurrencySelector />
            {rateLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Syncing...</span>
              </div>
            ) : rateError ? (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-bold text-center">{rateError}</div>
            ) : rate ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center border border-[var(--accent)]/20">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-wider">Spot Rate</p>
                    <p className="text-sm font-black text-[var(--text-primary)] font-display">
                      1 WLD = {formatCurrency(convertKesTo(rate.wldPriceKes, selectedCurrency), selectedCurrency)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Source</p>
                  <p className="text-[9px] font-black text-[var(--accent)] uppercase mt-0.5">{rate.source}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3 pb-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">Recent Activity</h3>
          </div>

          {/* Filter tabs */}
          <div className="flex bg-[var(--bg-secondary)] p-0.5 rounded-xl border border-[var(--border-color)] gap-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'flex-1 py-1.5 text-[9px] font-black uppercase tracking-wide rounded-lg transition-all',
                  filter === f
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-30 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Syncing...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-20 gap-3">
              <History className="w-10 h-10" />
              <p className="text-[9px] font-black uppercase tracking-widest">No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((tx) => {
                const Icon = txIcon(tx.transactionType);
                const isSettled = tx.status === 'SETTLED';
                const isFailed = tx.status === 'FAILED';
                const txId = tx.id || tx.transactionId;

                return (
                  <div
                    key={txId}
                    className="card border-[var(--border-color)] p-3 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-all"
                  >
                    {/* Icon */}
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0',
                      txColor(tx.transactionType)
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{txLabel(tx)}</p>
                      <p className="text-[8px] text-[var(--text-secondary)] font-bold mt-0.5">{txTimestamp(tx)}</p>
                    </div>

                    {/* Amount + Status */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className={cn(
                        'text-[11px] font-black',
                        isSettled ? 'text-[var(--text-primary)]' : isFailed ? 'text-[var(--text-secondary)]/50 line-through' : 'text-[var(--text-primary)]'
                      )}>
                        {isSettled ? '-' : ''}{formatCurrency(tx.kesAmount, 'KES')}
                      </p>
                      <span className={cn(
                        'text-[7px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                        isSettled ? 'bg-[var(--accent)]/10 text-[var(--accent)]' :
                          isFailed ? 'bg-red-500/10 text-red-500' :
                            'bg-orange-500/10 text-orange-500'
                      )}>
                        {isSettled ? 'Settled' : isFailed ? 'Failed' : 'Pending'}
                      </span>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => setModalTxId(txId)}
                      className={cn(
                        'ml-1 flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center border transition-all active:scale-95',
                        isSettled
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/20'
                          : isFailed
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                      )}
                      title={isSettled ? 'View Details' : 'Resolve Issue'}
                    >
                      {isSettled ? <Eye className="w-3.5 h-3.5" /> :
                        isFailed ? <AlertTriangle className="w-3.5 h-3.5" /> :
                          <Clock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {modalTxId && (
        <TransactionDetailModal
          transactionId={modalTxId}
          onClose={() => setModalTxId(null)}
        />
      )}
    </div>
  );
}
