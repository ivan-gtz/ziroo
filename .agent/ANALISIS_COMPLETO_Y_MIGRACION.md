# 🔍 ANÁLISIS COMPLETO Y PLAN DE MIGRACIÓN A BASE DE DATOS

**Fecha:** 11 de Diciembre, 2025  
**Objetivo:** Preparar migración de LocalStorage a Supabase/MySQL

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual
- **Almacenamiento:** LocalStorage (navegador)
- **Contextos:** 7 separados + 1 orquestador
- **Datos:** 14 entidades principales
- **Páginas:** 17 páginas funcionales
- **Tamaño estimado:** ~1-5MB de datos por restaurante

### Objetivo
- **Migrar a:** Supabase (PostgreSQL) o MySQL
- **Mantener:** Toda la funcionalidad actual
- **Mejorar:** Sincronización, backup, multi-dispositivo
- **Agregar:** Real-time updates, auditoría completa

---

## 🗄️ MODELO DE DATOS COMPLETO

### 1. ENTIDADES PRINCIPALES (14 tablas)

#### Tabla 1: `users` 👥
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES managed_restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Waiter', 'Cook', 'Cashier')),
    phone VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- ⚠️ CAMBIO: De texto plano a hash
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_restaurant ON users(restaurant_id);
CREATE INDEX idx_users_email ON users(email);
```

**Datos actuales en LocalStorage:**
```typescript
{
    id: string,
    restaurantId?: string,
    branchId: string,
    name: string,
    role: 'Admin' | 'Waiter' | 'Cook' | 'Cashier',
    phone: string,
    email: string,
    password_INSECURE: string // ⚠️ Texto plano
}
```

**Migración necesaria:**
- ✅ Hashear contraseñas con bcrypt
- ✅ Convertir IDs a UUID
- ✅ Agregar timestamps

---

#### Tabla 2: `managed_restaurants` 🏢
```sql
CREATE TABLE managed_restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    admin_password_hash VARCHAR(255) NOT NULL, -- ⚠️ CAMBIO: Hash
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    can_create_users BOOLEAN DEFAULT true,
    can_create_branches BOOLEAN DEFAULT true,
    can_customer_view BOOLEAN DEFAULT true,
    can_customize_animation BOOLEAN DEFAULT false,
    type VARCHAR(20) CHECK (type IN ('Full', 'Basic')) DEFAULT 'Full',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_restaurants_end_date ON managed_restaurants(end_date);
```

**Datos actuales:**
```typescript
{
    id: string,
    name: string,
    adminEmail: string,
    adminPassword_INSECURE: string, // ⚠️ Texto plano
    startDate: string,
    endDate: string,
    canCreateUsers: boolean,
    canCreateBranches: boolean,
    canCustomerView?: boolean,
    canCustomizeAnimation?: boolean,
    type?: 'Full' | 'Basic'
}
```

---

#### Tabla 3: `branches` 🏪
```sql
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES managed_restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_branches_restaurant ON branches(restaurant_id);
CREATE INDEX idx_branches_approved ON branches(is_approved);
```

**Datos actuales:**
```typescript
{
    id: string,
    restaurantId?: string,
    name: string,
    isApproved: boolean
}
```

---

#### Tabla 4: `categories` 📂
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon_type VARCHAR(20) CHECK (icon_type IN ('lucide', 'custom')),
    icon_value VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(branch_id, name)
);

CREATE INDEX idx_categories_branch ON categories(branch_id);
```

**Datos actuales:**
```typescript
{
    id: string,
    name: string,
    iconType: 'lucide' | 'custom',
    iconValue: string
}
```

**⚠️ CAMBIO IMPORTANTE:** Agregar `branch_id` para multi-tenant

---

#### Tabla 5: `menu_items` 🍽️
```sql
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT,
    stock INTEGER, -- NULL = sin control de stock
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_menu_items_branch ON menu_items(branch_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_stock ON menu_items(stock) WHERE stock IS NOT NULL;
```

**Datos actuales:**
```typescript
{
    id: string,
    name: string,
    description?: string,
    price: number,
    category: string, // ⚠️ CAMBIO: Ahora será category_id (UUID)
    image?: string,
    stock?: number,
    variations?: MenuItemVariation[]
}
```

---

#### Tabla 6: `menu_item_variations` 🔄
```sql
CREATE TABLE menu_item_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2), -- NULL = usa precio del item padre
    stock INTEGER, -- NULL = sin control de stock
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variations_menu_item ON menu_item_variations(menu_item_id);
```

**Datos actuales:**
```typescript
{
    id: string,
    name: string,
    price?: number,
    stock?: number
}
```

**⚠️ CAMBIO:** Separar en tabla independiente (normalización)

---

#### Tabla 7: `orders` 📦
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    daily_ticket_number INTEGER NOT NULL,
    table_id VARCHAR(50),
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'AwaitingApproval', 'Pending', 'Preparing', 'Ready', 'Delivered', 'Cancelled'
    )),
    order_type VARCHAR(20) CHECK (order_type IN ('DineIn', 'Takeaway')),
    customer_name VARCHAR(255),
    payment_method VARCHAR(20) CHECK (payment_method IN ('Cash', 'QR', 'Combined')),
    total_amount DECIMAL(10, 2),
    discount DECIMAL(10, 2) DEFAULT 0,
    waiter_name VARCHAR(255),
    source VARCHAR(50), -- 'Menu Cliente' | 'Órdenes'
    payment_receipt_image TEXT,
    cash_paid DECIMAL(10, 2),
    cash_change DECIMAL(10, 2),
    qr_paid DECIMAL(10, 2),
    tax_id VARCHAR(50),
    completion_time INTEGER, -- minutos
    ready_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(branch_id, daily_ticket_number, DATE(created_at))
);

CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_daily_ticket ON orders(branch_id, daily_ticket_number, created_at);
```

**Datos actuales:**
```typescript
{
    id: string,
    dailyTicketNumber: number,
    tableId: string,
    items: OrderItem[], // ⚠️ CAMBIO: Separar en tabla order_items
    status: OrderStatus,
    timestamp: Date,
    orderType: OrderType,
    customerName?: string,
    paymentMethod?: PaymentMethod,
    totalAmount?: number,
    discount?: number,
    waiterName?: string,
    source?: string,
    paymentReceiptImage?: string,
    cashPaid?: number,
    cashChange?: number,
    qrPaid?: number,
    taxId?: string,
    completionTime?: number,
    readyTime?: Date
}
```

---

#### Tabla 8: `order_items` 📋
```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    variation_id UUID REFERENCES menu_item_variations(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL, -- Precio al momento de la orden
    item_name VARCHAR(255) NOT NULL, -- Snapshot del nombre
    variation_name VARCHAR(255), -- Snapshot del nombre de variación
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);
```

**Datos actuales:**
```typescript
{
    menuItem: MenuItem, // ⚠️ CAMBIO: Solo guardar ID y snapshot
    quantity: number,
    variation?: MenuItemVariation
}
```

**⚠️ IMPORTANTE:** Guardar snapshot de nombres y precios para histórico

---

#### Tabla 9: `inventory_transactions` 📊
```sql
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES menu_item_variations(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL, -- Positivo = entrada, Negativo = salida
    transaction_type VARCHAR(50) CHECK (transaction_type IN (
        'manual_add', 'order_deduction', 'order_cancellation', 'adjustment'
    )),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inventory_branch ON inventory_transactions(branch_id);
CREATE INDEX idx_inventory_item ON inventory_transactions(menu_item_id);
CREATE INDEX idx_inventory_created_at ON inventory_transactions(created_at);
```

**Datos actuales:**
```typescript
{
    id: string,
    branchId: string,
    menuItemId: string,
    variationId?: string,
    itemName: string,
    quantity: number,
    timestamp: Date,
    userId: string,
    userName: string
}
```

**⚠️ MEJORA:** Agregar `transaction_type` para mejor auditoría

---

#### Tabla 10: `branch_settings` ⚙️
```sql
CREATE TABLE branch_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    restaurant_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT '$',
    website_url TEXT,
    qr_image TEXT,
    qr_payee_name VARCHAR(255),
    logo_image TEXT,
    address TEXT,
    phone VARCHAR(50),
    enable_tax_invoice BOOLEAN DEFAULT true,
    tax_id VARCHAR(50),
    business_name VARCHAR(255),
    economic_activity VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(255) DEFAULT 'BOLIVIA',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_branch_settings_branch ON branch_settings(branch_id);
```

**Datos actuales:**
```typescript
{
    restaurantName: string,
    currency: string,
    socialLinks: SocialLinks,
    websiteUrl?: string,
    qrImage?: string,
    qrPayeeName?: string,
    logoImage?: string,
    address?: string,
    phone?: string,
    enableTaxInvoice?: boolean,
    animationConfig?: AnimationConfig,
    taxId?: string,
    businessName?: string,
    economicActivity?: string,
    city?: string,
    country?: string
}
```

---

#### Tabla 11: `social_links` 🌐
```sql
CREATE TABLE social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_settings_id UUID UNIQUE REFERENCES branch_settings(id) ON DELETE CASCADE,
    facebook VARCHAR(255),
    instagram VARCHAR(255),
    tiktok VARCHAR(255),
    youtube VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Datos actuales:**
```typescript
{
    facebook?: string,
    instagram?: string,
    tiktok?: string,
    youtube?: string
}
```

**⚠️ CAMBIO:** Separar en tabla independiente (normalización)

---

#### Tabla 12: `animation_configs` 🎨
```sql
CREATE TABLE animation_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_settings_id UUID UNIQUE REFERENCES branch_settings(id) ON DELETE CASCADE,
    background_color VARCHAR(20) DEFAULT '#06c167',
    text_color VARCHAR(20) DEFAULT '#ffffff',
    text VARCHAR(255) DEFAULT 'Ziroo',
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Datos actuales:**
```typescript
{
    backgroundColor?: string,
    textColor?: string,
    text?: string,
    logoUrl?: string
}
```

---

#### Tabla 13: `pager_statuses` 📟
```sql
CREATE TABLE pager_statuses (
    id INTEGER PRIMARY KEY, -- ID del pager (1-99)
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    state VARCHAR(20) CHECK (state IN ('inactive', 'preparing', 'ready')),
    timestamp TIMESTAMP NOT NULL,
    elapsed INTEGER, -- Segundos transcurridos (frozen cuando ready)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id, branch_id)
);

CREATE INDEX idx_pager_status_branch ON pager_statuses(branch_id);
```

**Datos actuales:**
```typescript
{
    id: number,
    state: 'inactive' | 'preparing' | 'ready',
    timestamp: Date,
    elapsed?: number
}
```

**⚠️ CAMBIO:** Agregar `branch_id` para multi-tenant

---

#### Tabla 14: `pager_logs` 📝
```sql
CREATE TABLE pager_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    pager_id INTEGER NOT NULL,
    completion_time TIMESTAMP NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pager_logs_branch ON pager_logs(branch_id);
CREATE INDEX idx_pager_logs_completion ON pager_logs(completion_time);
```

**Datos actuales:**
```typescript
{
    id: string,
    pagerId: number,
    completionTime: Date,
    durationSeconds: number
}
```

---

#### Tabla 15: `system_settings` (SuperAdmin) 🔧
```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_website_url TEXT,
    logo_sidebar TEXT,
    logo_login TEXT,
    logo_animation TEXT,
    super_admin_email VARCHAR(255) UNIQUE NOT NULL,
    super_admin_password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Solo debe haber un registro
CREATE UNIQUE INDEX idx_system_settings_singleton ON system_settings ((id IS NOT NULL));
```

**Datos actuales:**
```typescript
{
    appWebsiteUrl: string,
    logoSidebar: string,
    logoLogin: string,
    logoAnimation: string
}
```

---

## 🔄 REFACTORIZACIONES ADICIONALES NECESARIAS

### 1. ⚠️ PÁGINAS CON DEMASIADO ESTADO LOCAL

#### CustomerMenu.tsx (870 líneas, 51KB)
**Problemas:**
- 20+ estados locales con `useState`
- Lógica de carrito mezclada con UI
- Animaciones mezcladas con lógica de negocio

**Refactorización recomendada:**
```
CustomerMenu.tsx (actual 870 líneas)
    ↓
CustomerMenu/
├── index.tsx (100 líneas) - Componente principal
├── hooks/
│   ├── useCart.ts - Lógica del carrito
│   ├── useAnimations.ts - Lógica de animaciones
│   └── useOrderPlacement.ts - Lógica de crear orden
├── components/
│   ├── CartModal.tsx - Modal del carrito
│   ├── VariationModal.tsx - Modal de variaciones
│   ├── CategoryFilter.tsx - Filtro de categorías
│   └── MenuItem Card.tsx - Tarjeta de producto
└── utils/
    └── cartCalculations.ts - Cálculos de totales
```

**Beneficios:**
- ✅ Código más mantenible
- ✅ Lógica reutilizable
- ✅ Más fácil de testear
- ✅ Separación de responsabilidades

---

#### WaiterOrder.tsx (984 líneas, 54KB)
**Problemas:**
- 22+ estados locales
- Lógica de pago mezclada con UI
- Modal de checkout muy complejo

**Refactorización recomendada:**
```
WaiterOrder/
├── index.tsx (150 líneas)
├── hooks/
│   ├── useOrderForm.ts - Formulario de orden
│   ├── usePayment.ts - Lógica de pago
│   └── useOrderFilters.ts - Filtros de órdenes
├── components/
│   ├── OrderForm.tsx - Formulario de nueva orden
│   ├── CheckoutModal.tsx - Modal de pago
│   ├── OrderList.tsx - Lista de órdenes
│   └── PaymentMethods.tsx - Métodos de pago
└── utils/
    └── paymentCalculations.ts
```

---

#### Settings.tsx (421 líneas, 24KB)
**Problemas:**
- 30+ estados locales
- Múltiples formularios en un solo componente
- Lógica de carga de imágenes repetida

**Refactorización recomendada:**
```
Settings/
├── index.tsx (100 líneas)
├── sections/
│   ├── BranchSettings.tsx - Configuración de sucursal
│   ├── TaxSettings.tsx - Configuración fiscal
│   ├── AnimationSettings.tsx - Configuración de animación
│   └── SuperAdminSettings.tsx - Configuración de SuperAdmin
├── hooks/
│   ├── useImageUpload.ts - Lógica de subida de imágenes
│   └── useSettingsForm.ts - Formulario de configuración
└── components/
    ├── ImageUploader.tsx - Componente reutilizable
    └── SettingsSection.tsx - Sección de configuración
```

---

### 2. ⚠️ SERVICIOS FALTANTES

Actualmente NO hay capa de servicios. Todo está en los contextos.

**Crear capa de servicios:**

```
services/
├── api/
│   ├── supabaseClient.ts - Cliente de Supabase
│   ├── authService.ts - Autenticación
│   ├── userService.ts - CRUD de usuarios
│   ├── restaurantService.ts - CRUD de restaurantes
│   ├── menuService.ts - CRUD de menú
│   ├── orderService.ts - CRUD de órdenes
│   ├── inventoryService.ts - Gestión de inventario
│   └── settingsService.ts - Configuración
├── storage/
│   └── imageService.ts - Subida de imágenes a Supabase Storage
└── realtime/
    └── realtimeService.ts - Subscripciones en tiempo real
```

**Ejemplo de servicio:**

```typescript
// services/api/orderService.ts
import { supabase } from './supabaseClient';
import { Order, OrderStatus } from '../../types';

export const orderService = {
    // Crear orden
    async createOrder(order: Omit<Order, 'id'>): Promise<Order> {
        const { data, error } = await supabase
            .from('orders')
            .insert([order])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // Actualizar estado
    async updateStatus(id: string, status: OrderStatus): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .update({ status, updated_at: new Date() })
            .eq('id', id);
        
        if (error) throw error;
    },

    // Obtener órdenes por sucursal
    async getByBranch(branchId: string): Promise<Order[]> {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }
};
```

---

### 3. ⚠️ HOOKS PERSONALIZADOS FALTANTES

**Crear hooks reutilizables:**

```
hooks/
├── useAuth.ts - Ya existe en AuthContext
├── useMenu.ts - Ya existe en MenuContext
├── useOrder.ts - Ya existe en OrderContext
├── useImageUpload.ts - NUEVO: Subida de imágenes
├── useDebounce.ts - NUEVO: Debounce para búsquedas
├── useInfiniteScroll.ts - NUEVO: Scroll infinito
├── useRealtime.ts - NUEVO: Subscripciones en tiempo real
└── usePermissions.ts - NUEVO: Verificación de permisos
```

**Ejemplo:**

```typescript
// hooks/useImageUpload.ts
import { useState } from 'react';
import { imageService } from '../services/storage/imageService';

export const useImageUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadImage = async (file: File, path: string): Promise<string | null> => {
        setUploading(true);
        setError(null);
        
        try {
            const url = await imageService.upload(file, path);
            return url;
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setUploading(false);
        }
    };

    return { uploadImage, uploading, error };
};
```

---

### 4. ⚠️ COMPONENTES REUTILIZABLES FALTANTES

**Crear biblioteca de componentes:**

```
components/
├── ui/ (Ya existen: Button, Card, Modal)
│   ├── Input.tsx - NUEVO
│   ├── Select.tsx - NUEVO
│   ├── Textarea.tsx - NUEVO
│   ├── Checkbox.tsx - NUEVO
│   ├── Radio.tsx - NUEVO
│   ├── Switch.tsx - NUEVO
│   ├── Badge.tsx - NUEVO
│   ├── Alert.tsx - NUEVO
│   ├── Toast.tsx - NUEVO
│   ├── Spinner.tsx - NUEVO
│   ├── Skeleton.tsx - NUEVO
│   └── Table.tsx - NUEVO
├── forms/
│   ├── FormField.tsx - Campo de formulario con validación
│   ├── FormSection.tsx - Sección de formulario
│   └── FormActions.tsx - Botones de formulario
└── data/
    ├── DataTable.tsx - Tabla con paginación y filtros
    ├── EmptyState.tsx - Estado vacío
    └── ErrorState.tsx - Estado de error
```

---

## 📋 PLAN DE MIGRACIÓN A SUPABASE/MYSQL

### FASE 1: PREPARACIÓN (1-2 días)

#### 1.1. Crear esquema de base de datos
- [ ] Crear todas las tablas (15 tablas)
- [ ] Crear índices para performance
- [ ] Crear constraints y foreign keys
- [ ] Crear triggers para `updated_at`

#### 1.2. Configurar Supabase
- [ ] Crear proyecto en Supabase
- [ ] Configurar autenticación
- [ ] Configurar Storage para imágenes
- [ ] Configurar Row Level Security (RLS)

#### 1.3. Crear servicios
- [ ] Crear `supabaseClient.ts`
- [ ] Crear servicios para cada entidad
- [ ] Crear servicio de imágenes
- [ ] Crear servicio de realtime

---

### FASE 2: MIGRACIÓN DE DATOS (1 día)

#### 2.1. Script de migración
```typescript
// scripts/migrateToSupabase.ts
import { supabase } from '../services/api/supabaseClient';

async function migrateLocalStorageToSupabase() {
    // 1. Obtener datos de LocalStorage
    const localData = JSON.parse(localStorage.getItem('ziroo_app_state_v2') || '{}');
    
    // 2. Hashear contraseñas
    const hashedUsers = await Promise.all(
        localData.users.map(async (user) => ({
            ...user,
            password_hash: await bcrypt.hash(user.password_INSECURE, 10)
        }))
    );
    
    // 3. Migrar restaurantes
    const { data: restaurants } = await supabase
        .from('managed_restaurants')
        .insert(localData.managedRestaurants)
        .select();
    
    // 4. Migrar sucursales
    const { data: branches } = await supabase
        .from('branches')
        .insert(localData.branches)
        .select();
    
    // 5. Migrar usuarios
    await supabase.from('users').insert(hashedUsers);
    
    // 6. Migrar categorías
    // 7. Migrar items del menú
    // 8. Migrar variaciones
    // 9. Migrar órdenes
    // 10. Migrar order_items
    // 11. Migrar inventory_transactions
    // 12. Migrar configuraciones
    // 13. Migrar pagers
    
    console.log('✅ Migración completada');
}
```

---

### FASE 3: REFACTORIZAR CONTEXTOS (2-3 días)

#### 3.1. Actualizar AuthContext
```typescript
// context/AuthContext.tsx
import { authService } from '../services/api/authService';

const login = async (email: string, password: string) => {
    // ANTES: Buscar en LocalStorage
    // AHORA: Llamar a Supabase
    const user = await authService.login(email, password);
    setCurrentUser(user);
};
```

#### 3.2. Actualizar MenuContext
```typescript
// context/MenuContext.tsx
import { menuService } from '../services/api/menuService';
import { useRealtime } from '../hooks/useRealtime';

const MenuProvider = ({ children }) => {
    const [menuItems, setMenuItems] = useState([]);
    
    // Cargar datos iniciales
    useEffect(() => {
        const loadMenu = async () => {
            const items = await menuService.getByBranch(activeBranchId);
            setMenuItems(items);
        };
        loadMenu();
    }, [activeBranchId]);
    
    // Subscripción en tiempo real
    useRealtime('menu_items', (payload) => {
        if (payload.eventType === 'INSERT') {
            setMenuItems(prev => [...prev, payload.new]);
        }
        // ... otros eventos
    });
};
```

#### 3.3. Actualizar OrderContext
```typescript
// context/OrderContext.tsx
import { orderService } from '../services/api/orderService';
import { inventoryService } from '../services/api/inventoryService';

const addOrder = async (orderData) => {
    // 1. Crear orden en DB
    const order = await orderService.createOrder(orderData);
    
    // 2. Descontar inventario (con transacción)
    await inventoryService.deductStock(order.items);
    
    // 3. Actualizar estado local
    setOrders(prev => [...prev, order]);
    
    return order;
};

const updateOrderStatus = async (id, status) => {
    // 1. Si se cancela, restaurar inventario
    if (status === 'Cancelled') {
        const order = orders.find(o => o.id === id);
        await inventoryService.restoreStock(order.items);
    }
    
    // 2. Actualizar en DB
    await orderService.updateStatus(id, status);
    
    // 3. Actualizar estado local
    setOrders(prev => prev.map(o => 
        o.id === id ? { ...o, status } : o
    ));
};
```

---

### FASE 4: REFACTORIZAR PÁGINAS (3-4 días)

#### 4.1. CustomerMenu
- [ ] Extraer lógica de carrito a `useCart` hook
- [ ] Extraer animaciones a `useAnimations` hook
- [ ] Separar componentes (CartModal, VariationModal, etc.)
- [ ] Usar servicios en lugar de contexto directo

#### 4.2. WaiterOrder
- [ ] Extraer lógica de pago a `usePayment` hook
- [ ] Separar CheckoutModal
- [ ] Crear componentes reutilizables
- [ ] Usar servicios

#### 4.3. Settings
- [ ] Separar en secciones
- [ ] Crear hook `useImageUpload`
- [ ] Usar servicios

---

### FASE 5: AGREGAR FUNCIONALIDADES (2-3 días)

#### 5.1. Real-time updates
```typescript
// Subscripción a cambios en órdenes
supabase
    .channel('orders')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `branch_id=eq.${branchId}`
    }, (payload) => {
        // Actualizar estado local
        handleOrderChange(payload);
    })
    .subscribe();
```

#### 5.2. Subida de imágenes a Supabase Storage
```typescript
// services/storage/imageService.ts
export const imageService = {
    async upload(file: File, path: string): Promise<string> {
        const { data, error } = await supabase.storage
            .from('images')
            .upload(path, file);
        
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(path);
        
        return publicUrl;
    }
};
```

#### 5.3. Auditoría completa
- [ ] Trigger para registrar cambios en órdenes
- [ ] Trigger para registrar cambios en inventario
- [ ] Tabla de audit_logs

---

### FASE 6: TESTING Y VALIDACIÓN (2 días)

#### 6.1. Tests unitarios
- [ ] Tests para servicios
- [ ] Tests para hooks
- [ ] Tests para utilidades

#### 6.2. Tests de integración
- [ ] Flujo completo de crear orden
- [ ] Flujo completo de cancelar orden
- [ ] Flujo completo de inventario

#### 6.3. Tests E2E
- [ ] Login
- [ ] Crear orden desde CustomerMenu
- [ ] Crear orden desde WaiterOrder
- [ ] Cancelar orden
- [ ] Gestión de menú

---

## 📊 RESUMEN DE REFACTORIZACIONES

### Contextos ✅ COMPLETADO
- [x] AuthContext (110 líneas)
- [x] RestaurantContext (230 líneas)
- [x] MenuContext (150 líneas)
- [x] OrderContext (280 líneas)
- [x] UserContext (80 líneas)
- [x] SettingsContext (70 líneas)
- [x] PagerContext (100 líneas)

### Páginas ⚠️ PENDIENTE
- [ ] CustomerMenu.tsx (870 líneas → ~400 líneas)
- [ ] WaiterOrder.tsx (984 líneas → ~500 líneas)
- [ ] Settings.tsx (421 líneas → ~200 líneas)
- [ ] MenuManagement.tsx (25KB → ~15KB)
- [ ] DailySales.tsx (31KB → ~20KB)
- [ ] TotalRecords.tsx (28KB → ~18KB)

### Servicios ⚠️ PENDIENTE
- [ ] authService.ts
- [ ] userService.ts
- [ ] restaurantService.ts
- [ ] menuService.ts
- [ ] orderService.ts
- [ ] inventoryService.ts
- [ ] settingsService.ts
- [ ] imageService.ts
- [ ] realtimeService.ts

### Hooks ⚠️ PENDIENTE
- [ ] useImageUpload.ts
- [ ] useDebounce.ts
- [ ] useRealtime.ts
- [ ] usePermissions.ts
- [ ] useCart.ts
- [ ] usePayment.ts

### Componentes UI ⚠️ PENDIENTE
- [ ] Input, Select, Textarea
- [ ] Checkbox, Radio, Switch
- [ ] Badge, Alert, Toast
- [ ] Spinner, Skeleton
- [ ] Table, DataTable

---

## 🎯 PRIORIDADES

### 🔴 CRÍTICO (Hacer primero)
1. ✅ Refactorizar contextos (COMPLETADO)
2. ⚠️ Crear servicios de API
3. ⚠️ Migrar a Supabase
4. ⚠️ Implementar real-time

### 🟡 ALTO (Hacer después)
1. ⚠️ Refactorizar CustomerMenu.tsx
2. ⚠️ Refactorizar WaiterOrder.tsx
3. ⚠️ Refactorizar Settings.tsx
4. ⚠️ Crear hooks reutilizables

### 🟢 MEDIO (Hacer cuando haya tiempo)
1. ⚠️ Crear componentes UI reutilizables
2. ⚠️ Agregar tests
3. ⚠️ Optimizar performance
4. ⚠️ Mejorar SEO

---

## ✅ CONCLUSIÓN

### Estado Actual
- ✅ Contextos refactorizados (7 separados)
- ✅ Datos bien estructurados
- ✅ Correcciones de bugs aplicadas
- ⚠️ Páginas grandes sin refactorizar
- ⚠️ Sin capa de servicios
- ⚠️ Sin base de datos real

### Próximos Pasos
1. **Crear servicios de API** (2-3 días)
2. **Migrar a Supabase** (2-3 días)
3. **Refactorizar páginas grandes** (3-4 días)
4. **Agregar real-time** (1-2 días)
5. **Testing completo** (2 días)

### Tiempo Total Estimado
**12-15 días de trabajo** para completar toda la refactorización y migración.

---

**¿Quieres que empiece con alguna fase específica?**
