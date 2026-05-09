/**
 * SERVICIO DE IMÁGENES
 * 
 * Maneja la subida y gestión de imágenes.
 * Actualmente usa compresión local y base64.
 * Preparado para migrar a Supabase Storage.
 */

import { compressImage } from '../../lib/imageUtils';

// TODO: Reemplazar con Supabase Storage cuando se migre
// import { supabase } from './supabaseClient';

export const imageService = {
    /**
     * Subir una imagen
     * 
     * Actualmente: Comprime y retorna base64
     * Futuro: Sube a Supabase Storage y retorna URL pública
     */
    async upload(file: File, path: string): Promise<string> {
        // TODO: Implementar con Supabase Storage
        // const { data, error } = await supabase.storage
        //     .from('images')
        //     .upload(path, file, {
        //         cacheControl: '3600',
        //         upsert: false
        //     });

        // if (error) throw error;

        // const { data: { publicUrl } } = supabase.storage
        //     .from('images')
        //     .getPublicUrl(path);

        // return publicUrl;

        // Por ahora, comprimir y retornar base64
        const compressedDataUrl = await compressImage(file);
        return compressedDataUrl;
    },

    /**
     * Subir múltiples imágenes
     */
    async uploadMultiple(files: File[], basePath: string): Promise<string[]> {
        // TODO: Implementar con Supabase Storage
        // const uploadPromises = Array.from(files).map(async (file, index) => {
        //     const path = `${basePath}/${Date.now()}_${index}_${file.name}`;
        //     return await this.upload(file, path);
        // });

        // return await Promise.all(uploadPromises);

        // Por ahora, comprimir todas y retornar base64
        const uploadPromises = Array.from(files).map(file => compressImage(file));
        return await Promise.all(uploadPromises);
    },

    /**
     * Eliminar una imagen
     */
    async delete(path: string): Promise<void> {
        // TODO: Implementar con Supabase Storage
        // const { error } = await supabase.storage
        //     .from('images')
        //     .remove([path]);

        // if (error) throw error;

        // Por ahora, no hace nada (base64 se elimina automáticamente)
        console.log(`🗑️ Imagen eliminada (simulado): ${path}`);
    },

    /**
     * Obtener URL pública de una imagen
     */
    async getPublicUrl(path: string): Promise<string> {
        // TODO: Implementar con Supabase Storage
        // const { data: { publicUrl } } = supabase.storage
        //     .from('images')
        //     .getPublicUrl(path);

        // return publicUrl;

        // Por ahora, retorna el path tal cual (asumiendo que es base64 o URL)
        return path;
    },

    /**
     * Listar imágenes en un directorio
     */
    async list(path: string): Promise<string[]> {
        // TODO: Implementar con Supabase Storage
        // const { data, error } = await supabase.storage
        //     .from('images')
        //     .list(path);

        // if (error) throw error;

        // return data.map(file => file.name);

        // Por ahora, retorna array vacío
        return [];
    },

    /**
     * Validar tipo de archivo
     */
    validateImageType(file: File): boolean {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        return validTypes.includes(file.type);
    },

    /**
     * Validar tamaño de archivo
     */
    validateImageSize(file: File, maxSizeMB: number = 5): boolean {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    },

    /**
     * Validar imagen completa
     */
    validateImage(file: File, maxSizeMB: number = 5): {
        valid: boolean;
        error?: string;
    } {
        if (!this.validateImageType(file)) {
            return {
                valid: false,
                error: 'Tipo de archivo no válido. Solo se permiten: JPG, PNG, GIF, WEBP'
            };
        }

        if (!this.validateImageSize(file, maxSizeMB)) {
            return {
                valid: false,
                error: `El archivo es demasiado grande. Máximo ${maxSizeMB}MB`
            };
        }

        return { valid: true };
    },

    /**
     * Generar nombre único para archivo
     */
    generateUniqueFileName(originalName: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop();
        return `${timestamp}_${random}.${extension}`;
    },

    /**
     * Obtener ruta para subida
     */
    getUploadPath(type: 'menu' | 'logo' | 'qr' | 'receipt' | 'animation', fileName: string): string {
        return `${type}/${fileName}`;
    }
};
