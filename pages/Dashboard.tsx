
import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useOrder } from '../context/OrderContext';
import Card from '../components/ui/Card';
import { OrderStatus, Order } from '../types';
import { supabase } from '../services/supabase';

import { isTodayBolivia, isYesterdayBolivia } from '../utils/dateUtils';


const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const STATUS_COLORS: { [key in OrderStatus]: string } = {
    [OrderStatus.AwaitingApproval]: 'bg-yellow-400 text-black',
    [OrderStatus.Pending]: 'bg-pending text-white',
    [OrderStatus.Preparing]: 'bg-preparing text-white',
    [OrderStatus.Ready]: 'bg-ready text-white',
    [OrderStatus.PickedUp]: 'bg-purple-500 text-white',
    [OrderStatus.Delivered]: 'bg-gray-500 text-white',
    [OrderStatus.Cancelled]: 'bg-red-600 text-white',
};

const Dashboard: React.FC = () => {
    const { t, orders, formatCurrency, currentRestaurant, pagerLogs, categories, activeBranch, fetchOrders } = useAppContext();
    const { activeCashRegister, openCashRegister, closeCashRegister, fetchAllInventoryTransactions } = useOrder();
    const { currentUser } = useAuth();

    const isFetched = React.useRef(false);

    // Initial Fetch with Mount Control (Stop Infinite Loop)
    React.useEffect(() => {
        if (!isFetched.current) {
            console.log("🚀 Initial fetch for Dashboard (Bolivia Today)");
            fetchOrders();
            if (fetchAllInventoryTransactions) fetchAllInventoryTransactions();
            isFetched.current = true;
        }
    }, [fetchOrders, fetchAllInventoryTransactions]);

    const [isOpeningModalOpen, setIsOpeningModalOpen] = React.useState(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = React.useState(false);
    const [openingAmount, setOpeningAmount] = React.useState<string>('0');
    const [physicsAmount, setPhysicsAmount] = React.useState<string>('0');
    const [closingSummary, setClosingSummary] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    if (currentUser?.role === 'DeliveryDriver') {
        return <Navigate to="/repartidor" replace />;
    }

    const isBasicPlan = currentRestaurant?.type === 'Basic';


    // --- FULL PLAN DATA LOGIC ---
    // Match DailySales logic: Include all EXCEPT Cancelled and AwaitingApproval for active metrics
    const activeOrders = useMemo(() => orders.filter(o =>
        o.status !== OrderStatus.Cancelled &&
        o.status !== OrderStatus.AwaitingApproval
    ), [orders]);

    const todaysActiveOrders = useMemo(() => activeOrders.filter(o => isTodayBolivia(o.timestamp)), [activeOrders]);
    const yesterdaysActiveOrders = useMemo(() => activeOrders.filter(o => isYesterdayBolivia(o.timestamp)), [activeOrders]);

    const kpis = useMemo(() => {
        const revenue = todaysActiveOrders.reduce((sum, order) => {
            const dfee = order.deliveryFee || 0;
            return sum + ((order.totalAmount || 0) - dfee);
        }, 0);
        const totalOrders = todaysActiveOrders.length;
        // avgOrderValue removed from display but calc kept if needed internally
        const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;
        return {
            totalOrders,
            revenue,
            avgOrderValue,
        };
    }, [todaysActiveOrders]);

    const formatDuration = (totalMinutes: number) => {
        const totalSeconds = Math.floor(totalMinutes * 60);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
        return `${mins}m ${secs}s`;
    };

    const avgDeliveryTime = useMemo(() => {
        const deliveredWithTime = todaysActiveOrders.filter(o => typeof o.completionTime === 'number');
        if (deliveredWithTime.length === 0) return 0;
        const totalMinutes = deliveredWithTime.reduce((sum, order) => sum + order.completionTime!, 0);
        return totalMinutes / deliveredWithTime.length;
    }, [todaysActiveOrders]);

    const formattedDeliveryTime = useMemo(() => formatDuration(avgDeliveryTime), [avgDeliveryTime]);

    const hourlyRevenueComparison = useMemo(() => {
        const todayKey = t('dashboard.today');
        const yesterdayKey = t('dashboard.yesterday');

        const hours = Array(24).fill(0).map((_, i) => ({
            name: `${i}:00`,
            [todayKey]: 0,
            [yesterdayKey]: 0
        }));

        todaysActiveOrders.forEach(order => {
            const hour = new Date(order.timestamp).getHours();
            const dfee = order.deliveryFee || 0;
            hours[hour][todayKey] += (order.totalAmount || 0) - dfee;
        });

        yesterdaysActiveOrders.forEach(order => {
            const hour = new Date(order.timestamp).getHours();
            const dfee = order.deliveryFee || 0;
            hours[hour][yesterdayKey] += (order.totalAmount || 0) - dfee;
        });

        return hours.slice(8, 23).map(h => ({ // Restaurant hours 8 AM to 10 PM
            ...h,
            [todayKey]: parseFloat(h[todayKey].toFixed(2)),
            [yesterdayKey]: parseFloat(h[yesterdayKey].toFixed(2)),
        }));
    }, [todaysActiveOrders, yesterdaysActiveOrders, t]);


    const salesByCategoryToday = useMemo(() => {
        const categoryTotals: Record<string, number> = {};

        todaysActiveOrders.forEach(order => {
            order.items.forEach(item => {
                const categoryId = item.menuItem.category;

                // Usar el precio correcto (variación si existe, sino el precio base)
                const itemPrice = item.variation?.price ?? item.menuItem.price;
                const itemTotal = itemPrice * item.quantity;

                // Si el item tiene categoría, sumarla
                if (categoryId) {
                    if (!categoryTotals[categoryId]) {
                        categoryTotals[categoryId] = 0;
                    }
                    categoryTotals[categoryId] += itemTotal;
                }
            });
        });

        // Convertir a array y mapear con nombres de categorías
        return Object.entries(categoryTotals)
            .map(([catId, value]) => {
                const category = categories.find(c => c.id === catId);
                let catName = category?.name || t('dashboard.unknown_category');

                return {
                    name: catName,
                    value: parseFloat(value.toFixed(2)),
                };
            })
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor
    }, [todaysActiveOrders, categories, t]);

    // Updated: Filter recent orders to show ONLY today's orders
    const recentOrders = useMemo(() => {
        return [...orders]
            .filter(o => isTodayBolivia(o.timestamp)) // ONLY TODAY
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);
    }, [orders]);

    // --- BASIC PLAN DATA LOGIC (Pager Data) ---
    const basicPlanData = useMemo(() => {
        if (!isBasicPlan) return null;

        const logsToday = pagerLogs.filter(log => isTodayBolivia(log.completionTime));
        const totalOrdersToday = logsToday.length;

        const totalDurationSeconds = logsToday.reduce((sum, log) => sum + log.durationSeconds, 0);
        const avgDeliveryMinutes = totalOrdersToday > 0 ? (totalDurationSeconds / totalOrdersToday) / 60 : 0;

        // Chart data: Last 7 days count
        const chartData: { name: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

            // Find logs matching this day
            const count = pagerLogs.filter(log => {
                const logDate = new Date(log.completionTime);
                logDate.setHours(0, 0, 0, 0);
                return logDate.getTime() === date.getTime();
            }).length;

            chartData.push({ name: dateStr, count });
        }

        return {
            totalOrdersToday,
            avgDeliveryMinutes,
            formattedAvgTime: formatDuration(avgDeliveryMinutes),
            chartData
        };
    }, [isBasicPlan, pagerLogs, formatDuration]);

    const getTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return t('time.years_ago', { value: Math.floor(interval).toString() });
        interval = seconds / 2592000;
        if (interval > 1) return t('time.months_ago', { value: Math.floor(interval).toString() });
        interval = seconds / 86400;
        if (interval > 1) return t('time.days_ago', { value: Math.floor(interval).toString() });
        interval = seconds / 3600;
        if (interval > 1) return t('time.hours_ago', { value: Math.floor(interval).toString() });
        interval = seconds / 60;
        if (interval > 1) return t('time.minutes_ago', { value: Math.floor(interval).toString() });
        if (seconds < 10) return t('time.just_now');
        return t('time.seconds_ago', { value: Math.floor(seconds).toString() });
    };

    const handleOpenBox = async () => {
        setIsLoading(true);
        try {
            await openCashRegister(parseFloat(openingAmount) || 0);
            setIsOpeningModalOpen(false);
        } catch (e) {
            alert("Error al abrir caja");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrepareClose = async () => {
        if (!activeCashRegister) return;
        setIsLoading(true);
        try {
            const { data: summary } = await supabase
                .from('resumen_caja_actual')
                .select('*')
                .eq('cash_register_id', activeCashRegister.id)
                .single();

            setClosingSummary(summary);
            setPhysicsAmount(((activeCashRegister.openingAmount || 0) + (summary?.total_cash_sales || 0)).toString());
            setIsClosingModalOpen(true);
        } catch (e) {
            alert("Error al obtener resumen de caja");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmClose = async () => {
        setIsLoading(true);
        try {
            await closeCashRegister(parseFloat(physicsAmount) || 0);
            setIsClosingModalOpen(false);
        } catch (e) {
            alert("Error al cerrar caja");
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDER BASIC PLAN DASHBOARD ---
    if (isBasicPlan && basicPlanData) {
        return (
            <div className="text-gray-900 dark:text-white">
                <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                        <div className="flex items-center">
                            <div className="p-4 rounded-full bg-blue-500 text-white shadow-lg">
                                <ShoppingCart size={32} />
                            </div>
                            <div className="ml-6">
                                <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.total_orders')}</h3>
                                <p className="text-4xl font-extrabold text-gray-900 dark:text-white mt-1">{basicPlanData.totalOrdersToday}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('dashboard.today')}</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                        <div className="flex items-center">
                            <div className="p-4 rounded-full bg-amber-500 text-white shadow-lg">
                                <Clock size={32} />
                            </div>
                            <div className="ml-6">
                                <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.avg_delivery_time')}</h3>
                                <p className="text-4xl font-extrabold text-gray-900 dark:text-white mt-1">{basicPlanData.formattedAvgTime}</p>
                                <p className="text-sm text-gray-400 mt-1">{t('dashboard.today')}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-gray-100">{t('dashboard.orders_overview_7_days')}</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={basicPlanData.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.2)" />
                                <XAxis dataKey="name" tick={{ fill: 'currentColor' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fill: 'currentColor' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} name={t('dashboard.orders_label')} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        );
    }

    // --- RENDER FULL PLAN DASHBOARD ---
    return (
        <div className="text-gray-900 dark:text-white">
            <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>

            {/* KPI Cards - Updated to 3 cols, showing Income, Total Orders, Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-500 dark:text-primary-300">
                            <DollarSign size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.revenue')}</p>
                            <p className="text-2xl font-semibold">{formatCurrency(kpis.revenue)}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300">
                            <ShoppingCart size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.total_orders')}</p>
                            <p className="text-2xl font-semibold">{kpis.totalOrders}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-accent-100 dark:bg-accent-900 text-accent-500 dark:text-accent-300">
                            <Clock size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.avg_delivery_time')}</p>
                            <p className="text-2xl font-semibold">{formattedDeliveryTime}</p>
                        </div>
                    </div>
                </Card>

                {/* Cash Register Card */}
                <Card className={`p-5 border-l-4 ${activeBranch?.isOpen ? 'border-primary-500' : 'border-red-500'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <div className={`p-3 rounded-full ${activeBranch?.isOpen ? 'bg-primary-100 dark:bg-primary-900 text-primary-500' : 'bg-red-100 dark:bg-red-900 text-red-500'}`}>
                                <DollarSign size={24} />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Estado de Caja</p>
                                <p className="text-xl font-bold">{activeBranch?.isOpen ? 'Caja Abierta' : 'Caja Cerrada'}</p>
                                {activeCashRegister && activeBranch?.isOpen && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Iniciada con: {formatCurrency(activeCashRegister.openingAmount)}</p>
                                )}
                            </div>
                        </div>
                        <div>
                            {activeBranch?.isOpen ? (
                                <button
                                    onClick={handlePrepareClose}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cerrar Caja
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsOpeningModalOpen(true)}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Abrir Caja
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Modals */}
            {isOpeningModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h2 className="text-2xl font-bold mb-4">Abrir Caja</h2>
                        <p className="text-gray-500 mb-6">Ingresa el monto inicial de efectivo en caja para comenzar el turno.</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Monto de Apertura</label>
                            <input
                                type="number"
                                value={openingAmount}
                                onChange={(e) => setOpeningAmount(e.target.value)}
                                className="w-full p-4 text-2xl font-bold border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 text-center"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsOpeningModalOpen(false)}
                                className="flex-1 py-3 text-gray-600 font-medium"
                                disabled={isLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleOpenBox}
                                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Abriendo...' : 'Abrir Caja'}
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {isClosingModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6">
                        <h2 className="text-2xl font-bold mb-4">Cerrar Caja</h2>
                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <span className="text-gray-500">Monto Inicial:</span>
                                <span className="font-bold">{formatCurrency(activeCashRegister?.openingAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <span className="text-gray-500">Ventas en Efectivo:</span>
                                <span className="font-bold text-primary-600">+{formatCurrency(closingSummary?.total_cash_sales || 0)}</span>
                            </div>
                            <div className="flex justify-between p-3 border-t-2 border-gray-200 dark:border-gray-700">
                                <span className="text-lg font-bold">Esperado en Sistema:</span>
                                <span className="text-lg font-bold">{formatCurrency((activeCashRegister?.openingAmount || 0) + (closingSummary?.total_cash_sales || 0))}</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Contado Físico (Efectivo)</label>
                            <input
                                type="number"
                                value={physicsAmount}
                                onChange={(e) => setPhysicsAmount(e.target.value)}
                                className="w-full p-4 text-3xl font-bold border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 text-center"
                                autoFocus
                            />
                            <p className="text-sm text-center mt-2 text-gray-500">Ingresa cuánto dinero real tienes en la caja.</p>
                        </div>

                        {physicsAmount !== '' && (
                            <div className={`p-4 rounded-xl text-center mb-6 ${parseFloat(physicsAmount) === ((activeCashRegister?.openingAmount || 0) + (closingSummary?.total_cash_sales || 0))
                                ? 'bg-green-100 text-green-700'
                                : parseFloat(physicsAmount) > ((activeCashRegister?.openingAmount || 0) + (closingSummary?.total_cash_sales || 0))
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                <p className="text-sm uppercase tracking-wide font-bold">Diferencia</p>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(parseFloat(physicsAmount) - ((activeCashRegister?.openingAmount || 0) + (closingSummary?.total_cash_sales || 0)))}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsClosingModalOpen(false)}
                                className="flex-1 py-3 text-gray-600 font-medium"
                                disabled={isLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Cerrando...' : 'Confirmar Cierre'}
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 gap-8">
                <Card className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                                    <TrendingUp size={20} className="text-white" />
                                </div>
                                {t('dashboard.hourly_revenue_comparison')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                                Comparación de ventas entre hoy y ayer
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart
                                data={hourlyRevenueComparison}
                                margin={{ top: 30, right: 20, left: 0, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="yesterdayGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="rgba(148, 163, 184, 0.2)"
                                />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.3)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                                    tickFormatter={(value) => `${value}`}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
                                />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '12px 16px',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                                        color: '#fff',
                                        fontWeight: 600
                                    }}
                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                />
                                <Legend
                                    wrapperStyle={{
                                        paddingTop: '20px',
                                        fontWeight: 700,
                                        fontSize: '14px'
                                    }}
                                    iconType="circle"
                                />
                                <Bar
                                    dataKey={t('dashboard.today')}
                                    fill="url(#todayGradient)"
                                    radius={[8, 8, 0, 0]}
                                    maxBarSize={60}
                                    label={{
                                        position: 'top',
                                        fill: 'currentColor',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        formatter: (value: number) => value > 0 ? value.toFixed(0) : ''
                                    }}
                                />
                                <Bar
                                    dataKey={t('dashboard.yesterday')}
                                    fill="url(#yesterdayGradient)"
                                    radius={[8, 8, 0, 0]}
                                    maxBarSize={60}
                                    label={{
                                        position: 'top',
                                        fill: 'currentColor',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        formatter: (value: number) => value > 0 ? value.toFixed(0) : ''
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-3">
                    <Card className="p-5">
                        <h2 className="text-xl font-semibold mb-4">{t('dashboard.sales_by_category_today')}</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={salesByCategoryToday}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {salesByCategoryToday.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: 'rgba(31, 41, 55, 0.9)',
                                        borderRadius: '12px',
                                        border: 'none',
                                        color: '#fff',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            </div>

            <div className="mt-8">
                <Card className="p-5">
                    <h2 className="text-xl font-semibold mb-4">{t('dashboard.recent_orders')}</h2>
                    <div className="flow-root">
                        <ul role="list" className="-mb-8">
                            {recentOrders.map((order, orderIdx) => (
                                <li key={order.id}>
                                    <div className="relative pb-8">
                                        {orderIdx !== recentOrders.length - 1 ? (
                                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                                        ) : null}
                                        <div className="relative flex space-x-3 items-center">
                                            <div>
                                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${STATUS_COLORS[order.status]}`}>
                                                    <Clock size={16} />
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1 md:grid md:grid-cols-3 md:gap-4 items-center">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                        {t('dashboard.order_id')}{order.dailyTicketNumber}
                                                        <span className="font-normal text-gray-500 dark:text-gray-400"> - {order.customerName || `${t('orders.table')} ${order.tableId}`}</span>
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                                        {getTimeAgo(order.timestamp)}
                                                    </p>
                                                </div>
                                                <div className="hidden md:block text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                                                        {t(`status.${order.status}`)}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(order.totalAmount || 0)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {recentOrders.length === 0 && (
                                <li className="py-4 text-center text-gray-500">{t('monitor.no_active_orders')}</li>
                            )}
                        </ul>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
