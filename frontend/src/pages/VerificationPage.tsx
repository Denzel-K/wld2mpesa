import { useEffect, useState } from 'react';
import { usePaymentStore } from '../stores/paymentStore';
import { isInsideWorldApp, getWalletAddress, verifyWithWorldId } from '../lib/minikit';
import * as api from '../lib/api';
import { ShieldCheck, Wallet, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export const VerificationPage: React.FC = () => {
    const { setScreen, setWalletAddress, setWorldIdVerified, setOnboarded } = usePaymentStore();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<string>('Initializing...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkContext();
    }, []);

    const checkContext = async () => {
        setLoading(true);
        setStatus('Checking environment...');

        if (!isInsideWorldApp()) {
            setStatus('Outside World App');
            setLoading(false);
            return;
        }

        try {
            // 1. Get Wallet Address
            setStatus('Retrieving wallet...');
            const address = getWalletAddress();
            if (!address) {
                throw new Error('Could not retrieve wallet address. Please ensure you are logged into World App.');
            }
            setWalletAddress(address);

            // 2. Check Backend for User Status
            setStatus('Verifying account...');
            const user = await api.fetchUser(address);

            if (user) {
                setWorldIdVerified(user.isVerified);
                setOnboarded(user.onboarded);

                if (user.isVerified) {
                    if (user.onboarded) {
                        setScreen('home');
                    } else {
                        setScreen('onboarding');
                    }
                    return;
                }
            }

            // 3. New User or Not Verified — Request World ID Verification
            setStatus('Awaiting World ID verification...');
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Verification failed');
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError(null);
        try {
            const address = getWalletAddress();
            if (!address) throw new Error('Wallet not found');

            const proof = await verifyWithWorldId('wld2mpesa-login', address);
            if (!proof) throw new Error('Verification cancelled');

            setStatus('Syncing with backend...');
            const user = await api.syncUser({
                walletAddress: address,
                worldIdProof: proof
            });

            setWorldIdVerified(true);
            setOnboarded(user.onboarded);

            if (user.onboarded) {
                setScreen('home');
            } else {
                setScreen('onboarding');
            }
        } catch (err: any) {
            setError(err.message || 'Verification failed');
            setLoading(false);
        }
    };

    if (!isInsideWorldApp() && !loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-[var(--accent)]/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_0_30px_var(--accent-glow)]">
                    <AlertCircle className="w-12 h-12 text-[var(--accent)]" />
                </div>
                <h1 className="text-3xl font-black mb-4 tracking-tight">Open in World App</h1>
                <p className="text-[var(--text-secondary)] mb-10 max-w-xs font-medium leading-relaxed">
                    WLD2Mpesa is a native World Chain experience.
                    Please open this link inside your World App to continue.
                </p>
                <button
                    onClick={() => window.location.href = 'https://worldcoin.org/download'}
                    className="btn-mpesa max-w-xs"
                >
                    Download World App
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col p-8">
            <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                <div className="relative mb-10">
                    <div className="w-24 h-24 bg-gradient-to-tr from-[var(--accent)] to-emerald-400 rounded-3xl rotate-12 absolute -inset-2 blur-xl opacity-30 animate-pulse" />
                    <div className="w-24 h-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl flex items-center justify-center relative shadow-2xl">
                        {loading ? (
                            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                        ) : (
                            <ShieldCheck className="w-10 h-10 text-[var(--accent)]" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-black mb-4 tracking-tight font-display">Identity Verification</h1>
                <p className="text-[var(--text-secondary)] mb-10 leading-relaxed font-medium">
                    Securely verify your unique identity with World ID to access instant WLD-to-Mpesa transfers.
                </p>

                {error && (
                    <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-5 rounded-2xl mb-8 text-sm flex items-center shadow-lg">
                        <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span className="font-semibold">{error}</span>
                    </div>
                )}

                <div className="w-full space-y-6">
                    <button
                        onClick={handleVerify}
                        disabled={loading}
                        className="btn-mpesa h-16 group"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span>{status}</span>
                            </>
                        ) : (
                            <>
                                <span>Verify with World ID</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-[var(--text-secondary)]/50 uppercase tracking-[0.2em] font-black">
                        Powered by World ID 2.0
                    </p>
                </div>
            </div>

            <div className="mt-auto py-8 flex items-center justify-center space-x-3 text-[var(--text-secondary)]/40 text-xs font-bold border-t border-[var(--border-color)]">
                <Wallet className="w-4 h-4" />
                <span>SECURE WALLET CONNECTION ACTIVE</span>
            </div>
        </div>
    );
};
