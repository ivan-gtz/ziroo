
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { PagerState } from '../types';
import { Grid, RefreshCcw, CheckCircle, Clock, Circle } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const PagerTimer: React.FC<{ startTime: Date; fixedElapsed?: number }> = ({ startTime, fixedElapsed }) => {
    const [elapsed, setElapsed] = useState<number>(fixedElapsed || 0);

    useEffect(() => {
        if (fixedElapsed !== undefined && fixedElapsed !== null) {
            setElapsed(fixedElapsed);
            return;
        }

        const update = () => {
            const now = new Date().getTime();
            const start = new Date(startTime).getTime();
            setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
        }
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime, fixedElapsed]);

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`mt-2 text-sm font-mono font-bold flex items-center justify-center gap-1 opacity-80`}>
            <Clock size={14} />
            <span>{formatTime(elapsed)}</span>
        </div>
    );
};

const PagerController: React.FC = () => {
    const { t, pagerStatuses, updatePagerStatus, resetAllPagers, activeBranchId, currentRestaurant } = useAppContext();
    const [pendingChange, setPendingChange] = useState<{ id: number; nextState: PagerState } | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Security Check: Only allow Basic restaurants
    if (currentRestaurant?.type !== 'Basic') {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
                <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4">
                    <Grid size={48} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                    {t('common.access_denied') || 'Acceso Denegado'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Esta función solo está disponible para restaurantes de tipo Básico.
                </p>
            </div>
        );
    }

    // Generate numbers 1 to 24
    const pagers = Array.from({ length: 24 }, (_, i) => i + 1);

    const getNextState = (currentState: PagerState): PagerState => {
        if (currentState === 'inactive') return 'preparing';
        if (currentState === 'preparing') return 'ready';
        return 'inactive';
    };

    const handlePagerClick = (id: number) => {
        const current = pagerStatuses[id]?.state || 'inactive';
        const next = getNextState(current);
        setPendingChange({ id, nextState: next });
    };

    const confirmChange = () => {
        if (pendingChange) {
            updatePagerStatus(pendingChange.id, pendingChange.nextState);
            setPendingChange(null);
        }
    };

    const cancelChange = () => {
        setPendingChange(null);
    };

    const handleResetAll = () => {
        setShowResetConfirm(true);
    };

    const confirmReset = () => {
        resetAllPagers();
        setShowResetConfirm(false);
    };

    const getStateColor = (state: PagerState) => {
        switch (state) {
            case 'ready': return 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse border-green-600';
            case 'preparing': return 'bg-amber-500 text-white shadow-md border-amber-600 border-4';
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700';
        }
    };

    const getStateIcon = (state: PagerState) => {
        switch (state) {
            case 'ready': return <CheckCircle size={24} className="text-white" />;
            case 'preparing': return <Clock size={24} className="text-white" />;
            default: return <Circle size={24} />;
        }
    };

    const getStateLabel = (state: PagerState) => {
        switch (state) {
            case 'inactive': return t('pagers.inactive');
            case 'preparing': return t('pagers.preparing');
            case 'ready': return t('pagers.ready');
            default: return state;
        }
    };

    if (!activeBranchId) return <div>{t('settings.no_branch_selected')}</div>;

    return (
        <div className="pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                        <Grid className="mr-3 text-primary-500" /> {t('pagers.title')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('pagers.desc')}</p>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={handleResetAll}>
                        <RefreshCcw size={16} className="mr-2" /> {t('pagers.reset_all')}
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6 border-l-4 border-primary-500 flex items-center justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('pagers.legend')}</span>
                <div className="flex gap-3 text-xs font-bold">
                    <span className="flex items-center"><span className="w-3 h-3 bg-gray-300 rounded-full mr-1"></span> {t('pagers.inactive')}</span>
                    <span className="flex items-center"><span className="w-3 h-3 bg-amber-500 rounded-full mr-1"></span> {t('pagers.preparing')}</span>
                    <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span> {t('pagers.ready')}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {pagers.map(number => {
                    const status = pagerStatuses[number];
                    const state = status?.state || 'inactive';

                    return (
                        <button
                            key={number}
                            onClick={() => handlePagerClick(number)}
                            className={`
                        relative aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 p-2
                        ${getStateColor(state)}
                    `}
                        >
                            <div className="mb-2">{getStateIcon(state)}</div>
                            <span className="text-4xl font-black">{number}</span>
                            <span className="text-xs uppercase font-bold mt-2 mb-1 opacity-90">
                                {getStateLabel(state)}
                            </span>
                            {state !== 'inactive' && status?.timestamp && (
                                <PagerTimer startTime={status.timestamp} fixedElapsed={status.elapsed} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* State Change Confirmation Modal */}
            <Modal
                isOpen={!!pendingChange}
                onClose={cancelChange}
                title={t('pagers.confirm_change_title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={cancelChange}>{t('menu.cancel')}</Button>
                        <Button onClick={confirmChange}>{t('settings.confirm')}</Button>
                    </>
                }
            >
                {pendingChange && (
                    <p className="text-gray-800 dark:text-gray-200">
                        {t('pagers.confirm_change_desc', {
                            id: pendingChange.id.toString(),
                            status: getStateLabel(pendingChange.nextState)
                        })}
                    </p>
                )}
            </Modal>

            {/* Reset All Confirmation Modal */}
            <Modal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                title={t('pagers.confirm_reset_title')}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>{t('menu.cancel')}</Button>
                        <Button variant="danger" onClick={confirmReset}>{t('settings.confirm')}</Button>
                    </>
                }
            >
                <p className="text-gray-800 dark:text-gray-200">
                    {t('pagers.confirm_reset_desc')}
                </p>
            </Modal>
        </div>
    );
};

export default PagerController;