
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, GitFork, DollarSign, ShoppingCart, Clock, Lock, Globe, Calendar } from 'lucide-react';
import { Order, OrderStatus, UserRole } from '../types';
import { supabase } from '../services/supabase';

const Branches: React.FC = () => {
    const { t, branches, addBranch, deleteBranch, allSettings, setActiveBranchId, currentUser } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');

    // State to track selected date for EACH branch (Super Admin feature)
    const [branchDates, setBranchDates] = useState<Record<string, string>>({});

    interface BranchStats {
        salesToday: number;
        ordersToday: number;
        onlineOrders: number;
        targetDateStr: string;
    }
    const [branchStatsMap, setBranchStatsMap] = useState<Record<string, BranchStats>>({});
    const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});

    const navigate = useNavigate();

    const canManage = useMemo(() => currentUser?.role === 'SuperAdmin' || currentUser?.role === UserRole.Admin, [currentUser]);
    const isSuperAdmin = currentUser?.role === 'SuperAdmin';

    const handleCreateBranch = (e: React.FormEvent) => {
        e.preventDefault();
        if (newBranchName.trim() && canManage) {
            addBranch(newBranchName.trim());
            setNewBranchName('');
            setIsModalOpen(false);
        }
    };

    useEffect(() => {
        if (!branches.length) return;

        branches.forEach(async (branch) => {
            const branchId = branch.id;
            const branchTimezone = allSettings[branchId]?.timezone || 'America/La_Paz';
            
            let todayStr;
            try {
                todayStr = new Intl.DateTimeFormat('en-CA', {
                    timeZone: branchTimezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(new Date());
            } catch (e) {
                todayStr = new Date().toLocaleDateString('en-CA');
            }

            const targetDateStr = branchDates[branchId] || todayStr;

            setLoadingStats(prev => ({ ...prev, [branchId]: true }));
            try {
                const { data, error } = await supabase.rpc('get_branch_daily_stats_v2', {
                    p_branch_id: branchId,
                    p_target_date: targetDateStr,
                    p_timezone: branchTimezone
                });
                
                if (!error && data && data.length > 0) {
                    setBranchStatsMap(prev => ({
                        ...prev,
                        [branchId]: {
                            salesToday: Number(data[0].sales_today) || 0,
                            ordersToday: Number(data[0].orders_today) || 0,
                            onlineOrders: Number(data[0].online_orders) || 0,
                            targetDateStr
                        }
                    }));
                } else {
                    setBranchStatsMap(prev => ({
                        ...prev,
                        [branchId]: { salesToday: 0, ordersToday: 0, onlineOrders: 0, targetDateStr }
                    }));
                }
            } catch (e) {
                console.error("Error al obtener stats:", e);
                setBranchStatsMap(prev => ({
                    ...prev,
                    [branchId]: { salesToday: 0, ordersToday: 0, onlineOrders: 0, targetDateStr }
                }));
            } finally {
                setLoadingStats(prev => ({ ...prev, [branchId]: false }));
            }
        });
    }, [branches, branchDates, allSettings]);

    const handleDateChange = (branchId: string, date: string) => {
        setBranchDates(prev => ({ ...prev, [branchId]: date }));
    };

    const handleViewDashboard = (branchId: string) => {
        setActiveBranchId(branchId);
        navigate('/');
    };

    const handleDeleteBranch = async (branchId: string, isReject: boolean = false) => {
        const msg = isReject
            ? "¿Seguro que deseas RECHAZAR esta sucursal? Se eliminarán todos sus datos."
            : "¿Seguro que deseas ELIMINAR esta sucursal? Esta acción es permanente y eliminará órdenes, configuraciones y datos vinculados.";

        if (confirm(msg)) {
            await deleteBranch(branchId);
        }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                    <GitFork className="mr-3" /> {t('branches.title')}
                </h1>
                {canManage && (
                    <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto flex justify-center items-center">
                        <Plus size={16} className="mr-2" />
                        {t('branches.create')}
                    </Button>
                )}
            </div>

            {branches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {branches.map(branch => {
                        const stats = branchStatsMap[branch.id] || { salesToday: 0, ordersToday: 0, onlineOrders: 0, targetDateStr: branchDates[branch.id] || '' };
                        const isLoading = loadingStats[branch.id];
                        const currency = allSettings[branch.id]?.currency || '$';
                        const formatBranchCurrency = (amount: number) => `${currency} ${amount.toFixed(2)}`;
                        const isApproved = branch.isApproved;

                        return (
                            <Card key={branch.id} className={`p-5 flex flex-col justify-between relative ${!isApproved ? 'opacity-80 border-2 border-yellow-400' : ''}`}>
                                {!isApproved && (
                                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg flex items-center">
                                        <Clock size={12} className="mr-1" /> {t('branches.status_pending')}
                                    </div>
                                )}
                                {isApproved && (
                                    <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                                        {t('branches.status_approved')}
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-4">{branch.name}</h2>
                                    {!isApproved && (
                                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-medium bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                                            {t('branches.approval_needed_desc')}
                                        </p>
                                    )}

                                    {/* Date Picker for Super Admin */}
                                    {isSuperAdmin && (
                                        <div className="mt-3 mb-2 flex items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                                            <Calendar size={16} className="text-gray-500 mr-2" />
                                            <input
                                                type="date"
                                                value={stats.targetDateStr}
                                                onChange={(e) => handleDateChange(branch.id, e.target.value)}
                                                className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-0 w-full"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <DollarSign size={16} className="mr-2 text-green-500" />
                                            <span>{t('branches.total_sales_today')}:</span>
                                            {isLoading ? (
                                                <span className="ml-auto animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-16 rounded"></span>
                                            ) : (
                                                <span className="font-semibold ml-auto">{formatBranchCurrency(stats.salesToday)}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <ShoppingCart size={16} className="mr-2 text-blue-500" />
                                            <span>{t('branches.orders_today')}:</span>
                                            {isLoading ? (
                                                <span className="ml-auto animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-10 rounded"></span>
                                            ) : (
                                                <span className="font-semibold ml-auto">{stats.ordersToday}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <Globe size={16} className="mr-2 text-cyan-500" />
                                            <span>{t('sales.online_orders')}:</span>
                                            {isLoading ? (
                                                <span className="ml-auto animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-10 rounded"></span>
                                            ) : (
                                                <span className="font-semibold ml-auto">{stats.onlineOrders}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-between items-center">
                                    {(isSuperAdmin || (canManage && isApproved && branches.length > 1)) && (
                                        <button
                                            onClick={() => handleDeleteBranch(branch.id, !isApproved)}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium underline px-1 py-1"
                                        >
                                            {isApproved ? t('branches.delete') : (isSuperAdmin ? t('branches.reject') : t('branches.cancel_request'))}
                                        </button>
                                    )}

                                    <div className="flex gap-2 ml-auto">
                                        {isApproved ? (
                                            <Button size="sm" onClick={() => handleViewDashboard(branch.id)}>
                                                {t('branches.view_dashboard')}
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="secondary" disabled className="cursor-not-allowed opacity-60">
                                                <Lock size={14} className="mr-2" /> {t('branches.approval_needed')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <GitFork size={48} className="mx-auto text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">{t('branches.no_branches')}</h3>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={t('branches.create')}
            >
                <form onSubmit={handleCreateBranch}>
                    <label htmlFor="branchName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('branches.new_name')}
                    </label>
                    <input
                        type="text"
                        id="branchName"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                    <div className="mt-4 flex justify-end space-x-2">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t('menu.cancel')}
                        </Button>
                        <Button type="submit">{t('branches.create')}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Branches;
