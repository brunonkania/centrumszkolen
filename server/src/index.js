import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`✅ API listening on ${env.PORT} (NODE_ENV=${env.NODE_ENV})`);
});
