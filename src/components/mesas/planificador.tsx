"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { BarraHerramientas, type Alcance } from "@/components/mesas/barra";
import { Inspector } from "@/components/mesas/inspector";
import { PanelSinSentar } from "@/components/mesas/panel";
import { CaraChip, MesaEnLienzo } from "@/components/mesas/piezas";
import { Button } from "@/components/ui/button";
import {
  actualizarMesa,
  borrarMesa,
  borrarRegla,
  borrarTodasLasMesas,
  crearMesas,
  crearRegla,
  fijarMesa,
  levantar,
  moverMesa,
  sentarEnBloque,
} from "@/lib/acciones/mesas";
import { conflictos, repartir, type Par } from "@/lib/autosentar";
import {
  CAPACIDAD_POR_DEFECTO,
  PLANTILLAS,
  PRESIDENCIAL_POR_DEFECTO,
  SALA,
  SEPARACIONES,
  buscarHueco,
  distribuirSinSolapes,
  resolverPosicion,
  type MesaNueva,
  type NivelSeparacion,
} from "@/lib/mesas";
import type {
  Asignacion,
  GrupoInvitados,
  Invitado,
  Mesa,
  Regla,
  TipoRegla,
} from "@/lib/tipos";

const MAX_DESHACER = 50;
const ESCALA_MIN = 0.12;
const ESCALA_MAX = 1.4;

type Paso = { etiqueta: string; deshacer: () => void };
type Vista = { x: number; y: number; escala: number };

export function Planificador({
  slug,
  invitados,
  grupos,
  mesasIniciales,
  asignacionesIniciales,
  reglasIniciales,
}: {
  slug: string;
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  mesasIniciales: Mesa[];
  asignacionesIniciales: Asignacion[];
  reglasIniciales: Regla[];
}) {
  const [mesas, setMesas] = useState<Mesa[]>(mesasIniciales);
  const [asientos, setAsientos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      asignacionesIniciales.map((a) => [a.guest_id, a.table_id]),
    ),
  );

  const [reglas, setReglas] = useState<Regla[]>(reglasIniciales);
  const [propuesta, setPropuesta] = useState<{
    pares: Par[];
    resumen: string;
  } | null>(null);
  const [alcance, setAlcance] = useState<Alcance>("todos");

  const [pendientes, setPendientes] = useState(0);
  const [fallo, setFallo] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const [pila, setPila] = useState<Paso[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ultimoMarcado, setUltimoMarcado] = useState<string | null>(null);
  const [verRechazados, setVerRechazados] = useState(false);
  const [verSillas, setVerSillas] = useState(true);
  const [vista, setVista] = useState<Vista>({ x: 40, y: 40, escala: 0.45 });
  const [nivel, setNivel] = useState<NivelSeparacion>("holgado");
  const [porBando, setPorBando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [arrastrado, setArrastrado] = useState<Invitado[] | null>(null);
  const [moviendoMesa, setMoviendoMesa] = useState(false);
  const [mesasResaltadas, setMesasResaltadas] = useState<Set<string>>(new Set());

  const contenedor = useRef<HTMLDivElement>(null);
  const paneo = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
    null,
  );

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

  // ------------------------------------------------------------------ datos

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

  const aSentar = useMemo(
    () => invitados.filter((i) => i.rsvp_status !== "rechazado").length,
    [invitados],
  );

  const presidencial = mesas.find((m) => m.is_head) ?? null;

  const roto = useMemo(() => conflictos(asientos, reglas), [asientos, reglas]);

  const fantasmas = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const par of propuesta?.pares ?? []) {
      mapa.set(par.mesaId, (mapa.get(par.mesaId) ?? 0) + 1);
    }
    return mapa;
  }, [propuesta]);

  // -------------------------------------------------------------- selección

  const marcar = useCallback(
    (ids: string[], e: React.MouseEvent, orden?: string[]) => {
      const suma = e.ctrlKey || e.metaKey;
      const rango = e.shiftKey && orden && ultimoMarcado && ids.length === 1;

      setSeleccion((previa) => {
        if (rango) {
          const desde = orden.indexOf(ultimoMarcado);
          const hasta = orden.indexOf(ids[0]);
          if (desde >= 0 && hasta >= 0) {
            const [a, b] = desde < hasta ? [desde, hasta] : [hasta, desde];
            const copia = new Set(previa);
            for (const id of orden.slice(a, b + 1)) copia.add(id);
            return copia;
          }
        }

        if (!suma) {
          const yaTodos = ids.every((id) => previa.has(id));
          if (yaTodos && previa.size === ids.length) return new Set();
          return new Set(ids);
        }

        const copia = new Set(previa);
        const yaTodos = ids.every((id) => copia.has(id));
        for (const id of ids) {
          if (yaTodos) copia.delete(id);
          else copia.add(id);
        }
        return copia;
      });

      setUltimoMarcado(ids[ids.length - 1] ?? null);
    },
    [ultimoMarcado],
  );

  // -------------------------------------------------------- sentar/levantar

  const sentarVarios = useCallback(
    (ids: string[], mesaId: string, etiqueta?: string) => {
      const pares = ids
        .filter((id) => asientos[id] !== mesaId)
        .map((id) => ({ invitadoId: id, mesaId }));
      if (pares.length === 0) return;

      const antes = new Map(
        pares.map((p) => [p.invitadoId, asientos[p.invitadoId] ?? null]),
      );

      setAsientos((previos) => {
        const copia = { ...previos };
        for (const par of pares) copia[par.invitadoId] = mesaId;
        return copia;
      });
      guardar(() => sentarEnBloque(slug, pares));

      const nombre =
        etiqueta ??
        (pares.length === 1
          ? `Sentar a ${porId.get(pares[0].invitadoId)?.full_name ?? "alguien"}`
          : `Sentar a ${pares.length}`);

      registrar({
        etiqueta: nombre,
        deshacer: () => {
          const vuelven = [...antes.entries()].filter(([, m]) => m !== null) as [
            string,
            string,
          ][];
          const seLevantan = [...antes.entries()]
            .filter(([, m]) => m === null)
            .map(([id]) => id);

          setAsientos((previos) => {
            const copia = { ...previos };
            for (const [id, mesa] of vuelven) copia[id] = mesa;
            for (const id of seLevantan) delete copia[id];
            return copia;
          });
          guardar(async () => {
            if (vuelven.length > 0) {
              await sentarEnBloque(
                slug,
                vuelven.map(([id, mesa]) => ({ invitadoId: id, mesaId: mesa })),
              );
            }
            if (seLevantan.length > 0) await levantar(slug, seLevantan);
          });
        },
      });
    },
    [asientos, guardar, porId, registrar, slug],
  );

  const levantarA = useCallback(
    (ids: string[]) => {
      const antes = ids
        .filter((id) => asientos[id])
        .map((id) => ({ invitadoId: id, mesaId: asientos[id] }));
      if (antes.length === 0) return;

      setAsientos((previos) => {
        const copia = { ...previos };
        for (const p of antes) delete copia[p.invitadoId];
        return copia;
      });
      guardar(() => levantar(slug, antes.map((p) => p.invitadoId)));

      registrar({
        etiqueta:
          antes.length === 1
            ? `Levantar a ${porId.get(antes[0].invitadoId)?.full_name ?? "alguien"}`
            : `Levantar a ${antes.length}`,
        deshacer: () => {
          setAsientos((previos) => {
            const copia = { ...previos };
            for (const p of antes) copia[p.invitadoId] = p.mesaId;
            return copia;
          });
          guardar(() => sentarEnBloque(slug, antes));
        },
      });
    },
    [asientos, guardar, porId, registrar, slug],
  );

  // ------------------------------------------------------------------ mesas

  const colocarMesa = useCallback(
    (mesaId: string, x: number, y: number) => {
      const mesa = mesas.find((m) => m.id === mesaId);
      if (!mesa) return;

      const otras = mesas.filter((m) => m.id !== mesaId);
      const destino =
        resolverPosicion(mesa, x, y, otras, separacion) ??
        buscarHueco(mesa, x, y, otras, separacion);

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

  function aplicarPlantilla(
    plantillaId: string,
    cuantas: number,
    cap: number,
    enPres: number,
  ) {
    const plantilla = PLANTILLAS.find((p) => p.id === plantillaId);
    if (!plantilla) return;

    const { colocadas, descartadas } = distribuirSinSolapes(
      plantilla.generar(cuantas, cap, enPres, separacion),
      separacion,
    );

    guardar(async () => {
      if (mesas.length > 0) await borrarTodasLasMesas(slug);
      const creadas = await crearMesas(slug, colocadas);
      setMesas(creadas);
      setAsientos({});
      setSeleccionada(null);
      setSeleccion(new Set());
      setPila([]);
      setNota(
        descartadas > 0
          ? `Montadas ${colocadas.length - 1} mesas. ${descartadas} no caben en la sala con esta separación: baja el nivel o sube las plazas por mesa.`
          : null,
      );
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

  /** No sienta a nadie: propone y espera confirmación. */
  function proponerReparto() {
    const { pares, sinSitio, partidos } = repartir({
      invitados,
      grupos,
      mesas,
      asientos,
      reglas,
      porBando,
      soloIds: alcance === "marcados" ? seleccion : undefined,
      soloMesaId: alcance === "mesa" ? seleccionada : undefined,
    });

    if (pares.length === 0) {
      setPropuesta(null);
      setNota(
        mesas.filter((m) => !m.is_head && !m.is_locked).length === 0
          ? "No hay mesas libres donde repartir. Monta la sala o suelta alguna mesa fijada."
          : "No queda nadie por sentar con ese alcance, o no hay sitio libre.",
      );
      return;
    }

    setNota(null);
    setPropuesta({
      pares,
      resumen: [
        `Se sentarían ${pares.length}.`,
        sinSitio > 0 && `${sinSitio} se quedan fuera: faltan plazas.`,
        partidos > 0 &&
          `${partidos} ${partidos === 1 ? "grupo no cabe entero" : "grupos no caben enteros"}: con una mesa más caben juntos.`,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  function aplicarPropuesta() {
    if (!propuesta) return;
    const { pares } = propuesta;

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

    setPropuesta(null);
    setSeleccion(new Set());
    setNota(`${pares.length} sentados por familias.`);
  }

  function vaciarMesa(mesa: Mesa) {
    const ids = (sentadosPorMesa.get(mesa.id) ?? []).map((i) => i.id);
    levantarA(ids);
  }

  function alternarFijada(mesa: Mesa, fijada: boolean) {
    setMesas((previas) =>
      previas.map((m) => (m.id === mesa.id ? { ...m, is_locked: fijada } : m)),
    );
    guardar(() => fijarMesa(slug, mesa.id, fijada));
  }

  function anadirRegla(kind: TipoRegla, a: string, b: string) {
    guardar(async () => {
      const creada = await crearRegla(slug, kind, a, b);
      if (!creada) return;
      setReglas((previas) => [
        ...previas.filter((r) => r.id !== creada.id),
        creada,
      ]);
    });
  }

  function quitarRegla(reglaId: string) {
    setReglas((previas) => previas.filter((r) => r.id !== reglaId));
    guardar(() => borrarRegla(slug, reglaId));
  }

  // ------------------------------------------------------- lienzo: vista

  const ajustar = useCallback(() => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    const escala = Math.min(
      (caja.width - 48) / SALA.ancho,
      (caja.height - 48) / SALA.alto,
    );
    setVista({
      escala,
      x: (caja.width - SALA.ancho * escala) / 2,
      y: (caja.height - SALA.alto * escala) / 2,
    });
  }, []);

  useEffect(() => {
    ajustar();
  }, [ajustar]);

  const ponerEscala = useCallback((nueva: number, cx?: number, cy?: number) => {
    setVista((previa) => {
      const escala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, nueva));
      const caja = contenedor.current?.getBoundingClientRect();
      const px = cx ?? (caja ? caja.width / 2 : 0);
      const py = cy ?? (caja ? caja.height / 2 : 0);
      const factor = escala / previa.escala;
      return {
        escala,
        x: px - (px - previa.x) * factor,
        y: py - (py - previa.y) * factor,
      };
    });
  }, []);

  // La rueda necesita listener no pasivo para poder frenar el desplazamiento.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    function alRodar(e: WheelEvent) {
      e.preventDefault();
      const caja = nodo!.getBoundingClientRect();
      ponerEscala(
        vista.escala * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
        e.clientX - caja.left,
        e.clientY - caja.top,
      );
    }

    nodo.addEventListener("wheel", alRodar, { passive: false });
    return () => nodo.removeEventListener("wheel", alRodar);
  }, [ponerEscala, vista.escala]);

  function empezarPaneo(e: React.PointerEvent) {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.fondo)
      return;
    paneo.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function moverPaneo(e: React.PointerEvent) {
    if (!paneo.current) return;
    setVista((previa) => ({
      ...previa,
      x: paneo.current!.vx + (e.clientX - paneo.current!.x),
      y: paneo.current!.vy + (e.clientY - paneo.current!.y),
    }));
  }

  function terminarPaneo(e: React.PointerEvent) {
    if (!paneo.current) return;
    const movido =
      Math.abs(e.clientX - paneo.current.x) +
      Math.abs(e.clientY - paneo.current.y);
    paneo.current = null;
    if (movido < 4) {
      setSeleccionada(null);
      setSeleccion(new Set());
    }
  }

  const irA = useCallback(
    (invitadoId: string, mesaId: string | null) => {
      setSeleccion(new Set([invitadoId]));
      setUltimoMarcado(invitadoId);
      if (!mesaId) return;

      const mesa = mesas.find((m) => m.id === mesaId);
      const caja = contenedor.current?.getBoundingClientRect();
      if (!mesa || !caja) return;

      setSeleccionada(mesaId);
      setVista((previa) => ({
        ...previa,
        x: caja.width / 2 - mesa.pos_x * previa.escala,
        y: caja.height / 2 - mesa.pos_y * previa.escala,
      }));
    },
    [mesas],
  );

  // --------------------------------------------------------------- teclado

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      const enCampo =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        deshacer();
        return;
      }
      if (e.key === "Escape" && !enCampo) {
        setSeleccion(new Set());
        setSeleccionada(null);
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [deshacer]);

  // --------------------------------------------------------------- arrastre

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function resaltarFamilia(ids: string[]) {
    const familias = new Set(
      ids.map((id) => porId.get(id)?.group_id).filter(Boolean),
    );
    if (familias.size === 0) return;

    const conFamilia = new Set<string>();
    for (const [otroId, mesaId] of Object.entries(asientos)) {
      const grupo = porId.get(otroId)?.group_id;
      if (grupo && familias.has(grupo)) conFamilia.add(mesaId);
    }
    setMesasResaltadas(conFamilia);
  }

  function alEmpezar(evento: DragStartEvent) {
    const datos = evento.active.data.current;

    if (datos?.tipo === "mesa") {
      setMoviendoMesa(true);
      return;
    }

    if (datos?.tipo === "grupo") {
      const ids = datos.ids as string[];
      setArrastrado(ids.map((id) => porId.get(id)).filter(Boolean) as Invitado[]);
      resaltarFamilia(ids);
      return;
    }

    if (datos?.tipo !== "invitado") return;

    const invitadoId = datos.invitadoId as string;
    const ids = seleccion.has(invitadoId) ? [...seleccion] : [invitadoId];
    setArrastrado(ids.map((id) => porId.get(id)).filter(Boolean) as Invitado[]);
    resaltarFamilia(ids);
  }

  function alTerminar(evento: DragEndEvent) {
    const arrastrando = arrastrado;
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
        mesa.pos_x + evento.delta.x / vista.escala,
        mesa.pos_y + evento.delta.y / vista.escala,
      );
      return;
    }

    const ids = arrastrando?.map((i) => i.id) ?? [];
    if (ids.length === 0) return;

    const destino = evento.over?.data.current;
    if (destino?.tipo === "mesa") {
      sentarVarios(ids, destino.mesaId as string);
      setSeleccion(new Set());
    } else if (destino?.tipo === "panel") {
      levantarA(ids);
      setSeleccion(new Set());
    }
  }

  function alPulsarMesa(mesa: Mesa, e: React.MouseEvent) {
    e.stopPropagation();
    if (seleccion.size > 0) {
      sentarVarios([...seleccion], mesa.id);
      setSeleccion(new Set());
      return;
    }
    setSeleccionada(mesa.id);
  }

  const mesaSeleccionada = mesas.find((m) => m.id === seleccionada) ?? null;

  return (
    <DndContext
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
          invitados={sinSentar}
          totalSinSentar={sinSentar.length}
          aSentar={aSentar}
          grupos={grupos}
          grupoDe={grupoDe}
          seleccion={seleccion}
          verRechazados={verRechazados}
          setVerRechazados={setVerRechazados}
          alPulsarInvitado={(id, e) => marcar([id], e, sinSentar.map((i) => i.id))}
          alPulsarGrupo={(ids, e) => marcar(ids, e)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <BarraHerramientas
            mesas={mesas.filter((m) => !m.is_head).length}
            todasLasMesas={mesas}
            invitados={invitados}
            asientos={asientos}
            hayPresidencial={presidencial !== null}
            aSentar={aSentar}
            escala={vista.escala}
            setEscala={(v) => ponerEscala(v)}
            onAjustar={ajustar}
            nivel={nivel}
            setNivel={setNivel}
            verSillas={verSillas}
            setVerSillas={setVerSillas}
            porBando={porBando}
            setPorBando={setPorBando}
            pendientes={pendientes}
            fallo={fallo}
            puedeDeshacer={pila.length > 0}
            ultimoPaso={pila[pila.length - 1]?.etiqueta ?? null}
            onDeshacer={deshacer}
            onAnadir={anadirUna}
            onSentarFamilias={proponerReparto}
            onPlantilla={aplicarPlantilla}
            onIrA={irA}
            reglas={reglas}
            incumplidas={roto.invitados}
            onCrearRegla={anadirRegla}
            onBorrarRegla={quitarRegla}
            alcance={alcance}
            setAlcance={setAlcance}
            haySeleccion={seleccion.size > 0}
            hayMesaElegida={seleccionada !== null}
          />

          {propuesta && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent px-4 py-2 text-sm text-accent-foreground">
              <span>{propuesta.resumen} Míralo en el plano antes de aplicar.</span>
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" onClick={aplicarPropuesta}>
                  Aplicar
                </Button>
                <button
                  type="button"
                  onClick={() => setPropuesta(null)}
                  className="text-sm underline underline-offset-4"
                >
                  Descartar
                </button>
              </span>
            </div>
          )}

          {seleccion.size > 0 && (
            <p
              role="status"
              className="border-b border-border bg-foreground px-4 py-2 text-sm text-background"
            >
              {seleccion.size}{" "}
              {seleccion.size === 1 ? "seleccionado" : "seleccionados"}. Haz clic
              en una mesa para sentarlos. Escape para soltar la selección.
            </p>
          )}

          {nota && (
            <p
              role="status"
              className="border-b border-border bg-accent px-4 py-2 text-sm text-accent-foreground"
            >
              {nota}
            </p>
          )}

          <div
            ref={contenedor}
            onPointerDown={empezarPaneo}
            onPointerMove={moverPaneo}
            onPointerUp={terminarPaneo}
            onPointerCancel={terminarPaneo}
            className="relative flex-1 touch-none overflow-hidden bg-canvas"
          >
            <div
              data-fondo="1"
              style={{
                width: SALA.ancho,
                height: SALA.alto,
                transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
                transformOrigin: "0 0",
                backgroundSize: "100px 100px",
                backgroundImage:
                  "linear-gradient(to right, var(--canvas-line) 1px, transparent 1px), linear-gradient(to bottom, var(--canvas-line) 1px, transparent 1px)",
              }}
              className="absolute left-0 top-0 border border-canvas-line bg-card/40"
            >
              {mesas.map((mesa) => (
                <MesaEnLienzo
                  key={mesa.id}
                  mesa={mesa}
                  sentados={sentadosPorMesa.get(mesa.id) ?? []}
                  grupoDe={grupoDe}
                  escala={vista.escala}
                  halo={separacion / 2}
                  mostrarHalo={moviendoMesa || seleccionada === mesa.id}
                  mostrarSillas={verSillas}
                  resaltada={mesasResaltadas.has(mesa.id)}
                  seleccionada={seleccionada === mesa.id}
                  fijada={mesa.is_locked}
                  conConflicto={roto.mesas.has(mesa.id)}
                  fantasma={fantasmas.get(mesa.id)}
                  alPulsar={(e) => alPulsarMesa(mesa, e)}
                />
              ))}
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
            seleccion={seleccion}
            onCambiar={(cambios, persistir) =>
              cambiarMesa(mesaSeleccionada.id, cambios, persistir)
            }
            onLevantar={(id) => levantarA([id])}
            onVaciar={() => vaciarMesa(mesaSeleccionada)}
            onFijar={(fijada) => alternarFijada(mesaSeleccionada, fijada)}
            onDuplicar={() => duplicar(mesaSeleccionada)}
            onBorrar={() => quitarMesa(mesaSeleccionada)}
            onCerrar={() => setSeleccionada(null)}
            onPulsarInvitado={(id, e) =>
              marcar(
                [id],
                e,
                (sentadosPorMesa.get(mesaSeleccionada.id) ?? []).map((i) => i.id),
              )
            }
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {arrastrado && arrastrado.length > 0 ? (
          <div className="w-44">
            <CaraChip
              invitado={arrastrado[0]}
              grupo={grupoDe(arrastrado[0])}
              arrastrando
            />
            {arrastrado.length > 1 && (
              <span className="mt-1 block rounded-sm bg-foreground px-2 py-0.5 text-center text-xs text-background">
                y {arrastrado.length - 1} más
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
