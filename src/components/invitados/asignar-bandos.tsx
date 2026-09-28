"use client";

import { useState, useTransition } from "react";

import { actualizarGrupo } from "@/lib/acciones/invitados";
import type { Bando, GrupoInvitados } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const OPCIONES: { valor: Bando; etiqueta: string; punto: string }[] = [
  { valor: "novia", etiqueta: "Novia", punto: "bg-novia" },
  { valor: "novio", etiqueta: "Novio", punto: "bg-novio" },
  { valor: "ambos", etiqueta: "De los dos", punto: "bg-ambos" },
];

/**
 * Pregunta de quién es cada grupo que aún no lo dice. Sale sola tras pegar una
 * lista: sin bando, las sillas del plano no se pueden colorear.
 */
export function AsignarBandos({
  grupos,
  cuentaPorGrupo,
  slug,
}: {
  grupos: GrupoInvitados[];
  cuentaPorGrupo: Record<string, number>;
  slug: string;
}) {
  const [elegidos, setElegidos] = useState<Record<string, Bando>>({});
  const [, iniciar] = useTransition();

  const pendientes = grupos.filter((g) => !g.side && !elegidos[g.id]);
  if (pendientes.length === 0) return null;

  function elegir(grupo: GrupoInvitados, bando: Bando) {
    setElegidos((previos) => ({ ...previos, [grupo.id]: bando }));
    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", grupo.id);
    datos.set("side", bando);
    iniciar(async () => {
      await actualizarGrupo(datos);
    });
  }

  return (
    <section
      aria-labelledby="titulo-bandos"
      className="rounded-xl border border-pendiente/40 bg-card p-5"
    >
      <h2 id="titulo-bandos" className="font-display text-lg tracking-tight">
        ¿De quién es cada grupo?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pendientes.length === 1
          ? "Falta 1 grupo."
          : `Faltan ${pendientes.length} grupos.`}{" "}
        Con esto el plano pinta cada silla con el color de su bando.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {pendientes.slice(0, 8).map((grupo) => (
          <li
            key={grupo.id}
            className="flex flex-wrap items-center justify-between gap-3 py-2"
          >
            <span className="min-w-0">
              <span className="font-medium">{grupo.name}</span>{" "}
              <span className="text-sm text-muted-foreground">
                · {cuentaPorGrupo[grupo.id] ?? 0}
              </span>
            </span>
            <span className="flex gap-1.5" role="group" aria-label={`Bando de ${grupo.name}`}>
              {OPCIONES.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => elegir(grupo, opcion.valor)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm",
                    "hover:border-foreground hover:bg-secondary",
                  )}
                >
                  <span aria-hidden className={cn("size-2 rounded-full", opcion.punto)} />
                  {opcion.etiqueta}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {pendientes.length > 8 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Y {pendientes.length - 8} más cuando acabes con estos.
        </p>
      )}
    </section>
  );
}
