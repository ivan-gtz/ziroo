
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Trash2, Plus, MousePointer2, Map as MapIcon, Save, X, Navigation } from 'lucide-react';
import { DeliveryZone } from '../types';
import Button from './ui/Button';

interface DeliveryZoneEditorProps {
    zones: DeliveryZone[];
    onZonesChange: (zones: DeliveryZone[]) => void;
    restaurantLocation?: { lat: number; lng: number };
    onLocationChange: (loc: { lat: number; lng: number }) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DeliveryZoneEditor: React.FC<DeliveryZoneEditorProps> = ({
    zones,
    onZonesChange,
    restaurantLocation,
    onLocationChange
}) => {
    const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeTab, setActiveTab] = useState<'list' | 'config'>('list');

    // Default center for Bolivia/Cochabamba if no location set
    const defaultCenter: [number, number] = restaurantLocation
        ? [restaurantLocation.lat, restaurantLocation.lng]
        : [-17.3935, -66.1570];

    const MapEvents = () => {
        useMapEvents({
            click(e) {
                if (isDrawing) {
                    setDrawingPoints([...drawingPoints, { lat: e.latlng.lat, lng: e.latlng.lng }]);
                } else if (!restaurantLocation) {
                    onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
                }
            },
        });
        return null;
    };

    const handleAddZone = () => {
        if (drawingPoints.length < 3) {
            alert('Debes marcar al menos 3 puntos en el mapa para crear una zona.');
            return;
        }
        const newZone: DeliveryZone = {
            id: Date.now().toString(),
            name: `Zona ${zones.length + 1}`,
            price: 0,
            points: [...drawingPoints],
            color: COLORS[zones.length % COLORS.length]
        };
        onZonesChange([...zones, newZone]);
        setDrawingPoints([]);
        setIsDrawing(false);
    };

    const handleRemoveZone = (id: string) => {
        onZonesChange(zones.filter(z => z.id !== id));
    };

    const handleUpdateZone = (id: string, updates: Partial<DeliveryZone>) => {
        onZonesChange(zones.map(z => z.id === id ? { ...z, ...updates } : z));
    };

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                onLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            });
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-gray-200 dark:border-gray-800">
            {/* Sidebar Control */}
            <div className="lg:col-span-1 space-y-4 h-[500px] overflow-y-auto pr-2">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                        <Navigation size={14} className="text-primary-500" /> Ubicación Base
                    </h3>
                    {!restaurantLocation ? (
                        <div className="text-center py-4 px-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            <p className="text-xs text-gray-500 mb-3">Haz clic en el mapa para marcar la ubicación de tu restaurante.</p>
                            <Button size="sm" onClick={handleLocateMe} variant="secondary" className="w-full">
                                <Navigation size={14} className="mr-2" /> Detectar mi ubicación
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                            <div className="truncate pr-2">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Ubicación Fijada</p>
                                <p className="text-xs font-mono truncate">{restaurantLocation.lat.toFixed(5)}, {restaurantLocation.lng.toFixed(5)}</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => onLocationChange(undefined as any)} className="!p-2">
                                <Trash2 size={14} className="text-red-500" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <MapIcon size={14} className="text-indigo-500" /> Zonas de Envío
                        </h3>
                        {!isDrawing ? (
                            <Button size="sm" onClick={() => setIsDrawing(true)} className="!py-1 !px-3">
                                <Plus size={14} className="mr-1" /> Dibujar
                            </Button>
                        ) : (
                            <Button size="sm" variant="danger" onClick={() => { setIsDrawing(false); setDrawingPoints([]); }} className="!py-1 !px-3">
                                <X size={14} className="mr-1" /> Cancelar
                            </Button>
                        )}
                    </div>

                    {isDrawing && (
                        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-pulse">
                            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">Modo Dibujo Activo</p>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mb-3">Haz clic en el mapa para marcar los límites de la zona. Se necesitan al menos 3 puntos.</p>
                            <div className="flex gap-2">
                                <Button size="sm" className="w-full" disabled={drawingPoints.length < 3} onClick={handleAddZone}>
                                    <Save size={14} className="mr-1" /> Guardar Zona
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {zones.length === 0 && !isDrawing && (
                            <div className="text-center py-8 opacity-50 italic text-sm">
                                <p>No hay zonas configuradas.</p>
                            </div>
                        )}
                        {zones.map((zone) => (
                            <div key={zone.id} className="p-3 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                                    <input
                                        type="text"
                                        value={zone.name}
                                        onChange={(e) => handleUpdateZone(zone.id, { name: e.target.value })}
                                        className="bg-transparent text-sm font-bold w-full focus:outline-none focus:border-b border-primary-500"
                                    />
                                    <button onClick={() => handleRemoveZone(zone.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Precio:</span>
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            value={zone.price}
                                            onChange={(e) => handleUpdateZone(zone.id, { price: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg text-xs p-1 px-2 focus:ring-1 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="lg:col-span-2 relative h-[500px] rounded-[2rem] overflow-hidden shadow-inner border-4 border-white dark:border-gray-800 z-0">
                <MapContainer center={defaultCenter} zoom={13} className="h-full w-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapEvents />

                    {restaurantLocation && (
                        <Marker position={[restaurantLocation.lat, restaurantLocation.lng]} />
                    )}

                    {zones.map(zone => (
                        <Polygon
                            key={zone.id}
                            positions={zone.points.map(p => [p.lat, p.lng] as [number, number])}
                            pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.2 }}
                        />
                    ))}

                    {isDrawing && drawingPoints.length > 0 && (
                        <>
                            {drawingPoints.map((p, i) => (
                                <Marker key={i} position={[p.lat, p.lng]} icon={L.divIcon({ className: 'bg-indigo-500 w-2 h-2 rounded-full border-2 border-white' })} />
                            ))}
                            {drawingPoints.length >= 2 && (
                                <Polygon
                                    positions={drawingPoints.map(p => [p.lat, p.lng] as [number, number])}
                                    pathOptions={{ color: '#6366f1', dashArray: '5, 10', fillOpacity: 0.1 }}
                                />
                            )}
                        </>
                    )}
                </MapContainer>

                {/* Legend or Map Utility Floating */}
                <div className="absolute top-4 right-4 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-xl p-2 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                    <button className={`p-2 rounded-xl transition-all ${!isDrawing ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 text-gray-500'}`} title="Modo Cursor" onClick={() => setIsDrawing(false)}>
                        <MousePointer2 size={18} />
                    </button>
                    <button className={`p-2 rounded-xl transition-all ${isDrawing ? 'bg-indigo-500 text-white' : 'hover:bg-gray-100 text-gray-500'}`} title="Modo Dibujo" onClick={() => setIsDrawing(true)}>
                        <Plus size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryZoneEditor;
