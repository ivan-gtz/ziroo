import { validateImageFile } from './securityUtils';

/**
 * Expert level image compression for mobile.
 * Uses ImageBitmap and asynchronous decoding to prevent memory crashes on mobile devices.
 * Now optimizes for WebP and handles large assets effectively.
 */
export const compressImage = async (
  file: File,
  quality = 0.5, // 0.5 balance
  maxWidth = 800,
  maxHeight = 800
): Promise<string> => {
  return processWithExpertEngine(file, quality, maxWidth, maxHeight, 'base64') as Promise<string>;
};

export const compressImageToBlob = async (
  file: File,
  quality = 0.4, // Aggressive for storage
  maxWidth = 800,
  maxHeight = 800
): Promise<Blob> => {
  return processWithExpertEngine(file, quality, maxWidth, maxHeight, 'blob') as Promise<Blob>;
};

/**
 * The core engine using high-performance APIs for mobile stability.
 */
async function processWithExpertEngine(
  file: File,
  quality: number,
  maxWidth: number,
  maxHeight: number,
  outputType: 'base64' | 'blob'
): Promise<string | Blob> {
  const { valid, error } = validateImageFile(file);
  if (!valid) throw new Error(error || 'El archivo no es una imagen válida.');

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;

    // Wait for basic load
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Error al cargar archivo inicial.'));
    });

    // 1. Force hardware decoding
    if ('decode' in img) {
      await img.decode().catch(e => console.warn('Decode failed, continuing anyway', e));
    }

    // 2. Calculate dimensions
    let { width, height } = img;
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    if (ratio < 1) {
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 3. Multi-step downscaling for better quality vs size
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha for transparent PNGs

    if (!ctx) throw new Error('No se pudo inicializar el motor de imagen.');

    // 4. Draw optimized bitmap if possible
    try {
      if (window.createImageBitmap) {
        const bitmap = await createImageBitmap(img, { 
          resizeWidth: width, 
          resizeHeight: height, 
          resizeQuality: 'medium'
        });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } else {
        ctx.drawImage(img, 0, 0, width, height);
      }
    } catch (e) {
      ctx.drawImage(img, 0, 0, width, height);
    }

    // 5. Final Output format selection
    // WebP supports transparency and is ~30% smaller than JPEG
    const formats = ['image/webp', 'image/png'];
    let selectedFormat = 'image/png';
    
    // Check if browser supports WebP (standard now, but good to be safe)
    if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
      selectedFormat = 'image/webp';
    }

    if (outputType === 'base64') {
      const dataUrl = canvas.toDataURL(selectedFormat, quality);
      if (dataUrl.length < 100) throw new Error('Exportación fallida');
      return dataUrl;
    } else {
      return new Promise((res, rej) => {
        canvas.toBlob(b => b ? res(b) : rej(new Error('Blob failure')), selectedFormat, quality);
      });
    }

  } finally {
    URL.revokeObjectURL(url);
  }
}

