"use client";

import { MiniaturaModelo } from "@/components/mesas/figura";
import { MODELOS, type ModeloMesa } from "@/lib/modelos";
import { cn } from "@/lib/utils";

function enMetros(cm: number): string {
  return (cm / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function medidasLegibles(modelo: ModeloMesa, capacidad: number): string {
  const { ancho, alto } = modelo.medidas(capacidad);
  return modelo.contorno(capacidad).tipo === "circulo"
    ? `Ø ${enMetros(ancho)} m`
    : `${enMetros(ancho)} × ${enMetros(alto)} m`;
}

export function SelectorModelos({
  elegido,
  onElegir,
}: {
  elegido: string | null;
  onElegir: (modelo: ModeloMesa | null) => void;
}) {
  return (
    <div className="border-t border-border bg-card px-4 py-4">
      <p className="text-sm text-muted-foreground">
        Elige un modelo y luego pulsa en el plano donde quieras ponerlo. Verás
        la mesa en sombra antes de confirmar.
        {elegido && (
          <button
            type="button"
            onClick={() => onElegir(null)}
            className="ml-2 underline underline-offset-4 hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {MODELOS.map((modelo) => {
          const activo = elegido === modelo.id;
          return (
            <li key={modelo.id}>
              <button
                type="button"
                onClick={() => onElegir(activo ? null : modelo)}
                aria-pressed={activo}
                className={cn(
                  "flex w-full flex-col items-stretch gap-1 rounded-lg border p-2 text-left transition-colors",
                  activo
                    ? "border-foreground bg-secondary"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                <span className="block h-20 w-full">
                  <MiniaturaModelo modelo={modelo} />
                </span>
                <span className="truncate text-sm font-medium">
                  {modelo.nombre}
                </span>
                <span className="text-xs text-muted-foreground">
                  {modelo.capacidad === 0
                    ? "De pie"
                    : `${modelo.capacidad} plazas`}
                  {" · "}
                  {medidasLegibles(modelo, modelo.capacidad)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
