const app = require('./app');
const logger = require('./config/logger');
const migrate = require('./scripts/migrate');

const isProd = process.env.NODE_ENV === 'production';

// In production listen on localhost only, so the app can be reached only
// through the proxy (keeps HTTPS and TRUST_PROXY honest).
const HOST = process.env.HOST || (isProd ? '127.0.0.1' : '0.0.0.0');
const PORT = Number(process.env.PORT) || 4000;

async function start() {
  // MIGRATE_ON_START=false if you prefer to run `npm run migrate` yourself
  // (e.g. as a separate deploy step).
  if (process.env.MIGRATE_ON_START !== 'false') {
    await migrate({ log: (msg) => logger.info({ event: 'migration' }, msg) });
  }
  app.listen(PORT, HOST, () => {
    logger.info(
      { host: HOST, port: PORT, env: isProd ? 'production' : 'development', trustProxy: app.locals.trustProxy },
      `Auth API (MySQL) on http://${HOST}:${PORT}`
    );
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'server failed to start');
  process.exit(1);
});
