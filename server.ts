import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateLocalAIResponse, generateLocalDynamicInsights } from './src/services/ai/local-engine';
import { apiRouter, checkRateLimit } from './src/server/routes';
import { requireAuth, AuthenticatedRequest, validateProductionSecrets } from './src/server/auth';
import { startNotificationScheduler } from './src/server/notifications';
import { buildServerAuthorizedAIContext, buildSecureAIPrompt } from './src/server/ai-context';
import { validateBody, aiChatSchema, aiInsightsSchema } from './src/server/validation';
import {
  handleAiChat,
  handleAiInsights,
  PRIMARY_GEMINI_MODEL,
  SECONDARY_GEMINI_MODEL,
} from './src/server/ai-controller';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Mount all modular REST endpoints (Auth, Tasks, Habits, Goals, Finances, Notes, Billing, Audit, AI)
app.use('/api', apiRouter);
app.use(apiRouter);

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ORIGIN OS AI Layer',
    model: PRIMARY_GEMINI_MODEL,
    fallbackModel: SECONDARY_GEMINI_MODEL,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Server-side AI Chat & Planning Endpoint (Authenticated, Rate-Limited & Server-Authoritative)
app.post(
  '/api/ai/chat',
  requireAuth,
  validateBody(aiChatSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  handleAiChat
);

// Server-side AI Dynamic Insights Endpoint (Authenticated, Rate-Limited & Server-Authoritative)
app.post(
  '/api/ai/insights',
  requireAuth,
  validateBody(aiInsightsSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  handleAiInsights
);

// Start Server with Vite Middleware
async function startServer() {
  // Enforce stable, externally configured secrets (JWT_SECRET & ENCRYPTION_SECRET)
  // Fails fast in production if unconfigured or using insecure default values
  validateProductionSecrets();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initialize server-authoritative notification scheduling engine
  startNotificationScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORIGIN Life OS Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
