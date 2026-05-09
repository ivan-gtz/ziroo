
import { supabase } from '../services/supabase';

/**
 * Sube una imagen (Base64 o Blob) al Storage de Supabase.
 * Retorna la URL pública de la imagen.
 */
export const uploadToStorage = async (
    path: string, // Nombre del archivo (ej: 'logos/mi-logo.jpg')
    content: string | Blob, // Base64 string o Blob
    bucket: string = 'branding'
): Promise<string> => {
    let fileBody: Blob;
    let contentType = 'image/png';

    if (typeof content === 'string' && content.startsWith('data:')) {
        // Extraer mimetype real
        const match = content.match(/^data:([^;]+);base64,/);
        if (match) {
            contentType = match[1];
        }
        // Convertir Base64 a Blob
        const response = await fetch(content);
        fileBody = await response.blob();
    } else if (content instanceof Blob) {
        fileBody = content;
        contentType = content.type || 'image/png';
    } else {
        throw new Error('Formato de imagen no soportado para carga.');
    }

    // Limpiar path
    const parts = path.split('/');
    const originalName = parts.pop() || 'image.png';
    // Mantiene letras, numeros, puntos y guiones. Sin espacios ni caracteres especiales.
    const cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase();
    
    // Armar fullPath limpio (ej: branch_id/animation_logo.png)
    const folder = parts.length > 0 ? parts.join('/') + '/' : '';
    const fullPath = folder + cleanName;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fullPath, fileBody, {
            cacheControl: '10', // Cache pequeño para actualizar instantáneo
            upsert: true,
            contentType: contentType
        });

    if (uploadError) {
        console.error('❌ Error al subir a Storage:', uploadError);
        throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);

    // Adjuntar string de query para romper la caché del Service Worker en UI
    return publicUrlData.publicUrl + '?v=' + Date.now();
};
