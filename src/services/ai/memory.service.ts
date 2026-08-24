/**
 * ORIGIN AI Memory Service
 * Transparent, user-scoped memory and preferences architecture
 */
import { AIMemoryItem } from '../../types/ai.types';
import { ServiceResult } from '../../types/common.types';
import { BaseService } from '../base.service';
import { safeStorage } from '../../lib/storage';

const STORAGE_PREFIX = 'origin_ai_memories_';

export class AIMemoryService extends BaseService {
  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  private loadMemories(userId: string): AIMemoryItem[] {
    const raw = safeStorage.get<AIMemoryItem[]>(this.getStorageKey(userId), []);
    // Zero fake memories for real users; only provide starter directives for explicit demo account if empty
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const demoDefaults: AIMemoryItem[] = [
        {
          id: `mem_demo_1`,
          userId,
          key: 'Preferred Deep Work Block',
          value: 'Morning 9:00 AM - 11:30 AM for highest cognitive leverage',
          category: 'planning',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `mem_demo_2`,
          userId,
          key: 'Planning Cadence',
          value: 'Daily 3-priority matrix with time-boxed sprints',
          category: 'routine',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      this.saveMemories(userId, demoDefaults);
      return demoDefaults;
    }
    return raw;
  }

  private saveMemories(userId: string, memories: AIMemoryItem[]): void {
    safeStorage.set(this.getStorageKey(userId), memories);
  }

  async getMemories(userId: string): Promise<ServiceResult<readonly AIMemoryItem[]>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const items = this.loadMemories(userId);
    return this.success(items);
  }

  async saveMemory(
    userId: string,
    key: string,
    value: string,
    category: AIMemoryItem['category'] = 'general'
  ): Promise<ServiceResult<AIMemoryItem>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    if (!key.trim() || !value.trim()) {
      return this.failure('INVALID_INPUT', 'Key and value are required');
    }

    const items = this.loadMemories(userId);
    const existingIndex = items.findIndex((m) => m.key.toLowerCase() === key.toLowerCase().trim());

    let savedItem: AIMemoryItem;
    if (existingIndex >= 0) {
      savedItem = {
        ...items[existingIndex],
        value: value.trim(),
        category,
        updatedAt: new Date().toISOString(),
      };
      items[existingIndex] = savedItem;
    } else {
      savedItem = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        key: key.trim(),
        value: value.trim(),
        category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.push(savedItem);
    }

    this.saveMemories(userId, items);
    return this.success(savedItem);
  }

  async deleteMemory(userId: string, memoryId: string): Promise<ServiceResult<boolean>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const items = this.loadMemories(userId);
    const filtered = items.filter((m) => m.id !== memoryId);
    this.saveMemories(userId, filtered);
    return this.success(true);
  }

  async clearMemories(userId: string): Promise<ServiceResult<boolean>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    safeStorage.remove(this.getStorageKey(userId));
    return this.success(true);
  }
}

export const aiMemoryService = new AIMemoryService();
