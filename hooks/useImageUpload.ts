import { useState, useCallback, ChangeEvent } from 'react';
import { compressImageToBlob } from '../lib/imageUtils';
import { supabase } from '../services/supabase';

interface UploadState {
    uploading: boolean;
    error: string | null;
    progress: number;
}

export const useImageUpload = () => {
    const [uploadState, setUploadState] = useState<UploadState>({
        uploading: false,
        error: null,
        progress: 0
    });

    const uploadImage = useCallback(async (
        event: ChangeEvent<HTMLInputElement>,
        bucketName = 'menu-images'
    ): Promise<string | null> => {
        const file = event.target.files?.[0];
        if (!file) return null;

        setUploadState({ uploading: true, error: null, progress: 0 });

        try {
            // 1. Comprimir imagen a Blob (más eficiente para upload)
            setUploadState(prev => ({ ...prev, progress: 20 }));
            const compressedBlob = await compressImageToBlob(file, 0.4, 800, 800);

            // 2. Generar nombre de archivo único
            const fileExt = file.name.split('.').pop() || 'webp';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            setUploadState(prev => ({ ...prev, progress: 50 }));

            // 3. Subir a Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, compressedBlob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/webp'
                });

            if (uploadError) throw uploadError;

            // 4. Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            setUploadState(prev => ({ ...prev, progress: 100 }));
            
            // Delay para feedback visual
            await new Promise(resolve => setTimeout(resolve, 300));
            setUploadState({ uploading: false, error: null, progress: 0 });

            return publicUrl;
        } catch (error: any) {
            console.error("❌ uploadImage error:", error);
            const errorMessage = error.message || 'Error al subir imagen';
            setUploadState({ uploading: false, error: errorMessage, progress: 0 });
            return null;
        }
    }, []);

    const uploadMultipleImages = useCallback(async (
        files: FileList,
        bucketName = 'menu-images'
    ): Promise<string[]> => {
        setUploadState({ uploading: true, error: null, progress: 0 });

        try {
            const uploadPromises = Array.from(files).map(async (file, index) => {
                const compressedBlob = await compressImageToBlob(file, 0.4, 800, 800);
                const fileExt = file.name.split('.').pop() || 'webp';
                const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(fileName, compressedBlob, { contentType: 'image/webp' });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from(bucketName)
                    .getPublicUrl(fileName);

                const progress = ((index + 1) / files.length) * 100;
                setUploadState(prev => ({ ...prev, progress }));
                return publicUrl;
            });

            const results = await Promise.all(uploadPromises);
            setUploadState({ uploading: false, error: null, progress: 0 });
            return results;
        } catch (error: any) {
            console.error("❌ uploadMultipleImages error:", error);
            const errorMessage = error.message || 'Error al subir imágenes';
            setUploadState({ uploading: false, error: errorMessage, progress: 0 });
            return [];
        }
    }, []);

    const resetUploadState = useCallback(() => {
        setUploadState({ uploading: false, error: null, progress: 0 });
    }, []);

    return {
        ...uploadState,
        uploadImage,
        uploadMultipleImages,
        resetUploadState
    };
};
