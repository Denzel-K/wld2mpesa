import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaymentStore } from '../stores/paymentStore';
import * as api from '../lib/api';
import {
    Zap,
    ShieldCheck,
    Globe,
    Cpu,
    CheckCircle2,
    ArrowRight,
    Loader2,
    Sparkles
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

const slides = [
    {
        id: 'problem',
        title: 'Instant Liquidity',
        subtitle: 'Skip the queues',
        description: 'Tired of waiting for exchange settlements? WLD2Mpesa brings instant liquidity to your World Chain assets.',
        icon: <Zap className="w-10 h-10 text-yellow-400" />,
        color: 'from-yellow-500/20 to-orange-500/20',
        brand: 'M-PESA INTEGRATED'
    },
    {
        id: 'how-it-works',
        title: 'Automated Flow',
        subtitle: 'No P2P Hassles',
        description: 'We automate the bridge from World Chain to KES via M-Pesa. No manual matching required.',
        icon: <Globe className="w-10 h-10 text-blue-400" />,
        color: 'from-blue-500/20 to-cyan-500/20',
        brand: 'REAL-TIME SWAPS'
    },
    {
        id: 'security',
        title: 'Bank-Grade Security',
        subtitle: 'Self-Custodial',
        description: 'All transactions are verified through MiniKit. We never touch your private keys.',
        icon: <ShieldCheck className="w-10 h-10 text-emerald-400" />,
        color: 'from-emerald-500/20 to-teal-500/20',
        brand: 'WORLD CHAIN NATIVE'
    },
    {
        id: 'tech',
        title: 'Proof of Personhood',
        subtitle: 'Bot-Free Ecosystem',
        description: 'Powered by World ID 2.0 to ensure a secure, human-only financial experience.',
        icon: <Cpu className="w-10 h-10 text-purple-400" />,
        color: 'from-purple-500/20 to-pink-500/20',
        brand: 'WORLD ID 2.0'
    }
];

export const OnboardingPage: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const { setScreen, setOnboarded, walletAddress } = usePaymentStore();
    const [loading, setLoading] = useState(false);

    const next = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(s => s + 1);
        } else {
            finish();
        }
    };

    const finish = async () => {
        setLoading(true);
        try {
            if (walletAddress) {
                await api.markOnboarded(walletAddress);
            }
            setOnboarded(true);
            setScreen('home');
        } catch (err) {
            console.error('Failed to mark onboarding:', err);
            setOnboarded(true);
            setScreen('home');
        } finally {
            setLoading(false);
        }
    };

    const slide = slides[currentSlide];

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col relative overflow-hidden font-sans">
            {/* Dynamic Background Glow */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={slide.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className={`absolute inset-0 bg-gradient-to-br ${slide.color} to-transparent opacity-30`}
                />
            </AnimatePresence>

            {/* Header */}
            <div className="flex justify-between items-center p-8 z-10">
                <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Setup</span>
                </div>
                <ThemeToggle />
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-10 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.05, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col items-center text-center max-w-sm"
                    >
                        <div className="mb-12 relative">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                className="absolute -inset-4 border border-dashed border-[var(--accent)]/20 rounded-full"
                            />
                            <div className="w-24 h-24 bg-[var(--card-bg)] backdrop-blur-2xl rounded-[2rem] border border-[var(--border-color)] flex items-center justify-center shadow-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)]/5 to-transparent" />
                                <div className="relative z-10 transition-transform duration-500 hover:scale-110">
                                    {slide.icon}
                                </div>
                            </div>
                        </div>

                        <span className="text-[var(--accent)] text-xs font-black uppercase tracking-widest mb-3">
                            {slide.subtitle}
                        </span>

                        <h2 className="text-4xl font-black mb-6 tracking-tight font-display leading-tight">
                            {slide.title}
                        </h2>

                        <p className="text-lg text-[var(--text-secondary)] leading-relaxed font-medium mb-4">
                            {slide.description}
                        </p>

                        <div className="px-4 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-color)]">
                            <span className="text-[8px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                                {slide.brand}
                            </span>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Custom Footer Navigation */}
            <div className="px-8 pb-12 pt-8 z-10 flex flex-col items-center">
                {/* Visual Progress */}
                <div className="flex gap-2.5 mb-10">
                    {slides.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-700 ${i === currentSlide
                                    ? 'w-12 bg-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]'
                                    : 'w-1.5 bg-[var(--border-color)]'
                                }`}
                        />
                    ))}
                </div>

                <div className="w-full max-w-sm">
                    <button
                        onClick={next}
                        disabled={loading}
                        className="btn-mpesa h-18 py-5 px-10 group relative overflow-hidden"
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="font-black">Configuring Account...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <span className="font-black text-xl">
                                    {currentSlide === slides.length - 1 ? 'Start Using App' : 'Continue'}
                                </span>
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <ArrowRight className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        )}
                    </button>

                    {currentSlide < slides.length - 1 && (
                        <button
                            onClick={finish}
                            disabled={loading}
                            className="w-full mt-6 py-2 text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest hover:text-[var(--text-primary)] transition-colors"
                        >
                            Skip Tour
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
