import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateLocalAIResponse, generateLocalDynamicInsights } from './src/services/ai/local-engine';
import { apiRouter, checkRateLimit } from './src/server/routes';
import { requireAuth, AuthenticatedRequest, getJwtSecret } from './src/server/auth';
import { getEncryptionKey } from './src/server/db';
import { buildServerAuthorizedAIContext, buildSecureAIPrompt } from './src/server/ai-context';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Mount all modular REST endpoints (Auth, Tasks, Habits, Goals, Finances, Notes, Billing, Audit)
app.use('/api', apiRouter);
app.use(apiRouter);

// Centralized AI Model Config with automatic resilient low-latency model fallbacks
const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
const SECONDARY_GEMINI_MODEL = 'gemini-1.5-flash';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Resilient API Caller with fast multi-model failover for transient 503 / 429 errors
async function executeGeminiContentGeneration(
  ai: GoogleGenAI,
  requestParams: {
    contents: any;
    systemInstruction: string;
    temperature?: number;
    responseMimeType?: string;
  }
): Promise<{ text: string; modelUsed: string }> {
  const modelsToAttempt = [PRIMARY_GEMINI_MODEL, SECONDARY_GEMINI_MODEL];
  let lastError: any = null;

  for (const model of modelsToAttempt) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: requestParams.contents,
        config: {
          systemInstruction: requestParams.systemInstruction,
          temperature: requestParams.temperature ?? 0.7,
          responseMimeType: requestParams.responseMimeType ?? 'application/json',
        },
      });
      return { text: response.text || '{}', modelUsed: model };
    } catch (err: any) {
      lastError = err;
      // Immediately try fallback model without long sleep delays
      continue;
    }
  }

  throw lastError;
}

// System safety instruction
const ORIGIN_SYSTEM_INSTRUCTION = `
You are ORIGIN AI, an intelligent personal life operating system co-pilot.
You help the user with daily planning, goal breakdown, habit cadence, financial awareness, reflective synthesis, and life organization.

STRICT OPERATIONAL & SAFETY DIRECTIVES:
1. Privacy & Grounding: Base your analysis solely on the provided structured context. Do NOT invent, hallucinate, or fabricate entities, tasks, finances, or dates.
2. Non-Diagnostic: Do not diagnose medical or psychological conditions.
3. Financial Honesty: Present financial trends objectively. Never guarantee future investment returns or present predictions as certainty.
4. Non-Destructive Action Proposals: When suggesting changes to user data (tasks, habits, goals, notes, transactions), you MUST return them in the structured "proposedActions" list so the user can review and explicitly confirm them in the UI. Never claim you have already applied changes.
5. If provided context is insufficient to answer a specific question, state clearly what information is missing.
6. Tone: Calm, focused, empowering, and articulate. Avoid generic cheerleader clichés.
`.trim();

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
app.post('/api/ai/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Identity is derived STRICTLY from verified authentication (JWT), never from request body/headers
    const userId = req.userId!;
    if (!checkRateLimit(`ai_chat_${userId}`, 30, 60000)) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
      });
      return;
    }

    const { message, conversationHistory, moduleContext } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing or invalid message string.' } });
      return;
    }

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);

    // Build the request prompt with schema guidance and strict data boundary
    const promptWithInstructions = buildSecureAIPrompt({
      trustedContext,
      message: message.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      moduleContext: typeof moduleContext === 'string' ? moduleContext : undefined,
    }) + `\n
You must respond in valid JSON matching this schema:
{
  "reply": "Your clear, articulate response text here. Markdown formatting is supported.",
  "suggestedFollowups": ["Short relevant followup 1", "Followup 2"],
  "proposedActions": [
    {
      "id": "action_unique_id",
      "type": "create_task" | "create_goal" | "log_habit" | "create_note" | "create_transaction" | "update_task_status",
      "title": "Short title of action",
      "description": "What this action will do",
      "payload": { ...appropriate payload properties... }
    }
  ],
  "reasoningSummary": "Brief explanation of how server-verified context informed this response."
}

If no actions need to be proposed, set "proposedActions" to an empty array [].
Return ONLY valid JSON.
`;

    const ai = getGeminiClient();

    if (!ai) {
      // Graceful fallback when GEMINI_API_KEY is not yet populated
      const fallbackResponse = generateLocalAIResponse(message.trim(), trustedContext, moduleContext, trustedContext.memories);
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-fallback',
      });
      return;
    }

    let responseText = '';
    let usedModel = PRIMARY_GEMINI_MODEL;
    try {
      const genResult = await executeGeminiContentGeneration(ai, {
        contents: promptWithInstructions,
        systemInstruction: ORIGIN_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        responseMimeType: 'application/json',
      });
      responseText = genResult.text;
      usedModel = genResult.modelUsed;
    } catch (modelErr: any) {
      // Model unavailable or quota exhausted -> serve rich contextual local intelligence built with trusted context
      const fallbackResponse = generateLocalAIResponse(message.trim(), trustedContext, moduleContext, trustedContext.memories);
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-resilient-mode',
        warning: 'AI model is currently experiencing temporary high demand; served with grounded local synthesis.',
      });
      return;
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Attempt clean extraction if markdown backticks were returned
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    // Validate structured fields
    if (!parsedData.reply) {
      parsedData.reply = 'I reviewed your request and verified system context.';
    }
    if (!Array.isArray(parsedData.proposedActions)) {
      parsedData.proposedActions = [];
    }
    if (!Array.isArray(parsedData.suggestedFollowups)) {
      parsedData.suggestedFollowups = ['Plan my day', 'Review active goals', 'Check today’s habits'];
    }

    res.json({
      success: true,
      data: parsedData,
      provider: usedModel,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/chat:', err);
    // Provide safe local recovery with verified user context
    const trustedFallbackContext = req.userId ? buildServerAuthorizedAIContext(req.userId) : {};
    const fallbackResponse = generateLocalAIResponse(req.body?.message || '', trustedFallbackContext, req.body?.moduleContext);
    res.json({
      success: true,
      data: fallbackResponse,
      provider: 'local-fallback',
      warning: 'Fallback activated after unexpected server condition.',
    });
  }
});

// Server-side AI Dynamic Insights Endpoint (Authenticated, Rate-Limited & Server-Authoritative)
app.post('/api/ai/insights', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Identity is derived STRICTLY from verified authentication (JWT), never from request body/headers
    const userId = req.userId!;
    if (!checkRateLimit(`ai_insights_${userId}`, 20, 60000)) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' },
      });
      return;
    }

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);
    const ai = getGeminiClient();

    if (!ai) {
      const fallbackInsights = generateLocalDynamicInsights(trustedContext);
      res.json({ success: true, data: fallbackInsights, provider: 'local-fallback' });
      return;
    }

    const prompt = `
Based on the following server-verified user life context, generate 2-3 high-value empirical insights.
=== SERVER-VERIFIED USER CONTEXT ===
${JSON.stringify(trustedContext, null, 2)}

User Memories:
${JSON.stringify(trustedContext.memories, null, 2)}
=== END SERVER-VERIFIED USER CONTEXT ===

Return JSON array with items matching:
[
  {
    "id": "string",
    "title": "string",
    "domain": "productivity" | "wellness" | "finances" | "relationships" | "mind",
    "type": "positive_trend" | "growth_opportunity" | "pattern_correlation",
    "observedData": [{ "label": "string", "value": "string" }],
    "interpretation": "string",
    "actionableStep": "string"
  }
]
`;

    try {
      const genResult = await executeGeminiContentGeneration(ai, {
        contents: prompt,
        systemInstruction: ORIGIN_SYSTEM_INSTRUCTION,
        temperature: 0.6,
        responseMimeType: 'application/json',
      });

      let insights: any[] = [];
      try {
        insights = JSON.parse(genResult.text || '[]');
      } catch {
        const cleaned = (genResult.text || '[]').replace(/```json\n?|\n?```/g, '').trim();
        insights = JSON.parse(cleaned);
      }

      res.json({ success: true, data: insights, provider: genResult.modelUsed });
    } catch (modelErr: any) {
      const fallbackInsights = generateLocalDynamicInsights(trustedContext);
      res.json({ success: true, data: fallbackInsights, provider: 'local-resilient-mode' });
    }
  } catch (err: any) {
    console.error('Error in /api/ai/insights:', err);
    const trustedFallbackContext = req.userId ? buildServerAuthorizedAIContext(req.userId) : {};
    const fallbackInsights = generateLocalDynamicInsights(trustedFallbackContext);
    res.json({ success: true, data: fallbackInsights, provider: 'local-fallback' });
  }
});

// Start Server with Vite Middleware
async function startServer() {
  // Ensure secure secrets exist for container deployments; generate runtime keys if not provided in environment
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'origin-jwt-production-secret-auth-token-2026') {
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
  if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET === 'origin-aes-256-gcm-master-key-prod-2026') {
    process.env.ENCRYPTION_SECRET = crypto.randomBytes(32).toString('hex');
  }

  // Validate security secrets
  try {
    getJwtSecret();
    getEncryptionKey();
  } catch (err: any) {
    console.warn('Security Secret initialization notice:', err.message);
  }

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORIGIN Life OS Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
