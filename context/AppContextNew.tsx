
import React, { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { RestaurantProvider, useRestaurant } from './RestaurantContext';
import { MenuProvider, useMenu } from './MenuContext';
import { OrderProvider, useOrder } from './OrderContext';
import { UserProvider, useUser } from './UserContext';
import { SettingsProvider, useSettings } from './SettingsContext';
import { PagerProvider, usePager } from './PagerContext';

/**
 * 🏗️ NUEVO APPCONTEXT MODULAR
 * 
 * Este archivo reemplaza el antiguo AppContext.tsx monolítico (733 líneas)
 * con una arquitectura modular que separa las responsabilidades:
 * 
 * 1. AuthContext - Autenticación y usuario actual
 * 2. RestaurantContext - Restaurantes y sucursales
 * 3. MenuContext - Items del menú y categorías
 * 4. OrderContext - Órdenes e inventario
 * 5. UserContext - Gestión de usuarios
 * 6. SettingsContext - Configuración
 * 7. PagerContext - Sistema de buscapersonas
 * 
 * BENEFICIOS:
 * ✅ Cada contexto es independiente
 * ✅ Cambios en un contexto no afectan otros
 * ✅ Más fácil de mantener y testear
 * ✅ Código más organizado y legible
 */

// Componente interno que conecta todos los contextos
const AppContextIntegrator: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Obtener datos de RestaurantContext
    const restaurant = useRestaurant();
    const auth = useAuth();

    return (
        <UserProvider
            activeBranchId={restaurant.activeBranchId}
            activeBranch={restaurant.activeBranch}
        >
            <MenuProvider activeBranchId={restaurant.activeBranchId}>
                <MenuIntegrator>
                    <SettingsProvider activeBranchId={restaurant.activeBranchId}>
                        <PagerProvider>
                            {children}
                        </PagerProvider>
                    </SettingsProvider>
                </MenuIntegrator>
            </MenuProvider>
        </UserProvider>
    );
};

// Componente que integra Menu con Order (necesitan comunicarse)
const MenuIntegrator: React.FC<{ children: ReactNode }> = ({ children }) => {
    const menu = useMenu();
    const auth = useAuth();
    const restaurant = useRestaurant();

    return (
        <OrderProvider
            activeBranchId={restaurant.activeBranchId}
            currentUser={auth.currentUser}
            allMenuItems={menu.allMenuItems}
            updateMenuItemStock={menu.updateMenuItemStock}
        >
            {children}
        </OrderProvider>
    );
};

// Provider principal que anida todos los contextos
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <RestaurantProvider
            currentUser={null} // Se actualizará después del login
            onUserCreated={(user) => {
                // Callback para cuando se crea un nuevo usuario desde RestaurantContext
                console.log('Nuevo usuario creado:', user);
            }}
        >
            <RestaurantIntegrator>
                {children}
            </RestaurantIntegrator>
        </RestaurantProvider>
    );
};

// Componente que integra Restaurant con Auth
const RestaurantIntegrator: React.FC<{ children: ReactNode }> = ({ children }) => {
    const restaurant = useRestaurant();

    return (
        <AuthProvider superAdminCreds={restaurant.superAdminCreds}>
            <AppContextIntegrator>
                {children}
            </AppContextIntegrator>
        </AuthProvider>
    );
};

/**
 * 🎯 HOOK PRINCIPAL PARA USAR EN COMPONENTES
 * 
 * Este hook combina todos los contextos en uno solo para facilitar el uso.
 * Los componentes pueden seguir usando `useAppContext()` como antes.
 */
export const useAppContext = () => {
    const auth = useAuth();
    const restaurant = useRestaurant();
    const menu = useMenu();
    const order = useOrder();
    const user = useUser();
    const settings = useSettings();
    const pager = usePager();

    return {
        // Auth
        currentUser: auth.currentUser,
        login: (email: string, password: string) => {
            return auth.login(
                email,
                password,
                user.allUsers,
                restaurant.managedRestaurants,
                restaurant.branches
            );
        },
        logout: auth.logout,
        isShowingWelcome: auth.isShowingWelcome,
        setIsShowingWelcome: auth.setIsShowingWelcome,
        theme: auth.theme,
        setTheme: auth.setTheme,
        language: auth.language,
        setLanguage: auth.setLanguage,
        t: auth.t,

        // Restaurant
        branches: restaurant.branches,
        activeBranchId: restaurant.activeBranchId,
        setActiveBranchId: restaurant.setActiveBranchId,
        activeBranch: restaurant.activeBranch,
        addBranch: restaurant.addBranch,
        approveBranch: restaurant.approveBranch,
        managedRestaurants: restaurant.managedRestaurants,
        currentRestaurant: restaurant.currentRestaurant,
        addManagedRestaurant: restaurant.addManagedRestaurant,
        updateManagedRestaurant: restaurant.updateManagedRestaurant,
        deleteManagedRestaurant: restaurant.deleteManagedRestaurant,
        systemSettings: restaurant.systemSettings,
        updateSystemSettings: restaurant.updateSystemSettings,
        superAdminCreds: restaurant.superAdminCreds,
        updateSuperAdminCreds: restaurant.updateSuperAdminCreds,

        // Menu
        menuItems: menu.menuItems,
        allMenuItems: menu.allMenuItems,
        addMenuItem: menu.addMenuItem,
        updateMenuItem: menu.updateMenuItem,
        deleteMenuItem: menu.deleteMenuItem,
        categories: menu.categories,
        allCategories: menu.allCategories,
        addCategory: menu.addCategory,
        updateCategory: menu.updateCategory,
        deleteCategory: menu.deleteCategory,

        // Order
        orders: order.orders,
        allOrders: order.allOrders,
        addOrder: order.addOrder,
        updateOrderStatus: order.updateOrderStatus,
        allInventoryTransactions: order.allInventoryTransactions,
        addInventoryStock: order.addInventoryStock,
        updateInventoryTransaction: order.updateInventoryTransaction,
        allDailyCounters: order.allDailyCounters,

        // User
        users: user.users,
        addUser: user.addUser,
        updateUser: user.updateUser,
        deleteUser: user.deleteUser,

        // Settings
        allSettings: settings.allSettings,
        saveBranchSettings: settings.saveBranchSettings,
        formatCurrency: settings.formatCurrency,

        // Pager
        pagerStatuses: pager.pagerStatuses,
        pagerLogs: pager.pagerLogs,
        updatePagerStatus: pager.updatePagerStatus,
        resetAllPagers: pager.resetAllPagers
    };
};

/**
 * 📝 NOTAS DE MIGRACIÓN:
 * 
 * 1. Este archivo mantiene la misma interfaz que el AppContext.tsx original
 * 2. Los componentes NO necesitan cambiar su código
 * 3. Siguen usando `useAppContext()` como antes
 * 4. La diferencia está en la implementación interna (modular vs monolítica)
 * 
 * VENTAJAS:
 * - Cada contexto tiene su propio archivo
 * - Cada contexto gestiona su propio estado en LocalStorage
 * - Los cambios en un contexto no afectan otros
 * - Más fácil de debuggear y mantener
 * - Mejor separación de responsabilidades
 */
