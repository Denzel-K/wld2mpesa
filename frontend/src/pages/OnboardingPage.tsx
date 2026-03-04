import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaymentStore } from '../stores/paymentStore';
import * as api from '../lib/api';
import {
    Zap,
    ShieldCheck,
    Globe,
    Cpu,
    CheckCircle2,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';

const slides = [
    {
        id: 'problem',
        title: 'Instant Liquidity',
        description: 'Tired of waiting for exchange settlements? WLD2Mpesa brings instant liquidity to your World Chain assets.',
        icon: <Zap className="w-12 h-12 text-yellow-400" />,
        color: 'from-yellow-500/20 to-orange-500/20',
    },
    {
        id: 'how-it-works',
        title: 'Automated Flow',
        description: 'We automate the bridge from World Chain to KES via M-Pesa. No manual peer-to-peer matching required.',
        icon: <Globe className="w-12 h-12 text-blue-400" />,
        color: 'from-blue-500/20 to-cyan-500/20',
    },
    {
        id: 'security',
        title: 'Bank-Grade Security',
        description: 'All transactions are verified through MiniKit and World ID. We never touch your private keys.',
        icon: <ShieldCheck className="w-12 h-12 text-green-400" />,
        color: 'from-green-500/20 to-emerald-500/20',
    },
    {
        id: 'tech',
        title: 'Proof of Personhood',
        description: 'Powered by World ID 2.0 and the latest World Chain infrastructure for a secure, bot-free experience.',
        icon: <Cpu className="w-12 h-12 text-purple-400" />,
        color: 'from-purple-500/20 to-pink-500/20',
    },
    {
        id: 'compliance',
        title: 'Fully Compliant',
        description: 'We follow local regulations and M-Pesa B2B best practices to ensure your funds reach you safely.',
        icon: <CheckCircle2 className="w-12 h-12 text-white" />,
        color: 'from-gray-500/20 to-white/10',
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

    const prev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(s => s - 1);
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
            // Fallback: move to home anyway to not block user
            setOnboarded(true);
            setScreen('home');
        } finally {
            setLoading(false);
        }
    };

    const slide = slides[currentSlide];

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
            {/* Background Glow */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={slide.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 bg-gradient-to-b ${slide.color} to-transparent opacity-30`}
                />
            </AnimatePresence>

            {/* Slide Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -300, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        className="flex flex-col items-center text-center max-w-sm"
                    >
                        <div className="mb-8 p-6 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10">
                            {slide.icon}
                        </div>

                        <h2 className="text-4xl font-black mb-4 tracking-tight">
                            {slide.title}
                        </h2>

                        <p className="text-lg text-gray-400 leading-relaxed font-medium">
                            {slide.description}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Footer */}
            <div className="p-10 z-10 flex flex-col items-center bg-[#050505]/80 backdrop-blur-lg border-t border-white/5">
                {/* Progress Dots */}
                <div className="flex space-x-2 mb-8">
                    {slides.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 transition-all duration-300 rounded-full ${i === currentSlide ? 'w-8 bg-blue-500' : 'w-1.5 bg-white/10'
                                }`}
                        />
                    ))}
                </div>

                <div className="w-full flex items-center justify-between max-w-sm">
                    <button
                        onClick={prev}
                        disabled={currentSlide === 0 || loading}
                        className={`p-4 rounded-2xl transition-all ${currentSlide === 0 ? 'opacity-0' : 'bg-white/5 text-white hover:bg-white/10'
                            }`}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <button
                        onClick={next}
                        disabled={loading}
                        className="bg-white text-black font-black py-4 px-10 rounded-2xl flex items-center space-x-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center space-x-2">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                >
                                    <Cpu className="w-5 h-5" />
                                </motion.div>
                                <span>Processing...</span>
                            </span>
                        ) : (
                            <>
                                <span>{currentSlide === slides.length - 1 ? 'Get Started' : 'Continue'}</span>
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
