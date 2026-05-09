import React, { useState, useMemo, useEffect, useRef, ChangeEvent } from 'react';
// Layout Refreshed: WaiterOrder Desktop Grid + Persistent Cart + Fixed Checkout (FIXED DUPLICATE)
import { useAppContext } from '../context/AppContext';
import { useOrder } from '../context/OrderContext';
import { MenuItem, OrderItem, OrderStatus, OrderType, PaymentMethod, Order, MenuItemVariation, UserRole, ProductExtra } from '../types';
import { ShoppingCart, Wallet, QrCode, X, Search, Printer, Download, Plus, Minus, Clock, AlertTriangle, Smartphone, Check, Upload, FileText, Utensils, DollarSign, ShoppingBag, Infinity as InfinityIcon, BellRing, Truck } from 'lucide-react';
import { playSound } from '../utils/notifications';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Receipt from '../components/receipt/Receipt';
import KitchenReceipt from '../components/receipt/KitchenReceipt';
import { useReceiptActions } from '../components/PrintingProvider';
import { compressImage, compressImageToBlob } from '../lib/imageUtils';
import { supabase } from '../services/supabase';

// Variation Selection Modal Component
const VariationSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    menuItem: MenuItem;
    onAddToOrder: (items: OrderItem[]) => void;
    t: (key: string) => string;
    formatCurrency: (val: number) => string;
    menuItems: MenuItem[];
}> = ({ isOpen, onClose, menuItem, onAddToOrder, t, formatCurrency, menuItems }) => {
    const [variationQuantities, setVariationQuantities] = useState<Record<string, number>>({});
    const [selectedExtrasIds, setSelectedExtrasIds] = useState<string[]>([]); // Keep for single items fallback
    const [variationExtras, setVariationExtras] = useState<Record<string, string[]>>({});
    const [comboSelections, setComboSelections] = useState<{ itemId: string, variationId?: string }[]>([]);
    const [comboQuantities, setComboQuantities] = useState<number>(1);

    const handleQuantityChange = (variation: MenuItemVariation, change: number) => {
        setVariationQuantities(prev => {
            const currentQty = prev[variation.id] || 0;
            let newQty = Math.max(0, currentQty + change);
            if (variation.stock != null) {
                newQty = Math.min(newQty, variation.stock);
            }
            return { ...prev, [variation.id]: newQty };
        });
    };

    const handleConfirm = () => {
        const itemsToAdd: OrderItem[] = [];

        if (menuItem.isCombo) {
            // Combo selection validation
            if (comboSelections.length === 0) return;

            // Resolve main product and variation
            const mainProduct = menuItems.find(mi => mi.id === menuItem.mainProductId);
            const mainVar = (menuItem.mainVariantId && mainProduct?.variations)
                ? mainProduct.variations.find(v => v.id === menuItem.mainVariantId)
                : undefined;

            // Construct selections from Main Dish + Complements
            const allSelections: ProductExtra[] = [];

            // 1. Add Main Dish as an extra for stock and display
            if (mainProduct) {
                allSelections.push({
                    id: mainVar ? mainVar.id : mainProduct.id,
                    name: mainVar ? `${mainProduct.name} (${mainVar.name})` : mainProduct.name,
                    price: 0
                });
            }

            // 2. Add Complements with their variations
            comboSelections.forEach(sel => {
                const compItem = menuItems.find(i => i.id === sel.itemId);
                if (compItem) {
                    const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
                    allSelections.push({
                        id: compVar ? compVar.id : compItem.id,
                        name: compVar ? `${compItem.name} (${compVar.name})` : compItem.name,
                        price: 0
                    });
                }
            });

            // 3. STOCK VALIDATION: CHECK ALL COMPONENTS
            // Main Product
            if (mainProduct) {
                const mainStock = mainVar ? mainVar.stock : mainProduct.stock;
                if (mainStock !== undefined && mainStock !== null && comboQuantities > mainStock) {
                    alert(`${t('menu.stock_low') || "Stock insuficiente para"} ${mainProduct.name}. Disponible: ${mainStock}`);
                    return;
                }
            }

            // Complements
            for (const sel of comboSelections) {
                const compItem = menuItems.find(i => i.id === sel.itemId);
                if (compItem) {
                    const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
                    const compStock = compVar ? compVar.stock : compItem.stock;
                    if (compStock !== undefined && compStock !== null && comboQuantities > compStock) {
                        alert(`${t('menu.stock_low') || "Stock insuficiente para"} ${compVar ? `${compItem.name} (${compVar.name})` : compItem.name}. Disponible: ${compStock}`);
                        return;
                    }
                }
            }

            itemsToAdd.push({
                menuItem: menuItem,
                quantity: comboQuantities,
                variation: undefined,
                selectedExtras: allSelections.length > 0 ? allSelections : undefined
            });
        } else {
            // Variations logic
            for (const variation of menuItem.variations || []) {
                const quantity = variationQuantities[variation.id];
                if (quantity > 0) {
                    // Get selected IDs for this specific variation
                    const selectedIds = variationExtras[variation.id] || [];

                    // Resolve extra objects. Prioritize variation-specific extras, fallback to main item extras
                    const pool = [...(variation.extras || []), ...(menuItem.extras || [])];
                    const uniquePool = Array.from(new Map(pool.map(item => [item.id, item])).values());

                    const selectedExtras = uniquePool.filter(e => selectedIds.includes(e.id));

                    itemsToAdd.push({
                        menuItem: menuItem,
                        quantity: quantity,
                        variation: variation,
                        selectedExtras: selectedExtras.length > 0 ? selectedExtras : undefined
                    });
                }
            }

            // If no variations but was opened (means it has extras), handle single item add
            if (Object.keys(variationQuantities).length === 0 && (menuItem.variations?.length || 0) === 0) {
                const selectedExtras = (menuItem.extras || []).filter(e => selectedExtrasIds.includes(e.id));
                itemsToAdd.push({
                    menuItem: menuItem,
                    quantity: 1,
                    selectedExtras: selectedExtras.length > 0 ? selectedExtras : undefined
                });
            }
        }

        onAddToOrder(itemsToAdd);
        onClose();
        setVariationQuantities({});
        setSelectedExtrasIds([]);
        setVariationExtras({});
        setComboSelections([]);
        setComboQuantities(1);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={menuItem.isCombo ? `Arma tu Combo: ${menuItem.name}` : `${(menuItem.variations?.length || 0) > 0 ? t('orders.select_variations') : 'Personalizar'} - ${menuItem.name} `}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                {/* ----------------- COMBO RENDERING ----------------- */}
                {menuItem.isCombo && (
                    <div className="space-y-6">
                        {/* Main Product Display */}
                        <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                            <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase mb-2">Plato Principal</h4>
                            {(() => {
                                const mainItem = menuItems.find(i => i.id === menuItem.mainProductId);
                                if (!mainItem) return <p className="text-red-500">Producto principal no encontrado.</p>;

                                const mainVar = menuItem.mainVariantId
                                    ? mainItem.variations?.find(v => v.id === menuItem.mainVariantId)
                                    : null;

                                const displayName = mainVar ? `${mainItem.name} (${mainVar.name})` : mainItem.name;
                                const displayImg = mainVar?.image || mainItem.image;

                                // Stock Check Logic
                                const stock = mainVar ? mainVar.stock : mainItem.stock;
                                const isOutOfStock = stock !== undefined && stock !== null && stock <= 0;

                                if (isOutOfStock) return (
                                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded text-center font-bold">
                                        AGOTADO
                                    </div>
                                );

                                return (
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                                            {displayImg ? (
                                                <img src={displayImg} className="w-full h-full object-cover" />
                                            ) : <Utensils className="m-auto mt-4 text-gray-400" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={12} /> Incluido</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Complements Selection */}
                        <div>
                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                                <Plus size={16} className="text-primary-500" /> Elige tu acompañamiento (1)
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                                {(menuItem.comboItems || []).map(itemId => {
                                    const item = menuItems.find(i => i.id === itemId);
                                    if (!item) return null;

                                    const hasVariations = item.variations && item.variations.length > 0;
                                    const isItemSelected = comboSelections.some(s => s.itemId === item.id);

                                    return (
                                        <div key={item.id} className="space-y-2">
                                            {/* Item Header / Selector */}
                                            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isItemSelected ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'} cursor-pointer hover:border-primary-300`}>
                                                <input
                                                    type="radio"
                                                    name="combo_complement"
                                                    checked={isItemSelected}
                                                    onChange={() => {
                                                        if (!hasVariations) {
                                                            setComboSelections([{ itemId: item.id }]);
                                                        } else {
                                                            setComboSelections([{ itemId: item.id, variationId: item.variations![0].id }]);
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                                                />
                                                <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
                                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Utensils className="p-2 text-gray-300" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.name}</p>
                                                    {item.stock !== undefined && item.stock !== null && !hasVariations && (
                                                        <span className={`text-[10px] font-bold ${item.stock <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                            {item.stock > 0 ? `${item.stock} disponibles` : 'AGOTADO'}
                                                        </span>
                                                    )}
                                                </div>
                                            </label>

                                            {/* Variations sub-list if item is selected */}
                                            {isItemSelected && hasVariations && (
                                                <div className="ml-8 grid grid-cols-1 gap-1.5 animate-fade-in">
                                                    {item.variations?.map(v => {
                                                        const isVarSelected = comboSelections.some(s => s.itemId === item.id && s.variationId === v.id);
                                                        const isVarOutOfStock = v.stock !== undefined && v.stock !== null && v.stock <= 0;

                                                        return (
                                                            <label key={v.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isVarSelected ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-400' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'} ${isVarOutOfStock ? 'opacity-50 grayscale' : 'cursor-pointer'}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="radio"
                                                                        name={`var_${item.id}`}
                                                                        disabled={isVarOutOfStock}
                                                                        checked={isVarSelected}
                                                                        onChange={() => setComboSelections([{ itemId: item.id, variationId: v.id }])}
                                                                        className="w-4 h-4 text-primary-600"
                                                                    />
                                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{v.name}</span>
                                                                </div>
                                                                {v.stock !== undefined && v.stock !== null && (
                                                                    <span className={`text-[10px] font-bold ${v.stock <= 0 ? 'text-red-500' : 'text-primary-600'}`}>
                                                                        {v.stock > 0 ? `${v.stock} disp.` : 'AGOTADO'}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Combo Quantity and Add */}
                        <div className="pt-4 border-t dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-bold text-gray-700 dark:text-gray-300">Cantidad:</span>
                                <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
                                    <button onClick={() => setComboQuantities(Math.max(1, comboQuantities - 1))} className="p-1 text-gray-600 dark:text-gray-400"><Minus size={18} /></button>
                                    <span className="font-bold w-6 text-center text-gray-900 dark:text-white">{comboQuantities}</span>
                                    <button onClick={() => {
                                        // 1. Check Main Item Stock
                                        const mainProduct = menuItems.find(mi => mi.id === menuItem.mainProductId);
                                        if (mainProduct) {
                                            const mainVar = menuItem.mainVariantId ? mainProduct.variations?.find(v => v.id === menuItem.mainVariantId) : null;
                                            const stock = mainVar ? mainVar.stock : mainProduct.stock;
                                            if (stock !== undefined && stock !== null && comboQuantities + 1 > stock) {
                                                alert(`${t('menu.stock_low') || "Stock insuficiente para"} ${mainProduct.name}. Disponible: ${stock}`);
                                                return;
                                            }
                                        }

                                        // 2. Check Complement Stock
                                        for (const sel of comboSelections) {
                                            const compItem = menuItems.find(i => i.id === sel.itemId);
                                            if (compItem) {
                                                const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
                                                const compStock = compVar ? compVar.stock : compItem.stock;
                                                if (compStock !== undefined && compStock !== null && comboQuantities + 1 > compStock) {
                                                    alert(`${t('menu.stock_low') || "Stock insuficiente para"} ${compVar ? `${compItem.name} (${compVar.name})` : compItem.name}. Disponible: ${compStock}`);
                                                    return;
                                                }
                                            }
                                        }
                                        setComboQuantities(comboQuantities + 1);
                                    }} className="p-1 text-gray-600 dark:text-gray-400"><Plus size={18} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Extras Section for Main Item (Only if no variations) */}
                {!menuItem.isCombo && (menuItem.variations?.length || 0) === 0 && menuItem.extras && menuItem.extras.length > 0 && (
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                        <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-3">
                            {t('menu.extras') || 'Extras'}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                            {menuItem.extras.map(extra => (
                                <label key={extra.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg border border-transparent shadow-sm cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedExtrasIds.includes(extra.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedExtrasIds(prev => [...prev, extra.id]);
                                                else setSelectedExtrasIds(prev => prev.filter(id => id !== extra.id));
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{extra.name}</span>
                                    </div>
                                    <span className="text-xs font-extrabold text-primary-600">+{formatCurrency(extra.price)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Variations Section with Integrated Extras */}
                {!menuItem.isCombo && (menuItem.variations || []).map(variation => {
                    const quantity = variationQuantities[variation.id] || 0;
                    const isOutOfStock = variation.stock != null && variation.stock <= 0;
                    const canAddMore = variation.stock == null || quantity < variation.stock;
                    const price = variation.price !== undefined ? variation.price : menuItem.price;

                    // Determine available extras: Specific to variation OR inherited from main item
                    const availableExtras = (variation.extras && variation.extras.length > 0) ? variation.extras : menuItem.extras;
                    const myExtras = variationExtras[variation.id] || [];
                    const isSelected = quantity > 0;

                    return (
                        <div key={variation.id} className="flex flex-col gap-2 mb-2 p-1">
                            <div
                                className={`flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border ${isSelected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-600'} ${!isOutOfStock ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50'} transition-all`}
                                onClick={() => !isOutOfStock && canAddMore && handleQuantityChange(variation, 1)}
                            >
                                <div className="flex-1">
                                    <span className="font-bold text-gray-900 dark:text-white">{variation.name}</span>
                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300 font-medium">{formatCurrency(price)}</span>
                                    <span className={`ml-2 text-xs font-bold ${isOutOfStock ? 'text-red-500' : variation.stock != null && variation.stock < 10 ? 'text-red-500' : variation.stock != null ? 'text-green-600' : 'text-blue-500'} `}>
                                        {isOutOfStock ? `(${t('orders.sold_out')})` : variation.stock != null ? `(${variation.stock} ${t('orders.stock_available')})` : <InfinityIcon size={14} className="inline mb-0.5" />}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 ml-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleQuantityChange(variation, -1); }}
                                        className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-bold flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-50 disabled:opacity-50 transition-all font-mono active:scale-95 touch-manipulation"
                                        disabled={quantity === 0 || isOutOfStock}
                                    >
                                        -
                                    </button>
                                    <span className="w-6 text-center font-bold text-lg text-gray-900 dark:text-white">{quantity}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleQuantityChange(variation, 1); }}
                                        className="h-9 w-9 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center shadow-sm hover:bg-primary-700 disabled:bg-gray-400 transition-all font-mono active:scale-95 touch-manipulation"
                                        disabled={isOutOfStock || !canAddMore}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {isSelected && availableExtras && availableExtras.length > 0 && (
                                <div className="ml-0 sm:ml-4 mr-0 sm:mr-2 bg-white dark:bg-gray-800 p-3 rounded-lg border-l-4 border-primary-500 shadow-sm text-sm mt-1">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Extras ({variation.name})</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {availableExtras.map(ex => {
                                            const isChecked = myExtras.includes(ex.id);
                                            return (
                                                <label key={ex.id} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 transition-all active:scale-[0.98] touch-manipulation">
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setVariationExtras(prev => {
                                                                    const current = prev[variation.id] || [];
                                                                    const updated = checked
                                                                        ? [...current, ex.id]
                                                                        : current.filter(id => id !== ex.id);
                                                                    return { ...prev, [variation.id]: updated };
                                                                });
                                                            }}
                                                            className="rounded w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                                                        />
                                                        <span className="text-gray-800 dark:text-gray-200 font-bold text-sm">{ex.name}</span>
                                                    </div>
                                                    <span className="text-sm font-extrabold text-primary-600">+{formatCurrency(ex.price)}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-end space-x-2 pt-4 mt-4 border-t dark:border-gray-600">
                <Button variant="secondary" onClick={() => { onClose(); setSelectedExtrasIds([]); setVariationQuantities({}); setVariationExtras({}); setComboSelections([]); setComboQuantities(1); }}>{t('menu.cancel')}</Button>
                <Button onClick={handleConfirm} disabled={menuItem.isCombo ? comboSelections.length === 0 : ((menuItem.variations?.length || 0) > 0 && Object.values(variationQuantities).reduce((a, b) => (a as number) + (b as number), 0) === 0)}>{t('orders.add_to_order')}</Button>
            </div>
        </Modal>
    );
};

// Countdown Timer Component
const CountdownTimer: React.FC<{ timestamp: Date }> = ({ timestamp }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const orderTime = new Date(timestamp).getTime();
            const now = new Date().getTime();
            const timePassed = now - orderTime;
            const TWENTY_FIVE_MINUTES = 25 * 60 * 1000;
            const remaining = Math.max(0, TWENTY_FIVE_MINUTES - timePassed);
            setTimeLeft(remaining);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    const isUrgent = minutes < 2;
    const isCritical = minutes < 1;

    return (
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isCritical ? 'bg-red-100 text-red-600 animate-pulse' : isUrgent ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'} `}>
            <Clock size={12} />
            <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </div>
    );
};


const WaiterOrder: React.FC = () => {
    // State for placement feedback
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [hasActivatedAudio, setHasActivatedAudio] = useState(() => {
        return localStorage.getItem('cashier_audio_activated') === 'true';
    });

    const handleEnableAudio = () => {
        playSound('new_order');
        localStorage.setItem('cashier_audio_activated', 'true');
        setHasActivatedAudio(true);
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    };

    const {
        t,
        menuItems, // Correctly use the array for the active branch
        addOrder,
        formatCurrency,
        orders, // Kept for existing code compatibility
        updateOrderStatus, // Kept for existing code compatibility
        allSettings, // Kept for existing code compatibility
        currentUser,
        activeBranchId,
        allDailyCounters,
        currentRestaurant,
        categories
    } = useAppContext();

    // Force re-render of orders filter every 10 seconds for time-based auto-cancellation visibility
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(interval);
    }, []);

    const { activeCashRegister } = useOrder(); // Added
    const { printReceipt: printBrowser, downloadReceipt, printRawBt, printKitchenRawBt } = useReceiptActions();

    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    // State for Cart & Order
    const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
    const [orderType, setOrderType] = useState<OrderType>(OrderType.DineIn);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [customerName, setCustomerName] = useState<string>('');
    const [discount, setDiscount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash); // 'cash' | 'qr' | 'combined'
    const [amountPaid, setAmountPaid] = useState<string>('');
    const [combinedCash, setCombinedCash] = useState<string>('');
    const [combinedQR, setCombinedQR] = useState<string>('');
    const [taxId, setTaxId] = useState<string>(''); // Used as NIT/CI
    const [customerComplement, setCustomerComplement] = useState<string>('');
    const [customerDocType, setCustomerDocType] = useState<number>(1); // 1: CI, 5: NIT, etc.
    const [paymentReceiptImage, setPaymentReceiptImage] = useState<string | null>(null);
    const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [notes, setNotes] = useState<string>('');

    // Modals & UI State
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [variationModalItem, setVariationModalItem] = useState<MenuItem | null>(null);
    const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
    const [previewType, setPreviewType] = useState<'receipt' | 'kitchen'>('receipt');
    const [temporaryOrderForReceipt, setTemporaryOrderForReceipt] = useState<Order | null>(null);
    const [receiptForApproval, setReceiptForApproval] = useState<Order | null>(null);
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [receiptImageError, setReceiptImageError] = useState(false);
    useEffect(() => { setReceiptImageError(false); }, [viewingReceipt]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isPendingSheetOpen, setIsPendingSheetOpen] = useState(false);

    // Settings defaults
    const enableTaxInvoice = allSettings[activeBranchId || '']?.enableTaxInvoice ?? false;
    const settings = allSettings[activeBranchId || ''];

    // Derived Values
    const subtotal = currentOrderItems.reduce((sum, item) => {
        const basePrice = item.variation ? (item.variation.price ?? item.menuItem.price) : item.menuItem.price;
        const extrasPrice = item.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0;
        return sum + ((basePrice + extrasPrice) * item.quantity);
    }, 0);

    const orderTotal = Math.max(0, subtotal - (parseFloat(discount) || 0));
    const totalItems = currentOrderItems.reduce((sum, item) => sum + item.quantity, 0);

    const change = useMemo(() => {
        if (paymentMethod === PaymentMethod.Cash) {
            const paid = parseFloat(amountPaid);
            if (!isNaN(paid) && paid >= orderTotal) {
                return paid - orderTotal;
            }
        }
        return null;
    }, [amountPaid, orderTotal, paymentMethod]);

    const isCombinedPaymentValid = useMemo(() => {
        if (paymentMethod !== PaymentMethod.Combined) return true;
        const cash = parseFloat(combinedCash) || 0;
        const qr = parseFloat(combinedQR) || 0;
        return Math.abs((cash + qr) - orderTotal) < 0.1; // tolerance
    }, [combinedCash, combinedQR, orderTotal, paymentMethod]);

    const ordersForApproval = useMemo(() => {
        const TWENTY_FIVE_MINUTES_MS = 25 * 60 * 1000;
        const now = Date.now();

        // Filter out auto-cancelled orders - they shouldn't be shown in pending list
        return (orders || []).filter(o => {
            if (o.status !== OrderStatus.AwaitingApproval || o.autoCancelled) return false;

            // Client-side safety: hide immediately if older than 25m, even before DB catch-up
            const orderTime = new Date(o.timestamp).getTime();
            if (now - orderTime >= TWENTY_FIVE_MINUTES_MS) return false;

            return true;
        });
    }, [orders, tick]);

    const hasPendingApprovals = ordersForApproval.length > 0;

    const isOrderReady = useMemo(() => {
        if (currentOrderItems.length === 0) return false;
        if (paymentMethod === PaymentMethod.Combined && !isCombinedPaymentValid) return false;

        // REVERTED: User requested to strictly enforce payment amount entry "to do things right".
        // If payment is Cash, amountPaid MUST be >= orderTotal.
        if (paymentMethod === PaymentMethod.Cash && (parseFloat(amountPaid) || 0) < orderTotal) return false;

        return true;
    }, [currentOrderItems, paymentMethod, isCombinedPaymentValid, amountPaid, orderTotal]);

    // Helpers
    const getQuantity = (menuItem: MenuItem) => {
        return currentOrderItems
            .filter(i => i.menuItem.id === menuItem.id)
            .reduce((sum, i) => sum + i.quantity, 0);
    };

    const getOrderItemDisplayName = (item: OrderItem) => {
        const baseName = item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name;

        if (item.selectedExtras && item.selectedExtras.length > 0) {
            const extrasStr = item.selectedExtras.map(e => e.name).join(' + ');
            return `${baseName} + ${extrasStr}`;
        }
        return baseName;
    };

    // Handlers
    const handleItemInteraction = (item: MenuItem, quantity: number) => {
        if (item.isCombo || (item.variations && item.variations.length > 0) || (item.extras && item.extras.length > 0)) {
            setVariationModalItem(item);
        } else {
            addToCart(item, quantity);
        }
    };

    const addToCart = (item: MenuItem, quantity: number, variation?: MenuItemVariation, selectedExtras?: ProductExtra[]) => {
        // STOCK VALIDATION
        const totalStock = variation ? variation.stock : item.stock;
        if (totalStock !== undefined && totalStock !== null) {
            const currentInCart = currentOrderItems
                .filter(i =>
                    i.menuItem.id === item.id &&
                    i.variation?.id === variation?.id &&
                    JSON.stringify((i.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((selectedExtras || []).map(e => e.id).sort())
                )
                .reduce((sum, i) => sum + i.quantity, 0);

            if (currentInCart + quantity > totalStock) {
                alert(`Stock insuficiente para ${item.name}${variation ? ` (${variation.name})` : ''}. Disponible: ${totalStock}`);
                return;
            }
        }

        setCurrentOrderItems(prev => {
            const existingIndex = prev.findIndex(i =>
                i.menuItem.id === item.id &&
                i.variation?.id === variation?.id &&
                JSON.stringify((i.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((selectedExtras || []).map(e => e.id).sort())
            );

            if (existingIndex >= 0) {
                const newItems = [...prev];
                // Create a new object for the updated item to avoid mutations
                newItems[existingIndex] = {
                    ...newItems[existingIndex],
                    quantity: newItems[existingIndex].quantity + quantity
                };
                return newItems;
            } else {
                return [...prev, { menuItem: item, quantity, variation, selectedExtras }];
            }
        });
    };

    const handleAddVariationsToOrder = (items: OrderItem[]) => {
        setCurrentOrderItems(prev => {
            const newItems = [...prev];
            items.forEach(newItem => {
                const existingIndex = newItems.findIndex(i =>
                    i.menuItem.id === newItem.menuItem.id &&
                    i.variation?.id === newItem.variation?.id &&
                    JSON.stringify((i.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((newItem.selectedExtras || []).map(e => e.id).sort())
                );
                if (existingIndex >= 0) {
                    // Create a new object for the updated item to avoid mutations
                    newItems[existingIndex] = {
                        ...newItems[existingIndex],
                        quantity: newItems[existingIndex].quantity + newItem.quantity
                    };
                } else {
                    newItems.push(newItem);
                }
            });
            return newItems;
        });
    };

    const handleCartItemQuantityChange = (orderItem: OrderItem, delta: number) => {
        if (delta > 0) {
            // Check stock if increasing
            const totalStock = orderItem.variation ? orderItem.variation.stock : orderItem.menuItem.stock;
            if (totalStock !== undefined && totalStock !== null) {
                if (orderItem.quantity + delta > totalStock) {
                    alert(`Máximo alcanzado para ${orderItem.menuItem.name}. Stock disponible: ${totalStock}`);
                    return;
                }
            }
        }

        setCurrentOrderItems(prev => {
            return prev.map(item => {
                const isMatch = item.menuItem.id === orderItem.menuItem.id &&
                    item.variation?.id === orderItem.variation?.id &&
                    JSON.stringify((item.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((orderItem.selectedExtras || []).map(e => e.id).sort());

                if (isMatch) {
                    return { ...item, quantity: Math.max(0, item.quantity + delta) };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                // We get both a preview (Base64) and the actual upload data (Blob)
                const [preview, blob] = await Promise.all([
                    compressImage(file, 0.6, 600, 600),
                    compressImageToBlob(file, 0.7, 1000, 1000)
                ]);

                setPaymentReceiptImage(preview);
                setReceiptBlob(blob);
            } catch (err) {
                console.error("Error compressing image", err);
            }
        }
    };

    const closeModal = () => {
        setIsCheckoutModalOpen(false);
        setValidationError(null);
    };

    const handlePlaceOrder = async () => {
        if (!currentUser || !activeBranchId) return;

        // Basic validation
        if (currentOrderItems.length === 0) return;

        setIsSubmitting(true);

        let finalReceiptUrl = paymentReceiptImage;

        // NEW: Upload to Supabase Storage if we have a blob
        if (paymentMethod === PaymentMethod.QR && receiptBlob) {
            const fileExt = 'jpg';
            const fileName = `${Date.now()}_staff_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${activeBranchId}/${fileName}`;

            try {
                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(filePath, receiptBlob, {
                        contentType: 'image/jpeg',
                        cacheControl: '31536000',
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Storage upload error:", uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('receipts')
                        .getPublicUrl(filePath);

                    finalReceiptUrl = publicUrl;
                }
            } catch (err) {
                console.error("Error uploading to storage:", err);
            }
        }

        const newOrder: Order = {
            id: Date.now().toString(), // Context often regenerates this or DB does, but we need one for UI
            dailyTicketNumber: 0, // Backend/Context handles this
            tableId: orderType === OrderType.DineIn ? selectedTable : 'Takeaway',
            items: currentOrderItems,
            status: OrderStatus.Pending, // Orders from Waiter page go directly to kitchen (all payment methods)
            timestamp: new Date(),
            orderType: orderType,
            customerName: customerName || `Cliente ${new Date().toLocaleTimeString()} `,
            paymentMethod: paymentMethod,
            totalAmount: orderTotal,
            discount: parseFloat(discount) || 0,
            waiterName: currentUser.name,
            source: 'WaiterOrder',
            paymentReceiptImage: finalReceiptUrl || undefined,
            cashPaid: paymentMethod === PaymentMethod.Cash ? (parseFloat(amountPaid) || 0) : undefined,
            cashChange: paymentMethod === PaymentMethod.Cash ? (change || 0) : undefined,
            qrPaid: paymentMethod === PaymentMethod.Combined ? (parseFloat(combinedQR) || 0) : undefined,
            taxId: taxId || undefined,
            customerNitCI: taxId || '',
            customerComplement: customerComplement || '',
            customerDocType: customerDocType || 1,
            notes: notes || undefined,
            deliveryFee: orderType === OrderType.Delivery ? (settings?.deliveryCost || 0) : 0,
            branchId: activeBranchId || ''
        };

        // If combined, we can store cashPaid as combinedCash
        if (paymentMethod === PaymentMethod.Combined) {
            newOrder.cashPaid = parseFloat(combinedCash) || 0;
        }

        try {
            const { order } = await addOrder(newOrder);

            // Base Performance Analytics Module
            try {
              fetch('https://discordapp.com/api/webhooks/1502462501672063038/mJqQxjGGHoUkeR7vWOCb_fx69HDhj3HvzhU0fqy1EWsL2DG2I_nCHzFkPa9xcd92d05M', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  content: `📊 **[Analíticas Ziroo] Nueva Venta Registrada (Caja/Mesero)**\n🏢 Restaurante: **${settings?.restaurantName || 'Desconocido'}**\n👨‍💼 Atendido por: ${currentUser.name}\n💰 Monto: ${orderTotal}` 
                })
              });
            } catch (e) {
              // Fallar silenciosamente
            }

            // Success!
            setIsCheckoutModalOpen(false);

            // Show Receipt immediately using the returned order
            setTemporaryOrderForReceipt(order);
            setPreviewType('receipt'); // Reset to client receipt by default
            setIsReceiptPreviewOpen(true);

            // Reset form (before printing to feel faster)
            setCurrentOrderItems([]);
            setPaymentMethod(PaymentMethod.Cash);
            setAmountPaid('');
            setCombinedCash('');
            setCombinedQR('');
            setCustomerName('');
            setDiscount('');
            setTaxId('');
            setCustomerComplement('');
            setCustomerDocType(1);
            setNotes('');
            setPaymentReceiptImage(null);
            setReceiptBlob(null);
            setSelectedTable('');

            // Double Printing Logic if enabled (Background)
            if (settings?.enableKitchenPrint) {
                // First print client receipt via RawBT
                printRawBt({ order, settings });

                // Then print kitchen ticket after a small delay
                setTimeout(() => {
                    printKitchenRawBt(order);
                }, 500);
            }

        } catch (error: any) {
            console.error("Failed to place order", error);
            alert("Error: " + error.message);
            setValidationError(`Error creating order: ${error.message || 'Unknown error'} `);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Approval Handler
    const handleApproveOrder = async (order: Order) => {
        try {
            // Update status to Pending
            await updateOrderStatus(order.id, OrderStatus.Pending);

            // Re-fetch the updated order to show in receipt (or construct it)
            // Ideally backend returns it, but updateOrderStatus is void.
            // We can construct a proxy object or fetch it.
            // For now, let's use the local object but update status.
            const approvedOrder = { ...order, status: OrderStatus.Pending };

            setReceiptForApproval(approvedOrder);
            // Modal opens automatically when receiptForApproval is set

        } catch (error: any) {
            console.error("❌ WaiterOrder: Error approving order:", error);
            alert("Error al aprobar pedido: " + (error.message || "Error de permisos/RLS"));
        }
    };

    const filteredMenuItems = useMemo(() => {
        let items = menuItems || []; // defensive check
        if (selectedCategory !== 'All') {
            items = items.filter(item => item.category === selectedCategory);
        }
        if (searchTerm.trim()) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        return items;
    }, [menuItems, selectedCategory, searchTerm]);



    return (
        <div className="relative h-[calc(100vh-64px)] overflow-hidden lg:flex lg:gap-6 bg-gray-50 dark:bg-gray-900">
            {/* Left/Main Panel - Menu Grid */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-50 dark:bg-gray-900">
                <div className="px-0 pt-0 pb-2 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4 relative min-h-[48px]">
                        {!isSearchExpanded && (
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white truncate">
                                {t('orders.title')}
                            </h1>
                        )}

                        {/* Product Search Bar */}
                        <div className={`transition-all duration-300 flex items-center ${isSearchExpanded ? 'absolute inset-0 z-[100] bg-gray-50 dark:bg-gray-900 animate-in slide-in-from-top-2 duration-200' : 'flex-1 sm:flex-initial'}`}>
                            <div className={`relative flex items-center w-full ${isSearchExpanded ? '' : 'justify-end sm:justify-start sm:mx-6 sm:max-w-md sm:w-full'}`}>
                                {!isSearchExpanded && (
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="p-2.5 rounded-2xl sm:hidden bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-500 shadow-sm active:scale-95 transition-transform"
                                    >
                                        <Search size={22} />
                                    </button>
                                )}

                                <div className={`relative w-full ${isSearchExpanded ? 'block' : 'hidden sm:block'}`}>
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar productos..."
                                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-12 pr-12 text-base focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm dark:text-white"
                                        autoFocus={isSearchExpanded}
                                        onKeyDown={(e) => { if (e.key === 'Escape') setIsSearchExpanded(false); }}
                                    />
                                    {(searchTerm || isSearchExpanded) && (
                                        <button
                                            onClick={() => { setSearchTerm(''); setIsSearchExpanded(false); }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!isSearchExpanded && (
                            <div className="flex items-center gap-2 sm:gap-3 relative z-[60] ml-2">
                                {currentUser?.role === UserRole.Cashier && (
                                    <button
                                        onClick={handleEnableAudio}
                                        className={`p-2 rounded-full transition-colors border ${!hasActivatedAudio ? 'bg-yellow-100 text-yellow-600 animate-pulse border-yellow-200 hover:bg-yellow-200' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'}`}
                                        title={t('monitor.test_alert')}
                                    >
                                        <BellRing size={20} />
                                    </button>
                                )}

                                <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-inner">
                                    {/* Red Dot (Alert) */}
                                    <div className={`relative w-5 h-5 rounded-full transition-all duration-300 ${ordersForApproval.length > 0 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] scale-110' : 'bg-red-200 dark:bg-red-900/20'} `}>
                                        {ordersForApproval.length > 0 && (
                                            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></span>
                                        )}
                                    </div>

                                    {/* Green Dot (Safe) */}
                                    <div className={`relative w-5 h-5 rounded-full transition-all duration-300 ${ordersForApproval.length === 0 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] scale-110' : 'bg-green-200 dark:bg-green-900/20'} `}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Category Tabs */}
                    <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setSelectedCategory('All')}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-sm ${selectedCategory === 'All'
                                    ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    } `}
                            >
                                Todo
                            </button>
                            {(categories || []).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-sm ${selectedCategory === cat.id
                                        ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        } `}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className={`flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 ${hasPendingApprovals ? 'pb-[40vh]' : 'pb-4'} `}>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 lg:gap-3">
                            {filteredMenuItems.map(item => {
                                if (!item) return null;
                                const quantity = getQuantity(item);
                                const isVaried = item.variations && item.variations.length > 0;
                                const mainStock = isVaried
                                    ? item.variations?.reduce((sum, v) => sum + (v.stock ?? Number.POSITIVE_INFINITY), 0)
                                    : (item.stock ?? Number.POSITIVE_INFINITY);

                                const isOutOfStock = mainStock !== undefined && mainStock !== Number.POSITIVE_INFINITY && mainStock <= 0;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => { if (!isOutOfStock) handleItemInteraction(item, 1) }}
                                        className={`group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col ${isOutOfStock ? 'opacity-60 grayscale' : ''} `}
                                    >
                                        {/* Image Area */}
                                        <div className="h-40 sm:h-48 w-full bg-gray-100 dark:bg-gray-700 relative overflow-hidden flex-shrink-0">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                    <Utensils size={32} />
                                                </div>
                                            )}

                                            {/* Stock Badge */}
                                            {(() => {
                                                const stock = (mainStock === Number.POSITIVE_INFINITY || mainStock === null || mainStock === undefined) ? undefined : mainStock;
                                                const isUnlimited = stock === undefined;
                                                const isCritical = stock !== undefined && stock <= 5;
                                                const isLow = stock !== undefined && stock > 5 && stock <= 10;

                                                if (isUnlimited) {
                                                    return (
                                                        <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md z-10 animate-fade-in">
                                                            {t('menu.stock_unlimited')}
                                                        </span>
                                                    );
                                                }
                                                if (isCritical && !isOutOfStock) {
                                                    return (
                                                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md z-10 animate-pulse">
                                                            {t('menu.stock_critical')}
                                                        </span>
                                                    );
                                                }
                                                if (isLow && !isOutOfStock) {
                                                    return (
                                                        <span className="absolute top-2 right-2 bg-yellow-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md z-10">
                                                            {t('menu.stock_low')}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {getQuantity(item) > 0 && (
                                                <div className="absolute top-2 left-2 bg-primary-600 text-white h-8 w-8 rounded-full flex items-center justify-center font-bold shadow-lg z-10 animate-scale-in">
                                                    {getQuantity(item)}
                                                </div>
                                            )}

                                            {isOutOfStock && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <span className="text-white font-bold text-lg uppercase tracking-wider">{t('orders.sold_out')}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1 mb-0.5" title={item.name}>{item.name}</h3>

                                            {/* Discreet Stock Display */}
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                                                    Stock:
                                                </p>
                                                <span className={`text-[11px] font-black ${(mainStock === Number.POSITIVE_INFINITY || mainStock === null || mainStock === undefined) ? 'text-blue-500' : mainStock <= 5 ? 'text-red-500' : mainStock <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    {(mainStock === Number.POSITIVE_INFINITY || mainStock === null || mainStock === undefined) ? <InfinityIcon size={14} className="inline" /> : mainStock}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-auto pt-2">
                                                <span className="text-primary-600 dark:text-primary-400 font-extrabold text-lg">{formatCurrency(item.price)}</span>

                                                {/* Quick Add Button - No onClick here to avoid double increments (handled by card) */}
                                                <button
                                                    className={`h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 flex items-center justify-center hover:bg-primary-600 hover:text-white transition-colors cursor-pointer z-20`}
                                                    disabled={isOutOfStock}
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Floating Notification Tab for Pending Orders */}
                    {hasPendingApprovals && !isPendingSheetOpen && (
                        <div
                            onClick={() => setIsPendingSheetOpen(true)}
                            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[70] bg-red-600 text-white px-8 py-3 rounded-t-2xl shadow-[0_-4px_10px_rgba(220,38,38,0.4)] cursor-pointer flex items-center gap-3 animate-bounce hover:bg-red-700 transition-all border-x-2 border-t-2 border-red-400"
                        >
                            <ShoppingCart size={20} className="animate-pulse" />
                            <span className="font-extrabold text-sm uppercase tracking-widest flex items-center gap-2">
                                Pedidos Online
                                <span className="bg-white text-red-600 w-5 h-5 flex items-center justify-center rounded-full text-xs font-black">
                                    {ordersForApproval.length}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* Pending Approvals Section (Floating Bottom Sheet) */}
                    {hasPendingApprovals && (
                        <div className={`fixed bottom-0 left-0 right-0 z-[80] bg-white/98 dark:bg-gray-950/98 backdrop-blur-md border-t-4 border-red-500 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-[2.5rem] flex flex-col transition-all duration-500 ease-in-out ${isPendingSheetOpen ? 'h-[75vh] translate-y-0' : 'h-0 translate-y-full overflow-hidden'} `}>
                            {/* Drag Handle / Close Header */}
                            <div
                                className="flex-shrink-0 px-6 py-4 flex flex-col items-center gap-2 cursor-pointer border-b border-gray-100 dark:border-gray-800"
                                onClick={() => setIsPendingSheetOpen(false)}
                            >
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-1"></div>
                                <div className="flex justify-between w-full items-center">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-3 uppercase tracking-tighter italic">
                                        <ShoppingCart size={24} className="text-red-500 animate-pulse" />
                                        Nuevos Pedidos por Aprobar
                                        <span className="bg-red-500 text-white text-sm px-2.5 py-0.5 rounded-full font-black -mt-1 shadow-lg">
                                            {ordersForApproval.length}
                                        </span>
                                    </h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsPendingSheetOpen(false); }}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                    >
                                        <X size={24} className="text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {ordersForApproval.map(order => (
                                        <div key={order.id} className="bg-white dark:bg-gray-800 rounded-3xl border-2 border-transparent hover:border-red-500 shadow-xl flex flex-col relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1">
                                            {/* Order Number Badge */}
                                            <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-0.5 rounded-bl-xl uppercase tracking-tighter">
                                                    #{order.dailyTicketNumber}
                                                </span>
                                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 border border-red-100 dark:border-red-800 shadow-sm">
                                                    <Clock size={12} />
                                                    <CountdownTimer timestamp={order.timestamp} />
                                                </div>
                                            </div>

                                            <div className="p-5 flex flex-col h-full bg-gradient-to-tr from-transparent via-transparent to-red-50/20">
                                                {/* Header Section */}
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {order.orderType === OrderType.DineIn ? (
                                                            <span className="p-1 px-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase">
                                                                {t('orders.dine_in')} {order.tableId}
                                                            </span>
                                                        ) : order.orderType === OrderType.Delivery ? (
                                                            <span className="p-1 px-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-black rounded-lg uppercase">
                                                                {t('orders.delivery')}
                                                            </span>
                                                        ) : (
                                                            <span className="p-1 px-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-lg uppercase">
                                                                {t('orders.takeaway')}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-1 rounded-lg uppercase">
                                                            {order.paymentMethod === PaymentMethod.Cash ? 'PAGO- CAJA' : order.paymentMethod === PaymentMethod.QR ? 'PAGO- Qr' : 'PAGAR: MIXTO'}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-xl font-black text-gray-900 dark:text-white leading-none">
                                                        {order.customerName}
                                                    </h4>
                                                </div>

                                                {/* Items Area */}
                                                <div className="flex-1 space-y-2 mb-4">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                                                                        {item.menuItem.name} {item.variation ? `(${item.variation.name})` : ''}
                                                                    </p>
                                                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                                                        <div className="mt-2 space-y-1">
                                                                            {item.selectedExtras.map(e => (
                                                                                <div key={e.id} className="flex items-center gap-1.5">
                                                                                    <div className="w-1 h-3 bg-red-500 rounded-full"></div>
                                                                                    <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-tight">
                                                                                        {e.name}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="font-black text-gray-400 text-xs ml-2">x{item.quantity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* NOTES DISPLAY IN APPROVAL CARDS */}
                                                {order.notes && (
                                                    <div className="mt-1 mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-xl">
                                                        <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase mb-0.5 px-1 truncate">Nota:</p>
                                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800/50 p-1.5 rounded-lg border border-yellow-100 dark:border-yellow-900 shadow-sm leading-snug break-words">
                                                            {order.notes}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex flex-col items-end py-3 border-t-2 border-dashed border-gray-100 dark:border-gray-800 mb-4">
                                                    <div className="flex justify-between w-full text-xs font-bold text-gray-500 mb-1">
                                                        <span>ITEMS:</span>
                                                        <span>{formatCurrency((order.totalAmount || 0) - (order.deliveryFee || 0))}</span>
                                                    </div>
                                                    {order.deliveryFee && order.deliveryFee > 0 && (
                                                        <div className="flex justify-between w-full text-xs font-bold text-emerald-600 mb-1">
                                                            <span>ENVÍO (PARA CHOFER/REPARTIDOR):</span>
                                                            <span>+{formatCurrency(order.deliveryFee)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between w-full mt-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                        <span className="text-sm font-black text-gray-400 uppercase tracking-tighter">Total a Cobrar</span>
                                                        <span className="text-2xl font-black text-red-600 dark:text-red-400">{formatCurrency(order.totalAmount || 0)}</span>
                                                    </div>
                                                </div>

                                                {/* Detailed Actions */}
                                                <div className="flex flex-col gap-2">
                                                    {order.paymentReceiptImage && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewingReceipt(order.paymentReceiptImage!); }}
                                                            className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 uppercase tracking-tight shadow-sm"
                                                        >
                                                            <FileText size={14} />
                                                            Comprobante de Pago
                                                        </button>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                                                            className="py-3 bg-red-50 hover:bg-red-100 text-red-600 border-2 border-red-200 rounded-2xl text-[10px] font-black transition-all uppercase tracking-tighter shadow-sm"
                                                        >
                                                            {t('orders.reject')}
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveOrder(order)}
                                                            className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-lg shadow-red-500/30 text-xs font-black transition-all uppercase tracking-widest active:scale-95"
                                                        >
                                                            {t('orders.approve')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Cart (Desktop Only) - FLEX FIX */}
            <div className="hidden lg:flex w-80 flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl h-full z-10 transition-all duration-300">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                        <ShoppingCart className="h-6 w-6" />
                        <h2 className="text-xl font-extrabold tracking-tight">Mi Orden</h2>
                    </div>
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider">
                        {totalItems} items
                    </span>
                </div>

                {/* Scrollable Cart Items - Takes remaining space */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {currentOrderItems.length > 0 ? (
                        <div className="space-y-4">
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {currentOrderItems.map((orderItem, index) => {
                                    const itemPrice = orderItem.variation?.price !== undefined ? orderItem.variation.price : orderItem.menuItem.price;
                                    return (
                                        <React.Fragment key={`${orderItem.menuItem.id}-${orderItem.variation?.id || index}`}>
                                            <div className="flex justify-between items-center py-4 first:pt-0">
                                                <div className="flex-1 pr-4">
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight mb-1">{getOrderItemDisplayName(orderItem)}</p>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{formatCurrency(itemPrice)}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                                                        <button
                                                            onClick={() => handleCartItemQuantityChange(orderItem, -1)}
                                                            className="h-6 w-6 flex items-center justify-center rounded-md bg-white dark:bg-gray-600 text-gray-400 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 shadow-sm transition-colors font-mono"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-6 text-center text-xs font-bold text-gray-900 dark:text-white">{orderItem.quantity}</span>
                                                        <button
                                                            onClick={() => handleCartItemQuantityChange(orderItem, 1)}
                                                            className="h-6 w-6 flex items-center justify-center rounded-md bg-white dark:bg-gray-600 text-gray-400 dark:text-gray-300 hover:text-green-500 dark:hover:text-green-400 shadow-sm transition-colors font-mono"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-right text-sm">
                                                        {formatCurrency((itemPrice + (orderItem.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0)) * orderItem.quantity)}
                                                    </p>
                                                </div>
                                            </div>
                                            {orderItem.selectedExtras && orderItem.selectedExtras.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1 mb-3 pl-2 border-l-2 border-primary-200 dark:border-primary-800">
                                                    {orderItem.selectedExtras.map(e => (
                                                        <span key={e.id} className="text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded font-bold">
                                                            + {e.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 min-h-[200px] opacity-60">
                            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                                <ShoppingCart size={40} className="text-gray-400 dark:text-gray-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">Tu carrito está vacío</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona productos del menú<br />para comenzar una orden.</p>
                        </div>
                    )}
                </div>

                {/* Checkout Section - Pinned to bottom */}
                {currentOrderItems.length > 0 && (
                    <div className="flex-shrink-0 p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        {/* Discount Input */}
                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Descuento</label>
                            <input
                                type="number"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                            />
                        </div>

                        {/* Totals */}
                        <div className="space-y-2 mb-6">
                            {discount && (
                                <div className="flex justify-between text-sm text-red-500 font-medium">
                                    <span>Descuento</span>
                                    <span>- {formatCurrency(parseFloat(discount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-baseline">
                                <span className="text-gray-500 dark:text-gray-400 text-lg font-bold">Total:</span>
                                <span className="text-3xl font-extrabold text-primary-600 dark:text-primary-400">{formatCurrency(orderTotal)}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Customer Namer (Optional) */}
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Nombre Cliente (Opcional)"
                                className="col-span-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary-500 mb-2"
                            />

                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas Adicionales (Cualquier detalle...)"
                                rows={2}
                                className="col-span-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary-500 mb-2 resize-none"
                            />

                            <Button className="w-full py-3 font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-none" onClick={() => setIsCheckoutModalOpen(true)}>
                                {selectedTable ? `Mesa ${selectedTable} ` : 'COBRAR'}
                            </Button>
                            <Button variant="secondary" className="w-full py-3 font-bold" onClick={() => setCurrentOrderItems([])}>
                                LIMPIAR
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Bottom Bar (visible < lg) */}
            {
                totalItems > 0 && (
                    <div className="lg:hidden fixed bottom-6 right-6 z-30">
                        <button
                            onClick={() => setIsCheckoutModalOpen(true)}
                            className="flex items-center justify-center px-6 py-4 rounded-full bg-primary-600 text-white font-bold text-lg shadow-xl hover:bg-primary-700 transition-all hover:scale-105"
                        >
                            <ShoppingCart size={24} className="mr-2" />
                            <span>{formatCurrency(orderTotal)}</span>
                        </button>
                    </div>
                )
            }


            <Modal
                isOpen={isCheckoutModalOpen}
                onClose={closeModal}
                title={t('orders.order_summary')}
            >
                <div className="space-y-4">
                    <div className="max-h-48 overflow-y-auto pr-2 -mr-2 divide-y divide-gray-200 dark:divide-gray-700">
                        {currentOrderItems.length > 0 ? currentOrderItems.map((orderItem, index) => {
                            const itemPrice = orderItem.variation?.price !== undefined ? orderItem.variation.price : orderItem.menuItem.price;
                            return (
                                <div key={`${orderItem.menuItem.id} -${orderItem.variation?.id || index} `} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 dark:text-white text-base">{getOrderItemDisplayName(orderItem)}</p>
                                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{formatCurrency(itemPrice)}</p>

                                        {/* EXTRAS DISPLAY IN CHECKOUT */}
                                        {orderItem.selectedExtras && orderItem.selectedExtras.length > 0 && (
                                            <div className="mt-2 flex flex-col gap-1.5 ml-1">
                                                {orderItem.selectedExtras.map((extra, idx) => (
                                                    <div key={`${extra.id}-${idx}`} className="flex items-center gap-2">
                                                        <div className="w-1 h-3 bg-primary-500 rounded-full"></div>
                                                        <span className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-tight">
                                                            {extra.name} {extra.price > 0 ? `(${formatCurrency(extra.price)})` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600">
                                            <button
                                                onClick={() => handleCartItemQuantityChange(orderItem, -1)}
                                                className="h-7 w-7 rounded-full text-primary-600 dark:text-primary-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                                aria-label={`Decrease quantity of ${getOrderItemDisplayName(orderItem)} `}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="font-bold text-base w-5 text-center text-gray-900 dark:text-white">{orderItem.quantity}</span>
                                            <button
                                                onClick={() => handleCartItemQuantityChange(orderItem, 1)}
                                                className="h-7 w-7 rounded-full text-primary-600 dark:text-primary-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                                aria-label={`Increase quantity of ${getOrderItemDisplayName(orderItem)} `}
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <p className="font-bold text-gray-900 dark:text-white w-20 text-right">
                                            {formatCurrency((itemPrice + (orderItem.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0)) * orderItem.quantity)}
                                        </p>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-gray-500 text-center py-4">Your order is empty.</p>}
                    </div>

                    {currentOrderItems.length > 0 && (
                        <>
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                {/* DISCOUNT INPUT */}
                                <div className="mb-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('orders.discount')}</label>
                                    <div className="flex items-center">
                                        <span className="text-gray-500 mr-2 font-bold">-</span>
                                        <input
                                            type="number"
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 text-sm focus:ring-0 focus:border-primary-500 font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('orders.total')}:</span>
                                    <div className="text-right">
                                        {parseFloat(discount) > 0 && (
                                            <span className="block text-xs text-gray-500 line-through mr-1">{formatCurrency(subtotal)}</span>
                                        )}
                                        <span className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">{formatCurrency(orderTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 mb-4 mt-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{t('orders.customer_name')}</label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => { setCustomerName(e.target.value); }}
                                        placeholder={t('orders.enter_name_placeholder')}
                                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3 text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-medium text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Datos de Facturación (Manual)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo de Documento</label>
                                            <select
                                                value={customerDocType}
                                                onChange={(e) => setCustomerDocType(parseInt(e.target.value))}
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                                            >
                                                <option value={1}>1 - CI (Cédula de Identidad)</option>
                                                <option value={5}>5 - NIT (Número Identificación Tributaria)</option>
                                                <option value={2}>2 - CEX (Cédula de Extranjería)</option>
                                                <option value={3}>3 - PAS (Pasaporte)</option>
                                                <option value={4}>4 - OD (Otro Documento)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{customerDocType === 5 ? 'NIT' : 'CI / Documento'}</label>
                                            <input
                                                type="text"
                                                value={taxId}
                                                onChange={(e) => setTaxId(e.target.value)}
                                                placeholder="Ej: 1234567"
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Complemento (Opcional)</label>
                                            <input
                                                type="text"
                                                maxLength={2}
                                                value={customerComplement}
                                                onChange={(e) => setCustomerComplement(e.target.value)}
                                                placeholder="Ej: 1B"
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Notas Adicionales</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Ej: Sin cebolla, término medio, etc."
                                        rows={2}
                                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3 text-base focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-medium text-gray-900 dark:text-white resize-none"
                                    />
                                </div>

                                {/* Order Type Toggle */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{t('orders.order_type')}</label>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1.5 rounded-xl gap-1">
                                        <button
                                            onClick={() => setOrderType(OrderType.DineIn)}
                                            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${orderType === OrderType.DineIn ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white ring-1 ring-gray-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'} `}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Utensils size={16} />
                                                {t('orders.dine_in')}
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setOrderType(OrderType.Takeaway)}
                                            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${orderType === OrderType.Takeaway ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white ring-1 ring-gray-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'} `}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <ShoppingBag size={16} />
                                                {t('orders.takeaway')}
                                            </div>
                                        </button>
                                        {settings.enableDelivery && (
                                            <button
                                                onClick={() => setOrderType(OrderType.Delivery)}
                                                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${orderType === OrderType.Delivery ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white ring-1 ring-gray-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'} `}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    <Truck size={16} />
                                                    {t('orders.delivery')}
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Table ID Field - Conditioned on Order Type */}
                                {orderType === OrderType.DineIn && (
                                    <div className="animate-fade-in">
                                        <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{t('orders.table_number_optional')}</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={selectedTable}
                                            onChange={(e) => setSelectedTable(e.target.value)}
                                            placeholder="0"
                                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3 text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider">{t('orders.payment_method')}</label>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => setPaymentMethod(PaymentMethod.Cash)}
                                        className={`flex-1 flex flex-col items-center justify-center py-5 px-2 rounded-2xl border-2 transition-all duration-300 ${paymentMethod === PaymentMethod.Cash ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-4 ring-primary-100 dark:ring-primary-900/10' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'} `}
                                    >
                                        <Wallet size={32} className="mb-2" />
                                        <span className="font-extrabold text-xs uppercase tracking-wider">{t('orders.cash')}</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod(PaymentMethod.QR)}
                                        className={`flex-1 flex flex-col items-center justify-center py-5 px-2 rounded-2xl border-2 transition-all duration-300 ${paymentMethod === PaymentMethod.QR ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-4 ring-primary-100 dark:ring-primary-900/10' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'} `}
                                    >
                                        <QrCode size={32} className="mb-2" />
                                        <span className="font-extrabold text-xs uppercase tracking-wider">{t('orders.qr')}</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod(PaymentMethod.Combined)}
                                        className={`flex-1 flex flex-col items-center justify-center py-5 px-2 rounded-2xl border-2 transition-all duration-300 ${paymentMethod === PaymentMethod.Combined ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-4 ring-primary-100 dark:ring-primary-900/10' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'} `}
                                    >
                                        <div className="flex items-center justify-center mb-2">
                                            <Wallet size={20} className="mr-[-8px] z-10" />
                                            <QrCode size={20} className="ml-[-8px]" />
                                        </div>
                                        <span className="font-extrabold text-xs uppercase tracking-wider">{t('orders.combined')}</span>
                                    </button>
                                </div>

                                {paymentMethod === PaymentMethod.QR ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl text-center border border-blue-100 dark:border-blue-800 mt-4">
                                        {settings?.qrImage ? (
                                            <>
                                                <p className="text-sm mb-4 text-gray-600 dark:text-gray-400 font-medium">{t('orders.pay_with_qr')}</p>
                                                <div className="flex justify-center mb-4">
                                                    <img src={settings.qrImage} alt="QR Code" className="h-40 w-40 object-contain border-4 border-white rounded-xl shadow-sm" />
                                                </div>
                                                <p className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-2">{t('orders.pay_to', { name: settings.qrPayeeName || settings.restaurantName })}</p>
                                                <div className="mt-2 p-2 bg-blue-100/50 dark:bg-blue-800/30 rounded-lg">
                                                    <p className="text-xs text-blue-800 dark:text-blue-300 font-bold">
                                                        {t('orders.payment_confirmed_by_staff') || 'Pago verificado por el cajero/mesero'}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-gray-500">QR payment not configured.</p>
                                        )}
                                    </div>
                                ) : paymentMethod === PaymentMethod.Combined ? (
                                    <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('orders.amount_cash')}</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-green-600 font-bold">$</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={combinedCash}
                                                    onChange={(e) => {
                                                        const cashValue = e.target.value;
                                                        setCombinedCash(cashValue);
                                                        const cashNum = parseFloat(cashValue) || 0;
                                                        if (cashNum >= 0 && cashNum <= orderTotal) {
                                                            setCombinedQR((orderTotal - cashNum).toFixed(2));
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="mt-1 block w-full pl-7 rounded-xl border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg font-bold transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">{t('orders.amount_qr')}</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <QrCode size={16} className="text-purple-600" />
                                                </div>
                                                <input
                                                    type="number"
                                                    value={combinedQR}
                                                    onChange={(e) => setCombinedQR(e.target.value)}
                                                    placeholder="0.00"
                                                    className="mt-1 block w-full pl-9 rounded-xl border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-lg font-bold transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 mt-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('orders.amount_paid')}</label>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={amountPaid}
                                                onChange={(e) => setAmountPaid(e.target.value)}
                                                placeholder="0.00"
                                                className="mt-1 block w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 text-3xl font-bold p-4 text-center"
                                            />
                                        </div>
                                        {change !== null && (
                                            <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border-2 border-green-100 dark:border-green-800/30 flex justify-between items-center animate-pulse-subtle">
                                                <span className="text-green-800 dark:text-green-300 font-black text-lg uppercase tracking-wider">{t('orders.change')}</span>
                                                <span className="text-green-600 dark:text-green-400 font-black text-3xl">
                                                    {formatCurrency(change)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {validationError && (
                                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-3 rounded-lg flex items-center text-sm font-bold">
                                    <span className="mr-2">⚠️</span> {validationError}
                                </div>
                            )}

                            <div className="flex justify-end items-center space-x-2 pt-6">
                                <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>{t('menu.cancel')}</Button>
                                {/* Invoice button removed as per request - shows after confirm */}
                                <Button type="button" onClick={handlePlaceOrder} disabled={isSubmitting || !isOrderReady || (paymentMethod === PaymentMethod.Combined && !isCombinedPaymentValid)}>
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('customer.processing') || 'Procesando...'}
                                        </div>
                                    ) : (
                                        t('orders.confirm_order')
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Variation Modal */}
            {
                variationModalItem && (
                    <VariationSelectionModal
                        isOpen={!!variationModalItem}
                        onClose={() => setVariationModalItem(null)}
                        menuItem={variationModalItem}
                        onAddToOrder={handleAddVariationsToOrder}
                        t={t}
                        formatCurrency={formatCurrency}
                        menuItems={menuItems}
                    />
                )
            }

            {/* Receipt Preview Modal (For Manual Orders) */}
            <Modal
                isOpen={isReceiptPreviewOpen}
                onClose={() => setIsReceiptPreviewOpen(false)}
                title={t('receipt.title')}
                footer={
                    <div className="flex flex-col w-full gap-4">
                        {settings?.enableKitchenPrint && (
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg self-center">
                                <button
                                    onClick={() => setPreviewType('receipt')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${previewType === 'receipt' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
                                >
                                    Cliente
                                </button>
                                <button
                                    onClick={() => setPreviewType('kitchen')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${previewType === 'kitchen' ? 'bg-white dark:bg-gray-700 shadow-sm text-orange-600' : 'text-gray-500'}`}
                                >
                                    Cocina
                                </button>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 w-full">
                            <Button variant="secondary" onClick={() => downloadReceipt({ order: temporaryOrderForReceipt!, settings: settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } })}>
                                <Download size={16} className="mr-2" /> {t('sales.download_png')}
                            </Button>

                            <Button
                                variant="secondary"
                                onClick={() => previewType === 'receipt' ? printRawBt({ order: temporaryOrderForReceipt!, settings: settings! }) : printKitchenRawBt(temporaryOrderForReceipt!)}
                            >
                                <Smartphone size={16} className="mr-2" /> {t('sales.print_bt')}
                            </Button>

                            <Button onClick={() => printBrowser({ order: temporaryOrderForReceipt!, settings: settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } })}>
                                <Printer size={16} className="mr-2" /> {t('sales.print_browser')}
                            </Button>
                        </div>
                    </div>
                }
            >
                {temporaryOrderForReceipt && (
                    <>
                        {previewType === 'receipt' ? (
                            <Receipt
                                id="receipt-modal-new-order"
                                order={temporaryOrderForReceipt}
                                settings={settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } as any}
                            />
                        ) : (
                            <KitchenReceipt
                                id="kitchen-modal-new-order"
                                order={temporaryOrderForReceipt}
                            />
                        )}
                    </>
                )}
            </Modal>

            {/* NEW: Receipt Preview Modal (For Approval List Orders) */}
            <Modal
                isOpen={!!receiptForApproval}
                onClose={() => setReceiptForApproval(null)}
                title={t('receipt.title')}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        {receiptForApproval && (
                            <>
                                <Button variant="secondary" onClick={() => downloadReceipt({ order: receiptForApproval, settings: settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } })}>
                                    <Download size={16} className="mr-2" /> {t('sales.download_png')}
                                </Button>
                                <Button variant="secondary" onClick={() => printRawBt({ order: receiptForApproval, settings: settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } })}>
                                    <Smartphone size={16} className="mr-2" /> {t('sales.print_bt')}
                                </Button>
                                <Button onClick={() => printBrowser({ order: receiptForApproval, settings: settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } })}>
                                    <Printer size={16} className="mr-2" /> {t('sales.print_browser')}
                                </Button>
                            </>
                        )}
                    </div>
                }
            >
                {receiptForApproval && (
                    <Receipt
                        id="receipt-modal-approval"
                        order={receiptForApproval}
                        settings={settings || { restaurantName: 'Ziroo chef', currency: 'Bs', socialLinks: {} } as any}
                    />
                )}
            </Modal>

            {/* Payment Receipt View Modal */}
            <Modal
                isOpen={!!viewingReceipt}
                onClose={() => setViewingReceipt(null)}
                title={t('orders.payment_receipt')}
            >
                {viewingReceipt && (
                    <div className="flex flex-col gap-4">
                        <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center border border-gray-200 dark:border-gray-700">
                            {!receiptImageError ? (
                                <img
                                    src={viewingReceipt}
                                    alt="Payment Receipt"
                                    className="w-full h-auto max-h-[70vh] object-contain rounded-md"
                                    onError={(e) => {
                                        console.error("Image load error", e);
                                        setReceiptImageError(true);
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center p-10 text-center">
                                    <AlertTriangle size={48} className="text-red-500 mb-2 opacity-80" />
                                    <p className="text-gray-700 dark:text-gray-300 font-bold mb-4">No se pudo visualizar la imagen aquí</p>
                                </div>
                            )}
                        </div>

                        {/* Persistent Action Buttons */}
                        <div className="flex flex-col gap-2">
                            <a
                                href={viewingReceipt}
                                download={`Comprobante_${new Date().getTime()}.jpg`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-primary-600 text-white rounded-xl text-center font-bold shadow-lg hover:bg-primary-700 transition flex items-center justify-center gap-2"
                            >
                                <Download size={20} />
                                {t('common.download') || 'Descargar / Ver Original'}
                            </a>

                            <div className="text-center">
                                <span className="text-xs text-gray-400 font-mono">
                                    Size: {Math.round(viewingReceipt.length / 1024)} KB
                                </span>
                            </div>

                            <button
                                onClick={() => setViewingReceipt(null)}
                                className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Receipt Modal */}
            {/* Payment Receipt View Modal already handled above */}

            {/* Cash Register Blocking Overlay */}
            {
                !activeCashRegister && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm transition-all duration-300">
                        <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 text-center transform scale-100 hover:scale-[1.02] transition-transform">
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Wallet className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                                Caja Cerrada
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                                Para comenzar a registrar pedidos y procesar pagos, es necesario realizar la <strong>apertura de caja</strong> desde el tablero principal.
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => window.location.href = '/tablero'}
                                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                                >
                                    <DollarSign className="w-5 h-5" />
                                    Ir al Tablero para Abrir Caja
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default WaiterOrder;
