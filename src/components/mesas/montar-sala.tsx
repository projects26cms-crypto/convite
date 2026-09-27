"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CAPACIDAD_POR_DEFECTO,
  FORMATOS_PRESIDENCIAL,
  PLANTILLAS,
  PRESIDENCIAL_POR_DEFECTO,
  distribuirSinSolapes,
  esCircular,
  sugerirMesas,
  tamanoMesa,
  type Plantilla,
  type Sala,
} from "@/lib/mesas";
import { cn } from "@/lib/utils";

/**
 * Boceto de cómo quedaría la sala con una plantilla. Sale de la misma función
 * que la monta de verdad, así que lo que se ve es lo que se obtiene.
 */
function BocetoPlantilla({
  plantilla,
  cuantas,
  capacidad,
  enPresidencial,
  separacion,
  sala,
}: {
  plantilla: Plantilla;
  cuantas: number;
  capacidad: number;
  enPresidencial: number;
  separacion: number;
  sala: Sala;
}) {
  const mesas = useMemo(
    () =>
      distribuirSinSolapes(
        plantilla.generar(cuantas, capacidad, enPresidencial, separacion, sala),
        separacion,
        sala,
      ).colocadas,
    [plantilla, cuantas, capacidad, enPresidencial, separacion, sala],
  );

  return (
    <svg
      viewBox={`0 0 ${sala.ancho} ${sala.alto}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Boceto de la sala ${plantilla.nombre.toLowerCase()} con ${mesas.length} mesas`}
    >
      <rect
        width={sala.ancho}
        height={sala.alto}
        rx={30}
        className="fill-card stroke-border"
        strokeWidth={12}
      />
      {mesas.map((mesa, i) => {
        const { ancho, alto } = tamanoMesa(mesa);
        const clase = mesa.is_head
          ? "fill-foreground"
          : "fill-secondary stroke-foreground/50";
        return esCircular(mesa.shape) ? (
          <circle
            key={i}
            cx={mesa.pos_x}
            cy={mesa.pos_y}
            r={ancho / 2}
            className={clase}
            strokeWidth={10}
          />
        ) : (
          <rect
            key={i}
            x={mesa.pos_x - ancho / 2}
            y={mesa.pos_y - alto / 2}
            width={ancho}
            height={alto}
            rx={10}
            className={clase}
            strokeWidth={10}
            transform={`rotate(${mesa.rotation} ${mesa.pos_x} ${mesa.pos_y})`}
          />
        );
      })}
    </svg>
  );
}

/**
 * Elegir cómo se monta la sala: una cuenta ya hecha y tres dibujos. Los números
 * se pueden tocar, pero van plegados: casi nadie necesita cambiarlos.
 */
export function MontarSala({
  aSentar,
  sala,
  separacion,
  hayMesas,
  onMontar,
  columnas = 3,
}: {
  aSentar: number;
  sala: Sala;
  separacion: number;
  hayMesas: boolean;
  onMontar: (
    plantillaId: string,
    cuantas: number,
    capacidad: number,
    enPresidencial: number,
  ) => void;
  columnas?: 1 | 3;
}) {
  const [enPresidencial, setEnPresidencial] = useState(
    PRESIDENCIAL_POR_DEFECTO.plazas,
  );
  const [capacidad, setCapacidad] = useState(CAPACIDAD_POR_DEFECTO);
  const [cuantasAMano, setCuantasAMano] = useState<number | null>(null);
  const [verNumeros, setVerNumeros] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const sugeridas = sugerirMesas(aSentar, capacidad, enPresidencial);
  const cuantas = cuantasAMano ?? sugeridas;
  const formato =
    FORMATOS_PRESIDENCIAL.find((f) => f.plazas === enPresidencial) ??
    PRESIDENCIAL_POR_DEFECTO;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Para <b className="font-medium text-foreground">{aSentar} invitados</b>{" "}
        salen <b className="font-medium text-foreground">{cuantas} mesas de {capacidad}</b>{" "}
        y una presidencial para {formato.nombre.toLowerCase()}.{" "}
        <button
          type="button"
          onClick={() => setVerNumeros((v) => !v)}
          aria-expanded={verNumeros}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {verNumeros ? "Ocultar" : "Cambiar"}
        </button>
      </p>

      {verNumeros && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-secondary/60 p-3">
          <label className="text-sm">
            <span className="block text-muted-foreground">Presidencial</span>
            <select
              value={enPresidencial}
              onChange={(e) => setEnPresidencial(Number(e.target.value))}
              className="mt-1 h-9 rounded-md border border-input bg-card px-2 text-sm"
            >
              {FORMATOS_PRESIDENCIAL.map((f) => (
                <option key={f.plazas} value={f.plazas}>
                  {f.nombre} ({f.plazas})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Mesas</span>
            <input
              type="number"
              min={0}
              max={60}
              value={cuantas}
              onChange={(e) => setCuantasAMano(Number(e.target.value))}
              className="mt-1 h-9 w-20 rounded-md border border-input bg-card px-2 text-sm tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Por mesa</span>
            <input
              type="number"
              min={1}
              max={40}
              value={capacidad}
              onChange={(e) => {
                setCapacidad(Number(e.target.value));
                setCuantasAMano(null);
              }}
              className="mt-1 h-9 w-20 rounded-md border border-input bg-card px-2 text-sm tabular-nums"
            />
          </label>
          {cuantasAMano !== null && cuantasAMano !== sugeridas && (
            <button
              type="button"
              onClick={() => setCuantasAMano(null)}
              className="pb-2 text-sm underline underline-offset-4"
            >
              Volver a {sugeridas}
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          columnas === 3 ? "sm:grid-cols-3" : "grid-cols-1",
        )}
      >
        {PLANTILLAS.map((plantilla) => (
          <div
            key={plantilla.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
          >
            <BocetoPlantilla
              plantilla={plantilla}
              cuantas={cuantas}
              capacidad={capacidad}
              enPresidencial={enPresidencial}
              separacion={separacion}
              sala={sala}
            />
            <div>
              <p className="font-medium">{plantilla.nombre}</p>
              <p className="text-sm text-muted-foreground">
                {plantilla.descripcion}
              </p>
            </div>
            {confirmando === plantilla.id ? (
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onMontar(plantilla.id, cuantas, capacidad, enPresidencial);
                    setConfirmando(null);
                  }}
                >
                  Sí, rehacer la sala
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="text-sm text-muted-foreground"
                >
                  No
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant={hayMesas ? "secondary" : "default"}
                className="mt-auto"
                onClick={() =>
                  hayMesas
                    ? setConfirmando(plantilla.id)
                    : onMontar(plantilla.id, cuantas, capacidad, enPresidencial)
                }
              >
                Montar esta sala
              </Button>
            )}
          </div>
        ))}
      </div>

      {hayMesas && (
        <p className="text-xs text-muted-foreground">
          Rehacer la sala borra las mesas actuales y devuelve a todos a la lista
          de por sentar.
        </p>
      )}
    </div>
  );
}
