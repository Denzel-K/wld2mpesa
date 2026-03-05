import { Router } from 'express';

const router = Router();

/**
 * POST /api/debug/log
 * Receives frontend errors and prints them to server stdout.
 * This makes browser-side errors visible in Docker logs.
 */
router.post('/log', (req, res) => {
    const { level = 'error', message, context, stack } = req.body;
    const prefix = { error: '❌', warn: '⚠️', info: '📘' }[level as string] ?? '❓';
    console.log(`[FRONTEND ${level.toUpperCase()}] ${prefix} ${message}`);
    if (context) console.log(`  Context:`, JSON.stringify(context));
    if (stack) console.log(`  Stack:`, stack);
    return res.json({ ok: true });
});

export const debugRouter = router;
