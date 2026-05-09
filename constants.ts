import { MenuItem, Order, OrderStatus, User, OrderType, PaymentMethod, Branch, UserRole, SuperAdmin, ManagedRestaurant, Category } from './types';

export const MAIN_BRANCH_ID = 'main_branch';
export const MAIN_RESTAURANT_ID = 'main_restaurant';

export const SUPER_ADMIN_USER: SuperAdmin = {
  id: 'super_admin',
  name: 'App Admin',
  email: 'vismarviracajk@gmail.com',
  password_INSECURE: 'Mateo2414%',
  role: 'SuperAdmin'
};

export const INITIAL_BRANCHES: Branch[] = [
  { id: MAIN_BRANCH_ID, restaurantId: MAIN_RESTAURANT_ID, name: 'Ziroo chef (Default)', isApproved: true }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'Dish', name: 'Platos', iconType: 'lucide', iconValue: 'UtensilsCrossed' },
  { id: 'Drink', name: 'Bebidas', iconType: 'lucide', iconValue: 'Coffee' },
  { id: 'Dessert', name: 'Postres', iconType: 'lucide', iconValue: 'IceCream' },
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Pollo Broaster',
    description: 'Crujiente y jugoso pollo frito estilo broaster.',
    price: 17.00,
    category: 'Dish',
    image: 'https://picsum.photos/seed/broaster/400/300',
    stock: 20,
  },
  {
    id: '2',
    name: 'Pollo a la leña',
    description: 'Pollo marinado y cocido lentamente a la leña.',
    price: 18.00,
    category: 'Dish',
    image: 'https://picsum.photos/seed/lena/400/300',
  },
  {
    id: '3',
    name: 'Silpancho',
    description: 'Tradicional plato con carne apanada, huevo, papas y arroz.',
    price: 15.00,
    category: 'Dish',
    image: 'https://picsum.photos/seed/silpancho/400/300',
  },
  {
    id: '4',
    name: 'Coca-Cola',
    description: 'Bebida gaseosa refrescante.',
    price: 5.00,
    category: 'Drink',
    stock: 50,
  },
  {
    id: '5',
    name: 'Fanta',
    description: 'Bebida gaseosa sabor naranja.',
    price: 5.00,
    category: 'Drink',
  },
  {
    id: '6',
    name: 'Agua Mineral',
    description: 'Agua sin gas.',
    price: 4.00,
    category: 'Drink',
  },
  {
    id: '7',
    name: 'Flan de Caramelo',
    description: 'Postre cremoso con caramelo.',
    price: 8.00,
    category: 'Dessert',
    image: 'https://picsum.photos/seed/flan/400/300',
    stock: 15,
  }
];


export const INITIAL_USERS: User[] = [
  { id: '1', restaurantId: MAIN_RESTAURANT_ID, branchId: MAIN_BRANCH_ID, name: 'Alice', role: UserRole.Admin, phone: '+1 555-0101', email: 'alice.admin@ziroo.app', password_INSECURE: 'adminpass' },
  { id: '2', restaurantId: MAIN_RESTAURANT_ID, branchId: MAIN_BRANCH_ID, name: 'Bob', role: UserRole.Waiter, phone: '+1 555-0102', email: 'bob.waiter@ziroo.app', password_INSECURE: 'waiterpass' },
  { id: '3', restaurantId: MAIN_RESTAURANT_ID, branchId: MAIN_BRANCH_ID, name: 'Charlie', role: UserRole.Cook, phone: '+1 555-0103', email: 'charlie.cook@ziroo.app', password_INSECURE: 'cookpass' },
  { id: '4', restaurantId: MAIN_RESTAURANT_ID, branchId: MAIN_BRANCH_ID, name: 'Diana', role: UserRole.Waiter, phone: '+1 555-0104', email: 'diana.waiter@ziroo.app', password_INSECURE: 'waiterpass2' },
  { id: '5', restaurantId: MAIN_RESTAURANT_ID, branchId: MAIN_BRANCH_ID, name: 'Eve', role: UserRole.Cashier, phone: '+1 555-0105', email: 'eve.cashier@ziroo.app', password_INSECURE: 'cashierpass' },
];

export const INITIAL_MANAGED_RESTAURANTS: ManagedRestaurant[] = [
  {
    id: MAIN_RESTAURANT_ID,
    name: 'Ziroo chef (Default)',
    adminEmail: 'alice.admin@ziroo.app',
    adminPassword_INSECURE: 'adminpass',
    startDate: '2024-01-01',
    endDate: '2099-12-31',
    isActive: true, // NEW
    features: { // NEW
      menuDigital: true,
      kitchenDisplay: true,
      inventory: true,
      reports: true,
      basicPagers: true,
      whatsappNotifications: false,
      delivery: false
    },
    canCreateUsers: true,
    canCreateBranches: true,
    canCustomerView: true,
    canCustomizeAnimation: false,
    type: 'Full',
  }
];

export const INITIAL_ORDERS: Order[] = [
  // Today's orders
  {
    id: '101',
    dailyTicketNumber: 1,
    tableId: '5',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[0], quantity: 2 }, // Pollo Broaster (Stocked)
      { menuItem: INITIAL_MENU_ITEMS[3], quantity: 2 }, // Coca-Cola (Stocked)
    ],
    status: OrderStatus.Delivered,
    timestamp: new Date(),
    orderType: OrderType.DineIn,
    customerName: 'John Doe',
    paymentMethod: PaymentMethod.Cash,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 44.00,
    completionTime: 15,
  },
  {
    id: '102',
    dailyTicketNumber: 2,
    tableId: '3',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[1], quantity: 1 },
      { menuItem: INITIAL_MENU_ITEMS[6], quantity: 1 }, // Flan (Stocked)
    ],
    status: OrderStatus.Delivered,
    timestamp: new Date(),
    orderType: OrderType.DineIn,
    paymentMethod: PaymentMethod.QR,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 26.00,
    completionTime: 22,
  },
  {
    id: '103',
    dailyTicketNumber: 3,
    tableId: '',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[2], quantity: 2 },
      { menuItem: INITIAL_MENU_ITEMS[4], quantity: 1 },
    ],
    status: OrderStatus.Ready, // Keep one non-delivered for kitchen view
    timestamp: new Date(),
    orderType: OrderType.Takeaway,
    customerName: 'Jane Smith',
    paymentMethod: PaymentMethod.Cash,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 35.00
  },
  // Yesterday's orders
  {
    id: '104',
    dailyTicketNumber: 1,
    tableId: '8',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[0], quantity: 2 }, // Pollo Broaster
    ],
    status: OrderStatus.Delivered,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    orderType: OrderType.DineIn,
    customerName: 'Old Customer',
    paymentMethod: PaymentMethod.Cash,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 34.00,
    completionTime: 18,
  },
  // 2 days ago
  {
    id: '105',
    dailyTicketNumber: 1,
    tableId: '2',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[2], quantity: 1 },
      { menuItem: INITIAL_MENU_ITEMS[5], quantity: 1 },
    ],
    status: OrderStatus.Delivered,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    orderType: OrderType.DineIn,
    paymentMethod: PaymentMethod.QR,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 19.00,
    completionTime: 12,
  },
  // 3 days ago
  {
    id: '106',
    dailyTicketNumber: 1,
    tableId: '',
    items: [
      { menuItem: INITIAL_MENU_ITEMS[0], quantity: 3 }, // Pollo Broaster
      { menuItem: INITIAL_MENU_ITEMS[6], quantity: 2 }, // Flan
    ],
    status: OrderStatus.Delivered,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    orderType: OrderType.Takeaway,
    customerName: 'Frequent Buyer',
    paymentMethod: PaymentMethod.Cash,
    branchId: MAIN_BRANCH_ID,
    totalAmount: 67.00,
    completionTime: 25,
  }
];