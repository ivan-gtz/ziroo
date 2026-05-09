
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import {
    User, Branch, MenuItem, Order, Category, InventoryTransaction,
    ManagedRestaurant, SystemSettings, BranchSettings, PagerStatus, PagerLog,
    UserRole, OrderStatus, Language, Theme, PagerState,
    SuperAdmin
} from '../types';
import {
    INITIAL_USERS, INITIAL_BRANCHES, INITIAL_MENU_ITEMS, INITIAL_CATEGORIES,
    INITIAL_ORDERS, INITIAL_MANAGED_RESTAURANTS, SUPER_ADMIN_USER,
    MAIN_BRANCH_ID, MAIN_RESTAURANT_ID
} from '../constants';
import { translations } from '../lib/i18n';

interface AppState {
    users: User[];
    branches: Branch[];
    allMenuItems: Record<string, MenuItem[]>;
    allCategories: Record<string, Category[]>;
    allOrders: Record<string, Order[]>;
    managedRestaurants: ManagedRestaurant[];
    allSettings: Record<string, BranchSettings>;
    systemSettings: SystemSettings;
    superAdminCreds: { email: string, password_INSECURE: string };
    allInventoryTransactions: Record<string, InventoryTransaction[]>;
    pagerStatuses: Record<number, PagerStatus>;
    pagerLogs: PagerLog[];
    allDailyCounters: Record<string, number>;
}

const INITIAL_STATE: AppState = {
    users: INITIAL_USERS,
    branches: INITIAL_BRANCHES,
    allMenuItems: { [MAIN_BRANCH_ID]: INITIAL_MENU_ITEMS },
    allCategories: { [MAIN_BRANCH_ID]: INITIAL_CATEGORIES },
    allOrders: { [MAIN_BRANCH_ID]: INITIAL_ORDERS },
    managedRestaurants: INITIAL_MANAGED_RESTAURANTS,
    allSettings: {
        [MAIN_BRANCH_ID]: {
            restaurantName: 'Ziroo',
            currency: '$',
            socialLinks: {},
        }
    },
    systemSettings: {
        appWebsiteUrl: '',
        logoSidebar: '',
        logoLogin: '',
        logoAnimation: ''
    },
    superAdminCreds: {
        email: SUPER_ADMIN_USER.email,
        password_INSECURE: SUPER_ADMIN_USER.password_INSECURE
    },
    allInventoryTransactions: {},
    pagerStatuses: {},
    pagerLogs: [],
    allDailyCounters: { [MAIN_BRANCH_ID]: 3 }
};

interface AppContextProps {
    currentUser: User | SuperAdmin | null;
    login: (email: string, password: string) => { success: boolean; errorType?: string; lockoutTime?: number };
    logout: () => void;
    isShowingWelcome: boolean;
    setIsShowingWelcome: (show: boolean) => void;

    theme: Theme;
    setTheme: (theme: Theme) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: any) => string;

    activeBranchId: string | null;
    setActiveBranchId: (id: string) => void;
    activeBranch: Branch | undefined;

    users: User[];
    branches: Branch[];
    menuItems: MenuItem[];
    categories: Category[];
    orders: Order[];

    allMenuItems: Record<string, MenuItem[]>;
    allCategories: Record<string, Category[]>;
    allOrders: Record<string, Order[]>;
    allSettings: Record<string, BranchSettings>;
    allInventoryTransactions: Record<string, InventoryTransaction[]>;
    allDailyCounters: Record<string, number>;

    addUser: (user: Omit<User, 'id' | 'restaurantId' | 'branchId'>) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;

    addBranch: (name: string) => void;
    approveBranch: (branchId: string) => void;

    addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
    updateMenuItem: (item: MenuItem) => void;
    deleteMenuItem: (id: string) => void;

    addCategory: (cat: Omit<Category, 'id'>) => void;
    updateCategory: (cat: Category) => void;
    deleteCategory: (id: string) => void;

    addOrder: (order: Omit<Order, 'id' | 'timestamp' | 'dailyTicketNumber'>, branchId?: string) => { order: Order };
    updateOrderStatus: (id: string, status: OrderStatus, branchId?: string) => void;

    saveBranchSettings: (settings: Partial<BranchSettings>) => void;

    addInventoryStock: (itemId: string, variationId: string | undefined, quantity: number) => void;
    updateInventoryTransaction: (id: string, quantity: number) => void;

    managedRestaurants: ManagedRestaurant[];
    currentRestaurant: ManagedRestaurant | undefined;
    addManagedRestaurant: (r: Omit<ManagedRestaurant, 'id'>) => void;
    updateManagedRestaurant: (r: ManagedRestaurant) => void;
    deleteManagedRestaurant: (id: string) => void;

    systemSettings: SystemSettings;
    updateSystemSettings: (settings: Partial<SystemSettings>) => void;
    superAdminCreds: { email: string; password_INSECURE: string };
    updateSuperAdminCreds: (email: string, pass: string) => void;

    pagerStatuses: Record<number, PagerStatus>;
    pagerLogs: PagerLog[];
    updatePagerStatus: (id: number, state: PagerState) => void;
    resetAllPagers: () => void;

    formatCurrency: (amount: number) => string;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [appState, setAppState] = useLocalStorage<AppState>('ziroo_app_state_v2', INITIAL_STATE);
    const [currentUser, setCurrentUser] = useLocalStorage<User | SuperAdmin | null>('ziroo_current_user', null);
    const [language, setLanguage] = useLocalStorage<Language>('ziroo_language', Language.ES);

    const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>(Theme.Light);
    const [isShowingWelcome, setIsShowingWelcome] = useState(false);

    const setActiveBranchId = (id: string) => {
        setActiveBranchIdState(id);
    };

    const visibleBranches = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'SuperAdmin') {
            return appState.branches;
        }
        if ('restaurantId' in currentUser) {
            return appState.branches.filter(b => b.restaurantId === currentUser.restaurantId);
        }
        return [];
    }, [appState.branches, currentUser]);

    // Enhanced Auto-Select Logic: Don't auto-select unapproved branches for regular users
    useEffect(() => {
        if (currentUser && visibleBranches.length > 0) {
            const isValidBranch = visibleBranches.find(b => b.id === activeBranchId);

            if (!activeBranchId || !isValidBranch) {
                // Find first APPROVED branch
                const firstApproved = visibleBranches.find(b => b.isApproved);
                if (firstApproved) {
                    setActiveBranchId(firstApproved.id);
                } else if (currentUser.role === 'SuperAdmin' && visibleBranches.length > 0) {
                    // SuperAdmin can see unapproved
                    setActiveBranchId(visibleBranches[0].id);
                }
            }
        } else if (!currentUser) {
            setActiveBranchIdState(null);
        }
    }, [currentUser, visibleBranches, activeBranchId]);

    const activeBranch = visibleBranches.find(b => b.id === activeBranchId);

    const currentRestaurant = useMemo(() => {
        if (activeBranch && activeBranch.restaurantId) {
            return appState.managedRestaurants.find(r => r.id === activeBranch.restaurantId);
        }
        if (currentUser && 'restaurantId' in currentUser && currentUser.restaurantId) {
            return appState.managedRestaurants.find(r => r.id === currentUser.restaurantId);
        }
        return undefined;
    }, [activeBranch, appState.managedRestaurants, currentUser]);

    const branches = visibleBranches;

    // Strict Data Isolation: If no active branch, return empty arrays to prevent leaking
    const menuItems = activeBranchId ? (appState.allMenuItems[activeBranchId] || []) : [];
    const categories = activeBranchId ? (appState.allCategories[activeBranchId] || []) : [];
    const orders = activeBranchId ? (appState.allOrders[activeBranchId] || []) : [];
    const users = activeBranchId ? appState.users.filter(u => u.branchId === activeBranchId) : appState.users;

    const t = (key: string, params: any = {}) => {
        let text = translations[language][key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        return text;
    };

    const formatCurrency = (amount: number) => {
        const symbol = (activeBranchId && appState.allSettings[activeBranchId]?.currency) || '$';
        return `${symbol} ${amount.toFixed(2)}`;
    };

    const login = (email: string, password: string) => {
        if (email === appState.superAdminCreds.email && password === appState.superAdminCreds.password_INSECURE) {
            setCurrentUser(SUPER_ADMIN_USER);
            setIsShowingWelcome(true);
            return { success: true };
        }

        const user = appState.users.find(u => u.email === email && u.password_INSECURE === password);
        if (user) {
            // 1. Check Restaurant Expiry
            const restaurant = appState.managedRestaurants.find(r => r.id === user.restaurantId);
            if (restaurant) {
                const now = new Date();
                const end = new Date(restaurant.endDate);
                if (now > end) {
                    return { success: false, errorType: 'lockout' };
                }
            }

            // 2. Check Branch Approval (SECURITY FIX)
            // Even if user exists, if their branch is not approved, DENY LOGIN
            const userBranch = appState.branches.find(b => b.id === user.branchId);
            if (userBranch && !userBranch.isApproved) {
                // If user is Admin of that restaurant, maybe allow? 
                // Requirement says: "si la sucursal no esta aprobada, ningún trabajador... tiene que poder ingresar"
                // This includes the restaurant admin for that branch.
                return { success: false, errorType: 'branch_not_approved' };
            }

            setCurrentUser(user);
            setIsShowingWelcome(true);

            // Auto-set their branch
            setActiveBranchId(user.branchId);

            return { success: true };
        }

        return { success: false };
    };

    const logout = () => {
        setCurrentUser(null);
        setActiveBranchIdState(null);
    };

    const addUser = (userData: Omit<User, 'id' | 'restaurantId' | 'branchId'>) => {
        if (!activeBranchId) return;
        const newUser: User = {
            ...userData,
            id: Date.now().toString(),
            branchId: activeBranchId,
            restaurantId: activeBranch?.restaurantId
        };
        setAppState(prev => ({ ...prev, users: [...prev.users, newUser] }));
    };

    const updateUser = (user: User) => {
        setAppState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === user.id ? user : u)
        }));
    };

    const deleteUser = (id: string) => {
        setAppState(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== id)
        }));
    };

    const addBranch = (name: string) => {
        const restaurantId = currentUser && 'restaurantId' in currentUser ? currentUser.restaurantId : MAIN_RESTAURANT_ID;
        const newBranchId = Date.now().toString();

        const newBranch: Branch = {
            id: newBranchId,
            name,
            restaurantId,
            isApproved: currentUser?.role === 'SuperAdmin'
        };

        setAppState(prev => ({
            ...prev,
            branches: [...prev.branches, newBranch],
            allMenuItems: { ...prev.allMenuItems, [newBranchId]: [] },
            allCategories: { ...prev.allCategories, [newBranchId]: INITIAL_CATEGORIES },
            allOrders: { ...prev.allOrders, [newBranchId]: [] },
            allSettings: {
                ...prev.allSettings,
                [newBranchId]: {
                    restaurantName: name,
                    currency: '$',
                    socialLinks: {},
                    enableTaxInvoice: true,
                }
            },
            allDailyCounters: { ...prev.allDailyCounters, [newBranchId]: 0 },
            allInventoryTransactions: { ...prev.allInventoryTransactions, [newBranchId]: [] }
        }));
    };

    const approveBranch = (branchId: string) => {
        setAppState(prev => ({
            ...prev,
            branches: prev.branches.map(b => b.id === branchId ? { ...b, isApproved: true } : b)
        }));
    };

    const addMenuItem = (item: Omit<MenuItem, 'id'>) => {
        if (!activeBranchId) return;
        const newItem: MenuItem = { ...item, id: Date.now().toString() };
        setAppState(prev => ({
            ...prev,
            allMenuItems: {
                ...prev.allMenuItems,
                [activeBranchId]: [...(prev.allMenuItems[activeBranchId] || []), newItem]
            }
        }));
    };

    const updateMenuItem = (item: MenuItem) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allMenuItems: {
                ...prev.allMenuItems,
                [activeBranchId]: (prev.allMenuItems[activeBranchId] || []).map(i => i.id === item.id ? item : i)
            }
        }));
    };

    const deleteMenuItem = (id: string) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allMenuItems: {
                ...prev.allMenuItems,
                [activeBranchId]: (prev.allMenuItems[activeBranchId] || []).filter(i => i.id !== id)
            }
        }));
    };

    const addCategory = (cat: Omit<Category, 'id'>) => {
        if (!activeBranchId) return;
        const newCat: Category = { ...cat, id: Date.now().toString() };
        setAppState(prev => ({
            ...prev,
            allCategories: {
                ...prev.allCategories,
                [activeBranchId]: [...(prev.allCategories[activeBranchId] || []), newCat]
            }
        }));
    };

    const updateCategory = (cat: Category) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allCategories: {
                ...prev.allCategories,
                [activeBranchId]: (prev.allCategories[activeBranchId] || []).map(c => c.id === cat.id ? cat : c)
            }
        }));
    };

    const deleteCategory = (id: string) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allCategories: {
                ...prev.allCategories,
                [activeBranchId]: (prev.allCategories[activeBranchId] || []).filter(c => c.id !== id)
            }
        }));
    };

    const addOrder = (orderData: Omit<Order, 'id' | 'timestamp' | 'dailyTicketNumber'>, targetBranchId?: string) => {
        const branch = targetBranchId || activeBranchId;
        if (!branch) throw new Error("No branch selected");

        const now = new Date();
        const dateKey = now.toLocaleDateString();

        let nextTicket = (appState.allDailyCounters[branch] || 0) + 1;

        const branchOrders = appState.allOrders[branch] || [];
        if (branchOrders.length > 0) {
            const lastOrder = branchOrders[branchOrders.length - 1];
            const lastDate = new Date(lastOrder.timestamp).toLocaleDateString();
            if (lastDate !== dateKey) {
                nextTicket = 1;
            }
        }

        const newOrder: Order = {
            ...orderData,
            id: Date.now().toString(),
            timestamp: now,
            dailyTicketNumber: nextTicket
        };

        setAppState(prev => {
            const currentMenuItems = prev.allMenuItems[branch] || [];

            // ✅ VALIDACIÓN: Verificar stock suficiente antes de crear la orden
            const insufficientStock: string[] = [];
            newOrder.items.forEach(orderItem => {
                const menuItem = currentMenuItems.find((m: MenuItem) => m.id === orderItem.menuItem.id);
                if (menuItem) {
                    if (orderItem.variation) {
                        const variation = menuItem.variations?.find((v: any) => v.id === orderItem.variation?.id);
                        if (variation && variation.stock !== undefined) {
                            const currentStock = variation.stock ?? 0;
                            if (currentStock < orderItem.quantity) {
                                insufficientStock.push(`${menuItem.name} (${variation.name}): stock ${currentStock}, necesario ${orderItem.quantity}`);
                            }
                        }
                    } else if (menuItem.stock !== undefined) {
                        const currentStock = menuItem.stock ?? 0;
                        if (currentStock < orderItem.quantity) {
                            insufficientStock.push(`${menuItem.name}: stock ${currentStock}, necesario ${orderItem.quantity}`);
                        }
                    }
                }
            });

            // Si hay stock insuficiente, mostrar advertencia en consola pero permitir la orden
            // (para no romper el flujo existente, solo advertir)
            if (insufficientStock.length > 0) {
                console.warn('⚠️ Advertencia: Stock insuficiente para algunos items:', insufficientStock);
            }

            const newMenuItems = JSON.parse(JSON.stringify(currentMenuItems));

            // Descuento de inventario
            newOrder.items.forEach(orderItem => {
                const menuItemIndex = newMenuItems.findIndex((m: MenuItem) => m.id === orderItem.menuItem.id);
                if (menuItemIndex > -1) {
                    const menuItem = newMenuItems[menuItemIndex];
                    if (orderItem.variation) {
                        const varIndex = menuItem.variations?.findIndex((v: any) => v.id === orderItem.variation?.id);
                        if (varIndex !== undefined && varIndex > -1 && menuItem.variations && menuItem.variations[varIndex].stock !== undefined) {
                            menuItem.variations[varIndex].stock = Math.max(0, menuItem.variations[varIndex].stock! - orderItem.quantity);
                        }
                    } else if (menuItem.stock !== undefined) {
                        menuItem.stock = Math.max(0, menuItem.stock - orderItem.quantity);
                    }
                }
            });

            return {
                ...prev,
                allOrders: {
                    ...prev.allOrders,
                    [branch]: [...(prev.allOrders[branch] || []), newOrder]
                },
                allDailyCounters: {
                    ...prev.allDailyCounters,
                    [branch]: nextTicket
                },
                allMenuItems: {
                    ...prev.allMenuItems,
                    [branch]: newMenuItems
                }
            };
        });

        return { order: newOrder };
    };

    const updateOrderStatus = (id: string, status: OrderStatus, branchId?: string) => {
        const branch = branchId || activeBranchId;
        if (!branch) return;

        setAppState(prev => {
            const branchOrders = prev.allOrders[branch] || [];
            const currentMenuItems = prev.allMenuItems[branch] || [];
            let newMenuItems = currentMenuItems;

            const updatedOrders = branchOrders.map(o => {
                if (o.id === id) {
                    const updates: Partial<Order> = { status };

                    // ✅ CORRECCIÓN CRÍTICA: Restaurar inventario cuando se cancela una orden
                    if (status === OrderStatus.Cancelled && o.status !== OrderStatus.Cancelled) {
                        console.log(`🔄 Restaurando inventario para orden #${o.dailyTicketNumber} (${o.items.length} items)`);

                        // Crear copia profunda del inventario para modificar
                        newMenuItems = JSON.parse(JSON.stringify(currentMenuItems));

                        // Restaurar stock de cada item de la orden
                        o.items.forEach(orderItem => {
                            const menuItemIndex = newMenuItems.findIndex((m: MenuItem) => m.id === orderItem.menuItem.id);
                            if (menuItemIndex > -1) {
                                const menuItem = newMenuItems[menuItemIndex];

                                if (orderItem.variation) {
                                    // Restaurar stock de variación
                                    const varIndex = menuItem.variations?.findIndex((v: any) => v.id === orderItem.variation?.id);
                                    if (varIndex !== undefined && varIndex > -1 && menuItem.variations) {
                                        const currentStock = menuItem.variations[varIndex].stock ?? 0;
                                        menuItem.variations[varIndex].stock = currentStock + orderItem.quantity;
                                        console.log(`  ✅ Restaurado: ${menuItem.name} (${menuItem.variations[varIndex].name}) +${orderItem.quantity} = ${menuItem.variations[varIndex].stock}`);
                                    }
                                } else if (menuItem.stock !== undefined) {
                                    // Restaurar stock de item simple
                                    const currentStock = menuItem.stock ?? 0;
                                    menuItem.stock = currentStock + orderItem.quantity;
                                    console.log(`  ✅ Restaurado: ${menuItem.name} +${orderItem.quantity} = ${menuItem.stock}`);
                                }
                            }
                        });
                    }

                    // Lógica existente para otros estados
                    if (status === OrderStatus.Ready) updates.readyTime = new Date();
                    if (status === OrderStatus.Delivered) {
                        const completionTime = o.readyTime
                            ? (new Date().getTime() - new Date(o.timestamp).getTime()) / 60000
                            : undefined;
                        updates.completionTime = completionTime;
                    }
                    return { ...o, ...updates };
                }
                return o;
            });

            return {
                ...prev,
                allOrders: {
                    ...prev.allOrders,
                    [branch]: updatedOrders
                },
                allMenuItems: {
                    ...prev.allMenuItems,
                    [branch]: newMenuItems
                }
            };
        });
    };

    const saveBranchSettings = (settings: Partial<BranchSettings>) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allSettings: {
                ...prev.allSettings,
                [activeBranchId]: { ...prev.allSettings[activeBranchId], ...settings }
            }
        }));
    };

    const addInventoryStock = (itemId: string, variationId: string | undefined, quantity: number) => {
        if (!activeBranchId || !currentUser) return;

        setAppState(prev => {
            const branchMenuItems = prev.allMenuItems[activeBranchId] || [];
            const newMenuItems = JSON.parse(JSON.stringify(branchMenuItems));

            const itemIndex = newMenuItems.findIndex((item: MenuItem) => item.id === itemId);
            if (itemIndex === -1) return prev;

            const menuItem = newMenuItems[itemIndex];
            let itemName = menuItem.name;

            if (variationId) {
                const variationIndex = menuItem.variations?.findIndex((v: any) => v.id === variationId);
                if (variationIndex !== undefined && variationIndex > -1 && menuItem.variations) {
                    const variation = menuItem.variations[variationIndex];
                    variation.stock = (variation.stock ?? 0) + quantity;
                    itemName = `${menuItem.name} (${variation.name})`;
                }
            } else {
                menuItem.stock = (menuItem.stock ?? 0) + quantity;
            }

            const newTransaction: InventoryTransaction = {
                id: Date.now().toString(),
                branchId: activeBranchId,
                menuItemId: itemId,
                variationId,
                itemName,
                quantity,
                timestamp: new Date(),
                userId: currentUser.id,
                userName: currentUser.name
            };

            return {
                ...prev,
                allMenuItems: { ...prev.allMenuItems, [activeBranchId]: newMenuItems },
                allInventoryTransactions: {
                    ...prev.allInventoryTransactions,
                    [activeBranchId]: [newTransaction, ...(prev.allInventoryTransactions[activeBranchId] || [])]
                }
            };
        });
    };

    const updateInventoryTransaction = (id: string, quantity: number) => {
        if (!activeBranchId) return;
        setAppState(prev => ({
            ...prev,
            allInventoryTransactions: {
                ...prev.allInventoryTransactions,
                [activeBranchId]: (prev.allInventoryTransactions[activeBranchId] || []).map(tx => tx.id === id ? { ...tx, quantity } : tx)
            }
        }));
    };

    const addManagedRestaurant = (r: Omit<ManagedRestaurant, 'id'>) => {
        const restaurantId = Date.now().toString();
        const branchId = (Date.now() + 1).toString();
        const adminUserId = (Date.now() + 2).toString();

        const newRestaurant: ManagedRestaurant = { ...r, id: restaurantId };

        const mainBranch: Branch = {
            id: branchId,
            restaurantId: restaurantId,
            name: `${r.name} (Sede Principal)`,
            isApproved: true
        };

        const adminUser: User = {
            id: adminUserId,
            restaurantId: restaurantId,
            branchId: branchId,
            name: `Admin ${r.name}`,
            email: r.adminEmail,
            password_INSECURE: r.adminPassword_INSECURE,
            role: UserRole.Admin,
            phone: ''
        };

        setAppState(prev => ({
            ...prev,
            managedRestaurants: [...prev.managedRestaurants, newRestaurant],
            branches: [...prev.branches, mainBranch],
            users: [...prev.users, adminUser],
            allMenuItems: { ...prev.allMenuItems, [branchId]: [] },
            allCategories: { ...prev.allCategories, [branchId]: INITIAL_CATEGORIES },
            allOrders: { ...prev.allOrders, [branchId]: [] },
            allSettings: {
                ...prev.allSettings,
                [branchId]: {
                    restaurantName: r.name,
                    currency: '$',
                    socialLinks: {},
                    enableTaxInvoice: true,
                }
            },
            allDailyCounters: { ...prev.allDailyCounters, [branchId]: 0 },
            allInventoryTransactions: { ...prev.allInventoryTransactions, [branchId]: [] }
        }));
    };

    const updateManagedRestaurant = (r: ManagedRestaurant) => {
        setAppState(prev => ({
            ...prev,
            managedRestaurants: prev.managedRestaurants.map(rest => rest.id === r.id ? r : rest)
        }));
    };

    const deleteManagedRestaurant = (id: string) => {
        setAppState(prev => ({
            ...prev,
            managedRestaurants: prev.managedRestaurants.filter(r => r.id !== id),
        }));
    };

    const updateSystemSettings = (settings: Partial<SystemSettings>) => {
        setAppState(prev => ({
            ...prev,
            systemSettings: { ...prev.systemSettings, ...settings }
        }));
    };

    const updateSuperAdminCreds = (email: string, password_INSECURE: string) => {
        setAppState(prev => ({
            ...prev,
            superAdminCreds: { email, password_INSECURE }
        }));
    };

    const updatePagerStatus = (id: number, state: PagerState) => {
        setAppState(prev => {
            const now = new Date();
            const prevStatus = prev.pagerStatuses[id];

            let newLog: PagerLog | null = null;
            let nextTimestamp = now;
            let nextElapsed: number | undefined = undefined;

            if (prevStatus) {
                // Logic for STOPPING timer on Ready (Freeze timer)
                if (prevStatus.state === 'preparing' && state === 'ready') {
                    const startTime = new Date(prevStatus.timestamp);
                    nextElapsed = (now.getTime() - startTime.getTime()) / 1000;
                    nextTimestamp = prevStatus.timestamp; // Keep original start time
                }
                // Logic for LOGGING on Inactive (Reset)
                else if (state === 'inactive') {
                    if (prevStatus.state === 'ready' && prevStatus.elapsed) {
                        // Completed cycle with frozen prep time
                        newLog = {
                            id: Date.now().toString(),
                            pagerId: id,
                            completionTime: now,
                            durationSeconds: prevStatus.elapsed
                        };
                    } else if (prevStatus.state !== 'inactive') {
                        // Cancelled/Reset during prep
                        const startTime = new Date(prevStatus.timestamp);
                        newLog = {
                            id: Date.now().toString(),
                            pagerId: id,
                            completionTime: now,
                            durationSeconds: (now.getTime() - startTime.getTime()) / 1000
                        };
                    }
                }
            }

            return {
                ...prev,
                pagerStatuses: {
                    ...prev.pagerStatuses,
                    [id]: {
                        id,
                        state,
                        timestamp: nextTimestamp,
                        elapsed: nextElapsed
                    }
                },
                pagerLogs: newLog ? [...prev.pagerLogs, newLog] : prev.pagerLogs
            };
        });
    };

    const resetAllPagers = () => {
        setAppState(prev => ({ ...prev, pagerStatuses: {} }));
    };

    const value: AppContextProps = {
        currentUser, login, logout, isShowingWelcome, setIsShowingWelcome,
        theme, setTheme, language, setLanguage, t,
        activeBranchId, setActiveBranchId, activeBranch,
        users, branches, menuItems, categories, orders,
        allMenuItems: appState.allMenuItems,
        allCategories: appState.allCategories,
        allOrders: appState.allOrders,
        allSettings: appState.allSettings,
        allInventoryTransactions: appState.allInventoryTransactions,
        allDailyCounters: appState.allDailyCounters,
        addUser, updateUser, deleteUser,
        addBranch, approveBranch,
        addMenuItem, updateMenuItem, deleteMenuItem,
        addCategory, updateCategory, deleteCategory,
        addOrder, updateOrderStatus,
        saveBranchSettings,
        addInventoryStock, updateInventoryTransaction,
        managedRestaurants: appState.managedRestaurants,
        currentRestaurant,
        addManagedRestaurant, updateManagedRestaurant, deleteManagedRestaurant,
        systemSettings: appState.systemSettings, updateSystemSettings,
        superAdminCreds: appState.superAdminCreds, updateSuperAdminCreds,
        pagerStatuses: appState.pagerStatuses, pagerLogs: appState.pagerLogs,
        updatePagerStatus, resetAllPagers,
        formatCurrency
    };

    return (
        <AppContext.Provider value={value}>
            <div className={theme}>
                {children}
            </div>
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
