/**
 * paymentStore.ts — Global payment state (Zustand)
 *
 * Single source of truth for the entire payment flow.
 * Pages read from here; lib/api.ts populates it.
 */

import { create } from 'zustand';
import type { RateData, InitiatePaymentResponse, TransactionStatus } from '@/lib/api';
import { logoutUser } from '@/lib/api';

// ─── State shape ──────────────────────────────────────────────────────────────

export type AppScreen =
  | 'welcome'
  | 'verification'
  | 'onboarding'
  | 'home'
  | 'payment-form'
  | 'confirmation'
  | 'processing'
  | 'status'
  | 'success'
  | 'failure'
  | 'resolution';

export type TransactionType = 'send' | 'paybill' | 'pochi' | 'till';

export interface SimulationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface PaymentState {
  // Navigation
  screen: AppScreen;

  // Rate data
  rate: RateData | null;
  rateLoading: boolean;
  rateError: string | null;

  // Payment form inputs
  transactionType: TransactionType;
  kesAmount: string;
  tillNumber: string;
  phoneNumber: string;
  accountNumber: string;
  businessName: string;

  // Initiated transaction
  pendingTransaction: InitiatePaymentResponse | null;

  // Live transaction status
  transactionStatus: TransactionStatus | null;
  statusPolling: boolean;

  // Developer mode
  devMode: boolean;
  simulationLogs: SimulationLog[];

  // MiniKit / User state
  walletAddress: string | null;
  userName: string | null;
  balanceWld: string | null;
  worldIdVerified: boolean;
  onboarded: boolean;

  // Global loading/error
  loading: boolean;
  error: string | null;

  // Multi-currency display
  selectedCurrency: string;

  // Resolution flow
  selectedTransactionId: string | null;

  // Retry flow — when user retries a stuck transaction from modal/resolution page
  retryTransactionId: string | null;
}

interface PaymentActions {
  // Navigation
  setScreen: (screen: AppScreen) => void;
  goBack: () => void;

  // Rate
  setRate: (rate: RateData) => void;
  setRateLoading: (loading: boolean) => void;
  setRateError: (error: string | null) => void;

  // Form
  setTransactionType: (type: TransactionType) => void;
  setKesAmount: (amount: string) => void;
  setTillNumber: (till: string) => void;
  setPhoneNumber: (phone: string) => void;
  setAccountNumber: (acc: string) => void;
  setBusinessName: (name: string) => void;
  resetForm: () => void;

  // Transaction
  setPendingTransaction: (tx: InitiatePaymentResponse | null) => void;
  setTransactionStatus: (status: TransactionStatus | null) => void;
  setStatusPolling: (polling: boolean) => void;

  // Developer mode
  toggleDevMode: () => void;
  addSimLog: (level: SimulationLog['level'], message: string) => void;
  clearSimLogs: () => void;

  // MiniKit / User
  setWalletAddress: (address: string | null) => void;
  setUserName: (name: string | null) => void;
  setBalanceWld: (balance: string | null) => void;
  setWorldIdVerified: (verified: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;

  // Global
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedCurrency: (currency: string) => void;
  setSelectedTransactionId: (id: string | null) => void;
  setRetryTransactionId: (id: string | null) => void;
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: PaymentState = {
  screen: 'home',
  rate: null,
  rateLoading: false,
  rateError: null,
  kesAmount: '',
  tillNumber: '',
  phoneNumber: '',
  accountNumber: '',
  businessName: '',
  pendingTransaction: null,
  transactionStatus: null,
  statusPolling: false,
  devMode: false,
  simulationLogs: [],
  loading: false,
  error: null,
  selectedCurrency: 'KES',
  selectedTransactionId: null,
  retryTransactionId: null,
  transactionType: 'till',
  walletAddress: null,
  userName: null,
  balanceWld: null,
  worldIdVerified: false,
  onboarded: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePaymentStore = create<PaymentState & PaymentActions>((set, get) => ({
  ...initialState,

  // Navigation
  setScreen: (screen) => set({ screen, error: null }),
  goBack: () => {
    const { screen } = get();
    const backMap: Partial<Record<AppScreen, AppScreen>> = {
      'onboarding': 'verification',
      'home': 'onboarding', // Should maybe be blocked or handle logic
      'payment-form': 'home',
      'confirmation': 'payment-form',
      'failure': 'payment-form',
    };
    const prev = backMap[screen];
    if (prev) set({ screen: prev, error: null });
  },

  // Rate
  setRate: (rate) => set({ rate, rateError: null }),
  setRateLoading: (rateLoading) => set({ rateLoading }),
  setRateError: (rateError) => set({ rateError }),

  // Form
  setTransactionType: (transactionType) => set({ transactionType }),
  setKesAmount: (kesAmount) => set({ kesAmount }),
  setTillNumber: (tillNumber) => set({ tillNumber }),
  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  setAccountNumber: (accountNumber) => set({ accountNumber }),
  setBusinessName: (businessName) => set({ businessName }),
  resetForm: () => set({
    kesAmount: '',
    tillNumber: '',
    phoneNumber: '',
    accountNumber: '',
    businessName: '',
    pendingTransaction: null,
    transactionStatus: null
  }),

  // Transaction
  setPendingTransaction: (pendingTransaction) => set({ pendingTransaction }),
  setTransactionStatus: (transactionStatus) => set({ transactionStatus }),
  setStatusPolling: (statusPolling) => set({ statusPolling }),

  // Developer mode
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
  addSimLog: (level, message) =>
    set((s) => ({
      simulationLogs: [
        ...s.simulationLogs.slice(-49), // keep last 50
        { timestamp: new Date().toISOString(), level, message },
      ],
    })),
  clearSimLogs: () => set({ simulationLogs: [] }),

  // MiniKit / User
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setUserName: (userName) => set({ userName }),
  setBalanceWld: (balanceWld) => set({ balanceWld }),
  setWorldIdVerified: (worldIdVerified) => set({ worldIdVerified }),
  setOnboarded: (onboarded) => set({ onboarded }),

  /**
   * Logout - clears all auth state and returns to welcome screen
   * Notifies backend and clears all local auth state
   * Also resets onboarding status so user sees welcome slides again
   */
  logout: async () => {
    const { walletAddress } = get();
    
    // Notify backend of logout with onboarding reset (best effort)
    if (walletAddress) {
      try {
        await logoutUser(walletAddress, true); // resetOnboarding = true
      } catch (err) {
        console.warn('[logout] Backend logout failed (non-critical):', err);
      }
    }
    
    // Clear all auth state
    set({
      screen: 'welcome',
      walletAddress: null,
      userName: null,
      balanceWld: null,
      worldIdVerified: false,
      onboarded: false,
      kesAmount: '',
      tillNumber: '',
      phoneNumber: '',
      accountNumber: '',
      businessName: '',
      pendingTransaction: null,
      transactionStatus: null,
      error: null,
      simulationLogs: [],
    });
  },

  // Global
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedCurrency: (selectedCurrency) => set({ selectedCurrency }),
  setSelectedTransactionId: (selectedTransactionId) => set({ selectedTransactionId }),
  setRetryTransactionId: (retryTransactionId) => set({ retryTransactionId }),
  reset: () => set({ ...initialState }),
}));
