import { api } from './api';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.8;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Rasm faylini tekshirish (hajmi 5 MB dan oshmasligi va ruxsat berilgan formatda bo'lishi)
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Faqat JPG, PNG yoki WEBP formatidagi rasmlar qabul qilinadi",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "Rasm hajmi 5 MB dan oshmasligi kerak",
    };
  }

  return { valid: true };
}

/**
 * Rasmni brauzerda 1600px gacha kichraytirish va JPEG 0.8 sifatga siqish
 */
export async function compressAndResizeImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = COMPRESSION_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas kontekstini yaratib bo‘lmadi'));
        return;
      }

      // Silliq masshtablash
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Rasmni siqishda xatolik yuz berdi'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Rasmni o‘qib bo‘lmadi'));
    };

    img.src = objectUrl;
  });
}

/**
 * Rasmni tekshirish, siqish va server orqali olingan imzolangan yuklash havolasiga yuklash
 */
export async function uploadCompressedPhoto(file: File): Promise<{ path: string }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Noto‘g‘ri fayl');
  }

  // 1. Rasmni 1600px va JPEG 0.8 sifatga siqish
  const compressedBlob = await compressAndResizeImage(file);

  // 2. Serverdan imzolangan yuklash havolasini olish
  const { path, signedUrl } = await api.signUpload('image/jpeg');

  // 3. To'g'ridan-to'g'ri storage'ga yuklash
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
    },
    body: compressedBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Rasmni yuklashda xatolik (${uploadResponse.status})`);
  }

  return { path };
}
