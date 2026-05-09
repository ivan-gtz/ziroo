
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { DeliveryZone } from '../types';
import { union } from '@turf/union';
import { polygon, featureCollection } from '@turf/helpers';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icon for restaurant
const restaurantIcon = L.divIcon({
    html: `<div class="bg-primary-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

interface DeliveryMapProps {
    onLocationSelect: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
    zones?: DeliveryZone[];
    restaurantLocation?: { lat: number; lng: number };
    isCustomerView?: boolean;
    limitDeliveryToZones?: boolean;
    /** Whether the currently selected marker is outside the delivery area (-1 fee signals this) */
    isOutsideZone?: boolean;
}

function LocationMarker({ onLocationSelect, position, setPosition }: {
    onLocationSelect: (lat: number, lng: number) => void,
    position: [number, number] | null,
    setPosition: (pos: [number, number]) => void
}) {
    const map = useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            setPosition([lat, lng]);
            onLocationSelect(lat, lng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
}

function RecenterMap({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.setView(position, map.getZoom());
        }
    }, [position, map]);
    return null;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({
    onLocationSelect,
    initialLat,
    initialLng,
    zones = [],
    restaurantLocation,
    isCustomerView = false,
    limitDeliveryToZones = false,
    isOutsideZone = false,
}) => {
    const { t } = useAppContext();
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setPosition([latitude, longitude]);
                    onLocationSelect(latitude, longitude);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert(t('common.error') || "Could not get location");
                },
                { enableHighAccuracy: true }
            );
        }
    };

    // Center on a default location if none provided (e.g. city center)
    const defaultCenter: [number, number] = restaurantLocation
        ? [restaurantLocation.lat, restaurantLocation.lng]
        : [-17.3935, -66.1570];

    const mergedCustomerZones = React.useMemo(() => {
        if (!isCustomerView || zones.length === 0) return [];

        const polys: any[] = [];

        zones.forEach(z => {
            const lngLats = z.points.map(p => [p.lng, p.lat]);
            if (lngLats.length < 3) return;
            // Close the polygon by ensuring the first and last points are the same
            if (lngLats[0][0] !== lngLats[lngLats.length - 1][0] || lngLats[0][1] !== lngLats[lngLats.length - 1][1]) {
                lngLats.push([...lngLats[0]]);
            }
            try {
                polys.push(polygon([lngLats]));
            } catch (e) {
                console.warn("Turf polygon error:", e);
            }
        });

        if (polys.length === 0) return [];

        let combined: any = null;
        try {
            combined = union(featureCollection(polys));
        } catch (e) {
            console.error("Turf union error - fallback to first zone:", e);
            combined = polys[0]; // fallback so it doesn't totally break
        }

        const rings: [number, number][][] = [];
        if (combined && combined.geometry) {
            if (combined.geometry.type === 'Polygon') {
                const coords = combined.geometry.coordinates; // array of rings. index 0 is outer ring
                rings.push(coords[0].map((pt: any) => [pt[1], pt[0]]));
            } else if (combined.geometry.type === 'MultiPolygon') {
                combined.geometry.coordinates.forEach((polyCoords: any) => {
                    rings.push(polyCoords[0].map((pt: any) => [pt[1], pt[0]]));
                });
            }
        }
        return rings;
    }, [isCustomerView, zones]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <MapPin size={18} className="text-primary-600" />
                    {t('delivery.mark_location')}
                </h4>
                <button
                    type="button"
                    onClick={handleLocateMe}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-full hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
                >
                    <Navigation size={14} />
                    {t('delivery.locate_me')}
                </button>
            </div>

            <div className="relative w-full h-80 rounded-[2rem] overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl z-0">
                <MapContainer
                    center={position || defaultCenter}
                    zoom={14}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {restaurantLocation && (
                        <Marker
                            position={[restaurantLocation.lat, restaurantLocation.lng]}
                            icon={restaurantIcon}
                        />
                    )}

                    {zones.map((zone, idx) => (
                        <Polygon
                            key={zone.id || idx}
                            positions={zone.points.map(p => [p.lat, p.lng] as [number, number])}
                            pathOptions={{
                                color: isCustomerView ? 'transparent' : (zone.color || '#3b82f6'),
                                fillColor: isCustomerView ? 'transparent' : (zone.color || '#3b82f6'),
                                fillOpacity: isCustomerView ? 0 : 0.15,
                                weight: isCustomerView ? 0 : 2
                            }}
                        >
                            {!isCustomerView && (
                                <Tooltip direction="center" opacity={0.8}>
                                    <div className="text-center font-bold">
                                        <p className="text-xs">{zone.name}</p>
                                        <p className="text-primary-600">{zone.price === 0 ? 'Gratis' : `Bs. ${zone.price}`}</p>
                                    </div>
                                </Tooltip>
                            )}
                        </Polygon>
                    ))}

                    {isCustomerView && limitDeliveryToZones && mergedCustomerZones.length > 0 && (
                        <>
                                <Polygon
                                    positions={[
                                        // Outer world ring
                                        [
                                            [-90, -360],
                                            [90, -360],
                                            [90, 360],
                                            [-90, 360],
                                            [-90, -360]
                                        ],
                                        // Inner holes (where we DO deliver)
                                        ...mergedCustomerZones
                                    ]}
                                    pathOptions={{
                                        stroke: false,
                                        fillColor: '#ef4444', // red-500
                                        fillOpacity: 0.35 // Increased opacity for better visibility of "danger" zone
                                    }}
                                />
                            {!isCustomerView && mergedCustomerZones.map((ring, idx) => (
                                <Polygon
                                    key={`boundary-${idx}`}
                                    positions={ring}
                                    pathOptions={{
                                        color: '#10b981', // green line
                                        fillColor: 'transparent',
                                        fillOpacity: 0,
                                        weight: 2,
                                        dashArray: '5,5'
                                    }}
                                />
                            ))}
                        </>
                    )}

                    <LocationMarker onLocationSelect={onLocationSelect} position={position} setPosition={setPosition} />
                    <RecenterMap position={position} />
                </MapContainer>
            </div>

            {/* Outside zone warning */}
            {isOutsideZone && position && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">
                        Tu ubicación está <strong>fuera del área de cobertura</strong>. Por favor selecciona un punto dentro de las zonas marcadas en el mapa.
                    </p>
                </div>
            )}

            {/* Zone legend - only visible in ADMIN view (not customer view) */}
            {!isCustomerView && zones.length > 0 && (
                <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                            Zonas de entrega disponibles
                        </p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {zones.map((zone, idx) => (
                            <div key={zone.id || idx} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className="inline-block w-3 h-3 rounded-full border border-white shadow"
                                        style={{ backgroundColor: zone.color || '#3b82f6' }}
                                    />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {zone.name}
                                    </span>
                                </div>
                                <span className={`text-sm font-black ${
                                    zone.price === 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                    {zone.price === 0 ? '✓ Gratis' : `Bs. ${zone.price}`}
                                </span>
                            </div>
                        ))}
                        {limitDeliveryToZones && (
                            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-50 dark:bg-red-900/10">
                                <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                    Fuera de estas zonas: sin cobertura de delivery
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic text-center px-4 leading-normal">
                {t('delivery.map_instruction')}
            </p>
        </div>
    );
};

export default DeliveryMap;
