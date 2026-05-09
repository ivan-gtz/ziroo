
import React, { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { ReceiptActionProvider } from './components/PrintingProvider';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Users from './pages/Users';
import Settings from './pages/Settings';
import WaiterOrder from './pages/WaiterOrder';
import KitchenDisplay from './pages/KitchenDisplay';
import CustomerMenu from './pages/CustomerMenu';
import DailySales from './pages/DailySales';
import Analytics from './pages/Analytics';
import OnlineMonitor from './pages/OnlineMonitor';
import Branches from './pages/Branches';
import TotalRecords from './pages/TotalRecords';
import Restaurants from './pages/Restaurants';
import Earnings from './pages/Earnings';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomeScreen from './components/WelcomeScreen';
import PagerController from './pages/PagerController';
import DeliveryTracking from './pages/DeliveryTracking';
import DeliveryManagement from './pages/DeliveryManagement';
import UrlBranchDetector from './components/UrlBranchDetector';
import NotificationManager from './components/NotificationManager';
import BrandingManager from './components/BrandingManager';
import SubscriptionGuard from './components/SubscriptionGuard';
import TeamRepartidor from './pages/TeamRepartidor';
import DeliveryDriver from './pages/DeliveryDriver';
import UsageMonitor from './pages/UsageMonitor';

import NotFound from './pages/NotFound';

function AppContent() {
  const { currentUser, isShowingWelcome, setIsShowingWelcome, loading } = useAppContext();
  const [initialBoot, setInitialBoot] = React.useState(true);

  // Optimized Boot Logic - Only show animation once
  useEffect(() => {
    // If we're already loaded (e.g. valid session), don't force a long wait
    const delay = (!loading && currentUser) ? 100 : 800;

    const timer = setTimeout(() => {
      setInitialBoot(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [loading, currentUser]);

  useEffect(() => {
    if (!initialBoot && isShowingWelcome) {
      const timer = setTimeout(() => {
        setIsShowingWelcome(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isShowingWelcome, setIsShowingWelcome, initialBoot]);

  // Show professional animation ONLY during initial critical load
  if (initialBoot || (loading && !currentUser)) {
    return <WelcomeScreen />;
  }

  return (
    <>
      <UrlBranchDetector />
      <NotificationManager />
      <BrandingManager />
      <Routes>
        {/* Public Routes */}
        <Route path="/customer/branch/:branchId/table/:tableId" element={<CustomerMenu />} />
        <Route path="/monitor/:branchId" element={<OnlineMonitor />} />
        <Route path="/delivery/:branchId" element={<DeliveryTracking />} />

        {/* Auth Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><SubscriptionGuard><Layout /></SubscriptionGuard></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="restaurants" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><Restaurants /></ProtectedRoute>} />
          <Route path="earnings" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><Earnings /></ProtectedRoute>} />
          <Route path="menu" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><MenuManagement /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'Waiter', 'Cashier']}><Inventory /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'Waiter', 'Cashier']}><WaiterOrder /></ProtectedRoute>} />
          <Route path="kitchen" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'Cook', 'Cashier', 'Waiter']}><KitchenDisplay /></ProtectedRoute>} />
          <Route path="sales" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><DailySales /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><Analytics /></ProtectedRoute>} />
          <Route path="records" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><TotalRecords /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><Users /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><Settings /></ProtectedRoute>} />
          <Route path="delivery-mgmt" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'Cashier']}><DeliveryManagement /></ProtectedRoute>} />
          <Route path="branches" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}><Branches /></ProtectedRoute>} />
          <Route path="pagers" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'Waiter', 'Cashier']}><PagerController /></ProtectedRoute>} />
          <Route path="team-repartidor" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><TeamRepartidor /></ProtectedRoute>} />
          <Route path="repartidor" element={<ProtectedRoute allowedRoles={['SuperAdmin', 'DeliveryDriver']}><DeliveryDriver /></ProtectedRoute>} />
          <Route path="usage" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><UsageMonitor /></ProtectedRoute>} />
        </Route>

        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}


function App() {
  return (
    <HashRouter>
      <AppProvider>
        <ReceiptActionProvider>
          <AppContent />
        </ReceiptActionProvider>
      </AppProvider>
    </HashRouter>
  );
}

export default App;
