import { PrismaClient } from '@prisma/client';

// BigInt qiymatlarini JSON.stringify qilganda string formatiga aylantirish
// Bu Telegram ID kabi katta sonlar bilan ishlaganda xatolik bermasligini ta'minlaydi
interface BigIntWithToJSON {
  toJSON?: () => string;
}

if (!(BigInt.prototype as unknown as BigIntWithToJSON).toJSON) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function (): string {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
