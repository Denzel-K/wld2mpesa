/**
 * ProfileSetupModal.tsx — Profile completion modal for existing users
 *
 * Shown as an overlay on the Home screen when a verified user is missing
 * their profile details (fullName / email / phone).
 * Cannot be dismissed without completing or explicitly deferring.
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
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    BadgeCheck,
    Sparkles,
} from 'lucide-react';

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    onClose: () => void; // allows deferring once per session
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ProfileSetupModal: React.FC<Props> = ({ onClose }) => {
    const {
        walletAddress,
        wldUsername,
        fullName: storedFullName,
        userEmail: storedEmail,
        userPhone: storedPhone,
        setFullName,
        setUserEmail,
        setUserPhone,
        setProfileComplete,
    } = usePaymentStore();

    const [form, setForm] = useState({
        fullName: storedFullName || '',
        email: storedEmail || '',
        phone: storedPhone || '',
    });
    const [touched, setTouched] = useState({ fullName: false, email: false, phone: false });
    const [fieldErrors, setFieldErrors] = useState<UpdateProfileFieldErrors>({});
    const [serverError, setServerError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

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
        setTouched({ fullName: true, email: true, phone: true });

        const errs: UpdateProfileFieldErrors = {
            fullName: validateFullName(form.fullName) ?? undefined,
            email: validateEmail(form.email) ?? undefined,
            phone: validatePhone(form.phone) ?? undefined,
        };
        if (Object.values(errs).some(Boolean)) {
            setFieldErrors(errs);
            return;
        }

        if (!walletAddress) {
            setServerError('Session expired. Please logout and sign in again.');
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

            setFullName(updated.fullName || null);
            setUserEmail(updated.email || null);
            setUserPhone(updated.phone || null);
            setProfileComplete(true);

            setSuccess(true);
            setTimeout(onClose, 1200);
        } catch (err: any) {
            if (err?.statusCode === 400 && err?.fields) {
                setFieldErrors(err.fields);
            } else {
                setServerError(err.message || 'Failed to save profile. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Sheet */}
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative w-full max-w-md bg-[var(--bg-primary)] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-[var(--border-color)] overflow-hidden"
                >
                    {/* Handle bar (mobile) */}
                    <div className="flex justify-center pt-3 pb-1 sm:hidden">
                        <div className="w-10 h-1 rounded-full bg-[var(--border-color)]" />
                    </div>

                    {/* Header */}
                    <div className="flex items-start justify-between px-6 pt-4 pb-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center border border-[var(--accent)]/20">
                                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                            </div>
                            <div>
                                <h2 className="text-base font-black tracking-tight">Complete Your Profile</h2>
                                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-0.5">One-time setup</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all active:scale-95 disabled:opacity-40"
                            title="Remind me later"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* WLD Username badge */}
                    {wldUsername && (
                        <div className="mx-6 mb-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="text-[10px] text-[var(--text-secondary)]">
                                World ID: <span className="font-black text-[var(--text-primary)]">@{wldUsername}</span>
                            </span>
                        </div>
                    )}

                    <div className="px-6 pb-6">
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-5">
                            To receive transfer notifications and keep your account secure, please provide your details below.
                        </p>

                        <form onSubmit={handleSubmit} noValidate className="space-y-4">

                            {/* Full Name */}
                            <div>
                                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">
                                    Full Name <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                                        <User className={`w-3.5 h-3.5 transition-colors ${activeErrors.fullName ? 'text-red-400' : form.fullName ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                                    </div>
                                    <input
                                        type="text"
                                        value={form.fullName}
                                        onChange={handleChange('fullName')}
                                        onBlur={handleBlur('fullName')}
                                        placeholder="Jane Wanjiru Kamau"
                                        autoComplete="name"
                                        disabled={loading || success}
                                        className={`w-full pl-10 pr-9 py-3 rounded-xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                            ${activeErrors.fullName
                                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                                : form.fullName && !activeErrors.fullName && touched.fullName
                                                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                                    : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                            }`}
                                    />
                                    {touched.fullName && !activeErrors.fullName && form.fullName && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                    )}
                                </div>
                                <AnimatePresence>
                                    {activeErrors.fullName && (
                                        <motion.p
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="text-[10px] text-red-400 font-bold mt-1 ml-1 flex items-center gap-1 overflow-hidden"
                                        >
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                            {activeErrors.fullName}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                                        <Mail className={`w-3.5 h-3.5 transition-colors ${activeErrors.email ? 'text-red-400' : form.email ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
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
                                        className={`w-full pl-10 pr-9 py-3 rounded-xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                            ${activeErrors.email
                                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                                : form.email && !activeErrors.email && touched.email
                                                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                                    : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                            }`}
                                    />
                                    {touched.email && !activeErrors.email && form.email && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                    )}
                                </div>
                                <AnimatePresence>
                                    {activeErrors.email && (
                                        <motion.p
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="text-[10px] text-red-400 font-bold mt-1 ml-1 flex items-center gap-1 overflow-hidden"
                                        >
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                            {activeErrors.email}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">
                                    Phone Number <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                                        <Phone className={`w-3.5 h-3.5 transition-colors ${activeErrors.phone ? 'text-red-400' : form.phone ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
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
                                        className={`w-full pl-10 pr-9 py-3 rounded-xl bg-[var(--bg-secondary)] border text-sm font-medium placeholder:text-[var(--text-secondary)]/40 outline-none transition-all duration-200 focus:ring-2 disabled:opacity-50
                                            ${activeErrors.phone
                                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                                                : form.phone && !activeErrors.phone && touched.phone
                                                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                                                    : 'border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                                            }`}
                                    />
                                    {touched.phone && !activeErrors.phone && form.phone && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                    )}
                                </div>
                                <AnimatePresence>
                                    {activeErrors.phone && (
                                        <motion.p
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="text-[10px] text-red-400 font-bold mt-1 ml-1 flex items-center gap-1 overflow-hidden"
                                        >
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                            {activeErrors.phone}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Server error */}
                            <AnimatePresence>
                                {serverError && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl px-3 py-2.5 text-xs font-bold flex items-start gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                            {serverError}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || success}
                                className={`btn-mpesa h-12 w-full ${success ? 'bg-emerald-600' : ''}`}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2.5">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="font-bold text-sm">Saving…</span>
                                    </div>
                                ) : success ? (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="font-bold text-sm">Saved!</span>
                                    </div>
                                ) : (
                                    <span className="font-bold text-sm">Save Profile</span>
                                )}
                            </button>

                            <p className="text-[9px] text-center text-[var(--text-secondary)]/40 leading-relaxed">
                                You can update these details later from your profile settings.
                            </p>
                        </form>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
