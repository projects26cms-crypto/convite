"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Invitado, Regla, TipoRegla } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function PanelReglas({
  invitados,
  reglas,
  asientos,
  incumplidas,
  onCrear,
  onBorrar,
  onIrA,
}: {
  invitados: Invitado[];
  reglas: Regla[];
  asientos: Record<string, string>;
  incumplidas: Set<string>;
  onCrear: (kind: TipoRegla, a: string, b: string) => void;
  onBorrar: (id: string) => void;
  onIrA: (invitadoId: string, mesaId: string | null) => void;
}) {
  const [kind, setKind] = useState<TipoRegla>("separados");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const ordenados = useMemo(
    () =>
      [...invitados].sort((x, y) =>
        x.full_name.localeCompare(y.full_name, "es-ES"),
      ),
    [invitados],
  );
  const porId = useMemo(
    () => new Map(invitados.map((i) => [i.id, i])),
    [invitados],
  );

  const nombre = (id: string) => porId.get(id)?.full_name ?? "—";

  return (
    <div className="border-t border-border bg-card px-4 py-4">
      <p className="text-sm text-muted-foreground">
        Marca quién no puede acabar en la misma mesa, o quién tiene que ir
        junto. El reparto automático las respeta y el lienzo avisa en rojo si te
        las saltas a mano.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-muted-foreground">Regla</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TipoRegla)}
            className="mt-1 h-9 rounded-md border border-input bg-card px-2 text-sm"
          >
            <option value="separados">No sentar juntos</option>
            <option value="juntos">Sentar juntos</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-muted-foreground">Quién</span>
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="mt-1 h-9 w-44 rounded-md border border-input bg-card px-2 text-sm"
          >
            <option value="">Elige…</option>
            {ordenados.map((invitado) => (
              <option key={invitado.id} value={invitado.id}>
                {invitado.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-muted-foreground">Con quién</span>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="mt-1 h-9 w-44 rounded-md border border-input bg-card px-2 text-sm"
          >
            <option value="">Elige…</option>
            {ordenados
              .filter((invitado) => invitado.id !== a)
              .map((invitado) => (
                <option key={invitado.id} value={invitado.id}>
                  {invitado.full_name}
                </option>
              ))}
          </select>
        </label>

        <Button
          size="sm"
          disabled={!a || !b || a === b}
          onClick={() => {
            onCrear(kind, a, b);
            setA("");
            setB("");
          }}
        >
          Añadir regla
        </Button>
      </div>

      {reglas.length > 0 && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {reglas.map((regla) => {
            const mal =
              incumplidas.has(regla.guest_a) || incumplidas.has(regla.guest_b);
            return (
              <li
                key={regla.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-3 py-2 text-sm",
                  mal && "bg-destructive/10",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-xs",
                    regla.kind === "separados"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {regla.kind === "separados" ? "Separados" : "Juntos"}
                </span>

                {[regla.guest_a, regla.guest_b].map((id, i) => (
                  <span key={id} className="flex items-center gap-2">
                    {i === 1 && (
                      <span className="text-muted-foreground">
                        {regla.kind === "separados" ? "y" : "con"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onIrA(id, asientos[id] ?? null)}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      {nombre(id)}
                    </button>
                  </span>
                ))}

                {mal && (
                  <span className="text-xs font-medium text-destructive">
                    · sin cumplir
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onBorrar(regla.id)}
                  aria-label="Borrar la regla"
                  className="ml-auto rounded-sm px-2 text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
