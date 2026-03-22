/**
 * server.ts — Express application entry point
 *
 * Boots the server and mounts all routes.
 *
 * TODO: PRODUCTION - Add helmet, rate limiting, and CORS origin whitelist
 *   (see TRANSITION_GUIDE.md Step 9)
 */

import dns from 'node:dns';
// Force Node to use external DNS servers, bypassing the problematic 
// Alpine/musl libc resolver that often fails with 127.0.0.53 stubs.
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { paymentRouter } from './routes/payment.routes';
import { ratesRouter } from './routes/rates.routes';
import { userRouter } from './routes/user.routes';
import { webhooksRouter } from './routes/webhooks.routes';
import { nonceRouter } from './routes/nonce.routes';
import { debugRouter } from './routes/debug.routes';
import { idkitRouter } from './routes/idkit.routes';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { cloudflareMiddleware } from './middleware/cloudflareMiddleware';

const app = express();

// Trust the first proxy hop (ngrok, nginx, cloudflare, etc.)
app.set('trust proxy', 1);

// Attach Cloudflare real-IP extraction middleware
app.use(cloudflareMiddleware);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests' },
}));

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS_ORIGIN env var — set to comma-separated origins in production.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'https://developer.worldcoin.org', '*'];

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/payment', paymentRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/user', userRouter);
app.use('/api/nonce', nonceRouter);
app.use('/api/debug', debugRouter);
app.use('/api/idkit', idkitRouter);
app.use('/api/mpesa', webhooksRouter);
app.use('/api/yellowcard', webhooksRouter);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Validation error', details: err.message });
    return;
  }

  // Known errors (e.g. "Transaction not found")
  if (err.message.includes('not found') || err.message.includes('Invalid')) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Generic 500
  res.status(500).json({
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.PORT, () => {
  console.log(`\n🚀 WLD2Mpesa backend running on http://localhost:${config.PORT}`);
  console.log(`   Health: http://localhost:${config.PORT}/api/health`);
  console.log(`   Rates:  http://localhost:${config.PORT}/api/rates/wld-kes`);
  console.log(`   Mode:   ${config.IS_PRODUCTION ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT'}\n`);
});

export { app };