# Convite

Gestión de invitados y mesas para bodas. Cada boda vive en su propio enlace,
`/b/[slug]`, sin cuentas ni contraseñas.

Producción: https://convite-delta-six.vercel.app

## Desarrollo

```bash
npm ci
cp .env.example .env.local   # rellenar con los valores de Supabase
npm run dev
```

Abre http://localhost:3000. La boda de prueba está en `/b/ines-santi-7k2mq4x9`.

## Variables de entorno

| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` y Vercel | Supabase → Project Settings → API Keys. **Solo servidor.** Nunca con prefijo `NEXT_PUBLIC_` |

## Base de datos

RLS activado y sin políticas: solo el servidor, con la `service_role`, puede leer o
escribir. Para una base nueva, ejecutar en este orden en el SQL Editor de Supabase:

1. [`supabase/schema.sql`](supabase/schema.sql)
2. [`supabase/002-presidencial.sql`](supabase/002-presidencial.sql)
3. [`supabase/003-reglas.sql`](supabase/003-reglas.sql)
4. [`supabase/004-sala-y-modelos.sql`](supabase/004-sala-y-modelos.sql)

[`supabase/seed.sql`](supabase/seed.sql) crea la boda de prueba.

## Documentación

- [`CLAUDE.md`](CLAUDE.md): decisiones cerradas, arquitectura, invariantes y dirección
  de diseño.
- [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md): historial, decisiones
  tomadas, pendientes y problemas conocidos.
