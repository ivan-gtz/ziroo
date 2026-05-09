import React, { useState, useCallback } from 'react';

interface FlyingImage {
    id: string;
    src: string;
    startX: number;
    startY: number;
}

export const useAnimations = () => {
    const [flyingImages, setFlyingImages] = useState<FlyingImage[]>([]);

    const triggerFlyAnimation = useCallback((
        event: React.MouseEvent | React.TouchEvent,
        imageUrl: string
    ) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

        const newFlyingImage: FlyingImage = {
            id: Date.now().toString(),
            src: imageUrl,
            startX: clientX - rect.left,
            startY: clientY - rect.top
        };

        setFlyingImages(prev => [...prev, newFlyingImage]);

        // Remove after animation completes
        setTimeout(() => {
            setFlyingImages(prev => prev.filter(img => img.id !== newFlyingImage.id));
        }, 1000);
    }, []);

    const removeFlyingImage = useCallback((id: string) => {
        setFlyingImages(prev => prev.filter(img => img.id !== id));
    }, []);

    return {
        flyingImages,
        triggerFlyAnimation,
        removeFlyingImage
    };
};
