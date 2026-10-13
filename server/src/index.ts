import { buildApp } from './app.js';
import { env } from './env.js';

const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`UstaTop server ishga tushdi: http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
