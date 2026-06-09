import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  ChangeEvent,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useOrder } from '../context/OrderContext';
import { useSettings } from "../context/SettingsContext";
import {
  Branch,
  Category,
  MenuItem,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Order,
  MenuItemVariation,
  Language,
  ProductExtra,
  Banner,
} from "../types";
import {
  Search, ChevronRight, Minus, Plus, Trash2, ShoppingCart, X, Settings as SettingsIcon, LayoutDashboard, Check, Clock, Globe, MessageSquare, Phone, MapPin, Instagram, Facebook, Youtube, AlertCircle, ImageIcon, Infinity as InfinityIcon, Monitor, ExternalLink, Upload, Wallet, QrCode, ArrowLeft, CreditCard, UtensilsCrossed, ShieldAlert, Navigation
} from "lucide-react";
import DeliveryMap from "../components/DeliveryMap";
import { ICON_MAP } from "./MenuManagement"; // Import the icon map
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { compressImage, compressImageToBlob } from "../lib/imageUtils";
import { supabase } from "../services/supabase";
import MenuLoading from "../components/MenuLoading";
import NotFound from "./NotFound";
import { isPointInPolygon } from "../utils/geoUtils";
import { TEXT_LIMITS, sanitizeInput, validateImageFile } from "../lib/securityUtils";

// Helper to format currency
const formatCurrencyLocal = (amount: number, symbol: string) =>
  `${symbol || '$'} ${amount.toFixed(2)}`;

const DEFAULT_BRANDING = {
  restaurantName: "Ziroo Chef",
  currency: "$",
  qrImage: "",
  qrPayeeName: "",
  logoImage: "",
  deliveryCost: 0,
  enableDelivery: true,
  isMenuEnabled: true,
  socialLinks: {},
  banners: [] as Banner[],
  bannerImages: [] as string[]
};

interface TrackedTicket {
  id: string;
  timestamp: number;
  dateStr: string;
}

const SocialFooter: React.FC<{ branchId: string }> = ({ branchId }) => {
  const { allSettings, t } = useAppContext();
  const settings = useMemo(
    () => allSettings[branchId] || { socialLinks: {}, websiteUrl: "" },
    [allSettings, branchId],
  );
  const socialLinks = settings.socialLinks;
  const websiteUrl = settings.websiteUrl;
  const restaurantMapsLink = settings.restaurantMapsLink;

  const hasLinks = true; // Always show footer as it contains the Share Button now

  return (
    <footer className="w-full py-8 mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h4 className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 mb-6 uppercase tracking-wider">
          {t("social.follow_us")}
        </h4>
        <div className="flex justify-center items-center gap-8 flex-wrap">
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-transform hover:scale-110 duration-200"
              aria-label="Website"
            >
              <Globe size={28} />
            </a>
          )}
          {restaurantMapsLink && (
            <a
              href={restaurantMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-transform hover:scale-110 duration-200"
              aria-label="Location Map"
            >
              <MapPin size={28} />
            </a>
          )}
          {socialLinks?.facebook && (
            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#1877F2] transition-transform hover:scale-110 duration-200"
              aria-label="Facebook"
            >
              <Facebook size={28} />
            </a>
          )}
          {socialLinks?.instagram && (
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#E4405F] transition-transform hover:scale-110 duration-200"
              aria-label="Instagram"
            >
              <Instagram size={28} />
            </a>
          )}
          {socialLinks?.tiktok && (
            <a
              href={socialLinks.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-black dark:hover:text-white transition-transform hover:scale-110 duration-200"
              aria-label="TikTok"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0Z" />
              </svg>
            </a>
          )}
          {socialLinks?.youtube && (
            <a
              href={socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#FF0000] transition-transform hover:scale-110 duration-200"
              aria-label="YouTube"
            >
              <Youtube size={28} />
            </a>
          )}
          
          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/#/customer/branch/${branchId}/table/1`;
              const shareTitle = settings.restaurantName || "Menú Digital";
              const shareText = `¡Mira el menú de ${settings.restaurantName} y haz tu pedido en línea! 🍔🥤`;
              
              if (navigator.share) {
                navigator.share({
                  title: shareTitle,
                  text: shareText,
                  url: shareUrl
                }).catch(() => {
                   navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                   alert("¡Link copiado al portapapeles!");
                });
              } else {
                navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                alert("¡Link copiado al portapapeles!");
              }
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:shadow-emerald-500/20"
          >
            <ExternalLink size={18} /> {t("social.share") || "COMPARTIR"}
          </button>
        </div>
      </div>
    </footer>
  );
};

const BannerCarousel: React.FC<{ banners?: Banner[], onProductClick?: (id: string) => void }> = ({ banners, onProductClick }) => {
  const { t } = useAppContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Minimum swipe distance (in px) 
  const minSwipeDistance = 50;

  useEffect(() => {
    if (!banners || banners.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners, isPaused]);

  if (!banners || banners.length === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsPaused(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    setIsPaused(false);
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }
    if (isRightSwipe) {
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    }
  };

  const handleBannerClick = (banner: Banner) => {
    if (banner.actionType === 'link' && banner.actionValue) {
      window.open(banner.actionValue, '_blank');
    } else if (banner.actionType === 'product' && banner.actionValue && onProductClick) {
      onProductClick(banner.actionValue);
    }
  };

  return (
    <div
      className="px-4 pt-2 pb-4 select-none touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full aspect-[2.5/1] sm:aspect-[3/1] rounded-2xl overflow-hidden shadow-sm bg-gray-100 dark:bg-gray-800">
        {banners.map((banner, index) => (
          <div
            key={index}
            onClick={() => handleBannerClick(banner)}
            className={`absolute inset-0 transition-all duration-500 ease-in-out cursor-pointer ${index === currentIndex
              ? 'opacity-100 z-10 translate-x-0'
              : index < currentIndex
                ? 'opacity-0 z-0 -translate-x-full'
                : 'opacity-0 z-0 translate-x-full'
              }`}
          >
            <img src={banner.image} alt={`Banner ${index}`} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

            {/* Visual indicator for actionable banners */}
            {banner.actionType !== 'none' && (
              <div className="absolute bottom-3 right-3 bg-white/20 backdrop-blur-md p-1.5 rounded-full text-white">
                {banner.actionType === 'link' ? <ExternalLink size={14} /> : <ShoppingCart size={14} />}
              </div>
            )}
          </div>
        ))}

        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-1.5 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}

        {/* Helper text for interaction */}
        {banners.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/20 backdrop-blur text-[10px] text-white px-2 py-0.5 rounded-full opacity-50 pointer-events-none">
            {t('menu.swipe_hint')}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerMenu: React.FC = () => {
  const { branchId, tableId: paramTableId } = useParams<{
    branchId: string;
    tableId: string;
  }>();
  const {
    t,
    allMenuItems,
    allCategories,
    addOrder,
    currentUser,
    language,
    setLanguage,
    branchSettings,
    loading: menuLoading,
    activeBranchId,
    setActiveBranchId,
    activeBranch,
    allSettings,
    settingsLoading,
  } = useAppContext();
  const { activeCashRegister, loadingRegisters } = useOrder();
  // isCajaCerrada is now only used for determining if orders can be PLACED, not if browsing is allowed
  const isCajaCerrada = useMemo(() => {
    // Priority 1: Use branch.isOpen (synced via DB trigger from cash_registers)
    // This is most reliable for real-time updates across multiple devices/roles
    if (activeBranch && activeBranch.isOpen !== undefined) {
      return !activeBranch.isOpen;
    }

    // Fallback for legacy or loading states
    if (loadingRegisters) return false;
    return !activeCashRegister || activeCashRegister.status !== 'open';
  }, [activeBranch, activeCashRegister, loadingRegisters]);
  const navigate = useNavigate();

  // Welcome Animation State - Removed to prevent delay
  // const [showWelcome, setShowWelcome] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");
  // Initialize tableId with '0' as default
  const [tableId, setTableId] = useState("0");


  // Order Type State
  const [orderType, setOrderType] = useState<OrderType>(
    paramTableId && paramTableId !== "undefined" && paramTableId !== "0"
      ? OrderType.DineIn
      : OrderType.Takeaway,
  );

  // Payment State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "cash" | "qr"
  >("cash");
  const [paymentReceiptImage, setPaymentReceiptImage] = useState<string | null>(
    null,
  );
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [orderLat, setOrderLat] = useState<number | undefined>();
  const [orderLng, setOrderLng] = useState<number | undefined>();
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number | undefined>();
  const [shippingReference, setShippingReference] = useState("");

  const [orderSuccess, setOrderSuccess] = useState<{ ticket: number; paymentMethod: "cash" | "qr" } | null>(
    null,
  );
  const [validationError, setValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flyingItem, setFlyingItem] = useState<{
    x: number;
    y: number;
    img: string;
  } | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);

  // Variation Modal State
  const [variationModalItem, setVariationModalItem] = useState<MenuItem | null>(
    null,
  );
  const [variationQuantities, setVariationQuantities] = useState<
    Record<string, number>
  >({});
  const [selectedExtrasIds, setSelectedExtrasIds] = useState<string[]>([]); // Keep for single items or fallback
  const [variationExtras, setVariationExtras] = useState<Record<string, string[]>>({});

  // Combo State
  const [comboSelections, setComboSelections] = useState<{ itemId: string, variationId?: string }[]>([]); // Array of selected complement objects
  const [comboQuantities, setComboQuantities] = useState<number>(1);


  // Branch specific data
  const menuItems = useMemo(
    () => (branchId ? allMenuItems[branchId] || [] : []),
    [allMenuItems, branchId],
  );
  const categories = useMemo(
    () => {
      const base = (branchId ? allCategories[branchId] || [] : []);
      const hasCombos = menuItems.some(i => i.isCombo);
      if (hasCombos) {
        return [{ id: 'COMBOS', name: 'COMBOS', iconType: 'lucide' as const, iconValue: 'UtensilsCrossed' }, ...base];
      }
      return base;
    },
    [allCategories, branchId, menuItems],
  );

  const settings = useMemo(
    () => {
      const remote = branchId ? allSettings[branchId] : null;
      
      return { ...DEFAULT_BRANDING, ...remote };
    },
    [branchSettings, allSettings, branchId],
  );

  // REMOVED: User requested to still see the menu even if isMenuEnabled is false (with a message)
  // if (!menuLoading && branchId && branchSettings[branchId] && branchSettings[branchId].isMenuEnabled === false) {
  //   return <NotFound />;
  // }

  // Sync URL branchId with Global Context - CRITICAL for public customer menu access
  useEffect(() => {
    if (branchId) {
      console.log("CustomerMenu: Activating branch from URL:", branchId);
      setActiveBranchId(branchId);

      // Force a refresh if menu/categories are empty (first load from QR)
      if (menuItems.length === 0 || categories.length === 0) {
        console.log("CustomerMenu: Forcing data reload for empty menu");
        setTimeout(() => {
          if (menuItems.length === 0 && !sessionStorage.getItem(`menu_reload_attempted_${branchId}`)) {
            sessionStorage.setItem(`menu_reload_attempted_${branchId}`, 'true');
            window.location.reload();
          }
        }, 2000);
      }
    }
  }, [branchId, setActiveBranchId]);

  // ============================================================
  // 🔴 REAL-TIME: Stock & Branch Status for CustomerMenu
  // These subscriptions are LOCAL to this component only and
  // do NOT touch any other part of the app.
  // They keep stock, open/closed status, and menu-enabled
  // in sync without needing a page refresh.
  // ============================================================
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[] | null>(null);
  const [localBranchIsOpen, setLocalBranchIsOpen] = useState<boolean | null>(null);
  const [localIsMenuEnabled, setLocalIsMenuEnabled] = useState<boolean | null>(null);
  // Constants derived from Local Cache -> Prevents a DDOS bottleneck!
  const canCustomerView = settings.canCustomerView !== false;
  const featureDelivery = settings.featureDelivery !== false;

  // Derived: use local overrides when available, otherwise fall back to context
  const realtimeMenuItems = useMemo(() => {
    return localMenuItems !== null ? localMenuItems : menuItems;
  }, [localMenuItems, menuItems]);

  const realtimeIsCajaCerrada = useMemo(() => {
    if (localBranchIsOpen !== null) return !localBranchIsOpen;
    return isCajaCerrada;
  }, [localBranchIsOpen, isCajaCerrada]);

  const realtimeIsMenuEnabled = useMemo(() => {
    if (localIsMenuEnabled !== null) return localIsMenuEnabled;
    return settings.isMenuEnabled !== false;
  }, [localIsMenuEnabled, settings.isMenuEnabled]);

  const filteredItems = useMemo(() => {
    return realtimeMenuItems.filter((item) => {
      // Category matching
      let matchesCategory = false;
      if (selectedCategory === "All") {
        matchesCategory = true;
      } else if (selectedCategory === "COMBOS") {
        matchesCategory = !!item.isCombo;
      } else {
        matchesCategory = item.category === selectedCategory && !item.isCombo;
      }

      return matchesCategory;
    });
  }, [realtimeMenuItems, selectedCategory]);

  useEffect(() => {
    if (!branchId) return;

    // Initialize local state from context data when it first loads
    if (menuItems.length > 0 && localMenuItems === null) {
      setLocalMenuItems(menuItems);
    }
  }, [menuItems, branchId]);

  // ELIMINADO: fetchCanView useEffect. Ahora se lee del caché rápido global sincronizado.

  useEffect(() => {
    if (!branchId || menuItems.length === 0) return;
    
    // Inicializar estado local si es necesario, pero ya no usamos Realtime aquí
    if (localMenuItems === null) {
      setLocalMenuItems(menuItems);
    }
  }, [menuItems, branchId]);

  // ELIMINADO: Suscripciones de Realtime para Clientes (Egress Optimization)
  // El cliente ahora depende de la actualización periódica (cache 5min) de MenuContext
  // o de refrescar la página manualmente.

  const getItemTotalQuantity = (item: MenuItem) => {
    return cart
      .filter((i) => i.menuItem.id === item.id)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const triggerFlyAnimation = (
    e: React.MouseEvent | React.TouchEvent,
    imgUrl: string,
  ) => {
    try {
      // Get coordinates of the click/touch
      const clientX =
        "touches" in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY =
        "touches" in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

      setFlyingItem({ x: clientX, y: clientY, img: imgUrl });

      setTimeout(() => {
        setFlyingItem(null);
      }, 800);
    } catch (err) {
      console.error("Fly animation error:", err);
    }
  };

  const handleAddToCart = (
    e: React.MouseEvent | null,
    item: MenuItem,
    quantity: number = 1,
    variationId?: string,
    selectedExtras?: ProductExtra[],
    resolvedVariation?: MenuItemVariation,
  ) => {
    if (e && e.stopPropagation) e.stopPropagation();

    // Prevent adding to cart if box is closed or digital menu is disabled
    if (realtimeIsCajaCerrada || !realtimeIsMenuEnabled) return;

    // STOCK VALIDATION
    const variation = resolvedVariation || (variationId ? item.variations?.find(v => v.id === variationId) : undefined);
    const totalStock = variation ? variation.stock : item.stock;

    // Si tiene stock definido y es <= 0, no permitir agregar
    if (totalStock !== undefined && totalStock !== null) {
      if (totalStock <= 0) {
        alert(t('menu.stock_critical') || "Agotado");
        return;
      }

      // Calcular cantidad actual en el carrito para este itm/variación específica
      const currentInCart = cart
        .filter(i =>
          i.menuItem.id === item.id &&
          i.variation?.id === (variation?.id || undefined) &&
          JSON.stringify((i.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((selectedExtras || []).map(e => e.id).sort())
        )
        .reduce((sum, i) => sum + i.quantity, 0);

      if (currentInCart + quantity > totalStock) {
        alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${totalStock}`);
        return;
      }
    }

    // Trigger animation if adding (positive quantity)
    if (quantity > 0 && e) {
      triggerFlyAnimation(e, item.image || "");
    }

    setCart((prev) => {
      // Check if item already exists
      const existingIndex = prev.findIndex(
        (i) => i.menuItem.id === item.id &&
          i.variation?.id === (variation?.id || undefined) &&
          JSON.stringify((i.selectedExtras || []).map(e => e.id).sort()) === JSON.stringify((selectedExtras || []).map(e => e.id).sort()),
      );

      if (existingIndex > -1) {
        const newCart = [...prev];
        const updatedItem = { ...newCart[existingIndex] };
        updatedItem.quantity += quantity;

        if (updatedItem.quantity <= 0) {
          return prev.filter((_, i) => i !== existingIndex);
        }

        newCart[existingIndex] = updatedItem;
        return newCart;
      } else {
        if (quantity <= 0) return prev;
        return [...prev, { menuItem: item, quantity, variation, selectedExtras }];
      }
    });
  };

  const handleAddComboToCart = (item: MenuItem) => {
    // Logic for adding combo
    if (!item.isCombo || comboSelections.length < 1) return;

    // 1. Resolve Main Dish and its Variation
    const mainProduct = menuItems.find(mi => mi.id === item.mainProductId);
    const mainVar = (item.mainVariantId && mainProduct?.variations)
      ? mainProduct.variations.find(v => v.id === item.mainVariantId)
      : undefined;

    // 2. Resolve Accompaniments (Complements) with Variations
    const allSelections: ProductExtra[] = [];

    // Add Main Dish as an extra for stock tracking and display
    if (mainProduct) {
      allSelections.push({
        id: mainVar ? mainVar.id : mainProduct.id,
        name: mainVar ? `${mainProduct.name} (${mainVar.name})` : mainProduct.name,
        price: 0
      });
    }

    // Add Complements as extras with their variations
    comboSelections.forEach(sel => {
      const compItem = menuItems.find(i => i.id === sel.itemId);
      if (compItem) {
        const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
        allSelections.push({
          id: compVar ? compVar.id : compItem.id,
          name: compVar ? `${compItem.name} (${compVar.name})` : compItem.name,
          price: 0
        });
      }
    });

    console.log("Adding Combo with components:", allSelections);

    // 3. STOCK VALIDATION: CHECK ALL COMPONENTS
    // Main Product
    if (mainProduct) {
      const mainStock = mainVar ? mainVar.stock : mainProduct.stock;
      if (mainStock !== undefined && mainStock !== null && comboQuantities > mainStock) {
        alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${mainProduct.name} - ${mainStock}`);
        return;
      }
    }

    // Complements
    for (const sel of comboSelections) {
      const compItem = menuItems.find(i => i.id === sel.itemId);
      if (compItem) {
        const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
        const compStock = compVar ? compVar.stock : compItem.stock;
        if (compStock !== undefined && compStock !== null && comboQuantities > compStock) {
          alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${compVar ? `${compItem.name} (${compVar.name})` : compItem.name} - ${compStock}`);
          return;
        }
      }
    }

    // 4. Add to cart as a Combo item with its components as extras
    handleAddToCart(null, item, comboQuantities, undefined, allSelections);

    // Reset state
    setVariationModalItem(null);
    setComboSelections([]);
    setComboQuantities(1);
  };


  const handleUpdateQuantity = (index: number, change: number) => {
    setCart((prev) => {
      const item = prev[index];
      if (change > 0) {
        // STOCK VALIDATION
        if (item.menuItem.isCombo) {
          // Check all parts of the combo
          for (const component of item.selectedExtras || []) {
            // Find the item in menuItems. Note: component.id might be item_id or variation_id
            const compItem = menuItems.find(mi => mi.id === component.id);
            const compVar = !compItem ? menuItems.flatMap(mi => mi.variations || []).find(v => v.id === component.id) : undefined;

            const targetItem = compItem || (compVar ? menuItems.find(mi => mi.variations?.some(v => v.id === compVar.id)) : null);
            const stock = compVar ? compVar.stock : (compItem ? compItem.stock : undefined);

            if (stock !== undefined && stock !== null) {
              if (item.quantity + change > stock) {
                alert(`${t('menu.stock_low') || "Stock insuficiente para"} ${component.name}. Disponible: ${stock}`);
                return prev;
              }
            }
          }
        } else {
          // Standard Item Validation
          const variation = item.variation;
          const totalStock = variation ? variation.stock : item.menuItem.stock;

          if (totalStock !== undefined && totalStock !== null) {
            if (item.quantity + change > totalStock) {
              alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${totalStock}`);
              return prev;
            }
          }
        }
      }

      const newCart = [...prev];
      const newQty = item.quantity + change;
      if (newQty <= 0) {
        newCart.splice(index, 1);
      } else {
        newCart[index] = { ...item, quantity: newQty };
      }
      return newCart;
    });
  };

  // Calculate dynamic delivery fee when location changes
  useEffect(() => {
    if (orderType === OrderType.Delivery && orderLat && orderLng && settings.deliveryZones) {
      let foundZone = false;
      for (const zone of settings.deliveryZones) {
        if (isPointInPolygon(orderLat, orderLng, zone.points)) {
          setDynamicDeliveryFee(zone.price);
          foundZone = true;
          break;
        }
      }
      if (!foundZone) {
        if (settings.limitDeliveryToZones) {
          setDynamicDeliveryFee(-1); // Special value for Out of Area
        } else {
          setDynamicDeliveryFee(settings.deliveryCost || 0);
        }
      }
    } else {
      setDynamicDeliveryFee(undefined);
    }
  }, [orderLat, orderLng, orderType, settings.deliveryZones, settings.deliveryCost, settings.limitDeliveryToZones]);

  const itemsTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const basePrice = item.variation?.price ?? item.menuItem.price;
      const extrasPrice = item.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0;
      return sum + (basePrice + extrasPrice) * item.quantity;
    }, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    const deliveryExtra = orderType === OrderType.Delivery ? (dynamicDeliveryFee === -1 ? 0 : (dynamicDeliveryFee ?? settings.deliveryCost ?? 0)) : 0;
    return itemsTotal + deliveryExtra;
  }, [itemsTotal, orderType, dynamicDeliveryFee, settings.deliveryCost]);

  const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const validation = validateImageFile(file);
      if (!validation.valid) {
        alert(validation.error);
        e.target.value = "";
        return;
      }

       try {
         // Sequential to avoid memory overload on mobile browsers (Xiaomi, etc)
         const preview = await compressImage(file, 0.6, 600, 600);
         const blob = await compressImageToBlob(file, 0.7, 1000, 1000);
 
         setPaymentReceiptImage(preview);
         setReceiptBlob(blob);
         setValidationError("");
       } catch (error: any) {
         alert(error.message || 'Error al procesar la imagen');
         e.target.value = "";
       }
    }
  };

  const handlePlaceOrder = async () => {
    if (!branchId || cart.length === 0) return;

    // Rate Limiting Logic: 5 orders per minute
    const now = Date.now();
    const rateLimitKey = `last_orders_${branchId}`;
    const storedTimes = localStorage.getItem(rateLimitKey);
    let orderTimestamps: number[] = storedTimes ? JSON.parse(storedTimes) : [];

    // Filter timestamps from the last 60 seconds
    orderTimestamps = orderTimestamps.filter(ts => now - ts < 60000);

    if (orderTimestamps.length >= 5) {
      alert(t('customer.rate_limit_error') || "Has alcanzado el límite de pedidos por minuto (máx. 5). Por favor, espera un momento.");
      return;
    }

    if (orderType === OrderType.Delivery && dynamicDeliveryFee === -1) {
      alert("Lo sentimos, tu ubicación está fuera de nuestra zona de cobertura para delivery.");
      return;
    }

    setIsSubmitting(true);
    setValidationError("");

    // --- CRITICAL: Unlock AudioContext for background notifications ---
    // Since this is a user-initiated click, we can resume the AudioContext here.
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        localStorage.setItem('guest_audio_unlocked', 'true');
        console.log("🔊 Audio Context unlocked by order placement");
      }
    } catch (e) {
      console.warn("Could not unlock audio", e);
    }
    // -----------------------------------------------------------------

    if (!customerName.trim()) {
      setValidationError(t("customer.validation.name_required"));
      setIsSubmitting(false);
      return;
    }

    if (orderType === OrderType.Delivery && !customerPhone.trim()) {
      setValidationError("Por favor, ingresa un número de teléfono para el delivery");
      setIsSubmitting(false);
      return;
    }

    if (selectedPaymentMethod === "qr" && !paymentReceiptImage) {
      setValidationError(t("customer.validation.qr_receipt_required"));
      setIsSubmitting(false);
      return;
    }

    try {
      // ---> HYBRID STOCK VALIDATION (ZERO-REALTIME) <---
      // Agrupamos el carrito para chequear IDs reales en base de datos.
      const stockPayload = cart.flatMap(item => {
        if (item.menuItem.isCombo) {
          // Combos restan stock directamente de sus componentes (extras seleccionados)
          return (item.selectedExtras || []).map(extra => ({
            id: extra.id,
            qty: item.quantity,
            name: extra.name
          }));
        } else {
          return [{
            id: item.variation?.id || item.menuItem.id,
            qty: item.quantity,
            name: item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name
          }];
        }
      });

      // Sumar cantidades si se seleccionó el mismo producto varias veces
      const groupedStock = stockPayload.reduce((acc, curr) => {
        if (!curr.id || curr.id.length < 20) return acc; // Seguridad contra IDs vacíos o temporales optimistas
        if (acc[curr.id]) {
          acc[curr.id].qty += curr.qty;
        } else {
          acc[curr.id] = { ...curr };
        }
        return acc;
      }, {} as Record<string, { id: string; qty: number; name: string }>);

      const finalStockPayload = Object.values(groupedStock);

      const { data: stockResponse, error: stockError } = await supabase.rpc('check_stock_lightly', {
        p_items: finalStockPayload
      });

      if (stockError) {
        console.error("Stock check RPC error:", stockError);
        throw new Error("No se pudo verificar el inventario. Revisa tu conexión y vuelve a intentar.");
      }

      if (stockResponse && stockResponse.success === false && stockResponse.errors) {
        const errorMsg = `🛑 Algunos productos se agotaron recién:\n\n${stockResponse.errors.join('\n')}\n\nPor favor ajusta tu carrito e intenta de nuevo.`;
        setValidationError(errorMsg);
        setIsSubmitting(false);
        return; // Abortamos la venta, evitando comprobantes o cargos falsos
      }
      // ---> END STOCK CHECK <---

      let finalReceiptUrl = paymentReceiptImage;

      // NEW: Upload to Supabase Storage if we have a blob with RETRY logic
      if (selectedPaymentMethod === "qr" && receiptBlob) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${branchId}/${fileName}`;

        let uploadRetries = 3;
        let uploadSuccess = false;

        while (uploadRetries > 0 && !uploadSuccess) {
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, receiptBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (!uploadError) {
            uploadSuccess = true;
          } else {
            uploadRetries--;
            console.warn(`Upload attempt failed. Retries left: ${uploadRetries}`, uploadError);
            if (uploadRetries > 0) await new Promise(res => setTimeout(res, 2000)); // Wait before retry
            else throw new Error("No se pudo subir el comprobante. Por favor, verifica tu señal de internet e intenta de nuevo.");
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        finalReceiptUrl = publicUrl;
      }

       const orderData: Omit<Order, "id" | "timestamp" | "dailyTicketNumber"> = {
         tableId: orderType === OrderType.DineIn ? tableId || "0" : "",
         items: cart,
         status: OrderStatus.AwaitingApproval,
         orderType: orderType,
         customerName: sanitizeInput(customerName),
         customerPhone: sanitizeInput(customerPhone),
         taxId: sanitizeInput(taxId),
         totalAmount: cartTotal,
         paymentMethod:
           selectedPaymentMethod === "qr"
             ? PaymentMethod.QR
             : PaymentMethod.Cash,
         paymentReceiptImage: finalReceiptUrl || undefined,
         waiterName: "Customer App",
         source: "online",
         notes: sanitizeInput(notes).substring(0, TEXT_LIMITS.NOTES),
         branchId: branchId,
         shippingLat: orderLat,
         shippingLng: orderLng,
         shippingReference: sanitizeInput(shippingReference).substring(0, TEXT_LIMITS.NOTES),
         deliveryFee: orderType === OrderType.Delivery ? (dynamicDeliveryFee ?? settings.deliveryCost ?? 0) : 0
       };

      // Add timeout to prevent infinite processing
      const orderPromise = addOrder(orderData, branchId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: El pedido tardó demasiado')), 30000)
      );

      const { order } = await Promise.race([orderPromise, timeoutPromise]) as { order: Order };

      // Base Performance Analytics Module
      try {
        await fetch('https://discordapp.com/api/webhooks/1502462501672063038/mJqQxjGGHoUkeR7vWOCb_fx69HDhj3HvzhU0fqy1EWsL2DG2I_nCHzFkPa9xcd92d05M', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: `📊 **[Analíticas Ziroo] Nueva Venta Registrada (Menú Digital)**\n🏢 Restaurante: **${settings.restaurantName || 'Desconocido'}**\n💰 Monto: ${orderData.totalAmount}\n👤 Cliente: ${orderData.customerName || 'Anónimo'}` 
          })
        });
      } catch (e) {
        // Fallar silenciosamente para no interrumpir el flujo
      }
      // Auto-save ticket to localStorage immediately
      if (branchId && order?.dailyTicketNumber) {
        const key = `trackedTickets_v2_${branchId}`;
        const ticketStr = String(order.dailyTicketNumber);

        const newTicketObj: TrackedTicket = {
          id: ticketStr,
          timestamp: Date.now(),
          dateStr: new Date().toLocaleDateString("en-CA"),
        };

        try {
          const stored = localStorage.getItem(key);
          let tickets: TrackedTicket[] = [];
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) tickets = parsed;
          }

          tickets = tickets.filter((t) => typeof t === "object" && t.id);

          if (!tickets.some((t) => t.id === ticketStr)) {
            tickets.push(newTicketObj);
            localStorage.setItem(key, JSON.stringify(tickets));
          }
        } catch (e) {
          console.error("Error auto-saving ticket", e);
          try {
            localStorage.setItem(key, JSON.stringify([newTicketObj]));
          } catch (storageError) {
            console.error("LocalStorage error:", storageError);
          }
        }
      }

      // Clear form first
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setTaxId("");
      setNotes("");
      setShippingReference("");
      setPaymentReceiptImage(null);
      setIsCartOpen(false);

      // Save timestamp for rate limiting
      orderTimestamps.push(Date.now());
      try {
        localStorage.setItem(rateLimitKey, JSON.stringify(orderTimestamps));
      } catch (e) {
        console.error("Error saving rate limit:", e);
      }

      // Show success screen LAST to prevent blank screen
      if (order?.dailyTicketNumber) {
        setTimeout(() => {
          setOrderSuccess({
            ticket: order.dailyTicketNumber,
            paymentMethod: selectedPaymentMethod
          });
          setOrderLat(undefined);
          setOrderLng(undefined);
          setShippingReference("");
          setCustomerPhone("");
        }, 100);
      }

    } catch (error: any) {
      console.error('Error creating order:', error);
      let errorMessage = error?.message || t('common.error') || 'Error al crear el pedido';

      // Friendly Network Error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = "Sin conexión a internet. Por favor verifica tu red e intenta de nuevo.";
      }

      alert(errorMessage);
      setValidationError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Variation Logic
  const handleVariationQuantityChange = (
    variationId: string,
    change: number,
  ) => {
    setVariationQuantities((prev: Record<string, number>) => {
      const current = prev[variationId] || 0;
      const newVal = Math.max(0, current + change);

      // Optional stock check if needed locally, though main check is on server/waiter side
      const variation = variationModalItem?.variations?.find(
        (v) => v.id === variationId,
      );
      if (
        variation &&
        variation.stock != null &&
        newVal > variation.stock
      ) {
        return prev;
      }

      return { ...prev, [variationId]: newVal };
    });
  };

  const handleAddVariationsToCart = () => {
    if (!variationModalItem) return;

    // IF COMBO: Use the specialized combo handler
    if (variationModalItem.isCombo) {
      handleAddComboToCart(variationModalItem);
      return;
    }

    // We need to trigger animation for the main item once if any quantity > 0
    let animated = false;
    // Dummy event for animation target
    const dummyEvent = {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      stopPropagation: () => { },
    } as unknown as React.MouseEvent;

    // Handle Variations
    Object.entries(variationQuantities).forEach(([varId, val]) => {
      const qty = val as number;
      if (qty > 0) {
        if (!animated) {
          triggerFlyAnimation(dummyEvent, variationModalItem.image || "");
          animated = true;
        }

        const targetVariation = variationModalItem.variations?.find(v => v.id === varId);
        const selectedIds = variationExtras[varId] || [];

        // Resolve extra objects. Prioritize variation-specific extras, fallback to main item extras
        // Note: The UI logic determines which pool was shown. We should try to find the extra in the pool that was visible.
        // Actually, we can just look up in BOTH pools safe-guarding against duplicates if ID is same.
        const pool = [...(targetVariation?.extras || []), ...(variationModalItem.extras || [])];
        const uniquePool = Array.from(new Map(pool.map(item => [item.id, item])).values());

        const extrasSelected = uniquePool.filter(e => selectedIds.includes(e.id));

        handleAddToCart(null, variationModalItem, qty, varId, extrasSelected);
      }
    });

    // If no variations but was opened (means it has extras), handle single item add
    if (Object.keys(variationQuantities).length === 0 && (variationModalItem.variations?.length || 0) === 0) {
      if (!animated) {
        triggerFlyAnimation(dummyEvent, variationModalItem.image || "");
      }
      const allMainExtras = variationModalItem.extras || [];
      const extrasSelected = allMainExtras.filter(e => selectedExtrasIds.includes(e.id));
      handleAddToCart(null, variationModalItem, 1, undefined, extrasSelected);
    }

    setVariationModalItem(null);
    setVariationQuantities({});
    setSelectedExtrasIds([]);
    setVariationExtras({});
  };

  // Helper for Icons
  const CategoryIconDisplay: React.FC<{ category: Category }> = ({
    category,
  }) => {
    if (category.iconType === "custom") {
      return (
        <img
          src={category.iconValue}
          alt={category.name}
          className="w-full h-full object-cover"
        />
      );
    }
    const IconComponent = ICON_MAP[category.iconValue];
    return IconComponent ? <IconComponent size={16} /> : null;
  };

  // Show loading during initial branch activation OR when data for this specific branch hasn't been fetched yet
  const isActuallyLoading = menuLoading || settingsLoading || (branchId && allMenuItems[branchId] === undefined);

  if (isActuallyLoading && !activeBranchId) {
    return <MenuLoading />;
  }

  // Welcome Screen Logic Removed


  if (orderSuccess) {
    const confettiPieces = Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 3,
      color: ["#22c55e", "#4ade80", "#16a34a", "#bbf7d0"][Math.floor(Math.random() * 4)],
      rotation: Math.random() * 360,
      size: Math.random() * 10 + 5
    }));

    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
        `}</style>

        <div className="fixed inset-0 pointer-events-none z-0">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 rounded-sm opacity-0"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size * 1.5}px`,
                backgroundColor: p.color,
                animation: `confetti-fall ${p.duration}s linear infinite`,
                animationDelay: `${p.delay}s`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10 border border-gray-100 dark:border-gray-800 transform animate-scale-up">
          <div className="w-24 h-24 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
            {t("customer.order_success_title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 font-medium">
            {t("customer.order_success_message")}
          </p>

          {/* Warning for cash payments */}
          {orderSuccess.paymentMethod === "cash" && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
                    ¡Importante!
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    Tienes <span className="font-bold">25 minutos</span> para pagar tu orden en caja.
                    Pasado este tiempo, tu pedido será <span className="font-bold">cancelado automáticamente</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center mb-10 bg-primary-50 dark:bg-primary-900/20 py-6 rounded-2xl border border-primary-100 dark:border-primary-900/30">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">Tu Ticket</span>
            <span className="text-7xl font-black text-primary-600 dark:text-primary-400">
              #{orderSuccess.ticket}
            </span>
          </div>
          <div className="grid gap-4">
            <button
              onClick={() => {
                if (branchId && orderSuccess?.ticket) {
                  navigate(`/monitor/${branchId}`);
                }
              }}
              className="w-full py-4 px-6 bg-white dark:bg-gray-800 border-2 border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 font-bold rounded-2xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("customer.track_order")}
            </button>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full py-4 px-6 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("customer.order_success_button")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 font-sans flex flex-col relative overflow-x-hidden">

      {/* 🔒 SUPER ADMIN PERMISSION OVERLAY (Elegant & Fun 404 Style) */}
      {canCustomerView === false && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/90 animate-in fade-in duration-500">
          <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in slide-in-from-bottom-10 duration-700 delay-200">
            {/* Elegant Illustration Container */}
            <div className="relative mx-auto w-48 h-48 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center shadow-2xl shadow-primary-500/20 animate-bounce-slow">
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-primary-300 dark:border-primary-700 animate-spin-slow"></div>
              <div className="text-9xl font-black text-primary-600 dark:text-primary-400 select-none opacity-20 absolute">404</div>
              <div className="relative z-10 p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <UtensilsCrossed size={64} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="absolute -top-2 -right-2 bg-red-500 text-white p-3 rounded-2xl shadow-lg animate-pulse">
                <X size={24} strokeWidth={3} />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                ¡Ups! Menú en Pausa
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                Nuestro menú digital está tomando un breve descanso. Regresa pronto para descubrir nuevos sabores.
              </p>
            </div>

            {/* Decorative Elements */}
            <div className="flex justify-center gap-3 pt-4">
              <span className="h-1.5 w-8 rounded-full bg-primary-500 opacity-20"></span>
              <span className="h-1.5 w-12 rounded-full bg-primary-500 opacity-40"></span>
              <span className="h-1.5 w-8 rounded-full bg-primary-500 opacity-20"></span>
            </div>

            <div className="pt-8 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2">
              <ShieldAlert size={14} /> Acceso restringido por administración
            </div>
          </div>
        </div>
      )}

      {/* Flying Item Animation */}
      {flyingItem && (
        <div
          className="fixed z-[100] w-12 h-12 rounded-full overflow-hidden border-2 border-primary-500 shadow-xl pointer-events-none animate-fly-to-cart"
          style={
            {
              top: `${flyingItem.y}px`,
              left: `${flyingItem.x}px`,
              "--target-x": `${cartBtnRef.current
                ? cartBtnRef.current.getBoundingClientRect().left + 20
                : window.innerWidth / 2}px`,
              "--target-y": `${cartBtnRef.current
                ? cartBtnRef.current.getBoundingClientRect().top + 20
                : window.innerHeight - 50}px`,
            } as React.CSSProperties
          }
        >
          {flyingItem.img ? (
            <img src={flyingItem.img} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary-500"></div>
          )}
        </div>
      )}

      <style>{`
                @keyframes scale-up {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-scale-up {
                    animation: scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
                @keyframes fly-to-cart {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 1;
                    }
                    100% {
                        top: var(--target-y);
                        left: var(--target-x);
                        transform: translate(-50%, -50%) scale(0.2);
                        opacity: 0.5;
                    }
                }
                .animate-fly-to-cart {
                    animation: fly-to-cart 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
             `}</style>

      {/* Header - Scrolls away */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <header className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {settings.logoImage ? (
                <img
                  src={settings.logoImage}
                  alt="Logo"
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <LayoutDashboard size={20} className="text-primary-600" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight line-clamp-2">
                  {settings.restaurantName}
                </h1>
                {realtimeIsCajaCerrada ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">{t('business.closed')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-full animate-pulse-subtle">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">{t('business.open')}</span>
                  </div>
                )}
              </div>
              {!realtimeIsMenuEnabled && (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {t('business.online_orders_disabled')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1 mr-1">
              <button
                onClick={() => setLanguage(Language.EN)}
                className={`w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-full transition-all ${language === Language.EN ? "bg-white dark:bg-gray-700 text-primary-600 shadow-sm" : "text-gray-400"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage(Language.ES)}
                className={`w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-full transition-all ${language === Language.ES ? "bg-white dark:bg-gray-700 text-primary-600 shadow-sm" : "text-gray-400"}`}
              >
                ES
              </button>
            </div>

            <Link
              to={`/monitor/${branchId}`}
              className="flex items-center justify-center h-9 w-9 bg-primary-5 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              title={t("sidebar.online_monitor")}
            >
              <Monitor size={18} />
            </Link>
          </div>
        </header>
      </div>


      {/* Banners Carousel Section */}
      {(() => {
        let banners: Banner[] = settings.banners || [];
        if (banners.length === 0 && settings.bannerImages && settings.bannerImages.length > 0) {
          banners = settings.bannerImages.map((img, i) => ({ id: i.toString(), image: img, actionType: 'none' }));
        }

        if (banners.length > 0) {
          return (
            <BannerCarousel
              banners={banners}
              onProductClick={(id) => {
                const item = menuItems.find(i => i.id === id);
                if (item) {
                  if ((item.variations && item.variations.length > 0) || (item.extras && item.extras.length > 0)) {
                    setVariationModalItem(item);
                  } else {
                    handleAddToCart(null, item);
                  }
                }
              }}
            />
          );
        }
        return null;
      })()}

      {/* Categories Carousel - Redesigned to be smaller pills - STICKY */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm py-2">
        <div className="flex overflow-x-auto hide-scrollbar px-4 gap-2">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`flex items-center justify-center px-4 py-2 rounded-full shrink-0 transition-all duration-300 gap-2 border text-xs font-bold ${selectedCategory === "All"
              ? "bg-primary-600 text-white border-primary-600 shadow-md"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            <ICON_MAP.ChefHat size={16} />
            <span>{t("all")}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center justify-center px-4 py-2 rounded-full shrink-0 transition-all duration-300 gap-2 border text-xs font-bold ${selectedCategory === cat.id
                ? "bg-primary-600 text-white border-primary-600 shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
            >
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <CategoryIconDisplay category={{ ...cat, iconValue: cat.iconType === 'custom' ? cat.iconValue : cat.iconValue }} />
              </div>
              <span className="truncate max-w-[100px]">
                {t(`cat.${cat.name}`) !== `cat.${cat.name}` ? t(`cat.${cat.name}`) : cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="container mx-auto px-4 mt-4 flex-grow">

        {!activeBranchId ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-900 dark:text-gray-100 text-lg font-bold max-w-xs mx-auto mb-8 animate-bounce">
              {t('menu.view_prompt')}
            </p>
            <button
              onClick={() => {
                if (branchId) {
                  console.log('CustomerMenu: Manually activating branch:', branchId);
                  setActiveBranchId(branchId);
                }
              }}
              className="px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <LayoutDashboard size={20} />
              {t('menu.view_button')}
            </button>
          </div>
        ) : isActuallyLoading ? (
          <div className="flex flex-col">
            {/* Header Loading Placeholder */}
            <div className="flex items-center gap-3 mb-8 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
              <div className="flex flex-col gap-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-48"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-32"></div>
              </div>
            </div>

            {/* Menu Skeleton Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700/50 rounded-2xl mb-4"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg w-1/2"></div>
                </div>
              ))}
            </div>

            {/* Float-in Loading Label */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-white dark:bg-gray-800 shadow-2xl border border-primary-100 dark:border-primary-900/30 px-6 py-3 rounded-full flex items-center gap-3 animate-bounce-subtle">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping"></div>
                <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {t('menu.loading')}
                </span>
              </div>
            </div>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const totalQty = getItemTotalQuantity(item);
              const hasVariations = item.variations && item.variations.length > 0;

              return (
                <div
                  key={item.id}
                  className={`group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-200 active:scale-[0.98] ${totalQty > 0 ? "ring-2 ring-primary-500 ring-offset-0 bg-primary-50 dark:bg-primary-900/10" : ""}`}
                  onClick={(e) =>
                    (hasVariations || (item.extras && item.extras.length > 0) || item.isCombo)
                      ? setVariationModalItem(item)
                      : handleAddToCart(e, item, 1)
                  }
                >
                  {/* Image Area */}
                  <div className="h-36 sm:h-48 relative bg-gray-100 dark:bg-gray-700">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {totalQty > 0 && (
                      <div className="absolute top-2 right-2 bg-primary-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg bounce-in">
                        {totalQty}
                      </div>
                    )}
                    {hasVariations && (
                      <div className="absolute top-2 left-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-primary-600 shadow-sm">
                        {t('menu.variations_title').toUpperCase()}
                      </div>
                    )}
                    {item.isCombo && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1">
                        <UtensilsCrossed size={10} /> COMBO
                      </div>
                    )}

                    {(() => {
                      const hasStock = item.stock === undefined || item.stock === null || item.stock > 0 ||
                        (item.variations && item.variations.some(v => v.stock === undefined || v.stock === null || v.stock > 0));
                      if (!hasStock) return (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                          <span className="bg-red-600 text-white font-black text-xs px-4 py-2 rounded-full shadow-2xl transform -rotate-12 border-2 border-white/20 uppercase tracking-widest">
                            {t("orders.sold_out")}
                          </span>
                        </div>
                      );
                      return null;
                    })()}

                    {/* Add Button Overlay - Disabled if closed or menu disabled */}
                    {/* Add Button Overlay - Disabled if closed or menu disabled */}
                    {!realtimeIsCajaCerrada && realtimeIsMenuEnabled && (item.stock === undefined || item.stock > 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((item.variations && item.variations.length > 0) || item.isCombo) {
                            setVariationModalItem(item);
                          } else {
                            handleAddToCart(e, item);
                          }
                        }}
                        className="absolute bottom-2 right-2 p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-lg transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"
                      >
                        {(item.variations && item.variations.length > 0) || (item.extras && item.extras.length > 0) || item.isCombo ? (
                          <Plus size={20} />
                        ) : (
                          <ShoppingCart size={20} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Info Area */}
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1">
                      {item.name}
                    </h3>

                    {item.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 mb-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
                          {t('menu.price')}
                        </span>
                        <span className="text-primary-600 dark:text-primary-400 font-extrabold text-sm">
                          {formatCurrencyLocal(
                            hasVariations
                              ? Math.min(...item.variations!.map((v) => v.price))
                              : item.price,
                            settings.currency
                          )}
                          {hasVariations && "+"}
                        </span>
                      </div>

                      {(() => {
                        const hasStock = item.stock === undefined || item.stock === null || item.stock > 0 ||
                          (item.variations && item.variations.some(v => v.stock === undefined || v.stock === null || v.stock > 0));

                        if (!realtimeIsCajaCerrada && realtimeIsMenuEnabled && hasStock) {
                          return (
                            <div className="flex flex-col items-end">
                              {item.stock !== undefined && item.stock !== null && !hasVariations && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1 ${item.stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                  {item.stock} {t('orders.stock_available')}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  if ((item.variations && item.variations.length > 0) || item.isCombo) {
                                    setVariationModalItem(item);
                                  } else {
                                    handleAddToCart(null, item);
                                  }
                                }}
                                className="sm:hidden p-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-lg"
                              >
                                {(item.variations && item.variations.length > 0) || (item.extras && item.extras.length > 0) || item.isCombo ? (
                                  <Plus size={16} />
                                ) : (
                                  <ShoppingCart size={16} />
                                )}
                              </button>
                            </div>
                          );
                        } else if (!hasStock) {
                          return (
                            <span className="text-[10px] items-center flex font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                              {t("orders.sold_out")}
                            </span>
                          );
                        } else {
                          // Ordering disabled but has stock - show nothing or a subtle message if needed
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          isActuallyLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-ping"></div>
                </div>
              </div>
              <p className="mt-6 text-gray-900 dark:text-white font-black uppercase tracking-widest text-xs animate-pulse">
                {t('menu.syncing')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-in">
              <div className="w-32 h-32 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-8 relative">
                <Search className="w-12 h-12 text-gray-200" />
                <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-900 p-2 rounded-full shadow-lg">
                  <X className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight font-sans">
                {t('menu.no_items_found') || 'No se encontraron productos'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto font-medium">
                No hay productos disponibles en esta categoría actualmente.
              </p>
            </div>
          )
        )}
      </div>

      {/* Social Footer */}
      {branchId && <SocialFooter branchId={branchId} />}


      {/* Cart Floating Button - DESIGN FIX */}
      {
        cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none flex justify-center pb-safe-bottom">
            {/* Wrapper con padding inferior seguro para evitar barras de navegación */}
            <div className="w-full px-4 pb-8 pt-4">
              <button
                ref={cartBtnRef}
                onClick={() => setIsCartOpen(true)}
                className="pointer-events-auto bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl h-16 shadow-2xl flex items-center justify-between w-full max-w-lg mx-auto transform active:scale-95 transition-all duration-150 ring-2 ring-white/20 dark:ring-black/20 px-4"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  marginBottom: 'env(safe-area-inset-bottom, 20px)' /* Soporte para notches y barras */
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary-500 text-white rounded-full h-10 w-10 flex items-center justify-center font-black text-lg shadow-lg pointer-events-none border-2 border-gray-900 dark:border-white">
                    {cart.reduce((acc, i) => acc + i.quantity, 0)}
                  </div>
                  <span className="font-extrabold text-xl pointer-events-none select-none tracking-tight">{t("orders.cart")}</span>
                </div>

                <div className="bg-white/10 dark:bg-black/10 px-3 py-1 rounded-lg pointer-events-none">
                  <span className="font-black text-xl pointer-events-none select-none">
                    {formatCurrencyLocal(cartTotal, settings.currency)}
                  </span>
                </div>
              </button>
            </div>
          </div>
        )
      }



      {/* New Variation Modal - KFC Style with Images */}
      {
        variationModalItem && (
          <Modal
            isOpen={!!variationModalItem}
            onClose={() => {
              setVariationModalItem(null);
              setVariationQuantities({});
              setVariationExtras({});
              setComboSelections([]);
              setComboQuantities(1);
            }}
            title={variationModalItem.isCombo ? `Arma tu Combo: ${variationModalItem.name}` : variationModalItem.name}
          >
            <div className="space-y-4">
              {!variationModalItem.isCombo && (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {(variationModalItem.variations?.length || 0) > 0 ? t("orders.select_variations") : "Personaliza tu pedido"}
                </p>
              )}

              <div className="flex flex-col gap-3 max-h-[72vh] overflow-y-auto custom-scrollbar p-1 pb-24">
                {/* ----------------- COMBO RENDERING ----------------- */}
                {variationModalItem.isCombo && (
                  <div className="space-y-6">
                    {/* Main Product Display */}
                    <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                      <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase mb-2">{t('menu.main_dish')}</h4>
                      {(() => {
                        const mainItem = menuItems.find(i => i.id === variationModalItem.mainProductId);
                        if (!mainItem) return <p className="text-red-500">Producto principal no encontrado.</p>;

                        const mainVar = variationModalItem.mainVariantId
                          ? mainItem.variations?.find(v => v.id === variationModalItem.mainVariantId)
                          : null;

                        const displayName = mainVar ? `${mainItem.name} (${mainVar.name})` : mainItem.name;
                        const displayImg = mainVar?.image || mainItem.image;

                        // Stock Check Logic
                        const stock = mainVar ? mainVar.stock : mainItem.stock;
                        const isOutOfStock = stock !== undefined && stock !== null && stock <= 0;

                        if (isOutOfStock) return (
                          <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded text-center font-bold">
                            AGOTADO
                          </div>
                        );

                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                              {displayImg ? (
                                <img src={displayImg} className="w-full h-full object-cover" loading="lazy" />
                              ) : <ImageIcon className="m-auto mt-4 text-gray-400" />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                              <div className="flex flex-col gap-1">
                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={12} /> {t('menu.included')}</p>
                                {stock !== undefined && stock !== null && (
                                  <p className="text-[10px] font-bold text-gray-500">{stock} {t('orders.stock_available')}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Complements Selection */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                        <Plus size={16} className="text-primary-500" /> {t('menu.choose_complement')} (1)
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {(variationModalItem.comboItems || []).map(itemId => {
                          const item = menuItems.find(i => i.id === itemId);
                          if (!item) return null;

                          const hasVariations = item.variations && item.variations.length > 0;
                          const isItemSelected = comboSelections.some(s => s.itemId === item.id);

                          return (
                            <div key={item.id} className="space-y-2">
                              {/* Item Header / Selector */}
                              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isItemSelected ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'}`}>
                                <input
                                  type="radio"
                                  name="combo_complement"
                                  checked={isItemSelected}
                                  onChange={() => {
                                    if (!hasVariations) {
                                      setComboSelections([{ itemId: item.id }]);
                                    } else {
                                      // If has variations, don't auto-select yet, just mark item as current focus? 
                                      // Actually, for simplicity, select first variation or just mark item
                                      setComboSelections([{ itemId: item.id, variationId: item.variations![0].id }]);
                                    }
                                  }}
                                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                                />
                                <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0">
                                  {item.image ? <img src={item.image} className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon className="p-2 text-gray-300" />}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.name}</p>
                                  {item.stock !== undefined && item.stock !== null && !hasVariations && (
                                    <span className={`text-[10px] font-bold ${item.stock <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                      {item.stock > 0 ? `${item.stock} ${t('orders.stock_available')}` : t('orders.sold_out')}
                                    </span>
                                  )}
                                </div>
                              </label>

                              {/* Variations sub-list if item is selected */}
                              {isItemSelected && hasVariations && (
                                <div className="ml-8 grid grid-cols-1 gap-1.5 animate-fade-in">
                                  {item.variations?.map(v => {
                                    const isVarSelected = comboSelections.some(s => s.itemId === item.id && s.variationId === v.id);
                                    const isVarOutOfStock = v.stock !== undefined && v.stock !== null && v.stock <= 0;

                                    return (
                                      <label key={v.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isVarSelected ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-400' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'} ${isVarOutOfStock ? 'opacity-50 grayscale' : 'cursor-pointer'}`}>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            name={`var_${item.id}`}
                                            disabled={isVarOutOfStock}
                                            checked={isVarSelected}
                                            onChange={() => setComboSelections([{ itemId: item.id, variationId: v.id }])}
                                            className="w-4 h-4 text-primary-600"
                                          />
                                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{v.name}</span>
                                        </div>
                                        {v.stock !== undefined && v.stock !== null && (
                                          <span className={`text-[10px] font-bold ${v.stock <= 0 ? 'text-red-500' : 'text-primary-600'}`}>
                                            {v.stock > 0 ? `${v.stock} disp.` : 'AGOTADO'}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Combo Quantity and Price Display */}
                    <div className="pt-4 border-t dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Cantidad:</span>
                        <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
                          <button onClick={() => setComboQuantities(Math.max(1, comboQuantities - 1))} className="p-1"><Minus size={18} /></button>
                          <span className="font-bold w-6 text-center">{comboQuantities}</span>
                          <button onClick={() => {
                            // 1. Check Main Item Stock
                            const mainProduct = menuItems.find(mi => mi.id === variationModalItem.mainProductId);
                            if (mainProduct) {
                              const mainVar = variationModalItem.mainVariantId ? mainProduct.variations?.find(v => v.id === variationModalItem.mainVariantId) : null;
                              const stock = mainVar ? mainVar.stock : mainProduct.stock;
                              if (stock !== undefined && stock !== null && comboQuantities + 1 > stock) {
                                alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${mainProduct.name} - ${stock}`);
                                return;
                              }
                            }

                            // 2. Check Complement Stock
                            for (const sel of comboSelections) {
                              const compItem = menuItems.find(i => i.id === sel.itemId);
                              if (compItem) {
                                const compVar = sel.variationId ? compItem.variations?.find(v => v.id === sel.variationId) : undefined;
                                const compStock = compVar ? compVar.stock : compItem.stock;
                                if (compStock !== undefined && compStock !== null && comboQuantities + 1 > compStock) {
                                  alert(`${t('menu.stock_low') || "No hay suficiente stock. Disponible:"} ${compVar ? `${compItem.name} (${compVar.name})` : compItem.name} - ${compStock}`);
                                  return;
                                }
                              }
                            }

                            setComboQuantities(comboQuantities + 1);
                          }} className="p-1"><Plus size={18} /></button>
                        </div>
                      </div>

                      {/* Price Display Only */}
                      <div className="bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-2xl p-4 text-center">
                        <div className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">
                          {t('menu.total_price')}
                        </div>
                        <div className="text-3xl font-black text-primary-700 dark:text-primary-300">
                          {formatCurrencyLocal(variationModalItem.price * comboQuantities, settings.currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Existing Main Item Extras (Only show if NO variations and NOT combo) */}
                {!variationModalItem.isCombo && (variationModalItem.variations?.length || 0) === 0 && variationModalItem.extras && variationModalItem.extras.length > 0 && (
                  <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl mb-2 border border-primary-100 dark:border-primary-800">
                    <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      {t('menu.extras') || 'Agregados Extras'}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {variationModalItem.extras.map(extra => (
                        <label key={extra.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border-2 border-transparent hover:border-primary-200 dark:hover:border-primary-800 cursor-pointer transition-all shadow-sm">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedExtrasIds.includes(extra.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedExtrasIds(prev => [...prev, extra.id]);
                                else setSelectedExtrasIds(prev => prev.filter(id => id !== extra.id));
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{extra.name}</span>
                          </div>
                          <span className="text-sm font-extrabold text-primary-600">+{formatCurrencyLocal(extra.price, settings.currency)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variations Section with Integrated Extras */}
                {(variationModalItem.variations?.length || 0) > 0 && variationModalItem?.variations?.map((v) => {
                  if (!v) return null;
                  const qty = variationQuantities[v.id] || 0;
                  const isOutOfStock = v.stock !== undefined && v.stock !== null && v.stock <= 0;
                  const canAddMore = v.stock === undefined || v.stock === null || qty < v.stock;
                  const isSelected = qty > 0;

                  // Determine available extras: Specific to variation OR inherited from main item
                  const availableExtras = (v.extras && v.extras.length > 0) ? v.extras : variationModalItem.extras;
                  const myExtras = variationExtras[v.id] || [];

                  return (
                    <div key={v.id} className="flex flex-col gap-2">
                      <div
                        className={`group relative flex items-center bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 overflow-hidden ${isSelected
                          ? "border-primary-500 shadow-md ring-1 ring-primary-500 dark:ring-primary-900"
                          : "border-transparent shadow-sm hover:border-primary-200 dark:hover:border-gray-600 border-gray-100 dark:border-gray-700"
                          } ${isOutOfStock ? "opacity-60 grayscale-[0.5]" : "cursor-pointer"}`}
                        onClick={() => {
                          if (!isOutOfStock && canAddMore) {
                            handleVariationQuantityChange(v.id, 1);
                          }
                        }}
                      >
                        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-h-[100px]">
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1 pr-2">
                                {v.name}
                              </h3>
                              {isSelected && (
                                <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shrink-0">
                                  {qty}x
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-extrabold text-primary-600 dark:text-primary-400">
                                {formatCurrencyLocal(
                                  v.price ?? variationModalItem?.price ?? 0,
                                  settings.currency,
                                )}
                              </span>
                              {!isOutOfStock && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${v.stock != null ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700' : 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 font-bold'}`}>
                                  {v.stock != null ? `${v.stock} disp.` : <InfinityIcon size={14} className="inline mb-0.5" />}
                                </span>
                              )}
                            </div>
                          </div>

                          {!isOutOfStock && !realtimeIsCajaCerrada && realtimeIsMenuEnabled ? (
                            <div className="flex items-center mt-auto" onClick={(e) => e.stopPropagation()}>
                              {qty > 0 ? (
                                <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-1 space-x-3 border border-gray-200 dark:border-gray-600">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVariationQuantityChange(v.id, -1);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-gray-600 shadow-sm text-gray-600 dark:text-gray-200 hover:text-red-500 transition-colors"
                                  >
                                    <Minus size={14} strokeWidth={3} />
                                  </button>
                                  <span className="font-bold text-gray-900 dark:text-white w-4 text-center">{qty}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVariationQuantityChange(v.id, 1);
                                    }}
                                    disabled={!canAddMore}
                                    className="w-7 h-7 flex items-center justify-center rounded-md bg-primary-600 shadow-sm text-white hover:bg-primary-700 disabled:bg-gray-300 transition-colors"
                                  >
                                    <Plus size={14} strokeWidth={3} />
                                  </button>
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-lg group-hover:bg-primary-100 transition-colors flex items-center gap-1">
                                  <Plus size={14} /> Agregar
                                </div>
                              )}
                            </div>
                          ) : isOutOfStock ? (
                            <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block self-start">
                              {t("orders.sold_out")}
                            </span>
                          ) : null}
                        </div>

                        <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gray-100 dark:bg-gray-700 shrink-0 relative">
                          {v.image ? (
                            <img
                              src={v.image}
                              alt={v.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as any).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                              <ImageIcon size={32} />
                            </div>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px]" />
                          )}
                        </div>
                      </div>

                      {/* EXTRAS FOR THIS VARIATION - Visible if selected */}
                      {isSelected && availableExtras && availableExtras.length > 0 && (
                        <div className="ml-4 mr-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border-l-4 border-primary-500 animate-fade-in text-sm">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Extras para {v.name}</p>
                          <div className="grid grid-cols-1 gap-2">
                            {availableExtras.map(ex => {
                              const isChecked = myExtras.includes(ex.id);
                              return (
                                <label key={ex.id} className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded transition-colors">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setVariationExtras(prev => {
                                          const current = prev[v.id] || [];
                                          const updated = checked
                                            ? [...current, ex.id]
                                            : current.filter(id => id !== ex.id);
                                          return { ...prev, [v.id]: updated };
                                        });
                                      }}
                                      className="rounded w-4 h-4 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">{ex.name}</span>
                                  </div>
                                  <span className="text-xs font-bold text-primary-600">+{formatCurrencyLocal(ex.price, settings.currency)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-4 mt-4 border-t dark:border-gray-700 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setVariationModalItem(null);
                  setVariationQuantities({});
                  setVariationExtras({});
                }}
              >
                {t("menu.cancel")}
              </Button>
              {!realtimeIsCajaCerrada && realtimeIsMenuEnabled && (
                <Button
                  className="flex-1"
                  onClick={handleAddVariationsToCart}
                  disabled={
                    (variationModalItem.variations?.length || 0) > 0 &&
                    Object.values(variationQuantities).reduce(
                      (a: number, b: number) => a + b,
                      0,
                    ) === 0
                  }
                >
                  {t("orders.add_to_order")}
                </Button>
              )}
            </div>
          </Modal>
        )
      }

      {/* Cart Modal (Order Summary) */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title={t("orders.current_order")}
      >
        <div className="flex flex-col h-full">
          <div className="flex-grow overflow-y-auto max-h-[35vh] space-y-4 mb-4 custom-scrollbar px-1">
            {cart.map((item, idx) => {
              const price = item.variation?.price ?? item.menuItem.price;
              const displayName = item.variation
                ? `${item.menuItem.name} (${item.variation.name})`
                : item.menuItem.name;

              return (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 rounded-xl shadow-sm"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                      {displayName}
                    </h4>
                    {/* Price with increased size and bold */}
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {formatCurrencyLocal(price, settings.currency)}
                    </div>
                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {item.selectedExtras.map(e => (
                          <div key={e.id} className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                              {e.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="w-8 h-8 rounded-md bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center font-bold shadow-sm hover:bg-gray-100 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    {/* Quantity with increased size and dark mode fix */}
                    <span className="font-bold w-6 text-center text-base text-gray-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="w-8 h-8 rounded-md bg-primary-600 text-white flex items-center justify-center font-bold shadow-sm hover:bg-primary-700 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                Your cart is empty
              </p>
            )}
          </div>

          {cart.length > 0 && (
            <div className="space-y-6 border-t dark:border-gray-700 pt-6 mb-8">


              <div className="space-y-2 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-sm font-bold text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrencyLocal(itemsTotal, settings.currency)}</span>
                </div>
                {orderType === OrderType.Delivery && (
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>{t("delivery.cost_label")}</span>
                    <span>{dynamicDeliveryFee === -1 ? "---" : formatCurrencyLocal(dynamicDeliveryFee ?? settings.deliveryCost ?? 0, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>{t("orders.total")}</span>
                  <span>{formatCurrencyLocal(cartTotal, settings.currency)}</span>
                </div>
              </div>

              <div className="space-y-6 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("orders.customer_name")}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setValidationError("");
                    }}
                    placeholder={t("orders.enter_name_placeholder")}
                     className={`w-full rounded-xl border-2 ${validationError && !customerName ? "border-red-500 bg-red-50" : "border-gray-200 bg-gray-50"} dark:border-gray-700 dark:bg-gray-800 p-4 focus:ring-0 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white`}
                     maxLength={TEXT_LIMITS.NAME}
                   />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("orders.tax_id")} <span className="text-[10px] lowercase italic opacity-80">{t("common.optional")}</span>
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder={t("orders.tax_id_placeholder")}
                     className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 p-4 focus:ring-0 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white"
                     maxLength={TEXT_LIMITS.TAX_ID}
                   />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("orders.order_type")}
                  </label>
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-1">
                    <button
                      onClick={() => setOrderType(OrderType.DineIn)}
                      className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${orderType === OrderType.DineIn ? "bg-white dark:bg-gray-700 shadow-md text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
                    >
                      {t("orders.dine_in")}
                    </button>
                    <button
                      onClick={() => setOrderType(OrderType.Takeaway)}
                      className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${orderType === OrderType.Takeaway ? "bg-white dark:bg-gray-700 shadow-md text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
                    >
                      {t("orders.takeaway")}
                    </button>
                    {settings.enableDelivery && featureDelivery && (
                      <button
                        onClick={() => setOrderType(OrderType.Delivery)}
                        className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${orderType === OrderType.Delivery ? "bg-white dark:bg-gray-700 shadow-md text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
                      >
                        {t("orders.delivery")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Delivery Map & Reference */}
                {orderType === OrderType.Delivery && featureDelivery && (
                  <div className="animate-fade-in space-y-6">
                    <DeliveryMap
                      onLocationSelect={(lat, lng) => {
                        setOrderLat(lat);
                        setOrderLng(lng);
                      }}
                      initialLat={orderLat}
                      initialLng={orderLng}
                      zones={settings.deliveryZones}
                      restaurantLocation={settings.restaurantLocation}
                      isCustomerView={true}
                      limitDeliveryToZones={settings.limitDeliveryToZones}
                      isOutsideZone={dynamicDeliveryFee === -1}
                    />
                    <div className="flex flex-col gap-1 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl">
                      <div className="flex justify-between items-center text-sm font-bold text-amber-800 dark:text-amber-400">
                        <span>{t("delivery.cost_label")}</span>
                        <span>{dynamicDeliveryFee === -1 ? "FUERA DE ÁREA" : formatCurrencyLocal(dynamicDeliveryFee ?? settings.deliveryCost ?? 0, settings.currency)}</span>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 italic leading-tight">
                        {orderLat && orderLng
                          ? (dynamicDeliveryFee === -1
                            ? "Tu ubicación excede el límite de distancia permitido."
                            : (dynamicDeliveryFee !== undefined && dynamicDeliveryFee !== settings.deliveryCost
                              ? "Tarifa calculada según tu zona"
                              : "Tarifa estándar para esta ubicación"))
                          : t("delivery.cost_message")}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {t("delivery.reference_label")}
                      </label>
                      <input
                        type="text"
                        value={shippingReference}
                        onChange={(e) => {
                          setShippingReference(e.target.value);
                          setValidationError("");
                        }}
                        placeholder={t("delivery.reference_placeholder")}
                         className={`w-full rounded-xl border-2 ${validationError && orderType === OrderType.Delivery && !shippingReference ? "border-red-500 bg-red-50" : "border-gray-100 bg-gray-50/50"} dark:border-gray-700 dark:bg-gray-800/50 p-4 focus:ring-4 focus:ring-primary-50 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white`}
                         maxLength={200}
                       />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {t("common.phone")}
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          setValidationError("");
                        }}
                        placeholder={t("common.phone_placeholder")}
                         className={`w-full rounded-xl border-2 ${validationError && orderType === OrderType.Delivery && !customerPhone ? "border-red-500 bg-red-50" : "border-gray-200 bg-gray-50"} dark:border-gray-700 dark:bg-gray-800 p-4 focus:ring-4 focus:ring-primary-50 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white`}
                         maxLength={TEXT_LIMITS.PHONE}
                       />
                    </div>
                  </div>
                )}

                {/* Table ID Field - Conditioned on Order Type */}
                {orderType === OrderType.DineIn && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      {t("orders.table_number_optional")}
                    </label>
                    <input
                      type="text"
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 p-4 focus:ring-4 focus:ring-primary-50 focus:border-primary-500 transition-all font-bold text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("menu.notes_label")} <span className="text-[10px] lowercase italic opacity-80">{t("common.optional")}</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("menu.notes_placeholder")}
                    rows={2}
                     className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 p-4 focus:ring-4 focus:ring-primary-50 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white resize-none"
                    maxLength={TEXT_LIMITS.NOTES}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t("orders.payment_method")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedPaymentMethod("cash")}
                    className={`flex flex-col items-center justify-center pt-5 pb-4 px-2 rounded-2xl border-2 transition-all duration-300 ${selectedPaymentMethod === "cash" ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-4 ring-primary-100 dark:ring-primary-900/10" : "border-gray-100 dark:border-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    <Wallet size={32} className="mb-2" />
                    <span className="font-extrabold text-xs uppercase tracking-tight">
                      {t("orders.cash")}
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedPaymentMethod("qr")}
                    className={`flex flex-col items-center justify-center pt-5 pb-4 px-2 rounded-2xl border-2 transition-all duration-300 ${selectedPaymentMethod === "qr" ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-4 ring-primary-100 dark:ring-primary-900/10" : "border-gray-100 dark:border-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    <QrCode size={32} className="mb-2" />
                    <span className="font-extrabold text-xs uppercase tracking-tight">
                      {t("orders.qr")}
                    </span>
                  </button>
                </div>

                {selectedPaymentMethod === "qr" ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl text-center border border-blue-100 dark:border-blue-800">
                    {settings.qrImage ? (
                      <div className="flex flex-col items-center mb-6">
                        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400 font-medium">
                          {t("orders.pay_with_qr")}
                        </p>
                        <img
                          src={settings.qrImage}
                          alt="QR Code"
                          className="h-40 w-40 object-contain border-4 border-white rounded-xl shadow-sm mb-3"
                        />
                        <a
                          href={settings.qrImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`QR_Pago_${settings.restaurantName.replace(/[^a-z0-9]/gi, '_')}.png`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-3 py-2 rounded-full shadow-md border border-blue-100 transition-all hover:scale-105 active:scale-95"
                        >
                          <Upload size={14} className="rotate-180" />
                          DESCARGAR QR
                        </a>
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-600 mt-4">
                          {t("orders.pay_to", {
                            name: settings.qrPayeeName || settings.restaurantName,
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-6 font-medium">
                        Cargando información de pago QR...
                      </p>
                    )}

                    {/* Receipt Upload Field - Always visible if QR is selected */}
                    <label className="relative block w-full cursor-pointer bg-white dark:bg-gray-700 border-2 border-dashed border-primary-300 dark:border-primary-800 hover:border-primary-500 rounded-xl p-6 text-center transition-all group overflow-hidden active:scale-[0.98]">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReceiptUpload}
                      />
                      <div className="flex flex-col items-center justify-center text-gray-500 group-hover:text-blue-600">
                        {paymentReceiptImage ? (
                          <>
                            <Check
                              size={28}
                              className="text-green-500 mb-2"
                            />
                            <span className="text-green-600 font-bold text-sm">
                              ¡Comprobante Subido!
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload size={24} className="mb-2" />
                            <span className="text-sm font-bold">
                              {t("orders.upload_receipt")}
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl text-center border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {t("customer.payment.pay_at_counter_prompt")}
                    </p>
                  </div>
                )}
              </div>

              {validationError && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-center text-sm font-bold">
                  <span className="mr-2">⚠️</span> {validationError}
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting || cart.length === 0}
                className="w-full bg-primary-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-500/30 active:scale-95 transition-all text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-tight"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('customer.processing') || 'PROCESANDO...'}</span>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full px-2">
                    <div className="flex items-center gap-2">
                      <Check size={28} />
                      <span>{t('orders.place_order')}</span>
                    </div>
                    <div className="flex flex-col items-end bg-white/20 px-4 py-1.5 rounded-xl border border-white/30 backdrop-blur-sm">
                      <span className="text-[10px] uppercase font-bold tracking-wide opacity-90 leading-none mb-1">Total a Pagar</span>
                      <span className="text-2xl font-black leading-none">{formatCurrencyLocal(cartTotal, settings.currency)}</span>
                    </div>
                  </div>
                )}
              </button>

              {/* Extra spacing for scrolling on mobile to avoid overlap with floating buttons */}
              <div className="h-24 w-full"></div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CustomerMenu;
