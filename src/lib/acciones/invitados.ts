"use server";

import { revalidatePath } from "next/cache";

import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { supabaseAdmin } from "@/lib/supabase/server";
import { gruposDe, leerPegado } from "@/lib/importar";
import type { EstadoAccion } from "@/lib/acciones/estado";
import type { Bando, Boda, EstadoRsvp } from "@/lib/tipos";

const ESTADOS_RSVP: EstadoRsvp[] = ["pendiente", "confirmado", "rechazado"];
const BANDOS: Bando[] = ["novia", "novio", "ambos"];

/**
 * Toda acción empieza aquí: sin un slug válido que resuelva a una boda, no se
 * toca la base de datos. Es el único control de acceso que existe.
 */
async function resolverBoda(formData: FormData): Promise<Boda> {
  const slug = String(formData.get("slug") ?? "");
  const boda = await obtenerBodaPorSlug(slug);
  if (!boda) throw new Error("Boda no encontrada");
  return boda;
}

function refrescar(slug: string) {
  revalidatePath(`/b/${slug}/invitados`);
}

function texto(formData: FormData, campo: string, largoMax = 120): string {
  return String(formData.get(campo) ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, largoMax);
}

export async function crearInvitado(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const boda = await resolverBoda(formData);
  const nombre = texto(formData, "full_name");

  if (!nombre) return { ok: false, mensaje: "Escribe un nombre." };

  const grupoId = String(formData.get("group_id") ?? "") || null;

  const { error } = await supabaseAdmin()
    .from("guests")
    .insert({
      wedding_id: boda.id,
      full_name: nombre,
      group_id: grupoId,
      is_child: formData.get("is_child") === "on",
    });

  if (error) return { ok: false, mensaje: `No se pudo añadir: ${error.message}` };

  refrescar(boda.slug);
  return { ok: true, mensaje: `${nombre} añadido.` };
}

export async function actualizarInvitado(formData: FormData): Promise<void> {
  const boda = await resolverBoda(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const cambios: Record<string, unknown> = {};

  if (formData.has("full_name")) {
    const nombre = texto(formData, "full_name");
    if (!nombre) return;
    cambios.full_name = nombre;
  }

  if (formData.has("rsvp_status")) {
    const estado = String(formData.get("rsvp_status"));
    if (!ESTADOS_RSVP.includes(estado as EstadoRsvp)) return;
    cambios.rsvp_status = estado;
  }

  if (formData.has("group_id")) {
    cambios.group_id = String(formData.get("group_id")) || null;
  }

  if (formData.has("is_child")) {
    cambios.is_child = formData.get("is_child") === "on";
  }

  if (Object.keys(cambios).length === 0) return;

  // El filtro por wedding_id impide tocar invitados de otra boda.
  const { error } = await supabaseAdmin()
    .from("guests")
    .update(cambios)
    .eq("id", id)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  refrescar(boda.slug);
}

export async function borrarInvitado(formData: FormData): Promise<void> {
  const boda = await resolverBoda(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabaseAdmin()
    .from("guests")
    .delete()
    .eq("id", id)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo borrar: ${error.message}`);

  refrescar(boda.slug);
}

export async function crearGrupo(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const boda = await resolverBoda(formData);
  const nombre = texto(formData, "name", 80);

  if (!nombre) return { ok: false, mensaje: "Escribe un nombre de grupo." };

  const bando = String(formData.get("side") ?? "");

  const { error } = await supabaseAdmin()
    .from("guest_groups")
    .insert({
      wedding_id: boda.id,
      name: nombre,
      side: BANDOS.includes(bando as Bando) ? bando : null,
    });

  if (error) return { ok: false, mensaje: `No se pudo crear: ${error.message}` };

  refrescar(boda.slug);
  return { ok: true, mensaje: `Grupo «${nombre}» creado.` };
}

export async function actualizarGrupo(formData: FormData): Promise<void> {
  const boda = await resolverBoda(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const cambios: Record<string, unknown> = {};

  if (formData.has("name")) {
    const nombre = texto(formData, "name", 80);
    if (!nombre) return;
    cambios.name = nombre;
  }

  if (formData.has("side")) {
    const bando = String(formData.get("side"));
    cambios.side = BANDOS.includes(bando as Bando) ? bando : null;
  }

  if (Object.keys(cambios).length === 0) return;

  const { error } = await supabaseAdmin()
    .from("guest_groups")
    .update(cambios)
    .eq("id", id)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo guardar el grupo: ${error.message}`);

  refrescar(boda.slug);
}

/** Borra el grupo; los invitados que tuviera se quedan sin grupo, no se pierden. */
export async function borrarGrupo(formData: FormData): Promise<void> {
  const boda = await resolverBoda(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabaseAdmin()
    .from("guest_groups")
    .delete()
    .eq("id", id)
    .eq("wedding_id", boda.id);

  if (error) throw new Error(`No se pudo borrar el grupo: ${error.message}`);

  refrescar(boda.slug);
}

export async function importarInvitados(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const boda = await resolverBoda(formData);
  const pegado = String(formData.get("pegado") ?? "");
  const { lineas } = leerPegado(pegado);

  if (lineas.length === 0) {
    return { ok: false, mensaje: "No he encontrado ningún nombre en el texto." };
  }

  const db = supabaseAdmin();

  // Grupos que ya existen, indexados en minúsculas para no duplicar
  // "Familia Ruiz" y "familia ruiz".
  const { data: existentes, error: errorGrupos } = await db
    .from("guest_groups")
    .select("id, name")
    .eq("wedding_id", boda.id);

  if (errorGrupos) {
    return { ok: false, mensaje: `No se pudo importar: ${errorGrupos.message}` };
  }

  const porNombre = new Map<string, string>(
    (existentes ?? []).map((g) => [g.name.toLocaleLowerCase("es-ES"), g.id]),
  );

  const nuevos = gruposDe(lineas).filter(
    (nombre) => !porNombre.has(nombre.toLocaleLowerCase("es-ES")),
  );

  if (nuevos.length > 0) {
    const { data: creados, error } = await db
      .from("guest_groups")
      .insert(nuevos.map((name) => ({ wedding_id: boda.id, name })))
      .select("id, name");

    if (error) {
      return { ok: false, mensaje: `No se pudieron crear los grupos: ${error.message}` };
    }

    for (const grupo of creados ?? []) {
      porNombre.set(grupo.name.toLocaleLowerCase("es-ES"), grupo.id);
    }
  }

  // Una sola inserción para toda la lista: 150 invitados es un viaje, no 150.
  const { error } = await db.from("guests").insert(
    lineas.map(({ nombre, grupo }) => ({
      wedding_id: boda.id,
      full_name: nombre,
      group_id: grupo ? (porNombre.get(grupo.toLocaleLowerCase("es-ES")) ?? null) : null,
    })),
  );

  if (error) return { ok: false, mensaje: `No se pudo importar: ${error.message}` };

  refrescar(boda.slug);

  const conGrupo = nuevos.length
    ? ` y ${nuevos.length} ${nuevos.length === 1 ? "grupo nuevo" : "grupos nuevos"}`
    : "";

  return {
    ok: true,
    mensaje: `${lineas.length} invitados añadidos${conGrupo}.`,
  };
}
