/**
 * SERVICIO DE MENÚ
 * 
 * Maneja todas las operaciones CRUD de menú y categorías.
 * Preparado para migración a Supabase.
 */

import { MenuItem, Category, MenuItemVariation } from '../../types';

// TODO: Reemplazar con Supabase cuando se migre
// import { supabase } from './supabaseClient';

export const menuService = {
    // ==================== ITEMS DEL MENÚ ====================

    /**
     * Obtener todos los items del menú
     */
    async getAllItems(): Promise<Record<string, MenuItem[]>> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .select('*, menu_item_variations(*)')
        //     .order('name');

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : { allMenuItems: {}, allCategories: {} };
        return state.allMenuItems || {};
    },

    /**
     * Obtener items por sucursal
     */
    async getItemsByBranch(branchId: string): Promise<MenuItem[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .select('*, menu_item_variations(*)')
        //     .eq('branch_id', branchId)
        //     .order('name');

        const allItems = await this.getAllItems();
        return allItems[branchId] || [];
    },

    /**
     * Obtener item por ID
     */
    async getItemById(branchId: string, itemId: string): Promise<MenuItem | null> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .select('*, menu_item_variations(*)')
        //     .eq('id', itemId)
        //     .single();

        const items = await this.getItemsByBranch(branchId);
        return items.find(i => i.id === itemId) || null;
    },

    /**
     * Crear item del menú
     */
    async createItem(branchId: string, item: Omit<MenuItem, 'id'>): Promise<MenuItem> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .insert([{ ...item, branch_id: branchId }])
        //     .select('*, menu_item_variations(*)')
        //     .single();

        const newItem: MenuItem = {
            ...item,
            id: Date.now().toString()
        };

        const allItems = await this.getAllItems();
        const branchItems = allItems[branchId] || [];
        const updatedItems = { ...allItems, [branchId]: [...branchItems, newItem] };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allMenuItems: updatedItems
        }));

        return newItem;
    },

    /**
     * Actualizar item del menú
     */
    async updateItem(branchId: string, item: MenuItem): Promise<MenuItem> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('menu_items')
        //     .update(item)
        //     .eq('id', item.id)
        //     .select('*, menu_item_variations(*)')
        //     .single();

        const allItems = await this.getAllItems();
        const branchItems = allItems[branchId] || [];
        const updatedBranchItems = branchItems.map(i => i.id === item.id ? item : i);
        const updatedItems = { ...allItems, [branchId]: updatedBranchItems };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allMenuItems: updatedItems
        }));

        return item;
    },

    /**
     * Eliminar item del menú
     */
    async deleteItem(branchId: string, itemId: string): Promise<void> {
        // TODO: Implementar con Supabase
        // const { error } = await supabase
        //     .from('menu_items')
        //     .delete()
        //     .eq('id', itemId);

        const allItems = await this.getAllItems();
        const branchItems = allItems[branchId] || [];
        const updatedBranchItems = branchItems.filter(i => i.id !== itemId);
        const updatedItems = { ...allItems, [branchId]: updatedBranchItems };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allMenuItems: updatedItems
        }));
    },

    /**
     * Actualizar stock de un item
     */
    async updateStock(branchId: string, itemId: string, variationId: string | undefined, newStock: number): Promise<void> {
        // TODO: Implementar con Supabase
        // if (variationId) {
        //     await supabase
        //         .from('menu_item_variations')
        //         .update({ stock: newStock })
        //         .eq('id', variationId);
        // } else {
        //     await supabase
        //         .from('menu_items')
        //         .update({ stock: newStock })
        //         .eq('id', itemId);
        // }

        const item = await this.getItemById(branchId, itemId);
        if (!item) return;

        if (variationId && item.variations) {
            item.variations = item.variations.map(v =>
                v.id === variationId ? { ...v, stock: newStock } : v
            );
        } else {
            item.stock = newStock;
        }

        await this.updateItem(branchId, item);
    },

    // ==================== CATEGORÍAS ====================

    /**
     * Obtener todas las categorías
     */
    async getAllCategories(): Promise<Record<string, Category[]>> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('categories')
        //     .select('*')
        //     .order('name');

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : { allMenuItems: {}, allCategories: {} };
        return state.allCategories || {};
    },

    /**
     * Obtener categorías por sucursal
     */
    async getCategoriesByBranch(branchId: string): Promise<Category[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('categories')
        //     .select('*')
        //     .eq('branch_id', branchId)
        //     .order('name');

        const allCategories = await this.getAllCategories();
        return allCategories[branchId] || [];
    },

    /**
     * Crear categoría
     */
    async createCategory(branchId: string, category: Omit<Category, 'id'>): Promise<Category> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('categories')
        //     .insert([{ ...category, branch_id: branchId }])
        //     .select()
        //     .single();

        const newCategory: Category = {
            ...category,
            id: Date.now().toString()
        };

        const allCategories = await this.getAllCategories();
        const branchCategories = allCategories[branchId] || [];
        const updatedCategories = { ...allCategories, [branchId]: [...branchCategories, newCategory] };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allCategories: updatedCategories
        }));

        return newCategory;
    },

    /**
     * Actualizar categoría
     */
    async updateCategory(branchId: string, category: Category): Promise<Category> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('categories')
        //     .update(category)
        //     .eq('id', category.id)
        //     .select()
        //     .single();

        const allCategories = await this.getAllCategories();
        const branchCategories = allCategories[branchId] || [];
        const updatedBranchCategories = branchCategories.map(c => c.id === category.id ? category : c);
        const updatedCategories = { ...allCategories, [branchId]: updatedBranchCategories };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allCategories: updatedCategories
        }));

        return category;
    },

    /**
     * Eliminar categoría
     */
    async deleteCategory(branchId: string, categoryId: string): Promise<void> {
        // TODO: Implementar con Supabase
        // const { error } = await supabase
        //     .from('categories')
        //     .delete()
        //     .eq('id', categoryId);

        const allCategories = await this.getAllCategories();
        const branchCategories = allCategories[branchId] || [];
        const updatedBranchCategories = branchCategories.filter(c => c.id !== categoryId);
        const updatedCategories = { ...allCategories, [branchId]: updatedBranchCategories };

        const stateJson = localStorage.getItem('ziroo_menu_state');
        const state = stateJson ? JSON.parse(stateJson) : {};
        localStorage.setItem('ziroo_menu_state', JSON.stringify({
            ...state,
            allCategories: updatedCategories
        }));
    }
};
