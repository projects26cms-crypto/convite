import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import type { GrupoInvitados, Invitado } from "@/lib/tipos";

export type Recuento = {
  total: number;
  confirmados: number;
  pendientes: number;
  rechazados: number;
  ninos: number;
};

export async function listarInvitados(bodaId: string): Promise<Invitado[]> {
  const { data, error } = await supabaseAdmin()
    .from("guests")
    .select("*")
    .eq("wedding_id", bodaId)
    .order("full_name", { ascending: true });

  if (error) throw new Error(`No se pudo leer la lista: ${error.message}`);
  return (data ?? []) as Invitado[];
}

export async function listarGrupos(bodaId: string): Promise<GrupoInvitados[]> {
  const { data, error } = await supabaseAdmin()
    .from("guest_groups")
    .select("*")
    .eq("wedding_id", bodaId)
    .order("name", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los grupos: ${error.message}`);
  return (data ?? []) as GrupoInvitados[];
}

export function contar(invitados: Invitado[]): Recuento {
  const recuento: Recuento = {
    total: invitados.length,
    confirmados: 0,
    pendientes: 0,
    rechazados: 0,
    ninos: 0,
  };

  for (const invitado of invitados) {
    if (invitado.rsvp_status === "confirmado") recuento.confirmados++;
    else if (invitado.rsvp_status === "pendiente") recuento.pendientes++;
    else recuento.rechazados++;
    if (invitado.is_child) recuento.ninos++;
  }

  return recuento;
}
