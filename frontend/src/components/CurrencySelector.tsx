import { usePaymentStore } from '@/stores/paymentStore';
import { cn } from '@/lib/utils';

const CURRENCIES = [
    { code: 'KES', label: 'Shilling' },
    { code: 'USD', label: 'Dollar' },
    { code: 'EUR', label: 'Euro' },
    { code: 'GBP', label: 'Pound' },
    { code: 'ZAR', label: 'Rand' },
    { code: 'NGN', label: 'Naira' },
    { code: 'UGX', label: 'Ugandan' },
    { code: 'TZS', label: 'Tanzanian' },
];

export default function CurrencySelector() {
    const { selectedCurrency = 'KES', setSelectedCurrency } = usePaymentStore();

    return (
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
            <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl gap-1 border border-[var(--border-color)] min-w-max">
                {CURRENCIES.map((curr) => (
                    <button
                        key={curr.code}
                        onClick={() => setSelectedCurrency(curr.code)}
                        className={cn(
                            "py-1.5 px-4 rounded-xl text-[10px] font-bold transition-all duration-300 uppercase tracking-wider",
                            selectedCurrency === curr.code
                                ? "bg-[var(--accent)] text-white shadow-[0_5px_15px_var(--accent-glow)] scale-100"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 active:scale-95"
                        )}
                    >
                        {curr.code}
                    </button>
                ))}
            </div>
        </div>
    );
}
