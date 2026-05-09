
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';
import { UserRole, DeliveryDriver } from '../types';
import {
    UserPlus,
    Search,
    Edit2,
    Trash2,
    Coins,
    User as UserIcon,
    Phone,
    Mail,
    CreditCard,
    CheckCircle,
    XCircle,
    Plus,
    Minus,
    Save,
    X,
    Camera,
    Map as MapIcon,
    Globe
} from 'lucide-react';
import { COUNTRIES, getDepartmentsForCountry } from '../lib/locations';

const TeamRepartidor: React.FC = () => {
    const { t, currentUser, formatCurrency } = useAppContext();
    const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<DeliveryDriver | null>(null);
    const [creditAmount, setCreditAmount] = useState(1);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        licenseNumber: '',
        profileImage: '',
        isAvailable: true,
        credits: 0,
        country: '',
        city: '',
        currencySymbol: 'Bs'
    });

    useEffect(() => {
        let isMounted = true;
        let channel: any = null;

        const setupSubscription = () => {
            if (!isMounted) return;

            console.log("🔌 TeamRepartidor: Iniciando suscripción para delivery_drivers");
            
            // Real-time subscription for driver status and credits
            channel = supabase.channel('team-repartidores-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_drivers' }, (payload) => {
                    if (!isMounted) return;
                    if (payload.eventType === 'UPDATE') {
                        setDrivers(prev => prev.map(d => {
                            if (d.id === payload.new.id) {
                                return {
                                    ...d,
                                    name: payload.new.name,
                                    email: payload.new.email,
                                    phone: payload.new.phone,
                                    licenseNumber: payload.new.license_number,
                                    profileImage: payload.new.profile_image,
                                    isAvailable: payload.new.is_available,
                                    credits: payload.new.credits,
                                    totalEarnings: Number(payload.new.total_earnings) || 0,
                                    ordersCompleted: payload.new.orders_completed || 0,
                                    country: payload.new.country,
                                    city: payload.new.city,
                                    currencySymbol: payload.new.currency_symbol || 'Bs'
                                };
                            }
                            return d;
                        }));
                    } else if (payload.eventType === 'INSERT') {
                        const d = payload.new;
                        const newDriver = {
                            id: d.id,
                            name: d.name,
                            email: d.email,
                            password_INSECURE: d.password_insecure,
                            phone: d.phone,
                            licenseNumber: d.license_number,
                            profileImage: d.profile_image,
                            isAvailable: d.is_available,
                            credits: d.credits,
                            country: d.country,
                            city: d.city,
                            role: UserRole.DeliveryDriver
                        } as DeliveryDriver;
                        setDrivers(prev => [newDriver, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setDrivers(prev => prev.filter(d => d.id !== payload.old.id));
                    }
                });

            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    console.log("✅ TeamRepartidor: Subscribed successfully to delivery_drivers");
                }
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn(`⚠️ TeamRepartidor: Subscription status: ${status}`);
                }
            });
        };

        fetchDrivers();
        setupSubscription();

        return () => {
            isMounted = false;
            if (channel) {
                console.log("🔌 TeamRepartidor cleanup: Removing channel for delivery_drivers");
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const fetchDrivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('delivery_drivers')
            .select('*, total_earnings, orders_completed')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching drivers:', error);
        } else {
            setDrivers(data.map((d: any) => ({
                id: d.id,
                name: d.name,
                email: d.email,
                password_INSECURE: d.password_insecure,
                phone: d.phone,
                licenseNumber: d.license_number,
                profileImage: d.profile_image,
                isAvailable: d.is_available,
                credits: d.credits,
                totalEarnings: Number(d.total_earnings) || 0,
                ordersCompleted: d.orders_completed || 0,
                country: d.country,
                city: d.city,
                currencySymbol: d.currency_symbol || 'Bs',
                role: UserRole.DeliveryDriver
            })));
        }
        setLoading(false);
    };

    const handleOpenAddModal = () => {
        setEditingDriver(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            phone: '',
            licenseNumber: '',
            profileImage: '',
            isAvailable: true,
            credits: 0,
            country: 'BOLIVIA',
            city: '',
            currencySymbol: 'Bs'
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (driver: DeliveryDriver) => {
        setEditingDriver(driver);
        setFormData({
            name: driver.name,
            email: driver.email,
            password: driver.password_INSECURE,
            phone: driver.phone || '',
            licenseNumber: driver.licenseNumber || '',
            profileImage: driver.profileImage || '',
            isAvailable: driver.isAvailable,
            credits: driver.credits,
            country: driver.country || 'BOLIVIA',
            city: driver.city || '',
            currencySymbol: (driver as any).currencySymbol || 'Bs'
        });
        setIsModalOpen(true);
    };

    const handleSaveDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        const dbData = {
            name: formData.name,
            email: formData.email,
            password_insecure: formData.password,
            phone: formData.phone,
            license_number: formData.licenseNumber,
            profile_image: formData.profileImage,
            is_available: formData.isAvailable,
            credits: formData.credits,
            country: formData.country || null,
            city: formData.city || null,
            currency_symbol: formData.currencySymbol || 'Bs'
        };

        if (editingDriver) {
            const { error } = await supabase
                .from('delivery_drivers')
                .update(dbUpdateCleanup(dbData))
                .eq('id', editingDriver.id);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase
                .from('delivery_drivers')
                .insert([dbData]);
            if (error) alert(error.message);
        }

        setIsModalOpen(false);
        fetchDrivers();
    };

    // Helper to remove undefined for Supabase
    const dbUpdateCleanup = (obj: any) => {
        const newObj = { ...obj };
        Object.keys(newObj).forEach(key => newObj[key] === undefined && delete newObj[key]);
        return newObj;
    };

    const handleDeleteDriver = async (id: string) => {
        if (confirm(t('common.confirm_delete') || '¿Estás seguro?')) {
            const { error } = await supabase
                .from('delivery_drivers')
                .delete()
                .eq('id', id);
            if (error) alert(error.message);
            fetchDrivers();
        }
    };

    const handleAddCredits = async () => {
        if (!selectedDriver) return;

        const newCredits = selectedDriver.credits + creditAmount;

        // Update driver credits and log the transaction
        const { error: updateError } = await supabase
            .from('delivery_drivers')
            .update({ credits: newCredits })
            .eq('id', selectedDriver.id);

        if (updateError) {
            alert(updateError.message);
            return;
        }

        await supabase.from('driver_credit_logs').insert([{
            driver_id: selectedDriver.id,
            amount: creditAmount,
            type: 'purchase'
        }]);

        setIsCreditModalOpen(false);
        fetchDrivers();
    };

    const filteredDrivers = drivers.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {t('team.manage_drivers')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Administra los repartidores y sus créditos de transporte.
                    </p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary-500/20 transition-all transform active:scale-95"
                >
                    <UserPlus size={20} />
                    <span>{t('team.add_driver')}</span>
                </button>
            </div>

            {/* Search & Stats Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o correo..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-6 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Total Repartidores</span>
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{drivers.length}</span>
                    </div>
                    <div className="w-px h-8 bg-emerald-200 dark:bg-emerald-800/50"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Disponibles</span>
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                            {drivers.filter(d => d.isAvailable).length}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-3xl"></div>
                    ))
                ) : filteredDrivers.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserIcon className="text-gray-400" size={40} />
                        </div>
                        <p className="text-gray-500 font-medium">No se encontraron repartidores</p>
                    </div>
                ) : filteredDrivers.map((driver) => (
                    <div
                        key={driver.id}
                        className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center space-x-4">
                                    <div className="relative">
                                        {driver.profileImage ? (
                                            <img src={driver.profileImage} alt={driver.name} className="w-16 h-16 rounded-2xl object-cover" />
                                        ) : (
                                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center font-black text-2xl uppercase">
                                                {driver.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-gray-800 ${driver.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight group-hover:text-primary-600 transition-colors uppercase italic">{driver.name}</h3>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide inline-block mt-1 ${driver.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {driver.isAvailable ? 'Disponible' : 'No Disponible'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex space-x-1">
                                    <button onClick={() => handleOpenEditModal(driver)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDeleteDriver(driver.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18} /></button>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                    <Mail size={16} className="mr-3 opacity-50" />
                                    <span className="truncate">{driver.email}</span>
                                </div>
                                {driver.country && driver.city && (
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                        <Globe size={16} className="mr-3 opacity-50" />
                                        <span className="truncate">{driver.city}, {driver.country}</span>
                                    </div>
                                )}
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                    <Phone size={16} className="mr-3 opacity-50" />
                                    <span>{driver.phone || 'Sin teléfono'}</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                    <CreditCard size={16} className="mr-3 opacity-50" />
                                    <span className="font-mono bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">Lic: {driver.licenseNumber || '---'}</span>
                                </div>
                            </div>

                            {/* Performance Stats */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-3 flex flex-col items-center justify-center">
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Ganancias</span>
                                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                                        {(driver as any).currencySymbol || 'Bs'} {(driver.totalEarnings || 0).toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 flex flex-col items-center justify-center">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Entregas</span>
                                    <p className="text-sm font-black text-gray-700 dark:text-gray-200">{driver.ordersCompleted || 0}</p>
                                </div>
                            </div>

                            {/* Credits Section */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-4 flex items-center justify-between group-hover:scale-[1.02] transition-transform">
                                <div className="flex items-center">
                                    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm mr-3">
                                        <Coins size={20} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Saldo Créditos</span>
                                        <p className="text-xl font-black text-indigo-700 dark:text-indigo-200 leading-none">{driver.credits}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSelectedDriver(driver); setIsCreditModalOpen(true); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-90"
                                >
                                    {t('team.credits_label') || "Asignar"}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Driver Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20">
                        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic">
                                {editingDriver ? "Editar Repartidor" : "Nuevo Repartidor"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDriver} className="p-8 pt-2 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Nombre Completo</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-bold italic"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Correo Electrónico</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Contraseña</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Contraseña"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Teléfono</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">País</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-bold appearance-none cursor-pointer"
                                            value={formData.country}
                                            onChange={(e) => {
                                                setFormData({ ...formData, country: e.target.value, city: '' });
                                            }}
                                        >
                                            <option value="" disabled>Seleccione País</option>
                                            {COUNTRIES.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Ciudad / Departamento</label>
                                    <div className="relative">
                                        <select
                                            required
                                            className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-bold appearance-none cursor-pointer"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            disabled={!formData.country}
                                        >
                                            <option value="" disabled>Seleccione Ciudad</option>
                                            {getDepartmentsForCountry(formData.country).map(dep => (
                                                <option key={dep} value={dep}>{dep}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Nº Licencia</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.licenseNumber}
                                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Moneda (Símbolo)</label>
                                    <select
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-bold"
                                        value={formData.currencySymbol}
                                        onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                                    >
                                        <option value="Bs">Bs — Boliviano (Bolivia)</option>
                                        <option value="$">$ — Dólar (USD)</option>
                                        <option value="ARS">ARS — Peso Argentino</option>
                                        <option value="CLP">CLP — Peso Chileno</option>
                                        <option value="PEN">PEN — Sol (Perú)</option>
                                        <option value="COP">COP — Peso Colombiano</option>
                                        <option value="BRL">BRL — Real (Brasil)</option>
                                        <option value="MXN">MXN — Peso Mexicano</option>
                                        <option value="GTQ">GTQ — Quetzal (Guatemala)</option>
                                        <option value="USD">USD — Dólar Americano</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Créditos Iniciales</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all font-black text-lg"
                                        value={formData.credits}
                                        onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-4 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all uppercase tracking-tighter"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 rounded-2xl font-black bg-primary-600 text-white hover:bg-primary-700 shadow-xl shadow-primary-500/20 active:scale-95 transition-all uppercase tracking-tighter"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credits Modal */}
            {isCreditModalOpen && selectedDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-900/40 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up border border-indigo-100 dark:border-indigo-900/50">
                        <div className="p-8 text-center">
                            <div className="bg-indigo-100 dark:bg-indigo-950 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                                <Coins size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic leading-none mb-2">Asignar Créditos</h2>
                            <p className="text-gray-500 text-sm mb-8">Añadir créditos a <span className="font-black text-indigo-600">{selectedDriver.name}</span></p>

                            <div className="flex items-center justify-center space-x-6 mb-10">
                                <button
                                    onClick={() => setCreditAmount(Math.max(1, creditAmount - 1))}
                                    className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-900 text-gray-500 flex items-center justify-center hover:bg-gray-200"
                                >
                                    <Minus size={24} />
                                </button>
                                <span className="text-5xl font-black text-gray-900 dark:text-white tabular-nums w-20 tracking-tighter italic">{creditAmount}</span>
                                <button
                                    onClick={() => setCreditAmount(creditAmount + 1)}
                                    className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-500/30"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleAddCredits}
                                    className="w-full py-5 rounded-2xl font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all uppercase tracking-tighter"
                                >
                                    Confirmar Recarga
                                </button>
                                <button
                                    onClick={() => setIsCreditModalOpen(false)}
                                    className="w-full py-4 rounded-2xl font-bold text-gray-400 hover:text-gray-600 transition-all uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamRepartidor;
