import { query } from '../../db/postgres';
import { AuditLogRecord } from '../../db';
import { IAuditLogRepository } from '../interfaces';
import { mapAuditLogRow } from './mappers';

export class PostgresAuditLogRepository implements IAuditLogRepository {
  async findByUserId(userId: string, limit?: number): Promise<AuditLogRecord[]> {
    let sql = 'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC';
    const params: any[] = [userId];

    if (limit && limit > 0) {
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
    }

    const res = await query(sql, params);
    return res.rows.map(mapAuditLogRow);
  }

  async create(entry: AuditLogRecord): Promise<AuditLogRecord> {
    const sql = `
      INSERT INTO audit_logs (
        id, user_id, action, resource, ip_address, user_agent, metadata, timestamp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *
    `;

    const values = [
      entry.id,
      entry.userId,
      entry.action,
      entry.resource,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.timestamp ? new Date(entry.timestamp) : new Date(),
    ];

    const res = await query(sql, values);
    return mapAuditLogRow(res.rows[0]);
  }
}
