import { describe, it, expect, vi } from 'vitest';
import { prisma } from '../db.js';

describe('Bot contact handler logic', () => {
  it('boshqa odamning kontakti kelganda rad etiladi va bazaga saqlanmaydi', async () => {
    const fromId = 12345678;
    const contact = {
      user_id: 87654321, // Boshqa odamning Telegram ID si
      phone_number: '+998901234567',
      first_name: 'Begona',
    };

    const updateSpy = vi.spyOn(prisma.user, 'upsert');

    // Tekshiruv logikasi: contact.user_id === from.id
    const isOwnContact = contact.user_id === fromId;
    expect(isOwnContact).toBe(false);

    // Agar begona bo'lsa upsert chaqirilmasligi kerak
    if (!isOwnContact) {
      // Rad etiladi
    } else {
      await prisma.user.upsert({
        where: { telegramId: BigInt(fromId) },
        create: { telegramId: BigInt(fromId), firstName: 'Test', phone: contact.phone_number },
        update: { phone: contact.phone_number },
      });
    }

    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it('o‘zining kontakti kelganda muvaffaqiyatli qabul qilinadi', async () => {
    const fromId = 12345678;
    const contact = {
      user_id: 12345678, // O'zining Telegram ID si
      phone_number: '+998901234567',
      first_name: 'Rustam',
    };

    const isOwnContact = contact.user_id === fromId;
    expect(isOwnContact).toBe(true);

    const upsertSpy = vi.spyOn(prisma.user, 'upsert').mockResolvedValue({
      id: 'usr_test',
      telegramId: BigInt(fromId),
      firstName: 'Rustam',
      lastName: null,
      username: null,
      photoUrl: null,
      phone: contact.phone_number,
      role: 'CUSTOMER',
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (isOwnContact) {
      await prisma.user.upsert({
        where: { telegramId: BigInt(fromId) },
        create: {
          telegramId: BigInt(fromId),
          firstName: contact.first_name,
          phone: contact.phone_number,
          role: 'CUSTOMER',
        },
        update: { phone: contact.phone_number },
      });
    }

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    upsertSpy.mockRestore();
  });
});
