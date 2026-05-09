import React, { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

/**
 * Componente que detecta el branchId de la URL (si existe)
 * y lo establece como el branchId activo si no hay uno ya establecido.
 * Esto permite que el menú de clientes funcione en dispositivos no autenticados.
 */
const UrlBranchDetector: React.FC = () => {
    const { activeBranchId, setActiveBranchId } = useAppContext();
    const location = useLocation();

    useEffect(() => {
        // Rutas que pueden contener branchId
        // 1. /customer/branch/:branchId/table/:tableId
        // 2. /monitor/:branchId

        const customerMatch = matchPath({ path: "/customer/branch/:branchId/table/:tableId" }, location.pathname);
        const monitorMatch = matchPath({ path: "/monitor/:branchId" }, location.pathname);

        const urlBranchId = customerMatch?.params.branchId || monitorMatch?.params.branchId;

        if (urlBranchId && urlBranchId !== activeBranchId) {
            console.log("Detectado branchId en URL:", urlBranchId, ". Sincronizando contexto...");
            setActiveBranchId(urlBranchId);
        }
    }, [location.pathname, activeBranchId, setActiveBranchId]);

    return null; // Componente invisible
};

export default UrlBranchDetector;
