/**
 * Migration CLI Script
 *
 * Usage:
 *   npx tsx src/server/scripts/run_migration_cli.ts [--dry-run] [--export-sql <file>]
 */

import fs from 'fs';
import path from 'path';
import { JsonToPostgresMigrator } from './migrate_to_postgres.js';

async function main() {
  console.log('----------------------------------------------------');
  console.log('  ORIGIN JSON -> PostgreSQL Migration Pipeline');
  console.log('----------------------------------------------------');

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || true; // Default safe dry-run unless DB configured
  const sqlExportIdx = args.indexOf('--export-sql');
  const sqlExportFile = sqlExportIdx !== -1 && args[sqlExportIdx + 1] ? args[sqlExportIdx + 1] : null;

  try {
    const rawData = JsonToPostgresMigrator.readJsonDb();
    console.log(`[1/3] Successfully loaded origin_db.json (Schema version: ${rawData.version || 1})`);

    const plan = JsonToPostgresMigrator.planMigration(rawData);
    console.log('[2/3] Migration plan computed:');
    console.log(`  - Total Source Entities Examined: ${plan.report.totalFound}`);
    console.log(`  - Total Valid Rows Mapped:        ${plan.report.totalMapped}`);
    console.log(`  - Total Invalid / Skipped:        ${plan.report.totalInvalid}`);
    console.log(`  - Plan Execution Time:            ${plan.report.executionTimeMs}ms`);
    console.log('\nEntity Breakdown:');
    for (const [entity, s] of Object.entries(plan.report.entityStats)) {
      if (s.foundInSource > 0 || s.mappedRows > 0) {
        console.log(`  • ${entity.padEnd(30)}: ${s.foundInSource} found, ${s.mappedRows} mapped, ${s.invalid} invalid`);
      }
    }

    if (plan.report.warnings.length > 0) {
      console.log('\nWarnings:');
      plan.report.warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
    }

    if (plan.report.errors.length > 0) {
      console.log('\nErrors encountered:');
      plan.report.errors.forEach((e) => console.log(`  ❌ ${e}`));
      process.exit(1);
    }

    if (sqlExportFile) {
      const generatedSql = JsonToPostgresMigrator.generateMigrationSql(plan);
      const outPath = path.isAbsolute(sqlExportFile) ? sqlExportFile : path.join(process.cwd(), sqlExportFile);
      fs.writeFileSync(outPath, generatedSql, 'utf8');
      console.log(`\n[3/3] Exported idempotent migration SQL script to: ${outPath}`);
    } else {
      console.log('\n[3/3] Migration plan validated cleanly and ready for execution.');
    }

    console.log('\nMigration plan status: SUCCESS');
  } catch (err: any) {
    console.error('Migration failed with error:', err.message || err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
