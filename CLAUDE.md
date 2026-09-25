@AGENTS.md

# Convite — contexto del proyecto

App web de gestión de bodas para el mercado español. El producto completo cubrirá
invitados, RSVP digital, mesas, regalos, música, menús y logística. **Hoy existen el
módulo de invitados y el planificador de mesas**; el modelo de datos debe soportar el
resto sin refactor.

Usuario objetivo: novios organizando su propia boda (más adelante, wedding planners con
varias). Idioma de la interfaz: **español de España**.

Historial, decisiones y pendientes al detalle: [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md).

## Decisiones cerradas — no cuestionar

| Decisión | Valor |
|---|---|
| Autenticación | **Ninguna.** Acceso por código de boda en la URL |
| Persistencia | Base de datos real (nada de `localStorage` como almacén) |
| Publicación | Cada fase se despliega a producción al terminarla |
| Asignación | Invitado → **mesa**, no → silla. Las sillas concretas son una iteración aparte |
| Tests | Sin runner de tests por decisión del usuario; se verifica en el navegador |

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn/ui · Supabase
(Postgres) · dnd-kit · Vercel.

**No añadir sin preguntar:** ORM, gestor de estado global, librería de gráficos, i18n,
tests E2E, librería de PDF, cualquier dependencia nueva.

> Next 16 tiene cambios de ruptura. Antes de escribir código de servidor, consultar
> `node_modules/next/dist/docs/`. `params` llega como `Promise`.

## Acceso — leer dos veces

No hay login. El acceso es por URL `/b/[slug]`, con un `slug` no adivinable (nombre +
8 caracteres aleatorios). Ese código funciona como credencial portadora.

- **Nunca exponer la clave `anon` de Supabase al cliente.**
- RLS activado en todas las tablas y **sin ninguna política**: todo acceso desde cliente
  queda denegado por defecto.
- Toda lectura y escritura pasa por Server Actions que usan `SUPABASE_SERVICE_ROLE_KEY`
  y **validan el `slug`** (`obtenerBodaPorSlug`) antes de tocar nada. Cada `update` y
  `delete` filtra además por `wedding_id`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca lleva prefijo `NEXT_PUBLIC_`. Se ha verificado que
  no aparece en `.next/static`.
- Un fichero `"use server"` **solo puede exportar funciones asíncronas**. Tipos y
  constantes compartidas van aparte (ver `src/lib/acciones/estado.ts`).

## Unidades y escalas — invariante crítico

- **El modelo vive en centímetros reales.** Sala, medidas de mesa, posiciones
  (`pos_x`/`pos_y` = centro de la mesa), separaciones.
- **La escala de render es solo presentación** (`vista.escala` en el planificador).
- **Ninguna validación lee valores de render**: colisión, separación, perímetro y
  capacidad operan en cm. El arrastre convierte con `delta / vista.escala` y persiste cm.
- Cualquier cambio futuro de "escala visual" no puede tocar `src/lib/mesas.ts` ni
  `src/lib/modelos.ts`.

## Mapa del código

| Qué | Dónde |
|---|---|
| Catálogo de modelos de mesa: medidas, contorno, sillas | `src/lib/modelos.ts` (`MODELOS`, `figurasDe`, `sillasDe`) |
| Geometría, colisión, sala, plantillas de sala | `src/lib/mesas.ts` |
| Reparto automático y reglas | `src/lib/autosentar.ts` |
| Importación por pegado | `src/lib/importar.ts` |
| Server Actions | `src/lib/acciones/{invitados,mesas}.ts` |
| Lecturas | `src/lib/datos/{bodas,invitados,mesas}.ts` |
| Planificador (estado, arrastre, vista) | `src/components/mesas/planificador.tsx` |
| Dibujo de mesa (SVG desde el catálogo) | `src/components/mesas/{piezas,figura}.tsx` |
| Panel, barra, inspector, reglas, selector | `src/components/mesas/*.tsx` |

**Una sola geometría:** la mesa del plano y la miniatura del selector salen de las mismas
funciones del catálogo. No duplicar geometría en componentes.

## Base de datos

Tablas: `weddings`, `guest_groups`, `guests`, `event_tables`, `seat_assignments`,
`seating_rules`. Todo cuelga de `wedding_id`.

Para una base nueva, ejecutar en orden en el SQL Editor de Supabase:
`supabase/schema.sql` → `002-presidencial.sql` → `003-reglas.sql` → `004-sala-y-modelos.sql`.
Las cuatro están aplicadas en producción. Los cambios de esquema **los ejecuta el
usuario**; no desplegar código que dependa de una migración hasta que esté aplicada.

Notas:
- `event_tables.is_head`: la presidencial. Índice único → como mucho una por boda. No se
  borra ni se duplica (también lo rechaza el servidor).
- `event_tables.is_locked`: el reparto automático no la toca.
- `event_tables.template_id`: modelo del catálogo. Sin él, `tamanoMesa` usa la fórmula
  antigua.
- `weddings.room_width/room_height` en cm, `room_preset` S/M/L/custom.
- `seat_assignments.seat_number` existe pero **no se usa**.
- `seating_rules`: parejas `juntos`/`separados`, índice único sobre el par sin orden.

**Tablas futuras — no crear, pero no romper su encaje:** `gifts`, `songs`, `menus`,
`transport`, `tasks`, `vendors`.

## Dirección de diseño

- **El plano de sala es el protagonista.** Mesas como objetos físicos, no tarjetas.
- **Nada de crema + serif de alto contraste + terracota.** Papel frío, tinta azulada.
- **Tipografía:** `Fraunces` (display, con contención) + `Inter Tight` (datos).
- **Color que codifica información:** `--novia` verde, `--novio` granate, `--ambos`
  grafito, `--confirmado`/`--pendiente`/`--rechazado`, `--canvas`/`--canvas-line`.
- **Movimiento solo en el arrastre.** `prefers-reduced-motion` respetado.
- **Copia:** verbos en activa, mayúscula solo inicial. "Sentar a Marta".

## Reglas de trabajo

- Antes de cada fase, resumir en tres líneas y esperar confirmación.
- Un commit por fase, con mensaje descriptivo. Desplegar al terminar cada fase.
- Verificar en el navegador antes de dar algo por hecho: consola limpia, sin
  desbordamiento horizontal, recarga y persistencia.
- Si una fase se alarga más del doble, parar y proponer recortar alcance.

## Riesgo de negocio

Bodas.net ofrece un organizador de mesas gratuito en España. El valor defendible tiene
que venir de integrar RSVP + mesas + logística, o del ángulo de wedding planners con
varias bodas. Validarlo antes de invertir en Stripe.
