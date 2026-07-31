import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave `service_role`.
 *
 * Salta RLS por completo, así que solo puede existir en el servidor. El import
 * de `server-only` hace que la compilación falle si algún componente de cliente
 * lo arrastra por error.
 */
let cliente: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
        "Revisa .env.local en local y las variables de entorno en Vercel.",
    );
  }

  cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}
