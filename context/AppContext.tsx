
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
2. RestaurantContext - Restaurantes y sucursales
3. MenuContext - Items del menú y categorías
4. OrderContext - Órdenes e inventario
5. UserContext - Gestión de usuarios
6. SettingsContext - Configuración
7. PagerContext - Sistema de buscapersonas
 * 
 * BENEFICIOS:
 * ✅ Cada contexto es independiente
 * ✅ Cambios en un contexto no afectan otros
 * ✅ Más fácil de mantener y testear
 * ✅ Código más organizado y legible
 */

// Componente que integra Menu con Order (necesitan comunicarse)
const MenuIntegrator: React.FC<{ children: ReactNode }> = ({ children }) => {
    const menu = useMenu();
    const auth = useAuth();
    const restaurant = useRestaurant();

    return (
        <OrderProvider
            activeBranchId={restaurant.activeBranchId}
            allMenuItems={menu.allMenuItems}
            updateMenuItemStock={menu.updateMenuItemStock}
        >
            {children}
        </OrderProvider>
    );
};

// Componente interno que conecta todos los contextos y maneja creación de usuarios
const AppContextIntegratorWithUser: React.FC<{ children: ReactNode; userToCreate: any }> = ({ children, userToCreate }) => {
    const restaurant = useRestaurant();
    const auth = useAuth();

    return (
        <UserProvider
            activeBranchId={restaurant.activeBranchId}
            activeBranch={restaurant.activeBranch}
            userToCreate={userToCreate}
        >
            <MenuProvider
                activeBranchId={restaurant.activeBranchId}
            >
                <MenuIntegrator>
                    <SettingsProvider
                        activeBranchId={restaurant.activeBranchId}
                        activeBranch={restaurant.activeBranch}
                    >
                        <PagerProvider>
                            {children}
                        </PagerProvider>
                    </SettingsProvider>
                </MenuIntegrator>
            </MenuProvider>
        </UserProvider>
    );
};

// Wrapper para manejar la creación de usuarios
const RestaurantProviderWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [userToCreate, setUserToCreate] = React.useState<any>(null);

    return (
        <AuthProvider>
            <RestaurantProviderWithAuth userToCreate={userToCreate} setUserToCreate={setUserToCreate}>
                {children}
            </RestaurantProviderWithAuth>
        </AuthProvider>
    );
};

// Componente que conecta Auth con Restaurant
const RestaurantProviderWithAuth: React.FC<{
    children: ReactNode;
    userToCreate: any;
    setUserToCreate: (user: any) => void;
}> = ({ children, userToCreate, setUserToCreate }) => {
    const auth = useAuth();

    return (
        <RestaurantProvider
            onUserCreated={(user) => {
                console.log('✅ Nuevo usuario creado:', user);
                setUserToCreate(user);
            }}
        >
            <AppContextIntegratorWithUser userToCreate={userToCreate}>
                {children}
            </AppContextIntegratorWithUser>
        </RestaurantProvider>
    );
};

// Provider principal que anida todos los contextos
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <RestaurantProviderWrapper>
            {children}
        </RestaurantProviderWrapper>
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
        updateCurrentUser: auth.updateCurrentUser,
        loading: auth.loading,

        // Restaurant
        branches: restaurant.branches,
        activeBranchId: restaurant.activeBranchId,
        setActiveBranchId: restaurant.setActiveBranchId,
        activeBranch: restaurant.activeBranch,
        addBranch: restaurant.addBranch,
        approveBranch: restaurant.approveBranch,
        deleteBranch: restaurant.deleteBranch,
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
        branchSettings: settings.allSettings,
        menuLoading: menu.loading,
        settingsLoading: settings.loading,

        // Extras (Menu)
        extras: menu.extras,
        allExtras: menu.allExtras,
        addProductExtra: menu.addProductExtra,
        updateProductExtra: menu.updateProductExtra,
        deleteProductExtra: menu.deleteProductExtra,

        // Order
        orders: order.orders,
        allOrders: order.allOrders,
        addOrder: order.addOrder,
        updateOrderStatus: order.updateOrderStatus,
        shareOrderWithDrivers: order.shareOrderWithDrivers,
        fetchOrders: order.fetchOrders,
        fetchAllSystemOrders: order.fetchAllSystemOrders,
        fetchAllGlobalSummaries: order.fetchAllGlobalSummaries,
        allInventoryTransactions: order.allInventoryTransactions,
        fetchAllInventoryTransactions: order.fetchAllInventoryTransactions,
        addInventoryStock: order.addInventoryStock,
        setInventoryStock: order.setInventoryStock,
        updateInventoryTransaction: order.updateInventoryTransaction,
        allDailyCounters: order.allDailyCounters,
        activeCashRegister: order.activeCashRegister,
        openCashRegister: order.openCashRegister,
        closeCashRegister: order.closeCashRegister,
        allCashRegisters: order.allCashRegisters,
        loadingRegisters: order.loadingRegisters,
        cleanupOldReceipts: order.cleanupOldReceipts,
        expenses: order.expenses,
        addExpense: order.addExpense,
        allMonthlySummaries: order.allMonthlySummaries,
        archiveMonth: order.archiveMonth,

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
