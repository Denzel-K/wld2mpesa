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
        <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
            {CURRENCIES.map((curr) => (
                <button
                    key={curr.code}
                    onClick={() => setSelectedCurrency?.(curr.code)}
                    className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300",
                        selectedCurrency === curr.code
                            ? "bg-white text-mpesa-green shadow-sm scale-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-white/50 active:scale-95"
                    )}
                >
                    {curr.code}
                </button>
            ))}
        </div>
    );
}
