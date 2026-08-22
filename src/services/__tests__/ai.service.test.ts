import { describe, it, expect, beforeEach } from 'vitest';
import { aiContextEngine } from '../ai/context-engine';
import { aiActionExecutor } from '../ai/action-executor';
import { aiMemoryService } from '../ai/memory.service';
import { aiService } from '../ai.service';
import { taskService } from '../task.service';
import { goalService } from '../goal.service';
import { habitService } from '../habit.service';
import { safeStorage } from '../../lib/storage';

const TEST_USER = 'usr_ai_test_suite';

describe('ORIGIN AI Operating System Suite', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  describe('1. AI Context Engine & Minimization', () => {
    it('accurately classifies daily planning intent and includes tasks, habits, goals', () => {
      const match = aiContextEngine.classifyIntent('Plan my day and highlight urgent priorities');
      expect(match.relevantModules).toContain('tasks');
      expect(match.relevantModules).toContain('habits');
      expect(match.relevantModules).toContain('goals');
    });

    it('accurately classifies financial query and restricts domain scope', () => {
      const match = aiContextEngine.classifyIntent('What did I spend most on this month and what is my cashflow?');
      expect(match.relevantModules).toContain('finances');
      expect(match.relevantModules).not.toContain('emotions');
      expect(match.relevantModules).not.toContain('relationships');
    });

    it('accurately classifies habit consistency diagnosis intent', () => {
      const match = aiContextEngine.classifyIntent('Which habits have been inconsistent over the last week?');
      expect(match.relevantModules).toContain('habits');
    });

    it('accurately classifies goal horizon breakdown intent', () => {
      const match = aiContextEngine.classifyIntent('Break this goal into smaller milestone steps');
      expect(match.relevantModules).toContain('goals');
      expect(match.relevantModules).toContain('tasks');
    });

    it('builds minimized context payload without leaking sensitive data', async () => {
      // Seed a task
      await taskService.createTask(TEST_USER, {
        title: 'Complete Phase 4 Implementation',
        priority: 'urgent',
        estimatedMinutes: 45,
      });

      const { payload, summary } = await aiContextEngine.buildContext(
        TEST_USER,
        'What should I focus on today?'
      );

      expect(payload.selectedModules).toContain('tasks');
      expect(payload.tasks).toBeDefined();
      expect(payload.tasks!.length).toBeGreaterThan(0);
      expect(payload.tasks![0].title).toBe('Complete Phase 4 Implementation');
      expect(summary.itemCount).toBeGreaterThan(0);
      expect(summary.summary).toContain('Grounding in');
    });
  });

  describe('2. AI Action Proposal & Confirmation Safety', () => {
    it('rejects malformed action structures missing required fields', () => {
      const invalidAction: any = {
        id: 'act_1',
        type: 'create_task',
        title: 'Empty Task',
        description: 'No title provided',
        payload: { title: '   ' },
        status: 'pending',
      };

      const val = aiActionExecutor.validateAction(invalidAction);
      expect(val.isValid).toBe(false);
      expect(val.error).toContain('Task title is required');
    });

    it('rejects transaction actions with negative or invalid amounts', () => {
      const invalidTxAction: any = {
        id: 'act_2',
        type: 'create_transaction',
        title: 'Invalid Spend',
        description: 'Negative value',
        payload: { amount: -50, description: 'Illegal spend' },
        status: 'pending',
      };

      const val = aiActionExecutor.validateAction(invalidTxAction);
      expect(val.isValid).toBe(false);
      expect(val.error).toContain('Positive transaction amount is required');
    });

    it('executes validated task creation upon explicit confirmation', async () => {
      const action: any = {
        id: 'act_confirm_1',
        type: 'create_task',
        title: 'Deploy Production Release',
        description: 'Run production build verification',
        payload: {
          title: 'Deploy Production Release',
          priority: 'high',
          estimatedMinutes: 30,
        },
        status: 'pending',
      };

      const res = await aiActionExecutor.executeAction(TEST_USER, action);
      expect(res.success).toBe(true);
      expect(res.data?.entityId).toBeDefined();
      expect(res.data?.summary).toContain('Created task "Deploy Production Release"');

      // Verify the task exists in the real task service
      const tasksRes = await taskService.getTasks(TEST_USER);
      expect(tasksRes.success).toBe(true);
      expect(tasksRes.data?.items.some((t) => t.title === 'Deploy Production Release')).toBe(true);
    });

    it('executes validated goal creation upon confirmation', async () => {
      const action: any = {
        id: 'act_goal_1',
        type: 'create_goal',
        title: 'Master TypeScript & AI Systems',
        description: 'Sovereign skill horizon',
        payload: {
          title: 'Master TypeScript & AI Systems',
          horizon: 'medium_term',
        },
        status: 'pending',
      };

      const res = await aiActionExecutor.executeAction(TEST_USER, action);
      expect(res.success).toBe(true);
      expect(res.data?.summary).toContain('Created goal horizon');

      const goalsRes = await goalService.getGoals(TEST_USER);
      expect(goalsRes.data?.some((g) => g.title === 'Master TypeScript & AI Systems')).toBe(true);
    });
  });

  describe('3. AI Memory & User Preferences Directives', () => {
    it('loads transparent default preferences when uninitialized', async () => {
      const res = await aiMemoryService.getMemories(TEST_USER);
      expect(res.success).toBe(true);
      expect(res.data!.length).toBeGreaterThanOrEqual(2);
      expect(res.data!.some((m) => m.key.includes('Deep Work'))).toBe(true);
    });

    it('allows saving and updating user-scoped custom AI directives', async () => {
      const saveRes = await aiMemoryService.saveMemory(
        TEST_USER,
        'Daily Planning Horizon',
        'Timebox deep focus blocks to 90 minutes max',
        'planning'
      );
      expect(saveRes.success).toBe(true);
      expect(saveRes.data?.key).toBe('Daily Planning Horizon');

      const listRes = await aiMemoryService.getMemories(TEST_USER);
      expect(listRes.data?.some((m) => m.key === 'Daily Planning Horizon')).toBe(true);
    });

    it('allows deleting specific memory directives', async () => {
      const saveRes = await aiMemoryService.saveMemory(
        TEST_USER,
        'Temporary Directive',
        'Will be deleted',
        'general'
      );
      const memId = saveRes.data!.id;

      const delRes = await aiMemoryService.deleteMemory(TEST_USER, memId);
      expect(delRes.success).toBe(true);

      const listRes = await aiMemoryService.getMemories(TEST_USER);
      expect(listRes.data?.some((m) => m.id === memId)).toBe(false);
    });
  });

  describe('4. AI Service Conversational Orchestration', () => {
    it('initializes default conversation on start', async () => {
      const res = await aiService.createConversation(TEST_USER, 'Test Session');
      expect(res.success).toBe(true);
      expect(res.data?.title).toBe('Test Session');
      expect(res.data?.messages.length).toBe(1);
    });

    it('sends message and returns resilient structured response with context summary', async () => {
      const sendRes = await aiService.sendMessage(TEST_USER, 'Plan my day based on active tasks');
      expect(sendRes.success).toBe(true);
      expect(sendRes.data?.message.content).toBeDefined();
      expect(sendRes.data?.contextSummary.modulesUsed).toContain('tasks');
    });

    it('clears conversation history on demand', async () => {
      const convo = await aiService.createConversation(TEST_USER, 'Clearable Session');
      const clearRes = await aiService.clearConversation(TEST_USER, convo.data!.id);
      expect(clearRes.success).toBe(true);
      expect(clearRes.data?.messages.length).toBe(1);
      expect(clearRes.data?.messages[0].content).toContain('cleared');
    });
  });
});
