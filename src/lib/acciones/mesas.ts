"use server";

import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ajustarARejilla, encajarEnLienzo, type MesaNueva } from "@/lib/mesas";
import type { Boda, FormaMesa, Mesa } from "@/lib/tipos";

const FORMAS: FormaMesa[] = ["redonda", "rectangular", "imperial"];

async function resolverBoda(slug: string): Promise<Boda> {
  const boda = await obtenerBodaPorSlug(slug);
  if (!boda) throw new Error("Boda no encontrada");
  return boda;
}

function sanear(mesa: MesaNueva): MesaNueva {
  const forma = FORMAS.includes(mesa.shape) ? mesa.shape : "redonda";
  const capacidad = Math.min(40, Math.max(1, Math.round(mesa.capacity)));
  const { x, y } = encajarEnLienzo(
    { shape: forma, capacity: capacidad },
    ajustarARejilla(mesa.pos_x),
    ajustarARejilla(mesa.pos_y),
  );

  return {
    name: mesa.name.replace(/\s+/g, " ").trim().slice(0, 60) || "Mesa",
    shape: forma,
    capacity: capacidad,
    pos_x: x,
    pos_y: y,
    rotation: 0,
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
  cambios: { name?: string; shape?: FormaMesa; capacity?: number },
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

  const { error } = await supabaseAdmin()
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

  if (error) throw new Error(`No se pudieron borrar las mesas: ${error.message}`);
}

export async function sentar(
  slug: string,
  invitadoId: string,
  mesaId: string,
): Promise<void> {
  const boda = await resolverBoda(slug);
  const db = supabaseAdmin();

  // Ni el invitado ni la mesa pueden ser de otra boda.
  const [invitado, mesa] = await Promise.all([
    db
      .from("guests")
      .select("id")
      .eq("id", invitadoId)
      .eq("wedding_id", boda.id)
      .maybeSingle(),
    db
      .from("event_tables")
      .select("id")
      .eq("id", mesaId)
      .eq("wedding_id", boda.id)
      .maybeSingle(),
  ]);

  if (!invitado.data || !mesa.data) throw new Error("Invitado o mesa no válidos");

  const { error } = await db
    .from("seat_assignments")
    .upsert(
      {
        wedding_id: boda.id,
        table_id: mesaId,
        guest_id: invitadoId,
      },
      { onConflict: "guest_id" },
    );

  if (error) throw new Error(`No se pudo sentar: ${error.message}`);
}

export async function levantar(
  slug: string,
  invitadoId: string,
): Promise<void> {
  const boda = await resolverBoda(slug);

  const { error } = await supabaseAdmin()
    .from("seat_assignments")
    .delete()
    .eq("guest_id", invitadoId)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo levantar: ${error.message}`);
}
