import helmet from 'helmet';
import cors from 'cors';
import { FRONTEND_BASE_URL, isProd } from '../config.js';

export const security = [
  helmet({
    contentSecurityPolicy: isProd ? undefined : false
  }),
  cors({
    origin: [FRONTEND_BASE_URL],
    credentials: false
  })
];
