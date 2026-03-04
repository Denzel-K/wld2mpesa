import React, { useEffect, useState } from 'react';
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
            <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold mb-4">Open in World App</h1>
                <p className="text-gray-400 mb-8 max-w-xs">
                    WLD2Mpesa is a mini app designed for the World App ecosystem.
                    Please open this link inside your World App to continue.
                </p>
                <button
                    onClick={() => window.location.href = 'https://worldcoin.org/download'}
                    className="bg-white text-black font-semibold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors"
                >
                    Download World App
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6">
            <div className="flex-1 flex flex-col items-center justify-center max-w-xs mx-auto text-center">
                <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl rotate-12 absolute -inset-1 blur-lg opacity-50 animate-pulse" />
                    <div className="w-24 h-24 bg-[#111] border border-white/10 rounded-3xl flex items-center justify-center relative">
                        {loading ? (
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-10 h-10 text-blue-500" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-4">Identity Verification</h1>
                <p className="text-gray-400 mb-10 leading-relaxed">
                    Securely verify your unique identity with World ID to access instant WLD-to-Mpesa transfers.
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <div className="w-full space-y-4">
                    <button
                        onClick={handleVerify}
                        disabled={loading}
                        className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all ${loading
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-white text-black active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>{status}</span>
                            </>
                        ) : (
                            <>
                                <span>Verify with World ID</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                        Powered by World ID 2.0
                    </p>
                </div>
            </div>

            <div className="mt-auto px-4 py-8 border-t border-white/5 flex items-center justify-center space-x-2 text-gray-500 text-xs">
                <Wallet className="w-3 h-3" />
                <span>Secure Wallet Connection Active</span>
            </div>
        </div>
    );
};
