"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { FiguraMesa, SillasFigura } from "@/components/mesas/figura";
import { tamanoMesa } from "@/lib/mesas";
import { modeloEquivalente, modeloPorId } from "@/lib/modelos";
import type { Bando, GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const PUNTO_BANDO: Record<Bando, string> = {
  novia: "bg-novia",
  novio: "bg-novio",
  ambos: "bg-ambos",
};

/** Color de la silla ocupada, por el bando de quien se sienta. */
const SILLA_BANDO: Record<Bando, string> = {
  novia: "fill-novia stroke-novia",
  novio: "fill-novio stroke-novio",
  ambos: "fill-ambos stroke-ambos",
};
const SILLA_SIN_BANDO = "fill-foreground/45 stroke-foreground/45";
const SILLA_LIBRE = "fill-card stroke-foreground/20";

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
        "flex min-w-0 items-center rounded-md text-left leading-tight transition-colors",
        compacto ? "gap-1 px-1 py-[2px] text-[11px]" : "gap-2 px-2 py-1.5 text-[13px]",
        marcado
          ? "bg-foreground text-background"
          : "bg-card text-foreground hover:bg-secondary",
        invitado.rsvp_status === "rechazado" && "opacity-50 line-through",
        enConflicto && "ring-1 ring-destructive",
        arrastrando && "shadow-lg ring-1 ring-foreground/15",
      )}
      title={
        grupo ? `${invitado.full_name} · ${grupo.name}` : invitado.full_name
      }
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 rounded-full",
          compacto ? "size-1.5" : "size-2",
          grupo?.side ? PUNTO_BANDO[grupo.side] : "bg-foreground/25",
        )}
      />
      <span className="truncate">{etiquetaInvitado(invitado)}</span>
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
        "block w-full cursor-grab touch-none rounded-md active:cursor-grabbing",
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

/** Ocupantes ordenados por familia: sus sillas quedan juntas en el dibujo. */
export function ordenarPorFamilia(
  sentados: Invitado[],
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined,
): Invitado[] {
  return [...sentados].sort((a, b) => {
    const ga = grupoDe(a)?.name ?? "￿";
    const gb = grupoDe(b)?.name ?? "￿";
    return (
      ga.localeCompare(gb, "es-ES") ||
      a.full_name.localeCompare(b.full_name, "es-ES")
    );
  });
}

/** Tamaño mínimo en pantalla para que cada cosa se lea. En píxeles. */
const LEGIBLE = { rotulo: 58, cifra: 38, nombres: 0.8 };

export function MesaEnLienzo({
  mesa,
  sentados,
  grupoDe,
  escala,
  escalaVisual,
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
  alEntrar,
  alSalir,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  /** Zoom del lienzo: píxeles por centímetro. */
  escala: number;
  /** Inflado de presentación. No altera ninguna posición. */
  escalaVisual: number;
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
  alEntrar?: (e: React.PointerEvent) => void;
  alSalir?: () => void;
}) {
  const { ancho, alto } = tamanoMesa(mesa);
  const pasada = sentados.length > mesa.capacity;
  const llena = mesa.capacity > 0 && sentados.length === mesa.capacity;
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

  // Píxeles de pantalla por unidad local de la mesa. Los rótulos se dividen por
  // esto para salir siempre al mismo tamaño, se mire con el zoom que se mire.
  const pxPorUnidad = escala * escalaVisual;
  const enPantalla = Math.min(ancho, alto) * pxPorUnidad;
  const px = (tamano: number) => tamano / pxPorUnidad;

  const verRotulo = Math.max(ancho, alto) * pxPorUnidad >= LEGIBLE.rotulo;
  const verCifra = enPantalla >= LEGIBLE.cifra;
  const verNombres = pxPorUnidad >= LEGIBLE.nombres && sentados.length > 0;

  const ordenados = ordenarPorFamilia(sentados, grupoDe);
  const colores = Array.from({ length: mesa.capacity }, (_, i) => {
    const invitado = ordenados[i];
    if (!invitado) return SILLA_LIBRE;
    const bando = grupoDe(invitado)?.side;
    return bando ? SILLA_BANDO[bando] : SILLA_SIN_BANDO;
  });

  const visibles = Math.max(0, Math.floor((alto * 0.62) / 17));
  const ocultos = ordenados.length - visibles;
  const oscura = mesa.is_head;

  return (
    <div
      ref={anclarArrastre}
      style={{
        left: mesa.pos_x - ancho / 2 + dx,
        top: mesa.pos_y - alto / 2 + dy,
        width: ancho,
        height: alto,
        transform: `rotate(${mesa.rotation}deg) scale(${escalaVisual})`,
        zIndex: isDragging ? 30 : seleccionada ? 24 : mesa.is_head ? 22 : 10,
      }}
      className={cn(
        "absolute transition-transform duration-150 motion-reduce:transition-none",
        isDragging && "cursor-grabbing",
      )}
      onPointerEnter={alEntrar}
      onPointerLeave={alSalir}
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
          {(resaltada || isOver || seleccionada) && (
            <FiguraMesa
              modelo={modelo}
              capacidad={mesa.capacity}
              grosor={px(10)}
              className={cn(
                "fill-none",
                isOver
                  ? "stroke-foreground/30"
                  : resaltada
                    ? "stroke-novia/40"
                    : "stroke-foreground/20",
              )}
            />
          )}
          {mostrarSillas && (
            <SillasFigura
              modelo={modelo}
              capacidad={mesa.capacity}
              colores={colores}
            />
          )}
          <FiguraMesa
            modelo={modelo}
            capacidad={mesa.capacity}
            grosor={px(oscura ? 2 : 1.5)}
            strokeDasharray={fijada ? `${px(5)} ${px(4)}` : undefined}
            className={cn(
              oscura ? "fill-foreground" : "fill-card",
              "stroke-foreground/45 [filter:drop-shadow(0_1px_1.5px_rgb(0_0_0/0.12))]",
              resaltada && "stroke-novia",
              (isOver || seleccionada) && "stroke-foreground",
              (pasada || conConflicto || fuera) && "stroke-destructive",
            )}
          />
        </svg>

        <div
          className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
          style={{
            transform: mesa.rotation
              ? `rotate(${-mesa.rotation}deg)`
              : undefined,
            padding: px(4),
          }}
        >
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Mover ${mesa.name}`}
            className={cn(
              "flex max-w-full cursor-grab touch-none flex-col items-center leading-tight active:cursor-grabbing",
              oscura ? "text-background" : "text-foreground",
            )}
          >
            {verRotulo && (
              <span
                className="block max-w-full truncate font-display"
                style={{ fontSize: px(mesa.is_head ? 14 : 13) }}
              >
                {fijada ? "📌 " : ""}
                {mesa.name}
              </span>
            )}
            {verCifra && (
              <span
                className={cn(
                  "block font-medium tabular-nums",
                  pasada
                    ? "text-destructive"
                    : oscura
                      ? "text-background/70"
                      : llena
                        ? "text-novia"
                        : "text-muted-foreground",
                )}
                style={{ fontSize: px(11) }}
              >
                {mesa.capacity === 0
                  ? "de pie"
                  : `${sentados.length}${fantasma ? ` + ${fantasma}` : ""}/${mesa.capacity}`}
              </span>
            )}
          </button>

          {verNombres && visibles > 0 && (
            <div
              className="mt-1 w-full min-h-0 space-y-[2px] overflow-hidden"
              style={{ maxWidth: ancho * 0.78 }}
            >
              {ordenados.slice(0, visibles).map((invitado) => (
                <ChipInvitado
                  key={invitado.id}
                  invitado={invitado}
                  grupo={grupoDe(invitado)}
                  desdeMesa={mesa.id}
                  compacto
                />
              ))}
              {ocultos > 0 && (
                <span className="block text-center text-[10px] text-muted-foreground">
                  y {ocultos} más
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
