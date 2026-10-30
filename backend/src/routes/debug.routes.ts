import { Router } from 'express';

const router = Router();

function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/([?&](?:token|secret|key|signature|proof|authorization|cookie|session)=)([^&\s]+)/gi, '$1[REDACTED]')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (['secret', 'token', 'password', 'authorization', 'cookie', 'session', 'privatekey', 'private_key', 'proof', 'signature', 'api_key', 'apiKey'].some(part => lower.includes(part))) {
        out[key] = '[REDACTED]';
        continue;
      }
      if ((lower.includes('address') || lower.includes('phone')) && typeof entry === 'string') {
        out[key] = entry.length > 8 ? `${entry.slice(0, 4)}…${entry.slice(-4)}` : '[REDACTED]';
        continue;
      }
      out[key] = sanitizeForLog(entry);
    }
    return out;
  }

  return value;
}

/**
 * POST /api/debug/log
 * Receives frontend errors and prints them to server stdout.
 * This makes browser-side errors visible in Docker logs.
 */
router.post('/log', (req, res) => {
    const { level = 'error', message, context, stack } = req.body;
    const prefix = { error: '❌', warn: '⚠️', info: '📘' }[level as string] ?? '❓';
    const safeContext = sanitizeForLog(context ?? {});
    const safeStack = typeof stack === 'string' ? sanitizeForLog(stack) : undefined;

    console.log(`[FRONTEND ${level.toUpperCase()}] ${prefix} ${message}`);
    if (safeContext && Object.keys(safeContext as Record<string, unknown>).length > 0) {
      console.log('  Context:', JSON.stringify(safeContext));
    }
    if (safeStack) console.log('  Stack:', safeStack);
    if (req.ip) console.log(`  Client IP: ${req.ip}`);
    if (req.get('origin')) console.log(`  Origin: ${req.get('origin')}`);
    return res.json({ ok: true });
});

export const debugRouter = router;
