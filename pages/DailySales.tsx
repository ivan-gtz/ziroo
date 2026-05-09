import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useOrder } from '../context/OrderContext';
import Card from '../components/ui/Card';
import { Order, OrderStatus, PaymentMethod, InventoryTransaction, OrderType, BranchSettings } from '../types';
import { DollarSign, ShoppingCart, QrCode as QrCodeIcon, Printer, Download, Edit, Check, X as XIcon, Wallet, XCircle, Smartphone, Globe, Infinity as InfinityIcon, User as UserIcon, Tag } from 'lucide-react';
import { useReceiptActions } from '../components/PrintingProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { isTodayBolivia } from '../utils/dateUtils';

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6'];

const DailySales: React.FC = () => {
    const { t, orders, formatCurrency, activeBranch, allSettings, allInventoryTransactions, activeBranchId, updateInventoryTransaction, menuItems, currentUser, expenses, fetchOrders, fetchAllInventoryTransactions } = useAppContext();
    const { allCashRegisters } = useOrder();
    const { printReceipt: printBrowser, downloadReceipt, printRawBt } = useReceiptActions();

    // Initial Fetch with Mount Control (Stop Infinite Loop)
    // We retry if activeBranchId was null initially
    const lastFetchedBranchId = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (activeBranchId && lastFetchedBranchId.current !== activeBranchId) {
            console.log(`🚀 Initial fetch for DailySales (Branch: ${activeBranchId})`);
            fetchOrders();
            if (fetchAllInventoryTransactions) fetchAllInventoryTransactions();
            lastFetchedBranchId.current = activeBranchId;
        }
    }, [activeBranchId, fetchOrders, fetchAllInventoryTransactions]);

    const todaysExpenses = useMemo(() => {
        return expenses.filter(e => isTodayBolivia(e.createdAt)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [expenses]);

    const totalExpensesAmount = useMemo(() => {
        return todaysExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
    }, [todaysExpenses]);

    // Inventory Editing State
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState<number | ''>('');
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchOrders ? fetchOrders() : Promise.resolve(),
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

    // Keep this filtered to DELIVERED for calculations (Revenue, Charts, Inventory deductions)
    const todaysOrders = useMemo(() => orders.filter(order =>
        isTodayBolivia(order.timestamp) &&
        order.status !== OrderStatus.Cancelled &&
        order.status !== OrderStatus.AwaitingApproval
    ).sort((a, b) => b.dailyTicketNumber - a.dailyTicketNumber), [orders]);

    const todaysCashRegisters = useMemo(() => {
        return allCashRegisters.filter(cr => isTodayBolivia(cr.openedAt || new Date()));
    }, [allCashRegisters]);

    const cancelledOrdersToday = useMemo(() => orders.filter(order =>
        isTodayBolivia(order.timestamp) && order.status === OrderStatus.Cancelled
    ), [orders]);

    // NEW: Combined list specifically for the Display Table to show both Delivered and Cancelled
    const tableOrders = useMemo(() => {
        return [...todaysOrders, ...cancelledOrdersToday].sort((a, b) => b.dailyTicketNumber - a.dailyTicketNumber);
    }, [todaysOrders, cancelledOrdersToday]);

    // For Inventory Report: We need to count ALL active orders (Pending, Preparing, Ready, Delivered)
    // because stock is deducted immediately upon order creation.
    // If we only count Delivered, the "Initial Stock" calculation (Current + Sold - Added) will be wrong for active oders.
    const todaysInventoryOrders = useMemo(() => {
        return orders.filter(order =>
            isTodayBolivia(order.timestamp) && order.status !== OrderStatus.Cancelled && order.status !== OrderStatus.AwaitingApproval
        );
    }, [orders]);

    const todaysInventoryTransactions = useMemo(() => {
        const transactions = allInventoryTransactions[activeBranchId!] || [];
        // Filter to show ONLY manual additions (Restock). Sales and Returns should not appear here.
        return transactions.filter(tx =>
            isTodayBolivia(tx.timestamp) &&
            tx.type === 'Restock'
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [allInventoryTransactions, activeBranchId]);

    const salesSummary = useMemo(() => {
        return todaysOrders.reduce((acc, order) => {
            let cash = 0;
            let qr = 0;
            const discount = order.discount || 0;
            const dfee = order.deliveryFee || 0;
            const netAmount = (order.totalAmount || 0) - dfee;

            if (order.paymentMethod === PaymentMethod.Cash) {
                cash = netAmount;
            } else if (order.paymentMethod === PaymentMethod.QR) {
                qr = netAmount;
            } else if (order.paymentMethod === PaymentMethod.Combined) {
                // Proportional split for combined payment
                const totalGiven = (order.cashPaid || 0) + (order.qrPaid || 0);
                if (totalGiven > 0) {
                    const cashRatio = (order.cashPaid || 0) / totalGiven;
                    cash = netAmount * cashRatio;
                    qr = netAmount * (1 - cashRatio);
                }
            }

            return {
                totalCash: acc.totalCash + cash,
                totalQR: acc.totalQR + qr,
                totalSales: acc.totalSales + netAmount,
                totalDiscounts: acc.totalDiscounts + discount
            };
        }, { totalCash: 0, totalQR: 0, totalSales: 0, totalDiscounts: 0 });
    }, [todaysOrders]);

    // ... (KPIs remain same)

    const onlineOrdersCount = useMemo(() => {
        return todaysOrders.filter(o =>
            o.source === 'online' || o.waiterName === 'Customer App' // Compatibility with old records
        ).length;
    }, [todaysOrders]);

    const orderTypeDistribution = useMemo(() => {
        const counts = todaysOrders.reduce((acc, order) => {
            acc[order.orderType] = (acc[order.orderType] || 0) + 1;
            return acc;
        }, {} as Record<OrderType, number>);

        return [
            { name: t('orders.dine_in'), value: counts[OrderType.DineIn] || 0 },
            { name: t('orders.takeaway'), value: counts[OrderType.Takeaway] || 0 },
            { name: t('orders.delivery'), value: counts[OrderType.Delivery] || 0 },
        ].filter(item => item.value > 0);
    }, [todaysOrders, t]);

    const inventoryReport = useMemo(() => {
        const inventoryItems: any[] = [];
        const branchId = activeBranchId || '';
        const transactions = allInventoryTransactions[branchId] || [];

        // Create a mapping of UUIDs to composite keys for all products and variations
        // This ensures that combo components (stored by UUID) correctly match the report keys
        const uuidToKey: Record<string, string> = {};
        menuItems.forEach(mi => {
            uuidToKey[mi.id] = mi.id;
            mi.variations?.forEach(v => {
                uuidToKey[v.id] = `${mi.id}-${v.id}`;
            });
        });

        const addedToday: Record<string, number> = {};
        transactions.forEach(tx => {
            if (!isTodayBolivia(tx.timestamp)) return;
            if (tx.type !== 'Restock') return;
            const key = tx.variationId ? `${tx.menuItemId}-${tx.variationId}` : tx.menuItemId;
            addedToday[key] = (addedToday[key] || 0) + (tx.quantity || 0);
        });

        // Track items SOLD from Today's Orders (regardless of final delivery status)
        const soldInOrders: Record<string, number> = {};
        
        // Usar todaysInventoryOrders para asegurar consistencia con lo que resta stock
        todaysInventoryOrders.forEach(order => {
            order.items.forEach(item => {
                const key = item.variation?.id ? `${item.menuItem.id}-${item.variation.id}` : item.menuItem.id;
                soldInOrders[key] = (soldInOrders[key] || 0) + (item.quantity || 0);

                // CONTAR COMPONENTES DE COMBOS (Extras que son productos)
                // Usamos uuidToKey para mapear IDs de variaciones/productos a sus llaves del reporte
                if (item.selectedExtras && item.selectedExtras.length > 0) {
                    item.selectedExtras.forEach(extra => {
                        const extraKey = uuidToKey[extra.id] || extra.id;
                        // El componente se descuenta en la misma cantidad que el combo principal
                        soldInOrders[extraKey] = (soldInOrders[extraKey] || 0) + (item.quantity || 0);
                    });
                }
            });
        });

        menuItems.forEach(item => {
            const processItem = (id: string, name: string, currentStock: number | undefined) => {
                const totalAdded = addedToday[id] || 0;
                const totalSold = soldInOrders[id] || 0;

                // For stock logic: Initial = Current + Sold - Added
                // This formula tells us what we had at the START of the day.
                let initialStock: number | undefined = undefined;
                const isUnlimited = currentStock === undefined || currentStock === null;

                if (!isUnlimited) {
                    initialStock = (currentStock || 0) + totalSold - totalAdded;
                }

                inventoryItems.push({
                    id,
                    name,
                    initialStock,
                    added: totalAdded,
                    soldInPeriod: totalSold,
                    remainingStock: currentStock,
                    isUnlimited,
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
    }, [menuItems, orders, allInventoryTransactions, activeBranchId]);

    const bestSellingToday = useMemo(() => {
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

    const handleReceiptAction = (action: 'print' | 'download' | 'rawbt', order: Order) => {
        const settings = allSettings[activeBranch!.id];
        if (!settings) return;

        const details = { order, settings: settings as BranchSettings };

        if (action === 'print') {
            printBrowser(details);
        } else if (action === 'download') {
            downloadReceipt(details);
        } else if (action === 'rawbt') {
            printRawBt(details);
        }
    };

    const startEditTransaction = (tx: InventoryTransaction) => {
        setEditingTransactionId(tx.id);
        setEditQuantity(tx.quantity);
    };

    const cancelEditTransaction = () => {
        setEditingTransactionId(null);
        setEditQuantity('');
    };

    const saveTransactionUpdate = (tx: InventoryTransaction) => {
        if (editQuantity === '' || isNaN(Number(editQuantity))) return;
        updateInventoryTransaction(tx.id, Number(editQuantity));
        setEditingTransactionId(null);
        setEditQuantity('');
    };

    return (
        <div className="text-gray-900 dark:text-white pb-20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">{t('sales.title')}</h1>
                <div className="flex items-center gap-2 text-sm text-green-500 font-medium bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-100 dark:border-green-800">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Sincronizado en tiempo real
                </div>
            </div>

            {/* KPIs - Adjusted to 3 cols to match TotalRecords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* 1. Total Sales */}
                <Card className="p-5">
                    <div className="flex items-center">
                        <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-500 dark:text-primary-300">
                            <DollarSign size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_sales')}</p>
                            <p className="text-2xl font-semibold">{formatCurrency(salesSummary.totalSales)}</p>
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
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_orders')}</p>
                            <p className="text-2xl font-semibold">{todaysOrders.length}</p>
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
                            <p className="text-2xl font-semibold">{cancelledOrdersToday.length}</p>
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
                            <p className="text-2xl font-semibold">{onlineOrdersCount}</p>
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
                                <p className="text-2xl font-semibold">{formatCurrency(salesSummary.totalCash - totalExpensesAmount)}</p>
                                {totalExpensesAmount > 0 && (
                                    <span className="text-xs text-red-500 font-medium">
                                        ({formatCurrency(salesSummary.totalCash)} - {formatCurrency(totalExpensesAmount)} {t('inventory.extra_purchases')})
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
                            <QrCodeIcon size={24} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('sales.total_qr')}</p>
                            <p className="text-2xl font-semibold">{formatCurrency(salesSummary.totalQR)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Expense & Discount Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <Card className="p-4 border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-900/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center text-orange-700 dark:text-orange-300">
                            <ShoppingCart size={20} className="mr-2" />
                            <span className="font-bold">{t('inventory.extra_purchases')}</span>
                        </div>
                        <span className="text-xl font-bold text-orange-800 dark:text-orange-200">
                            {totalExpensesAmount > 0 ? `-${formatCurrency(totalExpensesAmount)}` : formatCurrency(0)}
                        </span>
                    </div>
                </Card>
                {salesSummary.totalDiscounts > 0 && (
                    <Card className="p-4 border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center text-yellow-700 dark:text-yellow-300">
                                <Tag size={20} className="mr-2" />
                                <span className="font-bold">{t('sales.total_discounts')}</span>
                            </div>
                            <span className="text-xl font-bold text-yellow-800 dark:text-yellow-200">-{formatCurrency(salesSummary.totalDiscounts)}</span>
                        </div>
                    </Card>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Order Distribution */}
                <Card className="p-5">
                    <h2 className="text-xl font-semibold mb-4">{t('analytics.order_distribution')}</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={orderTypeDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {orderTypeDistribution.map((entry, index) => (
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

                {/* Best Selling Products Chart (New) */}
                <Card className="p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">{t('analytics.best_selling')} ({t('dashboard.today')})</h2>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#10b981]"></span> Producto</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#8b5cf6]"></span> Combo</span>
                        </div>
                    </div>
                    {bestSellingToday.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={bestSellingToday} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                                    {bestSellingToday.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isCombo ? '#8b5cf6' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            No sales data yet.
                        </div>
                    )}
                </Card>
            </div>

            {/* Inventory Report Table */}
            <div className="mb-8">
                <Card className="p-5">
                    <h2 className="text-xl font-semibold mb-4">{t('analytics.inventory_report')}</h2>
                    <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('menu.product_name')}</th>
                                    <th scope="col" className="px-6 py-3 text-center">{t('analytics.initial_stock')}</th>
                                    <th scope="col" className="px-6 py-3 text-center text-green-600">Añadidos</th>
                                    <th scope="col" className="px-6 py-3 text-center !text-red-600 font-bold tracking-wider">Vendidos (Hoy)</th>
                                    <th scope="col" className="px-6 py-3 text-center font-bold">{t('analytics.remaining_stock')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventoryReport.map((item) => (
                                    <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono">
                                            {item.isUnlimited ? <InfinityIcon size={16} className="mx-auto" /> : item.initialStock}
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono font-bold text-green-600">+{item.added}</td>
                                        <td className="px-6 py-4 text-center font-mono font-bold text-red-500">-{item.soldInPeriod >= 0 ? item.soldInPeriod : 0}</td>
                                        <td className="px-6 py-4 text-center font-mono font-extrabold text-primary-600 dark:text-primary-400">
                                            {item.isUnlimited ? <InfinityIcon size={16} className="mx-auto" /> : item.remainingStock}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Orders Table */}
                <Card>
                    <h2 className="text-xl font-semibold p-5 border-b dark:border-gray-700">{t('sales.todays_orders')}</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('sales.order_id')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.time')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.user')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.payment')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('sales.amount')}</th>
                                    <th scope="col" className="px-6 py-3 text-center">{t('sales.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableOrders.length > 0 ? tableOrders.map((order) => {
                                    const isCancelled = order.status === OrderStatus.Cancelled;
                                    return (
                                        <tr key={order.id} className={`border-b dark:border-gray-700 transition-colors ${isCancelled ? 'bg-red-50 dark:bg-red-900/30' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                #{order.dailyTicketNumber}
                                                {isCancelled && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">Cancelado</span>}
                                            </td>
                                            <td className="px-6 py-4">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="px-6 py-4 flex items-center gap-2">
                                                <UserIcon size={14} className="text-gray-400" />
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{order.waiterName || 'Sistema'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.paymentMethod === PaymentMethod.Combined
                                                    ? t('orders.combined')
                                                    : order.paymentMethod === PaymentMethod.QR ? 'QR' : t('orders.cash')}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                                                {formatCurrency((order.totalAmount || 0) - (order.deliveryFee || 0))}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {!isCancelled ? (
                                                    <div className="flex justify-center space-x-2">
                                                        <button
                                                            onClick={() => handleReceiptAction('rawbt', order)}
                                                            className="p-1.5 text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                                                            title={t('sales.print_bt')}
                                                        >
                                                            <Smartphone size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReceiptAction('print', order)}
                                                            className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                                                            title={t('sales.print_browser')}
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReceiptAction('download', order)}
                                                            className="p-1.5 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
                                                            title={t('sales.download_png')}
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                }) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center">{t('monitor.no_active_orders')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Inventory Logs */}
                <Card>
                    <h2 className="text-xl font-semibold p-5 border-b dark:border-gray-700">{t('sales.inventory_entries_today')}</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('orders.item')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.time')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.user')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('orders.qty')}</th>
                                    <th scope="col" className="px-6 py-3 text-center">{t('sales.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todaysInventoryTransactions.length > 0 ? todaysInventoryTransactions.map((tx) => (
                                    <tr key={tx.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                            {tx.itemName}
                                        </td>
                                        <td className="px-6 py-4">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4">{tx.userName}</td>
                                        <td className="px-6 py-4 text-right">
                                            {editingTransactionId === tx.id ? (
                                                <input
                                                    type="number"
                                                    className="w-20 p-1 text-right border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                                                    value={editQuantity}
                                                    onChange={(e) => setEditQuantity(parseInt(e.target.value) || '')}
                                                />
                                            ) : (
                                                <span className={`font-bold ${tx.quantity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.quantity >= 0 ? `+${tx.quantity}` : tx.quantity}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {editingTransactionId === tx.id ? (
                                                <div className="flex justify-center space-x-2">
                                                    <button onClick={() => saveTransactionUpdate(tx)} className="text-green-500 hover:text-green-700"><Check size={18} /></button>
                                                    <button onClick={cancelEditTransaction} className="text-red-500 hover:text-red-700"><XIcon size={18} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEditTransaction(tx)} className="text-gray-500 hover:text-blue-500 transition-colors">
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                            No inventory added today.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Expenses Table (New) */}
            <div className="mt-8">
                <Card>
                    <h2 className="text-xl font-semibold p-5 border-b dark:border-gray-700 text-orange-600 flex items-center gap-2">
                        <ShoppingCart size={20} />
                        {t('inventory.extra_purchases')} (Hoy)
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('orders.description')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.time')}</th>
                                    <th scope="col" className="px-6 py-3">{t('sales.user')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('sales.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todaysExpenses.length > 0 ? todaysExpenses.map((expense) => (
                                    <tr key={expense.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                            {expense.description}
                                        </td>
                                        <td className="px-6 py-4">{new Date(expense.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <UserIcon size={14} className="text-gray-400" />
                                                {expense.createdBy}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-red-500">
                                            -{formatCurrency(expense.amount)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                            No se han registrado gastos hoy.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {todaysExpenses.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold">
                                        <td colSpan={3} className="px-6 py-4 text-right">{t('sales.total_expenses') || 'Total Gastos'}</td>
                                        <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">{formatCurrency(totalExpensesAmount)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </Card>
            </div>
            {/* Cash Closures Table (New) */}
            <div className="mb-8">
                <Card>
                    <h2 className="text-xl font-semibold p-5 border-b dark:border-gray-700">Cierres de Caja de Hoy</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Iniciada por</th>
                                    <th scope="col" className="px-6 py-3">Apertura</th>
                                    <th scope="col" className="px-6 py-3">Apertura (Monto)</th>
                                    <th scope="col" className="px-6 py-3">Cierre (Monto)</th>
                                    <th scope="col" className="px-6 py-3">Esperado</th>
                                    <th scope="col" className="px-6 py-3">Diferencia</th>
                                    <th scope="col" className="px-6 py-3">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todaysCashRegisters.length > 0 ? todaysCashRegisters.map((cr) => {
                                    const diff = cr.difference || 0;
                                    return (
                                        <tr key={cr.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                {cr.openedByName}
                                            </td>
                                            <td className="px-6 py-4">
                                                {cr.openedAt ? new Date(cr.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-6 py-4">{formatCurrency(cr.openingAmount)}</td>
                                            <td className="px-6 py-4">{cr.status === 'closed' ? formatCurrency(cr.closingAmount || 0) : '-'}</td>
                                            <td className="px-6 py-4">{cr.status === 'closed' ? formatCurrency(cr.expectedAmount || 0) : '-'}</td>
                                            <td className={`px-6 py-4 font-bold ${diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                {cr.status === 'closed' ? formatCurrency(diff) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${cr.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {cr.status === 'open' ? 'Abierta' : 'Cerrada'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center">No hay registros de caja hoy.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DailySales;