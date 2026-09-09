/**
 * HomePage.tsx — Dashboard (Balance + Actions + History)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, convertKesTo, cn } from '@/lib/utils';
import { fetchTransactionHistory, fetchBalance } from '@/lib/api';
import {
  Loader2, Send, Store, CreditCard, User,
  TrendingUp, History, LogOut, Eye, AlertTriangle, Clock, RotateCcw, RefreshCw, BadgeCheck
} from 'lucide-react';
import CurrencySelector from '@/components/CurrencySelector';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';

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
    walletAddress, wldUsername, fullName, profileComplete, balanceWld, setBalanceWld,
    logout
  } = usePaymentStore();

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [modalTxId, setModalTxId] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(!profileComplete);

  // Pull-to-refresh
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!walletAddress) return;
    if (showRefreshing) setRefreshing(true);
    else { setBalanceLoading(true); setHistoryLoading(true); }
    try {
      const [balResult, histResult] = await Promise.all([
        fetchBalance(walletAddress).catch(() => null),
        fetchTransactionHistory(walletAddress).catch(() => []),
      ]);
      if (balResult?.balanceWld) setBalanceWld(balResult.balanceWld);
      setHistory(histResult as any[]);
    } finally {
      setRefreshing(false);
      setBalanceLoading(false);
      setHistoryLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (scrollTop <= 0 && delta > 60) loadData(true);
  };

  // Build activity rows: original txns + refund events
  const activityRows = history.flatMap((tx: any) => {
    const rows: any[] = [{ ...tx, _rowType: 'tx' }];
    if (tx.refundStatus === 'REFUND_INITIATED' || tx.refundStatus === 'REFUNDED' || tx.refundStatus === 'REFUND_FAILED') {
      rows.push({ ...tx, _rowType: 'refund' });
    }
    return rows;
  });

  const handleAction = (id: string) => {
    setTransactionType(id as any);
    setScreen('payment-form');
  };

  const filteredHistory = activityRows.filter((row) => {
    if (row._rowType === 'refund') return filter === 'All' || filter === 'Failed';
    if (filter === 'All') return true;
    if (filter === 'Settled') return row.status === 'SETTLED';
    if (filter === 'Failed') return row.status === 'FAILED';
    if (filter === 'Pending') return !['SETTLED', 'FAILED'].includes(row.status);
    return true;
  });

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-screen bg-[var(--bg-primary)] animate-fade-in pb-24 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="flex items-center justify-center gap-2 py-3 text-[var(--accent)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-[9px] font-black uppercase tracking-widest">Refreshing...</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-[var(--accent)] px-5 pt-12 pb-14 rounded-b-[3rem] relative overflow-hidden shadow-[0_25px_50px_var(--accent-glow)]">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-black/20 rounded-full -ml-10 -mb-10 blur-2xl" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <span className="text-white/60 text-[9px] font-black tracking-[0.3em] uppercase">Welcome back</span>
            <h1 className="text-white text-2xl font-black font-display tracking-tight mt-0.5">
              {fullName ? fullName.split(' ')[0] : (wldUsername ? wldUsername.split(' ')[0] : 'WLD2Cash')}
            </h1>
            {wldUsername && (
              <div className="flex items-center gap-1 mt-1">
                <BadgeCheck className="w-3 h-3 text-emerald-300" />
                <span className="text-white/50 text-[8px] font-bold">@{wldUsername}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30 transition-colors active:scale-95"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
          </button>
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
              {filteredHistory.map((row, idx) => {
                const txId = row.id || row.transactionId;
                const isRefundRow = row._rowType === 'refund';

                if (isRefundRow) {
                  const refundFailed = row.refundStatus === 'REFUND_FAILED';
                  const refundPending = row.refundStatus === 'REFUND_INITIATED';
                  return (
                    <div
                      key={`${txId}-refund-${idx}`}
                      className="card border-[var(--border-color)] p-3 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-all ml-4 border-l-2 border-l-orange-500/40"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 bg-orange-500">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">WLD Refund</p>
                        <p className="text-[8px] text-[var(--text-secondary)] font-bold mt-0.5">{txTimestamp(row)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-[11px] font-black text-orange-400">+{row.wldAmount ? parseFloat(row.wldAmount).toFixed(4) : '?'} WLD</p>
                        <span className={cn(
                          'text-[7px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                          refundFailed ? 'bg-red-500/10 text-red-400' :
                            refundPending ? 'bg-orange-500/10 text-orange-400' :
                              'bg-[var(--accent)]/10 text-[var(--accent)]'
                        )}>
                          {refundFailed ? 'Refund Failed' : refundPending ? 'Refund Pending' : 'Refunded'}
                        </span>
                      </div>
                      <button
                        onClick={() => setModalTxId(txId)}
                        className="ml-1 flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all active:scale-95"
                        title="View Refund Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                const Icon = txIcon(row.transactionType);
                const isSettled = row.status === 'SETTLED';
                const isFailed = row.status === 'FAILED';

                return (
                  <div
                    key={`${txId}-${idx}`}
                    className="card border-[var(--border-color)] p-3 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-all"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0',
                      txColor(row.transactionType)
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{txLabel(row)}</p>
                      <p className="text-[8px] text-[var(--text-secondary)] font-bold mt-0.5">{txTimestamp(row)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className={cn(
                        'text-[11px] font-black',
                        isSettled ? 'text-[var(--text-primary)]' : isFailed ? 'text-[var(--text-secondary)]/50 line-through' : 'text-[var(--text-primary)]'
                      )}>
                        {isSettled ? '-' : ''}{formatCurrency(row.kesAmount, 'KES')}
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

      {/* Profile Setup Modal — shown to existing users who haven't completed their profile */}
      {showProfileModal && !profileComplete && (
        <ProfileSetupModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
}
