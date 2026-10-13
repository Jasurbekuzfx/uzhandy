import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICES = [
  { slug: 'santexnika', nameUz: 'Santexnika' },
  { slug: 'elektrik', nameUz: 'Elektrik' },
  { slug: 'maishiy-texnika', nameUz: 'Maishiy texnika ta\'miri' },
];

const TASHKENT_DISTRICTS = [
  'Bektemir',
  'Chilonzor',
  'Mirobod',
  'Mirzo Ulug‘bek',
  'Olmazor',
  'Sergeli',
  'Shayxontohur',
  'Uchtepa',
  'Yakkasaroy',
  'Yangihayot',
  'Yashnobod',
  'Yunusobod',
];

async function main(): Promise<void> {
  console.log('Seeding boshlandi...');

  // 1. Xizmatlarni upsert qilish (takroriy chaqirilganda ham xatosiz va dublikatsiz ishlaydi)
  for (const service of SERVICES) {
    const upsertedService = await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        nameUz: service.nameUz,
        isActive: true,
      },
      create: {
        slug: service.slug,
        nameUz: service.nameUz,
        isActive: true,
      },
    });
    console.log(`Xizmat: ${upsertedService.nameUz} (${upsertedService.slug})`);
  }

  // 2. Toshkentning 12 tumanini upsert qilish
  for (const districtName of TASHKENT_DISTRICTS) {
    const upsertedDistrict = await prisma.district.upsert({
      where: { nameUz: districtName },
      update: {},
      create: {
        nameUz: districtName,
      },
    });
    console.log(`Tuman: ${upsertedDistrict.nameUz}`);
  }

  console.log('Seeding muvaffaqiyatli yakunlandi!');
}

main()
  .catch((e) => {
    console.error('Seeding jarayonida xatolik yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
