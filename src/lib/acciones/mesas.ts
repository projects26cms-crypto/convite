"use server";

import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ajustarARejilla, encajarEnSala, type MesaNueva } from "@/lib/mesas";
import type { Boda, FormaMesa, Mesa } from "@/lib/tipos";

const FORMAS: FormaMesa[] = ["redonda", "rectangular", "imperial"];

async function resolverBoda(slug: string): Promise<Boda> {
  const boda = await obtenerBodaPorSlug(slug);
  if (!boda) throw new Error("Boda no encontrada");
  return boda;
}

function sanear(mesa: MesaNueva) {
  const forma = FORMAS.includes(mesa.shape) ? mesa.shape : "redonda";
  const capacidad = Math.min(40, Math.max(1, Math.round(mesa.capacity)));
  const giro = ((Math.round(mesa.rotation) % 360) + 360) % 360;
  const { x, y } = encajarEnSala(
    { shape: forma, capacity: capacidad },
    giro,
    ajustarARejilla(mesa.pos_x),
    ajustarARejilla(mesa.pos_y),
  );

  return {
    name: mesa.name.replace(/\s+/g, " ").trim().slice(0, 60) || "Mesa",
    shape: forma,
    capacity: capacidad,
    pos_x: x,
    pos_y: y,
    rotation: giro,
    is_head: mesa.is_head === true,
  };
}

export async function crearMesas(
  slug: string,
  nuevas: MesaNueva[],
): Promise<Mesa[]> {
  const boda = await resolverBoda(slug);
  if (nuevas.length === 0) return [];

  const { data, error } = await supabaseAdmin()
    .from("event_tables")
    .insert(
      nuevas
        .slice(0, 60)
        .map((mesa) => ({ ...sanear(mesa), wedding_id: boda.id })),
    )
    .select("*");

  if (error) throw new Error(`No se pudo crear la mesa: ${error.message}`);
  return (data ?? []) as Mesa[];
}

export async function moverMesa(
  slug: string,
  mesaId: string,
  x: number,
  y: number,
): Promise<void> {
  const boda = await resolverBoda(slug);

  const { error } = await supabaseAdmin()
    .from("event_tables")
    .update({ pos_x: ajustarARejilla(x), pos_y: ajustarARejilla(y) })
    .eq("id", mesaId)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo mover la mesa: ${error.message}`);
}

export async function actualizarMesa(
  slug: string,
  mesaId: string,
  cambios: {
    name?: string;
    shape?: FormaMesa;
    capacity?: number;
    rotation?: number;
  },
): Promise<void> {
  const boda = await resolverBoda(slug);
  const parche: Record<string, unknown> = {};

  if (cambios.name !== undefined) {
    const nombre = cambios.name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!nombre) return;
    parche.name = nombre;
  }
  if (cambios.shape !== undefined && FORMAS.includes(cambios.shape)) {
    parche.shape = cambios.shape;
  }
  if (cambios.capacity !== undefined) {
    parche.capacity = Math.min(40, Math.max(1, Math.round(cambios.capacity)));
  }
  if (cambios.rotation !== undefined) {
    parche.rotation = ((Math.round(cambios.rotation) % 360) + 360) % 360;
  }
  if (Object.keys(parche).length === 0) return;

  const { error } = await supabaseAdmin()
    .from("event_tables")
    .update(parche)
    .eq("id", mesaId)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo guardar la mesa: ${error.message}`);
}

/** Al borrar la mesa, sus invitados vuelven a la lista de sin sentar. */
export async function borrarMesa(slug: string, mesaId: string): Promise<void> {
  const boda = await resolverBoda(slug);
  const db = supabaseAdmin();

  const { data } = await db
    .from("event_tables")
    .select("is_head")
    .eq("id", mesaId)
    .eq("wedding_id", boda.id)
    .maybeSingle();

  if (data?.is_head) throw new Error("La presidencial no se puede borrar");

  const { error } = await db
    .from("event_tables")
    .delete()
    .eq("id", mesaId)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo borrar la mesa: ${error.message}`);
}

export async function borrarTodasLasMesas(slug: string): Promise<void> {
  const boda = await resolverBoda(slug);

  const { error } = await supabaseAdmin()
    .from("event_tables")
    .delete()
    .eq("wedding_id", boda.id);

  if (error)
    throw new Error(`No se pudieron borrar las mesas: ${error.message}`);
}

async function comprobarPertenencia(
  bodaId: string,
  invitados: string[],
  mesas: string[],
): Promise<void> {
  const db = supabaseAdmin();
  const [deInvitados, deMesas] = await Promise.all([
    db.from("guests").select("id").eq("wedding_id", bodaId).in("id", invitados),
    db
      .from("event_tables")
      .select("id")
      .eq("wedding_id", bodaId)
      .in("id", mesas),
  ]);

  const invitadosOk = new Set((deInvitados.data ?? []).map((f) => f.id));
  const mesasOk = new Set((deMesas.data ?? []).map((f) => f.id));

  if (
    invitados.some((id) => !invitadosOk.has(id)) ||
    mesas.some((id) => !mesasOk.has(id))
  ) {
    throw new Error("Invitado o mesa no válidos");
  }
}

export async function sentar(
  slug: string,
  invitadoId: string,
  mesaId: string,
): Promise<void> {
  await sentarEnBloque(slug, [{ invitadoId, mesaId }]);
}

/** Una sola escritura para todo el reparto automático. */
export async function sentarEnBloque(
  slug: string,
  pares: { invitadoId: string; mesaId: string }[],
): Promise<void> {
  if (pares.length === 0) return;
  const boda = await resolverBoda(slug);

  await comprobarPertenencia(
    boda.id,
    [...new Set(pares.map((p) => p.invitadoId))],
    [...new Set(pares.map((p) => p.mesaId))],
  );

  const { error } = await supabaseAdmin()
    .from("seat_assignments")
    .upsert(
      pares.map((p) => ({
        wedding_id: boda.id,
        table_id: p.mesaId,
        guest_id: p.invitadoId,
      })),
      { onConflict: "guest_id" },
    );

  if (error) throw new Error(`No se pudo sentar: ${error.message}`);
}

export async function levantar(
  slug: string,
  invitados: string[],
): Promise<void> {
  if (invitados.length === 0) return;
  const boda = await resolverBoda(slug);

  const { error } = await supabaseAdmin()
    .from("seat_assignments")
    .delete()
    .eq("wedding_id", boda.id)
    .in("guest_id", invitados);

  if (error) throw new Error(`No se pudo levantar: ${error.message}`);
}
