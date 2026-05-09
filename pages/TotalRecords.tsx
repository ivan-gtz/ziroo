import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { useOrder } from '../context/OrderContext';
import Card from '../components/ui/Card';
import { OrderStatus, OrderType, PaymentMethod } from '../types';
import { DollarSign, ShoppingCart, TrendingUp, Clock, Calendar, Globe, XCircle, Wallet, QrCode, FileSpreadsheet, FileText, FileCode, CheckCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { generateMonthlyReportData, downloadExcel, downloadPDF, downloadXML, generateYearlyReportData, downloadYearlyExcel, downloadYearlyPDF } from '../utils/reportGenerator';

const PIE_COLORS = ['#10b981', '#f59e0b']; // Primary Green, Accent Mustard

const TotalRecords: React.FC = () => {
    const { t, orders, formatCurrency, menuItems, allInventoryTransactions, activeBranchId, allSettings, activeBranch, fetchAllSystemOrders, fetchAllInventoryTransactions } = useAppContext();
    const { allCashRegisters, allMonthlySummaries, archiveMonth, expenses } = useOrder();

    // Date Filtering State - Default to Current Month
    const [monthFilter, setMonthFilter] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    });
    const [dailySummaryPage, setDailySummaryPage] = useState(1);
    const [cashPager, setCashPager] = useState(1);
    const ROWS_PER_PAGE = 5; // Reduced to 5 as requested
    const [refreshing, setRefreshing] = useState(false);
    const { fetchOrders } = useAppContext();

    // Fetch historical data specifically for this branch on mount
    const hasFetchedHistory = React.useRef(false);
    React.useEffect(() => {
        if (activeBranchId && !hasFetchedHistory.current && fetchOrders) {
            console.log(`🚀 TotalRecords: Initializing historical fetch (31 days) for branch ${activeBranchId}`);
            // true = 31 days, activeBranchId = branch specific, true = include items (needed for Más Vendidos)
            fetchOrders(true, activeBranchId, true);
            if (fetchAllInventoryTransactions) fetchAllInventoryTransactions();
            hasFetchedHistory.current = true;
        }
    }, [activeBranchId, fetchOrders, fetchAllInventoryTransactions]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchAllSystemOrders ? fetchAllSystemOrders() : Promise.resolve(),
                (fetchAllInventoryTransactions as any) ? (fetchAllInventoryTransactions as any)() : Promise.resolve()
            ]);
            // Small delay to ensure UI feels responsive
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error("Error refreshing data:", error);
        } finally {
            setRefreshing(false);
        }
    };

    // Helper to check if a date is within the selected month
    const isInMonth = (dateInput: Date | string | number) => {
        if (!dateInput) return false;
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return false;
        
        return date.getFullYear() === monthFilter.year &&
               date.getMonth() === monthFilter.month;
    };

    const cashRegistersInMonth = useMemo(() => {
        return allCashRegisters.filter(cr => {
            const date = cr.openedAt ? new Date(cr.openedAt) : new Date();
            return isInMonth(date);
        });
    }, [allCashRegisters, monthFilter]);

    const ordersInMonth = useMemo(() => {
        return orders.filter(o => isInMonth(new Date(o.timestamp)));
    }, [orders, monthFilter]);

    // Filter delivered orders based on monthly selection
    const filteredDeliveredOrders = useMemo(() => {
        return ordersInMonth.filter(o => 
            o.status !== OrderStatus.Cancelled && 
            o.status !== OrderStatus.AwaitingApproval
        );
    }, [ordersInMonth]);

    const filteredCancelledOrders = useMemo(() => {
        return ordersInMonth.filter(o => o.status === OrderStatus.Cancelled);
    }, [ordersInMonth]);


    const periodExpenses = useMemo(() => {
        return (expenses || []).filter(e => isInMonth(new Date(e.createdAt)));
    }, [expenses, monthFilter]);

    // 1. DATA MULTIPLEXER: Blend Monthly Summary with Raw Orders
    const stats = useMemo(() => {
        const summary = allMonthlySummaries[activeBranchId || '']?.find(s => 
            s.year === monthFilter.year && s.month === monthFilter.month
        );

        if (summary) {
            return {
                totalRevenue: Number(summary.totalSales),
                totalOrders: Math.round(Number(summary.totalSales) / (Number(summary.averageTicket) || 1)),
                totalCancelled: 0,
                totalOnlineOrders: 0,
                totalCash: 0,
                totalQR: 0,
                totalExpenses: 0,
                netCash: 0,
                hasExpenses: false,
                isFromSummary: true,
                dailyData: summary.dailyDataJson || []
            };
        }

        const totalRevenue = filteredDeliveredOrders.reduce((sum, order) => sum + ((order.totalAmount || 0) - (order.deliveryFee || 0)), 0);
        const totalOrders = filteredDeliveredOrders.length;
        const totalCancelled = filteredCancelledOrders.length;
        const totalExpenses = periodExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

        let totalCash = 0;
        let totalQR = 0;
        filteredDeliveredOrders.forEach(order => {
            const dfee = order.deliveryFee || 0;
            if (order.paymentMethod === PaymentMethod.Combined) {
                totalCash += (order.cashPaid || 0);
                totalQR += (order.qrPaid || 0);
            } else if (order.paymentMethod === PaymentMethod.Cash) {
                totalCash += ((order.totalAmount || 0) - dfee);
            } else if (order.paymentMethod === PaymentMethod.QR) {
                totalQR += ((order.totalAmount || 0) - dfee);
            }
        });

        const totalOnlineOrders = filteredDeliveredOrders.filter(o => 
            o.source === 'online' || o.waiterName === 'Customer App' || o.source === 'CustomerMenu'
        ).length;

        return {
            totalRevenue, totalOrders, totalCancelled, totalOnlineOrders, totalCash, totalQR, totalExpenses,
            netCash: totalCash - totalExpenses,
            hasExpenses: totalExpenses > 0,
            isFromSummary: false,
            dailyData: null
        };
    }, [filteredDeliveredOrders, filteredCancelledOrders, periodExpenses, allMonthlySummaries, activeBranchId, monthFilter]);

    // 2. DAILY CHART DATA
    const dailyChartData = useMemo(() => {
        if (stats.dailyData && Array.isArray(stats.dailyData)) {
            return stats.dailyData.map((d: any) => ({
                name: String(d.day || d.date),
                dateISO: d.dateISO || d.date,
                [t('records.revenue')]: d.revenue || d.total_sales,
                totalOrders: d.orders || d.orders_count || 0,
            })).sort((a,b) => b.dateISO.localeCompare(a.dateISO));
        }

        const dataMap = new Map<string, { totalRevenue: number; totalOrders: number; dateRef: Date }>();
        filteredDeliveredOrders.forEach(order => {
            const date = new Date(order.timestamp);
            const dateString = date.toLocaleDateString('en-CA');
            const current = dataMap.get(dateString) || { totalRevenue: 0, totalOrders: 0, dateRef: date };
            dataMap.set(dateString, {
                totalRevenue: current.totalRevenue + ((order.totalAmount || 0) - (order.deliveryFee || 0)),
                totalOrders: current.totalOrders + 1,
                dateRef: date
            });
        });

        return Array.from(dataMap.entries())
            .map(([date, stats]) => ({
                name: stats.dateRef.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }),
                dateISO: date,
                [t('records.revenue')]: stats.totalRevenue,
                totalOrders: stats.totalOrders,
                avgOrderValue: stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0
            }))
            .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    }, [filteredDeliveredOrders, t, stats.dailyData]);

    // 3. PAGINATION & TOTALS
    const paginatedDailyData = useMemo(() => {
        const start = (dailySummaryPage - 1) * ROWS_PER_PAGE;
        return dailyChartData.slice(start, start + ROWS_PER_PAGE);
    }, [dailyChartData, dailySummaryPage]);

    const totalPages = Math.ceil(dailyChartData.length / ROWS_PER_PAGE);

    // 4. LAST 7 DAYS (Independent)
    const last7DaysRevenue = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            days.push(d);
        }
        return days.map(day => {
            const compareDate = day.toLocaleDateString('en-CA');
            const dayRevenue = orders
                .filter(o => 
                    o.status !== OrderStatus.Cancelled && 
                    o.status !== OrderStatus.AwaitingApproval &&
                    new Date(o.timestamp).toLocaleDateString('en-CA') === compareDate
                )
                .reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.deliveryFee || 0)), 0);

            return {
                name: day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
                value: dayRevenue
            };
        });
    }, [orders]);

    // TIME TRAVEL INVENTORY LOGIC
    const inventoryReport = useMemo(() => {
        const inventoryItems: any[] = [];
        const branchId = activeBranchId || '';
        const transactions = allInventoryTransactions[branchId] || [];

        // Definition of movement maps
        const addedDuring: Record<string, number> = {};
        const soldDuring: Record<string, number> = {};
        const returnedDuring: Record<string, number> = {};
        const netChangeDuring: Record<string, number> = {};
        const netChangeAfter: Record<string, number> = {};

        // Define time boundaries for the selected MONTH
        const selectedMonthStart = new Date(monthFilter.year, monthFilter.month, 1, 0, 0, 0);
        const selectedMonthEnd = new Date(monthFilter.year, monthFilter.month + 1, 0, 23, 59, 59);
        const startTs = selectedMonthStart.getTime();
        const endTs = selectedMonthEnd.getTime();

        // 1. Process ONLY Transactions (Single source of truth for stock)
        transactions.forEach(tx => {
            const txTime = new Date(tx.timestamp).getTime();
            const key = tx.variationId ? `${tx.menuItemId}-${tx.variationId}` : tx.menuItemId;
            const qty = tx.quantity || 0;

            const isDuring = (txTime >= startTs && txTime <= endTs);
            const isAfter = txTime > endTs;

            if (isDuring) {
                netChangeDuring[key] = (netChangeDuring[key] || 0) + qty;
                if (tx.type === 'Restock') addedDuring[key] = (addedDuring[key] || 0) + qty;
                else if (tx.type.startsWith('Sale')) soldDuring[key] = (soldDuring[key] || 0) + Math.abs(qty);
                else if (tx.type.includes('Return') || tx.type.includes('Cancellation')) returnedDuring[key] = (returnedDuring[key] || 0) + Math.abs(qty);
            } else if (isAfter) {
                netChangeAfter[key] = (netChangeAfter[key] || 0) + qty;
            }
        });

        // 2. Build Report Items
        menuItems.forEach(item => {
            const processItem = (id: string, name: string, currentStock: number | undefined | null) => {
                const changeDuring = netChangeDuring[id] || 0;
                const changeAfter = netChangeAfter[id] || 0;

                const addD = addedDuring[id] || 0;
                const saleD = soldDuring[id] || 0;
                const retD = returnedDuring[id] || 0;

                let initialStock: number | undefined = undefined;
                let remainingStock: number | undefined = undefined;

                if (currentStock !== undefined && currentStock !== null) {
                    // Time Travel Math:
                    // StartOfRequestedPeriod = Current - Movements_After - Movements_During
                    initialStock = Math.max(0, currentStock - changeAfter - changeDuring);
                    // EndOfRequestedPeriod = StartOfRequestedPeriod + Movements_During
                    remainingStock = initialStock + changeDuring;
                }

                inventoryItems.push({
                    id,
                    name,
                    initialStock,
                    added: addD,
                    returned: retD,
                    soldInPeriod: saleD - retD, // Net Sales (Active ones)
                    remainingStock,
                    isUnlimited: currentStock === undefined || currentStock === null,
                    isCombo: item.isCombo
                });
            };

            if (item.variations && item.variations.length > 0) {
                item.variations.forEach(v => {
                    processItem(`${item.id}-${v.id}`, `${item.name} (${v.name})`, v.stock);
                });
            } else {
                processItem(item.id, item.name, item.stock);
            }
        });

        return inventoryItems;
    }, [menuItems, allInventoryTransactions, activeBranchId, monthFilter]);

    const bestSelling = useMemo(() => {
        return inventoryReport
            .filter(item => item.soldInPeriod > 0)
            .sort((a, b) => b.soldInPeriod - a.soldInPeriod)
            .slice(0, 10)
            .map(item => ({
                name: item.name,
                quantity: item.soldInPeriod,
                isCombo: item.isCombo
            }));
    }, [inventoryReport]);

    const orderDistribution = useMemo(() => {
        const counts = filteredDeliveredOrders.reduce((acc, order) => {
            acc[order.orderType] = (acc[order.orderType] || 0) + 1;
            return acc;
        }, {} as Record<OrderType, number>);

        return [
            { name: t('orders.dine_in'), value: counts[OrderType.DineIn] || 0 },
            { name: t('orders.takeaway'), value: counts[OrderType.Takeaway] || 0 },
        ];
    }, [filteredDeliveredOrders, t]);

    return (
        <div className="text-gray-900 dark:text-white pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">
                        {t('records.title')}
                    </h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Reporte consolidado del mes de {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(monthFilter.year, monthFilter.month))}
                    </p>
                </div>

                {/* Monthly Selector */}
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-gray-700">
                    <Calendar size={18} className="text-primary-500" />
                    <select
                        value={monthFilter.month}
                        onChange={(e) => setMonthFilter(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                        className="bg-transparent border-none text-sm font-black uppercase focus:ring-0 cursor-pointer"
                    >
                        {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                            <option key={m} value={i}>{m}</option>
                        ))}
                    </select>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                    <select
                        value={monthFilter.year}
                        onChange={(e) => setMonthFilter(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        className="bg-transparent border-none text-sm font-black uppercase focus:ring-0 cursor-pointer"
                    >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Monthly Report Download Section */}
            <Card className="p-5 mb-8 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-2 border-primary-200 dark:border-primary-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-primary-500 text-white rounded-[1.5rem] shadow-lg shadow-primary-200">
                             <FileSpreadsheet size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Reportes de Exportación</h3>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Descarga el balance mensual en formatos contables</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <button
                            onClick={async () => {
                                const settings = allSettings[activeBranch?.id || ''];
                                if (settings) {
                                    const branchSummaries = allMonthlySummaries[activeBranch?.id || ''] || [];
                                    const archived = branchSummaries.find(s => s.month === monthFilter.month && s.year === monthFilter.year);
                                    let reportData;
                                    if (archived) {
                                        reportData = {
                                            restaurantName: settings.restaurantName || 'Restaurant',
                                            taxId: settings.taxId || 'N/A',
                                            address: settings.address || 'N/A',
                                            month: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(monthFilter.year, monthFilter.month)),
                                            year: monthFilter.year,
                                            dailyData: archived.dailyDataJson,
                                            operatingDays: archived.operatingDays,
                                            averageTicket: archived.averageTicket,
                                            totalSales: archived.totalSales,
                                            currencySymbol: settings.currency || 'Bs'
                                        };
                                    } else {
                                        reportData = generateMonthlyReportData(orders, expenses, settings, monthFilter.year, monthFilter.month);
                                    }
                                    downloadExcel(reportData);
                                }
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-green-200/50"
                        >
                            <FileSpreadsheet size={18} /> EXCEL
                        </button>
                        <button
                            onClick={async () => {
                                const settings = allSettings[activeBranch?.id || ''];
                                if (settings) {
                                    const branchSummaries = allMonthlySummaries[activeBranch?.id || ''] || [];
                                    const archived = branchSummaries.find(s => s.month === monthFilter.month && s.year === monthFilter.year);
                                    let reportData;
                                    if (archived) {
                                        reportData = {
                                            restaurantName: settings.restaurantName || 'Restaurant',
                                            taxId: settings.taxId || 'N/A',
                                            address: settings.address || 'N/A',
                                            month: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(monthFilter.year, monthFilter.month)),
                                            year: monthFilter.year,
                                            dailyData: archived.dailyDataJson,
                                            operatingDays: archived.operatingDays,
                                            averageTicket: archived.averageTicket,
                                            totalSales: archived.totalSales,
                                            currencySymbol: settings.currency || 'Bs'
                                        };
                                    } else {
                                        reportData = generateMonthlyReportData(orders, expenses, settings, monthFilter.year, monthFilter.month);
                                    }
                                    downloadPDF(reportData);
                                }
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-red-200/50"
                        >
                            <FileText size={18} /> PDF
                        </button>
                    </div>
                </div>
            </Card>

            {/* KPI Cards - 6 Cards Requested */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* 1. Total Sales (Revenue) */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-500 dark:text-primary-300">
                            <DollarSign size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_sales')}</p>
                            <p className="text-2xl font-semibold">{formatCurrency(stats.totalRevenue)}</p>
                        </div>
                    </div>
                </Card>
                {/* 2. Total Orders */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300">
                            <ShoppingCart size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.total_orders')}</p>
                            <p className="text-2xl font-semibold">{stats.totalOrders}</p>
                        </div>
                    </div>
                </Card>
                {/* 3. Cancelled Orders */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 text-red-500 dark:text-red-300">
                            <XCircle size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.cancelled_orders')}</p>
                            <p className="text-2xl font-semibold">{stats.totalCancelled}</p>
                        </div>
                    </div>
                </Card>
                {/* 4. Online Orders */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300">
                            <Globe size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.online_orders')}</p>
                            <p className="text-2xl font-semibold">{stats.totalOnlineOrders}</p>
                        </div>
                    </div>
                </Card>
                {/* 5. Total Cash (Net) */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-500 dark:text-green-300">
                            <Wallet size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_cash')}</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-semibold">{formatCurrency(stats.netCash)}</p>
                                {stats.totalExpenses > 0 && (
                                    <span className="text-xs text-red-500 font-medium">
                                        ({formatCurrency(stats.totalCash)} - {formatCurrency(stats.totalExpenses)} {t('inventory.extra_purchases')})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
                {/* 6. Total QR */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-500 dark:text-purple-300">
                            <QrCode size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_qr')}</p>
                            <p className="text-2xl font-semibold">{formatCurrency(stats.totalQR)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Inventory Report - Monthly Activity */}
            <Card className="p-8 mb-8 overflow-hidden rounded-[2.5rem]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Reporte Inventario</h2>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Resumen de movimientos del mes seleccionado</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-green-500" />
                             <span className="text-[10px] font-black uppercase text-gray-400">Añadidos</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-red-500" />
                             <span className="text-[10px] font-black uppercase text-gray-400">Vendidos</span>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto -mx-8">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-700">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Inicio</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center font-bold text-green-600">Añadidos</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center font-bold text-red-600">Vendidos</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {inventoryReport.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <p className="font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-primary-600 transition-colors">{item.name}</p>
                                        {item.isCombo && <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">COMBO</span>}
                                    </td>
                                    <td className="px-8 py-4 text-center font-mono font-bold text-gray-500">
                                        {item.isUnlimited ? '∞' : item.initialStock}
                                    </td>
                                    <td className="px-8 py-4 text-center font-mono font-black text-green-600 bg-green-50/30">
                                        {item.added > 0 ? `+${item.added}` : '0'}
                                    </td>
                                    <td className="px-8 py-4 text-center font-mono font-black text-red-500 bg-red-50/30">
                                        {item.soldInPeriod > 0 ? `-${item.soldInPeriod}` : '0'}
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <div className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl font-black font-mono">
                                             {item.isUnlimited ? '∞' : item.remainingStock}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
                {/* 1. Best Selling Products (Including Unlimited) */}
                <Card className="lg:col-span-3 p-5">
                <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Más Vendidos</h2>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#10b981]"></span> Producto</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#8b5cf6]"></span> Combo</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={bestSelling} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128, 128, 128, 0.3)" />
                            <XAxis type="number" tick={{ fill: 'currentColor' }} allowDecimals={false} />
                            <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} tickLine={false} axisLine={false} interval={0} />
                            <Tooltip
                                cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                                contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="quantity" name={t('analytics.units_sold')} radius={[0, 4, 4, 0]} barSize={20}>
                                {bestSelling.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.isCombo ? '#8b5cf6' : '#10b981'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* 2. Order Distribution Pie Chart */}
                <Card className="lg:col-span-2 p-8 rounded-[2.5rem]">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4">Distribución</h2>
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                            <Pie
                                data={orderDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {orderDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* CHART: Last 7 Days Revenue */}
            <div className="grid grid-cols-1 mb-8">
                <Card className="p-8 rounded-[2.5rem]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Ingresos (Últimos 7 Días)</h2>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Solo Ventas Validadas</span>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={last7DaysRevenue}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128, 128, 128, 0.1)" />
                            <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                cursor={{ fill: 'rgba(128, 128, 128, 0.05)' }}
                                contentStyle={{ backgroundColor: '#1f2937', color: '#fff', borderRadius: '1rem', border: 'none', fontWeight: 900 }}
                            />
                            <Bar dataKey="value" fill="url(#colorRevenue)" radius={[10, 10, 0, 0]} barSize={40}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                    </linearGradient>
                                </defs>
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden rounded-[2.5rem] mb-8">
                <div className="p-8 border-b border-gray-100 dark:border-gray-800">
                     <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Resumen Diario</h2>
                     <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Desglose de ingresos por fecha</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ingresos Totales</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pedidos</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ticket Prom.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedDailyData.length > 0 ? paginatedDailyData.map((day) => (
                                <tr key={day.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800">
                                    <td className="px-8 py-4 font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        {day.name}
                                    </td>
                                    <td className="px-8 py-4 text-right font-black text-primary-600 dark:text-primary-400">{formatCurrency(day[t('records.revenue')])}</td>
                                    <td className="px-8 py-4 text-center font-bold text-gray-500">{day.totalOrders}</td>
                                    <td className="px-8 py-4 text-right text-gray-400 font-bold">{formatCurrency(day.avgOrderValue)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No records found for this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Mostrando {((dailySummaryPage - 1) * ROWS_PER_PAGE) + 1} - {Math.min(dailySummaryPage * ROWS_PER_PAGE, dailyChartData.length)} de {dailyChartData.length}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDailySummaryPage(p => Math.max(1, p - 1))}
                                disabled={dailySummaryPage === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="flex items-center px-4 font-semibold text-gray-700 dark:text-gray-300">
                                {dailySummaryPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setDailySummaryPage(p => Math.min(totalPages, p + 1))}
                                disabled={dailySummaryPage === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </Card>
            {/* Cash Closures History */}
            <div className="mb-20">
                <Card className="p-0 overflow-hidden rounded-[2.5rem]">
                    <div className="p-8 border-b border-gray-100 dark:border-gray-800">
                         <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Historial de Cierres de Caja</h2>
                         <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Control de auditoría de cajas del mes</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest font-bold">Iniciada por</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Apertura</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Cierre</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Diferencia</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashRegistersInMonth.length > 0 ? cashRegistersInMonth.slice((cashPager - 1) * ROWS_PER_PAGE, cashPager * ROWS_PER_PAGE).map((cr) => {
                                    const diff = (cr.closingAmount || 0) - (cr.expectedAmount || 0);
                                    return (
                                        <tr key={cr.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800">
                                            <td className="px-8 py-4 font-black text-gray-900 dark:text-white uppercase">
                                                {cr.openedAt ? new Date(cr.openedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '-'}
                                            </td>
                                            <td className="px-8 py-4 font-bold text-gray-600 dark:text-gray-400">
                                                {cr.openedByName}
                                            </td>
                                            <td className="px-8 py-4 text-right font-bold text-gray-400">{formatCurrency(cr.openingAmount)}</td>
                                            <td className="px-8 py-4 text-right font-black text-gray-900 dark:text-white">{cr.status === 'closed' ? formatCurrency(cr.closingAmount || 0) : 'EP'}</td>
                                            <td className={`px-8 py-4 text-right font-black ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {cr.status === 'closed' ? formatCurrency(diff) : '-'}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cr.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {cr.status === 'open' ? 'Abierta' : 'Cerrada'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-10 text-center">
                                            <p className="text-gray-400 font-black uppercase tracking-widest italic">No se encontraron movimientos de caja</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {cashRegistersInMonth.length > ROWS_PER_PAGE && (
                        <div className="flex items-center justify-between p-8 bg-gray-50/50 dark:bg-gray-900/50">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Página {cashPager} de {Math.ceil(cashRegistersInMonth.length / ROWS_PER_PAGE)}</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCashPager(p => Math.max(1, p - 1))}
                                    disabled={cashPager === 1}
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm disabled:opacity-30 border border-gray-100 dark:border-gray-700"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    onClick={() => setCashPager(p => Math.min(Math.ceil(cashRegistersInMonth.length / ROWS_PER_PAGE), p + 1))}
                                    disabled={cashPager === Math.ceil(cashRegistersInMonth.length / ROWS_PER_PAGE)}
                                    className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm disabled:opacity-30 border border-gray-100 dark:border-gray-700"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default TotalRecords;