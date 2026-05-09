# 📊 ANÁLISIS COMPLETO DE ARQUITECTURA - ZIROO RESTAURANT OS

**Fecha de Análisis:** 10 de Diciembre, 2025  
**Versión de la App:** v2 (ziroo_app_state_v2)  
**Analista:** Antigravity AI

---

## 🎯 RESUMEN EJECUTIVO

**Ziroo Restaurant OS** es una aplicación de gestión de restaurantes construida con **React + TypeScript + Vite**, que utiliza **LocalStorage como base de datos** (sin backend tradicional). La aplicación sigue un patrón de **Context API centralizado** para el manejo de estado global.

### ⚠️ HALLAZGOS CRÍTICOS

1. **✅ FORTALEZA:** Arquitectura bien estructurada con separación clara de responsabilidades
2. **⚠️ RIESGO ALTO:** Toda la lógica de negocio está centralizada en un solo archivo (`AppContext.tsx`)
3. **⚠️ RIESGO MEDIO:** No hay restauración de inventario al cancelar/rechazar órdenes
4. **⚠️ RIESGO MEDIO:** Falta de validaciones en operaciones críticas de inventario
5. **✅ FORTALEZA:** Buen aislamiento de datos por sucursal (branch-based isolation)

---

## 🏗️ ARQUITECTURA GENERAL

### Stack Tecnológico

```
Frontend Framework:  React 19.2.0
Language:           TypeScript 5.8.2
Build Tool:         Vite 6.2.0
Routing:            React Router DOM 7.9.6
State Management:   React Context API
Data Persistence:   LocalStorage (custom hook)
UI Components:      Custom components (no framework)
Charts:             Recharts 3.4.1
Icons:              Lucide React 0.553.0
```

### Estructura de Directorios

```
ziroo beta/
├── components/           # Componentes reutilizables
│   ├── layout/          # Layout, Header, Sidebar, BranchSwitcher
│   ├── receipt/         # Componente de recibo
│   ├── ui/              # Componentes UI básicos (Button, Card, Modal)
│   ├── PrintingProvider.tsx
│   ├── ProtectedRoute.tsx
│   └── WelcomeScreen.tsx
├── context/             # Estado global
│   ├── AppContext.tsx   # ⚠️ ARCHIVO CRÍTICO - 733 líneas
│   └── BluetoothPrinterContext.tsx
├── hooks/               # Custom hooks
│   └── useLocalStorage.ts
├── lib/                 # Utilidades
│   ├── escpos.ts       # Impresión térmica
│   ├── i18n.ts         # Traducciones (ES/EN)
│   └── imageUtils.ts   # Compresión de imágenes
├── pages/               # Páginas/Vistas (17 archivos)
│   ├── Dashboard.tsx
│   ├── MenuManagement.tsx
│   ├── WaiterOrder.tsx
│   ├── CustomerMenu.tsx
│   ├── KitchenDisplay.tsx
│   ├── Inventory.tsx
│   ├── DailySales.tsx
│   ├── TotalRecords.tsx
│   ├── Settings.tsx
│   ├── Users.tsx
│   ├── Branches.tsx
│   ├── Restaurants.tsx
│   ├── PagerController.tsx
│   ├── OnlineMonitor.tsx
│   ├── Analytics.tsx
│   ├── Login.tsx
│   └── AITools.tsx
├── services/            # Servicios externos
│   └── geminiService.ts
├── App.tsx             # Configuración de rutas
├── types.ts            # Definiciones de tipos TypeScript
├── constants.ts        # Datos iniciales y constantes
└── index.tsx           # Punto de entrada
```

---

## 💾 BASE DE DATOS Y PERSISTENCIA

### Sistema de Almacenamiento

**NO HAY BASE DE DATOS TRADICIONAL (SQL/NoSQL)**

La aplicación utiliza **LocalStorage del navegador** como única fuente de persistencia:

```typescript
// Hook personalizado: useLocalStorage.ts
const [appState, setAppState] = useLocalStorage<AppState>('ziroo_app_state_v2', INITIAL_STATE);
```

### Estructura de Datos en LocalStorage

#### Clave Principal: `ziroo_app_state_v2`

```typescript
interface AppState {
    // Usuarios del sistema
    users: User[];
    
    // Sucursales
    branches: Branch[];
    
    // Datos por sucursal (Record<branchId, data[]>)
    allMenuItems: Record<string, MenuItem[]>;
    allCategories: Record<string, Category[]>;
    allOrders: Record<string, Order[]>;
    allSettings: Record<string, BranchSettings>;
    allInventoryTransactions: Record<string, InventoryTransaction[]>;
    allDailyCounters: Record<string, number>;
    
    // Restaurantes gestionados (multi-tenant)
    managedRestaurants: ManagedRestaurant[];
    
    // Configuración global
    systemSettings: SystemSettings;
    superAdminCreds: { email: string, password_INSECURE: string };
    
    // Sistema de buscapersonas
    pagerStatuses: Record<number, PagerStatus>;
    pagerLogs: PagerLog[];
}
```

#### Otras Claves en LocalStorage

```
- ziroo_current_user: User | SuperAdmin | null
- ziroo_language: 'en' | 'es'
```

### ⚠️ IMPLICACIONES CRÍTICAS

1. **Límite de almacenamiento:** LocalStorage tiene un límite de ~5-10MB por dominio
2. **Sin sincronización:** Los datos NO se sincronizan entre dispositivos
3. **Pérdida de datos:** Limpiar caché del navegador = pérdida total de datos
4. **Sin backup automático:** No hay respaldo de datos
5. **Monousuario por dispositivo:** No hay concurrencia real

---

## 🔐 MODELO DE DATOS

### Entidades Principales

#### 1. **User** (Usuario del sistema)
```typescript
interface User {
    id: string;
    restaurantId?: string;      // FK a ManagedRestaurant
    branchId: string;           // FK a Branch
    name: string;
    role: 'Admin' | 'Waiter' | 'Cook' | 'Cashier';
    phone: string;
    email: string;
    password_INSECURE: string;  // ⚠️ Contraseña en texto plano
}
```

#### 2. **ManagedRestaurant** (Restaurante)
```typescript
interface ManagedRestaurant {
    id: string;
    name: string;
    adminEmail: string;
    adminPassword_INSECURE: string;
    startDate: string;
    endDate: string;
    canCreateUsers: boolean;
    canCreateBranches: boolean;
    canCustomerView?: boolean;
    canCustomizeAnimation?: boolean;
    type?: 'Full' | 'Basic';
}
```

#### 3. **Branch** (Sucursal)
```typescript
interface Branch {
    id: string;
    restaurantId?: string;      // FK a ManagedRestaurant
    name: string;
    isApproved: boolean;        // Control de acceso
}
```

#### 4. **MenuItem** (Producto del menú)
```typescript
interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;           // FK a Category.id
    image?: string;
    stock?: number;             // ⚠️ Inventario opcional
    variations?: MenuItemVariation[];
}

interface MenuItemVariation {
    id: string;
    name: string;
    price?: number;
    stock?: number;             // ⚠️ Inventario opcional
}
```

#### 5. **Order** (Pedido)
```typescript
interface Order {
    id: string;
    dailyTicketNumber: number;
    tableId: string;
    items: OrderItem[];
    status: OrderStatus;        // AwaitingApproval | Pending | Preparing | Ready | Delivered | Cancelled
    timestamp: Date;
    orderType: 'DineIn' | 'Takeaway';
    customerName?: string;
    paymentMethod?: 'Cash' | 'QR' | 'Combined';
    totalAmount?: number;
    discount?: number;
    waiterName?: string;
    source?: string;            // 'Menu Cliente' | 'Órdenes'
    // ... más campos
}
```

#### 6. **Category** (Categoría)
```typescript
interface Category {
    id: string;
    name: string;
    iconType: 'lucide' | 'custom';
    iconValue: string;
}
```

#### 7. **InventoryTransaction** (Transacción de inventario)
```typescript
interface InventoryTransaction {
    id: string;
    branchId: string;
    menuItemId: string;
    variationId?: string;
    itemName: string;
    quantity: number;
    timestamp: Date;
    userId: string;
    userName: string;
}
```

### Relaciones entre Entidades

```
SuperAdmin (1)
    └── ManagedRestaurant (N)
            ├── Branch (N)
            │     ├── User (N)
            │     ├── MenuItem (N)
            │     │     └── MenuItemVariation (N)
            │     ├── Category (N)
            │     ├── Order (N)
            │     │     └── OrderItem (N)
            │     ├── InventoryTransaction (N)
            │     └── BranchSettings (1)
            └── Admin User (1) [creado automáticamente]
```

---

## 🔄 FLUJO DE DATOS Y ESTADO

### Context API - AppContext.tsx (⚠️ ARCHIVO CRÍTICO)

Este archivo de **733 líneas** es el **corazón de la aplicación**. Contiene:

#### Funciones de Autenticación
- `login(email, password)` - Validación de credenciales
- `logout()` - Cierre de sesión

#### Funciones de Usuarios
- `addUser(userData)` - Crear usuario
- `updateUser(user)` - Actualizar usuario
- `deleteUser(id)` - Eliminar usuario

#### Funciones de Sucursales
- `addBranch(name)` - Crear sucursal
- `approveBranch(branchId)` - Aprobar sucursal

#### Funciones de Menú
- `addMenuItem(item)` - Agregar producto
- `updateMenuItem(item)` - Actualizar producto
- `deleteMenuItem(id)` - Eliminar producto

#### Funciones de Categorías
- `addCategory(cat)` - Agregar categoría
- `updateCategory(cat)` - Actualizar categoría
- `deleteCategory(id)` - Eliminar categoría

#### Funciones de Órdenes (⚠️ CRÍTICO PARA INVENTARIO)
```typescript
// Crear orden - DESCUENTA INVENTARIO
addOrder(orderData, targetBranchId?)

// Actualizar estado - NO RESTAURA INVENTARIO
updateOrderStatus(id, status, branchId?)
```

#### Funciones de Inventario
- `addInventoryStock(itemId, variationId, quantity)` - Agregar stock
- `updateInventoryTransaction(id, quantity)` - Actualizar transacción

#### Funciones de Restaurantes
- `addManagedRestaurant(r)` - Crear restaurante
- `updateManagedRestaurant(r)` - Actualizar restaurante
- `deleteManagedRestaurant(id)` - Eliminar restaurante

---

## 🚨 PUNTOS CRÍTICOS Y PROBLEMAS IDENTIFICADOS

### 1. ⚠️ PROBLEMA CRÍTICO: No se restaura inventario al cancelar órdenes

**Ubicación:** `AppContext.tsx` líneas 455-484

```typescript
const updateOrderStatus = (id: string, status: OrderStatus, branchId?: string) => {
    const branch = branchId || activeBranchId;
    if (!branch) return;
    
    setAppState(prev => {
         const branchOrders = prev.allOrders[branch] || [];
         const updatedOrders = branchOrders.map(o => {
             if (o.id === id) {
                 const updates: Partial<Order> = { status };
                 if (status === OrderStatus.Ready) updates.readyTime = new Date();
                 if (status === OrderStatus.Delivered) {
                     const completionTime = o.readyTime 
                         ? (new Date().getTime() - new Date(o.timestamp).getTime()) / 60000 
                         : undefined;
                     updates.completionTime = completionTime;
                 }
                 // ⚠️ NO HAY LÓGICA PARA RESTAURAR STOCK CUANDO status === OrderStatus.Cancelled
                 return { ...o, ...updates };
             }
             return o;
         });
         
         return {
             ...prev,
             allOrders: {
                 ...prev.allOrders,
                 [branch]: updatedOrders
             }
         };
    });
};
```

**Impacto:**
- Cuando se cancela una orden, el inventario NO se devuelve
- Pérdida progresiva de stock con cada cancelación
- Datos de inventario incorrectos

**Dónde se usa:**
- `WaiterOrder.tsx` línea 225 y 963
- `KitchenDisplay.tsx` línea 149

### 2. ⚠️ PROBLEMA CRÍTICO: Lógica de descuento de inventario al crear orden

**Ubicación:** `AppContext.tsx` líneas 391-453

```typescript
const addOrder = (orderData, targetBranchId?) => {
    // ... código de creación de orden ...
    
    setAppState(prev => {
        const currentMenuItems = prev.allMenuItems[branch] || [];
        const newMenuItems = JSON.parse(JSON.stringify(currentMenuItems)); // Deep clone
        
        // ⚠️ DESCUENTA INVENTARIO AQUÍ
        newOrder.items.forEach(orderItem => {
            const menuItemIndex = newMenuItems.findIndex((m: MenuItem) => m.id === orderItem.menuItem.id);
            if (menuItemIndex > -1) {
                const menuItem = newMenuItems[menuItemIndex];
                if (orderItem.variation) {
                    const varIndex = menuItem.variations?.findIndex((v: any) => v.id === orderItem.variation?.id);
                    if (varIndex !== undefined && varIndex > -1 && menuItem.variations && menuItem.variations[varIndex].stock !== undefined) {
                        menuItem.variations[varIndex].stock = Math.max(0, menuItem.variations[varIndex].stock! - orderItem.quantity);
                    }
                } else if (menuItem.stock !== undefined) {
                     menuItem.stock = Math.max(0, menuItem.stock - orderItem.quantity);
                }
            }
        });

        return {
            ...prev,
            allOrders: { ...prev.allOrders, [branch]: [...(prev.allOrders[branch] || []), newOrder] },
            allDailyCounters: { ...prev.allDailyCounters, [branch]: nextTicket },
            allMenuItems: { ...prev.allMenuItems, [branch]: newMenuItems } // ⚠️ ACTUALIZA INVENTARIO
        };
    });
};
```

**Comportamiento actual:**
1. ✅ Se descuenta inventario al crear orden
2. ❌ NO se restaura al cambiar status a `Cancelled`
3. ❌ NO se restaura al cambiar status a `AwaitingApproval` → `Cancelled`

### 3. ⚠️ ACOPLAMIENTO ALTO: Todo en un solo archivo

**AppContext.tsx** tiene 733 líneas con:
- 35 funciones exportadas
- Lógica de autenticación
- Lógica de negocio
- Gestión de estado
- Validaciones
- Cálculos

**Riesgo:**
- Cualquier cambio puede afectar múltiples funcionalidades
- Difícil de testear
- Difícil de mantener
- Alto riesgo de regresiones

### 4. ⚠️ SEGURIDAD: Contraseñas en texto plano

```typescript
password_INSECURE: string;  // ⚠️ Nombre del campo admite el problema
```

**Ubicaciones:**
- `User.password_INSECURE`
- `SuperAdmin.password_INSECURE`
- `ManagedRestaurant.adminPassword_INSECURE`

### 5. ✅ FORTALEZA: Aislamiento de datos por sucursal

```typescript
// Datos aislados por branchId
const menuItems = activeBranchId ? (appState.allMenuItems[activeBranchId] || []) : [];
const categories = activeBranchId ? (appState.allCategories[activeBranchId] || []) : [];
const orders = activeBranchId ? (appState.allOrders[activeBranchId] || []) : [];
```

**Beneficio:**
- Los usuarios solo ven datos de su sucursal
- Previene fugas de información entre sucursales

---

## 🔍 SEPARACIÓN DE FUNCIONALIDADES

### ✅ BIEN SEPARADO

#### 1. **Componentes UI** (`components/ui/`)
- `Button.tsx`
- `Card.tsx`
- `Modal.tsx`

**Evaluación:** ✅ Reutilizables, sin lógica de negocio

#### 2. **Layout** (`components/layout/`)
- `Layout.tsx` - Estructura general
- `Header.tsx` - Barra superior
- `Sidebar.tsx` - Menú lateral
- `BranchSwitcher.tsx` - Selector de sucursal

**Evaluación:** ✅ Bien separados, responsabilidad única

#### 3. **Páginas** (`pages/`)
Cada página es independiente y consume el contexto

**Evaluación:** ✅ Separación clara de vistas

#### 4. **Traducciones** (`lib/i18n.ts`)
Sistema de internacionalización completo

**Evaluación:** ✅ Bien aislado

### ⚠️ MAL SEPARADO / ACOPLADO

#### 1. **AppContext.tsx**
- ❌ Mezcla autenticación, CRUD, validaciones, cálculos
- ❌ 733 líneas en un solo archivo
- ❌ Difícil de testear unitariamente

**Recomendación:** Dividir en:
- `AuthContext.tsx` - Autenticación
- `RestaurantContext.tsx` - Gestión de restaurantes
- `OrderContext.tsx` - Gestión de órdenes e inventario
- `UserContext.tsx` - Gestión de usuarios
- `SettingsContext.tsx` - Configuración

#### 2. **Lógica de inventario**
- ❌ Mezclada con lógica de órdenes
- ❌ No hay servicio dedicado de inventario

**Recomendación:** Crear `InventoryService.ts`

---

## 📋 FLUJOS CRÍTICOS DE LA APLICACIÓN

### Flujo 1: Crear Orden desde "Menu Cliente"

```
CustomerMenu.tsx (handlePlaceOrder)
    ↓
AppContext.addOrder(orderData, branchId)
    ↓
1. Genera ID y ticket number
2. Crea objeto Order con status: AwaitingApproval
3. ⚠️ DESCUENTA INVENTARIO inmediatamente
4. Guarda orden en allOrders[branchId]
5. Actualiza allMenuItems[branchId] con nuevo stock
6. Guarda en LocalStorage
```

**Problema:** Si la orden queda en `AwaitingApproval` y luego se cancela, el inventario NO se restaura.

### Flujo 2: Crear Orden desde "Órdenes" (WaiterOrder)

```
WaiterOrder.tsx (handlePlaceOrder)
    ↓
AppContext.addOrder(orderData)  // Sin branchId, usa activeBranchId
    ↓
1. Genera ID y ticket number
2. Crea objeto Order con status: Pending
3. ⚠️ DESCUENTA INVENTARIO inmediatamente
4. Guarda orden en allOrders[activeBranchId]
5. Actualiza allMenuItems[activeBranchId]
6. Guarda en LocalStorage
```

### Flujo 3: Cancelar Orden

```
WaiterOrder.tsx o KitchenDisplay.tsx
    ↓
updateOrderStatus(orderId, OrderStatus.Cancelled)
    ↓
AppContext.updateOrderStatus(id, status, branchId)
    ↓
1. Busca la orden en allOrders[branchId]
2. Actualiza solo el campo status a "Cancelled"
3. ⚠️ NO RESTAURA INVENTARIO
4. Guarda en LocalStorage
```

**PROBLEMA CRÍTICO:** El inventario nunca se devuelve.

### Flujo 4: Aprobar Orden (desde AwaitingApproval → Pending)

```
WaiterOrder.tsx (handleApproveOrder)
    ↓
updateOrderStatus(order.id, OrderStatus.Pending)
    ↓
1. Cambia status de AwaitingApproval a Pending
2. ⚠️ Inventario ya fue descontado en addOrder
3. No hay doble descuento (correcto)
```

### Flujo 5: Agregar Stock Manualmente

```
Inventory.tsx
    ↓
AppContext.addInventoryStock(itemId, variationId, quantity)
    ↓
1. Busca el item en allMenuItems[activeBranchId]
2. Suma quantity al stock actual
3. Crea InventoryTransaction para auditoría
4. Guarda en LocalStorage
```

**Evaluación:** ✅ Funciona correctamente

---

## 🎯 RECOMENDACIONES PRIORITARIAS

### 🔴 PRIORIDAD CRÍTICA

#### 1. Implementar restauración de inventario al cancelar órdenes

**Ubicación:** `AppContext.tsx` función `updateOrderStatus`

**Solución propuesta:**
```typescript
const updateOrderStatus = (id: string, status: OrderStatus, branchId?: string) => {
    const branch = branchId || activeBranchId;
    if (!branch) return;
    
    setAppState(prev => {
         const branchOrders = prev.allOrders[branch] || [];
         const currentMenuItems = prev.allMenuItems[branch] || [];
         let newMenuItems = currentMenuItems;
         
         const updatedOrders = branchOrders.map(o => {
             if (o.id === id) {
                 const updates: Partial<Order> = { status };
                 
                 // ✅ RESTAURAR INVENTARIO SI SE CANCELA
                 if (status === OrderStatus.Cancelled && o.status !== OrderStatus.Cancelled) {
                     newMenuItems = JSON.parse(JSON.stringify(currentMenuItems));
                     o.items.forEach(orderItem => {
                         const menuItemIndex = newMenuItems.findIndex(m => m.id === orderItem.menuItem.id);
                         if (menuItemIndex > -1) {
                             const menuItem = newMenuItems[menuItemIndex];
                             if (orderItem.variation) {
                                 const varIndex = menuItem.variations?.findIndex(v => v.id === orderItem.variation?.id);
                                 if (varIndex !== undefined && varIndex > -1 && menuItem.variations) {
                                     menuItem.variations[varIndex].stock = (menuItem.variations[varIndex].stock ?? 0) + orderItem.quantity;
                                 }
                             } else if (menuItem.stock !== undefined) {
                                 menuItem.stock = (menuItem.stock ?? 0) + orderItem.quantity;
                             }
                         }
                     });
                 }
                 
                 if (status === OrderStatus.Ready) updates.readyTime = new Date();
                 if (status === OrderStatus.Delivered) {
                     const completionTime = o.readyTime 
                         ? (new Date().getTime() - new Date(o.timestamp).getTime()) / 60000 
                         : undefined;
                     updates.completionTime = completionTime;
                 }
                 return { ...o, ...updates };
             }
             return o;
         });
         
         return {
             ...prev,
             allOrders: { ...prev.allOrders, [branch]: updatedOrders },
             allMenuItems: { ...prev.allMenuItems, [branch]: newMenuItems }
         };
    });
};
```

### 🟡 PRIORIDAD ALTA

#### 2. Refactorizar AppContext.tsx

**Dividir en múltiples contextos:**
- `AuthContext.tsx` - Login, logout, currentUser
- `RestaurantContext.tsx` - Restaurantes y sucursales
- `MenuContext.tsx` - Items y categorías
- `OrderContext.tsx` - Órdenes
- `InventoryContext.tsx` - Control de stock
- `SettingsContext.tsx` - Configuración

**Beneficios:**
- Código más mantenible
- Mejor testabilidad
- Menor riesgo de regresiones
- Más fácil de entender

#### 3. Agregar validaciones de inventario

**Validar antes de crear orden:**
```typescript
// Verificar que hay stock suficiente
const hasEnoughStock = (items: OrderItem[]): boolean => {
    // Implementar validación
};
```

### 🟢 PRIORIDAD MEDIA

#### 4. Implementar sistema de logging/auditoría

**Para rastrear:**
- Cambios de inventario
- Cancelaciones de órdenes
- Cambios de estado

#### 5. Agregar tests unitarios

**Priorizar:**
- Funciones de inventario
- Lógica de órdenes
- Cálculos de totales

---

## 📊 MÉTRICAS DE CÓDIGO

```
Total de archivos TypeScript/TSX: ~30
Archivo más grande: AppContext.tsx (733 líneas)
Páginas: 17
Componentes reutilizables: ~10
Contextos: 2 (AppContext, BluetoothPrinterContext)
Custom Hooks: 1 (useLocalStorage)
Tipos definidos: ~15 interfaces/enums
```

---

## ✅ CONCLUSIONES

### Fortalezas
1. ✅ Estructura de carpetas clara y organizada
2. ✅ Buen uso de TypeScript para type safety
3. ✅ Aislamiento de datos por sucursal
4. ✅ Sistema de traducciones completo
5. ✅ Componentes UI reutilizables

### Debilidades
1. ❌ No restaura inventario al cancelar órdenes (BUG CRÍTICO)
2. ❌ AppContext demasiado grande y acoplado
3. ❌ Sin base de datos real (limitaciones de LocalStorage)
4. ❌ Contraseñas en texto plano
5. ❌ Falta de validaciones de inventario
6. ❌ Sin tests automatizados

### Riesgo de Regresión
**ALTO** - Debido a que toda la lógica está en AppContext.tsx, cualquier cambio puede afectar múltiples funcionalidades.

### Recomendación Final
**PRIORIDAD INMEDIATA:** Implementar la restauración de inventario al cancelar órdenes antes de realizar cualquier otra modificación.

---

**Fin del Análisis**
