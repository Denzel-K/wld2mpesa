/**
 * App.tsx — Root component
 */

import { useEffect } from 'react';
import { initMiniKit } from './lib/minikit';
import { usePaymentStore } from './stores/paymentStore';
import { fetchRate } from './lib/api';

// Pages
import HomePage from './pages/HomePage';
import PaymentFormPage from './pages/PaymentFormPage';
import ConfirmationPage from './pages/ConfirmationPage';
import StatusPage from './pages/StatusPage';
import SuccessPage from './pages/SuccessPage';
import FailurePage from './pages/FailurePage';
import { VerificationPage } from './pages/VerificationPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { WelcomePage } from './pages/WelcomePage';

// Components
import DevModePanel from './components/DevModePanel';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  const {
    screen, setScreen, devMode,
    addSimLog
  } = usePaymentStore();

  const {
    setRate, setRateLoading, setRateError
  } = usePaymentStore();

  // ── MiniKit init ──────────────────────────────────────────────────────────
  useEffect(() => {
    initMiniKit();
    addSimLog('info', 'MiniKit initialised');
    // Start at welcome
    setScreen('welcome');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pre-fetch rate on mount ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setRateLoading(true);
      try {
        const rate = await fetchRate();
        setRate(rate);
        addSimLog('info', `Rate fetched: 1 WLD = KSh ${rate.wldPriceKes.toFixed(2)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch rate';
        setRateError(msg);
        addSimLog('error', `Rate fetch failed: ${msg}`);
      } finally {
        setRateLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Screen router ─────────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case 'welcome':
        return <WelcomePage />;
      case 'verification':
        return <VerificationPage />;
      case 'onboarding':
        return <OnboardingPage />;
      case 'home':
        return <HomePage />;
      case 'payment-form':
        return <PaymentFormPage />;
      case 'confirmation':
        return <ConfirmationPage />;
      case 'status':
        return <StatusPage />;
      case 'success':
        return <SuccessPage />;
      case 'failure':
        return <FailurePage />;
      default:
        return <WelcomePage />;
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col max-w-md mx-auto relative overflow-x-hidden">
        {/* Main screen */}
        <main className="flex-1 flex flex-col">
          {renderScreen()}
        </main>

        {/* Developer Mode panel (bottom) - strictly for internal debug */}
        {devMode && <DevModePanel />}
      </div>
    </ThemeProvider>
  );
}
