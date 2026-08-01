"use client";

import {
  SILLA_FUERA,
  SILLA_RADIO,
  figurasDe,
  sillasDe,
  type ModeloMesa,
} from "@/lib/modelos";
import { cn } from "@/lib/utils";

/**
 * El tablero de una mesa, dibujado a partir del catálogo.
 *
 * Lo usan el plano y las miniaturas del selector sin diferencias: una sola
 * geometría, así que no pueden acabar enseñando cosas distintas.
 */
export function FiguraMesa({
  modelo,
  capacidad,
  className,
  grosor = 5,
  strokeDasharray,
}: {
  modelo: ModeloMesa;
  capacidad: number;
  className?: string;
  grosor?: number;
  strokeDasharray?: string;
}) {
  return (
    <>
      {figurasDe(modelo, capacidad).map((figura, i) => {
        if (figura.tipo === "circulo") {
          return (
            <circle
              key={i}
              cx={figura.cx}
              cy={figura.cy}
              r={figura.r}
              strokeWidth={grosor}
              strokeDasharray={strokeDasharray}
              className={className}
            />
          );
        }
        if (figura.tipo === "camino") {
          return (
            <path
              key={i}
              d={figura.d}
              strokeWidth={grosor}
              strokeDasharray={strokeDasharray}
              className={className}
            />
          );
        }
        return (
          <rect
            key={i}
            x={figura.x}
            y={figura.y}
            width={figura.ancho}
            height={figura.alto}
            rx={8}
            strokeWidth={grosor}
            strokeDasharray={strokeDasharray}
            className={className}
          />
        );
      })}
    </>
  );
}

export function SillasFigura({
  modelo,
  capacidad,
  ocupadas = 0,
}: {
  modelo: ModeloMesa;
  capacidad: number;
  ocupadas?: number;
}) {
  return (
    <>
      {sillasDe(modelo, capacidad).map((silla, i) => (
        <circle
          key={i}
          cx={silla.x}
          cy={silla.y}
          r={SILLA_RADIO}
          className={
            i < ocupadas
              ? "fill-foreground/60 stroke-foreground/60"
              : "fill-card stroke-foreground/30"
          }
          strokeWidth={3}
        />
      ))}
    </>
  );
}

/** Miniatura para el selector. Mismo dibujo que el plano, a otro tamaño. */
export function MiniaturaModelo({
  modelo,
  capacidad,
  className,
}: {
  modelo: ModeloMesa;
  capacidad?: number;
  className?: string;
}) {
  const plazas = capacidad ?? modelo.capacidad;
  const { ancho, alto } = modelo.medidas(plazas);
  const margen = SILLA_FUERA + SILLA_RADIO + 6;

  return (
    <svg
      viewBox={`${-margen} ${-margen} ${ancho + margen * 2} ${alto + margen * 2}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`${modelo.nombre}, ${plazas} plazas`}
      preserveAspectRatio="xMidYMid meet"
    >
      <SillasFigura modelo={modelo} capacidad={plazas} />
      <FiguraMesa
        modelo={modelo}
        capacidad={plazas}
        className="fill-card stroke-foreground/70"
      />
    </svg>
  );
}
