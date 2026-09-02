import { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AuthenticatedRequest } from './auth';
import { rateLimiter, AI_RATE_LIMIT_CONFIG, checkRateLimit } from './rate-limiter';
import { buildServerAuthorizedAIContext, buildSecureAIPrompt } from './ai-context';
import { generateLocalAIResponse, generateLocalDynamicInsights } from '../services/ai/local-engine';

export const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
export const SECONDARY_GEMINI_MODEL = 'gemini-1.5-flash';

export const AI_REQUEST_TIMEOUT_MS = 15000; // 15 seconds default timeout

export class AIProviderError extends Error {
  code: string;
  statusCode: number;
  isTimeout: boolean;
  constructor(message: string, code = 'AI_PROVIDER_ERROR', statusCode = 502, isTimeout = false) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.isTimeout = isTimeout;
  }
}

export interface SafeAIDiagnosticLog {
  requestId?: string;
  userId?: string;
  endpoint: string;
  durationMs?: number;
  statusCode?: number;
  modelUsed?: string;
  fallbackUsed?: boolean;
  attempt?: number;
  maxAttempts?: number;
  errorCategory?: string;
  message?: string;
}

let geminiClient: GoogleGenAI | null = null;
let mockGeminiCaller:
  | ((params: {
      contents: any;
      systemInstruction: string;
      temperature?: number;
      responseMimeType?: string;
    }) => Promise<{ text: string; modelUsed: string }>)
  | null = null;

let disableLocalFallbackForTesting = false;
let customTimeoutMsForTesting: number | null = null;

export function setGeminiClientForTesting(client: GoogleGenAI | null): void {
  geminiClient = client;
}

export function setMockGeminiCaller(
  caller:
    | ((params: {
        contents: any;
        systemInstruction: string;
        temperature?: number;
        responseMimeType?: string;
      }) => Promise<{ text: string; modelUsed: string }>)
    | null
): void {
  mockGeminiCaller = caller;
}

export function setDisableLocalFallbackForTesting(disabled: boolean): void {
  disableLocalFallbackForTesting = disabled;
}

export function setAITimeoutForTesting(ms: number | null): void {
  customTimeoutMsForTesting = ms;
}

/**
 * Sanitizes and strips all sensitive user data, secrets, credentials, tokens,
 * passwords, context blocks, prompts, emails, financial amounts, and paths from log messages.
 */
export function sanitizeAiLogMessage(input: any): string {
  if (!input) return 'Unknown AI diagnostic';

  let msg = typeof input === 'string' ? input : input?.message || input?.name || 'AI request error';
  if (typeof msg !== 'string') {
    msg = String(msg);
  }

  // 1. Redact known environment variables
  const envSecrets = [
    process.env.GEMINI_API_KEY,
    process.env.JWT_SECRET,
    process.env.STRIPE_SECRET_KEY,
    process.env.SESSION_SECRET,
  ].filter((s): s is string => typeof s === 'string' && s.length > 4);

  for (const secret of envSecrets) {
    msg = msg.split(secret).join('[REDACTED_SECRET]');
  }

  // 2. Redact AI Prompt Context & Multi-line context sections first
  msg = msg.replace(
    /=== SERVER-VERIFIED USER CONTEXT ===[\s\S]*?(?:=== END SERVER-VERIFIED USER CONTEXT ===|=== END USER CONTEXT ===|$)/gi,
    '[REDACTED_USER_CONTEXT]'
  );
  msg = msg.replace(
    /=== CONVERSATIONAL INPUT ===[\s\S]*?(?:=== END CONVERSATIONAL INPUT ===|$)/gi,
    '[REDACTED_USER_CONVERSATION]'
  );
  msg = msg.replace(/=== SERVER-VERIFIED[\s\S]*?===/gi, '[REDACTED_USER_CONTEXT]');
  msg = msg.replace(/\[AUTHENTICATED USER\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_USER]');
  msg = msg.replace(/\[TASKS & EXECUTION\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_TASKS]');
  msg = msg.replace(/\[HABITS & ROUTINES\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_HABITS]');
  msg = msg.replace(/\[STRATEGIC GOALS\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_GOALS]');
  msg = msg.replace(/\[FINANCIAL HEALTH\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_FINANCES]');
  msg = msg.replace(/\[REFLECTIONS & MOOD TELEMETRY\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_REFLECTIONS]');
  msg = msg.replace(/\[USER PREFERENCES & MEMORIES\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_MEMORIES]');
  msg = msg.replace(/\[CONVERSATION HISTORY\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_HISTORY]');
  msg = msg.replace(/\[LATEST USER MESSAGE\][\s\S]*?(?=\n\[|\n===|$)/gi, '[REDACTED_MESSAGE]');

  // 3. Redact password hashes and explicit password fields first (before monetary regex)
  msg = msg.replace(/\$2[abxy]?\$\d{1,2}\$[./A-Za-z0-9]{20,}/g, '[REDACTED_HASH]');
  msg = msg.replace(/(?:password|passwordHash|pwd|authToken)["':\s=]+[^,;}\s\n]+/gi, 'password=[REDACTED]');

  // 4. Redact JWT tokens (must happen before Bearer/generic tokens to preserve token structure)
  msg = msg.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]');

  // 5. Redact API keys and authorization headers
  msg = msg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  msg = msg.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-[REDACTED]');
  msg = msg.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  msg = msg.replace(/tok_[a-zA-Z0-9_]{16,}/g, 'tok_[REDACTED]');
  msg = msg.replace(/rst_[a-zA-Z0-9_]{16,}/g, 'rst_[REDACTED]');

  // 6. Redact emails and monetary data
  msg = msg.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
  msg = msg.replace(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g, '$[REDACTED_AMOUNT]');

  // 7. Redact internal server paths & stack frames (only actual stack traces starting with newline + at)
  msg = msg.replace(/(\/[\w\.-]+)+/g, '[PATH]');
  msg = msg.replace(/\n\s*at\s+[^\n]+/g, '');

  // 8. Clean up whitespace and bound length
  msg = msg.replace(/\s+/g, ' ').trim();
  if (msg.length > 400) {
    msg = msg.slice(0, 400) + '...';
  }

  return msg;
}

export function sanitizeErrorMessage(err: any): string {
  return sanitizeAiLogMessage(err);
}

/**
 * Emits clean, structured diagnostic logs containing ONLY safe non-sensitive metadata.
 */
export function logAiDiagnostic(level: 'info' | 'warn' | 'error', diagnostic: SafeAIDiagnosticLog): void {
  const parts: string[] = [
    `[AI Diagnostic]`,
    `endpoint=${diagnostic.endpoint}`,
    diagnostic.userId ? `userId=${diagnostic.userId}` : null,
    diagnostic.requestId ? `requestId=${diagnostic.requestId}` : null,
    diagnostic.statusCode !== undefined ? `status=${diagnostic.statusCode}` : null,
    diagnostic.durationMs !== undefined ? `durationMs=${diagnostic.durationMs}` : null,
    diagnostic.modelUsed ? `model=${diagnostic.modelUsed}` : null,
    diagnostic.fallbackUsed !== undefined ? `fallback=${diagnostic.fallbackUsed}` : null,
    diagnostic.attempt !== undefined ? `attempt=${diagnostic.attempt}/${diagnostic.maxAttempts || 2}` : null,
    diagnostic.errorCategory ? `errorCategory=${diagnostic.errorCategory}` : null,
    diagnostic.message ? `details="${sanitizeAiLogMessage(diagnostic.message)}"` : null,
  ].filter(Boolean) as string[];

  const formatted = parts.join(' ');
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  timeoutMessage = 'AI provider request timed out'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AIProviderError(timeoutMessage, 'AI_PROVIDER_TIMEOUT', 504, true));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export function getGeminiClient(): GoogleGenAI | null {
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

export async function executeGeminiContentGeneration(
  ai: GoogleGenAI,
  requestParams: {
    contents: any;
    systemInstruction: string;
    temperature?: number;
    responseMimeType?: string;
    timeoutMs?: number;
    requestId?: string;
    userId?: string;
    endpoint?: string;
  }
): Promise<{ text: string; modelUsed: string }> {
  const effectiveTimeout = customTimeoutMsForTesting ?? requestParams.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  const endpoint = requestParams.endpoint || '/api/ai/chat';

  if (mockGeminiCaller) {
    const rawResult = await withTimeout(
      mockGeminiCaller(requestParams),
      effectiveTimeout,
      'AI provider request timed out'
    );
    if (!rawResult || typeof rawResult.text !== 'string' || !rawResult.text.trim()) {
      throw new AIProviderError('AI provider returned an empty response', 'AI_EMPTY_RESPONSE', 502);
    }
    return rawResult;
  }

  const modelsToAttempt = [PRIMARY_GEMINI_MODEL, SECONDARY_GEMINI_MODEL];
  let lastError: any = null;

  for (let i = 0; i < modelsToAttempt.length; i++) {
    const model = modelsToAttempt[i];
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: requestParams.contents,
          config: {
            systemInstruction: requestParams.systemInstruction,
            temperature: requestParams.temperature ?? 0.7,
            responseMimeType: requestParams.responseMimeType ?? 'application/json',
          },
        }),
        effectiveTimeout,
        `AI provider request to ${model} timed out`
      );

      const text = response?.text;
      if (!text || !text.trim()) {
        throw new AIProviderError(`AI model ${model} returned an empty response`, 'AI_EMPTY_RESPONSE', 502);
      }

      return { text: text.trim(), modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const isTimeout = err?.isTimeout || err?.code === 'AI_PROVIDER_TIMEOUT';
      logAiDiagnostic('warn', {
        endpoint,
        userId: requestParams.userId,
        requestId: requestParams.requestId,
        attempt: i + 1,
        maxAttempts: modelsToAttempt.length,
        modelUsed: model,
        errorCategory: isTimeout ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_ERROR',
        message: sanitizeAiLogMessage(err),
      });
      if (i === modelsToAttempt.length - 1) {
        break;
      }
    }
  }

  const isTimeout = lastError?.isTimeout || lastError?.code === 'AI_PROVIDER_TIMEOUT';
  const finalMessage = sanitizeAiLogMessage(lastError);
  throw new AIProviderError(
    finalMessage,
    isTimeout ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_ERROR',
    isTimeout ? 504 : 502,
    isTimeout
  );
}

export const ORIGIN_SYSTEM_INSTRUCTION = `
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

export async function handleAiChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const endpoint = '/api/ai/chat';

  try {
    // Identity is derived STRICTLY from verified authentication (JWT), never from request body/headers
    const userId = req.userId!;
    const rateCheck = rateLimiter.consume(
      `ai_chat_${userId}`,
      AI_RATE_LIMIT_CONFIG.chat.limit,
      AI_RATE_LIMIT_CONFIG.chat.windowMs
    );

    // Standard non-sensitive RateLimit headers
    res.setHeader('RateLimit-Limit', AI_RATE_LIMIT_CONFIG.chat.limit.toString());
    res.setHeader('RateLimit-Remaining', rateCheck.remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(rateCheck.resetAt / 1000).toString());

    if (!rateCheck.allowed) {
      const durationMs = Date.now() - startTime;
      logAiDiagnostic('warn', {
        requestId,
        userId,
        endpoint,
        statusCode: 429,
        durationMs,
        errorCategory: 'RATE_LIMITED',
        message: 'Rate limit threshold exceeded for user',
      });
      res.setHeader('Retry-After', rateCheck.retryAfterSeconds.toString());
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many AI requests. Please wait a moment before trying again.',
        },
      });
      return;
    }

    const { message, conversationHistory, moduleContext } = req.body;

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);

    // Build the request prompt with schema guidance and strict data boundary
    const promptWithInstructions =
      buildSecureAIPrompt({
        trustedContext,
        message: message.trim(),
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        moduleContext: typeof moduleContext === 'string' ? moduleContext : undefined,
      }) +
      `\n
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

    if (!ai && !mockGeminiCaller) {
      const durationMs = Date.now() - startTime;
      if (disableLocalFallbackForTesting) {
        logAiDiagnostic('warn', {
          requestId,
          userId,
          endpoint,
          statusCode: 503,
          durationMs,
          errorCategory: 'AI_PROVIDER_UNAVAILABLE',
          message: 'AI provider is not configured or unavailable',
        });
        res.status(503).json({
          success: false,
          error: {
            code: 'AI_PROVIDER_UNAVAILABLE',
            message: 'AI provider is not configured or unavailable.',
          },
        });
        return;
      }
      // Graceful fallback when GEMINI_API_KEY is not yet populated
      const fallbackResponse = generateLocalAIResponse(
        message.trim(),
        trustedContext,
        moduleContext,
        trustedContext.memories
      );
      logAiDiagnostic('info', {
        requestId,
        userId,
        endpoint,
        statusCode: 200,
        durationMs,
        modelUsed: 'local-fallback',
        fallbackUsed: true,
      });
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-fallback',
        fallbackUsed: true,
      });
      return;
    }

    let responseText = '';
    let usedModel = PRIMARY_GEMINI_MODEL;
    try {
      const genResult = await executeGeminiContentGeneration(ai as any, {
        contents: promptWithInstructions,
        systemInstruction: ORIGIN_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        responseMimeType: 'application/json',
        requestId,
        userId,
        endpoint,
      });
      responseText = genResult.text;
      usedModel = genResult.modelUsed;
    } catch (modelErr: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = modelErr?.isTimeout || modelErr?.code === 'AI_PROVIDER_TIMEOUT';
      const statusCode = isTimeout ? 504 : modelErr?.statusCode || 502;

      if (disableLocalFallbackForTesting) {
        logAiDiagnostic('error', {
          requestId,
          userId,
          endpoint,
          statusCode,
          durationMs,
          errorCategory: isTimeout ? 'AI_PROVIDER_TIMEOUT' : modelErr?.code || 'AI_PROVIDER_ERROR',
          message: sanitizeAiLogMessage(modelErr),
        });
        res.status(statusCode).json({
          success: false,
          error: {
            code: isTimeout ? 'AI_PROVIDER_TIMEOUT' : modelErr?.code || 'AI_PROVIDER_ERROR',
            message: isTimeout
              ? 'AI provider request timed out. Please try again.'
              : 'The AI provider is temporarily unavailable. Please try again in a moment.',
          },
        });
        return;
      }

      logAiDiagnostic('warn', {
        requestId,
        userId,
        endpoint,
        statusCode: 200,
        durationMs,
        modelUsed: 'local-fallback',
        fallbackUsed: true,
        errorCategory: 'AI_PROVIDER_DEGRADED',
        message: sanitizeAiLogMessage(modelErr),
      });

      // Model unavailable or quota exhausted -> serve rich contextual local intelligence built with trusted context
      const fallbackResponse = generateLocalAIResponse(
        message.trim(),
        trustedContext,
        moduleContext,
        trustedContext.memories
      );
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-fallback',
        fallbackUsed: true,
        warning: 'AI model is currently experiencing high demand; served with grounded local synthesis.',
      });
      return;
    }

    let parsedData: any;
    try {
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        // Attempt clean extraction if markdown backticks were returned
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Parsed response is not an object');
      }
    } catch (parseErr) {
      const durationMs = Date.now() - startTime;
      logAiDiagnostic('warn', {
        requestId,
        userId,
        endpoint,
        statusCode: disableLocalFallbackForTesting ? 502 : 200,
        durationMs,
        errorCategory: 'AI_RESPONSE_MALFORMED',
        message: 'AI response failed JSON parsing',
      });

      if (disableLocalFallbackForTesting) {
        res.status(502).json({
          success: false,
          error: {
            code: 'AI_RESPONSE_MALFORMED',
            message: 'AI provider returned an invalid response structure.',
          },
        });
        return;
      }

      const fallbackResponse = generateLocalAIResponse(
        message.trim(),
        trustedContext,
        moduleContext,
        trustedContext.memories
      );
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-fallback',
        fallbackUsed: true,
        warning: 'AI provider returned invalid format; served with local synthesis.',
      });
      return;
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

    const durationMs = Date.now() - startTime;
    logAiDiagnostic('info', {
      requestId,
      userId,
      endpoint,
      statusCode: 200,
      durationMs,
      modelUsed: usedModel,
      fallbackUsed: false,
    });

    res.json({
      success: true,
      data: parsedData,
      provider: usedModel,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logAiDiagnostic('error', {
      requestId,
      userId: req.userId,
      endpoint,
      statusCode: 500,
      durationMs,
      errorCategory: 'SERVER_ERROR',
      message: sanitizeAiLogMessage(err),
    });

    if (disableLocalFallbackForTesting) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while processing your AI request.',
        },
      });
      return;
    }

    try {
      const trustedFallbackContext = req.userId ? buildServerAuthorizedAIContext(req.userId) : ({} as any);
      const fallbackResponse = generateLocalAIResponse(
        req.body?.message || '',
        trustedFallbackContext,
        req.body?.moduleContext
      );
      res.json({
        success: true,
        data: fallbackResponse,
        provider: 'local-fallback',
        fallbackUsed: true,
        warning: 'Fallback activated after unexpected server condition.',
      });
    } catch {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while processing your AI request.',
        },
      });
    }
  }
}

export async function handleAiInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const endpoint = '/api/ai/insights';

  try {
    // Identity is derived STRICTLY from verified authentication (JWT), never from request body/headers
    const userId = req.userId!;
    const rateCheck = rateLimiter.consume(
      `ai_insights_${userId}`,
      AI_RATE_LIMIT_CONFIG.insights.limit,
      AI_RATE_LIMIT_CONFIG.insights.windowMs
    );

    // Standard non-sensitive RateLimit headers
    res.setHeader('RateLimit-Limit', AI_RATE_LIMIT_CONFIG.insights.limit.toString());
    res.setHeader('RateLimit-Remaining', rateCheck.remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(rateCheck.resetAt / 1000).toString());

    if (!rateCheck.allowed) {
      const durationMs = Date.now() - startTime;
      logAiDiagnostic('warn', {
        requestId,
        userId,
        endpoint,
        statusCode: 429,
        durationMs,
        errorCategory: 'RATE_LIMITED',
        message: 'Rate limit threshold exceeded for user',
      });
      res.setHeader('Retry-After', rateCheck.retryAfterSeconds.toString());
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many AI insights requests. Please wait a moment before trying again.',
        },
      });
      return;
    }

    // Retrieve authorized user data directly from server database with strict ownership check
    const trustedContext = buildServerAuthorizedAIContext(userId);
    const ai = getGeminiClient();

    if (!ai && !mockGeminiCaller) {
      const durationMs = Date.now() - startTime;
      if (disableLocalFallbackForTesting) {
        logAiDiagnostic('warn', {
          requestId,
          userId,
          endpoint,
          statusCode: 503,
          durationMs,
          errorCategory: 'AI_PROVIDER_UNAVAILABLE',
          message: 'AI provider is not configured or unavailable',
        });
        res.status(503).json({
          success: false,
          error: {
            code: 'AI_PROVIDER_UNAVAILABLE',
            message: 'AI provider is not configured or unavailable.',
          },
        });
        return;
      }
      const fallbackInsights = generateLocalDynamicInsights(trustedContext);
      logAiDiagnostic('info', {
        requestId,
        userId,
        endpoint,
        statusCode: 200,
        durationMs,
        modelUsed: 'local-fallback',
        fallbackUsed: true,
      });
      res.json({ success: true, data: fallbackInsights, provider: 'local-fallback', fallbackUsed: true });
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
      const genResult = await executeGeminiContentGeneration(ai as any, {
        contents: prompt,
        systemInstruction: ORIGIN_SYSTEM_INSTRUCTION,
        temperature: 0.6,
        responseMimeType: 'application/json',
        requestId,
        userId,
        endpoint,
      });

      let insights: any[] = [];
      try {
        try {
          insights = JSON.parse(genResult.text || '[]');
        } catch {
          const cleaned = (genResult.text || '[]').replace(/```json\n?|\n?```/g, '').trim();
          insights = JSON.parse(cleaned);
        }
        if (!Array.isArray(insights)) {
          throw new Error('Insights response is not an array');
        }
      } catch (parseErr) {
        const durationMs = Date.now() - startTime;
        logAiDiagnostic('warn', {
          requestId,
          userId,
          endpoint,
          statusCode: disableLocalFallbackForTesting ? 502 : 200,
          durationMs,
          errorCategory: 'AI_RESPONSE_MALFORMED',
          message: 'AI insights response failed JSON parsing',
        });
        if (disableLocalFallbackForTesting) {
          res.status(502).json({
            success: false,
            error: {
              code: 'AI_RESPONSE_MALFORMED',
              message: 'AI insights response was malformed.',
            },
          });
          return;
        }
        const fallbackInsights = generateLocalDynamicInsights(trustedContext);
        res.json({ success: true, data: fallbackInsights, provider: 'local-fallback', fallbackUsed: true });
        return;
      }

      const durationMs = Date.now() - startTime;
      logAiDiagnostic('info', {
        requestId,
        userId,
        endpoint,
        statusCode: 200,
        durationMs,
        modelUsed: genResult.modelUsed,
        fallbackUsed: false,
      });

      res.json({ success: true, data: insights, provider: genResult.modelUsed });
    } catch (modelErr: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = modelErr?.isTimeout || modelErr?.code === 'AI_PROVIDER_TIMEOUT';
      const statusCode = isTimeout ? 504 : modelErr?.statusCode || 502;

      if (disableLocalFallbackForTesting) {
        logAiDiagnostic('error', {
          requestId,
          userId,
          endpoint,
          statusCode,
          durationMs,
          errorCategory: isTimeout ? 'AI_PROVIDER_TIMEOUT' : modelErr?.code || 'AI_PROVIDER_ERROR',
          message: sanitizeAiLogMessage(modelErr),
        });
        res.status(statusCode).json({
          success: false,
          error: {
            code: isTimeout ? 'AI_PROVIDER_TIMEOUT' : modelErr?.code || 'AI_PROVIDER_ERROR',
            message: isTimeout
              ? 'AI provider request timed out.'
              : 'The AI provider is temporarily unavailable.',
          },
        });
        return;
      }

      logAiDiagnostic('warn', {
        requestId,
        userId,
        endpoint,
        statusCode: 200,
        durationMs,
        modelUsed: 'local-fallback',
        fallbackUsed: true,
        errorCategory: 'AI_PROVIDER_DEGRADED',
        message: sanitizeAiLogMessage(modelErr),
      });

      const fallbackInsights = generateLocalDynamicInsights(trustedContext);
      res.json({ success: true, data: fallbackInsights, provider: 'local-fallback', fallbackUsed: true });
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logAiDiagnostic('error', {
      requestId,
      userId: req.userId,
      endpoint,
      statusCode: 500,
      durationMs,
      errorCategory: 'SERVER_ERROR',
      message: sanitizeAiLogMessage(err),
    });

    if (disableLocalFallbackForTesting) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while processing AI insights.',
        },
      });
      return;
    }

    try {
      const trustedFallbackContext = req.userId ? buildServerAuthorizedAIContext(req.userId) : ({} as any);
      const fallbackInsights = generateLocalDynamicInsights(trustedFallbackContext);
      res.json({ success: true, data: fallbackInsights, provider: 'local-fallback', fallbackUsed: true });
    } catch {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while processing AI insights.',
        },
      });
    }
  }
}
