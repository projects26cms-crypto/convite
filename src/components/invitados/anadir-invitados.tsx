"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { crearInvitado, importarInvitados } from "@/lib/acciones/invitados";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones/estado";
import { gruposDe, leerPegado } from "@/lib/importar";
import type { GrupoInvitados } from "@/lib/tipos";
import { cn } from "@/lib/utils";

function Aviso({ ok, mensaje }: EstadoAccion) {
  if (!mensaje) return null;
  return (
    <p
      role="status"
      className={cn(
        "mt-3 text-sm",
        ok ? "text-accent-foreground" : "text-destructive",
      )}
    >
      {mensaje}
    </p>
  );
}

function BotonEnviar({
  children,
  esperando,
  ...props
}: React.ComponentProps<typeof Button> & { esperando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? esperando : children}
    </Button>
  );
}

function FormularioUno({
  slug,
  grupos,
}: {
  slug: string;
  grupos: GrupoInvitados[];
}) {
  const [estado, setEstado] = useState<EstadoAccion>(ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulario}
      action={async (formData) => {
        const resultado = await crearInvitado(ESTADO_INICIAL, formData);
        setEstado(resultado);
        if (resultado.ok) formulario.current?.reset();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="full_name"
          placeholder="Nombre y apellidos"
          aria-label="Nombre del invitado"
          required
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
        />
        <select
          name="group_id"
          aria-label="Grupo"
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="">Sin grupo</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="is_child"
            className="size-3.5 accent-[var(--foreground)]"
          />
          Niño
        </label>
        <BotonEnviar esperando="Añadiendo…">Añadir</BotonEnviar>
      </div>
      <Aviso {...estado} />
    </form>
  );
}

function FormularioPegado({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<EstadoAccion>(ESTADO_INICIAL);
  const [pegado, setPegado] = useState("");

  const lectura = useMemo(() => leerPegado(pegado), [pegado]);
  const gruposNuevos = useMemo(
    () => gruposDe(lectura.lineas),
    [lectura.lineas],
  );

  const resumen = [
    gruposNuevos.length > 0 &&
      `${gruposNuevos.length} ${gruposNuevos.length === 1 ? "grupo" : "grupos"}`,
    lectura.repetidos.length > 0 &&
      `${lectura.repetidos.length} ${lectura.repetidos.length === 1 ? "nombre repetido" : "nombres repetidos"}`,
    lectura.ignoradas > 0 && `${lectura.ignoradas} líneas ignoradas`,
  ].filter(Boolean);

  return (
    <form
      action={async (formData) => {
        const resultado = await importarInvitados(ESTADO_INICIAL, formData);
        setEstado(resultado);
        if (resultado.ok) setPegado("");
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="pegado"
        value={pegado}
        onChange={(e) => setPegado(e.target.value)}
        rows={8}
        aria-label="Lista de invitados para pegar"
        placeholder={
          "Marta Ruiz\nJavier Ruiz, Familia Ruiz\nLucía Ortega, Amigos del cole"
        }
        className="w-full rounded-md border border-input bg-card p-3 font-mono text-sm leading-relaxed"
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Un nombre por línea. Si detrás pones una coma y un grupo, lo crea y lo
        asigna solo.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <BotonEnviar
          esperando="Añadiendo…"
          disabled={lectura.lineas.length === 0}
        >
          {lectura.lineas.length > 0
            ? `Añadir ${lectura.lineas.length}`
            : "Añadir"}
        </BotonEnviar>

        {resumen.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {resumen.join(" · ")}
          </span>
        )}
      </div>

      <Aviso {...estado} />
    </form>
  );
}

export function AnadirInvitados({
  slug,
  grupos,
}: {
  slug: string;
  grupos: GrupoInvitados[];
}) {
  const [modo, setModo] = useState<"uno" | "pegar">("uno");

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <div className="mb-4 flex gap-1" role="tablist" aria-label="Cómo añadir">
        {(
          [
            ["uno", "Uno a uno"],
            ["pegar", "Pegar lista"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={modo === valor}
            onClick={() => setModo(valor)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              modo === valor
                ? "bg-secondary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {modo === "uno" ? (
        <FormularioUno slug={slug} grupos={grupos} />
      ) : (
        <FormularioPegado slug={slug} />
      )}
    </section>
  );
}
