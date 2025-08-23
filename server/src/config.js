import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  db: { url: process.env.POSTGRES_URL },
  jwt: { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES || '7d' },
  p24: {
    merchantId: Number(process.env.P24_MERCHANT_ID),
    posId: Number(process.env.P24_POS_ID),
    apiKey: process.env.P24_API_KEY,
    crc: process.env.P24_CRC,
    sandbox: String(process.env.P24_SANDBOX).toLowerCase() === 'true'
  }
};
