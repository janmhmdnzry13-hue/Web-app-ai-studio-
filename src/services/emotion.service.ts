/**
 * Emotion & Reflection Service Contract
 */
import { DateOnlyString, ServiceResult } from '../types/common.types';
import { DailyReflection, EmotionEntry } from '../types/emotion.types';
import { BaseService } from './base.service';

export interface IEmotionService {
  getRecentEmotions(limit?: number): Promise<ServiceResult<readonly EmotionEntry[]>>;
  logEmotion(entry: Omit<EmotionEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<EmotionEntry>>;
  getDailyReflection(date: DateOnlyString): Promise<ServiceResult<DailyReflection | null>>;
  saveDailyReflection(reflection: Omit<DailyReflection, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<DailyReflection>>;
}

export class EmotionService extends BaseService implements IEmotionService {
  async getRecentEmotions(_limit = 10): Promise<ServiceResult<readonly EmotionEntry[]>> {
    return this.success([]);
  }

  async logEmotion(_entry: Omit<EmotionEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<EmotionEntry>> {
    return this.failure('UNIMPLEMENTED_MODULE', 'Emotion logging scheduled for Phase 2.');
  }

  async getDailyReflection(_date: DateOnlyString): Promise<ServiceResult<DailyReflection | null>> {
    return this.success(null);
  }

  async saveDailyReflection(_reflection: Omit<DailyReflection, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<DailyReflection>> {
    return this.failure('UNIMPLEMENTED_MODULE', 'Daily reflections scheduled for Phase 2.');
  }
}

export const emotionService = new EmotionService();
