import React from 'react';
import { motion } from 'framer-motion';
import { usePaymentStore } from '../stores/paymentStore';
import { ArrowRight, Globe, ShieldCheck, Zap } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const WelcomePage: React.FC = () => {
    const { setScreen } = usePaymentStore();

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col p-6 relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[var(--accent)]/10 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center z-10 mb-8">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-[var(--accent)] rounded-lg flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-display font-bold text-lg tracking-tight">WLD2Mpesa</span>
                </div>
                <ThemeToggle />
            </div>

            {/* Hero Section */}
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="inline-block px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase tracking-widest rounded-full mb-5">
                        Instant Settlements
                    </span>
                    <h1 className="text-4xl font-bold mb-5 tracking-tight font-display leading-[1.15]">
                        Your WLD, <br />
                        <span className="text-[var(--accent)]">Instantly</span> in M-Pesa.
                    </h1>
                    <p className="text-base text-[var(--text-secondary)] mb-8 leading-relaxed font-normal">
                        Bridging World Chain and Kenya's mobile money ecosystem. Fast, secure, and automated.
                    </p>
                </motion.div>

                {/* Quick Features */}
                <div className="grid grid-cols-1 gap-3 mb-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-4 p-3.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"
                    >
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Globe className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Global Scale</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">World Chain Native</p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-4 p-3.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"
                    >
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Automated Escrow</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">Secure Transactions</p>
                        </div>
                    </motion.div>
                </div>

                {/* CTA */}
                <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => setScreen('verification')}
                    className="btn-mpesa h-14 group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        Get Started
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </motion.button>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center">
                <p className="text-[10px] text-[var(--text-secondary)]/40 font-black uppercase tracking-[0.2em]">
                    Available in Kenya &middot; Secured by World ID
                </p>
            </div>
        </div>
    );
};
