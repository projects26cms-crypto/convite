import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabase/server";
import { esSlugValido } from "@/lib/slug";
import type { Boda } from "@/lib/tipos";

/**
 * Punto de entrada de todo acceso a datos: sin una boda resuelta desde un slug
 * válido, ninguna otra consulta debería ejecutarse.
 *
 * `cache` evita repetir la consulta cuando el layout y la página piden la misma
 * boda en el mismo render.
 */
export const obtenerBodaPorSlug = cache(async function obtenerBodaPorSlug(
  slug: string,
): Promise<Boda | null> {
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
});
