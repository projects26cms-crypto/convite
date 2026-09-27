"use client";

import { ChevronRight, X } from "lucide-react";

import { MontarSala } from "@/components/mesas/montar-sala";
import { PanelReglas } from "@/components/mesas/reglas";
import {
  PRESETS_SALA,
  SALA_MAX,
  SALA_MIN,
  SEPARACIONES,
  type NivelSeparacion,
  type Sala,
} from "@/lib/mesas";
import type { Invitado, Regla, TipoRegla } from "@/lib/tipos";
import { ESCALA_VISUAL_MAX, ESCALA_VISUAL_MIN } from "@/lib/vista";
import { cn } from "@/lib/utils";

function Seccion({
  titulo,
  resumen,
  abierta = false,
  aviso = false,
  children,
}: {
  titulo: string;
  resumen?: string;
  abierta?: boolean;
  aviso?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={abierta}
      className="group border-b border-border [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-secondary/50">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="flex-1 text-sm font-medium">{titulo}</span>
        {resumen && (
          <span
            className={cn(
              "truncate text-xs",
              aviso ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {resumen}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/**
 * Lo que se configura una vez o casi nunca. Fuera de la barra para que lo
 * diario se vea a la primera.
 */
export function Ajustes({
  onCerrar,
  sala,
  presetSala,
  onCambiarSala,
  aSentar,
  separacion,
  hayMesas,
  onMontar,
  invitados,
  reglas,
  asientos,
  incumplidas,
  onCrearRegla,
  onBorrarRegla,
  onIrA,
  nivel,
  setNivel,
  porBando,
  setPorBando,
  verRechazados,
  setVerRechazados,
  verSillas,
  setVerSillas,
  modoEscala,
  escalaElegida,
  onEscala,
}: {
  onCerrar: () => void;
  sala: Sala;
  presetSala: string;
  onCambiarSala: (ancho: number, alto: number, preset: string) => void;
  aSentar: number;
  separacion: number;
  hayMesas: boolean;
  onMontar: (id: string, cuantas: number, capacidad: number, enPres: number) => void;
  invitados: Invitado[];
  reglas: Regla[];
  asientos: Record<string, string>;
  incumplidas: Set<string>;
  onCrearRegla: (kind: TipoRegla, a: string, b: string) => void;
  onBorrarRegla: (id: string) => void;
  onIrA: (invitadoId: string, mesaId: string | null) => void;
  nivel: NivelSeparacion;
  setNivel: (v: NivelSeparacion) => void;
  porBando: boolean;
  setPorBando: (v: boolean) => void;
  verRechazados: boolean;
  setVerRechazados: (v: boolean) => void;
  verSillas: boolean;
  setVerSillas: (v: boolean) => void;
  modoEscala: string;
  escalaElegida: number;
  onEscala: (valor: string) => void;
}) {
  const sinCumplir = reglas.filter(
    (r) => incumplidas.has(r.guest_a) || incumplidas.has(r.guest_b),
  ).length;

  const resumenReglas =
    sinCumplir > 0
      ? `${sinCumplir} sin cumplir`
      : reglas.length === 0
        ? "Ninguna"
        : `${reglas.length} ${reglas.length === 1 ? "regla" : "reglas"}`;

  return (
    <aside
      aria-label="Ajustes avanzados"
      className="flex w-full shrink-0 flex-col border-t border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-96 lg:border-l lg:border-t-0"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="font-display text-lg leading-none">Ajustes</p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar los ajustes"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Seccion
          titulo="Tamaño de la sala"
          resumen={`${(sala.ancho / 100).toLocaleString("es-ES")} × ${(sala.alto / 100).toLocaleString("es-ES")} m`}
        >
          <div className="flex flex-wrap items-center gap-2">
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
                    "px-3 py-1.5 text-sm",
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
              id="sala-ancho"
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
              id="sala-alto"
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
          <p className="mt-2 text-xs text-muted-foreground">
            S · 10 × 8 m · M · 15 × 12 m · L · 22 × 16 m. Al reducirla no se
            mueve ninguna mesa: se marcan las que quedan fuera.
          </p>
        </Seccion>

        <Seccion
          titulo="Rehacer la sala"
          resumen={hayMesas ? "Con una plantilla" : "Aún no hay mesas"}
        >
          <MontarSala
            aSentar={aSentar}
            sala={sala}
            separacion={separacion}
            hayMesas={hayMesas}
            onMontar={onMontar}
            columnas={1}
          />
        </Seccion>

        <Seccion
          titulo="Quién va con quién"
          resumen={resumenReglas}
          aviso={sinCumplir > 0}
          abierta={sinCumplir > 0}
        >
          <PanelReglas
            invitados={invitados}
            reglas={reglas}
            asientos={asientos}
            incumplidas={incumplidas}
            onCrear={onCrearRegla}
            onBorrar={onBorrarRegla}
            onIrA={onIrA}
            className="border-0 bg-transparent p-0"
          />
        </Seccion>

        <Seccion titulo="Al sentar automáticamente">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={porBando}
              onChange={(e) => setPorBando(e.target.checked)}
              className="mt-0.5 size-3.5 accent-[var(--foreground)]"
            />
            <span>
              Separar los bandos a cada lado de la presidencial
              <span className="block text-xs text-muted-foreground">
                La tradición, hoy en desuso: invitados de la novia a su
                derecha y del novio a la izquierda.
              </span>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={verRechazados}
              onChange={(e) => setVerRechazados(e.target.checked)}
              className="mt-0.5 size-3.5 accent-[var(--foreground)]"
            />
            <span>
              Enseñar en la lista a quien ha dicho que no viene
              <span className="block text-xs text-muted-foreground">
                Nunca se sientan solos: el reparto automático los ignora.
              </span>
            </span>
          </label>
        </Seccion>

        <Seccion
          titulo="Separación entre mesas"
          resumen={SEPARACIONES[nivel].pie}
        >
          <div className="grid gap-2">
            {(
              Object.entries(SEPARACIONES) as [
                NivelSeparacion,
                (typeof SEPARACIONES)[NivelSeparacion],
              ][]
            ).map(([clave, valor]) => (
              <label
                key={clave}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                  nivel === clave
                    ? "border-foreground bg-card"
                    : "border-border hover:bg-secondary/50",
                )}
              >
                <input
                  type="radio"
                  name="separacion"
                  checked={nivel === clave}
                  onChange={() => setNivel(clave)}
                  className="accent-[var(--foreground)]"
                />
                <span className="font-medium">{valor.etiqueta}</span>
                <span className="text-muted-foreground">{valor.pie}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Espacio libre entre los bordes de dos mesas. El protocolo pide 1,50
            m: sillas retiradas y paso para los camareros.
          </p>
        </Seccion>

        <Seccion titulo="Cómo se ve el plano">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={verSillas}
              onChange={(e) => setVerSillas(e.target.checked)}
              className="size-3.5 accent-[var(--foreground)]"
            />
            Dibujar las sillas
          </label>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="escala-mesas" className="text-sm">
                Tamaño de las mesas en pantalla
              </label>
              <button
                type="button"
                onClick={() => onEscala("auto")}
                aria-pressed={modoEscala === "auto"}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs",
                  modoEscala === "auto"
                    ? "bg-secondary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Automático
              </button>
            </div>
            <input
              id="escala-mesas"
              type="range"
              min={ESCALA_VISUAL_MIN}
              max={ESCALA_VISUAL_MAX}
              step={0.05}
              value={escalaElegida}
              onChange={(e) => onEscala(e.target.value)}
              aria-valuetext={`${Math.round(escalaElegida * 100)} % del tamaño real`}
              className="mt-2 w-full accent-[var(--foreground)]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Solo cambia el dibujo, nunca dónde está cada mesa. En automático
              crecen lo que pueden sin llegar a tocarse.
            </p>
          </div>
        </Seccion>
      </div>
    </aside>
  );
}
