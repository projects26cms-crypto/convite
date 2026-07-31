"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CaraChip, ChipInvitado } from "@/components/mesas/piezas";
import { MesaEnLienzo } from "@/components/mesas/piezas";
import {
  actualizarMesa,
  borrarMesa,
  borrarTodasLasMesas,
  crearMesas,
  levantar,
  moverMesa,
  sentar,
} from "@/lib/acciones/mesas";
import {
  CAPACIDAD_POR_DEFECTO,
  LIENZO,
  PLANTILLAS,
  ajustarARejilla,
  encajarEnLienzo,
  sugerirMesas,
  type MesaNueva,
} from "@/lib/mesas";
import type {
  Asignacion,
  FormaMesa,
  GrupoInvitados,
  Invitado,
  Mesa,
} from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ESCALAS = [0.5, 0.75, 1] as const;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

export function Planificador({
  slug,
  invitados,
  grupos,
  mesasIniciales,
  asignacionesIniciales,
}: {
  slug: string;
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  mesasIniciales: Mesa[];
  asignacionesIniciales: Asignacion[];
}) {
  const [mesas, setMesas] = useState<Mesa[]>(mesasIniciales);
  const [asientos, setAsientos] = useState<Record<string, string>>(() =>
    Object.fromEntries(asignacionesIniciales.map((a) => [a.guest_id, a.table_id])),
  );

  const [pendientes, setPendientes] = useState(0);
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [verRechazados, setVerRechazados] = useState(false);
  const [escala, setEscala] = useState<number>(0.75);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [arrastrado, setArrastrado] = useState<Invitado | null>(null);
  const [mesasResaltadas, setMesasResaltadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const lienzoRef = useRef<HTMLDivElement>(null);

  const guardar = useCallback((tarea: () => Promise<void>) => {
    setPendientes((n) => n + 1);
    iniciar(async () => {
      try {
        await tarea();
        setFallo(null);
      } catch (e) {
        setFallo(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setPendientes((n) => n - 1);
      }
    });
  }, []);

  const porId = useMemo(
    () => new Map(invitados.map((i) => [i.id, i])),
    [invitados],
  );
  const gruposPorId = useMemo(
    () => new Map(grupos.map((g) => [g.id, g])),
    [grupos],
  );
  const grupoDe = useCallback(
    (invitado: Invitado) =>
      invitado.group_id ? gruposPorId.get(invitado.group_id) : undefined,
    [gruposPorId],
  );

  const sentadosPorMesa = useMemo(() => {
    const mapa = new Map<string, Invitado[]>();
    for (const mesa of mesas) mapa.set(mesa.id, []);
    for (const [invitadoId, mesaId] of Object.entries(asientos)) {
      const invitado = porId.get(invitadoId);
      if (invitado) mapa.get(mesaId)?.push(invitado);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.full_name.localeCompare(b.full_name, "es-ES"));
    }
    return mapa;
  }, [mesas, asientos, porId]);

  const sinSentar = useMemo(
    () => invitados.filter((i) => !asientos[i.id]),
    [invitados, asientos],
  );

  const visiblesEnPanel = useMemo(() => {
    const aguja = normalizar(busqueda.trim());
    return sinSentar.filter((invitado) => {
      if (!verRechazados && invitado.rsvp_status === "rechazado") return false;
      if (grupoFiltro && invitado.group_id !== grupoFiltro) return false;
      if (!aguja) return true;
      return normalizar(invitado.full_name).includes(aguja);
    });
  }, [sinSentar, busqueda, grupoFiltro, verRechazados]);

  const aSentar = useMemo(
    () => invitados.filter((i) => i.rsvp_status !== "rechazado").length,
    [invitados],
  );

  // ------------------------------------------------------------------ arrastre

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function alEmpezar(evento: DragStartEvent) {
    const datos = evento.active.data.current;
    if (datos?.tipo !== "invitado") return;

    const invitado = porId.get(datos.invitadoId as string);
    if (!invitado) return;
    setArrastrado(invitado);

    // Resalta las mesas donde ya hay gente de su mismo grupo: es la ayuda real.
    if (!invitado.group_id) return;
    const conFamilia = new Set<string>();
    for (const [otroId, mesaId] of Object.entries(asientos)) {
      if (porId.get(otroId)?.group_id === invitado.group_id) {
        conFamilia.add(mesaId);
      }
    }
    setMesasResaltadas(conFamilia);
  }

  function alTerminar(evento: DragEndEvent) {
    setArrastrado(null);
    setMesasResaltadas(new Set());

    const datos = evento.active.data.current;
    if (!datos) return;

    if (datos.tipo === "mesa") {
      const mesaId = datos.mesaId as string;
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;

      const { x, y } = encajarEnLienzo(
        mesa,
        ajustarARejilla(mesa.pos_x + evento.delta.x / escala),
        ajustarARejilla(mesa.pos_y + evento.delta.y / escala),
      );
      if (x === mesa.pos_x && y === mesa.pos_y) return;

      setMesas((previas) =>
        previas.map((m) => (m.id === mesaId ? { ...m, pos_x: x, pos_y: y } : m)),
      );
      guardar(() => moverMesa(slug, mesaId, x, y));
      return;
    }

    if (datos.tipo !== "invitado") return;

    const invitadoId = datos.invitadoId as string;
    const destino = evento.over?.data.current;

    if (destino?.tipo === "mesa") {
      const mesaId = destino.mesaId as string;
      if (asientos[invitadoId] === mesaId) return;
      setAsientos((previos) => ({ ...previos, [invitadoId]: mesaId }));
      guardar(() => sentar(slug, invitadoId, mesaId));
      return;
    }

    if (destino?.tipo === "panel" && asientos[invitadoId]) {
      setAsientos((previos) => {
        const copia = { ...previos };
        delete copia[invitadoId];
        return copia;
      });
      guardar(() => levantar(slug, invitadoId));
    }
  }

  // -------------------------------------------------------------------- mesas

  function anadirMesas(nuevas: MesaNueva[]) {
    if (nuevas.length === 0) return;
    guardar(async () => {
      const creadas = await crearMesas(slug, nuevas);
      setMesas((previas) => [...previas, ...creadas]);
    });
  }

  function anadirUna() {
    const n = mesas.length;
    anadirMesas([
      {
        name: `Mesa ${n + 1}`,
        shape: "redonda",
        capacity: CAPACIDAD_POR_DEFECTO,
        pos_x: 260 + (n % 5) * 240,
        pos_y: 220 + Math.floor(n / 5) * 240,
        rotation: 0,
      },
    ]);
  }

  function aplicarPlantilla(plantillaId: string, cuantas: number, cap: number) {
    const plantilla = PLANTILLAS.find((p) => p.id === plantillaId);
    if (!plantilla) return;
    const nuevas = plantilla.generar(cuantas, cap);

    guardar(async () => {
      if (mesas.length > 0) {
        await borrarTodasLasMesas(slug);
        setMesas([]);
        setAsientos({});
        setSeleccionada(null);
      }
      const creadas = await crearMesas(slug, nuevas);
      setMesas(creadas);
    });
  }

  /**
   * Escribir en un campo de texto no debe mandar una consulta por tecla: el
   * lienzo se actualiza al momento y el guardado espera a que sueltes el campo.
   */
  function cambiarMesa(
    mesaId: string,
    cambios: Partial<Mesa>,
    persistir = true,
  ) {
    setMesas((previas) =>
      previas.map((m) => (m.id === mesaId ? { ...m, ...cambios } : m)),
    );
    if (!persistir) return;
    guardar(() =>
      actualizarMesa(slug, mesaId, {
        name: cambios.name,
        shape: cambios.shape,
        capacity: cambios.capacity,
      }),
    );
  }

  function quitarMesa(mesaId: string) {
    const sentados = sentadosPorMesa.get(mesaId) ?? [];
    setMesas((previas) => previas.filter((m) => m.id !== mesaId));
    setAsientos((previos) => {
      const copia = { ...previos };
      for (const invitado of sentados) delete copia[invitado.id];
      return copia;
    });
    setSeleccionada(null);
    guardar(() => borrarMesa(slug, mesaId));
  }

  function levantarA(invitadoId: string) {
    setAsientos((previos) => {
      const copia = { ...previos };
      delete copia[invitadoId];
      return copia;
    });
    guardar(() => levantar(slug, invitadoId));
  }

  const mesaSeleccionada = mesas.find((m) => m.id === seleccionada) ?? null;

  return (
    <DndContext
      // Fijo a propósito: sin él, dnd-kit numera los identificadores de
      // accesibilidad distinto en servidor y en navegador, y React avisa de
      // discrepancia de hidratación.
      id="planificador-mesas"
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={alEmpezar}
      onDragEnd={alTerminar}
      onDragCancel={() => {
        setArrastrado(null);
        setMesasResaltadas(new Set());
      }}
    >
      <div className="flex flex-1 flex-col lg:flex-row">
        <PanelSinSentar
          invitados={visiblesEnPanel}
          totalSinSentar={sinSentar.length}
          aSentar={aSentar}
          grupos={grupos}
          grupoDe={grupoDe}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          grupoFiltro={grupoFiltro}
          setGrupoFiltro={setGrupoFiltro}
          verRechazados={verRechazados}
          setVerRechazados={setVerRechazados}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <BarraHerramientas
            mesas={mesas.length}
            aSentar={aSentar}
            escala={escala}
            setEscala={setEscala}
            pendientes={pendientes}
            fallo={fallo}
            onAnadir={anadirUna}
            onPlantilla={aplicarPlantilla}
            hayMesas={mesas.length > 0}
          />

          <div
            ref={lienzoRef}
            className="relative flex-1 overflow-auto bg-canvas"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSeleccionada(null);
            }}
          >
            <div
              style={{
                width: LIENZO.ancho * escala,
                height: LIENZO.alto * escala,
              }}
            >
              <div
                style={{
                  width: LIENZO.ancho,
                  height: LIENZO.alto,
                  transform: `scale(${escala})`,
                  transformOrigin: "top left",
                  backgroundSize: "50px 50px",
                  backgroundImage:
                    "linear-gradient(to right, var(--canvas-line) 1px, transparent 1px), linear-gradient(to bottom, var(--canvas-line) 1px, transparent 1px)",
                }}
                className="relative"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSeleccionada(null);
                }}
              >
                {mesas.map((mesa) => (
                  <MesaEnLienzo
                    key={mesa.id}
                    mesa={mesa}
                    sentados={sentadosPorMesa.get(mesa.id) ?? []}
                    grupoDe={grupoDe}
                    escala={escala}
                    resaltada={mesasResaltadas.has(mesa.id)}
                    seleccionada={seleccionada === mesa.id}
                    alSeleccionar={() => setSeleccionada(mesa.id)}
                  />
                ))}
              </div>
            </div>

            {mesas.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <p className="max-w-sm text-center text-muted-foreground">
                  Aún no hay mesas. Elige una plantilla ahí arriba y te monto la
                  sala entera de una vez.
                </p>
              </div>
            )}
          </div>
        </div>

        {mesaSeleccionada && (
          <Inspector
            mesa={mesaSeleccionada}
            sentados={sentadosPorMesa.get(mesaSeleccionada.id) ?? []}
            grupoDe={grupoDe}
            confirmando={confirmando === mesaSeleccionada.id}
            setConfirmando={(v) =>
              setConfirmando(v ? mesaSeleccionada.id : null)
            }
            onCambiar={(cambios, persistir) =>
              cambiarMesa(mesaSeleccionada.id, cambios, persistir)
            }
            onLevantar={levantarA}
            onBorrar={() => quitarMesa(mesaSeleccionada.id)}
            onCerrar={() => setSeleccionada(null)}
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {arrastrado ? (
          <div className="w-44">
            <CaraChip
              invitado={arrastrado}
              grupo={grupoDe(arrastrado)}
              arrastrando
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------

function PanelSinSentar({
  invitados,
  totalSinSentar,
  aSentar,
  grupos,
  grupoDe,
  busqueda,
  setBusqueda,
  grupoFiltro,
  setGrupoFiltro,
  verRechazados,
  setVerRechazados,
}: {
  invitados: Invitado[];
  totalSinSentar: number;
  aSentar: number;
  grupos: GrupoInvitados[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  busqueda: string;
  setBusqueda: (v: string) => void;
  grupoFiltro: string;
  setGrupoFiltro: (v: string) => void;
  verRechazados: boolean;
  setVerRechazados: (v: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop-panel",
    data: { tipo: "panel" },
  });

  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "flex w-full shrink-0 flex-col border-b border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-72 lg:border-b-0 lg:border-r",
        isOver && "bg-accent/40",
      )}
    >
      <div className="border-b border-border p-3">
        <p className="font-display text-lg leading-none tracking-tight">
          Sin sentar
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalSinSentar} de {aSentar} por colocar
        </p>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar"
          aria-label="Buscar invitado sin sentar"
          className="mt-3 h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
        />
        <select
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
          aria-label="Filtrar por grupo"
          className="mt-2 h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="">Todos los grupos</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.name}
            </option>
          ))}
        </select>
        <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={verRechazados}
            onChange={(e) => setVerRechazados(e.target.checked)}
            className="size-3 accent-[var(--foreground)]"
          />
          Mostrar a quien no viene
        </label>
      </div>

      <div className="min-h-24 flex-1 space-y-1 overflow-y-auto p-2">
        {invitados.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {totalSinSentar === 0
              ? "Están todos sentados."
              : "Nadie coincide con ese filtro."}
          </p>
        ) : (
          invitados.map((invitado) => (
            <ChipInvitado
              key={invitado.id}
              invitado={invitado}
              grupo={grupoDe(invitado)}
              desdeMesa={null}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function BarraHerramientas({
  mesas,
  aSentar,
  escala,
  setEscala,
  pendientes,
  fallo,
  onAnadir,
  onPlantilla,
  hayMesas,
}: {
  mesas: number;
  aSentar: number;
  escala: number;
  setEscala: (v: number) => void;
  pendientes: number;
  fallo: string | null;
  onAnadir: () => void;
  onPlantilla: (id: string, cuantas: number, capacidad: number) => void;
  hayMesas: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [capacidad, setCapacidad] = useState(CAPACIDAD_POR_DEFECTO);
  const sugeridas = sugerirMesas(aSentar, capacidad);
  const [cuantas, setCuantas] = useState(sugeridas);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  return (
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button size="sm" onClick={onAnadir}>
          Añadir mesa
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          Plantillas
        </Button>

        <span className="text-sm text-muted-foreground">
          {mesas} {mesas === 1 ? "mesa" : "mesas"}
        </span>

        <div className="ml-auto flex items-center gap-2">
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

          <div className="flex overflow-hidden rounded-md border border-input">
            {ESCALAS.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setEscala(valor)}
                aria-pressed={escala === valor}
                className={cn(
                  "px-2 py-1 text-xs tabular-nums",
                  escala === valor
                    ? "bg-secondary font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {Math.round(valor * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Con {aSentar} invitados y mesas de {capacidad}, salen{" "}
            <strong className="font-medium text-foreground">
              {sugeridas} mesas
            </strong>
            .
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block text-muted-foreground">Mesas</span>
              <input
                type="number"
                min={1}
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
                  setCuantas(sugerirMesas(aSentar, valor));
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
                        onPlantilla(plantilla.id, cuantas, capacidad);
                        setConfirmando(null);
                        setAbierto(false);
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
                      if (hayMesas) setConfirmando(plantilla.id);
                      else {
                        onPlantilla(plantilla.id, cuantas, capacidad);
                        setAbierto(false);
                      }
                    }}
                  >
                    Montar sala
                  </Button>
                )}
              </div>
            ))}
          </div>

          {hayMesas && (
            <p className="mt-3 text-sm text-muted-foreground">
              Montar una plantilla borra las mesas actuales y devuelve a todos a
              la lista de sin sentar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Inspector({
  mesa,
  sentados,
  grupoDe,
  confirmando,
  setConfirmando,
  onCambiar,
  onLevantar,
  onBorrar,
  onCerrar,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  confirmando: boolean;
  setConfirmando: (v: boolean) => void;
  onCambiar: (cambios: Partial<Mesa>, persistir?: boolean) => void;
  onLevantar: (invitadoId: string) => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const pasada = sentados.length > mesa.capacity;

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border bg-sidebar lg:h-[calc(100dvh-3.5rem)] lg:w-72 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <input
          value={mesa.name}
          aria-label="Nombre de la mesa"
          onChange={(e) => onCambiar({ name: e.target.value }, false)}
          onBlur={(e) => {
            const limpio = e.target.value.trim();
            onCambiar({ name: limpio || "Mesa" });
          }}
          className="min-w-0 flex-1 rounded-sm bg-transparent font-display text-lg tracking-tight focus:bg-card"
        />
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="rounded-sm px-1.5 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 border-b border-border p-3">
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
            onChange={(e) => onCambiar({ capacity: Number(e.target.value) }, false)}
            onBlur={(e) => {
              const plazas = Math.min(40, Math.max(1, Number(e.target.value) || 1));
              onCambiar({ capacity: plazas });
            }}
            className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm tabular-nums"
          />
        </label>

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

      <div className="min-h-24 flex-1 space-y-1 overflow-y-auto p-2">
        {sentados.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            Mesa vacía. Arrastra gente aquí.
          </p>
        ) : (
          sentados.map((invitado) => (
            <div key={invitado.id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <ChipInvitado
                  invitado={invitado}
                  grupo={grupoDe(invitado)}
                  desdeMesa={mesa.id}
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

      <div className="border-t border-border p-3">
        {confirmando ? (
          <div className="flex items-center gap-2">
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
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmando(true)}
          >
            Borrar mesa
          </Button>
        )}
      </div>
    </aside>
  );
}
