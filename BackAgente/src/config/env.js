import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'super-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '30d',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  vapidSubject: process.env.VAPID_SUBJECT || '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agente_db'
  }
};
