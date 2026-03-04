/**
 * server.ts — Express application entry point
 *
 * Boots the server and mounts all routes.
 *
 * TODO: PRODUCTION - Add helmet, rate limiting, and CORS origin whitelist
 *   (see TRANSITION_GUIDE.md Step 9)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { paymentRouter } from './routes/payment.routes';
import { ratesRouter } from './routes/rates.routes';
import { userRouter } from './routes/user.routes';
import { webhooksRouter } from './routes/webhooks.routes';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(helmet());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 req/min
  message: { error: 'Too many requests' },
}));

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS_ORIGIN env var — set to comma-separated origins in production.
// When served through nginx (Docker prod) or Vite proxy (dev), the browser
// sees same-origin requests so CORS is a non-issue; '*' is safe for the MVP.
// TODO: PRODUCTION - Restrict to your actual frontend domain: CORS_ORIGIN=https://yourdomain.com
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', '*'];
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
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
    simulationMode: config.SIMULATION_MODE,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/payment', paymentRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/user', userRouter);
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
  console.log(`   Mode:   ${config.SIMULATION_MODE ? '🟡 SIMULATION' : '🔴 PRODUCTION'}\n`);
});

export { app };