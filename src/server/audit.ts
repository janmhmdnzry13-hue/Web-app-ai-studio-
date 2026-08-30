import { auditLogRepository } from './repositories';
import { generateCryptoToken } from './auth';

export async function logAuditEvent(
  userId: string,
  action: string,
  resource: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const entry = {
      id: generateCryptoToken('audit'),
      userId,
      action,
      resource,
      ipAddress,
      userAgent,
      metadata,
      timestamp: new Date().toISOString(),
    };

    await auditLogRepository.create(entry);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
