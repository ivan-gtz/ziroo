
import React, { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Phone, AlertCircle, Mail, Eye, EyeOff } from 'lucide-react';

const emptyUser: Omit<User, 'id' | 'branchId' | 'restaurantId'> = {
    name: '',
    phone: '',
    role: UserRole.Waiter,
    email: '',
    password_INSECURE: '',
};

const Users: React.FC = () => {
    const { t, users, addUser, updateUser, deleteUser, activeBranch, currentUser, updateCurrentUser } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [currentUserData, setCurrentUserData] = useState(emptyUser);
    const [showPassword, setShowPassword] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const [activeRoleFilter, setActiveRoleFilter] = useState<UserRole | 'All'>('All');

    const canManage = useMemo(() => currentUser?.role === 'SuperAdmin' || currentUser?.role === UserRole.Admin, [currentUser]);

    const openModalForNew = () => {
        setEditingUser(null);
        setCurrentUserData(emptyUser);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const openModalForEdit = (user: User) => {
        setEditingUser(user);
        const { name, phone, role, email, password_INSECURE } = user;
        setCurrentUserData({ name, phone, role, email, password_INSECURE });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentUserData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!canManage) return;
        try {
            if (editingUser) {
                const updated = { ...editingUser, ...currentUserData };
                await updateUser(updated);
                // If editing self, update current Auth session
                if (currentUser && editingUser.id === currentUser.id) {
                    updateCurrentUser(updated);
                }
            } else {
                await addUser(currentUserData);
            }
            closeModal();
        } catch (error) {
            console.error("Error saving user:", error);
            alert("Error al guardar el usuario. Por favor intente de nuevo.");
        }
    };

    const handleDeleteRequest = (id: string) => {
        setUserToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (userToDelete && canManage) {
            try {
                await deleteUser(userToDelete);
            } catch (error) {
                console.error("Error deleting user:", error);
                alert("Error al eliminar el usuario.");
            }
        }
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
    };

    const filteredUsers = useMemo(() => {
        if (activeRoleFilter === 'All') return users;
        return users.filter(user => user.role === activeRoleFilter);
    }, [users, activeRoleFilter]);

    const filterRoles = useMemo(() => {
        const roles = Object.values(UserRole);
        // Repartidor (DeliveryDriver) nunca se gestiona desde aquí, sino desde TeamRepartidor.tsx
        return roles.filter(role => role !== UserRole.DeliveryDriver);
    }, [currentUser]);

    if (!activeBranch) {
        return (
            <div>
                <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{t('sidebar.users')}</h1>
                <Card className="p-6 max-w-2xl mx-auto text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-primary-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">{t('settings.no_branch_selected')}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a branch to manage its users.</p>
                </Card>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('sidebar.users')}</h1>
                {canManage && (
                    <Button onClick={openModalForNew}>
                        <Plus size={16} className="mr-2" />
                        {t('users.add_user')}
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-8">
                <button
                    onClick={() => setActiveRoleFilter('All')}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${activeRoleFilter === 'All'
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                >
                    {t('all')}
                </button>
                {filterRoles.map(role => (
                    <button
                        key={role}
                        onClick={() => setActiveRoleFilter(role)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${activeRoleFilter === role
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                    >
                        {t(`users.role.${role}`)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map(user => (
                    <Card key={user.id} className="p-4 flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{user.name}</h3>
                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{t(`users.role.${user.role}`)}</p>
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                    <Mail size={14} className="mr-2 shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                </div>
                                <a
                                    href={`https://wa.me/${(user.phone || '').replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 group transition-colors duration-200"
                                    aria-label={`Chat with ${user.name} on WhatsApp`}
                                >
                                    <Phone size={14} className="mr-2 text-green-500 group-hover:text-primary-500 transition-colors shrink-0" />
                                    <span className="font-medium">{user.phone || 'N/A'}</span>
                                </a>
                            </div>
                        </div>
                        {canManage && (
                            <div className="flex justify-end space-x-2 mt-4">
                                <Button variant="secondary" size="sm" onClick={() => openModalForEdit(user)} aria-label={`Edit ${user.name}`}>
                                    <Edit size={14} />
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => handleDeleteRequest(user.id)} aria-label={`Delete ${user.name}`}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingUser ? t('users.edit_user') : t('users.add_user')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.name')}</label>
                        <input type="text" name="name" value={currentUserData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.email')}</label>
                        <input type="email" name="email" value={currentUserData.email} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.password')}</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password_INSECURE"
                                value={currentUserData.password_INSECURE === 'REDACTED' ? '' : currentUserData.password_INSECURE}
                                onChange={handleChange}
                                required={!editingUser}
                                placeholder={editingUser ? "•••••••• (Dejar en blanco para no cambiar)" : ""}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm pr-10"
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
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.phone')}</label>
                        <input type="tel" name="phone" value={currentUserData.phone} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.role')}</label>
                        <select name="role" value={currentUserData.role} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                            {filterRoles.map(role => <option key={role} value={role}>{t(`users.role.${role}`)}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="secondary" onClick={closeModal}>{t('menu.cancel')}</Button>
                        <Button type="submit">{t('menu.save')}</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title={t('users.delete_title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>{t('menu.cancel')}</Button>
                        <Button variant="danger" onClick={handleConfirmDelete}>{t('users.delete_user')}</Button>
                    </>
                }
            >
                <p className="text-gray-800 dark:text-gray-200">{t('users.delete_confirm')}</p>
            </Modal>
        </div>
    );
};

export default Users;
