import { createApp } from './app';
import { loadConfig } from './config/env';
import { buildContainer } from './container';
import { createDataSource } from './database/data-source';

/** Entry point: read config -> connect to Postgres -> wire objects -> start listening. */
async function main() {
  const config = loadConfig();
  const dataSource = await createDataSource({ url: config.databaseUrl, ssl: config.databaseSsl }).initialize();

  const app = createApp(
    { frontendUrl: config.frontendUrl, cookieSecret: config.cookieSecret, trustProxy: config.trustProxy },
    buildContainer(config, dataSource),
  );

  const server = app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
    if (!config.google) console.log('Google sign-in is disabled (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');
  });

  const shutdown = () => {
    server.close(() => void dataSource.destroy().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
