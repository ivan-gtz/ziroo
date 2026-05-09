
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Plus, Package, Settings, ClipboardList, AlertTriangle, Edit, Check, X, Infinity as InfinityIcon, ShoppingCart, Search } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { UserRole } from '../types';

type InventoryItem = {
    uniqueId: string;
    id: string;
    variationId?: string;
    name: string;
    category: string;
    stock?: number;
    menuItemId: string;
};

const Inventory: React.FC = () => {
    const { t, menuItems, addInventoryStock, setInventoryStock, currentUser, updateMenuItem, categories, addExpense, activeBranch } = useAppContext();

    const [activeTab, setActiveTab] = useState<'receiving' | 'management'>('receiving');
    const [addQuantities, setAddQuantities] = useState<Record<string, string>>({});
    const [inventoryFilter, setInventoryFilter] = useState<'All' | 'Unlimited' | 'Sufficient' | 'Low' | 'Critical'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editStockValue, setEditStockValue] = useState<number | ''>('');

    // Expense Modal State
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

    const isFullAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === UserRole.Admin;
    const canManage = isFullAdmin; // Keeps existing logic for Management tab

    const inventoryList = useMemo((): InventoryItem[] => {
        // Filter out Combos since they do not have independent stock (they subtract from their components)
        const list = menuItems.filter(item => !item.isCombo).flatMap(item => {
            if (item.variations && item.variations.length > 0) {
                return item.variations.map(variation => ({
                    uniqueId: `${item.id}-${variation.id}`,
                    id: item.id,
                    variationId: variation.id,
                    name: `${item.name} (${variation.name})`,
                    category: item.category,
                    stock: variation.stock,
                    menuItemId: item.id,
                }));
            } else {
                return [{
                    uniqueId: item.id,
                    id: item.id,
                    variationId: undefined,
                    name: item.name,
                    category: item.category,
                    stock: item.stock,
                    menuItemId: item.id,
                }];
            }
        });

        // Unified Filtering & Sorting for both tabs
        let filtered = list;

        // 1. Search Filter
        if (searchTerm) {
            filtered = filtered.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // 2. Status Filter
        if (inventoryFilter !== 'All') {
            if (inventoryFilter === 'Unlimited') filtered = filtered.filter(item => item.stock === undefined || item.stock === null);
            if (inventoryFilter === 'Sufficient') filtered = filtered.filter(item => item.stock !== undefined && item.stock !== null && item.stock > 10);
            if (inventoryFilter === 'Low') filtered = filtered.filter(item => item.stock !== undefined && item.stock !== null && item.stock > 5 && item.stock <= 10);
            if (inventoryFilter === 'Critical') filtered = filtered.filter(item => item.stock !== undefined && item.stock !== null && item.stock <= 5);
        }

        // 3. Sorting: Critical (1) -> Low (2) -> Sufficient (3) -> Unlimited (4)
        return filtered.sort((a, b) => {
            const getWeight = (stock: number | undefined) => {
                if (stock === undefined || stock === null) return 4;
                if (stock <= 5) return 1;
                if (stock <= 10) return 2;
                return 3;
            };

            const weightA = getWeight(a.stock);
            const weightB = getWeight(b.stock);

            if (weightA !== weightB) return weightA - weightB;

            // Secondary sort by name
            return a.name.localeCompare(b.name);
        });
    }, [menuItems, inventoryFilter, searchTerm]);

    const handleQuantityChange = (id: string, value: string) => {
        setAddQuantities(prev => ({ ...prev, [id]: value }));
    };

    const handleAddStock = (item: InventoryItem) => {
        const qtyStr = addQuantities[item.uniqueId];
        if (!qtyStr) return;
        const quantity = parseInt(qtyStr, 10);
        if (isNaN(quantity) || quantity <= 0) return;
        addInventoryStock(item.menuItemId, item.variationId, quantity);
        setAddQuantities(prev => {
            const newState = { ...prev };
            delete newState[item.uniqueId];
            return newState;
        });
        alert(`${t('inventory.added_success')} (+${quantity} to ${item.name})`);
    };

    const startEditingStock = (id: string, currentStock: number | undefined) => {
        setEditingStockId(id);
        setEditStockValue(currentStock !== undefined ? currentStock : '');
    };

    const cancelEditingStock = () => {
        setEditingStockId(null);
        setEditStockValue('');
    };

    const saveStockUpdate = (item: InventoryItem) => {
        // 1. Handle Unlimited (Empty String)
        if (editStockValue === '' || editStockValue === null) {
            setInventoryStock(item.menuItemId, item.variationId, null);
            setEditingStockId(null);
            setEditStockValue('');
            return;
        }

        const newStock = Number(editStockValue);
        if (isNaN(newStock)) return;

        // 2. Use setInventoryStock for management tab to ensure absolute values (like 0) are saved
        setInventoryStock(item.menuItemId, item.variationId, newStock);

        setEditingStockId(null);
        setEditStockValue('');
    };

    const handleAddExpense = async () => {
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount) || amount <= 0 || !expenseDescription.trim()) {
            alert("Por favor ingresa un monto válido y una descripción.");
            return;
        }

        setIsSubmittingExpense(true);
        try {
            await addExpense(amount, expenseDescription);
            setIsExpenseModalOpen(false);
            setExpenseAmount('');
            setExpenseDescription('');
            alert(t('inventory.expense_success'));
        } catch (error) {
            console.error(error);
            alert(t('common.error'));
        } finally {
            setIsSubmittingExpense(false);
        }
    };

    const getStockDisplay = (stock: number | undefined | null) => {
        if (stock === undefined || stock === null) return { label: t('menu.stock_unlimited'), colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: <InfinityIcon size={12} className="mr-1" /> };
        if (stock <= 0) return { label: t('orders.sold_out'), colorClass: 'bg-red-600 text-white font-black', icon: <X size={12} className="mr-1" /> };
        if (stock <= 5) return { label: t('menu.stock_critical'), colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: <AlertTriangle size={12} className="mr-1" /> };
        if (stock <= 10) return { label: t('menu.stock_low'), colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <AlertTriangle size={12} className="mr-1" /> };
        return { label: t('menu.stock_sufficient'), colorClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <Check size={12} className="mr-1" /> };
    };

    const getRowColorClass = (stock: number | undefined | null) => {
        if (stock === undefined || stock === null) return 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20';
        if (stock <= 5) return 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20';
        if (stock <= 10) return 'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20';
        return 'bg-green-50/30 dark:bg-green-900/5 hover:bg-green-50/50 dark:hover:bg-green-900/10';
    };

    return (
        <div className="pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Package className="mr-3 text-primary-500" /> {t('sidebar.inventory')}
                </h1>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="primary"
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 border-none flex items-center justify-center gap-2"
                    >
                        <ShoppingCart size={18} />
                        {t('inventory.extra_purchases')}
                    </Button>
                    {canManage && (
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shadow-inner border border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setActiveTab('receiving')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'receiving' ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-md scale-105' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                <Plus size={16} /> {t('inventory.title')}
                            </button>
                            <button
                                onClick={() => setActiveTab('management')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'management' ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-md scale-105' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                <Settings size={16} /> {t('menu.inventory_management')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'receiving' && (
                <Card className="overflow-hidden border-none shadow-lg">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                        {/* Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar productos..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-2">Filtrar:</span>
                            {(['All', 'Critical', 'Low', 'Sufficient', 'Unlimited'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setInventoryFilter(filter)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inventoryFilter === filter
                                        ? 'bg-primary-600 text-white shadow-md'
                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'}`}
                                >
                                    {filter === 'All' ? t('all')
                                        : filter === 'Critical' ? t('menu.stock_critical')
                                            : filter === 'Low' ? t('menu.stock_low')
                                                : filter === 'Sufficient' ? t('menu.stock_sufficient')
                                                    : t('menu.stock_unlimited')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-extrabold">{t('menu.product_name')}</th>
                                    <th className="px-6 py-4 text-center font-extrabold">{t('menu.current_stock')}</th>
                                    <th className="px-6 py-4 text-center font-extrabold w-48">{t('inventory.add')} Stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {inventoryList.map(item => {
                                    const { label, colorClass, icon } = getStockDisplay(item.stock);
                                    return (
                                        <tr key={item.uniqueId} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 relative group`}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white mb-1">{item.name}</span>
                                                    <span className={`inline-flex items-center self-start px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                                                        {icon} {label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-mono font-black text-lg text-gray-900 dark:text-white">
                                                    {(item.stock !== undefined && item.stock !== null) ? item.stock : <InfinityIcon size={20} className="mx-auto text-blue-500" />}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        className="w-20 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-primary-500 transition-all py-2"
                                                        value={addQuantities[item.uniqueId] || ''}
                                                        onChange={(e) => handleQuantityChange(item.uniqueId, e.target.value)}
                                                    />
                                                    <button
                                                        onClick={() => handleAddStock(item)}
                                                        disabled={!addQuantities[item.uniqueId]}
                                                        className={`p-2 rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-30 disabled:grayscale`}
                                                    >
                                                        <Plus size={20} fontWeight="bold" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'management' && canManage && (
                <Card className="overflow-hidden border-none shadow-lg">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                        {/* Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar productos..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-2">Filtrar:</span>
                            {(['All', 'Critical', 'Low', 'Sufficient', 'Unlimited'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setInventoryFilter(filter)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${inventoryFilter === filter
                                        ? 'bg-primary-600 text-white shadow-md'
                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'}`}
                                >
                                    {filter === 'All' ? t('all')
                                        : filter === 'Critical' ? t('menu.stock_critical')
                                            : filter === 'Low' ? t('menu.stock_low')
                                                : filter === 'Sufficient' ? t('menu.stock_sufficient')
                                                    : t('menu.stock_unlimited')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-extrabold">{t('menu.product_name')}</th>
                                    <th className="px-6 py-4 text-center font-extrabold">{t('menu.current_stock')}</th>
                                    <th className="px-6 py-4 text-right font-extrabold">{t('menu.options')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {inventoryList.map(item => {
                                    const { label, colorClass, icon } = getStockDisplay(item.stock);
                                    return (
                                        <tr key={item.uniqueId} className={`transition-colors border-l-4 ${(item.stock === undefined || item.stock === null) ? 'border-blue-500' : item.stock <= 5 ? 'border-red-500' : item.stock <= 10 ? 'border-yellow-500' : 'border-green-500'} ${getRowColorClass(item.stock)}`}>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white text-base mb-1">{item.name}</span>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                                                        {categories.find(c => c.id === item.category)?.name || t('dashboard.unknown_category')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {editingStockId === item.uniqueId ? (
                                                    <input
                                                        type="number"
                                                        value={editStockValue}
                                                        onChange={(e) => setEditStockValue(e.target.value === '' ? '' : Number(e.target.value))}
                                                        className="w-24 p-2 text-center border-2 border-primary-500 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold"
                                                        placeholder="Unl."
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-mono font-black text-xl text-gray-900 dark:text-white">
                                                            {(item.stock !== undefined && item.stock !== null) ? item.stock : <InfinityIcon size={24} className="text-blue-500" />}
                                                        </span>
                                                        <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                                                            {icon} {label}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                {editingStockId === item.uniqueId ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => saveStockUpdate(item)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm">
                                                            <Check size={18} />
                                                        </button>
                                                        <button onClick={cancelEditingStock} className="p-2 bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEditingStock(item.uniqueId, item.stock)} className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all">
                                                        <Edit size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
            {/* Expense Modal */}
            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => !isSubmittingExpense && setIsExpenseModalOpen(false)}
                title={t('inventory.extra_purchases')}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)} disabled={isSubmittingExpense}>
                            {t('menu.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleAddExpense} disabled={isSubmittingExpense} className="bg-orange-500 hover:bg-orange-600">
                            {isSubmittingExpense ? t('customer.processing') : t('menu.save')}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 py-2">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                            {t('inventory.expense_amount')}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{activeBranch?.currency || '$'}</span>
                            <input
                                type="number"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-medium"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                            {t('inventory.expense_description')}
                        </label>
                        <textarea
                            value={expenseDescription}
                            onChange={(e) => setExpenseDescription(e.target.value)}
                            placeholder="Ej: Pan para hamburguesas, 2 cartones de huevos..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-medium"
                        />
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30">
                        <p className="text-xs text-orange-800 dark:text-orange-300 italic">
                            {t('sales.expense_warning') || '* Este gasto se descontará del total de caja del día.'}
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Inventory;
