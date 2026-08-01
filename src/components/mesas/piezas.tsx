"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { tamanoMesa } from "@/lib/mesas";
import { FiguraMesa, SillasFigura } from "@/components/mesas/figura";
import { modeloEquivalente, modeloPorId } from "@/lib/modelos";
import type { Bando, GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const COLOR_BANDO: Record<Bando, string> = {
  novia: "border-l-novia",
  novio: "border-l-novio",
  ambos: "border-l-ambos",
};

export const PUNTO_BANDO: Record<Bando, string> = {
  novia: "bg-novia",
  novio: "bg-novio",
  ambos: "bg-ambos",
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
  marcado = false,
  enConflicto = false,
}: {
  invitado: Invitado;
  grupo?: GrupoInvitados;
  compacto?: boolean;
  arrastrando?: boolean;
  marcado?: boolean;
  enConflicto?: boolean;
}) {
  return (
    <span
      className={cn(
        "block truncate rounded-sm border-l-2 text-left leading-tight",
        compacto ? "px-1.5 py-[3px] text-[11px]" : "px-2 py-1 text-sm",
        grupo?.side ? COLOR_BANDO[grupo.side] : "border-l-border",
        marcado ? "bg-foreground text-background" : "bg-card",
        invitado.rsvp_status === "rechazado" && "opacity-50 line-through",
        enConflicto && "ring-1 ring-destructive",
        arrastrando
          ? "shadow-lg ring-1 ring-foreground/20"
          : !marcado && "hover:bg-secondary",
      )}
      title={
        grupo ? `${invitado.full_name} · ${grupo.name}` : invitado.full_name
      }
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
  marcado = false,
  enConflicto = false,
  alPulsar,
}: {
  invitado: Invitado;
  grupo?: GrupoInvitados;
  desdeMesa: string | null;
  compacto?: boolean;
  marcado?: boolean;
  enConflicto?: boolean;
  alPulsar?: (e: React.MouseEvent) => void;
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
      onClick={(e) => {
        e.stopPropagation();
        alPulsar?.(e);
      }}
      className={cn(
        "w-full cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <CaraChip
        invitado={invitado}
        grupo={grupo}
        compacto={compacto}
        marcado={marcado}
        enConflicto={enConflicto}
      />
    </button>
  );
}

const CHIPS_VISIBLES: Record<string, number> = {
  redonda: 6,
  rectangular: 3,
  imperial: 4,
};

export function MesaEnLienzo({
  mesa,
  sentados,
  grupoDe,
  escala,
  halo,
  mostrarHalo,
  mostrarSillas,
  resaltada,
  seleccionada,
  fijada,
  fuera,
  conConflicto,
  fantasma,
  alPulsar,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  escala: number;
  halo: number;
  mostrarHalo: boolean;
  mostrarSillas: boolean;
  resaltada: boolean;
  seleccionada: boolean;
  fijada?: boolean;
  fuera?: boolean;
  conConflicto?: boolean;
  fantasma?: number;
  alPulsar: (e: React.MouseEvent) => void;
}) {
  const { ancho, alto } = tamanoMesa(mesa);
  const pasada = sentados.length > mesa.capacity;
  const modelo =
    modeloPorId(mesa.template_id) ??
    modeloEquivalente(mesa.shape, mesa.capacity, mesa.is_head);

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

  const visibles = CHIPS_VISIBLES[mesa.shape] ?? 4;
  const ocultos = sentados.length - visibles;

  return (
    <div
      ref={anclarArrastre}
      style={{
        left: mesa.pos_x - ancho / 2 + dx,
        top: mesa.pos_y - alto / 2 + dy,
        width: ancho,
        height: alto,
        transform: mesa.rotation ? `rotate(${mesa.rotation}deg)` : undefined,
        zIndex: isDragging ? 30 : mesa.is_head ? 22 : seleccionada ? 20 : 10,
      }}
      className={cn("absolute", isDragging && "cursor-grabbing")}
    >
      <div
        ref={anclarSoltar}
        onClick={alPulsar}
        className="relative h-full w-full"
      >
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          width={ancho}
          height={alto}
          className="absolute inset-0 overflow-visible"
          aria-hidden
        >
          {/* Zona de sillas y paso: dos halos que se tocan son la separación mínima. */}
          {mostrarHalo && (
            <FiguraMesa
              modelo={modelo}
              capacidad={mesa.capacity}
              grosor={halo * 2}
              className="fill-none stroke-foreground/10"
            />
          )}
          {(resaltada || isOver) && (
            <FiguraMesa
              modelo={modelo}
              capacidad={mesa.capacity}
              grosor={44}
              className={cn(
                "fill-none",
                isOver ? "stroke-foreground/25" : "stroke-novia/30",
              )}
            />
          )}
          {mostrarSillas && (
            <SillasFigura
              modelo={modelo}
              capacidad={mesa.capacity}
              ocupadas={sentados.length}
            />
          )}
          <FiguraMesa
            modelo={modelo}
            capacidad={mesa.capacity}
            grosor={mesa.is_head ? 10 : 6}
            strokeDasharray={fijada ? "26 18" : undefined}
            className={cn(
              mesa.is_head ? "fill-accent" : "fill-card",
              "stroke-foreground/70",
              resaltada && "stroke-novia",
              isOver && "stroke-foreground",
              seleccionada && "stroke-foreground",
              (pasada || conConflicto || fuera) && "stroke-destructive",
            )}
          />
        </svg>

        <div className="relative flex h-full w-full flex-col items-center overflow-hidden p-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Mover ${mesa.name}`}
          style={{
            transform: mesa.rotation
              ? `rotate(${-mesa.rotation}deg)`
              : undefined,
          }}
          className="w-full cursor-grab touch-none px-1 active:cursor-grabbing"
        >
          <span
            className={cn(
              "block truncate font-display leading-tight",
              mesa.is_head ? "text-[15px] font-medium" : "text-[13px]",
            )}
          >
            {fijada ? `📌 ${mesa.name}` : mesa.name}
          </span>
          <span
            className={cn(
              "block text-[11px] tabular-nums",
              pasada ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {sentados.length}
            {fantasma ? `+${fantasma}` : ""}/{mesa.capacity}
          </span>
        </button>

        <div className="mt-1 min-h-0 w-full flex-1 space-y-[2px] overflow-hidden px-0.5">
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
    </div>
  );
}
