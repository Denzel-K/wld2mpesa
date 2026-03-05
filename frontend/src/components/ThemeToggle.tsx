import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const themes: { id: 'light' | 'dark' | 'system'; icon: React.ReactNode; label: string }[] = [
        { id: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
        { id: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
        { id: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    ];

    return (
        <div className="flex items-center bg-[var(--bg-secondary)] p-1 rounded-2xl border border-[var(--border-color)]">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative flex items-center justify-center p-2 rounded-xl transition-all duration-300 ${theme === t.id
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    title={t.label}
                >
                    {theme === t.id && (
                        <motion.div
                            layoutId="active-theme"
                            className="absolute inset-0 bg-[var(--card-bg)] shadow-sm rounded-xl border border-[var(--border-color)]"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <span className="relative z-10">{t.icon}</span>
                </button>
            ))}
        </div>
    );
};
