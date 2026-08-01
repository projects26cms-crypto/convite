import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import type { Asignacion, Mesa, Regla } from "@/lib/tipos";

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

export async function listarReglas(bodaId: string): Promise<Regla[]> {
  const { data, error } = await supabaseAdmin()
    .from("seating_rules")
    .select("*")
    .eq("wedding_id", bodaId)
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(`No se pudieron leer las reglas: ${error.message}`);
  return (data ?? []) as Regla[];
}
