import { db } from './db';
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

    db.schema.auditLogs.unshift(entry);
    // Keep last 1000 logs per instance
    if (db.schema.auditLogs.length > 1000) {
      db.schema.auditLogs = db.schema.auditLogs.slice(0, 1000);
    }
    await db.save();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
