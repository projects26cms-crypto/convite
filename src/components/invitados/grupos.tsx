"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  actualizarGrupo,
  borrarGrupo,
  crearGrupo,
} from "@/lib/acciones/invitados";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones/estado";
import type { Bando, GrupoInvitados } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const COLOR_BANDO: Record<Bando, string> = {
  novia: "bg-novia",
  novio: "bg-novio",
  ambos: "bg-ambos",
};

const BANDOS = [
  ["", "Sin bando"],
  ["novia", "De la novia"],
  ["novio", "Del novio"],
  ["ambos", "De los dos"],
] as const;

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Creando…" : "Crear grupo"}
    </Button>
  );
}

function FilaGrupo({
  grupo,
  cuantos,
  slug,
}: {
  grupo: GrupoInvitados;
  cuantos: number;
  slug: string;
}) {
  const [nombre, setNombre] = useState(grupo.name);
  const [bando, setBando] = useState(grupo.side ?? "");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [guardando, iniciar] = useTransition();

  function guardar(siguienteNombre: string, siguienteBando: string) {
    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", grupo.id);
    datos.set("name", siguienteNombre);
    datos.set("side", siguienteBando);
    iniciar(async () => {
      await actualizarGrupo(datos);
    });
  }

  function borrar() {
    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", grupo.id);
    iniciar(async () => {
      await borrarGrupo(datos);
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0 hover:bg-secondary/50",
        guardando && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          bando ? COLOR_BANDO[bando as Bando] : "bg-border",
        )}
      />

      <input
        value={nombre}
        aria-label="Nombre del grupo"
        onChange={(e) => setNombre(e.target.value)}
        onBlur={(e) => {
          const limpio = e.target.value.trim();
          if (!limpio) {
            setNombre(grupo.name);
            return;
          }
          if (limpio !== grupo.name) guardar(limpio, bando);
        }}
        className="min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 py-1 text-sm focus:bg-card"
      />

      <select
        value={bando}
        aria-label="Bando"
        onChange={(e) => {
          setBando(e.target.value);
          guardar(nombre.trim() || grupo.name, e.target.value);
        }}
        className="rounded-sm bg-transparent px-1 py-1 text-sm text-muted-foreground"
      >
        {BANDOS.map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {cuantos}
      </span>

      {confirmandoBorrado ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={borrar}
            className="rounded-sm px-1.5 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(false)}
            className="rounded-sm px-1.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmandoBorrado(true)}
          aria-label={`Borrar el grupo ${grupo.name}`}
          title="Borrar el grupo (los invitados se quedan sin grupo)"
          className="rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Grupos({
  grupos,
  cuentaPorGrupo,
  slug,
}: {
  grupos: GrupoInvitados[];
  cuentaPorGrupo: Record<string, number>;
  slug: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<EstadoAccion>(ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-baseline justify-between gap-4 border-b border-border pb-2 text-left"
      >
        <span className="font-display text-lg tracking-tight">Grupos</span>
        <span className="text-sm text-muted-foreground">
          {grupos.length === 0
            ? "Ninguno todavía"
            : `${grupos.length} ${grupos.length === 1 ? "grupo" : "grupos"}`}
          {" · "}
          {abierto ? "Ocultar" : "Ver"}
        </span>
      </button>

      {abierto && (
        <div className="mt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Un grupo es una unidad de invitación: una familia, una pareja, una
            cuadrilla. Al sentar en las mesas, el color del bando ayuda a no
            separar a quien va junto.
          </p>

          {grupos.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {grupos.map((grupo) => (
                <FilaGrupo
                  key={grupo.id}
                  grupo={grupo}
                  cuantos={cuentaPorGrupo[grupo.id] ?? 0}
                  slug={slug}
                />
              ))}
            </div>
          )}

          <form
            ref={formulario}
            action={async (formData) => {
              const resultado = await crearGrupo(ESTADO_INICIAL, formData);
              setEstado(resultado);
              if (resultado.ok) formulario.current?.reset();
            }}
            className="mt-4"
          >
            <input type="hidden" name="slug" value={slug} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="name"
                placeholder="Familia Ruiz"
                aria-label="Nombre del grupo nuevo"
                required
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
              />
              <select
                name="side"
                aria-label="Bando"
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {BANDOS.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
              <BotonCrear />
            </div>
            {estado.mensaje && (
              <p
                role="status"
                className={cn(
                  "mt-3 text-sm",
                  estado.ok ? "text-accent-foreground" : "text-destructive",
                )}
              >
                {estado.mensaje}
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
