# Estado del proyecto

Última actualización: 27 de septiembre de 2026. Último commit: `4d1c71b`.

## Dónde vive cada cosa

| Recurso | Ubicación |
|---|---|
| Código | https://github.com/projects26cms-crypto/convite (rama `main`, repo público) |
| Producción | https://convite-delta-six.vercel.app — Vercel despliega solo cada push a `main` |
| Base de datos | Supabase, `https://mwwpbxcomogudsbaxyzw.supabase.co` |
| Claves | Solo en `.env.local` (local, fuera de git) y en Vercel → Settings → Environment Variables |
| Boda de prueba | https://convite-delta-six.vercel.app/b/ines-santi-7k2mq4x9 |

## Recuperar el proyecto en un ordenador nuevo

```bash
git clone https://github.com/projects26cms-crypto/convite.git
cd convite
npm ci
cp .env.example .env.local   # y rellenar las dos claves de Supabase
npm run dev
```

El `.env.local` **no está en GitHub** a propósito. Si se pierde, las claves se vuelven a
copiar desde Supabase → Project Settings → API Keys (la secreta empieza por `sb_secret_`)
y Data API (la URL del proyecto).

## Historial

### Brief original (fases 1–4 hechas)

| Fase | Contenido | Commit |
|---|---|---|
| 1 | Esqueleto Next.js, tokens de diseño, landing mínima, Vercel | `dcea495` |
| 2 | Supabase, acceso por slug, ficha de la boda | `bbbd2a8` |
| 3 | Invitados y grupos: alta, edición en línea, importación pegando, contadores | `eb5cb00` |
| 4 | Planificador: arrastre, plantillas de sala, resaltado por familia, autoguardado | `0842cd5` |
| 5 | **Plano imprimible — sin hacer** | — |
| 6 | **Landing con creación de boda — sin hacer** | — |

### Mejoras del planificador posteriores

| Bloque | Contenido | Commit |
|---|---|---|
| Protocolo | Lienzo en centímetros, separación mínima 1,50 / 1,20 / 1,00 m con deslizamiento automático, presidencial (`is_head`), sentar por familias, deshacer, girar, duplicar | `9cd6ad4`, `92218ff` |
| Velocidad e interfaz | Sentar con dos clics, panel agrupado por familias, selección múltiple, sillas visibles, navegación del lienzo (paneo, rueda, ajustar), buscar y llevar | `eb8f9f8` |
| Reglas y reparto | Reglas `juntos`/`separados`, reparto con vista previa y alcance, mesas fijadas, vaciar mesa | `6720a97` |
| Interfaz legible | Rótulos a tamaño fijo en pantalla, sillas pintadas por bando, sala con cotas y escala gráfica, presidencial en tinta, barra con jerarquía, zoom y avisos flotantes, tarjeta al pasar el ratón, progreso en el panel, aviso al pasarse de plazas, móvil sin que la lista tape el plano | `4d1c71b` |

### Encargo "cinco mejoras del planificador" (en curso)

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Sala configurable en la boda, `template_id`, formas nuevas, catálogo de 12 modelos | Hecha — `8b3bed6` |
| 2 | Selector de modelos con miniaturas generadas por la misma geometría, presets S/M/L y medida libre, aviso "fuera de sala" con reubicación explícita | Hecha — `299cc0d` |
| 3 | Escala visual de mesas independiente de la real: automático con margen del 30 % acotado a 1,0–1,6, deslizador recordado en el navegador, aviso de vista no fiel, rótulos compensados y ocultos por debajo de un umbral. Vive en `src/lib/vista.ts` | Hecha — `4d1c71b` |
| 4 | Nombres de mesa: ya existe el campo, autonumeración sin renumerar y edición en el inspector. Falta doble clic en el plano, esquemas masivos (numérico, alfabético) y aviso de duplicados | Pendiente |
| 5 | **A nivel de mesa.** Hecho: tarjeta al pasar el ratón con ocupación y ocupantes, panel lateral al tocar, nombres dentro de la mesa por encima de un umbral de zoom. Falta: resaltado bidireccional lista ↔ plano | Parcial — `4d1c71b` |

Criterios que el usuario dejó fuera de esta iteración: el test del invariante de escalas
(se verifica en el navegador) y todo lo relativo a la exportación imprimible.

Invariante verificado el 27/09/2026 en producción: con escala visual 1,0, 1,16 y 1,6 las
posiciones de las 16 mesas son idénticas; solo cambia el `scale()` del dibujo.

## Decisiones tomadas y por qué

- **Centímetros, no metros.** Mismo concepto de unidad física; pasar a metros no aportaba
  nada y obligaba a migrar datos.
- **Bodas existentes en sala L, no M.** Se montaron sobre un lienzo de 20 × 14 m; con M
  quedaba medio plano fuera de perímetro. Las bodas nuevas nacen en M.
- **Mesa en U y en E son una sola fila**, no varias mesas enlazadas. Para colisión se
  aproximan por su rectángulo envolvente: reservan de más, nunca de menos.
- **`presidencial` es una forma** (sillas en un solo lado) y **`is_head` es la marca** de
  la presidencial de la boda. Son independientes.
- **Nada se mueve solo.** Reducir la sala marca mesas fuera; cambiar el tamaño de una
  mesa puede invadir a sus vecinas. En ambos casos la aplicación avisa o corrige solo
  cuando el usuario actúa.
- **Deshacer es de sesión.** Se vacía al recargar y al montar una plantilla de sala.
- **"Plantillas" = salas completas** (banquete, herradura, mesas largas). **"Modelos" =
  tipos de mesa** del catálogo. Nombres distintos a propósito.
- **La tradición de separar bandos a cada lado** de la presidencial es opcional y viene
  apagada: las fuentes de protocolo la describen como en desuso.

## Pendiente fuera del encargo actual

- **Sillas concretas:** asignar invitado a silla numerada. Iteración propia. Toca modelo,
  arrastre, reparto, reglas y geometría. `seat_assignments.seat_number` ya existe.
- **Plano imprimible:** A4 horizontal a escala real, listado alfabético invitado → mesa y
  listado por mesa.
- **Landing y creación de boda:** hoy la portada dice "En construcción" y **no hay forma
  de crear una boda sin SQL**. `generarSlug()` ya existe en `src/lib/slug.ts`.
- **Propuestas descartadas por ahora:** panel de revisión de problemas y versiones
  guardadas de la distribución con rehacer.
- **Después:** RSVP digital, Supabase Auth con `owner_id`, Stripe.

## Problemas conocidos

- **Supabase pausa el proyecto si no se usa.** El plan gratuito lo pausó por inactividad
  el 25/09/2026 y producción dio error 500. Se reactivó con *Restore project* sin perder
  nada. **Desde `4d1c71b` hay un latido diario:** Vercel llama a `/api/latido` cada día a
  las 7:00 UTC (`vercel.json`) y eso basta para que no se pause. Si aun así volviera a
  pasar, mismo botón. Si el proyecto desapareciera, crear uno nuevo, ejecutar las cuatro
  migraciones y cambiar las dos claves en `.env.local` y en Vercel.
- **La clave secreta de Supabase ha pasado por una conversación.** Conviene generar una
  nueva y cambiarla en `.env.local` y en Vercel.
- **Datos de prueba:** la boda `ines-santi-7k2mq4x9` tiene 150 invitados inventados,
  montados el 27/09/2026 con la plantilla Banquete (presidencial + 15 redondas de 10) y
  repartidos por familias. 8 grupos quedan partidos porque hay 150 plazas exactas.
- **En desarrollo**, la recarga en caliente reinicia el planificador con los datos de
  cuando se abrió la página. Recargar la página lo arregla. En producción no ocurre.
- **En móvil no hay zoom con dos dedos** (el lienzo lo bloquea para poder arrastrar);
  se usan los botones + y −.
- El contador del botón **Reglas** muestra el total si todo va bien y las incumplidas si
  algo falla; solo lo distingue el color.
- **U y E** ocupan su rectángulo envolvente para colisión, con el hueco central incluido.
- `npm audit` marca vulnerabilidades altas, todas transitivas de herramientas de
  desarrollo (`eslint → minimatch`, `next → postcss/sharp`). No llegan a producción.

## Referencias de protocolo usadas

- Separación entre bordes de mesa: 1,50 m (60 cm de silla por lado + 30 cm de paso).
- Redonda de 150 cm para 8, de 180 cm para 10. Rectangular de 180 × 80 para 6–8.
- Presidencial clásica de 6: novios en el centro, la novia a la derecha del novio;
  madrina a la derecha del novio y padrino a la izquierda de la novia.
- Fuentes: ¡Hola! Novias, Lucía se casa, Anatole, Kaboom Eventos.
