/**
 * errorCodes.ts — User-friendly error codes and messages
 *
 * Maps backend errors to actionable, user-friendly messages.
 * Every error has:
 * - code: Machine-readable identifier
 * - title: Short error name
 * - message: User-friendly explanation
 * - action: What the user should do next
 * - severity: 'error' | 'warning' | 'info'
 */

export interface ErrorInfo {
  code: string;
  title: string;
  message: string;
  action: string;
  severity: 'error' | 'warning' | 'info';
  icon?: 'alert' | 'wallet' | 'network' | 'refresh' | 'clock';
}

// Error code mappings
const errorCodeMap: Record<string, ErrorInfo> = {
  // Payment initiation errors
  'INVALID_AMOUNT': {
    code: 'INVALID_AMOUNT',
    title: 'Invalid Amount',
    message: 'The amount must be between KES 10 and KES 150,000.',
    action: 'Please enter a valid amount within this range.',
    severity: 'warning',
    icon: 'alert',
  },
  'INVALID_PHONE': {
    code: 'INVALID_PHONE',
    title: 'Invalid Phone Number',
    message: 'The phone number format is not valid.',
    action: 'Please enter a valid Safaricom number (e.g., 0712 345 678).',
    severity: 'warning',
    icon: 'alert',
  },
  'INVALID_PAYBILL': {
    code: 'INVALID_PAYBILL',
    title: 'Invalid Paybill Number',
    message: 'The paybill or business number is not valid.',
    action: 'Please check and enter a correct 5-7 digit paybill number.',
    severity: 'warning',
    icon: 'alert',
  },
  'INVALID_TILL': {
    code: 'INVALID_TILL',
    title: 'Invalid Till Number',
    message: 'The till number must be 5 or 6 digits.',
    action: 'Please enter a valid till number for Buy Goods.',
    severity: 'warning',
    icon: 'alert',
  },
  'MISSING_ACCOUNT': {
    code: 'MISSING_ACCOUNT',
    title: 'Account Number Required',
    message: 'Paybill payments require an account number.',
    action: 'Please enter the account number for this paybill.',
    severity: 'warning',
    icon: 'alert',
  },

  // Blockchain errors
  'BLOCKCHAIN_CONFIRM_FAILED': {
    code: 'BLOCKCHAIN_CONFIRM_FAILED',
    title: 'Payment Not Verified',
    message: 'We could not confirm your WLD payment on the blockchain.',
    action: 'Your funds are safe. Please try again or contact support if this persists.',
    severity: 'error',
    icon: 'network',
  },
  'INSUFFICIENT_BALANCE': {
    code: 'INSUFFICIENT_BALANCE',
    title: 'Insufficient WLD Balance',
    message: 'Your wallet does not have enough WLD for this transaction.',
    action: 'Please top up your World App wallet or reduce the amount.',
    severity: 'warning',
    icon: 'wallet',
  },
  'TRANSACTION_REJECTED': {
    code: 'TRANSACTION_REJECTED',
    title: 'Transaction Rejected',
    message: 'The transaction was rejected by the blockchain.',
    action: 'This may be due to network congestion. Please try again in a few moments.',
    severity: 'warning',
    icon: 'refresh',
  },

  // Bitnob/MPESA errors
  'BITNOB_PAYOUT_FAILED': {
    code: 'BITNOB_PAYOUT_FAILED',
    title: 'MPESA Transfer Failed',
    message: 'We could not complete the MPESA transfer.',
    action: 'Your WLD will be refunded. Please check the recipient details and try again.',
    severity: 'error',
    icon: 'network',
  },
  'BITNOB_API_ERROR': {
    code: 'BITNOB_API_ERROR',
    title: 'Service Temporarily Unavailable',
    message: 'Our payment partner is experiencing issues.',
    action: 'Please try again in a few minutes. Your WLD is safe.',
    severity: 'warning',
    icon: 'clock',
  },
  'PAYOUT_TIMEOUT': {
    code: 'PAYOUT_TIMEOUT',
    title: 'Transfer Taking Longer',
    message: 'The MPESA transfer is taking longer than expected.',
    action: 'We are monitoring this. You will receive your funds or a full refund.',
    severity: 'info',
    icon: 'clock',
  },
  'INVALID_PHONE_MPESA': {
    code: 'INVALID_PHONE_MPESA',
    title: 'Invalid MPESA Number',
    message: 'The recipient number is not registered on MPESA.',
    action: 'Please verify the phone number and ensure it is active on MPESA.',
    severity: 'warning',
    icon: 'alert',
  },

  // World ID errors
  'WORLD_ID_FAILED': {
    code: 'WORLD_ID_FAILED',
    title: 'Verification Failed',
    message: 'World ID verification could not be completed.',
    action: 'Please ensure you have completed the Orb verification and try again.',
    severity: 'warning',
    icon: 'alert',
  },
  'WORLD_ID_CANCELLED': {
    code: 'WORLD_ID_CANCELLED',
    title: 'Verification Cancelled',
    message: 'You cancelled the World ID verification.',
    action: 'Please complete verification to proceed with the payment.',
    severity: 'info',
    icon: 'alert',
  },

  // MiniKit errors
  'MINIKIT_PAY_FAILED': {
    code: 'MINIKIT_PAY_FAILED',
    title: 'Payment Failed',
    message: 'The payment could not be completed in World App.',
    action: 'Please ensure you have sufficient WLD and try again.',
    severity: 'error',
    icon: 'wallet',
  },
  'MINIKIT_CANCELLED': {
    code: 'MINIKIT_CANCELLED',
    title: 'Payment Cancelled',
    message: 'You cancelled the payment in World App.',
    action: 'No funds were deducted. You can try again when ready.',
    severity: 'info',
    icon: 'alert',
  },
  'USER_INSUFFICIENT_BALANCE': {
    code: 'USER_INSUFFICIENT_BALANCE',
    title: 'Insufficient Balance',
    message: 'You do not have enough WLD in your World App wallet.',
    action: `Please add WLD to your wallet or reduce the amount.`,
    severity: 'warning',
    icon: 'wallet',
  },

  // Transaction state errors
  'TXN_NOT_FOUND': {
    code: 'TXN_NOT_FOUND',
    title: 'Transaction Not Found',
    message: 'We could not find this transaction.',
    action: 'Please check your transaction history or contact support.',
    severity: 'error',
    icon: 'alert',
  },
  'TXN_ALREADY_CONFIRMED': {
    code: 'TXN_ALREADY_CONFIRMED',
    title: 'Already Confirmed',
    message: 'This transaction has already been processed.',
    action: 'Please check your transaction status for updates.',
    severity: 'info',
    icon: 'alert',
  },
  'TXN_FAILED': {
    code: 'TXN_FAILED',
    title: 'Transaction Failed',
    message: 'The transaction could not be completed.',
    action: 'Your WLD will be refunded. Please try again or contact support.',
    severity: 'error',
    icon: 'alert',
  },
  'TXN_EXPIRED': {
    code: 'TXN_EXPIRED',
    title: 'Transaction Expired',
    message: 'This transaction has expired.',
    action: 'Please initiate a new payment. Rates may have changed.',
    severity: 'warning',
    icon: 'clock',
  },

  // Network/Rate errors
  'RATE_FETCH_FAILED': {
    code: 'RATE_FETCH_FAILED',
    title: 'Rate Unavailable',
    message: 'We could not fetch the current exchange rate.',
    action: 'Please try again in a moment. Your transaction is safe.',
    severity: 'warning',
    icon: 'refresh',
  },
  'NETWORK_ERROR': {
    code: 'NETWORK_ERROR',
    title: 'Connection Issue',
    message: 'Unable to connect to our servers.',
    action: 'Please check your internet connection and try again.',
    severity: 'warning',
    icon: 'network',
  },

  // Generic fallback
  'UNKNOWN_ERROR': {
    code: 'UNKNOWN_ERROR',
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    action: 'Please try again or contact support if the issue persists.',
    severity: 'error',
    icon: 'alert',
  },
};

/**
 * Get user-friendly error info from error code or message
 */
export function getErrorInfo(error: string | Error | { code?: string; message?: string }): ErrorInfo {
  // Extract error code from various formats
  let code = 'UNKNOWN_ERROR';
  let message = '';

  if (typeof error === 'string') {
    code = extractErrorCode(error);
    message = error;
  } else if (error instanceof Error) {
    code = extractErrorCode(error.message);
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    code = error.code || extractErrorCode(error.message || '');
    message = error.message || '';
  }

  // Try to find exact match first
  if (errorCodeMap[code]) {
    return errorCodeMap[code];
  }

  // Try pattern matching for dynamic errors
  const patternMatch = findPatternMatch(message);
  if (patternMatch) {
    return patternMatch;
  }

  // Return generic error with actual message
  return {
    ...errorCodeMap['UNKNOWN_ERROR'],
    message: message || errorCodeMap['UNKNOWN_ERROR'].message,
  };
}

/**
 * Extract error code from error message
 */
function extractErrorCode(message: string): string {
  if (!message) return 'UNKNOWN_ERROR';

  // Check for explicit error codes in brackets or quotes
  const codeMatch = message.match(/\[([A-Z_]+)\]|"code":\s*"([A-Z_]+)"|'code':\s*'([A-Z_]+)'/);
  if (codeMatch) {
    return codeMatch[1] || codeMatch[2] || codeMatch[3];
  }

  // Check for known patterns
  const patterns: Record<string, string> = {
    'amount must be between': 'INVALID_AMOUNT',
    'invalid phone': 'INVALID_PHONE',
    'paybill must be': 'INVALID_PAYBILL',
    'till number must be': 'INVALID_TILL',
    'account number is required': 'MISSING_ACCOUNT',
    'insufficient balance': 'INSUFFICIENT_BALANCE',
    'could not be verified': 'BLOCKCHAIN_CONFIRM_FAILED',
    'payout failed': 'BITNOB_PAYOUT_FAILED',
    'timed out': 'PAYOUT_TIMEOUT',
    'world id': 'WORLD_ID_FAILED',
    'cancelled': 'MINIKIT_CANCELLED',
    'not found': 'TXN_NOT_FOUND',
    'already': 'TXN_ALREADY_CONFIRMED',
    'rate': 'RATE_FETCH_FAILED',
    'network': 'NETWORK_ERROR',
    'connection': 'NETWORK_ERROR',
  };

  const lowerMessage = message.toLowerCase();
  for (const [pattern, code] of Object.entries(patterns)) {
    if (lowerMessage.includes(pattern)) {
      return code;
    }
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Find error by pattern matching on message
 */
function findPatternMatch(message: string): ErrorInfo | null {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
    return {
      code: 'BITNOB_API_ERROR',
      title: 'Authentication Error',
      message: 'Could not connect to payment service.',
      action: 'Please try again in a moment.',
      severity: 'warning',
      icon: 'refresh',
    };
  }

  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
    return {
      code: 'BITNOB_API_ERROR',
      title: 'Too Many Requests',
      message: 'We are experiencing high traffic.',
      action: 'Please wait a moment and try again.',
      severity: 'info',
      icon: 'clock',
    };
  }

  if (lowerMessage.includes('insufficient') && lowerMessage.includes('balance')) {
    return errorCodeMap['USER_INSUFFICIENT_BALANCE'];
  }

  return null;
}

/**
 * Get step descriptions for transaction progress
 */
export function getStepDescription(step: number, transactionType: string): string {
  const steps: Record<number, string> = {
    0: 'Preparing your transaction...',
    1: 'Verifying WLD payment on World Chain...',
    2: `Converting to ${getTransactionTypeName(transactionType)} via Bitnob...`,
    3: 'Rebalancing liquidity...',
    4: 'Completing MPESA transfer...',
  };
  return steps[step] || 'Processing...';
}

function getTransactionTypeName(type: string): string {
  const names: Record<string, string> = {
    'send': 'Send Money',
    'pochi': 'Pochi la Biashara',
    'paybill': 'Paybill',
    'till': 'Buy Goods',
  };
  return names[type] || 'MPESA';
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: ErrorInfo): {
  title: string;
  description: string;
  action: string;
  color: string;
  bgColor: string;
} {
  const colors = {
    error: { color: 'text-red-600', bgColor: 'bg-red-50' },
    warning: { color: 'text-amber-600', bgColor: 'bg-amber-50' },
    info: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  };

  const { color, bgColor } = colors[error.severity];

  return {
    title: error.title,
    description: error.message,
    action: error.action,
    color,
    bgColor,
  };
}
