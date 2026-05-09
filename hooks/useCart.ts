import { useState, useCallback, useEffect } from 'react';
import { MenuItem, MenuItemVariation } from '../types';

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
    variation?: MenuItemVariation;
}

const CART_STORAGE_KEY = 'ziroo_client_cart';

export const useCart = () => {
    // Inicializar desde localStorage para persistencia inmediata (Pilar 3)
    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Sincronizar cambios a localStorage
    useEffect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = useCallback((
        item: MenuItem,
        quantity: number = 1,
        variationId?: string
    ) => {
        setCartItems(prevItems => {
            const newItems = [...prevItems];
            const variation = variationId
                ? item.variations?.find(v => v.id === variationId)
                : undefined;

            const existingIndex = newItems.findIndex(ci =>
                ci.menuItem.id === item.id &&
                ci.variation?.id === variation?.id
            );

            if (existingIndex > -1) {
                newItems[existingIndex] = {
                    ...newItems[existingIndex],
                    quantity: newItems[existingIndex].quantity + quantity
                };
            } else {
                newItems.push({
                    menuItem: item,
                    quantity,
                    variation
                });
            }

            return newItems;
        });
    }, []);

    const updateQuantity = useCallback((index: number, change: number) => {
        setCartItems(prevItems => {
            const newItems = [...prevItems];
            const newQuantity = newItems[index].quantity + change;

            if (newQuantity <= 0) {
                newItems.splice(index, 1);
            } else {
                newItems[index] = {
                    ...newItems[index],
                    quantity: newQuantity
                };
            }

            return newItems;
        });
    }, []);

    const removeItem = useCallback((index: number) => {
        setCartItems(prevItems => {
            const newItems = [...prevItems];
            newItems.splice(index, 1);
            return newItems;
        });
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    const getTotal = useCallback(() => {
        return cartItems.reduce((sum, item) => {
            const price = item.variation?.price ?? item.menuItem.price;
            return sum + (price * item.quantity);
        }, 0);
    }, [cartItems]);

    const getItemCount = useCallback(() => {
        return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }, [cartItems]);

    const getItemTotalQuantity = useCallback((menuItem: MenuItem) => {
        return cartItems
            .filter(ci => ci.menuItem.id === menuItem.id)
            .reduce((sum, ci) => sum + ci.quantity, 0);
    }, [cartItems]);

    return {
        cartItems,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        getTotal,
        getItemCount,
        getItemTotalQuantity
    };
};
