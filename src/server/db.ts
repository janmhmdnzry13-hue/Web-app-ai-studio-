import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Types for DB entities
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: 'member' | 'admin' | 'guest';
  emailVerified: boolean;
  verificationToken?: string | null;
  profile: {
    displayName: string;
    headline?: string;
    bio?: string;
    avatarUrl?: string;
    primaryLifeFocus?: string;
  };
  preferences: {
    theme: 'system' | 'light' | 'dark';
    timezone: string;
    locale: string;
    weekStartDay: 0 | 1 | 6;
    reducedMotion: boolean;
    compactDensity: boolean;
    dailyReflectionReminderTime: string | null;
    notificationChannels: {
      inApp: boolean;
      email: boolean;
      dailyDigest: boolean;
    };
    unlockedModules?: string[];
  };
  subscription?: {
    tier: 'free' | 'pro' | 'lifetime';
    status: 'active' | 'trialing' | 'canceled' | 'past_due';
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'backlog' | 'todo' | 'in_progress' | 'completed' | 'canceled';
  dueDate?: string | null;
  scheduledTime?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  tags: string[];
  goalId?: string | null;
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface HabitRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: 'health' | 'deep_work' | 'mindfulness' | 'finance' | 'learning' | 'relationships';
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom_days';
  targetDays?: number[];
  targetPerDay: number;
  unit?: string;
  reminderTime?: string | null;
  streakCount: number;
  bestStreak: number;
  totalCompletions: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLogRecord {
  id: string;
  userId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  value: number;
  notes?: string;
  createdAt: string;
}

export interface GoalRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: 'career' | 'health' | 'financial' | 'personal' | 'intellectual' | 'relational';
  horizon: 'quarterly' | 'annual' | 'multi_year' | 'lifetime';
  targetDate: string;
  progressPercentage: number;
  status: 'active' | 'achieved' | 'paused' | 'archived';
  milestones: Array<{
    id: string;
    title: string;
    completed: boolean;
    dueDate?: string;
    order: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  minorUnits: number;
  type: 'income' | 'expense';
  category: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: string;
  isRecurring: boolean;
  notes?: string;
  isEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRecord {
  id: string;
  userId: string;
  category: string;
  limitAmount: number;
  limitMinorUnits: number;
  period: 'monthly' | 'weekly' | 'annual';
  alertThresholdPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReflectionRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  energyLevel: number; // 1-10
  clarityLevel: number; // 1-10
  stressLevel: number; // 1-10
  primaryEmotion: string;
  journalEntry: string;
  wins: string[];
  gratitudes: string[];
  learnings: string[];
  isEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipRecord {
  id: string;
  userId: string;
  name: string;
  relationType: 'family' | 'friend' | 'mentor' | 'colleague' | 'partner' | 'network';
  cadenceDays: number;
  lastInteractionDate: string | null;
  nextDueReminderDate: string | null;
  notes?: string;
  anniversaries?: Array<{ label: string; date: string }>;
  isEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInteractionRecord {
  id: string;
  userId: string;
  contactId: string;
  date: string;
  channel: 'in_person' | 'call' | 'video' | 'message' | 'email';
  notes?: string;
  energyImpact?: 'energizing' | 'neutral' | 'draining';
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  userId: string;
  title: string;
  content: string;
  folderId?: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  linkedNoteIds: string[];
  isEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIMemoryRecord {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: 'preference' | 'routine' | 'goal_focus' | 'constraint';
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface PasswordResetRecord {
  token: string;
  email: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface DatabaseSchema {
  version: number;
  users: UserRecord[];
  tasks: TaskRecord[];
  habits: HabitRecord[];
  habitLogs: HabitLogRecord[];
  goals: GoalRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  reflections: ReflectionRecord[];
  relationships: RelationshipRecord[];
  interactions: ContactInteractionRecord[];
  notes: NoteRecord[];
  aiMemories: AIMemoryRecord[];
  auditLogs: AuditLogRecord[];
  passwordResetTokens: PasswordResetRecord[];
}

// Durable database storage path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'origin_db.json');

/**
 * Resolves the AES-256 encryption key.
 * In production mode, fails fast if ENCRYPTION_SECRET is missing or insecure default.
 */
export function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    const trimmed = secret ? secret.trim() : '';
    const isWeakOrPlaceholder =
      !trimmed ||
      trimmed.length < 16 ||
      trimmed === 'origin-aes-256-gcm-master-key-prod-2026' ||
      trimmed === 'origin-dev-test-encryption-key-not-for-production-2026' ||
      trimmed.toLowerCase().includes('dev-test') ||
      trimmed.toLowerCase().includes('test-dev') ||
      trimmed === 'default_secret' ||
      trimmed === 'secret';

    if (isWeakOrPlaceholder) {
      throw new Error('CRITICAL_SECURITY_ERROR: ENCRYPTION_SECRET environment variable is required and must be configured in production.');
    }
    return crypto.scryptSync(secret!, 'origin_salt_secure_2026', 32);
  }
  const devSecret = secret || 'origin-dev-test-encryption-key-not-for-production-2026';
  return crypto.scryptSync(devSecret, 'origin_salt_secure_2026', 32);
}

export class DatabaseEngine {
  private db: DatabaseSchema | null = null;
  private writeLock = false;
  private pendingSave: Promise<void> | null = null;

  constructor() {
    this.ensureInitialized();
  }

  // Field-level AES-256-GCM encryption for sensitive personal records
  public encrypt(text: string): string {
    if (!text) return '';
    try {
      const key = getEncryptionKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `enc_v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
      return text;
    }
  }

  public decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.startsWith('enc_v1:')) return cipherText;
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 4) return cipherText;
      const key = getEncryptionKey();
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return cipherText;
    }
  }

  public seedUserStarterData(userId: string): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Seed tasks for isolated user
    this.db.tasks.push(
      {
        id: `task_${userId}_1`,
        userId,
        title: 'Review quarterly architecture roadmap',
        description: 'Synthesize engineering priorities and key milestone deliverables.',
        priority: 'high',
        status: 'todo',
        dueDate: today,
        estimatedMinutes: 60,
        actualMinutes: null,
        tags: ['strategy', 'deep_work'],
        subtasks: [
          { id: `sub_${userId}_1`, title: 'Outline core milestones', completed: true },
          { id: `sub_${userId}_2`, title: 'Align resource capacity', completed: false },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `task_${userId}_2`,
        userId,
        title: 'Publish weekly product synthesis',
        description: 'Share cross-domain insights and key progress updates with the team.',
        priority: 'medium',
        status: 'completed',
        dueDate: today,
        estimatedMinutes: 45,
        actualMinutes: 40,
        tags: ['communication'],
        subtasks: [],
        createdAt: now,
        updatedAt: now,
      }
    );

    // Seed habits
    this.db.habits.push(
      {
        id: `habit_${userId}_1`,
        userId,
        name: 'Morning Deep Work Block',
        description: '90 minutes of focused, distraction-free execution.',
        category: 'deep_work',
        frequency: 'daily',
        targetPerDay: 1,
        streakCount: 5,
        bestStreak: 14,
        totalCompletions: 28,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `habit_${userId}_2`,
        userId,
        name: 'Mindful Movement & Walk',
        description: '30 minutes outdoors to recharge cognitive energy.',
        category: 'health',
        frequency: 'daily',
        targetPerDay: 1,
        streakCount: 12,
        bestStreak: 21,
        totalCompletions: 42,
        archived: false,
        createdAt: now,
        updatedAt: now,
      }
    );

    // Seed goals
    this.db.goals.push({
      id: `goal_${userId}_1`,
      userId,
      title: 'Architect Enterprise Co-Pilot OS',
      description: 'Ship high-fidelity personal operating system architecture with sub-second resilience.',
      category: 'career',
      horizon: 'quarterly',
      targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      progressPercentage: 65,
      status: 'active',
      milestones: [
        { id: `mil_${userId}_1`, title: 'Security audit & JWT hardening', completed: true, order: 1 },
        { id: `mil_${userId}_2`, title: 'Offline-ready data synchronization', completed: true, order: 2 },
        { id: `mil_${userId}_3`, title: 'Enterprise RBAC verification', completed: false, order: 3 },
      ],
      createdAt: now,
      updatedAt: now,
    });

    // Seed finances (transactions & budgets)
    this.db.transactions.push({
      id: `tx_${userId}_1`,
      userId,
      title: 'Cloud Infrastructure & Dedicated Servers',
      amount: 45.0,
      minorUnits: 4500,
      type: 'expense',
      category: 'Software & Tools',
      date: today,
      isRecurring: true,
      notes: 'Monthly isolated container hosting',
      createdAt: now,
      updatedAt: now,
    });

    this.db.budgets.push({
      id: `b_${userId}_1`,
      userId,
      category: 'Software & Tools',
      limitAmount: 150.0,
      limitMinorUnits: 15000,
      period: 'monthly',
      alertThresholdPercentage: 80,
      createdAt: now,
      updatedAt: now,
    });

    // Seed relationships
    this.db.relationships.push({
      id: `rel_${userId}_1`,
      userId,
      name: 'Sarah Chen',
      relationType: 'friend',
      cadenceDays: 14,
      lastInteractionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      nextDueReminderDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      notes: 'Great conversation about deliberate life engineering.',
      createdAt: now,
      updatedAt: now,
    });

    // Seed notes
    this.db.notes.push({
      id: `note_${userId}_1`,
      userId,
      title: 'Principles for Deliberate Living',
      content: '1. Focus on inputs over outcomes.\n2. Protect deep work blocks.\n3. Keep your commitments high-signal and low-friction.',
      tags: ['principles', 'philosophy'],
      isPinned: true,
      isArchived: false,
      linkedNoteIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  private ensureInitialized(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.db = JSON.parse(raw);
        this.migrateDb();
        return;
      } catch (err) {
        console.error('Failed to parse database file, re-initializing cleanly:', err);
      }
    }

    this.db = this.getInitialSchema();
    this.saveImmediate();
  }

  private migrateDb(): void {
    if (!this.db) return;
    if (!this.db.users) this.db.users = [];
    if (!this.db.tasks) this.db.tasks = [];
    if (!this.db.habits) this.db.habits = [];
    if (!this.db.habitLogs) this.db.habitLogs = [];
    if (!this.db.goals) this.db.goals = [];
    if (!this.db.transactions) this.db.transactions = [];
    if (!this.db.budgets) this.db.budgets = [];
    if (!this.db.reflections) this.db.reflections = [];
    if (!this.db.relationships) this.db.relationships = [];
    if (!this.db.interactions) this.db.interactions = [];
    if (!this.db.notes) this.db.notes = [];
    if (!this.db.aiMemories) this.db.aiMemories = [];
    if (!this.db.auditLogs) this.db.auditLogs = [];
    if (!this.db.passwordResetTokens) this.db.passwordResetTokens = [];
  }

  private getInitialSchema(): DatabaseSchema {
    return {
      version: 1,
      users: [],
      tasks: [],
      habits: [],
      habitLogs: [],
      goals: [],
      transactions: [],
      budgets: [],
      reflections: [],
      relationships: [],
      interactions: [],
      notes: [],
      aiMemories: [],
      auditLogs: [],
      passwordResetTokens: [],
    };
  }

  // Atomic write to prevent file corruption
  public async save(): Promise<void> {
    if (this.pendingSave) return this.pendingSave;

    this.pendingSave = new Promise((resolve) => {
      setTimeout(() => {
        this.saveImmediate();
        this.pendingSave = null;
        resolve();
      }, 50);
    });

    return this.pendingSave;
  }

  private saveImmediate(): void {
    if (!this.db) return;
    try {
      const tempPath = `${DB_FILE}.${Date.now()}.tmp`;
      const data = JSON.stringify(this.db, null, 2);
      fs.writeFileSync(tempPath, data, 'utf8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file safely:', err);
    }
  }

  public get schema(): DatabaseSchema {
    if (!this.db) this.ensureInitialized();
    return this.db!;
  }
}

export const db = new DatabaseEngine();
