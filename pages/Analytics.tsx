
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '../components/ui/Card';
import { OrderStatus } from '../types';
import { Calendar } from 'lucide-react';

const Analytics: React.FC = () => {
    const { t, orders, menuItems } = useAppContext();

    // Date Filtering State
    const [dateFilter, setDateFilter] = useState({
        startDate: new Date().toISOString().split('T')[0], // Default to today
        endDate: new Date().toISOString().split('T')[0],
        isAllTime: false // Default to Today for Analytics view, but can be toggled
    });

    const filteredDeliveredOrders = useMemo(() => {
        const delivered = orders.filter(o => o.status === OrderStatus.Delivered);

        if (dateFilter.isAllTime) {
            return delivered;
        }

        const start = new Date(dateFilter.startDate);
        const end = new Date(dateFilter.endDate);
        end.setHours(23, 59, 59, 999); // Include end date fully

        // Handle same day filtering correctly by ensuring start is 00:00:00
        const startDay = new Date(start);
        startDay.setHours(0, 0, 0, 0);

        return delivered.filter(o => {
            const d = new Date(o.timestamp);
            return d >= startDay && d <= end;
        });
    }, [orders, dateFilter]);

    const bestSellingProducts = useMemo(() => {
        // Create a mapping of UUIDs to standard names/keys for all products and variations
        const uuidKeyMap: Record<string, { key: string, name: string }> = {};
        menuItems.forEach(mi => {
            uuidKeyMap[mi.id] = { key: mi.id, name: mi.name };
            mi.variations?.forEach(v => {
                uuidKeyMap[v.id] = { key: `${mi.id}-${v.id}`, name: `${mi.name} (${v.name})` };
            });
        });

        const productCount: { [key: string]: { name: string, quantity: number } } = {};

        filteredDeliveredOrders.forEach(order => {
            order.items.forEach(item => {
                const key = item.variation ? `${item.menuItem.id}-${item.variation.id}` : item.menuItem.id;
                const name = item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name;

                if (!productCount[key]) {
                    productCount[key] = { name: name, quantity: 0 };
                }
                productCount[key].quantity += item.quantity;

                // ADDED: Include extras/companions in most sold counts
                if (item.selectedExtras && item.selectedExtras.length > 0) {
                    item.selectedExtras.forEach(extra => {
                        // Use uuidKeyMap to find the correct key and name for the component
                        const mapping = uuidKeyMap[extra.id];
                        const extraKey = mapping ? mapping.key : extra.id;
                        const extraName = mapping ? mapping.name : extra.name;

                        if (!productCount[extraKey]) {
                            productCount[extraKey] = { name: extraName, quantity: 0 };
                        }
                        // Extras quantity follows the main item quantity
                        productCount[extraKey].quantity += item.quantity;
                    });
                }
            });
        });

        return Object.values(productCount)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    }, [filteredDeliveredOrders]);

    return (
        <div className="text-gray-900 dark:text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>

                {/* Date Filter Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-500" />
                        <span className="text-sm font-semibold hidden sm:inline">{t('records.filter_date')}:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={dateFilter.isAllTime}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, isAllTime: e.target.checked }))}
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">{t('records.all_time')}</span>
                        </label>
                    </div>

                    {!dateFilter.isAllTime && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <input
                                type="date"
                                value={dateFilter.startDate}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={dateFilter.endDate}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <Card className="p-5">
                    <h2 className="text-xl font-semibold mb-4">{t('analytics.best_selling')}</h2>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={bestSellingProducts} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128, 128, 128, 0.3)" />
                            <XAxis type="number" tick={{ fill: 'currentColor' }} allowDecimals={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fill: 'currentColor', fontSize: 12 }}
                                width={100}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                                contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: 'none', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Bar dataKey="quantity" name={t('analytics.units_sold')} fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
};

export default Analytics;
