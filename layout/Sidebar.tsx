
import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart, Utensils, ClipboardList, Soup, Users, Settings, QrCode, X, ChefHat, DollarSign, Monitor, GitFork, History, Briefcase, Package, Grid, TrendingUp, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { MAIN_BRANCH_ID } from '../constants';
import { UserRole } from '../types';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
    const { t, activeBranchId, currentUser, managedRestaurants, currentRestaurant, systemSettings, allSettings } = useAppContext();
    const location = useLocation();
    const { pathname } = location;

    const trigger = useRef<HTMLButtonElement>(null);
    const sidebar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clickHandler = ({ target }: MouseEvent) => {
            if (!sidebar.current || !trigger.current) return;
            if (!sidebarOpen || sidebar.current.contains(target as Node) || trigger.current.contains(target as Node)) return;
            setSidebarOpen(false);
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    });

    console.log('🎨 Sidebar - currentRestaurant:', currentRestaurant);
    console.log('🎨 Sidebar - currentUser:', currentUser);

    const canManageUsers = currentUser?.role === 'SuperAdmin' || (currentRestaurant?.canCreateUsers ?? false);
    const canManageBranches = currentUser?.role === 'SuperAdmin' || (currentRestaurant?.canCreateBranches ?? false);
    // Default to true if undefined for backward compatibility, or if no restaurant context (SuperAdmin view of own system)
    const canViewCustomerMenu = currentUser?.role === 'SuperAdmin' || (currentRestaurant?.canCustomerView ?? true);

    // Basic Restaurant Logic
    const isBasicRestaurant = currentRestaurant?.type === 'Basic';

    console.log('🎨 Sidebar - Permisos:');
    console.log('  - canManageUsers:', canManageUsers);
    console.log('  - canManageBranches:', canManageBranches);
    console.log('  - canViewCustomerMenu:', canViewCustomerMenu);
    console.log('  - isBasicRestaurant:', isBasicRestaurant);

    const allMenuItems = [
        { path: '/', icon: BarChart, label: t('sidebar.dashboard'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Waiter, UserRole.Cook, UserRole.Cashier] },
        { path: '/restaurants', icon: Briefcase, label: t('sidebar.restaurants'), roles: ['SuperAdmin'] },
        { path: '/earnings', icon: TrendingUp, label: t('sidebar.earnings'), roles: ['SuperAdmin'] },
        { path: '/branches', icon: GitFork, label: t('sidebar.branches'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/menu', icon: Utensils, label: t('sidebar.menu'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/inventory', icon: Package, label: t('sidebar.inventory'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Waiter, UserRole.Cashier] },
        { path: '/orders', icon: ClipboardList, label: t('sidebar.orders'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Waiter, UserRole.Cashier] },
        { path: '/delivery-mgmt', icon: MapPin, label: t('sidebar.delivery'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Cashier] },
        { path: '/pagers', icon: Grid, label: t('pagers.title'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Waiter, UserRole.Cashier] },
        { path: '/kitchen', icon: Soup, label: t('sidebar.kitchen'), roles: ['SuperAdmin', UserRole.Admin, UserRole.Cook, UserRole.Cashier, UserRole.Waiter] },
        { path: '/sales', icon: DollarSign, label: t('sidebar.daily_sales'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/records', icon: History, label: t('sidebar.total_records'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/users', icon: Users, label: t('sidebar.users'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/settings', icon: Settings, label: t('sidebar.settings'), roles: ['SuperAdmin', UserRole.Admin] },
        { path: '/team-repartidor', icon: Users, label: t('sidebar.team_repartidor'), roles: ['SuperAdmin'] },
        { path: '/repartidor', icon: MapPin, label: t('sidebar.delivery_driver'), roles: ['SuperAdmin', UserRole.DeliveryDriver] },
    ];

    const isDeliveryFeatureEnabled = currentRestaurant?.features?.delivery !== false;
    const activeBranchSettings = activeBranchId ? allSettings[activeBranchId] : null;
    const isDeliveryBranchEnabled = activeBranchSettings?.enableDelivery ?? false;

    const visibleMenuItems = allMenuItems.filter(item => {
        // 0. Delivery Logic
        if (item.path === '/delivery-mgmt' && (!isDeliveryFeatureEnabled || !isDeliveryBranchEnabled)) return false;
        if (item.path === '/team-repartidor' && !isDeliveryFeatureEnabled) return false;
        if (item.path === '/repartidor' && !isDeliveryFeatureEnabled) return false;

        // 1. Si el usuario es Repartidor, SOLO puede ver la página de repartidor
        if (currentUser?.role === UserRole.DeliveryDriver) {
            return item.path === '/repartidor';
        }

        // 1. Verificar que el usuario tenga el rol necesario
        if (!currentUser || !item.roles.includes(currentUser.role as any)) return false;

        // 2. SuperAdmin ve todo
        if (currentUser.role === 'SuperAdmin') return true;

        // 3. Admin ve todo lo permitido en su lista de roles
        if (currentUser.role === UserRole.Admin) {
            // Lógica para restaurantes BÁSICOS (Admin de restaurante básico)
            if (isBasicRestaurant) {
                const basicPages = ['/', '/pagers', '/settings'];
                if (basicPages.includes(item.path)) return true;
                return false;
            }

            // Verificar permisos específicos para Full
            if (item.path === '/users' && !canManageUsers) return false;
            if (item.path === '/branches' && !canManageBranches) return false;

            // Para Full, ocultar Pagers si es Admin
            if (item.path === '/pagers') return false;

            return true;
        }

        // 4. Lógica para roles operativos (Mecero, Cocinero, Cajero)
        const operativeRoles = [UserRole.Waiter, UserRole.Cook, UserRole.Cashier];
        if (operativeRoles.includes(currentUser.role as UserRole)) {
            // Si es rol operativo, SOLO mostrar Pagers si es restaurante Básico
            if (item.path === '/pagers' && !isBasicRestaurant) return false;

            // Solo Dashboard, Sus roles asignados, y Online Monitor (que está abajo)
            return item.roles.includes(currentUser.role as any);
        }

        return false;
    });

    console.log('🎨 Sidebar - Páginas visibles:', visibleMenuItems.map(item => item.path));
    console.log('🎨 Sidebar - Total páginas:', visibleMenuItems.length);

    const isMinimizedPage = pathname === '/orders' || pathname === '/earnings';

    return (
        <>
            <div
                className={`fixed inset-0 bg-gray-900/40 z-40 lg:hidden lg:z-auto transition-opacity duration-200 backdrop-blur-[1px] ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                aria-hidden="true"
            ></div>

            <div
                ref={sidebar}
                className={`flex flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 transform h-screen overflow-y-auto no-scrollbar shrink-0 bg-gray-800 dark:bg-gray-900 p-4 transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-64'
                    } ${isMinimizedPage ? 'lg:w-20' : 'w-64'}`}
            >
                <div className={`flex items-center mb-10 pr-3 sm:px-2 ${isMinimizedPage ? 'lg:justify-center' : 'justify-between'}`}>
                    <NavLink end to="/" className="flex items-center space-x-2 text-white">
                        {systemSettings.logoSidebar ? (
                            <img src={systemSettings.logoSidebar} alt="Ziroo Logo" className="h-8 w-8 object-contain" />
                        ) : (
                            <div className="h-8 w-8 bg-primary-500 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
                                <ChefHat size={18} className="text-white" />
                            </div>
                        )}
                        <div className={`flex flex-col ${isMinimizedPage ? 'lg:hidden' : ''}`}>
                            <span className="text-xl font-semibold whitespace-nowrap leading-none">Ziroo</span>
                            <span className="text-[10px] font-medium tracking-wider opacity-80 leading-none">chef</span>
                        </div>
                    </NavLink>
                    <button
                        ref={trigger}
                        className={`lg:hidden text-gray-500 hover:text-gray-400`}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-controls="sidebar"
                        aria-expanded={sidebarOpen}
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="space-y-2">
                    {visibleMenuItems.map(item => (
                        <NavLink
                            key={item.label}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200 ${(pathname === '/' && item.path === '/') || (pathname.startsWith(item.path) && item.path !== '/')
                                    ? '!text-white bg-primary-600'
                                    : ''
                                } ${isMinimizedPage ? 'lg:justify-center' : ''}`
                            }
                            onClick={() => setSidebarOpen(false)}
                            title={isMinimizedPage ? item.label : ''}
                        >
                            <item.icon className="h-6 w-6 shrink-0" />
                            <span className={`ml-4 font-medium whitespace-nowrap ${isMinimizedPage ? 'lg:hidden' : ''}`}>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto space-y-2">
                    {/* Hide Customer View for Basic Restaurants OR if permission disabled, AND hide for DeliveryDriver */}
                    {!isBasicRestaurant && canViewCustomerMenu && currentUser?.role !== UserRole.DeliveryDriver && (
                        <NavLink
                            to={`/customer/branch/${activeBranchId || MAIN_BRANCH_ID}/table/1`}
                            className={`flex items-center p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200 ${isMinimizedPage ? 'lg:justify-center' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                            title={isMinimizedPage ? t('sidebar.customer_view') : ''}
                        >
                            <QrCode className="h-6 w-6 shrink-0" />
                            <span className={`ml-4 font-medium whitespace-nowrap ${isMinimizedPage ? 'lg:hidden' : ''}`}>{t('sidebar.customer_view')}</span>
                        </NavLink>
                    )}
                    {currentUser?.role !== UserRole.DeliveryDriver && (
                        <NavLink
                            to={`/monitor/${activeBranchId || MAIN_BRANCH_ID}`}
                            className={`flex items-center p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors duration-200 ${isMinimizedPage ? 'lg:justify-center' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                            title={isMinimizedPage ? t('sidebar.online_monitor') : ''}
                        >
                            <Monitor className="h-6 w-6 shrink-0" />
                            <span className={`ml-4 font-medium whitespace-nowrap ${isMinimizedPage ? 'lg:hidden' : ''}`}>{t('sidebar.online_monitor')}</span>
                        </NavLink>
                    )}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
