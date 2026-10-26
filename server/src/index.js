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
