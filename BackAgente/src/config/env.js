import dotenv from 'dotenv';

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const env = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'super-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '30d',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  objectivesStandardAmount: Number(process.env.OBJECTIVES_STANDARD_AMOUNT || 12000),
  objectivesRecordExtraAmount: Number(process.env.OBJECTIVES_RECORD_EXTRA_AMOUNT || 2000),
  stockDemoSeedEnabled: parseBoolean(process.env.STOCK_DEMO_SEED, false),
  stockDemoSeedLimit: Number(process.env.STOCK_DEMO_SEED_LIMIT || 12),
  suppliersTestMode: parseBoolean(process.env.SUPPLIERS_TEST_MODE, false),
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
