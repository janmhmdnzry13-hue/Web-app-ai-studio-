/**
 * Insight & Life Balance Service Contract
 */
import { ServiceResult } from '../types/common.types';
import { LifeBalanceIndex, LifeInsight } from '../types/insight.types';
import { BaseService } from './base.service';

export interface IInsightService {
  getActiveInsights(): Promise<ServiceResult<readonly LifeInsight[]>>;
  getLifeBalanceIndex(): Promise<ServiceResult<LifeBalanceIndex>>;
  dismissInsight(id: string): Promise<ServiceResult<void>>;
}

export class InsightService extends BaseService implements IInsightService {
  async getActiveInsights(): Promise<ServiceResult<readonly LifeInsight[]>> {
    const mockInsights: readonly LifeInsight[] = [
      {
        id: 'ins_foundation_1',
        userId: 'usr_origin_demo',
        title: 'System Cohesion Ready',
        domain: 'focus_flow',
        significance: 'positive_trend',
        observation: 'All 8 core life domains have strict TypeScript schema contracts established.',
        recommendation: 'Use Phase 2 modules to begin connecting data providers directly to services.',
        confidenceScore: 0.98,
        relatedEntityIds: [],
        isDismissed: false,
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    return this.success(mockInsights);
  }

  async getLifeBalanceIndex(): Promise<ServiceResult<LifeBalanceIndex>> {
    return this.success({
      overallScore: 84,
      categoryScores: {
        productivity: 88,
        wellness: 82,
        finance: 80,
        connection: 78,
        learning: 92,
      },
      trend: 'improving',
      calculatedForDate: new Date().toISOString().split('T')[0],
    });
  }

  async dismissInsight(_id: string): Promise<ServiceResult<void>> {
    return this.success(undefined);
  }
}

export const insightService = new InsightService();
