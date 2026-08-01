"use client";

import { useState } from "react";

import { ChipInvitado } from "@/components/mesas/piezas";
import { Button } from "@/components/ui/button";
import { FORMATOS_PRESIDENCIAL } from "@/lib/mesas";
import type { FormaMesa, GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function Inspector({
  mesa,
  sentados,
  grupoDe,
  seleccion,
  onCambiar,
  onLevantar,
  onDuplicar,
  onBorrar,
  onCerrar,
  onPulsarInvitado,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  seleccion: Set<string>;
  onCambiar: (cambios: Partial<Mesa>, persistir?: boolean) => void;
  onLevantar: (invitadoId: string) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  onPulsarInvitado: (id: string, e: React.MouseEvent) => void;
}) {
  const [pestana, setPestana] = useState<"mesa" | "gente">("gente");
  const [confirmando, setConfirmando] = useState(false);
  const pasada = sentados.length > mesa.capacity;
  const redonda = mesa.shape === "redonda";

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-72 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          {mesa.is_head && (
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
              Presidencial
            </p>
          )}
          <input
            value={mesa.name}
            aria-label="Nombre de la mesa"
            onChange={(e) => onCambiar({ name: e.target.value }, false)}
            onBlur={(e) => onCambiar({ name: e.target.value.trim() || "Mesa" })}
            className="w-full rounded-sm bg-transparent font-display text-lg tracking-tight focus:bg-card"
          />
          <p
            className={cn(
              "text-sm tabular-nums",
              pasada ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {sentados.length}/{mesa.capacity} sentados
            {pasada && " · te has pasado"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="rounded-sm px-1.5 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1 border-b border-border px-2 py-1.5" role="tablist">
        {(
          [
            ["gente", `Sentados (${sentados.length})`],
            ["mesa", "La mesa"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              pestana === valor
                ? "bg-secondary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "gente" ? (
        <div className="min-h-24 flex-1 space-y-1 overflow-y-auto p-2">
          {sentados.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Mesa vacía. Arrastra gente aquí, o marca en la lista y haz clic en
              la mesa.
            </p>
          ) : (
            sentados.map((invitado) => (
              <div key={invitado.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ChipInvitado
                    invitado={invitado}
                    grupo={grupoDe(invitado)}
                    desdeMesa={mesa.id}
                    marcado={seleccion.has(invitado.id)}
                    alPulsar={(e) => onPulsarInvitado(invitado.id, e)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onLevantar(invitado.id)}
                  aria-label={`Levantar a ${invitado.full_name}`}
                  title="Devolver a sin sentar"
                  className="rounded-sm px-1.5 py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  ←
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {mesa.is_head && (
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
                  if (formato) {
                    onCambiar({
                      shape: formato.shape,
                      capacity: formato.plazas,
                    });
                  }
                }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {FORMATOS_PRESIDENCIAL.map((formato) => (
                  <option key={formato.plazas} value={formato.plazas}>
                    {formato.nombre} · {formato.pie}
                  </option>
                ))}
                {!FORMATOS_PRESIDENCIAL.some(
                  (f) => f.plazas === mesa.capacity,
                ) && <option value="">A medida ({mesa.capacity})</option>}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-muted-foreground">Forma</span>
            <select
              value={mesa.shape}
              onChange={(e) => onCambiar({ shape: e.target.value as FormaMesa })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="redonda">Redonda</option>
              <option value="rectangular">Rectangular</option>
              <option value="imperial">Imperial</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Plazas</span>
            <input
              type="number"
              min={1}
              max={40}
              value={mesa.capacity}
              onChange={(e) =>
                onCambiar({ capacity: Number(e.target.value) }, false)
              }
              onBlur={(e) =>
                onCambiar({
                  capacity: Math.min(
                    40,
                    Math.max(1, Number(e.target.value) || 1),
                  ),
                })
              }
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm tabular-nums"
            />
          </label>

          <div className="text-sm">
            <span className="text-muted-foreground">Giro</span>
            <div className="mt-1 flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={redonda}
                onClick={() => onCambiar({ rotation: mesa.rotation - 15 })}
                aria-label="Girar a la izquierda"
              >
                ↺
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={redonda}
                onClick={() => onCambiar({ rotation: mesa.rotation + 15 })}
                aria-label="Girar a la derecha"
              >
                ↻
              </Button>
              <span className="ml-1 text-sm tabular-nums text-muted-foreground">
                {redonda ? "Da igual en redonda" : `${mesa.rotation % 360}°`}
              </span>
            </div>
          </div>

          {mesa.is_head && (
            <p className="rounded-md bg-secondary p-2 text-xs leading-relaxed text-muted-foreground">
              Protocolo: los novios en el centro, la novia a la derecha del
              novio. Madrina a la derecha del novio y padrino a la izquierda de
              la novia.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border p-3">
        {mesa.is_head ? (
          <p className="text-xs text-muted-foreground">
            La presidencial no se duplica ni se borra.
          </p>
        ) : confirmando ? (
          <>
            <Button size="sm" variant="destructive" onClick={onBorrar}>
              Borrar mesa
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
              Borrar
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
