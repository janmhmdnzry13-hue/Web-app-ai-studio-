import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { validateSchema, Validators } from '../../lib/validation';
import { useToast } from '../../context/ToastContext';
import {
  Code2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Shield,
  Zap,
  Copy,
  Terminal,
  Database,
} from 'lucide-react';

const CONTRACT_DEFINITIONS = [
  {
    id: 'user_profile',
    title: 'User & Profile Contract',
    description: 'Models user credentials, display profile, preferences, and timezone tokens.',
    schema: `export interface User extends BaseEntity {
  readonly email: string;
  readonly role: 'member' | 'admin' | 'guest';
  readonly profile: {
    readonly displayName: string;
    readonly headline?: string;
    readonly bio?: string;
    readonly avatarUrl?: string;
  };
  readonly preferences: UserPreferences;
  readonly emailVerified: boolean;
}`,
  },
  {
    id: 'task_entity',
    title: 'Task & Subtask Contract',
    description: 'Hierarchical task management with recurrences, priorities, and goal relations.',
    schema: `export interface Task extends UserScopedEntity {
  readonly title: string;
  readonly description?: string;
  readonly status: 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly dueDate?: ISODateString;
  readonly goalId?: EntityId;
  readonly subtasks: readonly Subtask[];
}`,
  },
  {
    id: 'goal_entity',
    title: 'Goal & Milestone Contract',
    description: 'Strategic life objectives, weighted milestones, and timeframe hierarchies.',
    schema: `export interface Goal extends UserScopedEntity {
  readonly title: string;
  readonly category: GoalCategory;
  readonly timeframe: 'quarterly' | 'annual' | 'multi_year' | 'lifetime';
  readonly progressPercentage: number;
  readonly milestones: readonly Milestone[];
  readonly linkedHabitIds: readonly EntityId[];
}`,
  },
  {
    id: 'habit_entity',
    title: 'Habit & Completion Log Contract',
    description: 'Atomic habit routines, streaks, frequency schedules, and daily metrics.',
    schema: `export interface Habit extends UserScopedEntity {
  readonly name: string;
  readonly routine: string;
  readonly frequency: 'daily' | 'weekdays' | 'weekends' | 'custom';
  readonly targetUnits: number;
  readonly unitLabel: string;
  readonly streak: HabitStreak;
}`,
  },
  {
    id: 'finance_entity',
    title: 'Financial Transaction & Budget Contract',
    description: 'Multi-category transactions, monthly caps, and cashflow analytics.',
    schema: `export interface Transaction extends UserScopedEntity {
  readonly amount: number;
  readonly currency: string;
  readonly type: 'income' | 'expense' | 'transfer';
  readonly category: FinancialCategory;
  readonly date: DateOnlyString;
  readonly isRecurring: boolean;
}`,
  },
  {
    id: 'emotion_entity',
    title: 'Emotion & Reflection Contract',
    description: 'Circadian mood, energy levels, qualitative tags, and structured daily reflections.',
    schema: `export interface EmotionEntry extends UserScopedEntity {
  readonly mood: 1 | 2 | 3 | 4 | 5;
  readonly energy: 1 | 2 | 3 | 4 | 5;
  readonly primaryEmotion: PrimaryEmotion;
  readonly tags: readonly string[];
  readonly note?: string;
}`,
  },
  {
    id: 'ai_copilot',
    title: 'AI Intelligence & Context Contract',
    description: 'Context-grounded assistant conversations and cross-domain insight prompts.',
    schema: `export interface AIConversation extends UserScopedEntity {
  readonly title: string;
  readonly moduleContext?: string;
  readonly messages: readonly AIMessage[];
  readonly lastMessageAt: ISODateString;
}`,
  },
];

export function ArchitectureExplorer() {
  const { success } = useToast();
  const [selectedContract, setSelectedContract] = useState(CONTRACT_DEFINITIONS[0].id);

  // Validation Playground State
  const [testEmail, setTestEmail] = useState('architect@origin-os.internal');
  const [testTitle, setTestTitle] = useState('Ship Phase 1 Foundation');
  const [testAmount, setTestAmount] = useState('250');
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: Record<string, string> } | null>(null);

  const runValidationTest = () => {
    const res = validateSchema(
      {
        email: testEmail,
        title: testTitle,
        amount: Number(testAmount),
      },
      {
        email: [Validators.required(), Validators.email()],
        title: [Validators.required(), Validators.minLength(3), Validators.maxLength(50)],
        amount: [Validators.required(), Validators.minNumber(1), Validators.maxNumber(1000000)],
      }
    );

    setValidationResult({
      isValid: res.isValid,
      errors: res.errors as Record<string, string>,
    });

    if (res.isValid) {
      success('Schema Validation Passed', 'All data attributes meet strict contract requirements.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied to clipboard');
  };

  const activeContract = CONTRACT_DEFINITIONS.find((c) => c.id === selectedContract) || CONTRACT_DEFINITIONS[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <PageHeader
        title="Architecture & Contract Inspector"
        description="Verify domain type contracts, decoupled service abstractions, schema validators, and security boundaries."
        badge={{ label: 'Strict TypeScript', variant: 'info' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Architecture' }]}
      />

      <Tabs defaultValue="contracts">
        <TabsList>
          <TabsTrigger value="contracts" leftIcon={<Code2 className="h-3.5 w-3.5" />}>
            Domain Contracts
          </TabsTrigger>
          <TabsTrigger value="validation" leftIcon={<Zap className="h-3.5 w-3.5" />}>
            Validation Engine
          </TabsTrigger>
          <TabsTrigger value="security" leftIcon={<Shield className="h-3.5 w-3.5" />}>
            Security Architecture
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Domain Contracts */}
        <TabsContent value="contracts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contract Selector */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Core Domain Entities
              </h3>
              <div className="space-y-1.5">
                {CONTRACT_DEFINITIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedContract(c.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      selectedContract === c.id
                        ? 'border-neutral-900 bg-white dark:border-neutral-100 dark:bg-neutral-900 font-semibold shadow-xs'
                        : 'border-neutral-200 bg-neutral-50/50 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">{c.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{c.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Code Viewer */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {activeContract.title}
                  </h4>
                  <p className="text-xs text-neutral-400">{activeContract.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => copyToClipboard(activeContract.schema)}
                >
                  Copy Contract
                </Button>
              </div>

              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-neutral-100 p-4 font-mono text-xs overflow-x-auto leading-relaxed shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-neutral-400 text-[11px]">
                  <span>src/types/{activeContract.id.replace('_entity', '').replace('_', '.')}.types.ts</span>
                  <span className="text-emerald-400 font-sans font-medium">Verified Contract</span>
                </div>
                <pre>
                  <code>{activeContract.schema}</code>
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Validation Engine Playground */}
        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Schema Validation Tester</CardTitle>
              <CardDescription>
                Test field and schema level validation rules in real time before persisting to domain entities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Email (required, email format)"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  error={validationResult?.errors.email}
                />
                <Input
                  label="Title (min 3, max 50 chars)"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  error={validationResult?.errors.title}
                />
                <Input
                  label="Amount (1 to 1,000,000)"
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  error={validationResult?.errors.amount}
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button onClick={runValidationTest}>Execute Validation</Button>
                {validationResult && (
                  <div className="flex items-center gap-2">
                    {validationResult.isValid ? (
                      <Badge variant="success" size="md">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" /> Valid
                      </Badge>
                    ) : (
                      <Badge variant="danger" size="md">
                        <AlertCircle className="h-3.5 w-3.5 mr-1 inline" /> Invalid Input
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Security & Isolation Architecture */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-2">
                  <Shield className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">User Data Isolation</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  All domain contracts extend UserScopedEntity with immutable userId bindings to guarantee tenant isolation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-2">
                  <Zap className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">Zero Client Secrets</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  API keys and backend credentials never touch client bundles; proxied through secure server handlers.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-2">
                  <Database className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">Decoupled Service Layer</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  UI components never call APIs directly; all requests pass through typed I*Service abstractions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
