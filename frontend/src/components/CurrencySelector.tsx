import { usePaymentStore } from '@/stores/paymentStore';
import { cn } from '@/lib/utils';

const CURRENCIES = [
    { code: 'KES', label: 'Shilling' },
    { code: 'USD', label: 'Dollar' },
    { code: 'EUR', label: 'Euro' },
    { code: 'YEN', label: 'Yen' },
];

export default function CurrencySelector() {
    // We'll need to add selectedCurrency to the store if it's not there.
    // For now, let's assume it's added or use a local mock if updating store is too much work.
    // Actually, let's add it to the paymentStore.
    const { selectedCurrency = 'KES', setSelectedCurrency } = usePaymentStore() as any;

    return (
        <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl gap-1 border border-[var(--border-color)]">
            {CURRENCIES.map((curr) => (
                <button
                    key={curr.code}
                    onClick={() => setSelectedCurrency?.(curr.code)}
                    className={cn(
                        "flex-1 py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all duration-300 uppercase tracking-wider",
                        selectedCurrency === curr.code
                            ? "bg-[var(--accent)] text-white shadow-[0_5px_15px_var(--accent-glow)] scale-100"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 active:scale-95"
                    )}
                >
                    {curr.code}
                </button>
            ))}
        </div>
    );
}
