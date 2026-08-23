import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateLocalAIResponse, generateLocalDynamicInsights } from './src/services/ai/local-engine';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

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

// Server-side AI Chat & Planning Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context, conversationHistory, memories, moduleContext } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing or invalid message string.' });
      return;
    }

    const ai = getGeminiClient();

    // Construct Context Prompt Payload
    let contextPrompt = '';
    if (memories && Array.isArray(memories) && memories.length > 0) {
      contextPrompt += `\n[USER PREFERENCES & MEMORIES]:\n` + memories.map((m: any) => `- ${m.key}: ${m.value}`).join('\n') + '\n';
    }

    if (context && typeof context === 'object') {
      contextPrompt += `\n[MINIMIZED USER RELEVANT CONTEXT]:\n${JSON.stringify(context, null, 2)}\n`;
    }

    if (moduleContext) {
      contextPrompt += `\n[CURRENT MODULE FOCUS]: ${moduleContext}\n`;
    }

    // Build the request prompt with schema guidance
    const promptWithInstructions = `
${contextPrompt}

[CONVERSATION HISTORY]:
${(conversationHistory || [])
  .slice(-6)
  .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
  .join('\n')}

[LATEST USER MESSAGE]:
${message}

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
  "reasoningSummary": "Brief explanation of how context informed this response."
}

If no actions need to be proposed, set "proposedActions" to an empty array [].
Return ONLY valid JSON.
`;

    if (!ai) {
      // Graceful fallback when GEMINI_API_KEY is not yet populated
      const fallbackResponse = generateLocalAIResponse(message, context, moduleContext, memories);
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
      // Model unavailable or quota exhausted -> serve rich contextual local intelligence
      const fallbackResponse = generateLocalAIResponse(message, context, moduleContext, memories);
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
      parsedData.reply = 'I reviewed your request and system context.';
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
    // Even on unexpected uncaught errors, provide safe local recovery
    const fallbackResponse = generateLocalAIResponse(req.body?.message || '', req.body?.context, req.body?.moduleContext);
    res.json({
      success: true,
      data: fallbackResponse,
      provider: 'local-fallback',
      warning: 'Fallback activated after unexpected server condition.',
    });
  }
});

// Server-side AI Dynamic Insights Endpoint
app.post('/api/ai/insights', async (req, res) => {
  try {
    const { context, memories } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const fallbackInsights = generateLocalDynamicInsights(context);
      res.json({ success: true, data: fallbackInsights, provider: 'local-fallback' });
      return;
    }

    const prompt = `
Based on the following user life context, generate 2-3 high-value empirical insights.
Context:
${JSON.stringify(context || {}, null, 2)}

User Memories:
${JSON.stringify(memories || [], null, 2)}

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
      const fallbackInsights = generateLocalDynamicInsights(context);
      res.json({ success: true, data: fallbackInsights, provider: 'local-resilient-mode' });
    }
  } catch (err: any) {
    console.error('Error in /api/ai/insights:', err);
    const fallbackInsights = generateLocalDynamicInsights(req.body?.context);
    res.json({ success: true, data: fallbackInsights, provider: 'local-fallback' });
  }
});

// Start Server with Vite Middleware
async function startServer() {
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
