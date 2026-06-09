
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { supabase } from '../services/supabase';
import { MenuItem, Category, ProductExtra } from '../types';
import { INITIAL_MENU_ITEMS, INITIAL_CATEGORIES, MAIN_BRANCH_ID } from '../constants';
import { useAuth } from './AuthContext';

interface MenuState {
    allMenuItems: Record<string, MenuItem[]>;
    allCategories: Record<string, Category[]>;
    allExtras: Record<string, ProductExtra[]>;
}

const INITIAL_MENU_STATE: MenuState = {
    allMenuItems: { [MAIN_BRANCH_ID]: INITIAL_MENU_ITEMS },
    allCategories: { [MAIN_BRANCH_ID]: INITIAL_CATEGORIES },
    allExtras: {}
};

interface MenuContextProps {
    // Items del menú
    menuItems: MenuItem[];
    allMenuItems: Record<string, MenuItem[]>;
    addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
    updateMenuItem: (item: MenuItem) => Promise<void>;
    deleteMenuItem: (id: string, categoryId: string) => Promise<void>;

    // Categorías
    categories: Category[];
    allCategories: Record<string, Category[]>;
    addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
    updateCategory: (cat: Category) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    // Extras
    extras: ProductExtra[];
    allExtras: Record<string, ProductExtra[]>;
    addProductExtra: (extra: Omit<ProductExtra, 'id'>) => Promise<void>;
    updateProductExtra: (extra: ProductExtra) => Promise<void>;
    deleteProductExtra: (id: string) => Promise<void>;

    // branchSettings (para clientes)
    branchSettings: Record<string, any>;
    loading: boolean;

    // Utilidad interna para actualizar stock (usado por OrderContext)
    updateMenuItemStock: (branchId: string, items: MenuItem[]) => void;
}

const MenuContext = createContext<MenuContextProps | undefined>(undefined);

interface MenuProviderProps {
    children: ReactNode;
    activeBranchId: string | null;
    currentUser: any;
}

export const MenuProvider: React.FC<{ children: ReactNode, activeBranchId: string | null }> = ({ children, activeBranchId }) => {
    const { currentUser } = useAuth();
    // We keep the structure of Record<string, MenuItem[]> to minimize refactor, 
    // but we will primarily populate the active branch.
    // Configuración de caché
    const CACHE_KEY = "ziroo_menu_cache";
    const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

    const [menuState, setMenuState] = React.useState<MenuState>(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error("Error loading menu cache:", e);
        }
        return {
            allMenuItems: {},
            allCategories: {},
            allExtras: {},
            lastUpdated: {}
        };
    });

    const [branchSettings, setBranchSettings] = React.useState<Record<string, any>>({});
    const [loading, setLoading] = React.useState(true);

    // Persistir en localStorage cuando cambie el estado
    React.useEffect(() => {
        localStorage.setItem(CACHE_KEY, JSON.stringify(menuState));
    }, [menuState]);

    React.useEffect(() => {
        if (!activeBranchId) return;

        const now = Date.now();
        const lastUpdate = (menuState as any).lastUpdated?.[activeBranchId] || 0;
        const isCacheFresh = now - lastUpdate < CACHE_TIMEOUT;
        const hasData = !!menuState.allMenuItems[activeBranchId];

        // PRIORIZAR CACHE: Si tenemos datos (aunque sena viejos), no bloqueamos la UI con un loader.
        if (hasData) {
            setLoading(false);
        } else {
            setLoading(true);
        }

        const fetchData = async (isBackground = false) => {
            if (!activeBranchId) return;
            
            // Si no hay usuario y ya tenemos datos (aunque sean viejos), permitimos mostrar lo que hay
            // mientras se actualiza en segundo plano para evitar "flashear" el loader.
            if (!isBackground && !currentUser && hasData && (now - lastUpdate < CACHE_TIMEOUT * 2)) {
                setLoading(false);
            }

            try {
                // OPTIMIZACIÓN: Solo pedir campos necesarios
                let catsQuery = supabase.from('categories')
                    .select('id, name, icon_type, icon_value')
                    .eq('branch_id', activeBranchId);
                    
                let extrasQuery = supabase.from('product_extras')
                    .select('id, name, price')
                    .eq('branch_id', activeBranchId);
                    
                let itemsQuery = supabase.from('menu_items')
                    .select(`
                        id, category_id, name, description, price, stock, image_url, is_combo, 
                        main_product_id, main_variant_id, combo_items,
                        variations:menu_item_variations!menu_item_id(
                            id, name, price, stock, image_url,
                            extra_links:menu_item_variation_extras_link(
                                extra:product_extras(id, name, price)
                            )
                        ),
                        extra_links:menu_item_extras_link(
                            extra:product_extras(id, name, price)
                        )
                    `)
                    .eq('branch_id', activeBranchId);

                if (currentUser?.role !== 'SuperAdmin' && currentUser?.restaurantId) {
                    catsQuery = catsQuery.eq('restaurant_id', currentUser.restaurantId);
                    extrasQuery = extrasQuery.eq('restaurant_id', currentUser.restaurantId);
                    itemsQuery = itemsQuery.eq('restaurant_id', currentUser.restaurantId);
                }

                // OPTIMIZACIÓN: Bloques individuales para evitar que un fallo bloquee todo el menú
                const [catsRes, extrasRes, itemsRes] = await Promise.all([
                    catsQuery.order('created_at', { ascending: true }).then(r => r, e => ({ data: null, error: e })),
                    extrasQuery.then(r => r, e => ({ data: null, error: e })),
                    itemsQuery.then(r => r, e => ({ data: null, error: e }))
                ]);

                const cats = catsRes.data;
                const catError = catsRes.error;
                const extrasData = extrasRes.data;
                const extrasError = extrasRes.error;
                const items = itemsRes.data;
                const itemError = itemsRes.error;

                if (catError) console.error("❌ Error fetching categories:", catError);
                if (extrasError) console.error("❌ Error fetching extras library:", extrasError);
                if (itemError) console.error("❌ Error fetching items:", itemError);

                if (cats || items) {
                    const mappedCats: Category[] = (cats || []).map(c => ({
                        id: c.id,
                        name: c.name,
                        iconType: c.icon_type as any,
                        iconValue: c.icon_value
                    }));

                    const mappedExtras: ProductExtra[] = (extrasData || []).map(e => ({
                        id: e.id,
                        name: e.name,
                        price: e.price
                    }));

                    const mappedItems: MenuItem[] = (items || []).map(i => ({
                        id: i.id,
                        name: i.name,
                        description: i.description,
                        price: i.price,
                        category: i.category_id,
                        stock: i.stock,
                        image: i.image_url,
                        isCombo: i.is_combo,
                        mainProductId: i.main_product_id,
                        mainVariantId: i.main_variant_id,
                        comboItems: i.combo_items || [],
                        variations: (i.variations || []).map((v: any) => ({
                            id: v.id,
                            name: v.name,
                            price: v.price,
                            stock: v.stock,
                            image: v.image_url,
                            extras: v.extra_links ? v.extra_links.map((el: any) => el.extra).filter((e: any) => e !== null) : []
                        })),
                        extras: i.extra_links ? i.extra_links.map((el: any) => el.extra).filter((e: any) => e !== null) : []
                    }));

                    setMenuState(prev => ({
                        ...prev,
                        allCategories: { ...prev.allCategories, [activeBranchId]: mappedCats },
                        allMenuItems: { ...prev.allMenuItems, [activeBranchId]: mappedItems },
                        allExtras: { ...prev.allExtras, [activeBranchId]: mappedExtras },
                        lastUpdated: { ...((prev as any).lastUpdated || {}), [activeBranchId]: Date.now() }
                    }));
                }
            } catch (err) {
                console.error("Exception fetching menu:", err);
            } finally {
                setLoading(false);
            }
        };

        // Solo ejecutar fetch inicial si el caché no está fresco o si es Staff/Admin
        if (!isCacheFresh || currentUser) {
            fetchData();
        }

        // Lógica de refresco en segundo plano (cada 5 minutos)
        const refreshInterval = setInterval(() => {
            if (isMounted) fetchData(true);
        }, 5 * 60 * 1000);

        let isMounted = true;
        let channels: any[] = [];
        let fetchTimeout: any = null;
        let backoffActive = false;

        const debouncedFetchData = () => {
            if (!isMounted) return;
            if (fetchTimeout) clearTimeout(fetchTimeout);
            fetchTimeout = setTimeout(() => {
                if (isMounted) fetchData(true);
            }, 1000);
        };

        // PILLAR 2: Zero-Realtime for Guests
        // Solo activar suscripciones si hay un usuario logueado con rol de staff
        const isStaff = currentUser && (['Admin', 'SuperAdmin', 'Waiter', 'Cashier', 'Cook'].includes(currentUser?.role || ''));

        if (isStaff) {
            console.log(`🔌 MenuContext: Modo Staff/Admin - Activando Suscripción Única.`);
            
            const setupSubscriptions = () => {
                let retryCount = 0;
                const MAX_RETRIES = 2;

                // SUSCRIPCIÓN ÚNICA: Un solo canal para todos los cambios del menú
                const menuChannel = supabase.channel(`menu_updates_${activeBranchId}`)
                    .on('postgres_changes', { 
                        event: '*', schema: 'public', table: 'categories', filter: `branch_id=eq.${activeBranchId}` 
                    }, () => isMounted && debouncedFetchData())
                    .on('postgres_changes', { 
                        event: '*', schema: 'public', table: 'menu_items', filter: `branch_id=eq.${activeBranchId}` 
                    }, () => isMounted && debouncedFetchData())
                    .on('postgres_changes', { 
                        event: '*', schema: 'public', table: 'menu_item_variations' 
                    }, () => isMounted && debouncedFetchData())
                    .on('postgres_changes', { 
                        event: '*', schema: 'public', table: 'product_extras', filter: `branch_id=eq.${activeBranchId}` 
                    }, () => isMounted && debouncedFetchData())
                    .on('postgres_changes', { 
                        event: '*', schema: 'public', table: 'branches', filter: `id=eq.${activeBranchId}` 
                    }, () => isMounted && debouncedFetchData())
                    .subscribe((status: string) => {
                        if (status === 'CHANNEL_ERROR') {
                            if (retryCount < MAX_RETRIES) {
                                retryCount++;
                                console.warn(`⚠️ Menu Realtime Error. Retry ${retryCount}/${MAX_RETRIES} in 5s...`);
                                setTimeout(() => { if (isMounted) setupSubscriptions(); }, 5000);
                            } else {
                                console.error("🚨 Menu Realtime: Max retries reached. Using poll/background mode.");
                            }
                        } else if (status === 'SUBSCRIBED') {
                            retryCount = 0;
                        }
                    });

                channels = [menuChannel];
            };

            setupSubscriptions();
        } else {
            console.log(`🛡️ MenuContext: Modo Invitado/Cliente - Realtime deshabilitado.`);
        }

        return () => {
            isMounted = false;
            clearInterval(refreshInterval);
            if (fetchTimeout) clearTimeout(fetchTimeout);
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [activeBranchId, currentUser]);

    // Datos filtrados por sucursal activa
    const menuItems = useMemo(() => {
        return activeBranchId ? (menuState.allMenuItems[activeBranchId] || []) : [];
    }, [activeBranchId, menuState.allMenuItems]);

    const categories = useMemo(() => {
        return activeBranchId ? (menuState.allCategories[activeBranchId] || []) : [];
    }, [activeBranchId, menuState.allCategories]);

    const extras = useMemo(() => {
        return activeBranchId ? (menuState.allExtras[activeBranchId] || []) : [];
    }, [activeBranchId, menuState.allExtras]);

    // ===== FUNCIONES DE ITEMS =====

    const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
        if (!activeBranchId) return;

        // 1. Resolve restaurantId from the current branch if not available in user (SuperAdmin)
        // We look it up in the menuState's cached branches or expect it from the branch object
        // But the most reliable way is to let Supabase handles it if possible or fetch it.
        // Given our context structure, we can get it from activeBranch in RestaurantContext, 
        // but MenuContext doesn't have direct access to it easily without extra hooks.
        // However, MenuContext is inside RestaurantProvider in AppContext, so we can't use useRestaurant here.
        // Instead, we'll fetch the branch info once if we don't have it.
        
        let restaurantId = currentUser?.restaurantId;
        
        if (!restaurantId || restaurantId === 'null') {
            const { data: branchData } = await supabase
                .from('branches')
                .select('restaurant_id')
                .eq('id', activeBranchId)
                .single();
            if (branchData) restaurantId = branchData.restaurant_id;
        }

        // 2. Insert Item
        const { data: insertedItem, error } = await supabase
            .from('menu_items')
            .insert({
                branch_id: activeBranchId,
                restaurant_id: restaurantId,
                category_id: item.category,
                name: item.name,
                description: item.description,
                price: item.price,
                stock: item.stock ?? null,
                image_url: item.image,
                is_combo: !!item.isCombo,
                main_product_id: item.mainProductId || null,
                main_variant_id: item.mainVariantId || null,
                combo_items: item.comboItems || []
            })
            .select('id, name, category_id, price, stock, image_url')
            .single();

        if (error || !insertedItem) {
            console.error(error);
            return;
        }

        // 2. Insert Variations & Their Extras
        const realVariations = [];
        if (item.variations && item.variations.length > 0) {
            for (const v of item.variations) {
                const { data: insertedVar, error: varError } = await supabase.from('menu_item_variations').insert({
                    menu_item_id: insertedItem.id,
                    name: v.name,
                    price: v.price,
                    stock: v.stock ?? null,
                    image_url: v.image
                }).select().single();

                if (insertedVar) {
                    realVariations.push({
                        ...v,
                        id: insertedVar.id // <--- INYECTAMOS EL VERDADERO UUID DE SUPABASE!
                    });

                    if (v.extras && v.extras.length > 0) {
                        const varLinks = v.extras.map(e => ({
                            variation_id: insertedVar.id,
                            extra_id: e.id,
                            menu_item_id: insertedItem.id
                        }));
                        await supabase.from('menu_item_variation_extras_link').insert(varLinks);
                    }
                }
            }
        }

        // 3. Link Extras
        if (item.extras && item.extras.length > 0) {
            const links = item.extras.map(e => ({
                menu_item_id: insertedItem.id,
                extra_id: e.id
            }));
            await supabase.from('menu_item_extras_link').insert(links);
        }

        // OPTIMISTIC UPDATE: Add to local state immediately
        const newItem: MenuItem = {
            id: insertedItem.id,
            ...item,
            variations: item.variations && item.variations.length > 0 ? realVariations : item.variations
        } as MenuItem;

        setMenuState(prev => {
            const currentItems = prev.allMenuItems[activeBranchId] || [];
            return {
                ...prev,
                allMenuItems: {
                    ...prev.allMenuItems,
                    [activeBranchId]: [...currentItems, newItem]
                }
            };
        });
    };

    const updateMenuItem = async (item: MenuItem) => {
        if (!activeBranchId) return;

        // Update main item
        await supabase
            .from('menu_items')
            .update({
                name: item.name,
                description: item.description,
                price: item.price,
                stock: item.stock ?? null,
                category_id: item.category,
                image_url: item.image,
                is_combo: !!item.isCombo,
                main_product_id: item.mainProductId || null,
                main_variant_id: item.mainVariantId || null,
                combo_items: item.comboItems || []
            })
            .eq('id', item.id);

        // Update Variations
        const realVariations = [];
        if (item.variations) {
            for (const v of item.variations) {
                let variationId = v.id;
                if (v.id.length > 20) { // Assume UUID (Existing Variation)
                    await supabase
                        .from('menu_item_variations')
                        .update({ name: v.name, price: v.price, stock: v.stock ?? null, image_url: v.image })
                        .eq('id', v.id);
                    realVariations.push(v);
                } else { // New Variation (temp ID)
                    const { data: newVar } = await supabase.from('menu_item_variations').insert({
                        menu_item_id: item.id,
                        name: v.name,
                        price: v.price,
                        stock: v.stock ?? null,
                        image_url: v.image
                    }).select().single();
                    if (newVar) {
                        variationId = newVar.id;
                        realVariations.push({ ...v, id: newVar.id }); // <--- REAL UUID
                    }
                }

                // Update Variation Extras
                if (variationId && variationId.length > 20) {
                    // Delete old links
                    await supabase.from('menu_item_variation_extras_link').delete().eq('variation_id', variationId);

                    if (v.extras && v.extras.length > 0) {
                        const varLinks = v.extras.map(e => ({
                            variation_id: variationId,
                            extra_id: e.id
                        }));
                        await supabase.from('menu_item_variation_extras_link').insert(varLinks);
                    }
                }
            }
        }

        // Update Extras Links (Main Item)
        if (item.extras) {
            // Delete old links and insert new ones (simpler than diffing)
            await supabase.from('menu_item_extras_link').delete().eq('menu_item_id', item.id);
            const links = item.extras.map(e => ({
                menu_item_id: item.id,
                extra_id: e.id
            }));
            if (links.length > 0) {
                await supabase.from('menu_item_extras_link').insert(links);
            }
        }

        // OPTIMISTIC UPDATE: Update local state immediately
        const newItem = { ...item, variations: (item.variations && item.variations.length > 0) ? realVariations : item.variations };
        setMenuState(prev => {
            const currentItems = prev.allMenuItems[activeBranchId] || [];
            const updatedItems = currentItems.map(i => i.id === item.id ? newItem : i);
            return {
                ...prev,
                allMenuItems: {
                    ...prev.allMenuItems,
                    [activeBranchId]: updatedItems
                }
            };
        });
    };

    const deleteMenuItem = async (id: string, categoryId?: string) => {
        if (!activeBranchId) return;

        // Optimistic Update
        setMenuState(prev => {
            const currentItems = prev.allMenuItems[activeBranchId] || [];
            return {
                ...prev,
                allMenuItems: {
                    ...prev.allMenuItems,
                    [activeBranchId]: currentItems.filter(i => i.id !== id)
                }
            };
        });

        await supabase.from('menu_items').delete().eq('id', id);
    };

    // ===== FUNCIONES DE CATEGORÍAS =====

    const addCategory = async (cat: Omit<Category, 'id'>) => {
        if (!activeBranchId) return;

        let restaurantId = currentUser?.restaurantId;
        if (!restaurantId || restaurantId === 'null') {
            const { data: branchData } = await supabase.from('branches').select('restaurant_id').eq('id', activeBranchId).single();
            if (branchData) restaurantId = branchData.restaurant_id;
        }

        await supabase.from('categories').insert({
            branch_id: activeBranchId,
            restaurant_id: restaurantId,
            name: cat.name,
            icon_type: cat.iconType,
            icon_value: cat.iconValue
        }).select('id, name, icon_type, icon_value').single();
    };

    const updateCategory = async (cat: Category) => {
        if (!activeBranchId) return;
        await supabase.from('categories').update({
            name: cat.name,
            icon_type: cat.iconType,
            icon_value: cat.iconValue
        }).eq('id', cat.id);
    };

    const deleteCategory = async (id: string) => {
        if (!activeBranchId) return;
        await supabase.from('categories').delete().eq('id', id);
    };

    // ===== FUNCIONES DE EXTRAS =====

    const addProductExtra = async (extra: Omit<ProductExtra, 'id'>) => {
        if (!activeBranchId) return;

        let restaurantId = currentUser?.restaurantId;
        if (!restaurantId || restaurantId === 'null') {
            const { data: branchData } = await supabase.from('branches').select('restaurant_id').eq('id', activeBranchId).single();
            if (branchData) restaurantId = branchData.restaurant_id;
        }

        await supabase.from('product_extras').insert({
            branch_id: activeBranchId,
            restaurant_id: restaurantId,
            name: extra.name,
            price: extra.price
        }).select('id, name, price').single();

        if (activeBranchId) {
            const newExtra: ProductExtra = { id: Date.now().toString(), ...extra } as any; // Temp ID
            setMenuState(prev => {
                const current = prev.allExtras[activeBranchId] || [];
                return { ...prev, allExtras: { ...prev.allExtras, [activeBranchId]: [...current, newExtra] } };
            });
        }
    };

    const updateProductExtra = async (extra: ProductExtra) => {
        if (!activeBranchId) return;
        await supabase.from('product_extras').update({
            name: extra.name,
            price: extra.price
        }).eq('id', extra.id);

        // Optimistic
        setMenuState(prev => {
            const current = prev.allExtras[activeBranchId] || [];
            return { ...prev, allExtras: { ...prev.allExtras, [activeBranchId]: current.map(e => e.id === extra.id ? extra : e) } };
        });
    };

    const deleteProductExtra = async (id: string) => {
        if (!activeBranchId) return;
        await supabase.from('product_extras').delete().eq('id', id);
    };

    // ===== FUNCIÓN INTERNA PARA ORDERCONTEXT =====

    const updateMenuItemStock = (branchId: string, items: MenuItem[]) => {
        setMenuState(prev => ({
            ...prev,
            allMenuItems: {
                ...prev.allMenuItems,
                [branchId]: items
            }
        }));
    };

    const value = useMemo(() => ({
        menuItems,
        allMenuItems: menuState.allMenuItems,
        addMenuItem: addMenuItem as any,
        updateMenuItem: updateMenuItem as any,
        deleteMenuItem: deleteMenuItem as any,
        categories,
        allCategories: menuState.allCategories,
        addCategory: addCategory as any,
        updateCategory: updateCategory as any,
        deleteCategory: deleteCategory as any,
        extras,
        allExtras: menuState.allExtras,
        addProductExtra: addProductExtra as any,
        updateProductExtra: updateProductExtra as any,
        deleteProductExtra: deleteProductExtra as any,
        branchSettings,
        loading,
        updateMenuItemStock
    }), [
        menuItems,
        menuState.allMenuItems,
        menuState.allCategories,
        menuState.allExtras,
        categories,
        extras,
        branchSettings,
        loading,
        activeBranchId
    ]);

    return (
        <MenuContext.Provider value={value}>
            {children}
        </MenuContext.Provider>
    );
};

export const useMenu = () => {
    const context = useContext(MenuContext);
    if (context === undefined) {
        throw new Error('useMenu must be used within a MenuProvider');
    }
    return context;
};
