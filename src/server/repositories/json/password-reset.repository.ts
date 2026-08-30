import { db, PasswordResetRecord } from '../../db';
import { IPasswordResetRepository } from '../interfaces';

export class JsonPasswordResetRepository implements IPasswordResetRepository {
  async findByToken(token: string): Promise<PasswordResetRecord | null> {
    const record = db.schema.passwordResetTokens.find((r) => r.token === token && !r.used);
    return record ? { ...record } : null;
  }

  async findActiveByEmail(email: string): Promise<PasswordResetRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const now = Date.now();
    const record = db.schema.passwordResetTokens.find(
      (r) => r.email.toLowerCase() === cleanEmail && !r.used && new Date(r.expiresAt).getTime() > now
    );
    return record ? { ...record } : null;
  }

  async create(record: PasswordResetRecord): Promise<PasswordResetRecord> {
    db.schema.passwordResetTokens.push(record);
    await db.save();
    return { ...record };
  }

  async markUsed(token: string): Promise<boolean> {
    const record = db.schema.passwordResetTokens.find((r) => r.token === token);
    if (!record) return false;

    record.used = true;
    await db.save();
    return true;
  }
}
