# 🔄 DIAGRAMA DE FLUJOS Y DEPENDENCIAS - ZIROO

## 📐 ARQUITECTURA DE CAPAS

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │  Orders  │  │  Menu    │  │ Kitchen  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Inventory │  │  Sales   │  │ Settings │  │  Users   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                    17 páginas totales                        │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE LÓGICA DE NEGOCIO                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           AppContext.tsx (733 líneas)              │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ • login/logout                               │ │    │
│  │  │ • addOrder / updateOrderStatus ⚠️            │ │    │
│  │  │ • addMenuItem / updateMenuItem               │ │    │
│  │  │ • addInventoryStock                          │ │    │
│  │  │ • addUser / updateUser                       │ │    │
│  │  │ • addBranch / approveBranch                  │ │    │
│  │  │ • 35 funciones en total                      │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE PERSISTENCIA                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         useLocalStorage Hook                       │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │ • Serialización JSON                         │ │    │
│  │  │ • Validación de tipos                        │ │    │
│  │  │ • Merge de objetos                           │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR - LocalStorage                  │
│                                                              │
│  ziroo_app_state_v2: {                                      │
│    users: [],                                               │
│    branches: [],                                            │
│    allMenuItems: { branchId: [] },                          │
│    allOrders: { branchId: [] },                             │
│    allCategories: { branchId: [] },                         │
│    ...                                                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO COMPLETO: CREAR ORDEN

### Desde "Menu Cliente" (CustomerMenu.tsx)

```
┌──────────────────────────────────────────────────────────────┐
│  USUARIO CLIENTE                                             │
│  1. Selecciona items del menú                                │
│  2. Agrega al carrito                                        │
│  3. Click en "Realizar Pedido"                               │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  CustomerMenu.tsx                                            │
│  handlePlaceOrder()                                          │
│  - Valida carrito no vacío                                   │
│  - Prepara orderData con status: AwaitingApproval            │
│  - Llama addOrder(orderData, branchId)                       │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  AppContext.tsx                                              │
│  addOrder(orderData, targetBranchId)                         │
│                                                              │
│  PASO 1: Generar ID y ticket number                          │
│  ├─ newOrder.id = Date.now().toString()                     │
│  ├─ Obtener contador diario del branch                       │
│  └─ newOrder.dailyTicketNumber = nextTicket                 │
│                                                              │
│  PASO 2: ⚠️ DESCUENTO DE INVENTARIO                         │
│  ├─ Deep clone de allMenuItems[branchId]                    │
│  ├─ Para cada item en newOrder.items:                        │
│  │   ├─ Buscar menuItem por ID                              │
│  │   ├─ Si tiene variación:                                 │
│  │   │   └─ variation.stock -= quantity                     │
│  │   └─ Si no:                                              │
│  │       └─ menuItem.stock -= quantity                      │
│  └─ Math.max(0, stock) para evitar negativos                │
│                                                              │
│  PASO 3: Actualizar estado                                   │
│  ├─ Agregar orden a allOrders[branchId]                     │
│  ├─ Actualizar allMenuItems[branchId] con nuevo stock       │
│  └─ Incrementar allDailyCounters[branchId]                  │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  useLocalStorage Hook                                        │
│  - Serializa appState a JSON                                 │
│  - Guarda en localStorage['ziroo_app_state_v2']             │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  RESULTADO                                                   │
│  ✅ Orden creada con status: AwaitingApproval                │
│  ✅ Inventario descontado                                    │
│  ✅ Ticket number asignado                                   │
│  ⚠️ Si se cancela, inventario NO se restaura                │
└──────────────────────────────────────────────────────────────┘
```

### Desde "Órdenes" (WaiterOrder.tsx)

```
┌──────────────────────────────────────────────────────────────┐
│  MESERO/CAJERO                                               │
│  1. Selecciona items del menú                                │
│  2. Configura mesa/cliente                                   │
│  3. Click en "Realizar Pedido"                               │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  WaiterOrder.tsx                                             │
│  handlePlaceOrder()                                          │
│  - Valida carrito no vacío                                   │
│  - Prepara orderData con status: Pending                     │
│  - Llama addOrder(orderData) // Sin branchId explícito       │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  AppContext.tsx                                              │
│  addOrder(orderData, undefined)                              │
│  - Usa activeBranchId como branch                            │
│  - MISMO PROCESO que desde CustomerMenu                      │
│  - ⚠️ DESCUENTA INVENTARIO inmediatamente                    │
└──────────────────────────────────────────────────────────────┘
```

---

## ❌ FLUJO PROBLEMÁTICO: CANCELAR ORDEN

```
┌──────────────────────────────────────────────────────────────┐
│  USUARIO (Mesero/Cajero/Cocina)                              │
│  Click en botón "Cancelar" en una orden                      │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  WaiterOrder.tsx o KitchenDisplay.tsx                        │
│  updateOrderStatus(order.id, OrderStatus.Cancelled)          │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  AppContext.tsx                                              │
│  updateOrderStatus(id, status, branchId)                     │
│                                                              │
│  PASO 1: Buscar orden                                        │
│  ├─ Obtener branchOrders = allOrders[branchId]              │
│  └─ Buscar orden por ID                                     │
│                                                              │
│  PASO 2: Actualizar status                                   │
│  ├─ order.status = OrderStatus.Cancelled                    │
│  └─ ⚠️ NO HAY LÓGICA DE RESTAURACIÓN DE INVENTARIO          │
│                                                              │
│  PASO 3: Guardar cambios                                     │
│  └─ Actualizar allOrders[branchId]                          │
│                                                              │
│  ⚠️ PROBLEMA: allMenuItems[branchId] NO SE MODIFICA         │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  RESULTADO                                                   │
│  ✅ Orden marcada como Cancelled                             │
│  ❌ Inventario NO restaurado                                 │
│  ❌ Stock perdido permanentemente                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔍 DEPENDENCIAS ENTRE MÓDULOS

### CustomerMenu.tsx
```
DEPENDE DE:
├─ AppContext (addOrder, formatCurrency, t)
├─ useParams (branchId, tableId)
├─ MenuItem, Order, OrderItem (types)
└─ compressImage (lib/imageUtils)

USADO POR:
└─ Clientes externos (URL pública)
```

### WaiterOrder.tsx
```
DEPENDE DE:
├─ AppContext (addOrder, updateOrderStatus, menuItems, categories, orders)
├─ Receipt (componente de impresión)
├─ useReceiptActions (PrintingProvider)
└─ MenuItem, Order, OrderItem (types)

USADO POR:
└─ Meseros, Cajeros (ruta protegida)
```

### KitchenDisplay.tsx
```
DEPENDE DE:
├─ AppContext (orders, updateOrderStatus)
└─ Order, OrderStatus (types)

USADO POR:
└─ Cocineros (ruta protegida)
```

### MenuManagement.tsx
```
DEPENDE DE:
├─ AppContext (menuItems, categories, addMenuItem, updateMenuItem, deleteMenuItem)
└─ MenuItem, Category (types)

USADO POR:
└─ Administradores (ruta protegida)
```

### Inventory.tsx
```
DEPENDE DE:
├─ AppContext (menuItems, addInventoryStock, allInventoryTransactions)
└─ MenuItem, InventoryTransaction (types)

USADO POR:
└─ Administradores (ruta protegida)
```

---

## 🎯 PUNTOS DE ACOPLAMIENTO CRÍTICOS

### 🔴 ALTO ACOPLAMIENTO

#### AppContext.tsx ↔️ TODAS LAS PÁGINAS
```
Todas las páginas dependen de AppContext para:
- Datos (menuItems, orders, users, etc.)
- Funciones CRUD (add*, update*, delete*)
- Utilidades (t, formatCurrency)

⚠️ RIESGO: Cambiar AppContext puede romper CUALQUIER página
```

#### addOrder ↔️ updateOrderStatus
```
addOrder:
├─ Descuenta inventario
└─ Crea orden

updateOrderStatus:
├─ Cambia status
└─ ⚠️ NO restaura inventario si status = Cancelled

⚠️ PROBLEMA: Lógica de inventario está dividida y incompleta
```

### 🟡 ACOPLAMIENTO MEDIO

#### CustomerMenu ↔️ WaiterOrder
```
Ambos crean órdenes pero con diferente status inicial:
- CustomerMenu: AwaitingApproval
- WaiterOrder: Pending

Ambos usan la misma función addOrder()
✅ CORRECTO: Reutilización de lógica
```

#### Receipt ↔️ Order
```
Receipt depende de la estructura exacta de Order
⚠️ RIESGO MEDIO: Cambios en Order pueden romper impresión
```

### 🟢 BAJO ACOPLAMIENTO

#### Componentes UI (Button, Card, Modal)
```
✅ Independientes
✅ Reutilizables
✅ Sin lógica de negocio
```

---

## 📊 MAPA DE IMPACTO DE CAMBIOS

### Si modificas `addOrder()`:
```
IMPACTO DIRECTO:
├─ CustomerMenu.tsx (handlePlaceOrder)
├─ WaiterOrder.tsx (handlePlaceOrder)
└─ Cualquier página que cree órdenes

IMPACTO INDIRECTO:
├─ KitchenDisplay (muestra órdenes creadas)
├─ DailySales (estadísticas de órdenes)
├─ TotalRecords (historial de órdenes)
└─ Dashboard (resumen de órdenes)

⚠️ RIESGO: ALTO - Afecta 7+ componentes
```

### Si modificas `updateOrderStatus()`:
```
IMPACTO DIRECTO:
├─ WaiterOrder.tsx (aprobar/cancelar)
├─ KitchenDisplay.tsx (cambiar estado)
└─ CustomerMenu.tsx (aprobar desde cliente)

IMPACTO INDIRECTO:
├─ DailySales (filtra por status)
├─ TotalRecords (filtra por status)
└─ Dashboard (cuenta por status)

⚠️ RIESGO: ALTO - Afecta 6+ componentes
```

### Si modificas estructura de `MenuItem`:
```
IMPACTO DIRECTO:
├─ MenuManagement.tsx (CRUD de items)
├─ CustomerMenu.tsx (muestra items)
├─ WaiterOrder.tsx (muestra items)
├─ Inventory.tsx (gestiona stock)
└─ AppContext.tsx (addMenuItem, updateMenuItem)

IMPACTO INDIRECTO:
├─ Order (contiene OrderItem con MenuItem)
├─ Receipt (imprime items)
└─ DailySales (muestra items vendidos)

⚠️ RIESGO: CRÍTICO - Afecta 8+ componentes
```

---

## 🛡️ ESTRATEGIA DE CAMBIOS SEGUROS

### ✅ REGLAS DE ORO

1. **NUNCA modificar AppContext sin tests**
   - Crear tests unitarios primero
   - Validar que no rompe funcionalidad existente

2. **SIEMPRE validar impacto en inventario**
   - Verificar que stock se descuenta correctamente
   - Verificar que stock se restaura al cancelar

3. **PROBAR en todas las rutas de creación de órdenes**
   - CustomerMenu
   - WaiterOrder
   - Cualquier otra fuente

4. **VALIDAR flujos completos**
   - Crear orden → Inventario descontado
   - Cancelar orden → Inventario restaurado
   - Aprobar orden → Sin cambios de inventario

### 🔧 PROCESO RECOMENDADO PARA CORRECCIONES

```
PASO 1: Identificar el problema
├─ ¿Qué funcionalidad está rota?
├─ ¿Qué función de AppContext está involucrada?
└─ ¿Qué páginas usan esa función?

PASO 2: Crear tests
├─ Test del estado inicial
├─ Test del cambio propuesto
└─ Test de regresión (que no rompa lo demás)

PASO 3: Implementar cambio
├─ Modificar SOLO la función necesaria
├─ Agregar validaciones
└─ Documentar el cambio

PASO 4: Validar impacto
├─ Probar TODAS las páginas que usan la función
├─ Verificar flujos completos
└─ Revisar datos en LocalStorage

PASO 5: Deploy
├─ Commit con mensaje descriptivo
└─ Monitorear errores
```

---

## 🎯 CONCLUSIÓN

### Estado Actual
```
┌────────────────────────────────────────┐
│  ARQUITECTURA MONOLÍTICA               │
│                                        │
│  AppContext.tsx (733 líneas)           │
│  ├─ Autenticación                      │
│  ├─ CRUD Usuarios                      │
│  ├─ CRUD Restaurantes                  │
│  ├─ CRUD Sucursales                    │
│  ├─ CRUD Menú                          │
│  ├─ CRUD Órdenes ⚠️                    │
│  ├─ Gestión Inventario ⚠️              │
│  └─ Configuración                      │
│                                        │
│  ⚠️ ALTO ACOPLAMIENTO                  │
│  ⚠️ DIFÍCIL DE MANTENER                │
│  ⚠️ ALTO RIESGO DE REGRESIÓN           │
└────────────────────────────────────────┘
```

### Arquitectura Ideal (Recomendada)
```
┌────────────────────────────────────────┐
│  ARQUITECTURA MODULAR                  │
│                                        │
│  AuthContext.tsx                       │
│  ├─ login()                            │
│  ├─ logout()                           │
│  └─ currentUser                        │
│                                        │
│  RestaurantContext.tsx                 │
│  ├─ Restaurantes                       │
│  └─ Sucursales                         │
│                                        │
│  MenuContext.tsx                       │
│  ├─ Items                              │
│  └─ Categorías                         │
│                                        │
│  OrderContext.tsx                      │
│  ├─ addOrder()                         │
│  └─ updateOrderStatus()                │
│                                        │
│  InventoryContext.tsx ✨               │
│  ├─ deductStock()                      │
│  ├─ restoreStock() ✨                  │
│  └─ addStock()                         │
│                                        │
│  ✅ BAJO ACOPLAMIENTO                  │
│  ✅ FÁCIL DE MANTENER                  │
│  ✅ BAJO RIESGO DE REGRESIÓN           │
└────────────────────────────────────────┘
```

---

**Fin del Diagrama de Flujos**
