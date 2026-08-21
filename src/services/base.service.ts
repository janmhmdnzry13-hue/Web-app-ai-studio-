/**
 * ORIGIN Service Architecture Foundation
 * Standardized Result and Error abstractions for decoupled data access.
 */
import { ServiceError, ServiceResult } from '../types/common.types';

export class BaseService {
  protected success<T>(data: T): ServiceResult<T> {
    return {
      success: true,
      data,
    };
  }

  protected failure<T = never>(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): ServiceResult<T> {
    const error: ServiceError = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    return {
      success: false,
      error,
    };
  }
}
