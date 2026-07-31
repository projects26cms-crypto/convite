@AGENTS.md

# Convite — contexto del proyecto

App web de gestión de bodas para el mercado español. El producto completo cubrirá
invitados, RSVP digital, mesas, regalos, música, menús y logística. **Hoy solo se
construye y publica el módulo de invitados + mesas**, pero el modelo de datos debe
soportar el resto sin refactor.

Usuario objetivo: novios organizando su propia boda (más adelante, wedding planners con
varias). Idioma de la interfaz: **español de España**.

## Decisiones cerradas — no cuestionar

| Decisión | Valor |
|---|---|
| Alcance día 1 | Invitados + planificador visual de mesas + salida imprimible |
| Autenticación | **Ninguna.** Acceso por código de boda en la URL |
| Persistencia | Base de datos real desde el minuto uno (nada de `localStorage` como almacén) |
| Publicación | Producción en Vercel antes de escribir la primera función |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres) ·
dnd-kit · Vercel · impresión con `@media print` + `window.print()`.

**No añadir:** ORM adicional (usar el cliente de Supabase), gestor de estado global,
librería de gráficos, i18n, tests E2E, librería de PDF.

> Next 16 tiene cambios de ruptura respecto a versiones anteriores. Antes de escribir
> código de servidor, consultar `node_modules/next/dist/docs/`.

## Arquitectura de acceso — leer dos veces

No hay login. El acceso es por URL `/b/[slug]`, con un `slug` no adivinable
(ej. `ines-santi-9f3k2p`, mínimo 8 caracteres aleatorios además del nombre). Ese código
funciona como credencial portadora.

- **Nunca exponer la clave `anon` de Supabase al cliente** para leer ni escribir.
- RLS activado en todas las tablas y **sin ninguna política**: todo acceso desde cliente
  queda denegado por defecto.
- Todas las lecturas y escrituras pasan por Server Actions / Route Handlers que usan
  `SUPABASE_SERVICE_ROLE_KEY` en servidor y **validan el `slug`** antes de tocar nada.
- `SUPABASE_SERVICE_ROLE_KEY` nunca lleva prefijo `NEXT_PUBLIC_`.

## Esquema de base de datos

Tablas de hoy: `weddings`, `guest_groups`, `guests`, `event_tables`, `seat_assignments`.
El SQL vive en [`supabase/schema.sql`](supabase/schema.sql).

Notas de diseño:
- `weddings.owner_id` queda a `null` hoy: es el punto de anclaje para la auth futura.
- `seat_assignments` tiene `unique (guest_id)`: un invitado ocupa como mucho un asiento.
- `guests` es la columna vertebral: de ella colgarán RSVP, menús y regalos.

**Tablas futuras — no crear hoy, pero no romper su encaje:** `gifts`, `songs`, `menus`,
`transport`, `tasks`, `vendors`. Todas cuelgan de `wedding_id` y varias de `guest_id`.

## Fases

1. **Esqueleto en producción** — Next + repo + Vercel, landing mínima. *Criterio:* URL pública que carga.
2. **Base de datos** — Supabase, SQL, variables de entorno, lectura por `slug`. *Criterio:* `/b/[slug]` renderiza el nombre de una boda.
3. **Invitados** — CRUD de invitados y grupos, importación masiva por pegado, contadores. *Criterio:* se pegan 120 nombres y persisten.
4. **Planificador de mesas** — el núcleo. Panel de no asignados, lienzo con mesas arrastrables, ocupación, resaltado de grupo, autoguardado. *Criterio:* 100 invitados en 12 mesas sobreviven a una recarga.
5. **Salida imprimible** — `/b/[slug]/plano` en A4 horizontal: plano de sala, listado alfabético invitado → mesa, listado por mesa.
6. **Cierre** — landing con creación de boda, estados vacíos, favicon, metadatos, móvil.

Prioridad si falta tiempo: fases 1–4. Luego la 5. La 6 puede caer.

## Dirección de diseño

Evitar el look genérico de SaaS. **Nada de fondo crema + serif de alto contraste +
acento terracota**: es el aspecto por defecto que genera cualquier IA y se nota.

- **El plano de sala es el protagonista.** Todo lo demás es cromo. Que las mesas se lean
  como objetos físicos, no como tarjetas de un panel de administración.
- **Tipografía:** `Fraunces` (display, con contención, en títulos y nombres de mesa) +
  `Inter Tight` (sans estrecha, para densidad de datos en listas).
- **Color:** paleta corta que **codifica información**, no decora. Tokens en
  `src/app/globals.css`: `--novia` (verde), `--novio` (granate), `--ambos` (grafito),
  `--confirmado` / `--pendiente` / `--rechazado`, `--canvas` / `--canvas-line` para el
  lienzo del plano. Papel frío y tinta azulada, sin crema.
- **Movimiento:** solo en el arrastre, con peso. Ninguna animación de entrada.
- **Copia:** verbos en activa, mayúscula solo inicial, sin relleno. "Sentar a Marta", no
  "Asignar comensal". Estados vacíos que invitan: "Aún no hay mesas. Crea la primera."
- Usable en tableta, foco de teclado visible, `prefers-reduced-motion` respetado.

## Reglas de trabajo

- Antes de cada fase, resumir en tres líneas qué se va a hacer y esperar confirmación.
- Un commit por fase, con mensaje descriptivo.
- Desplegar a producción al terminar cada fase, no solo al final.
- Si una fase se alarga más del doble de lo estimado, parar y proponer recortar alcance.

## Después de hoy (no construir)

1. **Semana 1:** RSVP digital — enlace público por invitado, confirmación, alergias, menú.
2. **Semanas 2–3:** Supabase Auth, migración de bodas a `owner_id`, panel multi-boda.
3. **Mes 2:** Stripe, tramo gratuito hasta 30 invitados.
4. **Backlog:** regalos, playlist colaborativa, restricciones de "no sentar juntos",
   transporte, escaleta del día.

## Riesgo de negocio

Bodas.net ofrece un organizador de mesas gratuito en España. Este módulo por sí solo no
es monetizable. El valor defendible tendrá que venir de la integración
RSVP + mesas + logística + comunicación en un solo sitio, o del ángulo de wedding
planners con varias bodas. Conviene validarlo antes de invertir en Stripe.
