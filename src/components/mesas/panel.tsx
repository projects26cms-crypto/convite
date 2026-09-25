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
        "group flex items-center gap-1 rounded-md pl-1 pr-2",
        todosMarcados
          ? "bg-foreground text-background"
          : "hover:bg-secondary",
        isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        onClick={alPlegar}
        aria-expanded={!plegado}
        aria-label={plegado ? `Desplegar ${nombre}` : `Plegar ${nombre}`}
        className="flex size-6 shrink-0 items-center justify-center rounded text-xs text-muted-foreground"
      >
        <span
          aria-hidden
          className={cn("transition-transform", !plegado && "rotate-90")}
        >
          ›
        </span>
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
        title="Pulsa para marcar a toda la familia, o arrástrala entera a una mesa"
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 py-1.5 text-left touch-none active:cursor-grabbing"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            bando
              ? PUNTO_BANDO[bando as keyof typeof PUNTO_BANDO]
              : "bg-foreground/25",
          )}
        />
        <span className="truncate text-[13px] font-semibold">{nombre}</span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-medium tabular-nums",
            todosMarcados ? "bg-background/20" : "bg-secondary text-muted-foreground",
          )}
        >
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
  sentados,
  mesas,
  plazas,
}: {
  sentados: number;
  mesas: number;
  plazas: number;
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
        "flex max-h-[45dvh] w-full shrink-0 flex-col border-b border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r",
        isOver && "bg-accent/40",
      )}
    >
      <div className="border-b border-border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-xl leading-none tracking-tight">
            Por sentar
          </p>
          <p className="font-display text-xl leading-none tabular-nums">
            {Math.max(0, aSentar - sentados)}
          </p>
        </div>

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={aSentar}
          aria-valuenow={Math.min(sentados, aSentar)}
          aria-label="Invitados sentados"
        >
          <div
            className="h-full rounded-full bg-novia transition-[width] duration-300 motion-reduce:transition-none"
            style={{
              width: `${aSentar === 0 ? 0 : Math.min(100, (sentados / aSentar) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {sentados} de {aSentar} sentados · {mesas}{" "}
          {mesas === 1 ? "mesa" : "mesas"} · {plazas} plazas
        </p>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la lista"
          aria-label="Buscar invitado sin sentar"
          className="mt-4 h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
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

      <div className="min-h-24 flex-1 space-y-3 overflow-y-auto px-2 py-3">
        {bloques.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {totalSinSentar === 0
              ? "Están todos sentados. Buen trabajo."
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
                  <div className="mt-0.5 space-y-px pl-5">
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
