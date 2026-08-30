import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { relationalSchemaCatalog } from '../db/schema';

describe('ORIGIN Relational Database Schema', () => {
  const schemaSqlPath = path.resolve(process.cwd(), 'src/server/db/schema.sql');
  const migrationSqlPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');

  it('verifies that schema.sql and migration files exist and are populated', () => {
    expect(fs.existsSync(schemaSqlPath)).toBe(true);
    expect(fs.existsSync(migrationSqlPath)).toBe(true);

    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

    expect(schemaSql.length).toBeGreaterThan(1000);
    expect(migrationSql.length).toBeGreaterThan(1000);
  });

  it('contains all required tables in the TypeScript schema catalog and SQL DDL', () => {
    const requiredTables = [
      'users',
      'tasks',
      'task_subtasks',
      'habits',
      'habit_logs',
      'goals',
      'goal_milestones',
      'financial_transactions',
      'budgets',
      'reflections',
      'relationships',
      'relationship_important_dates',
      'contact_interactions',
      'note_folders',
      'notes',
      'ai_memories',
      'audit_logs',
      'password_reset_tokens',
      'scheduled_notifications',
      'notifications',
    ];

    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    for (const table of requiredTables) {
      expect(relationalSchemaCatalog[table]).toBeDefined();
      expect(relationalSchemaCatalog[table].name).toBe(table);
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('ensures every user-owned table defines a foreign key referencing users(id) with ON DELETE CASCADE', () => {
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    const userOwnedTables = [
      'note_folders',
      'goals',
      'goal_milestones',
      'tasks',
      'task_subtasks',
      'habits',
      'habit_logs',
      'financial_transactions',
      'budgets',
      'reflections',
      'relationships',
      'relationship_important_dates',
      'contact_interactions',
      'notes',
      'ai_memories',
      'audit_logs',
      'scheduled_notifications',
      'notifications',
    ];

    for (const table of userOwnedTables) {
      const tableDef = relationalSchemaCatalog[table];
      expect(tableDef).toBeDefined();

      const userFk = tableDef.foreignKeys.find(
        (fk) => fk.referencedTable === 'users' && fk.referencedColumns.includes('id')
      );
      expect(userFk, `Table ${table} must have a foreign key referencing users(id)`).toBeDefined();
      expect(userFk?.onDelete).toBe('CASCADE');

      // Check SQL text has the reference
      expect(schemaSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?REFERENCES users\\(id\\) ON DELETE CASCADE`));
    }
  });

  it('defines primary keys on all tables', () => {
    for (const [tableName, tableDef] of Object.entries(relationalSchemaCatalog)) {
      expect(tableDef.primaryKey.length, `Table ${tableName} must have at least one primary key column`).toBeGreaterThan(0);
    }
  });

  it('defines unique constraints on natural business keys', () => {
    // users email
    expect(relationalSchemaCatalog.users.columns.email.isUnique).toBe(true);

    // habit_logs (user_id, habit_id, date)
    const habitLogsUq = relationalSchemaCatalog.habit_logs.uniqueConstraints.find(
      (uq) => uq.columns.join(',') === 'user_id,habit_id,date'
    );
    expect(habitLogsUq).toBeDefined();

    // reflections (user_id, date)
    const reflectionsUq = relationalSchemaCatalog.reflections.uniqueConstraints.find(
      (uq) => uq.columns.join(',') === 'user_id,date'
    );
    expect(reflectionsUq).toBeDefined();

    // ai_memories (user_id, key)
    const aiMemoriesUq = relationalSchemaCatalog.ai_memories.uniqueConstraints.find(
      (uq) => uq.columns.join(',') === 'user_id,key'
    );
    expect(aiMemoriesUq).toBeDefined();

    // budgets (user_id, category, period, month_year)
    const budgetsUq = relationalSchemaCatalog.budgets.uniqueConstraints.find(
      (uq) => uq.columns.join(',') === 'user_id,category,period,month_year'
    );
    expect(budgetsUq).toBeDefined();
  });

  it('defines B-tree indexes for user isolation and search queries on all user-owned entities', () => {
    const userOwnedTables = [
      'note_folders',
      'goals',
      'tasks',
      'habits',
      'habit_logs',
      'financial_transactions',
      'budgets',
      'reflections',
      'relationships',
      'notes',
      'ai_memories',
      'audit_logs',
      'scheduled_notifications',
      'notifications',
    ];

    for (const table of userOwnedTables) {
      const tableDef = relationalSchemaCatalog[table];
      const hasUserIdIndex = tableDef.indexes.some((idx) => idx.columns[0] === 'user_id');
      expect(hasUserIdIndex, `Table ${table} must have an index starting with user_id`).toBe(true);
    }
  });
});
