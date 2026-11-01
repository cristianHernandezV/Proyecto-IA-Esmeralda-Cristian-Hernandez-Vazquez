# Río Claro — instrucciones del repositorio

Este repositorio construye un prototipo web para **Distribuidora Río Claro** (productos de limpieza e higiene: 22 años, 140 empleados, 5 sucursales). Vende a hoteles, restaurantes, escuelas y tiendas. Compra a ~60 proveedores y atiende ~1800 clientes activos. **No hay área de TI**; una sola persona administra correos y red.

## Problema de negocio

- Se perdieron 2 clientes hoteleros porque nadie contestaba a tiempo.
- Cuentas por pagar duplicó el pago de una misma factura.
- Laura (contabilidad) gasta ~12 horas capturando facturas a mano en Excel.

## Objetivos

1. Dejar de capturar facturas a mano.
2. Un asistente (agente de **Microsoft Foundry**) que responda a tiempo a clientes y empleados.

## Alcance principal (construir primero)

Antes de facturas, pedidos o reportes, el prototipo es esta cáscara:

1. **Login** con dos acciones: entrar y **registrar usuario**.
2. Al registrar, se **asigna un rol**. Todo queda en `localStorage` (`rioclaro.usuarios`, sesión en `rioclaro.sesion`). Sin base de datos.
3. Tras entrar, **una sola interfaz principal**: el chat para hablar con el usuario, y **el módulo que corresponde a su rol**.
4. Quien no tenga sesión no ve el chat ni los módulos.

El super usuario entra al módulo de usuarios (puede registrar y asignar rol) y también puede abrir el resto. Los demás roles ven el chat y solo su módulo. Facturas, pedidos, ventas y quejas son el contenido de esos módulos, en un segundo paso.

## Stack obligatorio

- Node.js (CommonJS, `package.json` ya lo declara).
- Express.js 5.
- Frontend estático servido por Express (HTML/CSS/JS).
- Persistencia **solo en `localStorage`** (sin base de datos).
- Excel/CSV como fuentes de verdad que el agente de Foundry puede leer.
- Integración con Microsoft Foundry (`@azure/ai-projects`, `@azure/identity`).

## Roles de la aplicación

Login y módulo de usuarios. Roles:

| Rol | Acceso |
|-----|--------|
| Super usuario | Todo |
| Contador | Facturas, Excel de proveedores, rechazo de documentos |
| Cliente | Estado de pedido, quejas, chat con el asistente |
| Empleado | Pedidos, chat interno, consulta de estado |
| Supervisor | Reportes de ventas, quejas, supervisión |

## Módulos previstos

Orden de construcción:

1. **Login, registro y sesión** en `localStorage`. Registrar usuario incluye elegir rol.
2. **Interfaz principal**: chat siempre visible + módulo según el rol.
3. Contenido de cada módulo (después de la cáscara):
   - Super usuario: usuarios (y el resto).
   - Contador: facturas → Excel (`nombre del proveedor`, `fecha`, `total`). Rechazar ilegibles, duplicadas o con datos sensibles.
   - Cliente: estado de su pedido y quejas.
   - Empleado: pedidos.
   - Supervisor: reportes de ventas por producto y quejas.

## Reglas del asistente (Foundry y UI)

- Debe **identificarse como IA** en cada respuesta al usuario.
- Debe **citar de dónde viene** el documento o tabla que consultó (nombre de archivo, hoja o clave de `localStorage`).
- Si un documento viene mal, no tiene sentido, o contiene **datos sensibles**, **rechazarlo** y explicar por qué, sin almacenar el contenido sensible.
- Nunca inventar saldos, fechas de entrega ni totales: si no está en el Excel/localStorage, decirlo.

## Documentación (obligatorio en cada cambio)

Si el prompt implica crear, modificar o borrar código, **actualizar `README.md` en el mismo turno**. Explicar qué hace el cambio y cómo funciona, con imágenes en `docs/imagenes/` cuando haya UI. Seguir `.github/skills/documentar-readme/SKILL.md` (o `.cursor/skills/documentar-readme/SKILL.md`).

## Cómo usar el harness

1. **Arquitecto** (`.github/agents/arquitecto.agent.md`): diseña, no implementa.
2. **Constructor** (`.github/agents/constructor.agent.md`): implementa y documenta.
3. **Desplegador** (`.github/agents/desplegador.agent.md`): publica en Azure / Foundry.

No mezclar roles: un plan del arquitecto se implementa con el constructor; el despliegue no rediseña el producto.

## Instrucciones por capa

- Backend: `.github/instructions/backend.instructions.md`
- Frontend: `.github/instructions/frontend.instructions.md`
- Documentación: `.github/instructions/documentacion.instructions.md`
