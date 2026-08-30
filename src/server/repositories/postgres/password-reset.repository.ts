import { query } from '../../db/postgres';
import { PasswordResetRecord } from '../../db';
import { IPasswordResetRepository } from '../interfaces';
import { mapPasswordResetRow } from './mappers';

export class PostgresPasswordResetRepository implements IPasswordResetRepository {
  async findByToken(token: string): Promise<PasswordResetRecord | null> {
    const res = await query('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
    if (res.rows.length === 0) return null;
    return mapPasswordResetRow(res.rows[0]);
  }

  async findActiveByEmail(email: string): Promise<PasswordResetRecord | null> {
    const res = await query(
      'SELECT * FROM password_reset_tokens WHERE LOWER(email) = LOWER($1) AND used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
      [email.trim()]
    );
    if (res.rows.length === 0) return null;
    return mapPasswordResetRow(res.rows[0]);
  }

  async create(record: PasswordResetRecord): Promise<PasswordResetRecord> {
    const sql = `
      INSERT INTO password_reset_tokens (
        token, email, expires_at, used, created_at
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      ON CONFLICT (token) DO UPDATE SET
        email = EXCLUDED.email,
        expires_at = EXCLUDED.expires_at,
        used = EXCLUDED.used
      RETURNING *
    `;

    const values = [
      record.token,
      record.email.toLowerCase(),
      new Date(record.expiresAt),
      Boolean(record.used),
      record.createdAt ? new Date(record.createdAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapPasswordResetRow(res.rows[0]);
  }

  async markUsed(token: string): Promise<boolean> {
    const res = await query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
      [token]
    );
    return (res.rowCount || 0) > 0;
  }
}
