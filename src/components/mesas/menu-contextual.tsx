"use client";

import {
  ArrowLeft,
  Ban,
  ChevronRight,
  Copy,
  Eraser,
  HeartHandshake,
  Lock,
  LockOpen,
  PencilLine,
  RotateCw,
  Trash2,
  Undo2,
  Armchair,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { esCircular } from "@/lib/mesas";
import type { Invitado, Mesa, TipoRegla } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export type DestinoMenu =
  | { tipo: "mesa"; id: string }
  | { tipo: "invitado"; id: string };

export type AccionesMenu = {
  renombrar: (mesa: Mesa) => void;
  duplicar: (mesa: Mesa) => void;
  girar: (mesa: Mesa) => void;
  vaciar: (mesa: Mesa) => void;
  bloquear: (mesa: Mesa, bloqueada: boolean) => void;
  borrar: (mesa: Mesa) => void;
  sentar: (invitadoId: string, mesaId: string) => void;
  levantar: (invitadoId: string) => void;
  regla: (kind: TipoRegla, a: string, b: string) => void;
};

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

function Opcion({
  icono: Icono,
  children,
  onClick,
  peligro = false,
  masAlla = false,
}: {
  icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  onClick: () => void;
  peligro?: boolean;
  masAlla?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm",
        peligro
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-secondary",
      )}
    >
      <Icono aria-hidden className="size-4 shrink-0 opacity-70" />
      <span className="flex-1">{children}</span>
      {masAlla && <ChevronRight aria-hidden className="size-4 opacity-50" />}
    </button>
  );
}

/**
 * Menú del botón derecho sobre una mesa o un invitado. Lo que se hace con una
 * cosa aparece encima de esa cosa, sin ir a buscarlo a otro sitio.
 */
export function MenuContextual({
  x,
  y,
  destino,
  mesas,
  invitados,
  asientos,
  ocupacion,
  acciones,
  onCerrar,
}: {
  x: number;
  y: number;
  destino: DestinoMenu;
  mesas: Mesa[];
  invitados: Invitado[];
  asientos: Record<string, string>;
  ocupacion: Map<string, number>;
  acciones: AccionesMenu;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState<
    "inicio" | "mover" | "juntos" | "separados" | "borrar"
  >("inicio");
  const [busqueda, setBusqueda] = useState("");
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: PointerEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) onCerrar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", onCerrar);
    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", onCerrar);
    };
  }, [onCerrar]);

  const mesa = destino.tipo === "mesa" ? mesas.find((m) => m.id === destino.id) : undefined;
  const invitado =
    destino.tipo === "invitado" ? invitados.find((i) => i.id === destino.id) : undefined;

  const candidatos = useMemo(() => {
    if (!invitado) return [];
    const aguja = normalizar(busqueda.trim());
    return invitados
      .filter((i) => i.id !== invitado.id)
      .filter((i) => !aguja || normalizar(i.full_name).includes(aguja))
      .slice(0, 7);
  }, [invitados, invitado, busqueda]);

  const ancho = 248;
  const izquierda = Math.min(x, window.innerWidth - ancho - 8);
  const arriba = Math.min(y, window.innerHeight - 320);

  const cerrarTras = (hacer: () => void) => () => {
    hacer();
    onCerrar();
  };

  let contenido: React.ReactNode = null;

  if (mesa) {
    const sentados = ocupacion.get(mesa.id) ?? 0;
    contenido =
      paso === "borrar" ? (
        <div className="p-2">
          <p className="px-1 text-sm">
            ¿Borrar {mesa.name}?
            {sentados > 0 && (
              <span className="block text-xs text-muted-foreground">
                Sus {sentados} invitados vuelven a la lista.
              </span>
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={cerrarTras(() => acciones.borrar(mesa))}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-white"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setPaso("inicio")}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="truncate px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
            {mesa.name}
          </p>
          <Opcion icono={PencilLine} onClick={cerrarTras(() => acciones.renombrar(mesa))}>
            Cambiar el nombre
          </Opcion>
          {!mesa.is_head && (
            <Opcion icono={Copy} onClick={cerrarTras(() => acciones.duplicar(mesa))}>
              Duplicar
            </Opcion>
          )}
          {!esCircular(mesa.shape) && (
            <Opcion icono={RotateCw} onClick={cerrarTras(() => acciones.girar(mesa))}>
              Girar 15°
            </Opcion>
          )}
          {sentados > 0 && (
            <Opcion icono={Eraser} onClick={cerrarTras(() => acciones.vaciar(mesa))}>
              Vaciar la mesa
            </Opcion>
          )}
          {!mesa.is_head && (
            <Opcion
              icono={mesa.is_locked ? LockOpen : Lock}
              onClick={cerrarTras(() => acciones.bloquear(mesa, !mesa.is_locked))}
            >
              {mesa.is_locked
                ? "Dejar que el reparto la toque"
                : "Que el reparto no la toque"}
            </Opcion>
          )}
          {!mesa.is_head && (
            <>
              <div className="my-1 border-t border-border" />
              <Opcion icono={Trash2} peligro onClick={() => setPaso("borrar")}>
                Borrar la mesa
              </Opcion>
            </>
          )}
        </>
      );
  }

  if (invitado) {
    const mesaActual = asientos[invitado.id];

    if (paso === "inicio") {
      contenido = (
        <>
          <p className="truncate px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
            {invitado.full_name}
          </p>
          <Opcion icono={Armchair} masAlla onClick={() => setPaso("mover")}>
            {mesaActual ? "Cambiar de mesa" : "Sentar en…"}
          </Opcion>
          <Opcion icono={HeartHandshake} masAlla onClick={() => setPaso("juntos")}>
            Sentar junto a…
          </Opcion>
          <Opcion icono={Ban} masAlla onClick={() => setPaso("separados")}>
            No sentar con…
          </Opcion>
          {mesaActual && (
            <Opcion
              icono={Undo2}
              onClick={cerrarTras(() => acciones.levantar(invitado.id))}
            >
              Devolver a la lista
            </Opcion>
          )}
        </>
      );
    } else if (paso === "mover") {
      contenido = (
        <>
          <button
            type="button"
            onClick={() => setPaso("inicio")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-3.5" /> ¿A qué mesa?
          </button>
          <div className="max-h-64 overflow-y-auto">
            {mesas
              .filter((m) => m.id !== mesaActual && m.capacity > 0)
              .map((m) => {
                const libres = m.capacity - (ocupacion.get(m.id) ?? 0);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    onClick={cerrarTras(() => acciones.sentar(invitado.id, m.id))}
                    className="flex w-full items-baseline justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <span className="truncate">{m.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        libres > 0 ? "text-muted-foreground" : "text-destructive",
                      )}
                    >
                      {libres > 0 ? `${libres} libres` : "llena"}
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      );
    } else if (paso === "juntos" || paso === "separados") {
      const kind: TipoRegla = paso;
      contenido = (
        <>
          <button
            type="button"
            onClick={() => {
              setPaso("inicio");
              setBusqueda("");
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            {kind === "juntos" ? "¿Junto a quién?" : "¿Con quién no?"}
          </button>
          <input
            autoFocus
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca por nombre"
            aria-label="Buscar invitado"
            className="mx-1.5 mb-1 h-8 w-[calc(100%-0.75rem)] rounded-md border border-input bg-card px-2 text-sm"
          />
          {candidatos.map((otro) => (
            <button
              key={otro.id}
              type="button"
              role="menuitem"
              onClick={cerrarTras(() => acciones.regla(kind, invitado.id, otro.id))}
              className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
            >
              {otro.full_name}
            </button>
          ))}
          {candidatos.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">Nadie con ese nombre.</p>
          )}
        </>
      );
    }
  }

  if (!contenido) return null;

  return (
    <div
      ref={caja}
      role="menu"
      data-flotante
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="fixed z-50 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      style={{ left: Math.max(8, izquierda), top: Math.max(8, arriba), width: ancho }}
    >
      {contenido}
    </div>
  );
}
