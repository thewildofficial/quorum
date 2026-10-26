import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAuthRouter } from './routes/auth.js';
import eventRoutes from './routes/events.js';
import { attachUser } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'quorum' }));
  app.use('/api/auth', createAuthRouter(deps));
  app.use('/api/events', eventRoutes);
  app.use('/api', notFoundHandler);

  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
