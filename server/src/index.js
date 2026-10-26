import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Load .env for local development (gitignored; production sets real env vars).
// Minimal parser - no dependency: KEY=VALUE lines, no quoting/expansion.
try {
  const envPath = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env - fine */ }

import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

const port = Number(process.env.PORT || 4000);
const app = await createApp();
if (process.env.SEED_ON_EMPTY === '1') {
  await seedIfEmpty();
}
app.listen(port, () => {
  console.log(`[quorum] listening on http://localhost:${port}`);
});
