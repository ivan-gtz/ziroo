
import React, { useState, useMemo, useEffect } from 'react';
import {
    TrendingUp,
    DollarSign,
    Globe,
    Calendar,
    ChevronDown,
    ChevronRight,
    Calculator,
    Clock,
    ShieldCheck,
    Settings,
    Edit3,
    CheckCircle2,
    ShieldAlert,
    LayoutGrid,
    BarChart as BarChartIcon,
    DollarSign as MoneyIcon,
    Database,
    Zap,
    AlertTriangle,
    Image as ImageIcon
} from 'lucide-react';
import { 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';
import UsageMonitor from './UsageMonitor';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { UserRole, Order, ManagedRestaurant, MonthlySummary } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { isTodayBolivia } from '../utils/dateUtils';

// Extended type for our view
interface SubscriptionConfig {
    basic: number;
    complete: number;
    pro: number;
    premium: number;
    onlineOrderFee: number;
    currencySymbol: string;
}

const Earnings: React.FC = () => {
    const {
        managedRestaurants,
        branches,
        allOrders,
        allMonthlySummaries,
        currentUser,
        t,
        fetchAllSystemOrders,
        fetchAllGlobalSummaries,
        updateManagedRestaurant
    } = useAppContext();

    // 1. Subscription Costs State (Local for now)
    const [costs, setCosts] = useState<SubscriptionConfig>({
        basic: 30,
        complete: 50,
        pro: 80,
        premium: 100,
        onlineOrderFee: 0.20,
        currencySymbol: '$'
    });

    // 2. State for Modals and Selection
    const [expandedRest, setExpandedRest] = useState<Record<string, boolean>>({});
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showOnlineModal, setShowOnlineModal] = useState(false); // NEW
    const [selectedRest, setSelectedRest] = useState<ManagedRestaurant | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'usage'>('overview');

    // Month Selector State
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Form States for Config Modal
    const [editType, setEditType] = useState<ManagedRestaurant['type']>('Basic');
    const [editTrialStart, setEditTrialStart] = useState<string>('');
    const [editTrialEnd, setEditTrialEnd] = useState<string>('');
    const [editSubEnd, setEditSubEnd] = useState<string>('');

    // New Form States for Payment & Custom Overrides
    const [editCustomPlanPrice, setEditCustomPlanPrice] = useState<string>('');
    const [editCustomOnlineFee, setEditCustomOnlineFee] = useState<string>('');
    const [editCurrencySymbol, setEditCurrencySymbol] = useState<string>('');
    const [editLastCommPaid, setEditLastCommPaid] = useState<string>('');
    const [editIsTrialActive, setEditIsTrialActive] = useState<boolean>(false);

    // Initial fetch for Earnings table (monthly aggregation)
    const hasFetchedGlobal = React.useRef(false);

    useEffect(() => {
        if (currentUser?.role === 'SuperAdmin' && !hasFetchedGlobal.current) {
            console.log("🚀 Earnings: Fetching global orders & monthly summaries for all branches");
            fetchAllSystemOrders();
            fetchAllGlobalSummaries(); // ✅ Load all branch summaries for General & Ranking tabs
            hasFetchedGlobal.current = true;
        }
    }, [currentUser?.role, fetchAllSystemOrders, fetchAllGlobalSummaries]);

    // Fetch global config - Separate effect to avoid re-fetching when orders change (prevents input overwrite)
    useEffect(() => {
        if (currentUser?.role === 'SuperAdmin') {
            supabase.from('system_settings').select('value').eq('key', 'subscription_config').single()
                .then(({ data }) => {
                    if (data?.value) {
                        setCosts(data.value);
                    }
                });
        }
    }, [currentUser?.id]); // Only re-run if user changes, not on every order update

    // Local Helper to format currency regardless of branch context, using System or Custom symbol
    const formatSystemCurrency = (amount: number, symbolOverride?: string) => {
        const symbol = symbolOverride || costs.currencySymbol || '$';
        const locale = typeof navigator !== 'undefined' ? navigator.language : 'es-ES';
        const formattedAmount = new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
        return `${symbol} ${formattedAmount}`;
    };

    const toggleExpand = (id: string) => {
        setExpandedRest(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleOpenConfigModal = (rest: ManagedRestaurant) => {
        setSelectedRest(rest);
        setEditType(rest.type || 'Basic');

        // Helper to safe format date for input (YYYY-MM-DD)
        const safeDate = (dateStr?: string) => {
            if (!dateStr) return '';
            try {
                return dateStr.split('T')[0];
            } catch (e) {
                return '';
            }
        };

        setEditTrialStart(safeDate(rest.trialStartDate) || safeDate(rest.startDate) || new Date().toISOString().split('T')[0]);
        setEditTrialEnd(safeDate(rest.trialEndDate));
        setEditSubEnd(safeDate(rest.endDate));

        // Custom Overrides
        setEditCustomPlanPrice(rest.customPlanPrice?.toString() || '');
        setEditCustomOnlineFee(rest.customOnlineFee?.toString() || '');
        setEditCurrencySymbol(rest.currencySymbol || '');
        setEditLastCommPaid(rest.lastCommissionPayment || '');
        setEditIsTrialActive(!!rest.isTrialActive);

        setShowConfigModal(true);
    };

    const handleOpenOnlineModal = (rest: ManagedRestaurant) => {
        setSelectedRest(rest);
        setEditLastCommPaid(rest.lastCommissionPayment || '');
        setShowOnlineModal(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedRest) return;

        // 1. Update Restaurant (Parent)
        await updateManagedRestaurant(selectedRest.id, {
            type: editType,
            trialStartDate: editTrialStart,
            trialEndDate: editTrialEnd,
            endDate: editSubEnd,
            customPlanPrice: editCustomPlanPrice ? parseFloat(editCustomPlanPrice) : undefined,
            customOnlineFee: editCustomOnlineFee ? parseFloat(editCustomOnlineFee) : undefined,
            currencySymbol: editCurrencySymbol || undefined,
            lastCommissionPayment: editLastCommPaid || undefined,
            isTrialActive: editIsTrialActive
        });



        setShowConfigModal(false);
    };

    /**
     * PDF REPORT GENERATION
     */
    const generateMonthPDF = () => {
        // Dynamic import to avoid SSR issues if any, though standard import works in SPA
        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(({ default: autoTable }) => {
                const doc = new jsPDF();
                const now = new Date();
                const targetDate = new Date(selectedYear, selectedMonth);
                const locale = typeof navigator !== 'undefined' ? navigator.language : 'es-ES';
                const monthName = targetDate.toLocaleString(locale, { month: 'long', year: 'numeric' });

                // Header
                doc.setFontSize(20);
                doc.setTextColor(40, 40, 40);
                doc.text(`Reporte de Ganancias Ziroo chef - ${monthName.toUpperCase()}`, 14, 22);

                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Generado el: ${now.toLocaleString()}`, 14, 30);

                // Table Data
                const tableData = restaurantData.map(r => [
                    r.name.toUpperCase(),
                    r.branches.length,
                    r.planTypeLabel,
                    formatSystemCurrency(r.currentPlanPrice, r.activeCurrencySymbol), // Subscription
                    r.aggCountMonth, // Online Orders Count
                    formatSystemCurrency(r.totalMonth - (r.isTrial ? 0 : r.currentPlanPrice), r.activeCurrencySymbol), // Online Commission (Approx: TotalMonth - Sub)
                    formatSystemCurrency(r.totalMonth, r.activeCurrencySymbol) // Total
                ]);

                // Calculate Totals
                const totalSystem = restaurantData.reduce((sum, r) => sum + r.totalMonth, 0);

                (autoTable as any)(doc, {
                    startY: 35,
                    head: [['Restaurante', 'Sucs', 'Plan', 'Suscripción', 'Pedidos Online', 'Comisión Online', 'Total Mes']],
                    body: tableData,
                    foot: [['TOTALES', '', '', '', '', '', formatSystemCurrency(totalSystem)]],
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 196, 15], textColor: 40, fontStyle: 'bold' },
                    styles: { fontSize: 8, cellPadding: 3 },
                    columnStyles: {
                        0: { fontStyle: 'bold' },
                        6: { fontStyle: 'bold', halign: 'right' }
                    }
                });

                doc.save(`Ziroo_chef_Ganancias_${monthName.replace(/\s/g, '_')}.pdf`);
            });
        });
    };

    const handleSaveOnlinePaymentState = async (updates: Partial<ManagedRestaurant>) => {
        if (!selectedRest) return;

        // Optimistic Update
        setSelectedRest(prev => prev ? ({ ...prev, ...updates }) : null);

        await updateManagedRestaurant(selectedRest.id, updates);
    };

    const toggleDayPaid = async (dateStr: string, isCurrentlyPaid: boolean) => {
        if (!selectedRest) return;
        const currentPaidDates = selectedRest.commissionPaidDates || [];
        let newPaidDates;

        if (isCurrentlyPaid) {
            newPaidDates = currentPaidDates.filter(d => d !== dateStr);
        } else {
            newPaidDates = [...currentPaidDates, dateStr];
        }

        await handleSaveOnlinePaymentState({ commissionPaidDates: newPaidDates });
    };

    const markAllPaidToday = async () => {
        if (!selectedRest) return;
        // Clean logic: Just update the "Paid Up To" date to today. 
        // We keep the `commissionPaidDates` array for granular history or exceptions if needed, but "Paid Up To" is the main bulk tool.
        // However, the user asked for individual marking to be persisted.
        // Let's assume hitting "mark all" just adds the last 7 days (or currently visible days) to the array to be safe?
        // No, the "Paid Up To" (lastCommissionPayment) is still the best for "Done until now".
        // The modal shows GREEN if (date <= lastCommissionPayment) OR (date in commissionPaidDates).
        // So hitting "Mark All" updates lastCommissionPayment.

        const today = new Date().toISOString().split('T')[0];
        await handleSaveOnlinePaymentState({ lastCommissionPayment: today });
    };

    /**
     * LOGIC TO CALCULATE EARNINGS (ZIROO PROFIT)
     */
    const restaurantData = useMemo(() => {
        if (!managedRestaurants || !allOrders) return [];

        // Flatten allOrders from Record<string, Order[]> to Order[] — safe against null/undefined
        const flattenedOrders = (allOrders ? Object.values(allOrders) : []).flat() as Order[];

        return managedRestaurants.map(rest => {
            const actualBranches = branches.filter(b => b.restaurantId === rest.id || b.id === rest.id);
            const hasMain = actualBranches.some(b => b.id === rest.id) || actualBranches.some(b => b.name.toLowerCase().includes('principal'));
            
            const restBranches = [
                ...(!hasMain ? [{ id: rest.id, name: 'Principal', restaurantId: rest.id, isApproved: true }] : []),
                ...actualBranches
            ];
            const now = new Date();
            const targetMonth = selectedMonth;
            const targetYear = selectedYear;

            // Unified Trial logic
            const monthStart = new Date(targetYear, targetMonth, 1);
            const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

            let isTrial = false;
            if (rest.isTrialActive) {
                const trialStart = rest.trialStartDate ? new Date(rest.trialStartDate) : null;
                const trialEnd = rest.trialEndDate ? new Date(rest.trialEndDate) : null;

                if (trialStart && trialEnd) {
                    trialEnd.setHours(23, 59, 59, 999);
                    // Overlap check: trial end >= month start AND trial start <= month end
                    isTrial = trialEnd >= monthStart && trialStart <= monthEnd;
                } else {
                    isTrial = true; // If active but no dates, assume it's trial
                }
            }

            // Expiration logic (Global)
            const isExpired = !isTrial && rest.endDate ? new Date() > new Date(rest.endDate) : false;

            // Price mapping (Priority: Custom > Config)
            let subPrice = 0;
            if (rest.customPlanPrice !== undefined && rest.customPlanPrice !== null) {
                subPrice = rest.customPlanPrice;
            } else {
                const restType = rest.type?.toLowerCase() || 'basic';
                if (restType.includes('basic')) subPrice = costs.basic;
                else if (restType.includes('complete') || restType.includes('completo')) subPrice = costs.complete;
                else if (restType.includes('pro')) subPrice = costs.pro;
                else if (restType.includes('premium')) subPrice = costs.premium;
                else if (restType.includes('full')) subPrice = costs.complete;
            }

            // Online Fee mapping (Priority: Custom > Config)
            const onlineFee = (rest.customOnlineFee !== undefined && rest.customOnlineFee !== null)
                ? rest.customOnlineFee
                : costs.onlineOrderFee;

            // Currency Symbol Mapping
            const currencySym = rest.currencySymbol || costs.currencySymbol || '$';

            // STRICTLY MONTHLY CALCULATION
            // totalMonthZiroo is only for the selected month
            // totalOverallZiroo is now also ONLY for the selected month as per user request

            // DATA SOURCE DECISION & SNAPSHOT EXTRACTION
            const isCurrentMonth = targetMonth === now.getMonth() && targetYear === now.getFullYear();
            
            let activeSubPrice = subPrice;
            let activeOnlineFee = onlineFee;

            if (!isCurrentMonth) {
                // Try to find ANY branch that has a monthSummary to pull the exact subscription at that time
                const anyBranchWithSummary = restBranches.find(b => {
                    const bs: any[] = (allMonthlySummaries as any)[b.id] || [];
                    return bs.find(s => s.month === targetMonth && s.year === targetYear);
                });
                
                if (anyBranchWithSummary) {
                    const bs: any[] = (allMonthlySummaries as any)[anyBranchWithSummary.id] || [];
                    const ms = bs.find(s => s.month === targetMonth && s.year === targetYear);
                    if (ms && ms.ziroo_subscription_snapshot !== undefined && ms.ziroo_subscription_snapshot !== null) {
                        activeSubPrice = Number(ms.ziroo_subscription_snapshot);
                    }
                    if (ms && ms.ziroo_online_fee_snapshot !== undefined && ms.ziroo_online_fee_snapshot !== null) {
                        activeOnlineFee = Number(ms.ziroo_online_fee_snapshot);
                    }
                }
            }

            const branchDetails = restBranches.map(branch => {
                const branchOrders = flattenedOrders.filter(o => o.branchId === branch.id);
                
                const branchSummaries: MonthlySummary[] = (allMonthlySummaries as any)[branch.id] || [];
                const monthSummary = branchSummaries.find(s => s.month === targetMonth && s.year === targetYear);

                const onlineOrdersTotal = branchOrders.filter(o =>
                    o.source === 'online' || o.waiterName === 'Customer App' || o.source === 'CustomerMenu'
                );

                const onlineOrdersToday = onlineOrdersTotal.filter(o => isTodayBolivia(o.timestamp) && o.status !== 'Cancelled');
                
                // Fallback to summary for month count if historical
                let countMonthValue = 0;
                let monthProfitValue = 0;

                if (isCurrentMonth) {
                    const onlineOrdersMonth = onlineOrdersTotal.filter(o => {
                        const d = new Date(o.timestamp);
                        return d.getMonth() === targetMonth && d.getFullYear() === targetYear && o.status !== 'Cancelled';
                    });
                    countMonthValue = onlineOrdersMonth.length;
                    monthProfitValue = countMonthValue * activeOnlineFee;
                } else if (monthSummary) {
                    // Try to use DB snapshot
                    if ((monthSummary as any).ziroo_online_orders_count !== undefined && (monthSummary as any).ziroo_online_orders_count !== null) {
                        countMonthValue = Number((monthSummary as any).ziroo_online_orders_count);
                        monthProfitValue = countMonthValue * activeOnlineFee;
                    } else {
                        // Fallback safely for ultra-old records before patch
                        countMonthValue = 0; 
                        monthProfitValue = 0; 
                    }
                }

                const dailyCommission = isTrial ? 0 : onlineOrdersToday.length * activeOnlineFee;
                const monthlyCommission = isTrial ? 0 : monthProfitValue;
                const totalCommission = isTrial ? 0 : onlineOrdersTotal.filter(o => o.status !== 'Cancelled').length * activeOnlineFee;

                return {
                    id: branch.id,
                    name: branch.name,
                    onlineOrdersCount: onlineOrdersTotal.length,
                    // Metrics for Pill
                    countToday: onlineOrdersToday.length,
                    countMonth: countMonthValue,

                    onlineOrdersList: onlineOrdersTotal,
                    dailyProfit: dailyCommission,
                    monthlyProfit: monthlyCommission,
                    totalProfit: totalCommission
                };
            });


            // Re-aggregate counts for the parent row
            const totalOnlineOrders = branchDetails.reduce((sum, b) => sum + b.onlineOrdersCount, 0); // All time

            // New aggregations for display
            const aggCountToday = branchDetails.reduce((sum, b) => sum + b.countToday, 0);
            const aggCountMonth = branchDetails.reduce((sum, b) => sum + b.countMonth, 0);

            const totalDailyZiroo = branchDetails.reduce((sum, b) => sum + b.dailyProfit, 0);
            const totalMonthZiroo = (isTrial ? 0 : activeSubPrice) + branchDetails.reduce((sum, b) => sum + b.monthlyProfit, 0);
            // Updated: Overall profit is now strictly the selected monthly total as requested
            const totalOverallZiroo = totalMonthZiroo;

            // Collect all online orders for the modal
            const allOnlineOrders = branchDetails.flatMap(b => b.onlineOrdersList);

            return {
                ...rest,
                branches: branchDetails,
                totalOnlineOrders,
                aggCountToday,
                aggCountMonth,
                allOnlineOrders,
                totalDaily: totalDailyZiroo,
                totalMonth: totalMonthZiroo,
                totalOverall: totalOverallZiroo,
                isTrial,
                isExpired,
                planTypeLabel: rest.type || 'Básico',
                currentPlanPrice: activeSubPrice, // Return the active snapshot price so the table displays historically accurate pricing
                currentOnlineFee: activeOnlineFee,
                activeCurrencySymbol: currencySym
            };
        });
    }, [managedRestaurants, branches, allOrders, costs, selectedMonth, selectedYear]);

    const performanceData = useMemo(() => {
        if (!restaurantData) return [];

        const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();
        const flattenedOrders = (allOrders ? Object.values(allOrders) : []).flat() as Order[];

        return restaurantData.flatMap(rest => {
            return rest.branches.map(branch => {
                // 1: Try monthly summaries first (covers all branches globally)
                const branchSummaries = allMonthlySummaries[branch.id] || [];
                const monthSummary = branchSummaries.find(s => s.month === selectedMonth && s.year === selectedYear);

                // 2: For the current month, also get live order data for today's totals
                const branchLiveOrders = isCurrentMonth
                    ? flattenedOrders.filter(o =>
                        o.branchId === branch.id &&
                        (o.status as string) !== 'Cancelled' &&
                        new Date(o.timestamp).getMonth() === selectedMonth &&
                        new Date(o.timestamp).getFullYear() === selectedYear
                      )
                    : [];

                // 3: Merge: prefer live data for current month if available, else use summary
                const totalEarnings = branchLiveOrders.length > 0
                    ? branchLiveOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                    : (monthSummary?.totalSales || 0);

                // Order count: try live data first, fall back to summary averageTicket estimate
                const totalOrders = branchLiveOrders.length > 0
                    ? branchLiveOrders.length
                    : (monthSummary && monthSummary.averageTicket > 0
                        ? Math.round(monthSummary.totalSales / monthSummary.averageTicket)
                        : 0);

                const ordersWithPrepTime = branchLiveOrders.filter(o => o.timestamp && o.readyTime);
                const totalPrepTimeMs = ordersWithPrepTime.reduce((sum, o) => {
                    const start = new Date(o.timestamp).getTime();
                    const end = new Date(o.readyTime!).getTime();
                    return sum + (end - start);
                }, 0);
                const avgPrepTimeMs = ordersWithPrepTime.length > 0 ? totalPrepTimeMs / ordersWithPrepTime.length : 0;

                return {
                    id: branch.id,
                    name: branch.name,
                    restaurantName: rest.name,
                    totalOrders,
                    totalEarnings,
                    avgPrepTimeMs,
                    currencySymbol: rest.activeCurrencySymbol,
                    planType: rest.type || 'Full',
                    hasSummaryData: !!monthSummary,
                    hasLiveData: branchLiveOrders.length > 0
                };
            });
        })
        .filter(item => item.totalOrders > 0 || item.totalEarnings > 0) // Mostrar si tiene datos
        .sort((a, b) => b.totalEarnings - a.totalEarnings || b.totalOrders - a.totalOrders);
    }, [restaurantData, allOrders, allMonthlySummaries, branches, selectedMonth, selectedYear]);

    const formatPrepTime = (ms: number) => {
        if (!ms || ms <= 0) return '—';
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}m ${secs}s`;
    };

    // Data for Online Orders Modal (Last 7 Days)
    const onlineOrdersModalData = useMemo(() => {
        if (!selectedRest) return [];

        const fee = selectedRest.customOnlineFee ?? costs.onlineOrderFee;
        const lastPaymentDate = selectedRest.lastCommissionPayment ? new Date(selectedRest.lastCommissionPayment) : null;
        if (lastPaymentDate) lastPaymentDate.setHours(23, 59, 59, 999);

        // Generate last 7 days
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);

            const dateStr = d.toISOString().split('T')[0];

            const dayOrders = selectedRest.allOnlineOrders?.filter((o) => {
                const od = new Date(o.timestamp);
                if (isNaN(od.getTime())) return false; // Robust check for invalid dates
                
                // Normalize od to start of day for comparison
                const odNorm = new Date(od);
                odNorm.setHours(0, 0, 0, 0);

                return odNorm.getTime() === d.getTime() && o.status !== 'Cancelled';
            }) || [];

            // Check paid status
            // Logic: Paid if Date <= LastPaymentDate OR Date is in commissionPaidDates array
            let isPaid = false;

            const isIndividuallyPaid = selectedRest.commissionPaidDates?.includes(dateStr);
            const isBulkPaid = lastPaymentDate ? d.getTime() <= lastPaymentDate.getTime() : false;

            isPaid = isIndividuallyPaid || isBulkPaid;

            days.push({
                date: d,
                dateStr,
                count: dayOrders.length,
                total: dayOrders.length * fee,
                isPaid
            });
        }
        return days;
    }, [selectedRest, costs]);

    if (currentUser?.role !== 'SuperAdmin') {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4">
                <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Acceso Restringido</h2>
                <p className="text-gray-600 dark:text-gray-400">Esta página es exclusiva para el Super Admin de Ziroo chef.</p>
            </div>
        );
    }

    return (
        <div className="p-2 lg:p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-primary-600 rounded-3xl shadow-lg shadow-primary-200 dark:shadow-none">
                        <TrendingUp className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Historial de <span className="text-primary-600 italic">Ventas</span>
                            <span className="ml-4 text-xl text-gray-400 font-bold uppercase">/ {new Date(selectedYear, selectedMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                        </h1>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={14} className="text-green-500" /> Super Admin Control Panel
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Tab Navigation */}
                    <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 mr-4">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <LayoutGrid size={16} />
                            GENERAL
                        </button>
                        <button
                            onClick={() => setActiveTab('performance')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'performance' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <BarChartIcon size={16} />
                            RANKING
                        </button>
                        <button
                            onClick={() => setActiveTab('usage')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'usage' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Database size={16} />
                            RECURSOS
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-0 outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>
                                    {new Date(2000, i).toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-300 focus:ring-0 outline-none"
                        >
                            {Array.from({ length: 5 }, (_, i) => {
                                const y = new Date().getFullYear() - 2 + i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>

                    <Button
                        onClick={generateMonthPDF}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl px-6 py-4 shadow-lg shadow-red-200 dark:shadow-none font-bold transition-all h-full"
                    >
                        <Calendar size={18} />
                        Descargar Reporte ({new Date(selectedYear, selectedMonth).toLocaleString('es-ES', { month: 'long' }).toUpperCase()})
                    </Button>
                    <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Ziroo chef Balance</p>
                        <p className="text-3xl font-black text-primary-600 dark:text-primary-400">
                            {formatSystemCurrency(restaurantData.reduce((sum, r) => sum + r.totalOverall, 0))}
                        </p>
                    </div>
                </div>
            </div>

            {activeTab === 'usage' ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <UsageMonitor />
                </div>
            ) : activeTab === 'overview' ? (
                <>
                    {/* Global Pricing Config */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Settings size={20} className="text-gray-400" />
                                Configuración Global de Suscripción
                            </h3>
                            <Button
                                onClick={async () => {
                                    try {
                                        const { error } = await supabase
                                            .from('system_settings')
                                            .upsert(
                                                {
                                                    key: 'subscription_config',
                                                    value: costs
                                                },
                                                { onConflict: 'key' }
                                            );

                                        if (error) throw error;
                                        alert('Configuración global guardada correctamente');
                                    } catch (err: any) {
                                        alert('Error guardando configuración: ' + err.message);
                                    }
                                }}
                                className="rounded-xl px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:shadow-lg transition-all"
                            >
                                Guardar Configuración Global
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { key: 'basic', label: 'Básico', color: 'bg-blue-500', icon: Calculator },
                                { key: 'complete', label: 'Completo', color: 'bg-emerald-500', icon: Globe },
                                { key: 'pro', label: 'Pro', color: 'bg-indigo-500', icon: TrendingUp },
                                { key: 'premium', label: 'Premium', color: 'bg-amber-500', icon: ShieldCheck },
                                { key: 'onlineOrderFee', label: 'Costo Online', color: 'bg-rose-500', icon: Globe, isFee: true },
                                { key: 'currencySymbol', label: 'Moneda Global', color: 'bg-gray-500', icon: MoneyIcon, isText: true }
                            ].map((item) => (
                                <div key={item.key} className="group bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-primary-200 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 rounded-2xl ${item.color} text-white shadow-lg shadow-gray-200 dark:shadow-none`}>
                                            <item.icon size={18} />
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!item.isText && (
                                            <span className="text-gray-400 font-black text-xl shrink-0">
                                                {costs.currencySymbol}
                                            </span>
                                        )}
                                        <input
                                            type={item.isText ? "text" : "number"}
                                            value={(costs as any)[item.key]}
                                            onChange={(e) => setCosts({ ...costs, [item.key]: item.isText ? e.target.value : (parseFloat(e.target.value) || 0) })}
                                            className={`w-full bg-transparent border-none text-2xl font-black text-gray-900 dark:text-white focus:ring-0 outline-none p-0 ${item.isText ? 'text-center' : ''}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Data Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-gray-900/50">
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Restaurante / ID</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fin Suscripción</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Sucursales</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Pedidos Online (Mes)</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Plan / Precio</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">G. Diaria</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">G. Mes</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Total Cobrado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {restaurantData.map((rest, index) => (
                                        <React.Fragment key={rest.id}>
                                            <tr className={`group transition-all duration-300 border-l-4 
                                                ${rest.isExpired
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-l-red-500 hover:bg-red-100'
                                                    : rest.isTrial
                                                        ? 'bg-amber-100/50 dark:bg-amber-900/20 border-l-amber-500 hover:bg-amber-100/70'
                                                        : 'border-l-transparent hover:bg-primary-50/30 dark:hover:bg-primary-900/10'} transition-all`}>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => toggleExpand(rest.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            {expandedRest[rest.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                        <div>
                                                            <p className="text-[10px] font-black text-primary-500 uppercase flex items-center gap-1">
                                                                #{BigInt('0x' + rest.id.slice(0, 4)).toString().slice(-4)}
                                                            </p>
                                                            <p className="font-black text-gray-900 dark:text-white tracking-tight">{rest.name}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => handleOpenConfigModal(rest as any)}
                                                        className="flex flex-col items-start gap-1 p-2 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-all border border-transparent hover:border-gray-200"
                                                    >
                                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-bold text-xs">
                                                            <Calendar size={12} />
                                                            {rest.endDate ? new Date(rest.endDate).toLocaleDateString() : '—'}
                                                        </div>
                                                        {rest.isTrial && (
                                                            <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Trial Mode</span>
                                                        )}
                                                    </button>
                                                </td>

                                                <td className="px-8 py-6 text-center">
                                                    <span className="text-sm font-black text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 w-10 h-10 inline-flex items-center justify-center rounded-full">
                                                        {rest.branches.length}
                                                    </span>
                                                </td>

                                                <td className="px-8 py-6 text-center">
                                                    <button
                                                        onClick={() => handleOpenOnlineModal(rest as any)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-xs hover:scale-105 transition-transform"
                                                    >
                                                        <Globe size={14} />
                                                        <div className="flex flex-col items-start leading-none">
                                                            <span>{rest.aggCountMonth} <span className="text-[8px] opacity-70">MES</span></span>
                                                            {rest.aggCountToday > 0 && (
                                                                <span className="text-[8px] text-green-600 dark:text-green-400 font-black">+{rest.aggCountToday} HOY</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                </td>

                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => handleOpenConfigModal(rest as any)}
                                                        className={`group flex items-center justify-between w-full max-w-[140px] px-4 py-2 rounded-2xl border-2 transition-all 
                                                        ${rest.isExpired
                                                                ? 'bg-red-100 text-red-700 border-red-200'
                                                                : rest.isTrial
                                                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                                    : 'bg-green-100 text-green-700 border-green-200'} `}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {rest.isExpired ? <ShieldAlert size={12} /> : rest.isTrial ? <Clock size={12} /> : <ShieldCheck size={12} />}
                                                            <span className="font-black text-[10px] uppercase">
                                                                {rest.isExpired ? 'Vencido' : rest.isTrial ? 'Trial' : rest.planTypeLabel}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-xs opacity-60">{formatSystemCurrency(rest.currentPlanPrice, rest.activeCurrencySymbol)}</span>
                                                    </button>
                                                </td>

                                                <td className="px-8 py-6 text-right font-black text-gray-900 dark:text-white">
                                                    {formatSystemCurrency(rest.totalDaily, rest.activeCurrencySymbol)}
                                                </td>

                                                <td className="px-8 py-6 text-right font-black text-gray-900 dark:text-white">
                                                    {formatSystemCurrency(rest.totalMonth, rest.activeCurrencySymbol)}
                                                </td>

                                                <td className="px-8 py-6 text-right">
                                                    <div className="inline-block bg-primary-600 text-white px-5 py-2.5 rounded-2xl font-black text-sm shadow-lg shadow-primary-200 dark:shadow-none">
                                                        {formatSystemCurrency(rest.totalOverall, rest.activeCurrencySymbol)}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Branches List */}
                                            {expandedRest[rest.id] && rest.branches.map((branch, bIdx) => (
                                                <tr key={branch.id} className="bg-gray-50/50 dark:bg-gray-900/30 text-gray-500 dark:text-gray-400">
                                                    <td className="px-8 py-4 pl-24">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-10 bg-primary-200 dark:bg-primary-800 rounded-full" />
                                                            <p className="font-bold text-xs uppercase tracking-tight">{branch.name}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4">—</td>
                                                    <td className="px-8 py-4 text-center">—</td>
                                                    <td className="px-8 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-500/80">
                                                            <Globe size={12} />
                                                            {branch.countMonth}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4">—</td>
                                                    <td className="px-8 py-4 text-right font-bold text-gray-500/80 italic">{formatSystemCurrency(branch.dailyProfit, rest.activeCurrencySymbol)}</td>
                                                    <td className="px-8 py-4 text-right text-[10px] font-bold">{formatSystemCurrency(branch.monthlyProfit, rest.activeCurrencySymbol)}</td>
                                                    <td className="px-8 py-4 text-right font-black text-gray-600/60">{formatSystemCurrency(branch.totalProfit, rest.activeCurrencySymbol)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                    Ranking de Ventas — {new Date(selectedYear, selectedMonth).toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </h2>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Todas las sucursales · Ordenado por ventas netas</p>
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl">
                                <BarChartIcon className="text-primary-600" size={24} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            {performanceData.map((item, index) => {
                                const maxEarnings = performanceData[0]?.totalEarnings || 1;
                                const percentage = (item.totalEarnings / maxEarnings) * 100;

                                return (
                                    <div key={item.id} className="relative group">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg ${index === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-400/20' : index === 1 ? 'bg-gray-100 text-gray-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">{item.name}</h4>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.totalOrders} pedidos · {item.hasLiveData ? 'Datos en vivo' : item.hasSummaryData ? 'Resumen mensual' : 'Sin datos'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                                                        {item.totalOrders}
                                                    </p>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedidos</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-gray-900 dark:text-white">
                                                        {formatSystemCurrency(item.totalEarnings, item.currencySymbol)}
                                                    </p>
                                                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Ventas Netas</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ease-out border-r-2 border-white/20 
                                                ${index === 0 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' : index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 'bg-gradient-to-r from-primary-400 to-primary-600'}`}
                                                style={{ width: `${Math.max(percentage, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {performanceData.length === 0 && (
                                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    <MoneyIcon className="mx-auto text-gray-300 mb-4" size={48} />
                                    <p className="text-gray-500 font-bold uppercase tracking-widest italic">Sin datos de ventas para el mes seleccionado.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal (Unified: Plan, Trial, Subscription + Overrides) */}
            <Modal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                title={`Gestión de Restaurante: ${selectedRest?.name}`}
            >
                <div className="space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar p-1">

                    {/* Section 1: Plan Type Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={14} className="text-primary-500" /> Seleccionar Plan
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Basic', 'Complete', 'Pro', 'Premium'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setEditType(type as any)}
                                    className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all group
                                    ${editType === type
                                            ? 'bg-primary-600 border-primary-400 text-white shadow-lg'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-200'} `}
                                >
                                    {editType === type && <CheckCircle2 className="absolute top-3 right-3 text-white" size={16} />}
                                    <span className="font-black text-sm mb-1">{type}</span>
                                    <span className={`text-[10px] font-bold ${editType === type ? 'text-white/80' : 'text-gray-400'}`}>
                                        {formatSystemCurrency((costs as any)[type.toLowerCase()] || 0)}/mes
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: Trial Configuration */}
                    <div className={`p-6 rounded-[2rem] border-2 transition-all space-y-4 ${editIsTrialActive ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className={editIsTrialActive ? "text-amber-600" : "text-gray-400"} size={20} />
                                <h4 className={`font-black text-sm uppercase ${editIsTrialActive ? "text-amber-900 dark:text-amber-400" : "text-gray-500"}`}>
                                    Versión de Prueba / Gratis
                                </h4>
                            </div>
                            <button
                                onClick={() => setEditIsTrialActive(!editIsTrialActive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${editIsTrialActive ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editIsTrialActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {editIsTrialActive && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-amber-700/60 uppercase ml-1">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={editTrialStart}
                                        onChange={(e) => setEditTrialStart(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800 rounded-2xl text-sm font-bold p-3 text-amber-900 dark:text-amber-400"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-amber-700/60 uppercase ml-1">Fecha Fin</label>
                                    <input
                                        type="date"
                                        value={editTrialEnd}
                                        onChange={(e) => setEditTrialEnd(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800 rounded-2xl text-sm font-bold p-3 text-amber-900 dark:text-amber-400"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Pricing Overrides (Custom) */}
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Settings className="text-blue-600" size={20} />
                            <h4 className="font-black text-blue-900 dark:text-blue-400 text-sm uppercase">Personalización & Tarifas</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-blue-700/60 uppercase ml-1">Precio Plan (Override)</label>
                                <input
                                    type="number"
                                    placeholder="Default"
                                    value={editCustomPlanPrice}
                                    onChange={(e) => setEditCustomPlanPrice(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 rounded-2xl text-sm font-bold p-3 text-blue-900 dark:text-blue-400"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-blue-700/60 uppercase ml-1">Fee Online Pedido</label>
                                <input
                                    type="number"
                                    placeholder="Default (0.20)"
                                    value={editCustomOnlineFee}
                                    onChange={(e) => setEditCustomOnlineFee(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 rounded-2xl text-sm font-bold p-3 text-blue-900 dark:text-blue-400"
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-black text-blue-700/60 uppercase ml-1">Símbolo Moneda Local (ej. Bs, $)</label>
                                <input
                                    type="text"
                                    placeholder="Default ($)"
                                    value={editCurrencySymbol}
                                    onChange={(e) => setEditCurrencySymbol(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 rounded-2xl text-sm font-bold p-3 text-blue-900 dark:text-blue-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Subscription End Date */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 font-bold">
                            <Calendar size={14} className="text-blue-500" /> Próximo Vencimiento
                        </label>
                        <input
                            type="date"
                            value={editSubEnd}
                            onChange={(e) => setEditSubEnd(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 rounded-2xl font-bold p-4 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button variant="outline" onClick={() => setShowConfigModal(false)} className="flex-1 rounded-2xl py-4 font-black">
                            CANCELAR
                        </Button>
                        <Button onClick={handleSaveConfig} className="flex-1 rounded-2xl py-4 font-black shadow-xl shadow-primary-200/50">
                            GUARDAR CAMBIOS
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Online Orders Payment Modal */}
            <Modal
                isOpen={showOnlineModal}
                onClose={() => setShowOnlineModal(false)}
                title={`Comisiones Online: ${selectedRest?.name}`}
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-black">Cobrado Hasta</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {editLastCommPaid ? new Date(editLastCommPaid).toLocaleDateString() : '—'}
                            </p>
                        </div>
                        <Button
                            onClick={markAllPaidToday}
                            className="text-xs px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold"
                        >
                            Marcar Todo Pagado Hoy
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Últimos 7 Días</h4>
                        <div className="space-y-2">
                            {onlineOrdersModalData.map((day, i) => (
                                <button
                                    key={i}
                                    onClick={() => toggleDayPaid(day.dateStr, day.isPaid)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full border-2 transition-all ${day.isPaid ? 'bg-green-500 border-green-500' : 'bg-transparent border-red-500 group-hover:bg-red-500/20'}`} />
                                        <div className="flex flex-col items-start">
                                            <span className="text-xs font-bold text-gray-900 dark:text-gray-300">
                                                {day.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase ${day.isPaid ? 'text-green-600' : 'text-red-500'}`}>
                                                {day.isPaid ? 'PAGADO' : 'PENDIENTE'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white">{day.count} pedidos</p>
                                        <p className="text-xs text-primary-500 font-black">
                                            {formatSystemCurrency(day.total, selectedRest?.activeCurrencySymbol)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button variant="outline" onClick={() => setShowOnlineModal(false)} className="flex-1 rounded-2xl py-4 font-black">
                            CERRAR
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Earnings;
