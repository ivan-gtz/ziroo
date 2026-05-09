
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppContext } from '../context/AppContext';

const Layout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { systemSettings } = useAppContext();

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            {/* Main Content Wrapper */}
            <div className="relative flex flex-col flex-1 overflow-hidden">
                {/* Header is now sibling to the scrollable area, making it fixed */}
                <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900">
                    <main className="relative">
                        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
                            <Outlet />
                        </div>
                    </main>
                    {/* Footer */}
                    {systemSettings.appWebsiteUrl && (
                        <footer className="py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-center">
                            <a
                                href={systemSettings.appWebsiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-gray-400 hover:text-primary-500 transition-colors duration-200 tracking-wide uppercase"
                            >
                                Powered by Ziroo chef
                            </a>
                        </footer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Layout;
