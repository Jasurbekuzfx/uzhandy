import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env.js';

export interface TokenPayload {
  userId: string;
}

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

/**
 * JWT token yaratish: HS256, 7 kun amal qilish muddati, faqat userId saqlanadi
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

/**
 * JWT tokenni tekshirish va undan userId ni ajratib olish
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
  });

  const userId = payload.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Token tarkibida yaroqli userId topilmadi');
  }

  return { userId };
}
