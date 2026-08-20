import { createApp } from './app.js';

async function bootstrap() {
  const { app, seedData } = await createApp();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`[Aegis Retail Cloud API] Listening on http://${host}:${port}`);
    console.log(`[Demo Seed] Store ID: ${seedData.storeId}`);
    console.log(`[Demo Seed] Manager: ${seedData.managerUser.email} / ${seedData.managerUser.rawPassword}`);
    console.log(`[Demo Seed] Device ID: ${seedData.device.id} (${seedData.device.identifier})`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
