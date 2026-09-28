"use client";

import { ChevronRight, Minus, Plus, RotateCcw, RotateCw, X } from "lucide-react";
import { useState } from "react";

import { ChipInvitado } from "@/components/mesas/piezas";
import { Button } from "@/components/ui/button";
import { FORMATOS_PRESIDENCIAL, esCircular } from "@/lib/mesas";
import { MODELOS, modeloEquivalente, modeloPorId } from "@/lib/modelos";
import type { GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Plazas que admite la mesa: las del modelo, o de 2 a 12 en la presidencial. */
export function rangoDePlazas(mesa: Mesa): [number, number] {
  if (mesa.is_head) return [2, 12];
  const modelo =
    modeloPorId(mesa.template_id) ??
    modeloEquivalente(mesa.shape, mesa.capacity, false);
  return [modelo.minimo, modelo.maximo];
}

export function Inspector({
  mesa,
  sentados,
  grupoDe,
  seleccion,
  onCambiar,
  onLevantar,
  onVaciar,
  onFijar,
  onDuplicar,
  onBorrar,
  onCerrar,
  onPulsarInvitado,
  onMenuInvitado,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  seleccion: Set<string>;
  onCambiar: (cambios: Partial<Mesa>, persistir?: boolean) => void;
  onLevantar: (invitadoId: string) => void;
  onVaciar: () => void;
  onFijar: (fijada: boolean) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  onPulsarInvitado: (id: string, e: React.MouseEvent) => void;
  onMenuInvitado?: (id: string, e: React.MouseEvent) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const libres = mesa.capacity - sentados.length;
  const circular = esCircular(mesa.shape);
  const [minimo, maximo] = rangoDePlazas(mesa);
  const modelo =
    modeloPorId(mesa.template_id) ??
    modeloEquivalente(mesa.shape, mesa.capacity, mesa.is_head);

  const estado =
    mesa.capacity === 0
      ? "Mesa de cóctel, de pie"
      : libres > 0
        ? `${sentados.length} sentados · ${libres} ${libres === 1 ? "libre" : "libres"}`
        : libres === 0
          ? "Completa"
          : `Te has pasado en ${-libres}`;

  return (
    <aside
      aria-label={`Mesa ${mesa.name}`}
      className="flex w-full shrink-0 flex-col border-t border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-80 lg:border-l lg:border-t-0"
    >
      <div className="border-b border-border p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {mesa.is_head && (
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Presidencial
              </p>
            )}
            <input
              value={mesa.name}
              aria-label="Nombre de la mesa"
              onChange={(e) => onCambiar({ name: e.target.value }, false)}
              onBlur={(e) => onCambiar({ name: e.target.value.trim() || "Mesa" })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="-ml-1 w-full rounded-sm bg-transparent px-1 font-display text-xl tracking-tight hover:bg-card focus:bg-card"
            />
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {mesa.capacity > 0 || maximo > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center rounded-md border border-input bg-card">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onCambiar({ capacity: Math.max(minimo, mesa.capacity - 1) })}
                disabled={mesa.capacity <= minimo}
                aria-label="Una plaza menos"
              >
                <Minus aria-hidden className="size-4" />
              </Button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {mesa.capacity}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onCambiar({ capacity: Math.min(maximo, mesa.capacity + 1) })}
                disabled={mesa.capacity >= maximo}
                aria-label="Una plaza más"
                title={
                  mesa.capacity >= maximo
                    ? "Para más plazas, cambia el modelo en Más opciones"
                    : undefined
                }
              >
                <Plus aria-hidden className="size-4" />
              </Button>
            </div>
            <p
              className={cn(
                "text-sm",
                libres < 0 ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {estado}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{estado}</p>
        )}

        {mesa.capacity > 0 && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full",
                libres < 0 ? "bg-destructive" : "bg-novia",
              )}
              style={{
                width: `${Math.min(100, (sentados.length / mesa.capacity) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="min-h-24 flex-1 overflow-y-auto p-2">
        {sentados.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Mesa vacía. Arrastra aquí a alguien de la lista, o márcalo y pulsa
            la mesa.
          </p>
        ) : (
          <>
            <ul className="space-y-px">
              {sentados.map((invitado) => (
                <li key={invitado.id} className="group flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ChipInvitado
                      invitado={invitado}
                      grupo={grupoDe(invitado)}
                      desdeMesa={mesa.id}
                      marcado={seleccion.has(invitado.id)}
                      alPulsar={(e) => onPulsarInvitado(invitado.id, e)}
                      alMenu={
                        onMenuInvitado
                          ? (e) => onMenuInvitado(invitado.id, e)
                          : undefined
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onLevantar(invitado.id)}
                    aria-label={`Levantar a ${invitado.full_name}`}
                    title="Devolver a la lista"
                    className="rounded px-1.5 py-1 text-muted-foreground opacity-60 hover:text-foreground group-hover:opacity-100"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onVaciar}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Vaciar la mesa
            </button>
          </>
        )}
      </div>

      <details className="group border-t border-border [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm hover:bg-secondary/50">
          <ChevronRight
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          Más opciones
        </summary>

        <div className="space-y-4 px-4 pb-4">
          {mesa.is_head ? (
            <label className="block text-sm">
              <span className="text-muted-foreground">Quién se sienta</span>
              <select
                value={
                  FORMATOS_PRESIDENCIAL.find((f) => f.plazas === mesa.capacity)
                    ?.plazas ?? ""
                }
                onChange={(e) => {
                  const formato = FORMATOS_PRESIDENCIAL.find(
                    (f) => f.plazas === Number(e.target.value),
                  );
                  if (formato) onCambiar({ capacity: formato.plazas });
                }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {FORMATOS_PRESIDENCIAL.map((f) => (
                  <option key={f.plazas} value={f.plazas}>
                    {f.nombre} · {f.pie}
                  </option>
                ))}
                {!FORMATOS_PRESIDENCIAL.some((f) => f.plazas === mesa.capacity) && (
                  <option value="">A medida ({mesa.capacity})</option>
                )}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-muted-foreground">Modelo</span>
              <select
                value={modelo.id}
                onChange={(e) => {
                  const nuevo = modeloPorId(e.target.value);
                  if (!nuevo) return;
                  // «Redonda 12» trae sus 12 plazas: es lo que dice el nombre.
                  onCambiar({
                    template_id: nuevo.id,
                    shape: nuevo.shape,
                    capacity: nuevo.capacidad,
                  });
                }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {MODELOS.filter((m) => m.id !== "presidencial").map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!circular && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Girar</span>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => onCambiar({ rotation: mesa.rotation - 15 })}
                aria-label="Girar a la izquierda"
              >
                <RotateCcw aria-hidden className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => onCambiar({ rotation: mesa.rotation + 15 })}
                aria-label="Girar a la derecha"
              >
                <RotateCw aria-hidden className="size-4" />
              </Button>
              <span className="tabular-nums text-muted-foreground">
                {((mesa.rotation % 360) + 360) % 360}°
              </span>
            </div>
          )}

          {!mesa.is_head && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={mesa.is_locked}
                onChange={(e) => onFijar(e.target.checked)}
                className="mt-0.5 size-3.5 accent-[var(--foreground)]"
              />
              <span>
                Que el reparto automático no la toque
                <span className="block text-xs text-muted-foreground">
                  Útil cuando ya la tienes como quieres.
                </span>
              </span>
            </label>
          )}

          {mesa.is_head && (
            <p className="rounded-md bg-secondary p-2 text-xs leading-relaxed text-muted-foreground">
              Protocolo: los novios en el centro, la novia a la derecha del
              novio. Madrina a la derecha del novio y padrino a la izquierda de
              la novia.
            </p>
          )}

          {!mesa.is_head && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {confirmando ? (
                <>
                  <Button size="sm" variant="destructive" onClick={onBorrar}>
                    Sí, borrar la mesa
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="text-sm text-muted-foreground"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={onDuplicar}>
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmando(true)}
                  >
                    Borrar la mesa
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </details>
    </aside>
  );
}
