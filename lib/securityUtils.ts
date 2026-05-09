
/**
 * Security utilities for Ziroo App.
 * Prevents XSS, path injection, and large payload attacks.
 */

/**
 * Sanitizes input string to prevent basic XSS and strip unwanted HTML tags.
 * React already escapes content in curly braces, but this adds an extra layer 
 * for data that might be rendered dangerously or used in attributes.
 */
export const sanitizeInput = (text: string): string => {
    if (!text) return '';
    // Basic strip for scripts and common XSS vectors
    return text
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/on\w+="[^"]*"/gim, "") // remove event handlers like onclick=
        .substring(0, 1000); // hard limit of 1000 characters for most fields
};

/**
 * Validates file type and size before any processing (compression/upload).
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    const MAX_SIZE_MB = 10; // 10MB as absolute maximum before compression
    
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
        return { 
            valid: false, 
            error: 'Solo se permiten imágenes (JPG, PNG, WEBP, GIF).' 
        };
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return { 
            valid: false, 
            error: `La imagen es demasiado grande. Máximo ${MAX_SIZE_MB}MB.` 
        };
    }

    // Check extension against type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const typeExts: Record<string, string[]> = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/gif': ['gif']
    };

    if (ext && typeExts[file.type] && !typeExts[file.type].includes(ext)) {
        // Disguised file extension
        return {
            valid: false,
            error: 'La extensión del archivo no coincide con su contenido real.'
        };
    }

    return { valid: true };
};

/**
 * Common text field limits
 */
export const TEXT_LIMITS = {
    NAME: 50,
    DESCRIPTION: 250,
    ADDRESS: 150,
    NOTES: 500,
    PHONE: 20,
    CURRENCY: 5,
    CITY: 50,
    TAX_ID: 30,
    RAZON_SOCIAL: 100,
    SOCIAL_URL: 200,
    MAPS_LINK: 500
};
