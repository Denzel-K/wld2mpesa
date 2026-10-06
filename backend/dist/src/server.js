"use strict";
/**
 * server.ts — Express application entry point
 *
 * Boots the server and mounts all routes.
 *
 * TODO: PRODUCTION - Add helmet, rate limiting, and CORS origin whitelist
 *   (see TRANSITION_GUIDE.md Step 9)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const node_dns_1 = __importDefault(require("node:dns"));
// Force Node to use external DNS servers, bypassing the problematic 
// Alpine/musl libc resolver that often fails with 127.0.0.53 stubs.
node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const payment_routes_1 = require("./routes/payment.routes");
const rates_routes_1 = require("./routes/rates.routes");
const user_routes_1 = require("./routes/user.routes");
const webhooks_routes_1 = require("./routes/webhooks.routes");
const nonce_routes_1 = require("./routes/nonce.routes");
const debug_routes_1 = require("./routes/debug.routes");
const idkit_routes_1 = require("./routes/idkit.routes");
const bitnob_routes_1 = require("./routes/bitnob.routes");
const contact_routes_1 = require("./routes/contact.routes");
const admin_routes_1 = require("./routes/admin.routes");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cloudflareMiddleware_1 = require("./middleware/cloudflareMiddleware");
const app = (0, express_1.default)();
exports.app = app;
// Trust the first proxy hop (ngrok, nginx, cloudflare, etc.)
app.set('trust proxy', 1);
// Attach Cloudflare real-IP extraction middleware
app.use(cloudflareMiddleware_1.cloudflareMiddleware);
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests' },
}));
// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS_ORIGIN env var — set to comma-separated origins in production.
const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'https://developer.worldcoin.org', '*'];
app.use((0, cors_1.default)({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '1mb' }));
// Request logger
app.use((req, _res, next) => {
    logger_1.logger.info('API', `${req.method} ${req.path}`, undefined, req.body && Object.keys(req.body).length > 0
        ? { bodyKeys: Object.keys(req.body) }
        : undefined);
    next();
});
// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
app.use('/api/payment', payment_routes_1.paymentRouter);
app.use('/api/rates', rates_routes_1.ratesRouter);
app.use('/api/user', user_routes_1.userRouter);
app.use('/api/nonce', nonce_routes_1.nonceRouter);
app.use('/api/debug', debug_routes_1.debugRouter);
app.use('/api/idkit', idkit_routes_1.idkitRouter);
app.use('/api/mpesa', webhooks_routes_1.webhooksRouter);
app.use('/api/webhooks/bitnob', bitnob_routes_1.bitnobRouter);
app.use('/api/yellowcard', webhooks_routes_1.webhooksRouter);
app.use('/api/contact', contact_routes_1.contactRouter);
app.use('/api/admin', admin_routes_1.adminRouter);
// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
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
        error: config_1.config.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
});
// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(config_1.config.PORT, () => {
    console.log(`\n🚀 WLD2Mpesa backend running on http://localhost:${config_1.config.PORT}`);
    console.log(`   Health: http://localhost:${config_1.config.PORT}/api/health`);
    console.log(`   Rates:  http://localhost:${config_1.config.PORT}/api/rates/wld-kes`);
    console.log(`   Mode:   ${config_1.config.IS_PRODUCTION ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT'}\n`);
    logger_1.logger.startupBanner(config_1.config.IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT', !!config_1.config.ADMIN_PRIVATE_KEY, !!(config_1.config.BITNOB_CLIENT_ID && config_1.config.BITNOB_SECRET_KEY && config_1.config.BITNOB_API_KEY), !!(config_1.config.MPESA_CONSUMER_KEY && config_1.config.MPESA_CONSUMER_SECRET));
});
//# sourceMappingURL=server.js.map