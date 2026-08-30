import { query } from '../../db/postgres';
import { ContactInteractionRecord } from '../../db';
import { IInteractionRepository } from '../interfaces';
import { mapInteractionRow } from './mappers';

export class PostgresInteractionRepository implements IInteractionRepository {
  async findByUserId(userId: string, contactId?: string): Promise<ContactInteractionRecord[]> {
    let sql = 'SELECT * FROM contact_interactions WHERE user_id = $1';
    const params: any[] = [userId];

    if (contactId) {
      params.push(contactId);
      sql += ` AND contact_id = $${params.length}`;
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const res = await query(sql, params);
    return res.rows.map(mapInteractionRow);
  }

  async findById(id: string, userId?: string): Promise<ContactInteractionRecord | null> {
    let sql = 'SELECT * FROM contact_interactions WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return mapInteractionRow(res.rows[0]);
  }

  async create(interaction: ContactInteractionRecord): Promise<ContactInteractionRecord> {
    const sql = `
      INSERT INTO contact_interactions (
        id, user_id, contact_id, date, channel, notes, energy_impact, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *
    `;

    const values = [
      interaction.id,
      interaction.userId,
      interaction.contactId,
      interaction.date,
      interaction.channel || 'call',
      interaction.notes || null,
      interaction.energyImpact || null,
      interaction.createdAt ? new Date(interaction.createdAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapInteractionRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM contact_interactions WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}
