/**
 * SERVICIO DE INVENTARIO
 * 
 * Maneja todas las operaciones de inventario y transacciones.
 * Integrado con órdenes para descuento y restauración automática.
 * Preparado para migración a Supabase.
 */

import { InventoryTransaction, MenuItem, OrderItem } from '../../types';
import { menuService } from './menuService';

// TODO: Reemplazar con Supabase cuando se migre
// import { supabase } from './supabaseClient';

export const inventoryService = {
    /**
     * Descontar stock al crear una orden
     */
    async deductStock(branchId: string, orderItems: OrderItem[]): Promise<void> {
        // TODO: Implementar con Supabase (transacción atómica)
        // const { error } = await supabase.rpc('deduct_stock', {
        //     branch_id: branchId,
        //     order_items: orderItems
        // });

        console.log(`📦 Descontando stock para ${orderItems.length} items...`);

        for (const orderItem of orderItems) {
            const menuItem = await menuService.getItemById(branchId, orderItem.menuItem.id);
            if (!menuItem) continue;

            if (orderItem.variation) {
                // Descontar stock de variación
                const variation = menuItem.variations?.find(v => v.id === orderItem.variation?.id);
                if (variation && variation.stock !== undefined) {
                    const newStock = Math.max(0, variation.stock - orderItem.quantity);
                    await menuService.updateStock(branchId, menuItem.id, variation.id, newStock);
                    console.log(`  ✅ ${menuItem.name} (${variation.name}): ${variation.stock} → ${newStock}`);
                }
            } else if (menuItem.stock !== undefined) {
                // Descontar stock del item principal
                const newStock = Math.max(0, menuItem.stock - orderItem.quantity);
                await menuService.updateStock(branchId, menuItem.id, undefined, newStock);
                console.log(`  ✅ ${menuItem.name}: ${menuItem.stock} → ${newStock}`);
            }
        }
    },

    /**
     * Restaurar stock al cancelar una orden
     */
    async restoreStock(branchId: string, orderItems: OrderItem[]): Promise<void> {
        // TODO: Implementar con Supabase (transacción atómica)
        // const { error } = await supabase.rpc('restore_stock', {
        //     branch_id: branchId,
        //     order_items: orderItems
        // });

        console.log(`🔄 Restaurando stock para ${orderItems.length} items...`);

        for (const orderItem of orderItems) {
            const menuItem = await menuService.getItemById(branchId, orderItem.menuItem.id);
            if (!menuItem) continue;

            if (orderItem.variation) {
                // Restaurar stock de variación
                const variation = menuItem.variations?.find(v => v.id === orderItem.variation?.id);
                if (variation && variation.stock !== undefined) {
                    const newStock = variation.stock + orderItem.quantity;
                    await menuService.updateStock(branchId, menuItem.id, variation.id, newStock);
                    console.log(`  ✅ Restaurado: ${menuItem.name} (${variation.name}) +${orderItem.quantity} = ${newStock}`);
                }
            } else if (menuItem.stock !== undefined) {
                // Restaurar stock del item principal
                const newStock = menuItem.stock + orderItem.quantity;
                await menuService.updateStock(branchId, menuItem.id, undefined, newStock);
                console.log(`  ✅ Restaurado: ${menuItem.name} +${orderItem.quantity} = ${newStock}`);
            }
        }
    },

    /**
     * Agregar stock manualmente
     */
    async addStock(
        branchId: string,
        itemId: string,
        variationId: string | undefined,
        quantity: number,
        userId: string,
        userName: string
    ): Promise<InventoryTransaction> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('inventory_transactions')
        //     .insert([{
        //         branch_id: branchId,
        //         menu_item_id: itemId,
        //         variation_id: variationId,
        //         quantity,
        //         transaction_type: 'manual_add',
        //         user_id: userId,
        //         user_name: userName
        //     }])
        //     .select()
        //     .single();

        const menuItem = await menuService.getItemById(branchId, itemId);
        if (!menuItem) {
            throw new Error('Menu item not found');
        }

        let itemName = menuItem.name;
        let currentStock = 0;

        if (variationId) {
            const variation = menuItem.variations?.find(v => v.id === variationId);
            if (variation) {
                currentStock = variation.stock ?? 0;
                const newStock = currentStock + quantity;
                await menuService.updateStock(branchId, itemId, variationId, newStock);
                itemName = `${menuItem.name} (${variation.name})`;
            }
        } else {
            currentStock = menuItem.stock ?? 0;
            const newStock = currentStock + quantity;
            await menuService.updateStock(branchId, itemId, undefined, newStock);
        }

        const transaction: InventoryTransaction = {
            id: Date.now().toString(),
            branchId,
            menuItemId: itemId,
            variationId,
            itemName,
            quantity,
            timestamp: new Date(),
            userId,
            userName
        };

        // Guardar transacción
        const stateJson = localStorage.getItem('ziroo_order_state');
        const state = stateJson ? JSON.parse(stateJson) : { allOrders: {}, allInventoryTransactions: {}, allDailyCounters: {} };

        const branchTransactions = state.allInventoryTransactions[branchId] || [];
        const updatedTransactions = {
            ...state.allInventoryTransactions,
            [branchId]: [transaction, ...branchTransactions]
        };

        localStorage.setItem('ziroo_order_state', JSON.stringify({
            ...state,
            allInventoryTransactions: updatedTransactions
        }));

        console.log(`📦 Stock agregado: ${itemName} +${quantity} = ${currentStock + quantity}`);

        return transaction;
    },

    /**
     * Obtener transacciones de inventario
     */
    async getTransactions(branchId: string, limit?: number): Promise<InventoryTransaction[]> {
        // TODO: Implementar con Supabase
        // const query = supabase
        //     .from('inventory_transactions')
        //     .select('*')
        //     .eq('branch_id', branchId)
        //     .order('created_at', { ascending: false });

        // if (limit) {
        //     query.limit(limit);
        // }

        // const { data, error } = await query;

        const stateJson = localStorage.getItem('ziroo_order_state');
        const state = stateJson ? JSON.parse(stateJson) : { allOrders: {}, allInventoryTransactions: {}, allDailyCounters: {} };

        const transactions = state.allInventoryTransactions[branchId] || [];

        if (limit) {
            return transactions.slice(0, limit);
        }

        return transactions;
    },

    /**
     * Verificar stock disponible
     */
    async checkStock(branchId: string, itemId: string, variationId: string | undefined, quantity: number): Promise<{
        available: boolean;
        currentStock: number;
        required: number;
    }> {
        const menuItem = await menuService.getItemById(branchId, itemId);

        if (!menuItem) {
            return { available: false, currentStock: 0, required: quantity };
        }

        let currentStock = 0;

        if (variationId) {
            const variation = menuItem.variations?.find(v => v.id === variationId);
            currentStock = variation?.stock ?? 0;
        } else {
            currentStock = menuItem.stock ?? 0;
        }

        return {
            available: currentStock >= quantity,
            currentStock,
            required: quantity
        };
    },

    /**
     * Obtener items con stock bajo
     */
    async getLowStockItems(branchId: string, threshold: number = 5): Promise<{
        itemName: string;
        currentStock: number;
        isVariation: boolean;
        variationName?: string;
    }[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .select('*, menu_item_variations(*)')
        //     .eq('branch_id', branchId)
        //     .or(`stock.lte.${threshold},menu_item_variations.stock.lte.${threshold}`);

        const items = await menuService.getItemsByBranch(branchId);
        const lowStockItems: {
            itemName: string;
            currentStock: number;
            isVariation: boolean;
            variationName?: string;
        }[] = [];

        items.forEach(item => {
            // Verificar item principal
            if (item.stock !== undefined && item.stock <= threshold) {
                lowStockItems.push({
                    itemName: item.name,
                    currentStock: item.stock,
                    isVariation: false
                });
            }

            // Verificar variaciones
            item.variations?.forEach(variation => {
                if (variation.stock !== undefined && variation.stock <= threshold) {
                    lowStockItems.push({
                        itemName: item.name,
                        currentStock: variation.stock,
                        isVariation: true,
                        variationName: variation.name
                    });
                }
            });
        });

        return lowStockItems;
    }
};
