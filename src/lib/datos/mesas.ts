import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import type { Asignacion, Mesa } from "@/lib/tipos";

export async function listarMesas(bodaId: string): Promise<Mesa[]> {
  const { data, error } = await supabaseAdmin()
    .from("event_tables")
    .select("*")
    .eq("wedding_id", bodaId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`No se pudieron leer las mesas: ${error.message}`);
  return (data ?? []) as Mesa[];
}

export async function listarAsignaciones(
  bodaId: string,
): Promise<Asignacion[]> {
  const { data, error } = await supabaseAdmin()
    .from("seat_assignments")
    .select("*")
    .eq("wedding_id", bodaId);

  if (error)
    throw new Error(`No se pudieron leer las asignaciones: ${error.message}`);
  return (data ?? []) as Asignacion[];
}
