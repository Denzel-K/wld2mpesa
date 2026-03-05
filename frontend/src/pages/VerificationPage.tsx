import React, { useEffect, useState, useRef } from 'react';
import { usePaymentStore } from '../stores/paymentStore';
import { isInsideWorldApp, authenticateWallet, verifyWithWorldId, checkBackend, ACTION_ID } from '../lib/minikit';
import * as api from '../lib/api';
import {
    ShieldCheck,
    Wallet,
    ArrowRight,
    Loader2,
    AlertCircle,
    CheckCircle2,
    KeyRound,
    Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'wallet-auth' | 'world-id' | 'syncing' | 'done' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

export const VerificationPage: React.FC = () => {
    const { setScreen, setWalletAddress, setWorldIdVerified, setOnboarded } = usePaymentStore();
    const [step, setStep] = useState<Step>('idle');
    const [error, setError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [backendOk, setBackendOk] = useState<boolean | null>(null);
    const [backendError, setBackendError] = useState<string | null>(null);
    const inProgressRef = useRef(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const result = await checkBackend();
            if (!mounted) return;

            setBackendOk(result.ok);
            if (!result.ok) {
                setBackendError(result.error ?? 'Cannot reach backend');
                return;
            }
            if (!isInsideWorldApp()) return;

            // Only start if not already in progress
            if (!inProgressRef.current) {
                handleFullAuth();
            }
        })();

        return () => { mounted = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFullAuth = async () => {
        if (inProgressRef.current) return;
        inProgressRef.current = true;

        setError(null);
        setStep('wallet-auth');
        setStatusMsg('Connecting Secure Wallet…');

        const walletResult = await authenticateWallet();

        if (!walletResult.success || !walletResult.walletAddress) {
            setError(walletResult.error || 'Wallet authentication failed. Please try again.');
            setStep('error');
            return;
        }

        const walletAddress = walletResult.walletAddress;
        setWalletAddress(walletAddress);

        // ─── Check if user already verified ─────────────────────────────
        setStatusMsg('Checking account…');
        try {
            const user = await api.fetchUser(walletAddress);
            if (user?.isVerified) {
                setWorldIdVerified(true);
                setOnboarded(user.onboarded);
                setStep('done');
                setTimeout(() => {
                    setScreen(user.onboarded ? 'home' : 'onboarding');
                }, 600);
                return;
            }
        } catch {
            // 404 = new user, continue
        }

        // ─── Step 2: World ID Verify ─────────────────────────────────────
        setStep('world-id');
        setStatusMsg('Opening World ID…');

        const proof = await verifyWithWorldId(ACTION_ID, walletAddress);

        if (!proof) {
            setError('World ID verification was cancelled or failed. Please try again.');
            setStep('error');
            return;
        }

        // ─── Step 3: Backend Sync ────────────────────────────────────────
        setStep('syncing');
        setStatusMsg('Securing your account…');

        try {
            const user = await api.syncUser({ walletAddress, worldIdProof: proof });
            setWorldIdVerified(true);
            setOnboarded(user.onboarded);
            setStep('done');
            setTimeout(() => {
                setScreen(user.onboarded ? 'home' : 'onboarding');
            }, 800);
        } catch (err: any) {
            setError(err.message || 'Account sync failed. Please try again.');
            setStep('error');
        }
    };

    // ── "Not in World App" screen ─────────────────────────────────────────────
    if (!isInsideWorldApp() && step !== 'wallet-auth') {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col p-8 relative overflow-hidden">
                <div className="flex justify-between items-center z-10 mb-12">
                    <button onClick={() => setScreen('welcome')} className="p-2 -ml-2 text-[var(--text-secondary)]">
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <ThemeToggle />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <div className="w-24 h-24 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-amber-500/20">
                        <AlertCircle className="w-12 h-12 text-amber-500" />
                    </div>
                    <h1 className="text-3xl font-black mb-4 tracking-tight font-display">Open in World App</h1>
                    <p className="text-[var(--text-secondary)] mb-10 leading-relaxed">
                        WLD2Mpesa requires the secure environment of the World App for wallet authentication and transfers.
                    </p>
                    <button
                        onClick={() => window.location.href = 'https://worldcoin.org/download'}
                        className="btn-mpesa max-w-xs"
                    >
                        Get World App
                    </button>
                    <button
                        onClick={handleFullAuth}
                        className="mt-4 text-sm text-[var(--accent)] font-semibold underline underline-offset-2"
                    >
                        Try anyway (dev mode)
                    </button>
                </div>
            </div>
        );
    }

    // ── Step indicators ───────────────────────────────────────────────────────
    const steps = [
        { id: 'wallet-auth', icon: <KeyRound className="w-4 h-4" />, label: 'Connect Wallet' },
        { id: 'world-id', icon: <Globe className="w-4 h-4" />, label: 'World ID' },
        { id: 'syncing', icon: <ShieldCheck className="w-4 h-4" />, label: 'Secure Account' },
    ];

    const stepIndex = { idle: -1, 'wallet-auth': 0, 'world-id': 1, syncing: 2, done: 3, error: -1 }[step];

    const isLoading = ['wallet-auth', 'world-id', 'syncing'].includes(step);
    const isDone = step === 'done';
    const isError = step === 'error';

    // ── Main UI ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col p-8 relative overflow-hidden">
            {/* Bg Glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--accent)]/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center z-10 mb-12">
                <button onClick={() => setScreen('welcome')} className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <ThemeToggle />
            </div>

            {/* Icon */}
            <div className="flex flex-col items-center z-10">
                <motion.div
                    className="relative mb-10"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="absolute -inset-4 bg-[var(--accent)]/15 rounded-full blur-2xl animate-pulse" />
                    <div className="w-24 h-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2rem] flex items-center justify-center shadow-2xl relative">
                        {isLoading && <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />}
                        {isDone && <CheckCircle2 className="w-10 h-10 text-[var(--accent)]" />}
                        {isError && <AlertCircle className="w-10 h-10 text-red-500" />}
                        {!isLoading && !isDone && !isError && <ShieldCheck className="w-10 h-10 text-[var(--accent)]" />}
                    </div>
                </motion.div>

                <motion.h1
                    className="text-4xl font-black mb-3 tracking-tight font-display text-center"
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    Identity Verification
                </motion.h1>
                <motion.p
                    className="text-[var(--text-secondary)] mb-10 text-center leading-relaxed max-w-xs"
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {isLoading
                        ? statusMsg
                        : isDone
                            ? 'Verification complete! Redirecting…'
                            : 'Securely connect your wallet and verify your identity to access WLD-to-M-Pesa transfers.'}
                </motion.p>
            </div>

            {/* Progress Steps */}
            {(isLoading || isDone) && (
                <div className="flex items-center justify-center gap-3 mb-8 z-10">
                    {steps.map((s, i) => (
                        <React.Fragment key={s.id}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-500 ${i < stepIndex ? 'bg-[var(--accent)] text-white' :
                                i === stepIndex ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40' :
                                    'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                                }`}>
                                {i < stepIndex ? <CheckCircle2 className="w-3 h-3" /> : s.icon}
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`h-px w-6 transition-all duration-500 ${i < stepIndex ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Backend Status Indicator */}
            {backendOk === false && (
                <div className="w-full max-w-sm mx-auto mb-4 z-10">
                    <div className="bg-red-500/10 border border-red-500/25 text-red-500 p-4 rounded-2xl text-xs text-left">
                        <p className="font-black mb-1">⚠️ Backend Unreachable</p>
                        <p className="font-mono opacity-70">{backendError}</p>
                        <p className="opacity-50 mt-1">Ensure VITE_BACKEND_URL=/api in .env.local and restart the frontend container.</p>
                    </div>
                </div>
            )}

            {/* Error */}
            <AnimatePresence>
                {isError && error && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-8 z-10 max-w-sm mx-auto w-full"
                    >
                        <div className="bg-red-500/10 border border-red-500/25 text-red-500 p-4 rounded-2xl text-sm flex items-start">
                            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold mb-0.5">Verification Failed</p>
                                <p className="opacity-80">{error}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Button */}
            <div className="z-10 max-w-sm mx-auto w-full mt-auto">
                <motion.button
                    onClick={handleFullAuth}
                    disabled={isLoading || isDone}
                    className={`btn-mpesa h-16 group relative overflow-hidden ${isDone ? 'bg-emerald-600' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="font-bold">{statusMsg}</span>
                        </div>
                    ) : isDone ? (
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-black">Verified!</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-black">Verify with World ID</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                    )}
                </motion.button>

                {isError && (
                    <button
                        onClick={handleFullAuth}
                        className="mt-4 w-full py-3 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-center"
                    >
                        Try Again
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[var(--text-secondary)]/30 z-10 pb-4">
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black tracking-wider uppercase">Secured</span>
                </div>
                <div className="h-3 w-px bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black tracking-wider uppercase">Non-Custodial</span>
                </div>
                <div className="h-3 w-px bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-black tracking-wider uppercase">World ID 2.0</span>
                </div>
            </div>
        </div>
    );
};
