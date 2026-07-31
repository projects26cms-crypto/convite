"use client";

import { useMemo, useState, useTransition } from "react";

import { actualizarInvitado, borrarInvitado } from "@/lib/acciones/invitados";
import type { EstadoRsvp, GrupoInvitados, Invitado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const COLOR_RSVP: Record<EstadoRsvp, string> = {
  confirmado: "bg-confirmado",
  pendiente: "bg-pendiente",
  rechazado: "bg-rechazado",
};

const SIN_GRUPO = "__sin_grupo__";

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

type Campos = {
  full_name: string;
  group_id: string;
  rsvp_status: EstadoRsvp;
  is_child: boolean;
};

/**
 * Los campos se llevan en estado local y se envían construyendo el FormData a
 * mano. Con `<form action>` React resetea los campos no controlados al terminar
 * la acción, y la fila parpadeaba de vuelta al valor anterior.
 */
function Fila({
  invitado,
  grupos,
  slug,
}: {
  invitado: Invitado;
  grupos: GrupoInvitados[];
  slug: string;
}) {
  const [campos, setCampos] = useState<Campos>({
    full_name: invitado.full_name,
    group_id: invitado.group_id ?? "",
    rsvp_status: invitado.rsvp_status,
    is_child: invitado.is_child,
  });
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [guardando, iniciar] = useTransition();

  function guardar(cambio: Partial<Campos>) {
    const siguiente = { ...campos, ...cambio };
    setCampos(siguiente);

    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", invitado.id);
    datos.set("full_name", siguiente.full_name);
    datos.set("group_id", siguiente.group_id);
    datos.set("rsvp_status", siguiente.rsvp_status);
    if (siguiente.is_child) datos.set("is_child", "on");
    else datos.set("is_child", "off");

    iniciar(async () => {
      await actualizarInvitado(datos);
    });
  }

  function borrar() {
    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", invitado.id);
    iniciar(async () => {
      await borrarInvitado(datos);
    });
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-border px-2 py-1.5 last:border-b-0 hover:bg-secondary/50 sm:grid-cols-[minmax(0,1fr)_11rem_9rem_auto_auto]",
        guardando && "opacity-60",
      )}
    >
      <input
        value={campos.full_name}
        aria-label="Nombre"
        onChange={(e) =>
          setCampos((previos) => ({ ...previos, full_name: e.target.value }))
        }
        onBlur={(e) => {
          const limpio = e.target.value.trim();
          if (!limpio) {
            setCampos((previos) => ({
              ...previos,
              full_name: invitado.full_name,
            }));
            return;
          }
          if (limpio !== invitado.full_name) guardar({ full_name: limpio });
        }}
        className="min-w-0 truncate rounded-sm bg-transparent px-1 py-1 text-sm focus:bg-card"
      />

      <select
        value={campos.group_id}
        aria-label="Grupo"
        onChange={(e) => guardar({ group_id: e.target.value })}
        className="col-span-2 min-w-0 rounded-sm bg-transparent px-1 py-1 text-sm text-muted-foreground sm:col-span-1"
      >
        <option value="">Sin grupo</option>
        {grupos.map((grupo) => (
          <option key={grupo.id} value={grupo.id}>
            {grupo.name}
          </option>
        ))}
      </select>

      <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            COLOR_RSVP[campos.rsvp_status],
          )}
        />
        <select
          value={campos.rsvp_status}
          aria-label="Confirmación"
          onChange={(e) =>
            guardar({ rsvp_status: e.target.value as EstadoRsvp })
          }
          className="min-w-0 rounded-sm bg-transparent px-1 py-1 text-sm"
        >
          <option value="pendiente">Pendiente</option>
          <option value="confirmado">Confirmado</option>
          <option value="rechazado">No viene</option>
        </select>
      </div>

      <label className="flex items-center gap-1.5 whitespace-nowrap px-1 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={campos.is_child}
          onChange={(e) => guardar({ is_child: e.target.checked })}
          className="size-3.5 accent-[var(--foreground)]"
        />
        Niño
      </label>

      {confirmandoBorrado ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={borrar}
            className="rounded-sm px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Quitar
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(false)}
            className="rounded-sm px-1.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmandoBorrado(true)}
          aria-label={`Quitar a ${invitado.full_name}`}
          title="Quitar de la lista"
          className="rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function ListaInvitados({
  invitados,
  grupos,
  slug,
}: {
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  slug: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");

  const visibles = useMemo(() => {
    const aguja = normalizar(busqueda.trim());

    return invitados.filter((invitado) => {
      if (grupoFiltro === SIN_GRUPO && invitado.group_id) return false;
      if (
        grupoFiltro &&
        grupoFiltro !== SIN_GRUPO &&
        invitado.group_id !== grupoFiltro
      ) {
        return false;
      }
      if (!aguja) return true;
      return normalizar(invitado.full_name).includes(aguja);
    });
  }, [invitados, busqueda, grupoFiltro]);

  if (invitados.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
        Aún no hay invitados. Pega tu lista aquí arriba y empieza.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar invitado por nombre"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
        />

        <select
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
          aria-label="Filtrar por grupo"
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="">Todos los grupos</option>
          <option value={SIN_GRUPO}>Sin grupo</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-muted-foreground" aria-live="polite">
          {visibles.length === invitados.length
            ? `${invitados.length} invitados`
            : `${visibles.length} de ${invitados.length}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nadie coincide con esa búsqueda.
          </p>
        ) : (
          visibles.map((invitado) => (
            <Fila
              key={invitado.id}
              invitado={invitado}
              grupos={grupos}
              slug={slug}
            />
          ))
        )}
      </div>
    </div>
  );
}
