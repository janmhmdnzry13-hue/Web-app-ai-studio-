/**
 * Relationship Service Contract
 */
import { ServiceResult } from '../types/common.types';
import { InteractionLog, Relationship } from '../types/relationship.types';
import { BaseService } from './base.service';

export interface IRelationshipService {
  getRelationships(): Promise<ServiceResult<readonly Relationship[]>>;
  getRelationshipById(id: string): Promise<ServiceResult<Relationship>>;
  logInteraction(relationshipId: string, log: Omit<InteractionLog, 'id'>): Promise<ServiceResult<Relationship>>;
}

export class RelationshipService extends BaseService implements IRelationshipService {
  async getRelationships(): Promise<ServiceResult<readonly Relationship[]>> {
    return this.success([]);
  }

  async getRelationshipById(id: string): Promise<ServiceResult<Relationship>> {
    return this.failure('RELATIONSHIP_NOT_FOUND', `Relationship with ID ${id} not found.`);
  }

  async logInteraction(_relationshipId: string, _log: Omit<InteractionLog, 'id'>): Promise<ServiceResult<Relationship>> {
    return this.failure('UNIMPLEMENTED_MODULE', 'Relationship interactions scheduled for Phase 2.');
  }
}

export const relationshipService = new RelationshipService();
