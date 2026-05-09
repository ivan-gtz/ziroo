
export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

export enum Language {
  EN = 'en',
  ES = 'es',
}

export enum UserRole {
  Admin = 'Admin',
  Waiter = 'Waiter',
  Cook = 'Cook',
  Cashier = 'Cashier',
  DeliveryDriver = 'DeliveryDriver',
}

export enum OrderStatus {
  AwaitingApproval = 'AwaitingApproval',
  Pending = 'Pending',
  Preparing = 'Preparing',
  Ready = 'Ready',
  PickedUp = 'PickedUp',
  Delivered = 'Delivered',
  Cancelled = 'Cancelled',
}

export enum OrderType {
  DineIn = 'DineIn',
  Takeaway = 'Takeaway',
  Delivery = 'Delivery',
}

export enum PaymentMethod {
  Cash = 'Cash',
  QR = 'QR',
  Combined = 'Combined',
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
}

export interface AnimationConfig {
  backgroundColor?: string;
  textColor?: string;
  text?: string;
  logoUrl?: string;
}

export interface BranchSettings {
  restaurantName: string;
  currency: string;
  socialLinks: SocialLinks;
  websiteUrl?: string;
  qrImage?: string;
  qrPayeeName?: string;
  logoImage?: string;
  shareImage?: string;
  shareTitle?: string;
  shareDescription?: string;
  address?: string;
  phone?: string;
  enableTaxInvoice?: boolean;
  animationConfig?: AnimationConfig;
  taxId?: string;
  businessName?: string;
  economicActivity?: string;
  city?: string;
  country?: string;
  isMenuEnabled?: boolean;
  enableKitchenPrint?: boolean;
  enableSound?: boolean;
  enableVibration?: boolean;
  enableDelivery?: boolean;
  deliveryCost?: number;
  // Fiscal / SIAT Bolivia Fields
  fiscalNit?: string;
  fiscalBusinessName?: string;
  fiscalAuthorization?: string;
  fiscalMunicipio?: string;
  fiscalSucursalCode?: number;
  fiscalLegend?: string;
  restaurantMapsLink?: string;
  restaurantLocation?: { lat: number; lng: number };
  deliveryZones?: DeliveryZone[];
  limitDeliveryToZones?: boolean;
  banners?: Banner[];
  bannerImages?: string[]; // Deprecated, keep for backward compatibility
  canCustomerView?: boolean; // Injected from restaurants table
  featureDelivery?: boolean; // Injected from restaurants table
}

export interface DeliveryZone {
  id: string;
  name: string;
  price: number;
  points: { lat: number; lng: number }[];
  color?: string;
}

export interface Banner {
  id: string;
  image: string; // base64 or url
  actionType: 'none' | 'link' | 'product';
  actionValue?: string; // url or productId
}

export interface MenuItemVariation {
  id: string;
  name: string;
  price?: number;
  stock?: number;
  image?: string; // URL o base64 de la imagen de la variación
  extras?: ProductExtra[];
}

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  stock?: number;
  variations?: MenuItemVariation[];
  extras?: ProductExtra[];
  // Combo Logic
  isCombo?: boolean;
  mainProductId?: string; // ID of the fixed main product (e.g. Pollo A)
  mainVariantId?: string; // Optional: ID of specific variant (e.g. Doble)
  comboItems?: string[]; // IDs of selectable side items (e.g. Sopa A, Sopa B)
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  variation?: MenuItemVariation;
  selectedExtras?: ProductExtra[];
}

export interface Order {
  id: string;
  dailyTicketNumber: number;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  timestamp: Date;
  orderType: OrderType;
  customerName?: string;
  paymentMethod?: PaymentMethod;
  totalAmount?: number;
  deliveryFee?: number;
  discount?: number;
  waiterName?: string;
  source?: string;
  paymentReceiptImage?: string;
  cashPaid?: number;
  cashChange?: number;
  qrPaid?: number;
  taxId?: string;
  completionTime?: number;
  readyTime?: Date;
  deliveredTime?: Date;
  notes?: string;
  branchId: string;
  // Delivery Fields
  shippingLat?: number;
  shippingLng?: number;
  shippingReference?: string;
  customerPhone?: string;
  assignedDriverId?: string;
  isSharedWithDrivers?: boolean;
  assignedDriver?: {
    name: string;
    phone?: string;
    licenseNumber?: string;
    profileImage?: string;
  };
  // Fiscal / SIAT Bolivia Fields
  customerNitCI?: string;
  customerComplement?: string;
  customerDocType?: number; // 1: CI, 5: NIT, etc.
  fiscalNumber?: number;
  fiscalControlCode?: string;
  fiscalBaseAmount?: number;
  fiscalDebitFiscal?: number;
  autoCancelled?: boolean; // Track if order was auto-cancelled due to timeout
}

export interface User {
  id: string;
  restaurantId?: string;
  branchId: string;
  name: string;
  role: UserRole;
  phone?: string;
  email: string;
  password_INSECURE: string;
  sessionToken?: string;
  restaurantType?: string;
}

export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  password_INSECURE: string;
  role: 'SuperAdmin';
  sessionToken?: string;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  email: string;
  password_INSECURE: string;
  phone?: string;
  licenseNumber?: string;
  profileImage?: string;
  isAvailable: boolean;
  credits: number;
  totalEarnings?: number;
  ordersCompleted?: number;
  country?: string;
  city?: string;
  role: UserRole.DeliveryDriver;
}

export interface Branch {
  id: string;
  restaurantId?: string;
  name: string;
  isApproved: boolean;
  isOpen?: boolean;
}

export interface RestaurantFeatures {
  menuDigital: boolean;
  kitchenDisplay: boolean;
  inventory: boolean;
  reports: boolean;
  basicPagers: boolean;
  delivery: boolean;
  whatsappNotifications: boolean;
}

export interface ManagedRestaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  logo?: string;
  adminEmail: string;
  adminPassword_INSECURE: string;
  isActive: boolean;
  endDate: string;
  startDate?: string; // Optional now
  country?: string;
  city?: string;
  features: RestaurantFeatures;
  // Legacy fields kept for compatibility or mapped 
  // Permissions
  canCreateUsers?: boolean;
  canCreateBranches?: boolean;
  canCustomerView?: boolean;
  canCustomizeAnimation?: boolean;
  type?: 'Full' | 'Basic' | 'Complete' | 'Pro' | 'Premium';
  trialDays?: number;
  trialStartDate?: string;
  trialEndDate?: string;
  isTrialActive?: boolean;
  // Custom Pricing & Payments
  customPlanPrice?: number;
  customOnlineFee?: number;
  currencySymbol?: string;
  lastCommissionPayment?: string; // ISO Date string
  commissionPaidDates?: string[]; // Array of ISO Date strings
}

export interface Category {
  id: string;
  name: string;
  iconType: 'lucide' | 'custom';
  iconValue: string;
}

export interface InventoryTransaction {
  id: string;
  branchId: string;
  menuItemId: string;
  variationId?: string;
  itemName: string;
  quantity: number;
  timestamp: Date;
  userId: string;
  userName: string;
  type?: 'Restock' | 'Sale' | 'Return';
}

export type PagerState = 'inactive' | 'preparing' | 'ready';

export interface PagerStatus {
  id: number;
  state: PagerState;
  timestamp: Date;
  elapsed?: number;
}

export interface PagerLog {
  id: string;
  pagerId: number;
  completionTime: Date;
  durationSeconds: number;
}

export interface Expense {
  id: string;
  branchId: string;
  cashRegisterId?: string;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export interface SystemSettings {
  appWebsiteUrl: string;
  logoSidebar: string;
  logoLogin: string;
  logoAnimation: string;
  faviconUrl?: string;
  appTitle?: string;
  supportWhatsApp?: string;
  pwaIconUrl?: string;
  shareImage?: string;
}

export interface CashRegister {
  id: string;
  branchId: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt?: Date;
  openedByName?: string;
  closedByName?: string;
}

export interface MonthlyDailyData {
  date: string;
  ticketsIssued: number;
  qrPayments: number;
  cashPayments: number;
  cancellations: number;
  totalSales: number;
}

export interface MonthlySummary {
  id: string;
  branchId: string;
  year: number;
  month: number;
  operatingDays: number;
  averageTicket: number;
  totalSales: number;
  dailyDataJson: MonthlyDailyData[];
  createdAt: Date;
}
