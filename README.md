# ORIGIN | Personal Operating System

An integrated, self-sovereign personal operating system unifying life orchestration across productivity, habits, strategic goals, personal finance, emotional reflections, meaningful relationships, knowledge management, and context-aware artificial intelligence.

---

## 1. System Architecture

ORIGIN is engineered with a deterministic full-stack architecture prioritizing operator agency, privacy, high responsiveness, and zero external vendor lock-in.

```
┌────────────────────────────────────────────────────────┐
│                   ORIGIN CLIENT (SPA)                  │
│  React 19 + TypeScript + Tailwind CSS + Lucide Icons   │
│  Motion Transitions + Radix Headless Core             │
└──────────────────────────┬─────────────────────────────┘
                           │
       HTTPS / In-Memory Dispatch / Typed DTOs
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 ORIGIN SERVER RUNTIME                  │
│  Node.js + Express 4.x + Vite Middleware               │
│  ESBuild Bundle -> dist/server.cjs                     │
├────────────────────────────────────────────────────────┤
│  • /api/ai/chat        - Server-Side Gemini Proxy       │
│  • /api/ai/status      - AI Runtime Health Check        │
│  • /api/health         - Service Liveness               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│             SOVEREIGN ISOLATED STORAGE ENGINE          │
│  • Namespaced Client Storage (`prefix_${userId}`)      │
│  • Real Multi-Tenant Isolation Layer                   │
│  • Portable Full-Database JSON Archive Export          │
│  • Cryptographic-Style User State Sanitization         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Domain Capabilities

1. **Dashboard & Daily Horizon**: Unified daily briefing, morning review, high-leverage intentions, active habits, and real-time biometric mood telemetry.
2. **Tasks & Projects Execution**: Priority-tiered task manager (Urgent, High, Medium, Low), milestone breakdown, time estimates, tag filtering, and Kanban matrix.
3. **Habit Streaks & Logging**: Habit loops (Cue, Routine, Reward), frequency tracking (daily, weekdays, weekends, custom), and mathematical sequential streak engine.
4. **Goals & Horizon Milestones**: Multi-year, annual, quarterly, and monthly horizon roadmaps with progressive milestone completion calculation.
5. **Personal Finance & Cashflow**: Multi-account ledger, category budgets, monthly spend vs. allowance gauges, transaction classifications, and mathematical solvency tracking.
6. **Emotional Reflections & Energy**: Check-in logs with mood telemetry (1-10), energy mapping (low, medium, high), tags, lessons learned, and AI emotional trends.
7. **Relationships & CRM**: Network cadence management (VIP, Core, Extended), interaction history logging, celebration dates, and reconnection reminders.
8. **Notes & Knowledge Base**: Markdown editor with pinned notes, hierarchical folders, tag taxonomy, and full-text keyword retrieval.
9. **Universal Search & Deep Retrieval**: Instant index across all 8 modules with fuzzy matching, domain badge categorization, and direct navigation.
10. **AI Co-Pilot & Studio**: Server-proxied Gemini 2.5 Flash intelligence engine featuring:
    - Zero client secret leakage (`GEMINI_API_KEY` strictly contained on backend)
    - Domain minimization (intent-scoped grounding queries)
    - Gated human-in-the-loop mutations (AI proposes structured actions; operator confirms execution)
    - User AI memory directives and conversation history

---

## 3. Security & Data Isolation Architecture

- **Zero Client-Side Secrets**: `GEMINI_API_KEY` is accessed exclusively in server-side API handlers (`server.ts`). Client applications never hold raw credentials.
- **Tenant Scoping**: All database operations (`tasks`, `habits`, `goals`, `transactions`, `reflections`, `notes`, `memories`) enforce explicit `userId` namespaces.
- **Gated Mutation Security**: All automated AI actions require explicit confirmation from the authenticated user before executing any write operations.
- **Data Sovereignty**: Complete multi-domain export to portable JSON format from the Settings module.
- **Destructive Cascade Deletion**: Account deletion requires explicit typed `DELETE` confirmation and purges all isolated namespaces.

---

## 4. Environment Configuration

Documented in `.env.example`:

```bash
# Server-Side Secrets (Never expose with VITE_ prefix)
# GEMINI_API_KEY: Required for Gemini AI API calls. Managed via Settings / Secrets.
GEMINI_API_KEY=

# Application URL (Injected at runtime by hosting container)
APP_URL=
```

---

## 5. Local Development & Verification

### Prerequisites
- Node.js 20+
- npm 10+

### Development Server
```bash
# Install dependencies
npm install

# Launch full-stack dev server (Express + Vite on Port 3000)
npm run dev
```

### Type Checking & Linting
```bash
npm run lint
```

### Automated Test Suite
```bash
npm test
```

### Production Build & Launch
```bash
# Compile client assets to dist/ and bundle server to dist/server.cjs
npm run build

# Start production server
npm start
```

---

## 6. Test Suite Coverage

ORIGIN includes 10 comprehensive Vitest suites covering 44 automated test assertions:
- `auth.service.test.ts`: Signup, password hashing, session expiration, credentials rejection, reset token verification.
- `domain_isolation.test.ts`: Multi-tenant user data boundaries, task execution, goal milestone computation, habit streaks, export archive, account deletion cascade.
- `finance.service.test.ts`: Financial ledger balance, transaction categorization, budget calculation, negative value handling.
- `ai.service.test.ts`: Intent classification, domain grounding, schema validation, action proposal framing, resilient fallback behavior.
- `search.service.test.ts`: Cross-domain search indexing, tag filtering, entity navigation.
- `note.service.test.ts`: Markdown formatting, word count metrics, pinned hierarchy.
- `emotion.service.test.ts`: Mood score normalization, energy tracking, reflective synthesis.
- `relationship.service.test.ts`: Cadence calculation, interaction history, reconnection triggers.
- `notification.service.test.ts`: In-app notification queues, daily digest settings.
- `insight.service.test.ts`: Cross-domain intelligence synthesis and correlation metrics.
