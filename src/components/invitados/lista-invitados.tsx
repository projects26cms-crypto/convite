"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { actualizarInvitado, borrarInvitado } from "@/lib/acciones/invitados";
import type { Bando, EstadoRsvp, GrupoInvitados, Invitado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const PUNTO_BANDO: Record<Bando, string> = {
  novia: "bg-novia",
  novio: "bg-novio",
  ambos: "bg-ambos",
};

const ESTADOS: { valor: EstadoRsvp; etiqueta: string; pildora: string }[] = [
  { valor: "pendiente", etiqueta: "Pendiente", pildora: "bg-pendiente/15 text-pendiente" },
  { valor: "confirmado", etiqueta: "Confirmado", pildora: "bg-confirmado/15 text-confirmado" },
  { valor: "rechazado", etiqueta: "No viene", pildora: "bg-rechazado/15 text-rechazado" },
];

type Filtro = "todos" | EstadoRsvp | "ninos" | "sinMesa";

const SIN_GRUPO = "__sin_grupo__";

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

type Campos = {
  full_name: string;
  group_id: string;
  rsvp_status: EstadoRsvp;
  is_child: boolean;
};

/**
 * Una fila se lee de un vistazo y se edita al pulsarla. Los campos van en
 * estado local y se envían construyendo el FormData a mano: con `<form action>`
 * React resetea los campos no controlados y la fila parpadeaba.
 */
function Fila({
  invitado,
  grupos,
  mesa,
  slug,
  abierta,
  alAlternar,
  alCambiar,
  alQuitar,
}: {
  invitado: Invitado;
  grupos: GrupoInvitados[];
  mesa: string | null;
  slug: string;
  abierta: boolean;
  alAlternar: () => void;
  alCambiar: (campos: Campos) => void;
  alQuitar: () => void;
}) {
  const [campos, setCampos] = useState<Campos>({
    full_name: invitado.full_name,
    group_id: invitado.group_id ?? "",
    rsvp_status: invitado.rsvp_status,
    is_child: invitado.is_child,
  });
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [guardando, iniciar] = useTransition();

  const grupo = grupos.find((g) => g.id === campos.group_id);
  const estado = ESTADOS.find((e) => e.valor === campos.rsvp_status) ?? ESTADOS[0];

  function guardar(cambio: Partial<Campos>) {
    const siguiente = { ...campos, ...cambio };
    setCampos(siguiente);
    alCambiar(siguiente);

    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", invitado.id);
    datos.set("full_name", siguiente.full_name);
    datos.set("group_id", siguiente.group_id);
    datos.set("rsvp_status", siguiente.rsvp_status);
    datos.set("is_child", siguiente.is_child ? "on" : "off");

    iniciar(async () => {
      await actualizarInvitado(datos);
    });
  }

  function borrar() {
    const datos = new FormData();
    datos.set("slug", slug);
    datos.set("id", invitado.id);
    alQuitar();
    iniciar(async () => {
      await borrarInvitado(datos);
    });
  }

  return (
    <li
      className={cn(
        "border-b border-border last:border-b-0",
        abierta && "bg-secondary/40",
        guardando && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={alAlternar}
        aria-expanded={abierta}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-secondary/50 sm:grid-cols-[minmax(0,1fr)_10rem_7.5rem_6.5rem_1rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              grupo?.side ? PUNTO_BANDO[grupo.side] : "bg-foreground/20",
            )}
          />
          <span className="truncate text-sm font-medium">{campos.full_name}</span>
          {campos.is_child && (
            <span className="shrink-0 rounded bg-secondary px-1.5 text-[11px] text-muted-foreground">
              niño
            </span>
          )}
        </span>

        <span className="hidden truncate text-sm text-muted-foreground sm:block">
          {grupo?.name ?? "Sin grupo"}
        </span>

        <span
          className={cn(
            "justify-self-start rounded-full px-2 py-0.5 text-xs font-medium",
            estado.pildora,
          )}
        >
          {estado.etiqueta}
        </span>

        <span
          className={cn(
            "hidden truncate text-sm sm:block",
            mesa ? "text-foreground" : "text-muted-foreground/70",
          )}
        >
          {mesa ?? "Sin mesa"}
        </span>

        <ChevronDown
          aria-hidden
          className={cn(
            "hidden size-4 text-muted-foreground transition-transform sm:block motion-reduce:transition-none",
            abierta && "rotate-180",
          )}
        />
      </button>

      {abierta && (
        <div className="grid gap-4 px-3 pb-4 pt-1 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">Nombre</span>
            <input
              value={campos.full_name}
              onChange={(e) =>
                setCampos((previos) => ({ ...previos, full_name: e.target.value }))
              }
              onBlur={(e) => {
                const limpio = e.target.value.trim();
                if (!limpio) {
                  setCampos((previos) => ({ ...previos, full_name: invitado.full_name }));
                  return;
                }
                if (limpio !== invitado.full_name) guardar({ full_name: limpio });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3"
            />
          </label>

          <label className="text-sm">
            <span className="text-muted-foreground">Grupo</span>
            <select
              value={campos.group_id}
              onChange={(e) => guardar({ group_id: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2"
            >
              <option value="">Sin grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <span className="text-muted-foreground">¿Viene?</span>
            <div className="mt-1 flex overflow-hidden rounded-md border border-input" role="group">
              {ESTADOS.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => guardar({ rsvp_status: opcion.valor })}
                  aria-pressed={campos.rsvp_status === opcion.valor}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-sm",
                    campos.rsvp_status === opcion.valor
                      ? "bg-foreground font-medium text-background"
                      : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={campos.is_child}
                onChange={(e) => guardar({ is_child: e.target.checked })}
                className="size-4 accent-[var(--foreground)]"
              />
              Es un niño
            </label>

            {confirmandoBorrado ? (
              <span className="flex items-center gap-2 pb-1.5">
                <button
                  type="button"
                  onClick={borrar}
                  className="rounded-md px-2 py-1 text-destructive hover:bg-destructive/10"
                >
                  Sí, quitar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(false)}
                  className="rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(true)}
                className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Quitar de la lista
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function ListaInvitados({
  invitados,
  grupos,
  mesaDe,
  slug,
}: {
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  /** Nombre de la mesa de cada invitado sentado. */
  mesaDe: Record<string, string>;
  slug: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abierta, setAbierta] = useState<string | null>(null);
  // Cambios hechos aquí que el servidor aún no ha devuelto: los contadores y
  // los filtros los reflejan al instante en vez de ir un paso por detrás.
  const [locales, setLocales] = useState<Record<string, Campos>>({});
  const [quitados, setQuitados] = useState<Set<string>>(new Set());

  const efectivos = useMemo(
    () =>
      invitados
        .filter((i) => !quitados.has(i.id))
        .map((i) => {
          const cambio = locales[i.id];
          return cambio
            ? { ...i, ...cambio, group_id: cambio.group_id || null }
            : i;
        }),
    [invitados, locales, quitados],
  );

  const cifras = useMemo(() => {
    const cuenta = (condicion: (i: Invitado) => boolean) =>
      efectivos.filter(condicion).length;
    return [
      { id: "todos" as const, etiqueta: "En la lista", valor: efectivos.length, punto: null },
      { id: "confirmado" as const, etiqueta: "Confirmados", valor: cuenta((i) => i.rsvp_status === "confirmado"), punto: "bg-confirmado" },
      { id: "pendiente" as const, etiqueta: "Pendientes", valor: cuenta((i) => i.rsvp_status === "pendiente"), punto: "bg-pendiente" },
      { id: "rechazado" as const, etiqueta: "No vienen", valor: cuenta((i) => i.rsvp_status === "rechazado"), punto: "bg-rechazado" },
      { id: "ninos" as const, etiqueta: "Niños", valor: cuenta((i) => i.is_child), punto: null },
      { id: "sinMesa" as const, etiqueta: "Sin mesa", valor: cuenta((i) => !mesaDe[i.id] && i.rsvp_status !== "rechazado"), punto: null },
    ];
  }, [efectivos, mesaDe]);

  const visibles = useMemo(() => {
    const aguja = normalizar(busqueda.trim());

    return efectivos.filter((invitado) => {
      if (filtro === "ninos" && !invitado.is_child) return false;
      if (filtro === "sinMesa" && (mesaDe[invitado.id] || invitado.rsvp_status === "rechazado")) return false;
      if (
        (filtro === "confirmado" || filtro === "pendiente" || filtro === "rechazado") &&
        invitado.rsvp_status !== filtro
      ) {
        return false;
      }
      if (grupoFiltro === SIN_GRUPO && invitado.group_id) return false;
      if (grupoFiltro && grupoFiltro !== SIN_GRUPO && invitado.group_id !== grupoFiltro) {
        return false;
      }
      if (!aguja) return true;
      return normalizar(invitado.full_name).includes(aguja);
    });
  }, [efectivos, busqueda, grupoFiltro, filtro, mesaDe]);

  if (invitados.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
        Aún no hay invitados. Pega tu lista aquí arriba y empieza.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar la lista">
        {cifras.map((cifra) => (
          <button
            key={cifra.id}
            type="button"
            onClick={() => setFiltro(filtro === cifra.id ? "todos" : cifra.id)}
            aria-pressed={filtro === cifra.id}
            className={cn(
              "flex min-w-24 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
              filtro === cifra.id
                ? "border-foreground bg-card"
                : "border-transparent hover:border-border hover:bg-card",
            )}
          >
            <span className="flex items-center gap-1.5 font-display text-2xl leading-none tabular-nums">
              {cifra.punto && (
                <span aria-hidden className={cn("size-2 rounded-full", cifra.punto)} />
              )}
              {cifra.valor}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">{cifra.etiqueta}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 pb-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar invitado por nombre"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:max-w-xs"
        />

        <select
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
          aria-label="Filtrar por grupo"
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="">Todos los grupos</option>
          <option value={SIN_GRUPO}>Sin grupo</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-muted-foreground" aria-live="polite">
          {visibles.length === efectivos.length
            ? `${efectivos.length} invitados`
            : `${visibles.length} de ${efectivos.length}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1fr)_10rem_7.5rem_6.5rem_1rem] gap-x-3 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground sm:grid"
        >
          <span>Nombre</span>
          <span>Grupo</span>
          <span>¿Viene?</span>
          <span>Mesa</span>
          <span />
        </div>
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nadie coincide con ese filtro.
          </p>
        ) : (
          <ul>
            {visibles.map((invitado) => (
              <Fila
                key={invitado.id}
                invitado={invitado}
                grupos={grupos}
                mesa={mesaDe[invitado.id] ?? null}
                slug={slug}
                abierta={abierta === invitado.id}
                alAlternar={() =>
                  setAbierta((previa) => (previa === invitado.id ? null : invitado.id))
                }
                alCambiar={(campos) =>
                  setLocales((previos) => ({ ...previos, [invitado.id]: campos }))
                }
                alQuitar={() =>
                  setQuitados((previos) => new Set(previos).add(invitado.id))
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
