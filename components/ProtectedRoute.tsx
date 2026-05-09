import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser } = useAppContext();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se especificaron roles permitidos, verificar si el usuario tiene uno de ellos
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    console.warn(`🚫 Acceso denegado para el rol ${currentUser.role} en la ruta ${location.pathname}`);
    return <Navigate to="/" replace />; // Redirigir al dashboard por defecto
  }

  return children;
};

export default ProtectedRoute;
