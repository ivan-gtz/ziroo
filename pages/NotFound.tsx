
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { UtensilsCrossed, Home, Search, ChefHat } from 'lucide-react';
import Button from '../components/ui/Button';

const NotFound: React.FC = () => {
    const { t } = useAppContext();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
                {/* Visual Section */}
                <div className="relative">
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/5 blur-3xl rounded-full scale-150 animate-pulse" />

                    {/* Animated Icons */}
                    <div className="relative flex justify-center items-center">
                        <div className="relative w-48 h-48 bg-white dark:bg-gray-900 rounded-full shadow-2xl flex items-center justify-center border-4 border-primary-500 overflow-hidden ring-8 ring-primary-500/20">
                            {/* 404 Numbers */}
                            <span className="absolute inset-0 flex items-center justify-center text-8xl font-black text-gray-100 dark:text-gray-800 pointer-events-none select-none">
                                404
                            </span>

                            {/* The "Chef" Looking around */}
                            <div className="relative z-10 animate-bounce">
                                <ChefHat size={80} className="text-primary-600 dark:text-primary-400" />
                            </div>
                        </div>

                        {/* Floating elements */}
                        <div className="absolute -top-4 -right-2 animate-bounce flex flex-col items-center" style={{ animationDelay: '0.2s' }}>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                                <Search className="text-primary-500 h-6 w-6" />
                            </div>
                        </div>
                        <div className="absolute bottom-4 -left-4 animate-bounce flex flex-col items-center" style={{ animationDelay: '0.5s' }}>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                                <UtensilsCrossed className="text-primary-500 h-6 w-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Text Section */}
                <div className="space-y-3 relative z-10">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        {t('error.404_title')}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed max-w-sm mx-auto">
                        {t('error.404_desc')}
                    </p>
                </div>

                {/* Action Section */}
                <div className="pt-4 relative z-10">
                    <Button
                        onClick={() => navigate('/')}
                        size="lg"
                        variant="primary"
                        className="rounded-full px-8 py-6 text-lg font-bold shadow-xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105 transition-all w-full flex items-center justify-center gap-2"
                    >
                        <Home className="h-5 w-5" />
                        {t('error.go_home')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
