# Convite

Gestión de invitados y mesas para bodas. Cada boda vive en su propio enlace,
`/b/[slug]`, sin cuentas ni contraseñas.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # rellenar con los valores de Supabase
npm run dev
```

Abre http://localhost:3000.

## Variables de entorno

| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` y Vercel | **Solo servidor.** Nunca con prefijo `NEXT_PUBLIC_` |

## Base de datos

El esquema está en [`supabase/schema.sql`](supabase/schema.sql). RLS activado y sin
políticas: solo el servidor, con la `service_role`, puede leer o escribir.

## Contexto

[`CLAUDE.md`](CLAUDE.md) recoge el alcance, las decisiones cerradas y la dirección de
diseño.
