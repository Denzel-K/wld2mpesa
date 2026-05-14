/**
 * ProfileSetupPage.tsx — Collect user profile details after World ID verification
 *
 * Shown to NEW users immediately after successful verification.
 * Collects: Full Name (official), Email, Phone Number.
 * The WLD username (read-only, from World ID) is shown as context.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaymentStore } from '../stores/paymentStore';
import * as api from '../lib/api';
import type { UpdateProfileFieldErrors } from '../lib/api';
import {
    User,
    Mail,
    Phone,
    ArrowRight,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
    BadgeCheck,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateFullName(v: string): string | null {
    if (!v.trim()) return 'Full name is required.';
    if (v.trim().length < 2) return 'Must be at least 2 characters.';
    if (v.trim().length > 100) return 'Must be under 100 characters.';
    if (!/^[a-zA-Z\s'\-\.]+$/.test(v.trim())) return 'Only letters, spaces, hyphens and apostrophes allowed.';
    return null;
}

function validateEmail(v: string): string | null {
    if (!v.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return null;
}

function validatePhone(v: string): string | null {
    if (!v.trim()) return 'Phone number is required.';
    const cleaned = v.replace(/[\s\-()]/g, '');
    if (!/^(\+?254|0)[17]\d{8}$/.test(cleaned)) {
        return 'Enter a valid Kenyan number (e.g. 0712345678 or +254712345678).';
    }
    return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ProfileSetupPage: React.FC = () => {
    const {
        setScreen,
        walletAddress,
        wldUsername,
        setFullName,
        setUserEmail,
        setUserPhone,
        setProfileComplete,
        setOnboarded,
    } = usePaymentStore();

    const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
    const [touched, setTouched] = useState({ fullName: false, email: false, phone: false });
    const [fieldErrors, setFieldErrors] = useState<UpdateProfileFieldErrors>({});
    const [serverError, setServerError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Live per-field validation (only shown after field is touched)
    const liveErrors: UpdateProfileFieldErrors = {
        fullName: touched.fullName ? (validateFullName(form.fullName) ?? undefined) : undefined,
        email: touched.email ? (validateEmail(form.email) ?? undefined) : undefined,
        phone: touched.phone ? (validatePhone(form.phone) ?? undefined) : undefined,
    };

    const activeErrors = Object.keys(fieldErrors).length > 0 ? fieldErrors : liveErrors;

    const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        setFieldErrors(prev => ({ ...prev, [field]: undefined }));
        setServerError(null);
    };

    const handleBlur = (field: keyof typeof touched) => () => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Mark all fields touched
        setTouched({ fullName: true, email: true, phone: true });

        // Client-side validation
        const errs: UpdateProfileFieldErrors = {
            fullName: validateFullName(form.fullName) ?? undefined,
            email: validateEmail(form.email) ?? undefined,
            phone: validatePhone(form.phone) ?? undefined,
        };
        const hasErrors = Object.values(errs).some(Boolean);
        if (hasErrors) {
            setFieldErrors(errs);
            return;
        }

        if (!walletAddress) {
            setServerError('Session expired. Please restart verification.');
            return;
        }

        setLoading(true);
        setServerError(null);
        setFieldErrors({});

        try {
            const updated = await api.updateUserProfile(walletAddress, {
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim(),
            });

            // Hydrate store with confirmed server values
            setFullName(updated.fullName || null);
            setUserEmail(updated.email || null);
            setUserPhone(updated.phone || null);
            setProfileComplete(true);
            setOnboarded(updated.onboarded);

            setSuccess(true);
            setTimeout(() => {
                setScreen(updated.onboarded ? 'home' : 'onboarding');
            }, 1000);
        } catch (err: any) {
            // Backend field-level errors
            if (err?.statusCode === 400 && err?.fields) {
                setFieldErrors(err.fields);
            } else {
                setServerError(err.message || 'Failed to save profile. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const isFormDirty = form.fullName || form.email || form.phone;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--accent)]/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-[var(--accent)]/3 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-12 pb-4 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary)]">Profile Setup</span>
                </div>
                <ThemeToggle />
            </div>

            <div className="flex-1 flex flex-col px-6 pb-8 z-10 overflow-y-auto">
                {/* Identity confirmed banner */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 mb-6"
                >
                    <BadgeCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">World ID Verified</p>
                        {wldUsername && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                Signed in as <span className="font-bold text-[var(--text-primary)]">@{wldUsername}</span>
                            </p>
                        )}
                    </div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-8"
                >
                    <h1 className="text-2xl font-black tracking-tight font-display mb-2">Complete Your Profile</h1>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        We need a few details so we can reach you about your transfers and keep your account secure.
                    </p>
                </motion.div>

                {/* WLD Username (read-only) */}
                {wldUsername && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-5"
                    >
                        <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            World ID Username
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                <BadgeCheck className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-bold opacity-75 cursor-not-allowed flex items-center justify-between">
                                <span>@{wldUsername}</span>
                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Read-only</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 ml-1 opacity-60">
                            This is your World App identity. It cannot be changed here.
                        </p>
                    </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} noValidate className="space-y-5 flex-1">

                    {/* Full Name */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            Full Name <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                <User className={`w-4 h-4 transition-colors ${activeErrors.fullName ? 'text-red-400' : form.fullName ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                            </div>
                            <input
                                type="text"
                                value={form.fullName}
                                onChange={handleChange('fullName')}
                                onBlur={handleBlur('fullName')}
                                placeholder="e.g. Jane Wanjiru Kamau"
                                autoComplete="name"
                                disabled={loading || success}
                                className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                    ${activeErrors.fullName
                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                        : form.fullName && !activeErrors.fullName && touched.fullName
                                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                            : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                    }`}
                            />
                            {touched.fullName && !activeErrors.fullName && form.fullName && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                            )}
                        </div>
                        <AnimatePresence>
                            {activeErrors.fullName && (
                                <motion.p
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 flex items-center gap-1 overflow-hidden"
                                >
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    {activeErrors.fullName}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Email */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            Email Address <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                <Mail className={`w-4 h-4 transition-colors ${activeErrors.email ? 'text-red-400' : form.email ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                            </div>
                            <input
                                type="email"
                                value={form.email}
                                onChange={handleChange('email')}
                                onBlur={handleBlur('email')}
                                placeholder="jane@example.com"
                                autoComplete="email"
                                inputMode="email"
                                disabled={loading || success}
                                className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                    ${activeErrors.email
                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                        : form.email && !activeErrors.email && touched.email
                                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                            : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                    }`}
                            />
                            {touched.email && !activeErrors.email && form.email && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                            )}
                        </div>
                        <AnimatePresence>
                            {activeErrors.email && (
                                <motion.p
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 flex items-center gap-1 overflow-hidden"
                                >
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    {activeErrors.email}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Phone */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                    >
                        <label className="block text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            Phone Number <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                <Phone className={`w-4 h-4 transition-colors ${activeErrors.phone ? 'text-red-400' : form.phone ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                            </div>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={handleChange('phone')}
                                onBlur={handleBlur('phone')}
                                placeholder="0712 345 678"
                                autoComplete="tel"
                                inputMode="tel"
                                disabled={loading || success}
                                className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                    ${activeErrors.phone
                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                        : form.phone && !activeErrors.phone && touched.phone
                                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                            : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                    }`}
                            />
                            {touched.phone && !activeErrors.phone && form.phone && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                            )}
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1.5 ml-1 opacity-60">
                            Kenyan number only — e.g. 0712345678 or +254712345678
                        </p>
                        <AnimatePresence>
                            {activeErrors.phone && (
                                <motion.p
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 flex items-center gap-1 overflow-hidden"
                                >
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    {activeErrors.phone}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Server error */}
                    <AnimatePresence>
                        {serverError && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-2xl px-4 py-3 text-xs font-bold flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    {serverError}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="pt-2"
                    >
                        <button
                            type="submit"
                            disabled={loading || success || !isFormDirty}
                            className={`btn-mpesa h-14 group relative overflow-hidden w-full ${success ? 'bg-emerald-600' : ''}`}
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="font-bold">Saving Profile…</span>
                                </div>
                            ) : success ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-bold">Profile Saved!</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg">Continue</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </button>
                    </motion.div>
                </form>

                {/* Privacy note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-[9px] text-center text-[var(--text-secondary)]/40 mt-6 leading-relaxed"
                >
                    Your details are encrypted and used only for transaction notifications and account recovery.
                    We never share your information with third parties.
                </motion.p>
            </div>
        </div>
    );
};
