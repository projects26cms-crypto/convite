"use client";

import { useMemo, useState } from "react";

import {
  Check,
  LoaderCircle,
  Plus,
  Settings2,
  TriangleAlert,
  Undo2,
  Users,
} from "lucide-react";

import { SelectorModelos } from "@/components/mesas/selector-modelos";
import { Button } from "@/components/ui/button";
import type { ModeloMesa } from "@/lib/modelos";
import type { Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** A quién afecta «Sentar por familias», según lo que haya seleccionado. */
export type Alcance = "todos" | "mesa" | "marcados";

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

/** Buscar a cualquiera, esté sentado o no, y volar hasta su mesa. */
function BuscadorGlobal({
  invitados,
  mesas,
  asientos,
  alElegir,
}: {
  invitados: Invitado[];
  mesas: Mesa[];
  asientos: Record<string, string>;
  alElegir: (invitadoId: string, mesaId: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);

  const nombreMesa = useMemo(
    () => new Map(mesas.map((m) => [m.id, m.name])),
    [mesas],
  );

  const resultados = useMemo(() => {
    const aguja = normalizar(texto.trim());
    if (aguja.length < 2) return [];
    return invitados
      .filter((i) => normalizar(i.full_name).includes(aguja))
      .slice(0, 8);
  }, [invitados, texto]);

  return (
    <div className="relative">
      <input
        type="search"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
        placeholder="¿Dónde está…?"
        aria-label="Buscar a cualquier invitado y llevarme a su mesa"
        className="h-8 w-40 rounded-md border border-input bg-card px-2.5 text-sm placeholder:text-muted-foreground/80 sm:w-48"
      />

      {abierto && resultados.length > 0 && (
        <ul className="absolute left-0 top-9 z-40 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {resultados.map((invitado) => {
            const mesaId = asientos[invitado.id] ?? null;
            return (
              <li key={invitado.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    alElegir(invitado.id, mesaId);
                    setTexto("");
                    setAbierto(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{invitado.full_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {mesaId ? (nombreMesa.get(mesaId) ?? "?") : "sin sentar"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function BarraHerramientas({
  todasLasMesas,
  invitados,
  asientos,
  hayPresidencial,
  hayMesas,
  pendientes,
  fallo,
  puedeDeshacer,
  ultimoPaso,
  onDeshacer,
  onAnadir,
  onSentarFamilias,
  onIrA,
  etiquetaReparto,
  modeloElegido,
  onElegirModelo,
  ajustesAbiertos,
  onAjustes,
  avisoAjustes,
}: {
  todasLasMesas: Mesa[];
  invitados: Invitado[];
  asientos: Record<string, string>;
  hayPresidencial: boolean;
  hayMesas: boolean;
  pendientes: number;
  fallo: string | null;
  puedeDeshacer: boolean;
  ultimoPaso: string | null;
  onDeshacer: () => void;
  onAnadir: () => void;
  onSentarFamilias: () => void;
  onIrA: (invitadoId: string, mesaId: string | null) => void;
  etiquetaReparto: string;
  modeloElegido: string | null;
  onElegirModelo: (modelo: ModeloMesa | null) => void;
  ajustesAbiertos: boolean;
  onAjustes: () => void;
  avisoAjustes: boolean;
}) {
  const [verModelos, setVerModelos] = useState(false);

  return (
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Button
          size="sm"
          onClick={() => (hayPresidencial ? setVerModelos((v) => !v) : onAnadir())}
          aria-expanded={verModelos}
          className="gap-1.5"
        >
          <Plus aria-hidden className="size-4" />
          {hayPresidencial ? "Añadir mesa" : "Crear presidencial"}
        </Button>

        {hayMesas && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onSentarFamilias}
            className="gap-1.5"
            title="Reparte por familias y te lo enseña antes de aplicarlo"
          >
            <Users aria-hidden className="size-4" />
            {etiquetaReparto}
          </Button>
        )}

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
          <BuscadorGlobal
            invitados={invitados}
            mesas={todasLasMesas}
            asientos={asientos}
            alElegir={onIrA}
          />

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDeshacer}
            disabled={!puedeDeshacer}
            aria-label={ultimoPaso ? `Deshacer: ${ultimoPaso}` : "Nada que deshacer"}
            title={ultimoPaso ? `Deshacer: ${ultimoPaso} (Ctrl+Z)` : "Nada que deshacer"}
          >
            <Undo2 aria-hidden className="size-4" />
          </Button>

          <Button
            size="sm"
            variant={ajustesAbiertos ? "secondary" : "ghost"}
            onClick={onAjustes}
            aria-expanded={ajustesAbiertos}
            className="relative gap-1.5"
          >
            <Settings2 aria-hidden className="size-4" />
            Ajustes
            {avisoAjustes && (
              <span
                aria-label="Hay reglas sin cumplir"
                className="absolute right-1 top-1 size-2 rounded-full bg-destructive"
              />
            )}
          </Button>

          <span
            className={cn(
              "flex items-center gap-1 whitespace-nowrap pl-1 text-xs",
              fallo ? "text-destructive" : "text-muted-foreground",
            )}
            role="status"
            title={fallo ?? undefined}
          >
            {fallo ? (
              <>
                <TriangleAlert aria-hidden className="size-3.5" />
                No se ha guardado
              </>
            ) : pendientes > 0 ? (
              <>
                <LoaderCircle
                  aria-hidden
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                />
                Guardando
              </>
            ) : (
              <>
                <Check aria-hidden className="size-3.5 text-novia" />
                Guardado
              </>
            )}
          </span>
        </div>
      </div>

      {verModelos && (
        <SelectorModelos
          elegido={modeloElegido}
          onElegir={(modelo) => {
            onElegirModelo(modelo);
            if (modelo) setVerModelos(false);
          }}
        />
      )}
    </div>
  );
}
