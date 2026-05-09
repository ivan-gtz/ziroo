
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import { AlertCircle, LogOut, Phone } from 'lucide-react';
import Button from './ui/Button';

interface SubscriptionGuardProps {
    children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { currentUser, logout } = useAuth();
    const { currentRestaurant, systemSettings } = useRestaurant();

    // 1. If no user, let ProtectedRoute handle it (don't show anything)
    if (!currentUser) return null;

    // 2. SuperAdmin and DeliveryDrivers are exempt from subscription checks
    // Drivers are global (not bound to any restaurant), so they must never see a subscription wall.
    if (currentUser?.role === 'SuperAdmin' || (currentUser as any)?.role === 'DeliveryDriver') {
        return <>{children}</>;
    }

    const isExpired = currentRestaurant && currentRestaurant.endDate && new Date(currentRestaurant.endDate) < new Date();
    const isInactive = currentRestaurant && currentRestaurant.isActive === false;

    if (isExpired || isInactive) {
        const waNumber = systemSettings?.supportWhatsApp || '59178945612'; // Fallback if not configured
        const waMessage = encodeURIComponent(`Hola, mi suscripción en Ziroo chef ha ${isInactive ? 'sido desactivada' : 'vencido'} y me gustaría renovarla para seguir trabajando.`);
        const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-red-100 dark:border-red-900/30 p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {isInactive ? 'Acceso Desactivado' : 'Suscripción Finalizada'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            {isInactive
                                ? 'Tu restaurante ha sido desactivado por el administrador.'
                                : 'Tu suscripción ha vencido. Para seguir utilizando Ziroo chef, es necesario renovar tu plan.'}
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold">
                            <Phone size={18} />
                            <span>Contactar Soporte</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-relaxed">
                            Ponte en contacto con el administrador de Ziroo para reactivar tu cuenta y conservar todos tus datos.
                        </p>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <Button
                            onClick={() => window.open(waLink, '_blank')}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-2xl py-4 font-bold shadow-lg shadow-primary-600/20"
                        >
                            Ir a soporte
                        </Button>
                        <Button
                            variant="outline"
                            onClick={logout}
                            className="w-full rounded-2xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default SubscriptionGuard;
