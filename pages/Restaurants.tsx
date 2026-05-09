import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useAppContext } from '../context/AppContext';
import { ManagedRestaurant } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Briefcase, ShieldAlert, Eye, EyeOff, Check, UserPlus, GitFork, Store, QrCode, Zap, Truck, Globe } from 'lucide-react';
import { COUNTRIES, getDepartmentsForCountry } from '../lib/locations';

type RestaurantStatus = 'Active' | 'Upcoming' | 'Expired';
type StatusFilter = RestaurantStatus | 'All';

const getStatus = (restaurant: ManagedRestaurant): RestaurantStatus => {
    const now = new Date();
    const start = new Date(restaurant.startDate);
    const end = new Date(restaurant.endDate);
    end.setHours(23, 59, 59, 999);

    if (now < start) return 'Upcoming';
    if (now > end) return 'Expired';
    return 'Active';
};

const emptyRestaurant: Omit<ManagedRestaurant, 'id'> = {
    name: '',
    address: '',
    phone: '',
    adminEmail: '',
    adminPassword_INSECURE: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
    })(),
    canCreateUsers: false,
    canCreateBranches: false,
    canCustomerView: true,
    canCustomizeAnimation: false,
    type: 'Full',
    country: 'BOLIVIA', // default
    city: ''
} as any;

const Restaurants: React.FC = () => {
    const { t, managedRestaurants, addManagedRestaurant, updateManagedRestaurant, deleteManagedRestaurant, currentUser, branches, approveBranch } = useAppContext();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRestaurant, setEditingRestaurant] = useState<ManagedRestaurant | null>(null);
    const [currentData, setCurrentData] = useState(emptyRestaurant);
    const [showPassword, setShowPassword] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

    const openModalForNew = () => {
        setEditingRestaurant(null);
        setCurrentData(emptyRestaurant);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const openModalForEdit = (restaurant: ManagedRestaurant) => {
        setEditingRestaurant(restaurant);
        setCurrentData({
            name: restaurant.name,
            address: restaurant.address || '',
            phone: restaurant.phone || '',
            adminEmail: restaurant.adminEmail,
            adminPassword_INSECURE: restaurant.adminPassword_INSECURE,
            startDate: restaurant.startDate ? restaurant.startDate.split('T')[0] : '',
            endDate: restaurant.endDate ? restaurant.endDate.split('T')[0] : '',
            canCreateUsers: restaurant.canCreateUsers,
            canCreateBranches: restaurant.canCreateBranches,
            canCustomerView: restaurant.canCustomerView !== undefined ? restaurant.canCustomerView : true,
            canCustomizeAnimation: restaurant.canCustomizeAnimation || false,
            delivery: restaurant.features?.delivery !== undefined ? restaurant.features.delivery : true,
            type: restaurant.type || 'Full',
            country: restaurant.country || 'BOLIVIA', // pre-fill
            city: restaurant.city || ''
        });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const closeModal = () => setIsModalOpen(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setCurrentData(prev => ({ ...prev, [e.target.name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting) return; // Prevention for double click
        setIsSubmitting(true);

        // Construct the full object expected by addManagedRestaurant
        const restaurantData = {
            ...currentData,
            isActive: true, // Default active
            features: {
                menuDigital: currentData.canCustomerView || true, // Mapping old field logic
                kitchenDisplay: true, // Default enabled
                inventory: true, // Default enabled
                reports: true, // Default enabled
                basicPagers: true,
                delivery: (currentData as any).delivery || true,
                whatsappNotifications: true
            }
        };

        if (editingRestaurant) {
            // Call with (id, partialUpdates) - the correct signature
            (updateManagedRestaurant as any)(editingRestaurant.id, restaurantData);
            closeModal();
            setIsSubmitting(false);
        } else {
            const success = await addManagedRestaurant(restaurantData);
            setIsSubmitting(false);
            if (success) {
                closeModal();
            }
        }
    };

    const handleDeleteRequest = (id: string) => {
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (itemToDelete) {
            deleteManagedRestaurant(itemToDelete);
        }
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
    };

    const handleTogglePermission = (restaurant: ManagedRestaurant, field: 'canCreateUsers' | 'canCreateBranches' | 'canCustomerView' | 'canCustomizeAnimation') => {
        const currentValue = restaurant[field] !== undefined ? restaurant[field] : (field === 'canCustomerView' ? true : false);
        // Call with (id, partialUpdates) - the correct signature in RestaurantContext
        (updateManagedRestaurant as any)(restaurant.id, { [field]: !currentValue });
    };

    const filteredRestaurants = useMemo(() => {
        if (statusFilter === 'All') return managedRestaurants;
        return managedRestaurants.filter(r => getStatus(r) === statusFilter);
    }, [managedRestaurants, statusFilter]);

    const statusColors: Record<RestaurantStatus, string> = {
        Active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        Upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        Expired: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    }

    const inputStyle = "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm";

    if (currentUser?.role !== 'SuperAdmin') {
        return (
            <div className="text-center py-16">
                <ShieldAlert size={48} className="mx-auto text-red-500" />
                <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">Access Denied</h3>
                <p className="mt-2 text-md text-gray-500">You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Briefcase className="mr-3" /> {t('restaurants.title')}
                </h1>
                <Button onClick={openModalForNew}>
                    <Plus size={16} className="mr-2" />
                    {t('restaurants.create')}
                </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-8">
                {(['All', 'Active', 'Upcoming', 'Expired'] as StatusFilter[]).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${statusFilter === status
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                    >
                        {t(`restaurants.status.${status.toLowerCase()}`)}
                    </button>
                ))}
            </div>

            {filteredRestaurants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRestaurants.map(resto => {
                        const status = getStatus(resto);
                        const pendingBranches = branches.filter(b =>
                            (b.restaurantId === resto.id || b.id.startsWith(resto.id)) &&
                            !b.isApproved
                        );
                        const approvedBranches = branches.filter(b =>
                            (b.restaurantId === resto.id || b.id.startsWith(resto.id)) &&
                            b.isApproved
                        );

                        return (
                            <Card key={resto.id} className="p-5 flex flex-col justify-between relative shadow-lg border-t-4 border-primary-500">
                                <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[status]}`}>
                                        {t(`restaurants.status.${status.toLowerCase()}`)}
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                                        {t(`restaurants.type.${resto.type || 'Full'}`)}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 pr-20">{resto.name}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{resto.adminEmail}</p>
                                    
                                    {(resto.country || resto.city) && (
                                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            <Globe size={14} className="mr-1 opacity-70" />
                                            <span>{[resto.city, resto.country].filter(Boolean).join(', ')}</span>
                                        </div>
                                    )}

                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 text-xs">
                                        {t('restaurants.subscription_period', { startDate: formatDate(resto.startDate), endDate: formatDate(resto.endDate) })}
                                    </p>

                                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t('restaurants.permissions')}</h4>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                                                <UserPlus size={16} className="mr-2" /> {t('restaurants.can_create_users')}
                                            </span>
                                            <button
                                                onClick={() => handleTogglePermission(resto, 'canCreateUsers')}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${resto.canCreateUsers ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resto.canCreateUsers ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                                                <GitFork size={16} className="mr-2" /> {t('restaurants.can_create_branches')}
                                            </span>
                                            <button
                                                onClick={() => handleTogglePermission(resto, 'canCreateBranches')}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${resto.canCreateBranches ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resto.canCreateBranches ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                                                <QrCode size={16} className="mr-2" /> {t('restaurants.can_customer_view')}
                                            </span>
                                            <button
                                                onClick={() => handleTogglePermission(resto, 'canCustomerView')}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${resto.canCustomerView !== false ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resto.canCustomerView !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                                                <Truck size={16} className="mr-2" /> {t('sidebar.delivery')}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    updateManagedRestaurant(resto.id, {
                                                        features: {
                                                            ...resto.features,
                                                            delivery: !resto.features?.delivery
                                                        }
                                                    });
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${resto.features?.delivery !== false ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resto.features?.delivery !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                                                <Zap size={16} className="mr-2" /> {t('restaurants.can_customize_animation')}
                                            </span>
                                            <button
                                                onClick={() => handleTogglePermission(resto, 'canCustomizeAnimation')}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${resto.canCustomizeAnimation ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${resto.canCustomizeAnimation ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('restaurants.pending_branches')}</h4>
                                        {pendingBranches.length > 0 ? (
                                            <ul className="space-y-2">
                                                {pendingBranches.map(branch => (
                                                    <li key={branch.id} className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md">
                                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{branch.name}</span>
                                                        <Button size="sm" className="!py-1 !px-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => approveBranch(branch.id)}>
                                                            <Check size={12} className="mr-1" /> {t('restaurants.approve_branch')}
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">{t('restaurants.no_pending_branches')}</p>
                                        )}
                                    </div>

                                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('restaurants.approved_branches')}</h4>
                                        {approvedBranches.length > 0 ? (
                                            <ul className="space-y-2">
                                                {approvedBranches.map(branch => (
                                                    <li key={branch.id} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                                                            <Store size={14} className="mr-2 text-green-600 dark:text-green-400" />
                                                            {branch.name}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">{t('restaurants.no_approved_branches')}</p>
                                        )}
                                    </div>

                                </div>
                                <div className="flex justify-end space-x-2 mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                                    <Button variant="secondary" size="sm" onClick={() => openModalForEdit(resto)}>
                                        <Edit size={14} className="mr-1" /> {t('menu.edit_item')}
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteRequest(resto.id)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <Briefcase size={48} className="mx-auto text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">{t('restaurants.no_restaurants')}</h3>
                    <p className="mt-1 text-sm text-gray-500">{t('restaurants.create')}</p>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingRestaurant ? t('restaurants.edit') : t('restaurants.create')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.name')}</label>
                        <input type="text" name="name" value={currentData.name} onChange={handleChange} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.address')}</label>
                        <input type="text" name="address" value={currentData.address} onChange={handleChange} placeholder="Ej: Av. Ayacucho entre Heroínas y Gral. Achá" className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.phone')}</label>
                        <input type="text" name="phone" value={currentData.phone} onChange={handleChange} className={inputStyle} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">País</label>
                            <select
                                name="country"
                                value={currentData.country}
                                onChange={(e) => {
                                    setCurrentData(prev => ({ ...prev, country: e.target.value, city: '' }));
                                }}
                                className={inputStyle}
                            >
                                <option value="" disabled>Seleccione País</option>
                                {COUNTRIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ciudad / Departamento</label>
                            <select
                                name="city"
                                value={currentData.city}
                                onChange={handleChange}
                                disabled={!currentData.country}
                                required
                                className={inputStyle}
                            >
                                <option value="" disabled>Seleccione Ciudad</option>
                                {getDepartmentsForCountry(currentData.country || '').map(dep => (
                                    <option key={dep} value={dep}>{dep}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Restaurant Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.type')}</label>
                        <select
                            name="type"
                            value={currentData.type}
                            onChange={handleChange}
                            className={inputStyle}
                        >
                            <option value="Full">{t('restaurants.type.Full')}</option>
                            <option value="Basic">{t('restaurants.type.Basic')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.admin_email')}</label>
                        <input type="email" name="adminEmail" value={currentData.adminEmail} onChange={handleChange} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.admin_password')}</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="adminPassword_INSECURE"
                                value={currentData.adminPassword_INSECURE}
                                onChange={handleChange}
                                required
                                className={`${inputStyle} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">{t('restaurants.password_warning')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.start_date')}</label>
                            <input type="date" name="startDate" value={currentData.startDate} onChange={handleChange} required className={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('restaurants.end_date')}</label>
                            <input type="date" name="endDate" value={currentData.endDate} onChange={handleChange} required className={inputStyle} />
                        </div>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('restaurants.permissions')}</h4>
                        <div className="flex items-center mb-2">
                            <input
                                id="canCreateUsers"
                                name="canCreateUsers"
                                type="checkbox"
                                checked={currentData.canCreateUsers}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="canCreateUsers" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                {t('restaurants.can_create_users')}
                            </label>
                        </div>
                        <div className="flex items-center mb-2">
                            <input
                                id="canCreateBranches"
                                name="canCreateBranches"
                                type="checkbox"
                                checked={currentData.canCreateBranches}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="canCreateBranches" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                {t('restaurants.can_create_branches')}
                            </label>
                        </div>
                        <div className="flex items-center mb-2">
                            <input
                                id="canCustomerView"
                                name="canCustomerView"
                                type="checkbox"
                                checked={currentData.canCustomerView}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="canCustomerView" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                {t('restaurants.can_customer_view')}
                            </label>
                        </div>
                        {/* NEW: Animation Customization Permission */}
                        <div className="flex items-center">
                            <input
                                id="canCustomizeAnimation"
                                name="canCustomizeAnimation"
                                type="checkbox"
                                checked={currentData.canCustomizeAnimation || false}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="canCustomizeAnimation" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                {t('restaurants.can_customize_animation')}
                            </label>
                        </div>
                        <div className="flex items-center">
                            <input
                                id="delivery"
                                name="delivery"
                                type="checkbox"
                                checked={(currentData as any).delivery || false}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="delivery" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                {t('sidebar.delivery')}
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>{t('menu.cancel')}</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : t('menu.save')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title={t('restaurants.delete_title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>{t('menu.cancel')}</Button>
                        <Button variant="danger" onClick={handleConfirmDelete}>{t('menu.delete')}</Button>
                    </>
                }
            >
                <p>{t('restaurants.delete_confirm')}</p>
            </Modal>
        </div>
    );
};

export default Restaurants;