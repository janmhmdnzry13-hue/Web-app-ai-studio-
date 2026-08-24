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

// Encryption secret configuration (with persistent AES key derivation)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'origin-aes-256-gcm-master-key-prod-2026';
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'origin_salt_secure_2026', 32);

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
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
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
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return cipherText;
    }
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

    // Ensure demo user exists with real bcrypt hash
    const demoUser = this.db.users.find((u) => u.id === 'usr_origin_demo' || u.email === 'alex.vance@origin-os.internal');
    if (!demoUser) {
      this.db.users.push(this.getDemoUser());
    }
  }

  private getDemoUser(): UserRecord {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('demo1234', salt);

    return {
      id: 'usr_origin_demo',
      email: 'alex.vance@origin-os.internal',
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Alex Vance',
        headline: 'Lead Architect',
        bio: 'Designing high-leverage habits, deep work sprints, and intentional life systems.',
        primaryLifeFocus: 'Deep Work & Daily Focus',
      },
      preferences: {
        theme: 'system',
        timezone: 'America/New_York',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: '21:30',
        notificationChannels: {
          inApp: true,
          email: false,
          dailyDigest: true,
        },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals', 'notes', 'emotions', 'relationships'],
      },
      subscription: {
        tier: 'pro',
        status: 'active',
        currentPeriodEnd: '2027-01-01T00:00:00.000Z',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
  }

  private getInitialSchema(): DatabaseSchema {
    const demoUser = this.getDemoUser();

    return {
      version: 1,
      users: [demoUser],
      tasks: [
        {
          id: 'task_demo_1',
          userId: 'usr_origin_demo',
          title: 'Review quarterly architecture roadmap',
          description: 'Synthesize engineering priorities and key milestone deliverables.',
          priority: 'high',
          status: 'todo',
          dueDate: new Date().toISOString().slice(0, 10),
          estimatedMinutes: 60,
          actualMinutes: null,
          tags: ['strategy', 'deep_work'],
          subtasks: [
            { id: 'sub_1', title: 'Outline core milestones', completed: true },
            { id: 'sub_2', title: 'Align resource capacity', completed: false },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task_demo_2',
          userId: 'usr_origin_demo',
          title: 'Publish weekly product synthesis',
          description: 'Share cross-domain insights and key progress updates with the team.',
          priority: 'medium',
          status: 'completed',
          dueDate: new Date().toISOString().slice(0, 10),
          estimatedMinutes: 45,
          actualMinutes: 40,
          tags: ['communication'],
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      habits: [
        {
          id: 'habit_demo_1',
          userId: 'usr_origin_demo',
          name: 'Morning Deep Work Block',
          description: '90 minutes of focused, distraction-free execution.',
          category: 'deep_work',
          frequency: 'daily',
          targetPerDay: 1,
          streakCount: 5,
          bestStreak: 14,
          totalCompletions: 28,
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'habit_demo_2',
          userId: 'usr_origin_demo',
          name: 'Mindful Movement & Walk',
          description: '30 minutes outdoors to recharge cognitive energy.',
          category: 'health',
          frequency: 'daily',
          targetPerDay: 1,
          streakCount: 7,
          bestStreak: 21,
          totalCompletions: 35,
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      habitLogs: [],
      goals: [
        {
          id: 'goal_demo_1',
          userId: 'usr_origin_demo',
          title: 'Establish a Calmer, More Intentional Daily Rhythm',
          description: 'Balance intense deep work sprints with restorative evening wind-downs.',
          category: 'personal',
          horizon: 'quarterly',
          targetDate: '2026-12-31',
          progressPercentage: 60,
          status: 'active',
          milestones: [
            { id: 'm_1', title: 'Consistent 9:00 AM start time', completed: true, order: 1 },
            { id: 'm_2', title: 'Zero screens after 9:30 PM for 14 straight days', completed: false, order: 2 },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      transactions: [
        {
          id: 'tx_demo_1',
          userId: 'usr_origin_demo',
          title: 'Cloud Infrastructure & Servers',
          amount: 45.0,
          minorUnits: 4500,
          type: 'expense',
          category: 'Software & Tools',
          date: new Date().toISOString().slice(0, 10),
          isRecurring: true,
          notes: 'Monthly dedicated container hosting',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      budgets: [
        {
          id: 'b_demo_1',
          userId: 'usr_origin_demo',
          category: 'Software & Tools',
          limitAmount: 150.0,
          limitMinorUnits: 15000,
          period: 'monthly',
          alertThresholdPercentage: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      reflections: [],
      relationships: [
        {
          id: 'rel_demo_1',
          userId: 'usr_origin_demo',
          name: 'Sarah Chen',
          relationType: 'friend',
          cadenceDays: 14,
          lastInteractionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          nextDueReminderDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          notes: 'Great conversation about deliberate life engineering.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      interactions: [],
      notes: [
        {
          id: 'note_demo_1',
          userId: 'usr_origin_demo',
          title: 'Principles for Deliberate Living',
          content: '1. Focus on inputs over outcomes.\n2. Protect deep work blocks.\n3. Keep your commitments high-signal and low-friction.',
          tags: ['principles', 'philosophy'],
          isPinned: true,
          isArchived: false,
          linkedNoteIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      aiMemories: [
        {
          id: 'mem_demo_1',
          userId: 'usr_origin_demo',
          key: 'Preferred Deep Work Block',
          value: 'Morning 9:00 AM - 11:30 AM for highest cognitive leverage',
          category: 'routine',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'mem_demo_2',
          userId: 'usr_origin_demo',
          key: 'Planning Cadence',
          value: 'Daily 3-priority matrix with time-boxed sprints',
          category: 'preference',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
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
