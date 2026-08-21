/**
 * Generic domain types, pagination, result containers, and utility shapes.
 */

export type EntityId = string;

export type ISODateString = string; // e.g. "2026-08-21T09:00:00.000Z"

export type DateOnlyString = string; // e.g. "2026-08-21"

export interface BaseEntity {
  readonly id: EntityId;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface UserScopedEntity extends BaseEntity {
  readonly userId: EntityId;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export type LifecycleStatus = 'draft' | 'active' | 'archived' | 'completed' | 'cancelled';

export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface SortOptions<T = string> {
  readonly field: T;
  readonly direction: 'asc' | 'desc';
}

export interface ServiceError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: ISODateString;
}

export interface ServiceResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ServiceError;
}
