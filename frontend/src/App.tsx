/**
 * App.tsx — Root component
 */

import { useEffect } from 'react';
import { initMiniKit, isInsideWorldApp } from './lib/minikit';
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

// Components
import DevModePanel from './components/DevModePanel';

export default function App() {
  const {
    screen, setScreen, devMode,
    setRate, setRateLoading, setRateError,
    addSimLog
  } = usePaymentStore();

  // ── MiniKit init ──────────────────────────────────────────────────────────
  useEffect(() => {
    initMiniKit();
    addSimLog('info', 'MiniKit initialised');
    addSimLog(
      isInsideWorldApp() ? 'success' : 'warn',
      isInsideWorldApp() ? 'Running inside World App' : 'Not in World App — simulation mode active'
    );
    // Start at verification
    setScreen('verification');
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
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col max-w-md mx-auto relative overflow-x-hidden dark">
      {/* Main screen */}
      <main className="flex-1 flex flex-col">
        {renderScreen()}
      </main>

      {/* Developer Mode panel (bottom) - strictly for internal debug */}
      {devMode && <DevModePanel />}
    </div>
  );
}
