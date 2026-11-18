import { loadConfig } from '../config/env';
import { createDataSource } from './data-source';

/** `npm run migrate`: applies every migration that has not run yet, then exits. */
async function main() {
  const config = loadConfig();
  const dataSource = await createDataSource({ url: config.databaseUrl, ssl: config.databaseSsl }).initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is already up to date.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
