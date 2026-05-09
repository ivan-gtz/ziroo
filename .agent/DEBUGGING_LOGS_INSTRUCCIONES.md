# 🔍 DEBUGGING ACTIVADO - LOGS COMPLETOS

**Fecha:** 11 de Diciembre, 2025  
**Hora:** 11:52 AM  
**Estado:** ✅ LOGS DE DEBUGGING AGREGADOS

---

## ✅ LOGS AGREGADOS

He agregado logs detallados en 3 lugares críticos para identificar el problema:

### 1. RestaurantContext.tsx ✅
**Logs agregados en `currentRestaurant`:**
```typescript
console.log('🔍 Buscando currentRestaurant...');
console.log('  - activeBranch:', activeBranch);
console.log('  - currentUser:', currentUser);
console.log('  - managedRestaurants:', restaurantState.managedRestaurants);
console.log('  ✅ Encontrado por activeBranch.restaurantId:', found);
console.log('  ⚠️ No se encontró currentRestaurant');
```

### 2. Sidebar.tsx ✅
**Logs agregados para permisos:**
```typescript
console.log('🎨 Sidebar - currentRestaurant:', currentRestaurant);
console.log('🎨 Sidebar - currentUser:', currentUser);
console.log('🎨 Sidebar - Permisos:');
console.log('  - canManageUsers:', canManageUsers);
console.log('  - canManageBranches:', canManageBranches);
console.log('  - canViewCustomerMenu:', canViewCustomerMenu);
console.log('  - isBasicRestaurant:', isBasicRestaurant);
```

### 3. BranchSwitcher.tsx ✅ (Ya estaba)
**Logs para sucursales:**
```typescript
console.log('✅ Sucursales visibles:', visibleBranches.length, visibleBranches.map(b => b.name));
console.warn('⚠️ No hay sucursales visibles para el usuario:', currentUser);
```

---

## 🌐 SERVIDOR CORRIENDO

**URL:** http://localhost:3001  
**Estado:** ✅ Activo

---

## 🧪 INSTRUCCIONES DE PRUEBA

### Paso 1: Abrir Aplicación
1. Abrir navegador
2. Ir a: **http://localhost:3001**
3. Abrir DevTools (F12)
4. Ir a pestaña **"Console"**

### Paso 2: Login como SuperAdmin
1. Email: `super@ziroo.app`
2. Password: `superadmin`
3. Click "Entrar"

### Paso 3: Verificar Logs en Consola
**Buscar estos mensajes:**

#### A) Logs de Sucursales:
```
✅ Sucursales visibles: 1 ['Ziroo (Default)']
```
- Si ves esto: Las sucursales se están cargando correctamente
- Si ves "0": Hay un problema con las sucursales

#### B) Logs de currentRestaurant:
```
🔍 Buscando currentRestaurant...
  - activeBranch: {id: "main_branch", ...}
  - currentUser: {id: "super_admin", ...}
  - managedRestaurants: [...]
  ✅ Encontrado por activeBranch.restaurantId: {id: "...", name: "..."}
```
- Si ves "✅ Encontrado": El restaurante se está encontrando
- Si ves "⚠️ No se encontró": Hay un problema

#### C) Logs de Sidebar:
```
🎨 Sidebar - currentRestaurant: {id: "...", name: "...", canCreateUsers: true, ...}
🎨 Sidebar - currentUser: {id: "...", role: "SuperAdmin"}
🎨 Sidebar - Permisos:
  - canManageUsers: true
  - canManageBranches: true
  - canViewCustomerMenu: true
  - isBasicRestaurant: false
```

### Paso 4: Crear Restaurante Nuevo
1. Ir a "Restaurantes"
2. Click "Crear Restaurante"
3. Llenar datos:
   - Nombre: "Test Restaurant"
   - Tipo: "Full" (o "Basic")
   - Email: test@test.com
   - Password: test123
   - **ACTIVAR TODOS LOS SWITCHES**
4. Guardar

### Paso 5: Verificar Logs al Crear
**Buscar en consola:**
```
💾 Actualizando restaurante: Test Restaurant
✅ Restaurante actualizado correctamente
💾 Guardando usuario automáticamente: {id: "...", email: "test@test.com"}
```

### Paso 6: Login con Nuevo Restaurante
1. Cerrar sesión
2. Login con:
   - Email: test@test.com
   - Password: test123

### Paso 7: Verificar Logs Después de Login
**Buscar en consola:**

#### A) ¿Se encontró el restaurante?
```
🔍 Buscando currentRestaurant...
  ✅ Encontrado por currentUser.restaurantId: {id: "...", name: "Test Restaurant", canCreateUsers: true, ...}
```

#### B) ¿Los permisos son correctos?
```
🎨 Sidebar - Permisos:
  - canManageUsers: true  ← Debe ser true si activaste el switch
  - canManageBranches: true  ← Debe ser true si activaste el switch
  - canViewCustomerMenu: true
  - isBasicRestaurant: false  ← Debe ser true si elegiste "Basic"
```

#### C) ¿Aparece el selector de sucursal?
```
✅ Sucursales visibles: 1 ['Test Restaurant (Sede Principal)']
```

---

## 📝 REPORTA LOS LOGS

**Por favor copia y pega TODOS los logs que veas en la consola y envíamelos.**

Específicamente necesito ver:
1. ✅ Logs de "🔍 Buscando currentRestaurant..."
2. ✅ Logs de "🎨 Sidebar - currentRestaurant:"
3. ✅ Logs de "🎨 Sidebar - Permisos:"
4. ✅ Logs de "✅ Sucursales visibles:"

Con esos logs podré identificar exactamente dónde está el problema.

---

## 🎯 POSIBLES PROBLEMAS QUE BUSCO

### Problema 1: currentRestaurant es undefined
**Síntoma:** Verás "⚠️ No se encontró currentRestaurant"
**Causa:** El restaurante no se está guardando correctamente o el ID no coincide

### Problema 2: Los permisos son false
**Síntoma:** Verás "canManageUsers: false" aunque activaste el switch
**Causa:** Los switches no se están guardando en LocalStorage

### Problema 3: No hay sucursales visibles
**Síntoma:** Verás "✅ Sucursales visibles: 0"
**Causa:** La sucursal principal no se está creando o no está aprobada

---

**Abre http://localhost:3001 y envíame los logs de la consola.**
