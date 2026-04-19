/**
 * ErrorDisplay.tsx — User-friendly error display component
 *
 * Displays errors with:
 * - Clear, non-technical titles
 * - Actionable explanations
 * - Visual severity indicators
 * - Next-step guidance
 */

import { AlertCircle, Wallet, Wifi, RefreshCw, Clock, Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getErrorInfo, formatErrorForDisplay, type ErrorInfo } from '@/lib/errorCodes';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  error: string | Error | { code?: string; message?: string } | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

const iconMap = {
  alert: AlertTriangle,
  wallet: Wallet,
  network: Wifi,
  refresh: RefreshCw,
  clock: Clock,
  phone: Smartphone,
  success: CheckCircle2,
};

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
  showIcon = true,
  compact = false,
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorInfo: ErrorInfo = typeof error === 'string' && error.startsWith('{')
    ? getErrorInfo(JSON.parse(error))
    : getErrorInfo(error);

  const { title, description, action, color, bgColor } = formatErrorForDisplay(errorInfo);
  const Icon = iconMap[errorInfo.icon || 'alert'] || AlertTriangle;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
        bgColor,
        color,
        className
      )}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{title}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto underline hover:no-underline font-semibold"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-sm',
        bgColor,
        errorInfo.severity === 'error' && 'border-red-200',
        errorInfo.severity === 'warning' && 'border-amber-200',
        errorInfo.severity === 'info' && 'border-blue-200',
        className
      )}
    >
      <div className="flex gap-3">
        {showIcon && (
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            errorInfo.severity === 'error' && 'bg-red-100 text-red-600',
            errorInfo.severity === 'warning' && 'bg-amber-100 text-amber-600',
            errorInfo.severity === 'info' && 'bg-blue-100 text-blue-600',
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className={cn('font-semibold text-base mb-1', color)}>
            {title}
          </h3>

          <p className="text-[var(--text-secondary)] text-sm mb-2">
            {description}
          </p>

          <p className="text-[var(--text-primary)] text-sm font-medium">
            {action}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  errorInfo.severity === 'error' && 'bg-red-600 text-white hover:bg-red-700',
                  errorInfo.severity === 'warning' && 'bg-amber-600 text-white hover:bg-amber-700',
                  errorInfo.severity === 'info' && 'bg-blue-600 text-white hover:bg-blue-700',
                )}
              >
                Try Again
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-black/5 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Error code for debugging (only in dev mode) */}
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
              Code: {errorInfo.code}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error message for forms
 */
export function FormError({ error, className }: { error: string | null; className?: string }) {
  if (!error) return null;

  const errorInfo = getErrorInfo(error);
  const { color, bgColor } = formatErrorForDisplay(errorInfo);

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-fade-in',
      bgColor,
      color,
      className
    )}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{errorInfo.message}</span>
    </div>
  );
}

/**
 * Success message display
 */
export function SuccessDisplay({
  title,
  message,
  className,
}: {
  title: string;
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      'rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm',
      className
    )}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-800 text-base mb-1">{title}</h3>
          {message && (
            <p className="text-green-700 text-sm">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state with step indicator
 */
export function LoadingStep({
  step,
  totalSteps,
  description,
  className,
}: {
  step: number;
  totalSteps: number;
  description: string;
  className?: string;
}) {
  const progress = (step / totalSteps) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {description}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          Step {step} of {totalSteps}
        </span>
      </div>

      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
