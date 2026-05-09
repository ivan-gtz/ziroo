# 🛡️ GUÍA DE SEGURIDAD PARA MODIFICACIONES - ZIROO

## 🎯 OBJETIVO

Esta guía proporciona reglas y procedimientos para realizar cambios en la aplicación **sin romper funcionalidades existentes**.

---

## 🚨 ZONAS DE ALTO RIESGO

### 🔴 CRÍTICO - NO MODIFICAR SIN EXTREMA PRECAUCIÓN

#### 1. AppContext.tsx
**Ubicación:** `context/AppContext.tsx`  
**Líneas:** 733  
**Riesgo:** ⚠️⚠️⚠️ CRÍTICO

**Funciones de ALTO RIESGO:**
```typescript
// ⚠️ CRÍTICO: Afecta creación de órdenes e inventario
addOrder(orderData, targetBranchId?)

// ⚠️ CRÍTICO: Afecta estados de órdenes (necesita restaurar inventario)
updateOrderStatus(id, status, branchId?)

// ⚠️ ALTO: Afecta inventario
addInventoryStock(itemId, variationId, quantity)

// ⚠️ ALTO: Afecta autenticación
login(email, password)

// ⚠️ MEDIO: Afecta aislamiento de datos
setActiveBranchId(id)
```

**REGLAS:**
- ✅ Crear backup del archivo antes de modificar
- ✅ Escribir tests para la función a modificar
- ✅ Probar en TODAS las páginas que usan la función
- ✅ Validar que no afecta otras funciones del mismo archivo
- ❌ NUNCA modificar múltiples funciones a la vez
- ❌ NUNCA cambiar la firma de funciones sin actualizar TODOS los usos

#### 2. types.ts
**Ubicación:** `types.ts`  
**Líneas:** 200  
**Riesgo:** ⚠️⚠️⚠️ CRÍTICO

**Interfaces de ALTO RIESGO:**
```typescript
// ⚠️ CRÍTICO: Usada en 10+ archivos
interface MenuItem

// ⚠️ CRÍTICO: Usada en 8+ archivos
interface Order

// ⚠️ ALTO: Usada en autenticación
interface User

// ⚠️ ALTO: Usada en multi-tenant
interface ManagedRestaurant
```

**REGLAS:**
- ✅ Agregar campos opcionales (field?: type)
- ✅ Mantener retrocompatibilidad
- ❌ NUNCA eliminar campos existentes
- ❌ NUNCA cambiar tipos de campos existentes
- ❌ NUNCA renombrar campos sin migración

#### 3. useLocalStorage.ts
**Ubicación:** `hooks/useLocalStorage.ts`  
**Líneas:** 88  
**Riesgo:** ⚠️⚠️ ALTO

**REGLAS:**
- ✅ Mantener lógica de merge de objetos
- ✅ Mantener validación de tipos
- ❌ NUNCA cambiar el formato de serialización
- ❌ NUNCA eliminar la lógica de migración

---

## 🟡 ZONAS DE RIESGO MEDIO

### Páginas que Modifican Estado

#### WaiterOrder.tsx
**Riesgo:** ⚠️⚠️ MEDIO-ALTO

**Funciones críticas:**
```typescript
handlePlaceOrder()          // Crea órdenes
handleApproveOrder()        // Aprueba órdenes
updateOrderStatus()         // Cancela órdenes
```

**REGLAS:**
- ✅ Validar que no se rompa el flujo de inventario
- ✅ Probar con órdenes con y sin variaciones
- ✅ Probar cancelación de órdenes

#### CustomerMenu.tsx
**Riesgo:** ⚠️⚠️ MEDIO-ALTO

**Funciones críticas:**
```typescript
handlePlaceOrder()          // Crea órdenes desde cliente
handleAddToCart()           // Gestiona carrito
```

**REGLAS:**
- ✅ Validar que funciona con items con variaciones
- ✅ Probar flujo completo de cliente
- ✅ Verificar que se descuenta inventario correctamente

#### MenuManagement.tsx
**Riesgo:** ⚠️ MEDIO

**Funciones críticas:**
```typescript
handleSaveItem()            // Crea/actualiza items
handleDeleteItem()          // Elimina items
```

**REGLAS:**
- ✅ Validar que no rompe órdenes existentes
- ✅ Verificar que las imágenes se guardan correctamente

#### Inventory.tsx
**Riesgo:** ⚠️ MEDIO

**Funciones críticas:**
```typescript
handleAddStock()            // Agrega inventario
```

**REGLAS:**
- ✅ Validar que actualiza el stock correctamente
- ✅ Verificar que crea transacciones de auditoría

---

## 🟢 ZONAS DE BAJO RIESGO

### Componentes de Solo Lectura

- Dashboard.tsx (solo muestra datos)
- DailySales.tsx (solo muestra datos)
- TotalRecords.tsx (solo muestra datos)
- Analytics.tsx (solo muestra datos)
- KitchenDisplay.tsx (solo cambia status, no crea órdenes)

**REGLAS:**
- ✅ Modificaciones visuales son seguras
- ✅ Cambios en filtros son seguros
- ⚠️ Cuidado al cambiar cómo se consumen datos del contexto

### Componentes UI

- Button.tsx
- Card.tsx
- Modal.tsx

**REGLAS:**
- ✅ Modificaciones son seguras
- ✅ Mantener props existentes para retrocompatibilidad

---

## 📋 CHECKLIST ANTES DE MODIFICAR

### ✅ Checklist General

```
[ ] He identificado QUÉ archivo voy a modificar
[ ] He revisado el nivel de riesgo del archivo
[ ] He creado un backup del archivo original
[ ] He identificado TODAS las páginas que usan esta función
[ ] He escrito tests para validar el cambio
[ ] He documentado el cambio en comentarios
```

### ✅ Checklist para Modificar AppContext.tsx

```
[ ] He identificado la función específica a modificar
[ ] He buscado TODOS los usos de esta función en el proyecto
[ ] He entendido el flujo completo de datos
[ ] He validado que no afecta otras funciones del contexto
[ ] He probado en TODAS las páginas que usan la función
[ ] He verificado que los datos en LocalStorage son correctos
[ ] He probado el flujo completo (crear → modificar → eliminar)
```

### ✅ Checklist para Modificar Inventario

```
[ ] He validado que el stock se descuenta al crear orden
[ ] He validado que el stock se restaura al cancelar orden
[ ] He probado con items SIN variaciones
[ ] He probado con items CON variaciones
[ ] He probado desde "Menu Cliente"
[ ] He probado desde "Órdenes"
[ ] He verificado que las transacciones se registran
[ ] He verificado que no hay stock negativo
```

### ✅ Checklist para Modificar Types

```
[ ] He agregado campos como OPCIONALES (field?: type)
[ ] NO he eliminado campos existentes
[ ] NO he cambiado tipos de campos existentes
[ ] He actualizado TODOS los archivos que usan el tipo
[ ] He verificado que no rompe la serialización en LocalStorage
```

---

## 🔧 PROCEDIMIENTOS DE SEGURIDAD

### Procedimiento 1: Modificar Función en AppContext

```
PASO 1: ANÁLISIS
├─ Identificar la función a modificar
├─ Buscar todos los usos: grep -r "nombreFuncion" src/
├─ Listar páginas afectadas
└─ Entender el flujo de datos

PASO 2: BACKUP
├─ Copiar AppContext.tsx a AppContext.backup.tsx
└─ Commit en git antes de cambios

PASO 3: IMPLEMENTACIÓN
├─ Modificar SOLO la función necesaria
├─ Agregar comentarios explicativos
├─ Mantener la firma de la función (parámetros y retorno)
└─ Agregar validaciones

PASO 4: TESTING MANUAL
├─ Probar en CADA página que usa la función
├─ Probar casos normales
├─ Probar casos extremos (valores vacíos, nulos, etc.)
└─ Verificar LocalStorage

PASO 5: VALIDACIÓN
├─ Verificar que no hay errores en consola
├─ Verificar que los datos se guardan correctamente
├─ Verificar que no se rompió otra funcionalidad
└─ Probar flujo completo de usuario

PASO 6: DEPLOY
├─ Commit con mensaje descriptivo
├─ Documentar el cambio
└─ Monitorear errores
```

### Procedimiento 2: Agregar Nueva Funcionalidad

```
PASO 1: DISEÑO
├─ ¿Necesito modificar AppContext?
├─ ¿Puedo crear un nuevo contexto?
├─ ¿Puedo usar un hook personalizado?
└─ ¿Afecta datos existentes?

PASO 2: IMPLEMENTACIÓN AISLADA
├─ Crear nueva función SIN modificar existentes
├─ Usar nombres descriptivos
├─ Agregar validaciones
└─ Documentar con comentarios

PASO 3: INTEGRACIÓN
├─ Agregar función al contexto
├─ Exportar en la interfaz
├─ Actualizar el value del Provider
└─ Usar en la página necesaria

PASO 4: TESTING
├─ Probar la nueva funcionalidad
├─ Verificar que NO afecta funcionalidades existentes
└─ Validar datos en LocalStorage
```

### Procedimiento 3: Corregir Bug de Inventario

```
PASO 1: REPRODUCIR EL BUG
├─ Crear orden desde "Menu Cliente"
├─ Verificar que se descuenta inventario
├─ Cancelar la orden
├─ Verificar que NO se restaura inventario ❌
└─ Documentar el comportamiento actual

PASO 2: IDENTIFICAR LA CAUSA
├─ Función: updateOrderStatus() en AppContext.tsx
├─ Líneas: 455-484
├─ Problema: No hay lógica de restauración
└─ Impacto: Todas las cancelaciones

PASO 3: DISEÑAR LA SOLUCIÓN
├─ Detectar cambio a status = Cancelled
├─ Obtener items de la orden
├─ Restaurar stock de cada item
├─ Considerar variaciones
└─ Actualizar allMenuItems

PASO 4: IMPLEMENTAR
├─ Modificar updateOrderStatus()
├─ Agregar lógica de restauración
├─ Mantener lógica existente para otros status
└─ Agregar comentarios

PASO 5: TESTING EXHAUSTIVO
├─ Crear orden desde "Menu Cliente" → Cancelar → Verificar stock ✅
├─ Crear orden desde "Órdenes" → Cancelar → Verificar stock ✅
├─ Orden con variaciones → Cancelar → Verificar stock ✅
├─ Orden sin variaciones → Cancelar → Verificar stock ✅
├─ Cambiar a Ready → Verificar que NO restaura stock ✅
├─ Cambiar a Delivered → Verificar que NO restaura stock ✅
└─ Verificar que no se rompió otra funcionalidad ✅
```

---

## 🎯 PATRONES DE CÓDIGO SEGURO

### ✅ PATRÓN SEGURO: Agregar Campo Opcional

```typescript
// ❌ MAL: Cambiar tipo existente
interface MenuItem {
    stock: number;  // Era opcional, ahora obligatorio
}

// ✅ BIEN: Mantener opcional o agregar nuevo campo
interface MenuItem {
    stock?: number;  // Mantener opcional
    stockV2?: number;  // O agregar nuevo campo
}
```

### ✅ PATRÓN SEGURO: Modificar Función

```typescript
// ❌ MAL: Cambiar firma de función
const addOrder = (orderData: Order) => { ... }
// Rompe todos los usos existentes

// ✅ BIEN: Agregar parámetro opcional
const addOrder = (orderData: Order, targetBranchId?: string) => { ... }
// Mantiene compatibilidad con usos existentes
```

### ✅ PATRÓN SEGURO: Validar Datos

```typescript
// ❌ MAL: Asumir que los datos existen
const stock = menuItem.stock - quantity;

// ✅ BIEN: Validar y usar valores por defecto
const currentStock = menuItem.stock ?? 0;
const newStock = Math.max(0, currentStock - quantity);
```

### ✅ PATRÓN SEGURO: Actualizar Estado

```typescript
// ❌ MAL: Mutar estado directamente
menuItem.stock -= quantity;

// ✅ BIEN: Crear copia y actualizar
const newMenuItems = JSON.parse(JSON.stringify(currentMenuItems));
newMenuItems[index].stock = Math.max(0, newMenuItems[index].stock - quantity);
```

---

## 🚨 SEÑALES DE ALERTA

### ⚠️ Si ves esto, DETENTE y revisa:

```typescript
// ⚠️ ALERTA: Modificar múltiples funciones a la vez
const addOrder = () => { ... }
const updateOrderStatus = () => { ... }
const deleteOrder = () => { ... }

// ⚠️ ALERTA: Cambiar tipos de campos existentes
interface MenuItem {
    stock: string;  // Era number
}

// ⚠️ ALERTA: Eliminar campos
interface Order {
    // id: string;  // Comentado o eliminado
}

// ⚠️ ALERTA: Mutar estado directamente
appState.orders.push(newOrder);

// ⚠️ ALERTA: No validar datos
const stock = menuItem.stock - quantity;  // ¿Y si stock es undefined?
```

---

## 📊 MATRIZ DE IMPACTO

### Modificar addOrder()

| Componente | Impacto | Qué Probar |
|------------|---------|------------|
| CustomerMenu | ALTO | Crear orden desde cliente |
| WaiterOrder | ALTO | Crear orden desde mesero |
| KitchenDisplay | MEDIO | Verificar que aparece la orden |
| DailySales | MEDIO | Verificar estadísticas |
| Inventory | ALTO | Verificar descuento de stock |

### Modificar updateOrderStatus()

| Componente | Impacto | Qué Probar |
|------------|---------|------------|
| WaiterOrder | ALTO | Cancelar orden |
| KitchenDisplay | ALTO | Cambiar estado de orden |
| DailySales | MEDIO | Verificar filtros por estado |
| Inventory | ALTO | Verificar restauración de stock |

### Modificar MenuItem interface

| Componente | Impacto | Qué Probar |
|------------|---------|------------|
| MenuManagement | CRÍTICO | CRUD de items |
| CustomerMenu | CRÍTICO | Mostrar items |
| WaiterOrder | CRÍTICO | Agregar items a orden |
| Inventory | CRÍTICO | Gestionar stock |
| Order | CRÍTICO | Items en órdenes |

---

## 🎓 EJEMPLOS DE CAMBIOS SEGUROS

### Ejemplo 1: Agregar Validación de Stock

```typescript
// ANTES (inseguro)
const addOrder = (orderData, targetBranchId?) => {
    // ... código existente ...
    menuItem.stock -= quantity;
};

// DESPUÉS (seguro)
const addOrder = (orderData, targetBranchId?) => {
    // ... código existente ...
    
    // ✅ Validar que hay stock suficiente
    const currentStock = menuItem.stock ?? 0;
    if (currentStock < quantity) {
        throw new Error(`Stock insuficiente para ${menuItem.name}`);
    }
    
    menuItem.stock = Math.max(0, currentStock - quantity);
};
```

### Ejemplo 2: Restaurar Inventario al Cancelar

```typescript
// ANTES (incompleto)
const updateOrderStatus = (id, status, branchId?) => {
    // ... código existente ...
    const updates: Partial<Order> = { status };
    return { ...order, ...updates };
};

// DESPUÉS (completo)
const updateOrderStatus = (id, status, branchId?) => {
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
                                    const currentStock = menuItem.variations[varIndex].stock ?? 0;
                                    menuItem.variations[varIndex].stock = currentStock + orderItem.quantity;
                                }
                            } else if (menuItem.stock !== undefined) {
                                const currentStock = menuItem.stock ?? 0;
                                menuItem.stock = currentStock + orderItem.quantity;
                            }
                        }
                    });
                }
                
                // ... resto de la lógica ...
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

---

## 🎯 RESUMEN DE REGLAS DE ORO

1. **NUNCA** modificar AppContext.tsx sin backup
2. **NUNCA** cambiar tipos existentes en types.ts
3. **SIEMPRE** agregar campos como opcionales
4. **SIEMPRE** validar datos antes de usar
5. **SIEMPRE** crear copias del estado (no mutar)
6. **SIEMPRE** probar en TODAS las páginas afectadas
7. **SIEMPRE** verificar LocalStorage después de cambios
8. **NUNCA** modificar múltiples funciones a la vez
9. **SIEMPRE** mantener retrocompatibilidad
10. **SIEMPRE** documentar cambios con comentarios

---

## 📞 CUANDO TENGAS DUDAS

### Pregúntate:

1. ¿Este cambio puede romper funcionalidad existente?
2. ¿He probado en TODAS las páginas que usan esto?
3. ¿He validado los datos en LocalStorage?
4. ¿He mantenido retrocompatibilidad?
5. ¿He documentado el cambio?

### Si la respuesta a cualquiera es NO:

⚠️ **DETENTE Y REVISA ANTES DE CONTINUAR**

---

**Fin de la Guía de Seguridad**
