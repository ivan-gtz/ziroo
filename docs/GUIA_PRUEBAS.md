# 🧪 GUÍA DE PRUEBAS - VERIFICACIÓN DE CORRECCIONES

**Fecha:** 11 de Diciembre, 2025  
**Versión:** Post-Correcciones v1.0

---

## 🎯 OBJETIVO

Esta guía te ayudará a verificar que las correcciones aplicadas funcionan correctamente y que no se ha roto ninguna funcionalidad existente.

---

## 📋 CHECKLIST DE PRUEBAS

### ✅ PRUEBAS CRÍTICAS (OBLIGATORIAS)

- [ ] **Test 1:** Cancelar orden desde "Órdenes" restaura inventario
- [ ] **Test 2:** Cancelar orden desde "Menu Cliente" restaura inventario
- [ ] **Test 3:** Cancelar orden con variaciones restaura inventario
- [ ] **Test 4:** Cambiar a Ready NO restaura inventario
- [ ] **Test 5:** Cambiar a Delivered NO restaura inventario
- [ ] **Test 6:** Validación de stock muestra advertencia

### ✅ PRUEBAS DE REGRESIÓN (RECOMENDADAS)

- [ ] **Test 7:** Crear orden desde "Órdenes" descuenta inventario
- [ ] **Test 8:** Crear orden desde "Menu Cliente" descuenta inventario
- [ ] **Test 9:** Aprobar orden NO descuenta inventario adicional
- [ ] **Test 10:** Agregar stock manualmente funciona
- [ ] **Test 11:** Editar item de menú funciona
- [ ] **Test 12:** Login/Logout funciona

---

## 🧪 INSTRUCCIONES DETALLADAS

### Preparación

1. **Abre la aplicación** en tu navegador
2. **Abre la consola del navegador** (F12 → Console)
3. **Inicia sesión** con tus credenciales

---

## ✅ TEST 1: Cancelar Orden desde "Órdenes"

### Objetivo
Verificar que al cancelar una orden desde la página "Órdenes", el inventario se restaura correctamente.

### Pasos

1. **Ir a "Órdenes"** (WaiterOrder)
   
2. **Seleccionar un item con stock** (ej: Pollo Broaster)
   - Anotar el stock actual: `______`

3. **Agregar 2 unidades al carrito**

4. **Crear la orden**
   - Click en "Realizar Pedido"
   - Completar datos necesarios

5. **Verificar descuento de inventario**
   - Ir a "Menú" → Buscar el item
   - Stock debería ser: `stock_inicial - 2`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

6. **Volver a "Órdenes"**

7. **Cancelar la orden**
   - Buscar la orden recién creada
   - Click en "Cancelar"

8. **VERIFICAR EN CONSOLA**
   - Deberías ver: `🔄 Restaurando inventario para orden #X`
   - Deberías ver: `✅ Restaurado: Pollo Broaster +2 = [stock]`
   - ¿Aparecen los logs? [ ] Sí [ ] No

9. **Verificar restauración de inventario**
   - Ir a "Menú" → Buscar el item
   - Stock debería ser: `stock_inicial` (el original)
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Stock se descuenta al crear orden
- ✅ Logs aparecen en consola al cancelar
- ✅ Stock se restaura al cancelar orden
- ✅ Stock final = Stock inicial

### ❌ Si falla

- Revisa la consola para errores
- Verifica que estás en la sucursal correcta
- Asegúrate de que el item tiene stock definido

---

## ✅ TEST 2: Cancelar Orden desde "Menu Cliente"

### Objetivo
Verificar que al cancelar una orden creada desde el menú del cliente, el inventario se restaura.

### Pasos

1. **Obtener URL del menú del cliente**
   - Ir a "Configuración" → Copiar URL del QR
   - O usar: `#/customer/branch/[branchId]/table/1`

2. **Abrir en nueva pestaña** (simular cliente)

3. **Seleccionar un item con stock** (ej: Coca-Cola)
   - Anotar el stock actual (ir a Menú en pestaña admin): `______`

4. **Agregar 3 unidades al carrito**

5. **Realizar pedido**
   - Click en "Realizar Pedido"
   - Completar nombre del cliente

6. **Verificar descuento (en pestaña admin)**
   - Ir a "Menú" → Buscar el item
   - Stock debería ser: `stock_inicial - 3`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

7. **Ir a "Órdenes" (pestaña admin)**

8. **Buscar la orden** (debería estar en "Esperando Aprobación")

9. **Cancelar la orden**
   - Click en "Cancelar"

10. **VERIFICAR EN CONSOLA**
    - Deberías ver: `🔄 Restaurando inventario para orden #X`
    - Deberías ver: `✅ Restaurado: Coca-Cola +3 = [stock]`
    - ¿Aparecen los logs? [ ] Sí [ ] No

11. **Verificar restauración**
    - Ir a "Menú" → Buscar el item
    - Stock debería ser: `stock_inicial`
    - Stock actual: `______`
    - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Orden aparece en "Esperando Aprobación"
- ✅ Stock se descuenta al crear orden
- ✅ Logs aparecen al cancelar
- ✅ Stock se restaura completamente

---

## ✅ TEST 3: Cancelar Orden con Variaciones

### Objetivo
Verificar que las variaciones de productos también restauran su stock correctamente.

### Prerequisito
Necesitas un item con variaciones (ej: Pizza con tamaños Grande/Mediana/Pequeña)

### Pasos

1. **Ir a "Menú"**

2. **Crear/Editar un item con variaciones**
   - Nombre: "Pizza"
   - Agregar variación: "Grande" - Stock: 10
   - Agregar variación: "Mediana" - Stock: 15
   - Guardar

3. **Ir a "Órdenes"**

4. **Agregar Pizza Grande (2 unidades)**

5. **Crear la orden**

6. **Verificar descuento**
   - Ir a "Menú" → Editar Pizza
   - Stock de "Grande" debería ser: 8
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

7. **Cancelar la orden**

8. **VERIFICAR EN CONSOLA**
   - Deberías ver: `🔄 Restaurando inventario para orden #X`
   - Deberías ver: `✅ Restaurado: Pizza (Grande) +2 = 10`
   - ¿Aparecen los logs? [ ] Sí [ ] No

9. **Verificar restauración**
   - Ir a "Menú" → Editar Pizza
   - Stock de "Grande" debería ser: 10
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Stock de variación se descuenta
- ✅ Logs muestran nombre de variación
- ✅ Stock de variación se restaura

---

## ✅ TEST 4: Cambiar a Ready NO Restaura

### Objetivo
Verificar que cambiar el estado a "Ready" NO restaura el inventario (comportamiento correcto).

### Pasos

1. **Crear una orden** (cualquier item con stock)
   - Stock inicial: `______`
   - Cantidad en orden: `______`

2. **Verificar descuento**
   - Stock después de crear: `______`

3. **Cambiar estado a "Preparing"** (si no está ya)

4. **Cambiar estado a "Ready"**

5. **VERIFICAR EN CONSOLA**
   - NO deberías ver logs de restauración
   - ¿Correcto? [ ] Sí [ ] No

6. **Verificar inventario**
   - Stock debería seguir siendo: `stock_inicial - cantidad`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ NO hay logs de restauración
- ✅ Stock permanece descontado
- ✅ Orden cambia a "Ready"

---

## ✅ TEST 5: Cambiar a Delivered NO Restaura

### Objetivo
Verificar que cambiar el estado a "Delivered" NO restaura el inventario.

### Pasos

1. **Crear una orden** (cualquier item con stock)
   - Stock inicial: `______`
   - Cantidad en orden: `______`

2. **Cambiar estado a "Ready"**

3. **Cambiar estado a "Delivered"**

4. **VERIFICAR EN CONSOLA**
   - NO deberías ver logs de restauración
   - ¿Correcto? [ ] Sí [ ] No

5. **Verificar inventario**
   - Stock debería seguir siendo: `stock_inicial - cantidad`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ NO hay logs de restauración
- ✅ Stock permanece descontado
- ✅ Orden cambia a "Delivered"
- ✅ Se calcula tiempo de completación

---

## ✅ TEST 6: Validación de Stock Insuficiente

### Objetivo
Verificar que se muestra advertencia cuando se intenta crear orden sin stock suficiente.

### Pasos

1. **Ir a "Menú"**

2. **Editar un item** (ej: Flan)
   - Establecer stock: 2
   - Guardar

3. **Ir a "Órdenes"**

4. **Agregar 5 unidades de Flan** (más de lo disponible)

5. **Crear la orden**

6. **VERIFICAR EN CONSOLA**
   - Deberías ver: `⚠️ Advertencia: Stock insuficiente para algunos items:`
   - Deberías ver: `["Flan: stock 2, necesario 5"]`
   - ¿Aparecen las advertencias? [ ] Sí [ ] No

7. **Verificar que la orden se creó**
   - La orden debería existir (no se bloquea)
   - ¿Se creó? [ ] Sí [ ] No

8. **Verificar stock**
   - Stock debería ser: 0 (Math.max(0, 2-5))
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Advertencia aparece en consola
- ✅ Orden se crea de todas formas
- ✅ Stock no se vuelve negativo (mínimo 0)

---

## ✅ TEST 7: Crear Orden Descuenta Inventario

### Objetivo
Verificar que la funcionalidad básica de descuento sigue funcionando.

### Pasos

1. **Seleccionar item con stock** (ej: Pollo Broaster)
   - Stock inicial: `______`

2. **Crear orden de 3 unidades**

3. **Verificar descuento**
   - Stock debería ser: `stock_inicial - 3`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Stock se descuenta correctamente
- ✅ Orden se crea exitosamente

---

## ✅ TEST 8: Aprobar Orden NO Descuenta Adicional

### Objetivo
Verificar que aprobar una orden en "Esperando Aprobación" NO descuenta inventario adicional.

### Pasos

1. **Crear orden desde "Menu Cliente"**
   - Stock inicial: `______`
   - Cantidad: 2

2. **Verificar descuento inicial**
   - Stock después de crear: `stock_inicial - 2`
   - Stock actual: `______`

3. **Ir a "Órdenes"**

4. **Aprobar la orden** (cambiar de "Esperando Aprobación" a "Pendiente")

5. **Verificar inventario**
   - Stock debería seguir siendo: `stock_inicial - 2`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Stock NO se descuenta al aprobar
- ✅ Stock permanece igual que después de crear
- ✅ No hay doble descuento

---

## ✅ TEST 9: Agregar Stock Manualmente

### Objetivo
Verificar que la funcionalidad de inventario manual sigue funcionando.

### Pasos

1. **Ir a "Inventario"**

2. **Seleccionar un item**
   - Stock actual: `______`

3. **Agregar 10 unidades**

4. **Verificar incremento**
   - Stock debería ser: `stock_inicial + 10`
   - Stock actual: `______`
   - ¿Es correcto? [ ] Sí [ ] No

5. **Verificar transacción**
   - Debería aparecer en historial de transacciones
   - ¿Aparece? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Stock se incrementa correctamente
- ✅ Transacción se registra
- ✅ Usuario y fecha se guardan

---

## ✅ TEST 10: Editar Item de Menú

### Objetivo
Verificar que editar items del menú sigue funcionando.

### Pasos

1. **Ir a "Menú"**

2. **Editar un item existente**
   - Cambiar nombre
   - Cambiar precio
   - Cambiar stock

3. **Guardar cambios**

4. **Verificar que se guardó**
   - Recargar página
   - Verificar que los cambios persisten
   - ¿Persisten? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Cambios se guardan correctamente
- ✅ Stock se actualiza
- ✅ No hay errores

---

## ✅ TEST 11: Login/Logout

### Objetivo
Verificar que la autenticación sigue funcionando.

### Pasos

1. **Cerrar sesión**

2. **Iniciar sesión nuevamente**
   - Email: `______`
   - Password: `______`

3. **Verificar acceso**
   - ¿Puedes acceder? [ ] Sí [ ] No

### ✅ Resultado Esperado

- ✅ Login funciona
- ✅ Logout funciona
- ✅ Redirección correcta

---

## 📊 RESUMEN DE RESULTADOS

### Tests Críticos

| Test | Descripción | Resultado |
|------|-------------|-----------|
| 1 | Cancelar desde Órdenes | [ ] ✅ [ ] ❌ |
| 2 | Cancelar desde Menu Cliente | [ ] ✅ [ ] ❌ |
| 3 | Cancelar con variaciones | [ ] ✅ [ ] ❌ |
| 4 | Ready NO restaura | [ ] ✅ [ ] ❌ |
| 5 | Delivered NO restaura | [ ] ✅ [ ] ❌ |
| 6 | Validación de stock | [ ] ✅ [ ] ❌ |

### Tests de Regresión

| Test | Descripción | Resultado |
|------|-------------|-----------|
| 7 | Crear orden descuenta | [ ] ✅ [ ] ❌ |
| 8 | Aprobar NO descuenta | [ ] ✅ [ ] ❌ |
| 9 | Agregar stock manual | [ ] ✅ [ ] ❌ |
| 10 | Editar item | [ ] ✅ [ ] ❌ |
| 11 | Login/Logout | [ ] ✅ [ ] ❌ |

---

## 🎯 CRITERIOS DE ACEPTACIÓN

Para considerar las correcciones como exitosas:

### ✅ MÍNIMO REQUERIDO (Tests Críticos)

- [ ] **100% de tests críticos pasados** (Tests 1-6)
- [ ] **Logs aparecen en consola** al cancelar órdenes
- [ ] **Stock se restaura correctamente** en todos los casos
- [ ] **No hay errores** en la consola

### ✅ IDEAL (Todos los Tests)

- [ ] **100% de todos los tests pasados** (Tests 1-11)
- [ ] **Sin regresiones** en funcionalidades existentes
- [ ] **Comportamiento consistente** en todas las páginas

---

## 🐛 QUÉ HACER SI FALLA UN TEST

### Si Test 1-3 fallan (Cancelación no restaura)

1. **Verificar consola** - ¿Hay errores?
2. **Verificar logs** - ¿Aparecen los mensajes de restauración?
3. **Verificar sucursal** - ¿Estás en la sucursal correcta?
4. **Revisar código** - Verificar que los cambios se aplicaron

### Si Test 4-5 fallan (Ready/Delivered restauran)

1. **Verificar consola** - NO deberían aparecer logs de restauración
2. **Verificar código** - La condición debe ser `status === OrderStatus.Cancelled`

### Si Test 6 falla (No hay advertencia)

1. **Verificar consola** - ¿Está abierta?
2. **Verificar stock** - ¿El item tiene stock definido?
3. **Verificar cantidad** - ¿Es mayor que el stock?

### Si Tests 7-11 fallan (Regresiones)

1. **Revisar cambios** - ¿Se modificó algo más?
2. **Verificar LocalStorage** - ¿Hay datos corruptos?
3. **Limpiar caché** - Recargar con Ctrl+F5
4. **Revisar código** - Buscar errores de sintaxis

---

## 📝 NOTAS IMPORTANTES

### Logs en Consola

Los logs son tu mejor amigo para debugging:

```
✅ LOGS ESPERADOS AL CANCELAR:
🔄 Restaurando inventario para orden #1 (2 items)
  ✅ Restaurado: Pollo Broaster +2 = 20
  ✅ Restaurado: Coca-Cola +1 = 50

⚠️ LOGS ESPERADOS AL CREAR CON STOCK BAJO:
⚠️ Advertencia: Stock insuficiente para algunos items:
["Flan: stock 2, necesario 5"]
```

### LocalStorage

Si necesitas resetear datos:

1. Abrir consola (F12)
2. Ejecutar: `localStorage.clear()`
3. Recargar página
4. Iniciar sesión nuevamente

### Sucursales

Asegúrate de estar en la sucursal correcta:
- Cada sucursal tiene su propio inventario
- Verifica el selector de sucursal en el header

---

## ✅ CONCLUSIÓN

Si **TODOS los tests críticos (1-6) pasan**, las correcciones están funcionando correctamente y la aplicación está lista para usar.

Si **algún test falla**, revisa la sección "Qué hacer si falla un test" y contacta soporte si es necesario.

---

**¡Buena suerte con las pruebas!** 🚀
