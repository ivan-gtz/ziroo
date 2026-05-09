
import React from 'react';
import { LogOut, Menu, BellRing } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Theme, Language, UserRole } from '../types';
import BranchSwitcher from './BranchSwitcher';
import { playSound } from '../utils/notifications';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
    const { theme, setTheme, language, setLanguage, currentUser, logout, t } = useAppContext();

    return (
        <header className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 -mb-px">
                    {/* Header: Left side */}
                    <div className="flex">
                        {/* Hamburger button */}
                        <button
                            className="text-gray-500 hover:text-gray-600 lg:hidden"
                            aria-controls="sidebar"
                            aria-expanded={sidebarOpen}
                            onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
                        >
                            <Menu size={24} />
                        </button>
                    </div>

                    {/* Header: Right side */}
                    <div className="flex items-center space-x-3">
                        <BranchSwitcher />
                        {/* Language Switch */}
                        <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                            <button onClick={() => setLanguage(Language.EN)} className={`px-2 py-1 text-sm rounded-full ${language === Language.EN ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}>EN</button>
                            <button onClick={() => setLanguage(Language.ES)} className={`px-2 py-1 text-sm rounded-full ${language === Language.ES ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}>ES</button>
                        </div>

                        {/* Theme Toggle */}
                        <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                            <button onClick={() => setTheme(Theme.Light)} className={`px-2 py-1 text-sm rounded-full ${theme === Theme.Light ? 'bg-white text-gray-800' : 'text-gray-500'}`}>
                                ☀️
                            </button>
                            <button onClick={() => setTheme(Theme.Dark)} className={`px-2 py-1 text-sm rounded-full ${theme === Theme.Dark ? 'bg-gray-900 text-gray-200' : 'text-gray-500'}`}>
                                🌙
                            </button>
                        </div>
                        <div className="border-l border-gray-200 dark:border-gray-700 pl-3 ml-3">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">
                                {t('header.hello')} {currentUser?.name}
                            </span>
                            <button onClick={logout} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ml-2" title="Logout">
                                <LogOut size={18} className="text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
