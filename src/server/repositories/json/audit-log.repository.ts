import { db, AuditLogRecord } from '../../db';
import { IAuditLogRepository } from '../interfaces';

export class JsonAuditLogRepository implements IAuditLogRepository {
  async findByUserId(userId: string, limit = 100): Promise<AuditLogRecord[]> {
    return db.schema.auditLogs
      .filter((l) => l.userId === userId)
      .slice(0, limit)
      .map((l) => ({ ...l }));
  }

  async create(entry: AuditLogRecord): Promise<AuditLogRecord> {
    db.schema.auditLogs.unshift(entry);
    // Keep max 1000 logs in memory/disk
    if (db.schema.auditLogs.length > 1000) {
      db.schema.auditLogs.length = 1000;
    }
    await db.save();
    return { ...entry };
  }
}
