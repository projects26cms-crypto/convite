"use client";

import { useMemo, useState } from "react";

import { PanelReglas } from "@/components/mesas/reglas";
import { SelectorModelos } from "@/components/mesas/selector-modelos";
import { PRESETS_SALA, SALA_MAX, SALA_MIN, type Sala } from "@/lib/mesas";
import type { ModeloMesa } from "@/lib/modelos";
import { Button } from "@/components/ui/button";
import {
  CAPACIDAD_POR_DEFECTO,
  FORMATOS_PRESIDENCIAL,
  PLANTILLAS,
  PRESIDENCIAL_POR_DEFECTO,
  SEPARACIONES,
  sugerirMesas,
  type NivelSeparacion,
} from "@/lib/mesas";
import type { Invitado, Mesa, Regla, TipoRegla } from "@/lib/tipos";
import { cn } from "@/lib/utils";

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
        placeholder="Buscar a alguien"
        aria-label="Buscar a cualquier invitado y llevarme a su mesa"
        className="h-8 w-44 rounded-md border border-input bg-card px-2 text-sm"
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
  mesas,
  todasLasMesas,
  invitados,
  asientos,
  hayPresidencial,
  aSentar,
  escala,
  setEscala,
  onAjustar,
  nivel,
  setNivel,
  verSillas,
  setVerSillas,
  porBando,
  setPorBando,
  pendientes,
  fallo,
  puedeDeshacer,
  ultimoPaso,
  onDeshacer,
  onAnadir,
  onSentarFamilias,
  onPlantilla,
  onIrA,
  reglas,
  incumplidas,
  onCrearRegla,
  onBorrarRegla,
  alcance,
  setAlcance,
  haySeleccion,
  hayMesaElegida,
  modeloElegido,
  onElegirModelo,
  sala,
  presetSala,
  onCambiarSala,
}: {
  mesas: number;
  todasLasMesas: Mesa[];
  invitados: Invitado[];
  asientos: Record<string, string>;
  hayPresidencial: boolean;
  aSentar: number;
  escala: number;
  setEscala: (v: number) => void;
  onAjustar: () => void;
  nivel: NivelSeparacion;
  setNivel: (v: NivelSeparacion) => void;
  verSillas: boolean;
  setVerSillas: (v: boolean) => void;
  porBando: boolean;
  setPorBando: (v: boolean) => void;
  pendientes: number;
  fallo: string | null;
  puedeDeshacer: boolean;
  ultimoPaso: string | null;
  onDeshacer: () => void;
  onAnadir: () => void;
  onSentarFamilias: () => void;
  onPlantilla: (
    id: string,
    cuantas: number,
    capacidad: number,
    enPres: number,
  ) => void;
  onIrA: (invitadoId: string, mesaId: string | null) => void;
  reglas: Regla[];
  incumplidas: Set<string>;
  onCrearRegla: (kind: TipoRegla, a: string, b: string) => void;
  onBorrarRegla: (id: string) => void;
  alcance: Alcance;
  setAlcance: (v: Alcance) => void;
  haySeleccion: boolean;
  hayMesaElegida: boolean;
  modeloElegido: string | null;
  onElegirModelo: (modelo: ModeloMesa | null) => void;
  sala: Sala;
  presetSala: string;
  onCambiarSala: (ancho: number, alto: number, preset: string) => void;
}) {
  const [panel, setPanel] = useState<
    "plantillas" | "sala" | "reglas" | "modelos" | null
  >(null);
  const [capacidad, setCapacidad] = useState(CAPACIDAD_POR_DEFECTO);
  const [enPresidencial, setEnPresidencial] = useState(
    PRESIDENCIAL_POR_DEFECTO.plazas,
  );
  const sugeridas = sugerirMesas(aSentar, capacidad, enPresidencial);
  const [cuantas, setCuantas] = useState(sugeridas);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const alterna = (cual: "plantillas" | "sala" | "reglas" | "modelos") =>
    setPanel((previo) => (previo === cual ? null : cual));

  const sinCumplir = reglas.filter(
    (r) => incumplidas.has(r.guest_a) || incumplidas.has(r.guest_b),
  ).length;

  return (
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button size="sm" onClick={onAnadir}>
          {hayPresidencial ? "Añadir mesa" : "Crear presidencial"}
        </Button>
        <Button
          size="sm"
          variant={panel === "modelos" ? "default" : "secondary"}
          onClick={() => alterna("modelos")}
          aria-expanded={panel === "modelos"}
        >
          Modelos
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => alterna("plantillas")}
          aria-expanded={panel === "plantillas"}
        >
          Plantillas
        </Button>
        <span className="flex items-center overflow-hidden rounded-md border border-input">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-none border-0"
            onClick={onSentarFamilias}
          >
            Sentar por familias
          </Button>
          <select
            value={alcance}
            onChange={(e) => setAlcance(e.target.value as Alcance)}
            aria-label="A quién afecta el reparto"
            className="h-8 border-l border-input bg-card px-1.5 text-xs"
          >
            <option value="todos">a todos los que faltan</option>
            <option value="mesa" disabled={!hayMesaElegida}>
              solo a esta mesa
            </option>
            <option value="marcados" disabled={!haySeleccion}>
              solo a los marcados
            </option>
          </select>
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => alterna("reglas")}
          aria-expanded={panel === "reglas"}
        >
          Reglas
          {reglas.length > 0 && (
            <span
              className={cn(
                "ml-1 rounded-sm px-1 text-xs tabular-nums",
                sinCumplir > 0
                  ? "bg-destructive text-white"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {sinCumplir > 0 ? sinCumplir : reglas.length}
            </span>
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onDeshacer}
          disabled={!puedeDeshacer}
          title={ultimoPaso ? `Deshacer: ${ultimoPaso}` : "Nada que deshacer"}
        >
          Deshacer
        </Button>

        <span className="text-sm text-muted-foreground">
          {mesas} {mesas === 1 ? "mesa" : "mesas"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <BuscadorGlobal
            invitados={invitados}
            mesas={todasLasMesas}
            asientos={asientos}
            alElegir={onIrA}
          />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => alterna("sala")}
            aria-expanded={panel === "sala"}
          >
            Sala
          </Button>

          <span
            className={cn(
              "text-sm",
              fallo
                ? "text-destructive"
                : pendientes > 0
                  ? "text-muted-foreground"
                  : "text-accent-foreground",
            )}
            role="status"
          >
            {fallo ? fallo : pendientes > 0 ? "Guardando…" : "Guardado"}
          </span>
        </div>
      </div>

      {panel === "modelos" && (
        <SelectorModelos elegido={modeloElegido} onElegir={onElegirModelo} />
      )}

      {panel === "reglas" && (
        <PanelReglas
          invitados={invitados}
          reglas={reglas}
          asientos={asientos}
          incumplidas={incumplidas}
          onCrear={onCrearRegla}
          onBorrar={onBorrarRegla}
          onIrA={onIrA}
        />
      )}

      {panel === "sala" && (
        <div className="flex flex-wrap items-end gap-5 border-t border-border bg-card px-4 py-3">
          <div className="text-sm">
            <span className="block text-muted-foreground">Tamaño de la sala</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="flex overflow-hidden rounded-md border border-input">
                {(
                  Object.entries(PRESETS_SALA) as [
                    keyof typeof PRESETS_SALA,
                    (typeof PRESETS_SALA)[keyof typeof PRESETS_SALA],
                  ][]
                ).map(([clave, valor]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => onCambiarSala(valor.ancho, valor.alto, clave)}
                    aria-pressed={presetSala === clave}
                    title={valor.etiqueta}
                    className={cn(
                      "px-2.5 py-1.5 text-xs",
                      presetSala === clave
                        ? "bg-secondary font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {clave}
                  </button>
                ))}
              </span>

              <input
                type="number"
                min={SALA_MIN / 100}
                max={SALA_MAX / 100}
                step={0.5}
                value={sala.ancho / 100}
                aria-label="Ancho de la sala en metros"
                onChange={(e) =>
                  onCambiarSala(Number(e.target.value) * 100, sala.alto, "custom")
                }
                className="h-9 w-20 rounded-md border border-input bg-card px-2 text-sm tabular-nums"
              />
              <span className="text-muted-foreground">×</span>
              <input
                type="number"
                min={SALA_MIN / 100}
                max={SALA_MAX / 100}
                step={0.5}
                value={sala.alto / 100}
                aria-label="Largo de la sala en metros"
                onChange={(e) =>
                  onCambiarSala(sala.ancho, Number(e.target.value) * 100, "custom")
                }
                className="h-9 w-20 rounded-md border border-input bg-card px-2 text-sm tabular-nums"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
          </div>

          <label className="text-sm">
            <span className="block text-muted-foreground">
              Separación entre mesas
            </span>
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value as NivelSeparacion)}
              className="mt-1 h-9 rounded-md border border-input bg-card px-2 text-sm"
            >
              {(
                Object.entries(SEPARACIONES) as [
                  NivelSeparacion,
                  (typeof SEPARACIONES)[NivelSeparacion],
                ][]
              ).map(([clave, valor]) => (
                <option key={clave} value={clave}>
                  {valor.etiqueta} · {valor.pie}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-muted-foreground">Zoom</span>
            <div className="mt-1 flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEscala(escala / 1.25)}
                aria-label="Alejar"
              >
                −
              </Button>
              <span className="w-12 text-center text-sm tabular-nums">
                {Math.round(escala * 100)}%
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEscala(escala * 1.25)}
                aria-label="Acercar"
              >
                +
              </Button>
              <Button size="sm" variant="secondary" onClick={onAjustar}>
                Ajustar
              </Button>
            </div>
          </label>

          <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={verSillas}
              onChange={(e) => setVerSillas(e.target.checked)}
              className="size-3.5 accent-[var(--foreground)]"
            />
            Dibujar las sillas
          </label>

          <p className="pb-2 text-xs text-muted-foreground">
            Arrastra el fondo para moverte · rueda para acercar
          </p>
        </div>
      )}

      {panel === "plantillas" && (
        <div className="border-t border-border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {aSentar} invitados. Con {enPresidencial} en la presidencial y mesas
            de {capacidad}, salen{" "}
            <strong className="font-medium text-foreground">
              {sugeridas} mesas
            </strong>
            .
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block text-muted-foreground">Presidencial</span>
              <select
                value={enPresidencial}
                onChange={(e) => {
                  const valor = Number(e.target.value);
                  setEnPresidencial(valor);
                  setCuantas(sugerirMesas(aSentar, capacidad, valor));
                }}
                className="mt-1 h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {FORMATOS_PRESIDENCIAL.map((formato) => (
                  <option key={formato.plazas} value={formato.plazas}>
                    {formato.nombre} ({formato.plazas})
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
                onChange={(e) => setCuantas(Number(e.target.value))}
                className="mt-1 h-9 w-20 rounded-md border border-input bg-card px-2 tabular-nums"
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
                  const valor = Number(e.target.value);
                  setCapacidad(valor);
                  setCuantas(sugerirMesas(aSentar, valor, enPresidencial));
                }}
                className="mt-1 h-9 w-20 rounded-md border border-input bg-card px-2 tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={() => setCuantas(sugeridas)}
              className="pb-2 text-sm underline underline-offset-4 hover:text-foreground"
            >
              Usar la sugerencia
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={porBando}
              onChange={(e) => setPorBando(e.target.checked)}
              className="size-3.5 accent-[var(--foreground)]"
            />
            Al sentar por familias, separar los bandos a cada lado de la
            presidencial (tradición hoy en desuso)
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {PLANTILLAS.map((plantilla) => (
              <div
                key={plantilla.id}
                className="rounded-lg border border-border p-3"
              >
                <p className="font-medium">{plantilla.nombre}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {plantilla.descripcion}
                </p>
                {confirmando === plantilla.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        onPlantilla(
                          plantilla.id,
                          cuantas,
                          capacidad,
                          enPresidencial,
                        );
                        setConfirmando(null);
                        setPanel(null);
                      }}
                    >
                      Reemplazar
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
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      if (mesas > 0 || hayPresidencial)
                        setConfirmando(plantilla.id);
                      else {
                        onPlantilla(
                          plantilla.id,
                          cuantas,
                          capacidad,
                          enPresidencial,
                        );
                        setPanel(null);
                      }
                    }}
                  >
                    Montar sala
                  </Button>
                )}
              </div>
            ))}
          </div>

          {(mesas > 0 || hayPresidencial) && (
            <p className="mt-3 text-sm text-muted-foreground">
              Montar una plantilla borra las mesas actuales, devuelve a todos a
              la lista de sin sentar y vacía el historial de deshacer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
