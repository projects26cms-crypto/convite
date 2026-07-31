import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { esSlugValido } from "@/lib/slug";
import type { Boda } from "@/lib/tipos";

/**
 * Punto de entrada de todo acceso a datos: sin una boda resuelta desde un slug
 * válido, ninguna otra consulta debería ejecutarse.
 */
export async function obtenerBodaPorSlug(slug: string): Promise<Boda | null> {
  if (!esSlugValido(slug)) return null;

  const { data, error } = await supabaseAdmin()
    .from("weddings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la boda «${slug}»: ${error.message}`);
  }

  return (data as Boda | null) ?? null;
}
