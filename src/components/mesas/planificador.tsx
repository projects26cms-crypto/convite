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
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CaraChip, ChipInvitado, MesaEnLienzo } from "@/components/mesas/piezas";
import {
  actualizarMesa,
  borrarMesa,
  borrarTodasLasMesas,
  crearMesas,
  levantar,
  moverMesa,
  sentarEnBloque,
} from "@/lib/acciones/mesas";
import { repartir } from "@/lib/autosentar";
import {
  CAPACIDAD_POR_DEFECTO,
  FORMATOS_PRESIDENCIAL,
  PLANTILLAS,
  PRESIDENCIAL_POR_DEFECTO,
  SALA,
  SEPARACIONES,
  buscarHueco,
  resolverPosicion,
  sugerirMesas,
  type MesaNueva,
  type NivelSeparacion,
} from "@/lib/mesas";
import type {
  Asignacion,
  FormaMesa,
  GrupoInvitados,
  Invitado,
  Mesa,
} from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ESCALAS = [0.3, 0.45, 0.6] as const;
const MAX_DESHACER = 50;

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLocaleLowerCase("es-ES");
}

type Paso = { etiqueta: string; deshacer: () => void };

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
    Object.fromEntries(
      asignacionesIniciales.map((a) => [a.guest_id, a.table_id]),
    ),
  );

  const [pendientes, setPendientes] = useState(0);
  const [fallo, setFallo] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const [pila, setPila] = useState<Paso[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [verRechazados, setVerRechazados] = useState(false);
  const [escala, setEscala] = useState<number>(0.45);
  const [nivel, setNivel] = useState<NivelSeparacion>("holgado");
  const [porBando, setPorBando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [arrastrado, setArrastrado] = useState<Invitado | null>(null);
  const [moviendoMesa, setMoviendoMesa] = useState(false);
  const [mesasResaltadas, setMesasResaltadas] = useState<Set<string>>(new Set());

  const separacion = SEPARACIONES[nivel].cm;

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

  const registrar = useCallback((paso: Paso) => {
    setPila((previa) => [...previa.slice(-(MAX_DESHACER - 1)), paso]);
  }, []);

  const deshacer = useCallback(() => {
    setPila((previa) => {
      const ultimo = previa[previa.length - 1];
      if (ultimo) queueMicrotask(ultimo.deshacer);
      return previa.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        deshacer();
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [deshacer]);

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

  const presidencial = mesas.find((m) => m.is_head) ?? null;

  // ------------------------------------------------------- sentar y levantar

  const sentarA = useCallback(
    (invitadoId: string, mesaId: string, conDeshacer = true) => {
      const anterior = asientos[invitadoId] ?? null;
      if (anterior === mesaId) return;

      setAsientos((previos) => ({ ...previos, [invitadoId]: mesaId }));
      guardar(() => sentarEnBloque(slug, [{ invitadoId, mesaId }]));

      if (!conDeshacer) return;
      const nombre = porId.get(invitadoId)?.full_name ?? "el invitado";
      registrar({
        etiqueta: `Sentar a ${nombre}`,
        deshacer: () => {
          if (anterior) {
            setAsientos((p) => ({ ...p, [invitadoId]: anterior }));
            guardar(() => sentarEnBloque(slug, [{ invitadoId, mesaId: anterior }]));
          } else {
            setAsientos((p) => {
              const copia = { ...p };
              delete copia[invitadoId];
              return copia;
            });
            guardar(() => levantar(slug, [invitadoId]));
          }
        },
      });
    },
    [asientos, guardar, porId, registrar, slug],
  );

  const levantarA = useCallback(
    (invitadoId: string) => {
      const anterior = asientos[invitadoId];
      if (!anterior) return;

      setAsientos((previos) => {
        const copia = { ...previos };
        delete copia[invitadoId];
        return copia;
      });
      guardar(() => levantar(slug, [invitadoId]));

      const nombre = porId.get(invitadoId)?.full_name ?? "el invitado";
      registrar({
        etiqueta: `Levantar a ${nombre}`,
        deshacer: () => {
          setAsientos((p) => ({ ...p, [invitadoId]: anterior }));
          guardar(() =>
            sentarEnBloque(slug, [{ invitadoId, mesaId: anterior }]),
          );
        },
      });
    },
    [asientos, guardar, porId, registrar, slug],
  );

  // ------------------------------------------------------------------ mesas

  const colocarMesa = useCallback(
    (mesaId: string, x: number, y: number, conDeshacer = true) => {
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;

      const destino = resolverPosicion(
        mesa,
        x,
        y,
        mesas.filter((m) => m.id !== mesaId),
        separacion,
      );

      if (!destino) {
        setNota("Ahí no cabe sin invadir la separación. La mesa vuelve a su sitio.");
        return;
      }
      if (destino.x === mesa.pos_x && destino.y === mesa.pos_y) return;

      const antes = { x: mesa.pos_x, y: mesa.pos_y };
      setMesas((previas) =>
        previas.map((m) =>
          m.id === mesaId ? { ...m, pos_x: destino.x, pos_y: destino.y } : m,
        ),
      );
      guardar(() => moverMesa(slug, mesaId, destino.x, destino.y));
      setNota(null);

      if (!conDeshacer) return;
      registrar({
        etiqueta: `Mover ${mesa.name}`,
        deshacer: () => {
          setMesas((p) =>
            p.map((m) =>
              m.id === mesaId ? { ...m, pos_x: antes.x, pos_y: antes.y } : m,
            ),
          );
          guardar(() => moverMesa(slug, mesaId, antes.x, antes.y));
        },
      });
    },
    [guardar, mesas, registrar, separacion, slug],
  );

  function anadirMesas(nuevas: MesaNueva[], etiqueta: string) {
    if (nuevas.length === 0) return;
    guardar(async () => {
      const creadas = await crearMesas(slug, nuevas);
      setMesas((previas) => [...previas, ...creadas]);
      const ids = creadas.map((m) => m.id);
      registrar({
        etiqueta,
        deshacer: () => {
          setMesas((p) => p.filter((m) => !ids.includes(m.id)));
          setAsientos((p) =>
            Object.fromEntries(
              Object.entries(p).filter(([, mesaId]) => !ids.includes(mesaId)),
            ),
          );
          guardar(async () => {
            for (const id of ids) await borrarMesa(slug, id);
          });
        },
      });
    });
  }

  function anadirUna() {
    if (!presidencial) {
      anadirMesas(
        [
          {
            name: "Presidencial",
            shape: PRESIDENCIAL_POR_DEFECTO.shape,
            capacity: PRESIDENCIAL_POR_DEFECTO.plazas,
            pos_x: SALA.ancho / 2,
            pos_y: 190,
            rotation: 0,
            is_head: true,
          },
        ],
        "Crear la presidencial",
      );
      return;
    }

    const plantilla = {
      name: `Mesa ${mesas.filter((m) => !m.is_head).length + 1}`,
      shape: "redonda" as const,
      capacity: CAPACIDAD_POR_DEFECTO,
      rotation: 0,
    };
    const hueco = buscarHueco(
      plantilla,
      SALA.ancho / 2,
      SALA.alto / 2,
      mesas,
      separacion,
    );
    if (!hueco) {
      setNota("La sala está llena. Quita una mesa o baja la separación.");
      return;
    }
    anadirMesas(
      [{ ...plantilla, pos_x: hueco.x, pos_y: hueco.y }],
      `Añadir ${plantilla.name}`,
    );
  }

  function duplicar(mesa: Mesa) {
    if (mesa.is_head) return;
    const hueco = buscarHueco(mesa, mesa.pos_x, mesa.pos_y, mesas, separacion);
    if (!hueco) {
      setNota("No hay hueco al lado para la copia.");
      return;
    }
    anadirMesas(
      [
        {
          name: `Mesa ${mesas.filter((m) => !m.is_head).length + 1}`,
          shape: mesa.shape,
          capacity: mesa.capacity,
          rotation: mesa.rotation,
          pos_x: hueco.x,
          pos_y: hueco.y,
        },
      ],
      `Duplicar ${mesa.name}`,
    );
  }

  function aplicarPlantilla(plantillaId: string, cuantas: number, cap: number, enPres: number) {
    const plantilla = PLANTILLAS.find((p) => p.id === plantillaId);
    if (!plantilla) return;
    const nuevas = plantilla.generar(cuantas, cap, enPres);

    guardar(async () => {
      if (mesas.length > 0) await borrarTodasLasMesas(slug);
      const creadas = await crearMesas(slug, nuevas);
      setMesas(creadas);
      setAsientos({});
      setSeleccionada(null);
      // Montar una sala entera no se deshace: se vuelve a montar.
      setPila([]);
      setNota(null);
    });
  }

  const cambiarMesa = useCallback(
    (mesaId: string, cambios: Partial<Mesa>, persistir = true) => {
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;
      const antes = {
        name: mesa.name,
        shape: mesa.shape,
        capacity: mesa.capacity,
        rotation: mesa.rotation,
      };

      const siguiente = { ...mesa, ...cambios };

      // Cambiar plazas, forma o giro cambia la huella: hay que recolocarla.
      let posicion = { x: siguiente.pos_x, y: siguiente.pos_y };
      if (
        cambios.shape !== undefined ||
        cambios.capacity !== undefined ||
        cambios.rotation !== undefined
      ) {
        const resuelta = resolverPosicion(
          siguiente,
          siguiente.pos_x,
          siguiente.pos_y,
          mesas.filter((m) => m.id !== mesaId),
          separacion,
        );
        if (resuelta) posicion = resuelta;
      }

      setMesas((previas) =>
        previas.map((m) =>
          m.id === mesaId
            ? { ...m, ...cambios, pos_x: posicion.x, pos_y: posicion.y }
            : m,
        ),
      );

      if (!persistir) return;

      guardar(async () => {
        await actualizarMesa(slug, mesaId, {
          name: cambios.name,
          shape: cambios.shape,
          capacity: cambios.capacity,
          rotation: cambios.rotation,
        });
        if (posicion.x !== mesa.pos_x || posicion.y !== mesa.pos_y) {
          await moverMesa(slug, mesaId, posicion.x, posicion.y);
        }
      });

      registrar({
        etiqueta: `Cambiar ${mesa.name}`,
        deshacer: () => {
          setMesas((p) =>
            p.map((m) =>
              m.id === mesaId
                ? { ...m, ...antes, pos_x: mesa.pos_x, pos_y: mesa.pos_y }
                : m,
            ),
          );
          guardar(async () => {
            await actualizarMesa(slug, mesaId, antes);
            await moverMesa(slug, mesaId, mesa.pos_x, mesa.pos_y);
          });
        },
      });
    },
    [guardar, mesas, registrar, separacion, slug],
  );

  function quitarMesa(mesa: Mesa) {
    if (mesa.is_head) return;
    const sentados = (sentadosPorMesa.get(mesa.id) ?? []).map((i) => i.id);

    setMesas((previas) => previas.filter((m) => m.id !== mesa.id));
    setAsientos((previos) => {
      const copia = { ...previos };
      for (const id of sentados) delete copia[id];
      return copia;
    });
    setSeleccionada(null);
    guardar(() => borrarMesa(slug, mesa.id));

    registrar({
      etiqueta: `Borrar ${mesa.name}`,
      deshacer: () => {
        guardar(async () => {
          const [recreada] = await crearMesas(slug, [
            {
              name: mesa.name,
              shape: mesa.shape,
              capacity: mesa.capacity,
              pos_x: mesa.pos_x,
              pos_y: mesa.pos_y,
              rotation: mesa.rotation,
            },
          ]);
          if (!recreada) return;

          setMesas((previas) => [...previas, recreada]);
          if (sentados.length === 0) return;

          await sentarEnBloque(
            slug,
            sentados.map((id) => ({ invitadoId: id, mesaId: recreada.id })),
          );
          setAsientos((previos) => {
            const copia = { ...previos };
            for (const id of sentados) copia[id] = recreada.id;
            return copia;
          });
        });
      },
    });
  }

  // ------------------------------------------------------ reparto automático

  function sentarPorFamilias() {
    const { pares, sinSitio } = repartir({
      invitados,
      grupos,
      mesas,
      asientos,
      porBando,
    });

    if (pares.length === 0) {
      setNota(
        mesas.filter((m) => !m.is_head).length === 0
          ? "Primero monta las mesas."
          : "No queda nadie por sentar o no hay sitio libre.",
      );
      return;
    }

    setAsientos((previos) => {
      const copia = { ...previos };
      for (const par of pares) copia[par.invitadoId] = par.mesaId;
      return copia;
    });
    guardar(() => sentarEnBloque(slug, pares));

    const ids = pares.map((p) => p.invitadoId);
    registrar({
      etiqueta: `Sentar ${pares.length} por familias`,
      deshacer: () => {
        setAsientos((p) => {
          const copia = { ...p };
          for (const id of ids) delete copia[id];
          return copia;
        });
        guardar(() => levantar(slug, ids));
      },
    });

    setNota(
      sinSitio > 0
        ? `${pares.length} sentados. ${sinSitio} se quedan fuera: faltan plazas.`
        : `${pares.length} sentados por familias.`,
    );
  }

  // --------------------------------------------------------------- arrastre

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function alEmpezar(evento: DragStartEvent) {
    const datos = evento.active.data.current;

    if (datos?.tipo === "mesa") {
      setMoviendoMesa(true);
      return;
    }
    if (datos?.tipo !== "invitado") return;

    const invitado = porId.get(datos.invitadoId as string);
    if (!invitado) return;
    setArrastrado(invitado);

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
    setMoviendoMesa(false);
    setMesasResaltadas(new Set());

    const datos = evento.active.data.current;
    if (!datos) return;

    if (datos.tipo === "mesa") {
      const mesaId = datos.mesaId as string;
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;
      colocarMesa(
        mesaId,
        mesa.pos_x + evento.delta.x / escala,
        mesa.pos_y + evento.delta.y / escala,
      );
      return;
    }

    if (datos.tipo !== "invitado") return;

    const invitadoId = datos.invitadoId as string;
    const destino = evento.over?.data.current;

    if (destino?.tipo === "mesa") {
      sentarA(invitadoId, destino.mesaId as string);
    } else if (destino?.tipo === "panel") {
      levantarA(invitadoId);
    }
  }

  const mesaSeleccionada = mesas.find((m) => m.id === seleccionada) ?? null;
  const haloVisible = moviendoMesa;

  return (
    <DndContext
      // Fijo a propósito: sin él, dnd-kit numera los identificadores de
      // accesibilidad distinto en servidor y en navegador.
      id="planificador-mesas"
      sensors={sensores}
      collisionDetection={pointerWithin}
      onDragStart={alEmpezar}
      onDragEnd={alTerminar}
      onDragCancel={() => {
        setArrastrado(null);
        setMoviendoMesa(false);
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
            mesas={mesas.filter((m) => !m.is_head).length}
            hayPresidencial={presidencial !== null}
            aSentar={aSentar}
            escala={escala}
            setEscala={setEscala}
            nivel={nivel}
            setNivel={setNivel}
            porBando={porBando}
            setPorBando={setPorBando}
            pendientes={pendientes}
            fallo={fallo}
            puedeDeshacer={pila.length > 0}
            ultimoPaso={pila[pila.length - 1]?.etiqueta ?? null}
            onDeshacer={deshacer}
            onAnadir={anadirUna}
            onSentarFamilias={sentarPorFamilias}
            onPlantilla={aplicarPlantilla}
            hayMesas={mesas.length > 0}
          />

          {nota && (
            <p
              role="status"
              className="border-b border-border bg-accent px-4 py-2 text-sm text-accent-foreground"
            >
              {nota}
            </p>
          )}

          <div
            className="relative flex-1 overflow-auto bg-canvas"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSeleccionada(null);
            }}
          >
            <div style={{ width: SALA.ancho * escala, height: SALA.alto * escala }}>
              <div
                style={{
                  width: SALA.ancho,
                  height: SALA.alto,
                  transform: `scale(${escala})`,
                  transformOrigin: "top left",
                  backgroundSize: "100px 100px",
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
                    halo={separacion / 2}
                    mostrarHalo={haloVisible || seleccionada === mesa.id}
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
                  sala entera, presidencial incluida.
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
            onCambiar={(cambios, persistir) =>
              cambiarMesa(mesaSeleccionada.id, cambios, persistir)
            }
            onLevantar={levantarA}
            onDuplicar={() => duplicar(mesaSeleccionada)}
            onBorrar={() => quitarMesa(mesaSeleccionada)}
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
  hayPresidencial,
  aSentar,
  escala,
  setEscala,
  nivel,
  setNivel,
  porBando,
  setPorBando,
  pendientes,
  fallo,
  puedeDeshacer,
  ultimoPaso,
  onDeshacer,
  onAnadir,
  onSentarFamilias,
  onPlantilla,
  hayMesas,
}: {
  mesas: number;
  hayPresidencial: boolean;
  aSentar: number;
  escala: number;
  setEscala: (v: number) => void;
  nivel: NivelSeparacion;
  setNivel: (v: NivelSeparacion) => void;
  porBando: boolean;
  setPorBando: (v: boolean) => void;
  pendientes: number;
  fallo: string | null;
  puedeDeshacer: boolean;
  ultimoPaso: string | null;
  onDeshacer: () => void;
  onAnadir: () => void;
  onSentarFamilias: () => void;
  onPlantilla: (id: string, cuantas: number, capacidad: number, enPres: number) => void;
  hayMesas: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [capacidad, setCapacidad] = useState(CAPACIDAD_POR_DEFECTO);
  const [enPresidencial, setEnPresidencial] = useState(
    PRESIDENCIAL_POR_DEFECTO.plazas,
  );
  const sugeridas = sugerirMesas(aSentar, capacidad, enPresidencial);
  const [cuantas, setCuantas] = useState(sugeridas);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  return (
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button size="sm" onClick={onAnadir}>
          {hayPresidencial ? "Añadir mesa" : "Crear presidencial"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          Plantillas
        </Button>
        <Button size="sm" variant="secondary" onClick={onSentarFamilias}>
          Sentar por familias
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeshacer}
          disabled={!puedeDeshacer}
          title={ultimoPaso ? `Deshacer: ${ultimoPaso}` : "Nada que deshacer"}
        >
          Deshacer
        </Button>

        <span className="text-sm text-muted-foreground">
          {mesas} {mesas === 1 ? "mesa" : "mesas"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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

          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as NivelSeparacion)}
            aria-label="Separación entre mesas"
            className="h-8 rounded-md border border-input bg-card px-2 text-xs"
          >
            {(
              Object.entries(SEPARACIONES) as [
                NivelSeparacion,
                (typeof SEPARACIONES)[NivelSeparacion],
              ][]
            ).map(([clave, valor]) => (
              <option key={clave} value={clave}>
                {valor.etiqueta} · {valor.pie}
              </option>
            ))}
          </select>

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
            {aSentar} invitados. Con {enPresidencial} en la presidencial y mesas
            de {capacidad}, salen{" "}
            <strong className="font-medium text-foreground">
              {sugeridas} mesas
            </strong>
            .
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block text-muted-foreground">Presidencial</span>
              <select
                value={enPresidencial}
                onChange={(e) => {
                  const valor = Number(e.target.value);
                  setEnPresidencial(valor);
                  setCuantas(sugerirMesas(aSentar, capacidad, valor));
                }}
                className="mt-1 h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {FORMATOS_PRESIDENCIAL.map((formato) => (
                  <option key={formato.plazas} value={formato.plazas}>
                    {formato.nombre} ({formato.plazas})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-muted-foreground">Mesas</span>
              <input
                type="number"
                min={0}
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
                  setCuantas(sugerirMesas(aSentar, valor, enPresidencial));
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

          <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={porBando}
              onChange={(e) => setPorBando(e.target.checked)}
              className="size-3.5 accent-[var(--foreground)]"
            />
            Al sentar por familias, separar los bandos a cada lado de la
            presidencial (tradición hoy en desuso)
          </label>

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
                        onPlantilla(plantilla.id, cuantas, capacidad, enPresidencial);
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
                        onPlantilla(plantilla.id, cuantas, capacidad, enPresidencial);
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
              Montar una plantilla borra las mesas actuales, devuelve a todos a
              la lista de sin sentar y vacía el historial de deshacer.
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
  onCambiar,
  onLevantar,
  onDuplicar,
  onBorrar,
  onCerrar,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  onCambiar: (cambios: Partial<Mesa>, persistir?: boolean) => void;
  onLevantar: (invitadoId: string) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
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

      <div className="space-y-3 border-b border-border p-3">
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
                  onCambiar({ shape: formato.shape, capacity: formato.plazas });
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
                capacity: Math.min(40, Math.max(1, Number(e.target.value) || 1)),
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

        <p
          className={cn(
            "text-sm tabular-nums",
            pasada ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {sentados.length}/{mesa.capacity} sentados
          {pasada && " · te has pasado"}
        </p>

        {mesa.is_head && (
          <p className="rounded-md bg-secondary p-2 text-xs leading-relaxed text-muted-foreground">
            Protocolo: los novios en el centro, la novia a la derecha del novio.
            Madrina a la derecha del novio y padrino a la izquierda de la novia.
          </p>
        )}
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
