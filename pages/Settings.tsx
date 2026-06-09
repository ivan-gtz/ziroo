
import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { BranchSettings, SystemSettings, AnimationConfig } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { compressImageToBlob } from '../lib/imageUtils';
import { uploadToStorage } from '../lib/storageUtils';
import { AlertCircle, Upload, FileSpreadsheet, FileText, History, Printer, Download, MapPin, Truck, Globe, Share2, BarChart as BarChartIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateYearlyReportData, downloadYearlyExcel, downloadYearlyPDF, downloadRCVExcel, downloadRCVPDF } from '../utils/reportGenerator';
import { useReceiptActions } from '../components/PrintingProvider';
import DeliveryZoneEditor from '../components/DeliveryZoneEditor';
import { DeliveryZone } from '../types';
import { COUNTRIES, getDepartmentsForCountry } from '../lib/locations';
import { TEXT_LIMITS, sanitizeInput, validateImageFile } from '../lib/securityUtils';

const Settings: React.FC = () => {
    const { t, activeBranch, saveBranchSettings, activeBranchId, currentUser, managedRestaurants, updateSuperAdminCreds, superAdminCreds, systemSettings, updateSystemSettings, currentRestaurant, orders, expenses, allMonthlySummaries, allSettings, settingsLoading } = useAppContext();
    const { printRawBt, printKitchenRawBt } = useReceiptActions();
    const navigate = useNavigate();

    // Yearly Report State
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

    // Local state for Branch Settings
    const [restaurantName, setRestaurantName] = useState('');
    const [currency, setCurrency] = useState('');
    const [socialLinks, setSocialLinks] = useState({ facebook: '', instagram: '', tiktok: '', youtube: '' });
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [qrPayeeName, setQrPayeeName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [enableTaxInvoice, setEnableTaxInvoice] = useState(true);
    const [enableKitchenPrint, setEnableKitchenPrint] = useState(false);
    const [isMenuEnabled, setIsMenuEnabled] = useState(true);
    const [enableDelivery, setEnableDelivery] = useState(false);
    const [deliveryCost, setDeliveryCost] = useState<number>(0);
    const [restaurantMapsLink, setRestaurantMapsLink] = useState('');
    const [restaurantLocation, setRestaurantLocation] = useState<{ lat: number; lng: number } | undefined>();
    const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
    const [limitDeliveryToZones, setLimitDeliveryToZones] = useState(false);
    const [enableSound, setEnableSound] = useState(true);
    const [enableVibration, setEnableVibration] = useState(true);



    // Fiscal Info
    const [taxId, setTaxId] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [economicActivity, setEconomicActivity] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('BOLIVIA');
    const [fiscalNit, setFiscalNit] = useState('');
    const [fiscalBusinessName, setFiscalBusinessName] = useState('');
    const [fiscalAuthorization, setFiscalAuthorization] = useState('');
    const [fiscalMunicipio, setFiscalMunicipio] = useState('');
    const [fiscalSucursalCode, setFiscalSucursalCode] = useState(0);
    const [fiscalLegend, setFiscalLegend] = useState('');

    // Animation Config
    const [animationConfig, setAnimationConfig] = useState<AnimationConfig>({ backgroundColor: '#06c167', textColor: '#ffffff', text: 'Ziroo chef', logoUrl: '' });

    // Super Admin Settings
    const [superAdminEmail, setSuperAdminEmail] = useState('');
    const [superAdminPass, setSuperAdminPass] = useState('');

    const [appWebsiteUrl, setAppWebsiteUrl] = useState('');
    const [logoSidebar, setLogoSidebar] = useState('');
    const [logoLogin, setLogoLogin] = useState('');
    const [logoAnimation, setLogoAnimation] = useState('');
    const [appTitle, setAppTitle] = useState('Ziroo chef');
    const [faviconUrl, setFaviconUrl] = useState('');
    const [supportWhatsApp, setSupportWhatsApp] = useState('');
    const [pwaIconUrl, setPwaIconUrl] = useState('');

    // Pending images local state to prevent clobbering (Use Blob to avoid Base64 memory/database errors)
    const [pendingLogo, setPendingLogo] = useState<Blob | null>(null);
    const [pendingQR, setPendingQR] = useState<Blob | null>(null);
    const [pendingAnimLogo, setPendingLocalAnimLogo] = useState<Blob | null>(null);

    const [pendingLogoSidebar, setPendingLogoSidebar] = useState<Blob | null>(null);
    const [pendingLogoLogin, setPendingLogoLogin] = useState<Blob | null>(null);
    const [pendingLogoAnimation, setPendingLogoAnimation] = useState<Blob | null>(null);
    const [pendingFavicon, setPendingFavicon] = useState<Blob | null>(null);
    const [pendingPwaIcon, setPendingPwaIcon] = useState<Blob | null>(null);

    // Image previews using Object URL, never saving base64 to db
    const [previewLogo, setPreviewLogo] = useState<string | null>(null);
    const [previewQR, setPreviewQR] = useState<string | null>(null);
    const [previewAnimLogo, setPreviewAnimLogo] = useState<string | null>(null);
    const [previewLogoSidebar, setPreviewLogoSidebar] = useState<string | null>(null);
    const [previewLogoLogin, setPreviewLogoLogin] = useState<string | null>(null);
    const [previewLogoAnimation, setPreviewLogoAnimation] = useState<string | null>(null);
    const [previewFavicon, setpreviewFavicon] = useState<string | null>(null);
    const [previewPwaIcon, setpreviewPwaIcon] = useState<string | null>(null);

    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const canCustomizeAnimation = currentUser?.role === 'SuperAdmin' || currentRestaurant?.canCustomizeAnimation;

    const [isSaving, setIsSaving] = useState(false);

    const lastInitBranchId = useRef<string | null>(null);

    useEffect(() => {
        // 🛡️ CRITICAL FIX: Only initialize form if we HAVE data in allSettings for this branch.
        // Also tracks which branch was last initialized to prevent clobbering while typing.
        if (activeBranchId && allSettings[activeBranchId]) {
            // Only update local state if we haven't initialized for this specific branch yet
            if (lastInitBranchId.current !== activeBranchId) {
                const s = allSettings[activeBranchId];
                setRestaurantName(s.restaurantName || '');
                setCurrency(s.currency || '');
                setSocialLinks(s.socialLinks || { facebook: '', instagram: '', tiktok: '', youtube: '' });
                setWebsiteUrl(s.websiteUrl || '');
                setQrPayeeName(s.qrPayeeName || '');
                setAddress(s.address || '');
                setPhone(s.phone || '');
                setEnableTaxInvoice(s.enableTaxInvoice !== false);
                setEnableKitchenPrint(s.enableKitchenPrint || false);
                setIsMenuEnabled(s.isMenuEnabled !== false);
                setEnableDelivery(s.enableDelivery || false);
                setLimitDeliveryToZones(s.limitDeliveryToZones || false);
                setDeliveryCost(s.deliveryCost || 0);
                setEnableSound(s.enableSound !== false);
                setEnableVibration(s.enableVibration !== false);

                setTaxId(s.taxId || '');
                setBusinessName(s.businessName || '');
                setEconomicActivity(s.economicActivity || '');
                setCity(s.city || '');
                setCountry(s.country || 'BOLIVIA');
                setFiscalNit(s.fiscalNit || '');
                setFiscalBusinessName(s.fiscalBusinessName || '');
                setFiscalAuthorization(s.fiscalAuthorization || '');
                setFiscalMunicipio(s.fiscalMunicipio || '');
                setFiscalSucursalCode(s.fiscalSucursalCode || 0);
                setFiscalLegend(s.fiscalLegend || '');
                setRestaurantMapsLink(s.restaurantMapsLink || '');
                setRestaurantLocation(s.restaurantLocation);
                setDeliveryZones(s.deliveryZones || []);

                setAnimationConfig(s.animationConfig || { backgroundColor: '#06c167', textColor: '#ffffff', text: 'Ziroo chef', logoUrl: '' });

                lastInitBranchId.current = activeBranchId;
                console.log("⚙️ Settings form initialized for branch:", activeBranchId);
            }
        }

        if (isSuperAdmin && lastInitBranchId.current !== 'superadmin-meta') {
            setSuperAdminEmail(superAdminCreds.email);
            setSuperAdminPass(superAdminCreds.password_INSECURE);
            setAppWebsiteUrl(systemSettings.appWebsiteUrl || '');
            setLogoSidebar(systemSettings.logoSidebar || '');
            setLogoLogin(systemSettings.logoLogin || '');
            setLogoAnimation(systemSettings.logoAnimation || '');
            setAppTitle(systemSettings.appTitle || 'Ziroo chef');
            setFaviconUrl(systemSettings.faviconUrl || '');
            setSupportWhatsApp(systemSettings.supportWhatsApp || '');
            setPwaIconUrl(systemSettings.pwaIconUrl || '');

            // For SuperAdmin visual meta, we can use a special flag if they are not in a branch
            if (!activeBranchId) lastInitBranchId.current = 'superadmin-meta';
        }
    }, [activeBranchId, isSuperAdmin, allSettings, superAdminCreds, systemSettings]); // Added allSettings to capture data arrival

    const handleSaveBranchSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeBranchId || isSaving) return;
        setIsSaving(true);

        try {
            const newSettings: Partial<BranchSettings> = {
                restaurantName: sanitizeInput(restaurantName),
                currency: sanitizeInput(currency),
                socialLinks: { 
                    facebook: sanitizeInput(socialLinks.facebook),
                    instagram: sanitizeInput(socialLinks.instagram),
                    tiktok: sanitizeInput(socialLinks.tiktok),
                    youtube: sanitizeInput(socialLinks.youtube)
                },
                websiteUrl: sanitizeInput(websiteUrl),
                qrPayeeName: sanitizeInput(qrPayeeName),
                address: sanitizeInput(address),
                phone: sanitizeInput(phone),
                enableTaxInvoice,
                enableKitchenPrint,
                taxId: sanitizeInput(taxId),
                businessName: sanitizeInput(businessName),
                economicActivity: sanitizeInput(economicActivity),
                city: sanitizeInput(city),
                country,
                fiscalNit: sanitizeInput(fiscalNit),
                fiscalBusinessName: sanitizeInput(fiscalBusinessName),
                fiscalAuthorization: sanitizeInput(fiscalAuthorization),
                fiscalMunicipio: sanitizeInput(fiscalMunicipio || city), // fallback to city if empty
                fiscalSucursalCode,
                fiscalLegend: sanitizeInput(fiscalLegend),

                animationConfig: {
                    ...animationConfig,
                    text: sanitizeInput(animationConfig.text)
                },
                isMenuEnabled,
                enableDelivery,
                limitDeliveryToZones,
                deliveryCost,
                restaurantMapsLink: sanitizeInput(restaurantMapsLink),
                restaurantLocation,
                deliveryZones,
                enableSound,
                enableVibration
            };

            // 📤 UPLOAD TO STORAGE
            if (pendingLogo) {
                const url = await uploadToStorage(`${activeBranchId}/logo.png`, pendingLogo);
                newSettings.logoImage = url;
            }
            if (pendingQR) {
                const url = await uploadToStorage(`${activeBranchId}/qr.png`, pendingQR);
                newSettings.qrImage = url;
            }
            if (pendingAnimLogo) {
                const url = await uploadToStorage(`${activeBranchId}/animation_logo.png`, pendingAnimLogo);
                newSettings.animationConfig = { ...animationConfig, logoUrl: url };
            }


            await saveBranchSettings(newSettings);

            setPendingLogo(null);
            setPendingQR(null);
            setPendingLocalAnimLogo(null);
            setPreviewLogo(null);
            setPreviewQR(null);
            setPreviewAnimLogo(null);
            alert(t('settings.save_success'));
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSuperAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const systemUpdate: Partial<SystemSettings> = { appWebsiteUrl, appTitle, supportWhatsApp, pwaIconUrl };

            // 📤 UPLOAD SYSTEM IMAGES
            if (pendingLogoSidebar) systemUpdate.logoSidebar = await uploadToStorage('system/sidebar.png', pendingLogoSidebar);
            if (pendingLogoLogin) systemUpdate.logoLogin = await uploadToStorage('system/login.png', pendingLogoLogin);
            if (pendingLogoAnimation) systemUpdate.logoAnimation = await uploadToStorage('system/animation.png', pendingLogoAnimation);
            if (pendingFavicon) systemUpdate.faviconUrl = await uploadToStorage('system/favicon.png', pendingFavicon);
            if (pendingPwaIcon) systemUpdate.pwaIconUrl = await uploadToStorage('system/pwa_icon.png', pendingPwaIcon);

            await updateSuperAdminCreds(superAdminEmail, superAdminPass);
            await updateSystemSettings(systemUpdate);

            setPendingLogoSidebar(null);
            setPendingLogoLogin(null);
            setPendingLogoAnimation(null);
            setPendingFavicon(null);
            setPendingPwaIcon(null);
            setPreviewLogoSidebar(null);
            setPreviewLogoLogin(null);
            setPreviewLogoAnimation(null);
            setpreviewFavicon(null);
            setpreviewPwaIcon(null);
            alert('System settings saved!');
        } catch (error) {
            alert('Error saving system settings');
        }
    };

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: 'qrImage' | 'logoImage' | 'animLogo') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validation = validateImageFile(file);
            if (!validation.valid) {
                alert(validation.error);
                e.target.value = "";
                return;
            }
            try {
                // NEVER return base64 for upload, use Blob directly
                const blob = await compressImageToBlob(file);
                const objUrl = URL.createObjectURL(blob);
                if (field === 'animLogo') { setPendingLocalAnimLogo(blob); setPreviewAnimLogo(objUrl); }
                else if (field === 'logoImage') { setPendingLogo(blob); setPreviewLogo(objUrl); }
                else if (field === 'qrImage') { setPendingQR(blob); setPreviewQR(objUrl); }
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleSystemLogoUpload = async (e: ChangeEvent<HTMLInputElement>, field: 'logoSidebar' | 'logoLogin' | 'logoAnimation' | 'favicon' | 'pwaIcon') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validation = validateImageFile(file);
            if (!validation.valid) {
                alert(validation.error);
                e.target.value = "";
                return;
            }
            try {
                const blob = await compressImageToBlob(file);
                const objUrl = URL.createObjectURL(blob);
                if (field === 'logoSidebar') { setPendingLogoSidebar(blob); setPreviewLogoSidebar(objUrl); }
                if (field === 'logoLogin') { setPendingLogoLogin(blob); setPreviewLogoLogin(objUrl); }
                if (field === 'logoAnimation') { setPendingLogoAnimation(blob); setPreviewLogoAnimation(objUrl); }
                if (field === 'favicon') { setPendingFavicon(blob); setpreviewFavicon(objUrl); }
                if (field === 'pwaIcon') { setPendingPwaIcon(blob); setpreviewPwaIcon(objUrl); }
            } catch (error) {
                console.error(error);
            }
        }
    };

    const inputClasses = "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm";

    if (settingsLoading) return (<div className="flex flex-col items-center justify-center min-h-[400px]">Loading...</div>);

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{t('settings.title')}</h1>

            {activeBranchId ? (
                <form onSubmit={handleSaveBranchSettings} className="space-y-8">
                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.restaurant_info')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium">{t('settings.restaurant_name')}</label>
                                <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className={inputClasses} required maxLength={TEXT_LIMITS.NAME} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{t('settings.currency_symbol')}</label>
                                <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClasses} required maxLength={TEXT_LIMITS.CURRENCY} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{t('settings.address')}</label>
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClasses} placeholder="Ej: Av. Ayacucho entre Heroínas y Gral. Achá" maxLength={TEXT_LIMITS.ADDRESS} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{t('settings.phone')}</label>
                                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} maxLength={TEXT_LIMITS.PHONE} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">País</label>
                                <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(''); }} className={inputClasses}>
                                    <option value="" disabled>Seleccione País</option>
                                    {COUNTRIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Ciudad / Departamento</label>
                                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!country} className={inputClasses} required>
                                    <option value="" disabled>Seleccione Ciudad</option>
                                    {getDepartmentsForCountry(country).map(dep => (
                                        <option key={dep} value={dep}>{dep}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col space-y-4">
                                <label className="flex items-center space-x-2">
                                    <input type="checkbox" checked={isMenuEnabled} onChange={(e) => setIsMenuEnabled(e.target.checked)} />
                                    <span>{t('settings.enable_digital_menu')}</span>
                                </label>

                                {isMenuEnabled && (
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                        <h4 className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <Share2 size={12} /> Link Amigable
                                        </h4>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-white dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 text-[9px] font-mono text-gray-600 dark:text-gray-400 truncate">
                                                {`https://rstfumgexuhhgdyyvnfk.supabase.co/functions/v1/share?id=${activeBranchId}`}
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const url = `https://rstfumgexuhhgdyyvnfk.supabase.co/functions/v1/share?id=${activeBranchId}`;
                                                    navigator.clipboard.writeText(url);
                                                    alert("¡Link copiado!");
                                                }}
                                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                                            >
                                                Copiar
                                            </button>
                                        </div>
                                    </div>
                                )}                                <label className="flex items-center space-x-2">
                                    <input type="checkbox" checked={enableSound} onChange={(e) => setEnableSound(e.target.checked)} />
                                    <span>Activar Sonido de Notificaciones</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input type="checkbox" checked={enableVibration} onChange={(e) => setEnableVibration(e.target.checked)} />
                                    <span>Activar Vibración de Notificaciones</span>
                                </label>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-6 border-b pb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Truck className="text-primary-600" /> Configuración de Envíos
                            </h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={enableDelivery}
                                    onChange={(e) => setEnableDelivery(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                                <span className="ml-3 text-sm font-medium">{enableDelivery ? 'Activado' : 'Desactivado'}</span>
                            </label>
                        </div>

                        {enableDelivery && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 italic opacity-80">Link de Google Maps del Restaurante</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <MapPin size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                value={restaurantMapsLink}
                                                onChange={(e) => setRestaurantMapsLink(e.target.value)}
                                                className={`${inputClasses} pl-10`}
                                                placeholder="https://maps.google.com/..."
                                                maxLength={TEXT_LIMITS.MAPS_LINK}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">Este link se enviará al cliente para que sepa dónde está el restaurante.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 italic opacity-80">Costo Base / Por Defecto</label>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 font-bold">{currency || '$'}</span>
                                            <input
                                                type="number"
                                                value={deliveryCost}
                                                onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                                                className={inputClasses}
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">Se usará si el cliente está fuera de todas las zonas configuradas.</p>
                                    </div>
                                    <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight">Limitar envío a zonas dibujadas</p>
                                            <p className="text-[10px] text-gray-500 italic">Si se activa, el cliente NO podrá pedir si su ubicación está fuera de los polígonos del mapa.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLimitDeliveryToZones(!limitDeliveryToZones)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ${limitDeliveryToZones ? 'bg-primary-600 ring-primary-500' : 'bg-gray-200 ring-gray-100 dark:bg-gray-700 dark:ring-gray-600'}`}
                                        >
                                            <span className={`${limitDeliveryToZones ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 uppercase tracking-tighter">Zonas de Precio Dinámico</h3>
                                        <p className="text-xs text-gray-500 mb-4">Dibuja polígonos en el mapa para asignar diferentes precios según la zona del domicilio.</p>
                                    </div>

                                    <DeliveryZoneEditor
                                        zones={deliveryZones}
                                        onZonesChange={setDeliveryZones}
                                        restaurantLocation={restaurantLocation}
                                        onLocationChange={setRestaurantLocation}
                                    />
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.social_links')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium">Facebook URL</label>
                                <input type="text" value={socialLinks.facebook} onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })} className={inputClasses} placeholder="https://facebook.com/..." maxLength={TEXT_LIMITS.SOCIAL_URL} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Instagram URL</label>
                                <input type="text" value={socialLinks.instagram} onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })} className={inputClasses} placeholder="https://instagram.com/..." maxLength={TEXT_LIMITS.SOCIAL_URL} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">TikTok URL</label>
                                <input type="text" value={socialLinks.tiktok} onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })} className={inputClasses} placeholder="https://tiktok.com/@..." maxLength={TEXT_LIMITS.SOCIAL_URL} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">YouTube URL</label>
                                <input type="text" value={socialLinks.youtube} onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })} className={inputClasses} placeholder="https://youtube.com/..." maxLength={TEXT_LIMITS.SOCIAL_URL} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">{t('settings.website_url')}</label>
                                <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClasses} placeholder="https://..." maxLength={TEXT_LIMITS.SOCIAL_URL} />
                            </div>
                        </div>
                    </Card>


                    {canCustomizeAnimation && (
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.animation_config')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium">{t('settings.bg_color')}</label>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <input type="color" value={animationConfig.backgroundColor} onChange={(e) => setAnimationConfig({ ...animationConfig, backgroundColor: e.target.value })} className="h-10 w-20 rounded cursor-pointer" />
                                        <input type="text" value={animationConfig.backgroundColor} onChange={(e) => setAnimationConfig({ ...animationConfig, backgroundColor: e.target.value })} className={inputClasses} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">{t('settings.text_color')}</label>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <input type="color" value={animationConfig.textColor} onChange={(e) => setAnimationConfig({ ...animationConfig, textColor: e.target.value })} className="h-10 w-20 rounded cursor-pointer" />
                                        <input type="text" value={animationConfig.textColor} onChange={(e) => setAnimationConfig({ ...animationConfig, textColor: e.target.value })} className={inputClasses} />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium">{t('settings.welcome_text')}</label>
                                    <input type="text" value={animationConfig.text} onChange={(e) => setAnimationConfig({ ...animationConfig, text: e.target.value })} className={inputClasses} maxLength={TEXT_LIMITS.NAME} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">{t('settings.welcome_logo')}</label>
                                    <div className="mt-2 flex items-center space-x-4">
                                        {(previewAnimLogo || animationConfig.logoUrl) && (
                                            <img src={(previewAnimLogo || animationConfig.logoUrl)} alt="Anim Logo" className="h-12 w-12 object-contain bg-gray-100 rounded" />
                                        )}
                                        <label className="cursor-pointer bg-white dark:bg-gray-800 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                                            <Upload size={16} className="mr-2" /> {t('menu.image')}
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'animLogo')} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.logo')} / {t('settings.qr_code')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-medium mb-2">{t('settings.logo')}</label>
                                <div className="flex items-center space-x-4">
                                    {(previewLogo || allSettings[activeBranchId]?.logoImage) && (
                                        <img src={previewLogo || allSettings[activeBranchId]?.logoImage} className="w-16 h-16 object-contain border rounded" alt="Logo preview" />
                                    )}
                                    <label className="cursor-pointer bg-white dark:bg-gray-800 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center">
                                        <Upload size={16} className="mr-2" /> Subir Logo
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoImage')} />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">{t('settings.qr_code')} (Pago)</label>
                                <div className="flex items-center space-x-4">
                                    {(previewQR || allSettings[activeBranchId]?.qrImage) && (
                                        <img src={previewQR || allSettings[activeBranchId]?.qrImage} className="w-16 h-16 object-contain border rounded" alt="QR preview" />
                                    )}
                                    <label className="cursor-pointer bg-white dark:bg-gray-800 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center">
                                        <Upload size={16} className="mr-2" /> Subir QR
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'qrImage')} />
                                    </label>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium">{t('settings.qr_payee_name')}</label>
                                    <input type="text" value={qrPayeeName} onChange={(e) => setQrPayeeName(e.target.value)} className={inputClasses} maxLength={TEXT_LIMITS.RAZON_SOCIAL} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.fiscal_info')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium">{t('settings.business_name')}</label>
                                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClasses} maxLength={TEXT_LIMITS.RAZON_SOCIAL} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{t('settings.tax_id')}</label>
                                <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClasses} maxLength={TEXT_LIMITS.TAX_ID} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">{t('settings.economic_activity')}</label>
                                <input type="text" value={economicActivity} onChange={(e) => setEconomicActivity(e.target.value)} className={inputClasses} maxLength={TEXT_LIMITS.DESCRIPTION} />
                            </div>
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="taxIv" checked={enableTaxInvoice} onChange={(e) => setEnableTaxInvoice(e.target.checked)} />
                                    <label htmlFor="taxIv">{t('settings.enable_tax_invoice')}</label>
                                </div>
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <input type="checkbox" id="kPrint" checked={enableKitchenPrint} onChange={(e) => setEnableKitchenPrint(e.target.checked)} />
                                        <label htmlFor="kPrint" className="font-bold text-blue-900 dark:text-blue-100">Activar Impresión para Cocina (Copia Automática)</label>
                                    </div>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 ml-6">Al terminar una venta, se imprimirá el recibo del cliente y luego se generará automáticamente el ticket de cocina.</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">Configuración Fiscal (BOLIVIA - SIAT)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium">NIT del Emisor</label>
                                <input type="text" value={fiscalNit} onChange={(e) => setFiscalNit(e.target.value)} className={inputClasses} placeholder="NIT del Restaurante" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Razón Social del Emisor</label>
                                <input type="text" value={fiscalBusinessName} onChange={(e) => setFiscalBusinessName(e.target.value)} className={inputClasses} placeholder="Nombre Legal" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Nro. de Autorización / CUFD</label>
                                <input type="text" value={fiscalAuthorization} onChange={(e) => setFiscalAuthorization(e.target.value)} className={inputClasses} placeholder="Código del talonario o SIAT" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Código de Sucursal</label>
                                <input type="number" value={fiscalSucursalCode} onChange={(e) => setFiscalSucursalCode(parseInt(e.target.value))} className={inputClasses} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Municipio (SIAT)</label>
                                <input type="text" value={fiscalMunicipio || city} onChange={(e) => setFiscalMunicipio(e.target.value)} className={inputClasses} placeholder="Nombre del municipio para la factura" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Ciudad / Departamento</label>
                                <input type="text" value={city} readOnly className={`${inputClasses} bg-gray-50 dark:bg-gray-800 opacity-70`} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">País</label>
                                <input type="text" value={country} readOnly className={`${inputClasses} bg-gray-50 dark:bg-gray-800 opacity-70`} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">Dirección de Sucursal</label>
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClasses} placeholder="Ej: Av. Ayacucho entre Heroínas y Gral. Achá" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium">Leyenda de Factura</label>
                                <textarea
                                    value={fiscalLegend}
                                    onChange={(e) => setFiscalLegend(e.target.value)}
                                    className={`${inputClasses} h-20 p-2`}
                                    placeholder="ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO DE ACUERDO A LA LEY"
                                    maxLength={TEXT_LIMITS.NOTES}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2">{t('settings.printer_config')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => printRawBt({ order: { dailyTicketNumber: 1, customerName: 'PRUEBA', timestamp: new Date(), items: [], totalAmount: 0 } as any, settings: allSettings[activeBranchId!] })}
                            >
                                <Printer size={16} className="mr-2" /> Probar Recibo Cliente
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => printKitchenRawBt({ dailyTicketNumber: 1, customerName: 'PRUEBA COCINA', timestamp: new Date(), items: [{ menuItem: { name: 'PEDIDO PRUEBA' }, quantity: 1 }], orderType: 'DineIn', tableId: '1' } as any)}
                            >
                                <Printer size={16} className="mr-2" /> Probar Ticket Cocina
                            </Button>
                        </div>
                    </Card>

                    {/* END OF BRANCH SETTINGS FORM */}
                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" className="w-full md:w-auto px-12">{t('settings.save')}</Button>
                    </div>
                </form>
            ) : (
                <div className="p-8 text-center text-gray-500">Seleccione sucursal primero</div>
            )
            }

            {/* YEARLY REPORT CARD - NOW OUTSIDE THE FORM */}
            <div className="mt-8">
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-mono"><History size={20} /> {t('settings.yearly_history')}</h2>
                    <div className="flex flex-wrap gap-4">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1">Año</label>
                            <input type="number" value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))} className={`${inputClasses} !w-32`} />
                        </div>
                        <div className="flex gap-2 items-end">
                            <Button type="button" variant="secondary" onClick={() => {
                                const data = generateYearlyReportData(orders, expenses, allMonthlySummaries[activeBranchId!] || [], allSettings[activeBranchId!], reportYear);
                                downloadYearlyExcel(data);
                            }}><FileSpreadsheet size={16} className="mr-2" /> Excel</Button>
                            <Button type="button" variant="secondary" onClick={() => {
                                const data = generateYearlyReportData(orders, expenses, allMonthlySummaries[activeBranchId!] || [], allSettings[activeBranchId!], reportYear);
                                downloadYearlyPDF(data);
                            }}><FileText size={16} className="mr-2" /> PDF</Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* SIAT RCV REPORT CARD */}
            <div className="mt-8">
                <Card className="p-6 border-2 border-primary-500/20">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-mono text-primary-600"><FileSpreadsheet size={20} /> Reporte RCV (Manual SIAT)</h2>
                    <p className="text-sm text-gray-500 mb-4">Exporta tus ventas en el formato requerido para la presentación manual en el SIAT de Impuestos Nacionales.</p>
                    <div className="flex flex-wrap gap-4">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1">Año</label>
                            <input type="number" value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))} className={`${inputClasses} !w-32`} />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1">Mes</label>
                            <select
                                className={`${inputClasses} !w-40`}
                                onChange={(e) => {
                                    const monthIndex = parseInt(e.target.value);
                                    // Handle logic if needed, or use a local state
                                }}
                                defaultValue={new Date().getMonth()}
                                id="rcvMonthSelect"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                                    <option key={idx} value={idx}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 items-end">
                            <Button type="button" variant="primary" onClick={() => {
                                const monthIdx = parseInt((document.getElementById('rcvMonthSelect') as HTMLSelectElement).value);
                                const monthOrders = orders.filter(o => {
                                    const d = new Date(o.timestamp);
                                    return d.getFullYear() === reportYear && d.getMonth() === monthIdx;
                                });
                                downloadRCVExcel(monthOrders, allSettings[activeBranchId!], reportYear, monthIdx);
                            }}><Download size={16} className="mr-2" /> RCV Excel</Button>
                            <Button type="button" variant="secondary" onClick={() => {
                                const monthIdx = parseInt((document.getElementById('rcvMonthSelect') as HTMLSelectElement).value);
                                const monthOrders = orders.filter(o => {
                                    const d = new Date(o.timestamp);
                                    return d.getFullYear() === reportYear && d.getMonth() === monthIdx;
                                });
                                downloadRCVPDF(monthOrders, allSettings[activeBranchId!], reportYear, monthIdx);
                            }}><FileText size={16} className="mr-2" /> RCV PDF</Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* SUPER ADMIN SETTINGS - NOW INDEPENDENT */}
            {
                isSuperAdmin && (
                    <div className="mt-8">
                        <Card className="p-6 border-2 border-red-500/20">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2 uppercase tracking-wider">
                                    <AlertCircle size={24} /> {t('settings.super_admin_config')}
                                </h2>
                                <Button 
                                    type="button" 
                                    onClick={() => navigate('/usage')}
                                    className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-2 border-primary-500/30 hover:bg-primary-50 flex items-center gap-2 px-6 rounded-2xl font-black uppercase text-xs"
                                >
                                    <BarChartIcon size={16} /> Ver Monitor de Supabase
                                </Button>
                            </div>
                            <form onSubmit={handleSaveSuperAdmin} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-1">Identidad Visual del Sistema</h3>
                                        
                                        <div className="space-y-3">
                                            {/* Logo Sidebar */}
                                            <div className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Logo Sidebar</label>
                                                    <p className="text-[10px] text-gray-500">Logo vertical (PNG/WebP recomendado)</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(previewLogoSidebar || logoSidebar) && <img src={previewLogoSidebar || logoSidebar} className="h-10 object-contain" alt="Sidebar logo preview" />}
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                        <span>Cambiar</span>
                                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleSystemLogoUpload(e, 'logoSidebar')} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Logo Login */}
                                            <div className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Logo Login</label>
                                                    <p className="text-[10px] text-gray-500">Logo para página de inicio</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(previewLogoLogin || logoLogin) && <img src={previewLogoLogin || logoLogin} className="h-10 object-contain" alt="Login logo preview" />}
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                        <span>Cambiar</span>
                                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleSystemLogoUpload(e, 'logoLogin')} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Logo Animation */}
                                            <div className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Logo Animación</label>
                                                    <p className="text-[10px] text-gray-500">Logo de carga del sistema</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(previewLogoAnimation || logoAnimation) && <img src={previewLogoAnimation || logoAnimation} className="h-10 object-contain" alt="Animation logo preview" />}
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                        <span>Cambiar</span>
                                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleSystemLogoUpload(e, 'logoAnimation')} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Favicon */}
                                            <div className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Favicon (Pestaña)</label>
                                                    <p className="text-[10px] text-gray-500">Icono de la pestaña del navegador</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(previewFavicon || faviconUrl) && <img src={previewFavicon || faviconUrl} className="h-6 w-6 object-contain" alt="Favicon preview" />}
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                        <span>Cambiar</span>
                                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleSystemLogoUpload(e, 'favicon')} />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* PWA Icon */}
                                            <div className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                                                <div className="flex-1">
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Icono de App (PWA)</label>
                                                    <p className="text-[10px] text-gray-500">Icono para instalación en móviles</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {(previewPwaIcon || pwaIconUrl) && <img src={previewPwaIcon || pwaIconUrl} className="h-10 w-10 object-contain rounded-lg" alt="PWA icon preview" />}
                                                    <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                        <span>Cambiar</span>
                                                        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleSystemLogoUpload(e, 'pwaIcon')} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                                            <div>
                                                <label className="block text-sm font-bold mb-1">Título de la App</label>
                                                <input type="text" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} className={inputClasses} placeholder="Ziroo Chef" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-1">App Website / URL</label>
                                                <input type="text" value={appWebsiteUrl} onChange={(e) => setAppWebsiteUrl(e.target.value)} className={inputClasses} placeholder="https://ziroo.app" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-1 text-green-600 dark:text-green-400">WhatsApp de Soporte (con código país)</label>
                                                <input type="text" value={supportWhatsApp} onChange={(e) => setSupportWhatsApp(e.target.value)} className={inputClasses} placeholder="ej: 59178945612" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b pb-1">{t('settings.super_admin_credentials')}</h3>
                                        <div>
                                            <label className="block text-sm font-medium">Email SuperAdmin</label>
                                            <input type="email" value={superAdminEmail} onChange={(e) => setSuperAdminEmail(e.target.value)} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Contraseña (Mín. 8 carac.)</label>
                                            <input type="password" value={superAdminPass} onChange={(e) => setSuperAdminPass(e.target.value)} className={inputClasses} />
                                        </div>
                                        <div className="pt-4">
                                            <Button type="submit" variant="primary" className="w-full">Guardar Cambios de Sistema</Button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </Card>
                    </div>
                )}
        </div>
    );
};

export default Settings;
