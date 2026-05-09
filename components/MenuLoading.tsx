
import React from 'react';
import { Utensils, ChefHat, Coffee, Pizza } from 'lucide-react';

const MenuLoading: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute top-10 left-10 animate-bounce delay-100">
                    <Pizza size={48} className="text-orange-500" />
                </div>
                <div className="absolute bottom-20 right-20 animate-bounce delay-700">
                    <Coffee size={40} className="text-brown-500 text-gray-700" />
                </div>
                <div className="absolute top-1/2 left-20 animate-pulse delay-300">
                    <ChefHat size={32} className="text-gray-400" />
                </div>
            </div>

            <div className="relative flex flex-col items-center">
                <div className="relative">
                    {/* Pulsing Circle */}
                    <div className="absolute inset-0 bg-primary-500 rounded-full blur-xl opacity-20 animate-ping"></div>

                    <div className="relative bg-white dark:bg-gray-800 p-6 rounded-full shadow-xl border-4 border-primary-100 dark:border-primary-900 animate-bounce-subtle">
                        <Utensils size={64} className="text-primary-600 dark:text-primary-400 animate-wiggle" />
                    </div>
                </div>

                <h2 className="mt-8 text-2xl font-black text-gray-900 dark:text-white uppercase tracking-widest animate-pulse">
                    Cargando Menú
                </h2>
                <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400 animate-fade-in-up">
                    Preparando los mejores platillos para ti...
                </p>

                {/* Progress Bar styled */}
                <div className="mt-8 w-48 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 dark:bg-primary-500 animate-progress-indeterminate rounded-full"></div>
                </div>
            </div>

            <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes progress-indeterminate {
            0% { width: 0%; margin-left: 0; }
            50% { width: 70%; margin-left: 30%; }
            100% { width: 0%; margin-left: 100%; }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
        .animate-wiggle {
          animation: wiggle 1s infinite ease-in-out;
        }
        .animate-progress-indeterminate {
            animation: progress-indeterminate 1.5s infinite ease-in-out;
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default MenuLoading;
