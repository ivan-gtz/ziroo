
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { ChevronDown } from 'lucide-react';
import { UserRole } from '../../types';

const BranchSwitcher: React.FC = () => {
    const { t, branches, activeBranchId, setActiveBranchId, currentUser } = useAppContext();
    const navigate = useNavigate();

    // Only show the switcher for admin-level users
    const canSwitchBranches = currentUser?.role === 'SuperAdmin' || currentUser?.role === UserRole.Admin;

    if (!canSwitchBranches) {
        return null;
    }

    // Filter branches: SuperAdmin sees all, Restaurant Admin only sees APPROVED
    const visibleBranches = branches.filter(b =>
        currentUser?.role === 'SuperAdmin' ? true : (b.isApproved !== false)
    );

    // Si no hay sucursales visibles, no mostrar nada
    if (visibleBranches.length === 0) {
        console.warn('⚠️ No hay sucursales visibles para el usuario:', currentUser);
        return null;
    }

    console.log('✅ Sucursales visibles:', visibleBranches.length, visibleBranches.map(b => b.name));

    const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBranchId = e.target.value;
        if (newBranchId === 'all') {
            setActiveBranchId(''); // Set to empty to indicate overview
            navigate('/branches');
        } else {
            setActiveBranchId(newBranchId);
            // If user is on branches page, navigate to dashboard after selecting one
            if (window.location.hash === '#/branches') {
                navigate('/');
            }
        }
    };

    const onBranchesPage = window.location.hash === '#/branches';
    let selectValue = onBranchesPage ? 'all' : activeBranchId || 'all';

    const showAllOption = visibleBranches.length > 1;

    if (!showAllOption && selectValue === 'all' && visibleBranches.length > 0) {
        selectValue = visibleBranches[0].id;
    }

    return (
        <div className="relative">
            <select
                value={selectValue}
                onChange={handleBranchChange}
                className="appearance-none w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full pl-4 pr-10 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-primary-500"
                aria-label={t('header.select_branch')}
            >
                {showAllOption && <option value="all">{t('header.all_branches')}</option>}
                {visibleBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                        {branch.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700 dark:text-gray-200">
                <ChevronDown size={16} />
            </div>
        </div>
    );
};

export default BranchSwitcher;
