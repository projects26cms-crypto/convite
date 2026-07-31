"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { tamanoMesa } from "@/lib/mesas";
import type { Bando, GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const COLOR_BANDO: Record<Bando, string> = {
  novia: "border-l-novia",
  novio: "border-l-novio",
  ambos: "border-l-ambos",
};

export function etiquetaInvitado(invitado: Invitado): string {
  return invitado.is_child ? `${invitado.full_name} · niño` : invitado.full_name;
}

/** Apariencia de la ficha de un invitado, sin nada de arrastre. */
export function CaraChip({
  invitado,
  grupo,
  compacto = false,
  arrastrando = false,
}: {
  invitado: Invitado;
  grupo?: GrupoInvitados;
  compacto?: boolean;
  arrastrando?: boolean;
}) {
  return (
    <span
      className={cn(
        "block truncate rounded-sm border-l-2 bg-card text-left leading-tight",
        compacto ? "px-1.5 py-[3px] text-[11px]" : "px-2 py-1 text-sm",
        grupo?.side ? COLOR_BANDO[grupo.side] : "border-l-border",
        invitado.rsvp_status === "rechazado" && "opacity-50 line-through",
        arrastrando
          ? "shadow-lg ring-1 ring-foreground/20"
          : "hover:bg-secondary",
      )}
      title={grupo ? `${invitado.full_name} · ${grupo.name}` : invitado.full_name}
    >
      {etiquetaInvitado(invitado)}
    </span>
  );
}

export function ChipInvitado({
  invitado,
  grupo,
  desdeMesa,
  compacto = false,
}: {
  invitado: Invitado;
  grupo?: GrupoInvitados;
  desdeMesa: string | null;
  compacto?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inv:${invitado.id}`,
    data: { tipo: "invitado", invitadoId: invitado.id, desdeMesa },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cn(
        "w-full cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <CaraChip invitado={invitado} grupo={grupo} compacto={compacto} />
    </button>
  );
}

const CHIPS_VISIBLES: Record<string, number> = {
  redonda: 6,
  rectangular: 4,
  imperial: 5,
};

export function MesaEnLienzo({
  mesa,
  sentados,
  grupoDe,
  escala,
  resaltada,
  seleccionada,
  alSeleccionar,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  escala: number;
  resaltada: boolean;
  seleccionada: boolean;
  alSeleccionar: () => void;
}) {
  const { ancho, alto } = tamanoMesa(mesa);
  const pasada = sentados.length > mesa.capacity;

  const {
    attributes,
    listeners,
    setNodeRef: anclarArrastre,
    transform,
    isDragging,
  } = useDraggable({
    id: `mesa:${mesa.id}`,
    data: { tipo: "mesa", mesaId: mesa.id },
  });
  const { setNodeRef: anclarSoltar, isOver } = useDroppable({
    id: `drop-mesa:${mesa.id}`,
    data: { tipo: "mesa", mesaId: mesa.id },
  });

  const dx = (transform?.x ?? 0) / escala;
  const dy = (transform?.y ?? 0) / escala;

  const visibles = CHIPS_VISIBLES[mesa.shape] ?? 5;
  const ocultos = sentados.length - visibles;

  return (
    <div
      ref={anclarArrastre}
      style={{
        left: mesa.pos_x - ancho / 2 + dx,
        top: mesa.pos_y - alto / 2 + dy,
        width: ancho,
        height: alto,
        zIndex: isDragging ? 30 : seleccionada ? 20 : 10,
      }}
      className={cn("absolute", isDragging && "cursor-grabbing")}
    >
      <div
        ref={anclarSoltar}
        onClick={alSeleccionar}
        className={cn(
          "flex h-full w-full flex-col items-center overflow-hidden border-2 bg-card p-2",
          mesa.shape === "redonda" ? "rounded-full" : "rounded-lg",
          "border-foreground/70",
          resaltada && "border-novia ring-4 ring-novia/25",
          isOver && "border-foreground ring-4 ring-foreground/25",
          seleccionada && "ring-2 ring-foreground/40",
          pasada && "border-destructive",
          isDragging && "shadow-2xl",
        )}
      >
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Mover ${mesa.name}`}
          className="w-full cursor-grab touch-none px-1 active:cursor-grabbing"
        >
          <span className="block truncate font-display text-[13px] leading-tight">
            {mesa.name}
          </span>
          <span
            className={cn(
              "block text-[11px] tabular-nums",
              pasada ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {sentados.length}/{mesa.capacity}
          </span>
        </button>

        <div className="mt-1 w-full min-h-0 flex-1 space-y-[2px] overflow-hidden px-0.5">
          {sentados.slice(0, visibles).map((invitado) => (
            <ChipInvitado
              key={invitado.id}
              invitado={invitado}
              grupo={grupoDe(invitado)}
              desdeMesa={mesa.id}
              compacto
            />
          ))}
          {ocultos > 0 && (
            <span className="block px-1 text-[10px] text-muted-foreground">
              +{ocultos} más
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
