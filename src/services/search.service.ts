/**
 * Unified Global Search Service
 * Fast, multi-domain search across Tasks, Goals, Habits, Transactions, Notes, and Relationships.
 */
import { ServiceResult } from '../types/common.types';
import { taskService } from './task.service';
import { goalService } from './goal.service';
import { habitService } from './habit.service';
import { financeService } from './finance.service';
import { noteService } from './note.service';
import { relationshipService } from './relationship.service';
import { BaseService } from './base.service';
import { authService } from './auth.service';

export type SearchResultType = 'task' | 'goal' | 'habit' | 'transaction' | 'note' | 'relationship';

export interface GlobalSearchResult {
  readonly id: string;
  readonly type: SearchResultType;
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly badgeLabel?: string;
  readonly badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'subtle' | 'outline';
  readonly url: string;
  readonly matchedField: string;
  readonly date?: string;
}

export interface GlobalSearchParams {
  query: string;
  typeFilter?: SearchResultType | 'all';
  limitPerType?: number;
  userId?: string;
}

export class SearchService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    return sessionRes.data?.user?.id || '';
  }

  async search(params: GlobalSearchParams): Promise<ServiceResult<readonly GlobalSearchResult[]>> {
    try {
      const q = params.query.trim().toLowerCase();
      if (!q || q.length < 1) {
        return this.success([]);
      }

      const userId = await this.resolveUserId(params.userId);
      const limit = params.limitPerType || 10;
      const type = params.typeFilter || 'all';

      const results: GlobalSearchResult[] = [];

      // Run parallel targeted searches based on type filter
      const promises: Promise<void>[] = [];

      // 1. Tasks Search
      if (type === 'all' || type === 'task') {
        promises.push(
          taskService.getTasks(userId, { search: q, limit }).then((res) => {
            if (res.success && res.data?.items) {
              for (const t of res.data.items) {
                results.push({
                  id: t.id,
                  type: 'task',
                  title: t.title,
                  subtitle: t.status === 'completed' ? 'Completed task' : `Status: ${t.status} • Priority: ${t.priority}`,
                  description: t.description || undefined,
                  badgeLabel: t.priority.toUpperCase(),
                  badgeVariant: t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'subtle',
                  url: '/app/tasks',
                  matchedField: t.title.toLowerCase().includes(q) ? 'Title' : 'Description',
                  date: t.dueDate,
                });
              }
            }
          })
        );
      }

      // 2. Goals Search
      if (type === 'all' || type === 'goal') {
        promises.push(
          goalService.getGoals(userId).then((res) => {
            if (res.success && res.data) {
              const matched = res.data.filter(
                (g) =>
                  g.title.toLowerCase().includes(q) ||
                  g.category.toLowerCase().includes(q) ||
                  g.description?.toLowerCase().includes(q) ||
                  g.milestones.some((m) => m.title.toLowerCase().includes(q))
              );
              for (const g of matched.slice(0, limit)) {
                results.push({
                  id: g.id,
                  type: 'goal',
                  title: g.title,
                  subtitle: `Horizon: ${g.category.replace('_', ' ')} • ${g.progressPercentage}% complete`,
                  description: g.description || undefined,
                  badgeLabel: `${g.progressPercentage}%`,
                  badgeVariant: g.progressPercentage >= 100 ? 'success' : 'primary',
                  url: '/app/goals',
                  matchedField: g.title.toLowerCase().includes(q) ? 'Title' : 'Milestone/Description',
                  date: g.targetDate,
                });
              }
            }
          })
        );
      }

      // 3. Habits Search
      if (type === 'all' || type === 'habit') {
        promises.push(
          habitService.getHabits(userId).then((res) => {
            if (res.success && res.data) {
              const matched = res.data.filter(
                (h) =>
                  h.name.toLowerCase().includes(q) ||
                  h.routine?.toLowerCase().includes(q) ||
                  h.category.toLowerCase().includes(q)
              );
              for (const h of matched.slice(0, limit)) {
                results.push({
                  id: h.id,
                  type: 'habit',
                  title: h.name,
                  subtitle: `Frequency: ${h.frequency} • Streak: ${h.streak.currentStreak}d (Best: ${h.streak.longestStreak}d)`,
                  description: h.routine || undefined,
                  badgeLabel: `${h.streak.currentStreak}d Streak`,
                  badgeVariant: 'warning',
                  url: '/app/habits',
                  matchedField: 'Habit Name',
                });
              }
            }
          })
        );
      }

      // 4. Notes Search
      if (type === 'all' || type === 'note') {
        promises.push(
          noteService.searchNotes(userId, q).then((res) => {
            if (res.success && res.data) {
              for (const n of res.data.slice(0, limit)) {
                results.push({
                  id: n.id,
                  type: 'note',
                  title: n.title,
                  subtitle: n.tags.length > 0 ? `Tags: ${n.tags.join(', ')}` : 'Knowledge note',
                  description: n.plainTextSummary || undefined,
                  badgeLabel: n.isPinned ? 'PINNED' : 'NOTE',
                  badgeVariant: n.isPinned ? 'primary' : 'subtle',
                  url: '/app/notes',
                  matchedField: n.title.toLowerCase().includes(q) ? 'Title' : 'Content',
                  date: n.updatedAt,
                });
              }
            }
          })
        );
      }

      // 5. Finances Search
      if (type === 'all' || type === 'transaction') {
        promises.push(
          financeService.getTransactions(userId, { search: q }).then((res) => {
            if (res.success && res.data) {
              for (const tx of res.data.slice(0, limit)) {
                const isIncome = tx.type === 'income';
                results.push({
                  id: tx.id,
                  type: 'transaction',
                  title: tx.description,
                  subtitle: `${tx.category.replace('_', ' ')} • ${isIncome ? '+' : '-'}$${tx.amount.toFixed(2)}`,
                  description: tx.merchantOrSource ? `Source: ${tx.merchantOrSource}` : undefined,
                  badgeLabel: isIncome ? `+$${tx.amount.toFixed(0)}` : `-$${tx.amount.toFixed(0)}`,
                  badgeVariant: isIncome ? 'success' : 'subtle',
                  url: '/app/finances',
                  matchedField: tx.description.toLowerCase().includes(q) ? 'Description' : 'Category/Source',
                  date: tx.date,
                });
              }
            }
          })
        );
      }

      // 6. Relationships Search
      if (type === 'all' || type === 'relationship') {
        promises.push(
          relationshipService.getRelationships(userId).then((res) => {
            if (res.success && res.data) {
              const matched = res.data.filter(
                (r) =>
                  r.name.toLowerCase().includes(q) ||
                  r.notes?.toLowerCase().includes(q) ||
                  r.relationshipType.toLowerCase().includes(q) ||
                  r.tags.some((tag) => tag.toLowerCase().includes(q))
              );
              for (const r of matched.slice(0, limit)) {
                results.push({
                  id: r.id,
                  type: 'relationship',
                  title: r.name,
                  subtitle: `Circle: ${r.relationshipType.replace('_', ' ')}${r.lastInteraction ? ` • Last: ${r.lastInteraction}` : ''}`,
                  description: r.notes || undefined,
                  badgeLabel: r.relationshipType.toUpperCase(),
                  badgeVariant: 'subtle',
                  url: '/app/relationships',
                  matchedField: r.name.toLowerCase().includes(q) ? 'Name' : 'Notes/Tag',
                  date: r.nextReminder,
                });
              }
            }
          })
        );
      }

      await Promise.all(promises);
      const filtered = type === 'all' ? results : results.filter((r) => r.type === type);
      return this.success(filtered);
    } catch (err) {
      return this.failure('SEARCH_ERROR', 'Failed to execute global search query.', { err });
    }
  }
}

export const searchService = new SearchService();
