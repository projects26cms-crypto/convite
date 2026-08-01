"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { ChipInvitado, PUNTO_BANDO } from "@/components/mesas/piezas";
import type { GrupoInvitados, Invitado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const SIN_GRUPO = "__sin_grupo__";

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

/** La cabecera del grupo se arrastra entera: sentar a una familia es un gesto. */
function CabeceraGrupo({
  clave,
  nombre,
  bando,
  miembros,
  plegado,
  todosMarcados,
  alPlegar,
  alPulsar,
}: {
  clave: string;
  nombre: string;
  bando: string | null;
  miembros: Invitado[];
  plegado: boolean;
  todosMarcados: boolean;
  alPlegar: () => void;
  alPulsar: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grupo:${clave}`,
    data: { tipo: "grupo", ids: miembros.map((m) => m.id) },
  });

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-sm px-1",
        todosMarcados ? "bg-foreground text-background" : "bg-secondary/70",
        isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        onClick={alPlegar}
        aria-expanded={!plegado}
        aria-label={plegado ? `Desplegar ${nombre}` : `Plegar ${nombre}`}
        className="px-1 text-xs text-muted-foreground"
      >
        {plegado ? "▸" : "▾"}
      </button>

      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          alPulsar(e);
        }}
        title="Arrastra la familia entera a una mesa"
        className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 py-1 text-left touch-none active:cursor-grabbing"
      >
        {bando && (
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              PUNTO_BANDO[bando as keyof typeof PUNTO_BANDO],
            )}
          />
        )}
        <span className="truncate text-xs font-medium">{nombre}</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums opacity-70">
          {miembros.length}
        </span>
      </button>
    </div>
  );
}

export function PanelSinSentar({
  invitados,
  totalSinSentar,
  aSentar,
  grupos,
  grupoDe,
  seleccion,
  verRechazados,
  setVerRechazados,
  alPulsarInvitado,
  alPulsarGrupo,
}: {
  invitados: Invitado[];
  totalSinSentar: number;
  aSentar: number;
  grupos: GrupoInvitados[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  seleccion: Set<string>;
  verRechazados: boolean;
  setVerRechazados: (v: boolean) => void;
  alPulsarInvitado: (id: string, e: React.MouseEvent) => void;
  alPulsarGrupo: (ids: string[], e: React.MouseEvent) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [plegados, setPlegados] = useState<Set<string>>(new Set());

  const { setNodeRef, isOver } = useDroppable({
    id: "drop-panel",
    data: { tipo: "panel" },
  });

  const bloques = useMemo(() => {
    const aguja = normalizar(busqueda.trim());

    const visibles = invitados.filter((invitado) => {
      if (!verRechazados && invitado.rsvp_status === "rechazado") return false;
      if (!aguja) return true;
      return normalizar(invitado.full_name).includes(aguja);
    });

    const mapa = new Map<string, Invitado[]>();
    for (const invitado of visibles) {
      const clave = invitado.group_id ?? SIN_GRUPO;
      const lista = mapa.get(clave);
      if (lista) lista.push(invitado);
      else mapa.set(clave, [invitado]);
    }

    const orden = [...mapa.entries()].map(([clave, miembros]) => {
      const grupo = grupos.find((g) => g.id === clave);
      return {
        clave,
        nombre: grupo?.name ?? "Sin grupo",
        bando: grupo?.side ?? null,
        miembros,
      };
    });

    orden.sort((a, b) => {
      if (a.clave === SIN_GRUPO) return 1;
      if (b.clave === SIN_GRUPO) return -1;
      return b.miembros.length - a.miembros.length;
    });

    return orden;
  }, [invitados, grupos, busqueda, verRechazados]);

  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "flex w-full shrink-0 flex-col border-b border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-72 lg:border-b-0 lg:border-r",
        isOver && "bg-accent/40",
      )}
    >
      <div className="border-b border-border p-3">
        <p className="font-display text-lg leading-none tracking-tight">
          Sin sentar
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalSinSentar} de {aSentar} por colocar
        </p>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la lista"
          aria-label="Buscar invitado sin sentar"
          className="mt-3 h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
        />
        <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={verRechazados}
            onChange={(e) => setVerRechazados(e.target.checked)}
            className="size-3 accent-[var(--foreground)]"
          />
          Mostrar a quien no viene
        </label>
      </div>

      <div className="min-h-24 flex-1 space-y-2 overflow-y-auto p-2">
        {bloques.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {totalSinSentar === 0
              ? "Están todos sentados."
              : "Nadie coincide con esa búsqueda."}
          </p>
        ) : (
          bloques.map((bloque) => {
            const plegado = plegados.has(bloque.clave);
            const todosMarcados =
              bloque.miembros.length > 0 &&
              bloque.miembros.every((m) => seleccion.has(m.id));

            return (
              <div key={bloque.clave}>
                <CabeceraGrupo
                  clave={bloque.clave}
                  nombre={bloque.nombre}
                  bando={bloque.bando}
                  miembros={bloque.miembros}
                  plegado={plegado}
                  todosMarcados={todosMarcados}
                  alPlegar={() =>
                    setPlegados((previos) => {
                      const copia = new Set(previos);
                      if (copia.has(bloque.clave)) copia.delete(bloque.clave);
                      else copia.add(bloque.clave);
                      return copia;
                    })
                  }
                  alPulsar={(e) =>
                    alPulsarGrupo(
                      bloque.miembros.map((m) => m.id),
                      e,
                    )
                  }
                />

                {!plegado && (
                  <div className="mt-1 space-y-[3px] pl-2">
                    {bloque.miembros.map((invitado) => (
                      <ChipInvitado
                        key={invitado.id}
                        invitado={invitado}
                        grupo={grupoDe(invitado)}
                        desdeMesa={null}
                        marcado={seleccion.has(invitado.id)}
                        alPulsar={(e) => alPulsarInvitado(invitado.id, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
