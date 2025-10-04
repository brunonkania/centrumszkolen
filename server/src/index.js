import { createServer } from 'http';
import { createApp } from './app.js';
import { PORT } from './config.js';

const app = createApp();
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`[HTTP] Server listening on http://localhost:${PORT}`);
});
