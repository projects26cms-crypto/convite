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
  useSyncExternalStore,
  useTransition,
} from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";

import { BarraHerramientas, type Alcance } from "@/components/mesas/barra";
import { Inspector } from "@/components/mesas/inspector";
import { PanelSinSentar } from "@/components/mesas/panel";
import { MiniaturaModelo } from "@/components/mesas/figura";
import {
  CaraChip,
  MesaEnLienzo,
  PUNTO_BANDO,
  ordenarPorFamilia,
} from "@/components/mesas/piezas";
import { Button } from "@/components/ui/button";
import {
  actualizarMesa,
  actualizarSala,
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
  SEPARACIONES,
  SALA_MAX,
  SALA_MIN,
  buscarHueco,
  distribuirSinSolapes,
  encajarEnSala,
  fueraDeSala,
  resolverPosicion,
  tamanoMesa,
  type MesaNueva,
  type NivelSeparacion,
  type Sala,
} from "@/lib/mesas";
import type { ModeloMesa } from "@/lib/modelos";
import {
  ESCALA_VISUAL_MAX,
  ESCALA_VISUAL_MIN,
  acotarEscalaVisual,
  escalaSinSolape,
  escalaVisualAutomatica,
} from "@/lib/vista";
import { cn } from "@/lib/utils";
import type {
  Asignacion,
  GrupoInvitados,
  Invitado,
  Mesa,
  PresetSala,
  Regla,
  TipoRegla,
} from "@/lib/tipos";

const MAX_DESHACER = 50;
const ESCALA_MIN = 0.12;
const ESCALA_MAX = 1.4;

type Paso = { etiqueta: string; deshacer: () => void };

/**
 * El tamaño de las mesas en pantalla es una preferencia de quien mira, no un
 * dato del plano: se guarda en este navegador. Si el almacenamiento falla, se
 * recuerda mientras dure la sesión.
 */
const CLAVE_ESCALA = "convite:escala-mesas";
const EVENTO_ESCALA = "convite:escala-mesas";
let escalaEnMemoria = "auto";

function leerEscala(): string {
  try {
    return window.localStorage.getItem(CLAVE_ESCALA) ?? escalaEnMemoria;
  } catch {
    return escalaEnMemoria;
  }
}

function guardarEscala(valor: string) {
  escalaEnMemoria = valor;
  try {
    window.localStorage.setItem(CLAVE_ESCALA, valor);
  } catch {
    // Sin almacenamiento: vale con la memoria de la sesión.
  }
  window.dispatchEvent(new Event(EVENTO_ESCALA));
}

function suscribirEscala(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_ESCALA, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_ESCALA, avisar);
  };
}

/** Longitud de la barra de escala: la mayor que quepa en unos 110 px. */
function tramoDeEscala(pxPorCm: number): number {
  const opciones = [50, 100, 200, 500, 1000, 2000];
  return (
    [...opciones].reverse().find((cm) => cm * pxPorCm <= 110) ?? opciones[0]
  );
}

function sombraSala(escala: number): string {
  const u = 1 / escala;
  return `0 0 0 ${u}px var(--canvas-line), 0 ${10 * u}px ${30 * u}px -${12 * u}px rgb(0 0 0 / 0.18)`;
}

function metros(cm: number): string {
  return `${(cm / 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} m`;
}
type Vista = { x: number; y: number; escala: number };

export function Planificador({
  slug,
  invitados,
  grupos,
  mesasIniciales,
  asignacionesIniciales,
  reglasIniciales,
  sala: salaInicial,
  presetSala: presetInicial,
}: {
  slug: string;
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  mesasIniciales: Mesa[];
  asignacionesIniciales: Asignacion[];
  reglasIniciales: Regla[];
  sala: Sala;
  presetSala: PresetSala;
}) {
  const [sala, setSala] = useState<Sala>(salaInicial);
  const [presetSala, setPresetSala] = useState<PresetSala>(presetInicial);
  const [modeloElegido, setModeloElegido] = useState<ModeloMesa | null>(null);
  const [fantasmaMesa, setFantasmaMesa] = useState<{
    x: number;
    y: number;
  } | null>(null);

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
  const modoEscala = useSyncExternalStore(
    suscribirEscala,
    leerEscala,
    () => "auto",
  );
  const [encima, setEncima] = useState<string | null>(null);
  const [lienzo, setLienzo] = useState({ ancho: 0, alto: 0 });

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

  // Escala visual: solo presentación. Al mover una mesa se vuelve a la real,
  // porque en ese momento lo que importa es el espacio físico.
  const escalaAuto = useMemo(() => escalaVisualAutomatica(mesas), [mesas]);
  const escalaTope = useMemo(() => escalaSinSolape(mesas), [mesas]);
  const escalaElegida =
    modoEscala === "auto"
      ? escalaAuto
      : acotarEscalaVisual(Number(modoEscala) || 1);
  const escalaMesas = moviendoMesa ? 1 : escalaElegida;
  const vistaExagerada = modoEscala !== "auto" && escalaElegida > escalaTope;

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

      // No se bloquea: a veces se aprieta una silla más a propósito. Pero se
      // dice en voz alta, que meter a 70 en una mesa de 10 no pase en silencio.
      const mesa = mesas.find((m) => m.id === mesaId);
      const tras = (sentadosPorMesa.get(mesaId)?.length ?? 0) + pares.length;
      if (mesa && mesa.capacity > 0 && tras > mesa.capacity) {
        setNota(
          `${mesa.name} se pasa de plazas: ${tras} de ${mesa.capacity}. Ctrl+Z lo deshace.`,
        );
      }

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
    [asientos, guardar, mesas, porId, registrar, sentadosPorMesa, slug],
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
        resolverPosicion(mesa, x, y, otras, separacion, sala) ??
        buscarHueco(mesa, x, y, otras, separacion, sala);

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
    [guardar, mesas, registrar, sala, separacion, slug],
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
            pos_x: sala.ancho / 2,
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
      sala.ancho / 2,
      sala.alto / 2,
      mesas,
      separacion,
      sala,
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
    const hueco = buscarHueco(
      mesa,
      mesa.pos_x,
      mesa.pos_y,
      mesas,
      separacion,
      sala,
    );
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
      plantilla.generar(cuantas, cap, enPres, separacion, sala),
      separacion,
      sala,
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
          sala,
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
    [guardar, mesas, registrar, sala, separacion, slug],
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

  /** A quién afecta el reparto, según lo que haya seleccionado. */
  const alcance: Alcance =
    seleccion.size > 0
      ? "marcados"
      : seleccionada &&
          !mesas.find((m) => m.id === seleccionada)?.is_head &&
          !mesas.find((m) => m.id === seleccionada)?.is_locked
        ? "mesa"
        : "todos";

  const etiquetaReparto =
    alcance === "marcados"
      ? `Repartir a ${seleccion.size === 1 ? "1 marcado" : `los ${seleccion.size} marcados`}`
      : alcance === "mesa"
        ? `Llenar ${mesas.find((m) => m.id === seleccionada)?.name ?? "la mesa"}`
        : "Sentar por familias";

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
    // Margen para que quepan las cotas de la sala a los lados.
    const escala = Math.min(
      (caja.width - 88) / sala.ancho,
      (caja.height - 88) / sala.alto,
    );
    setVista({
      escala,
      x: (caja.width - sala.ancho * escala) / 2,
      y: (caja.height - sala.alto * escala) / 2,
    });
  }, [sala.ancho, sala.alto]);

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

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) =>
      setLienzo({
        ancho: entrada.contentRect.width,
        alto: entrada.contentRect.height,
      }),
    );
    observador.observe(nodo);
    return () => observador.disconnect();
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

  /** Coordenadas de pantalla a centímetros de sala. */
  const aPlano = useCallback(
    (clientX: number, clientY: number) => {
      const caja = contenedor.current?.getBoundingClientRect();
      if (!caja) return null;
      return {
        x: (clientX - caja.left - vista.x) / vista.escala,
        y: (clientY - caja.top - vista.y) / vista.escala,
      };
    },
    [vista],
  );

  const mesasFuera = useMemo(
    () => mesas.filter((m) => fueraDeSala(m, sala)),
    [mesas, sala],
  );

  function cambiarSala(ancho: number, alto: number, preset: string) {
    const nueva = {
      ancho: Math.min(SALA_MAX, Math.max(SALA_MIN, Math.round(ancho))),
      alto: Math.min(SALA_MAX, Math.max(SALA_MIN, Math.round(alto))),
    };
    setSala(nueva);
    setPresetSala(preset as PresetSala);
    guardar(() =>
      actualizarSala(slug, nueva.ancho, nueva.alto, preset as PresetSala),
    );
  }

  /** Mete dentro las que se quedaron fuera. Solo cuando lo pides tú. */
  function reubicarDentro() {
    const fuera = mesas.filter((m) => fueraDeSala(m, sala));
    if (fuera.length === 0) return;

    const movidas: { id: string; x: number; y: number }[] = [];
    const trabajo = [...mesas];

    for (const mesa of fuera) {
      const otras = trabajo.filter((m) => m.id !== mesa.id);
      const dentro = encajarEnSala(
        mesa,
        mesa.rotation,
        Math.min(Math.max(mesa.pos_x, 0), sala.ancho),
        Math.min(Math.max(mesa.pos_y, 0), sala.alto),
        sala,
      );
      const destino =
        resolverPosicion(mesa, dentro.x, dentro.y, otras, separacion, sala) ??
        buscarHueco(mesa, dentro.x, dentro.y, otras, separacion, sala);
      if (!destino) continue;

      movidas.push({ id: mesa.id, x: destino.x, y: destino.y });
      const i = trabajo.findIndex((m) => m.id === mesa.id);
      trabajo[i] = { ...mesa, pos_x: destino.x, pos_y: destino.y };
    }

    if (movidas.length === 0) {
      setNota("No hay hueco dentro de la sala. Hazla más grande o quita mesas.");
      return;
    }

    const antes = new Map(mesas.map((m) => [m.id, { x: m.pos_x, y: m.pos_y }]));
    setMesas(trabajo);
    guardar(async () => {
      for (const m of movidas) await moverMesa(slug, m.id, m.x, m.y);
    });
    registrar({
      etiqueta: `Reubicar ${movidas.length} mesas`,
      deshacer: () => {
        setMesas((previas) =>
          previas.map((m) => {
            const p = antes.get(m.id);
            return p ? { ...m, pos_x: p.x, pos_y: p.y } : m;
          }),
        );
        guardar(async () => {
          for (const m of movidas) {
            const p = antes.get(m.id);
            if (p) await moverMesa(slug, m.id, p.x, p.y);
          }
        });
      },
    });
    setNota(
      `${movidas.length} ${movidas.length === 1 ? "mesa reubicada" : "mesas reubicadas"} dentro de la sala.`,
    );
  }

  /** Coloca el modelo elegido donde has pulsado. */
  function colocarModelo(clientX: number, clientY: number) {
    if (!modeloElegido) return;
    const punto = aPlano(clientX, clientY);
    if (!punto) return;

    const plantilla = {
      shape: modeloElegido.shape,
      capacity: modeloElegido.capacidad,
      template_id: modeloElegido.id,
      rotation: 0,
    };
    const destino =
      resolverPosicion(plantilla, punto.x, punto.y, mesas, separacion, sala) ??
      buscarHueco(plantilla, punto.x, punto.y, mesas, separacion, sala);

    if (!destino) {
      setNota("Ahí no cabe. Prueba en otro sitio o baja la separación.");
      return;
    }

    anadirMesas(
      [
        {
          ...plantilla,
          name: `Mesa ${mesas.filter((m) => !m.is_head).length + 1}`,
          pos_x: destino.x,
          pos_y: destino.y,
        },
      ],
      `Añadir ${modeloElegido.nombre}`,
    );
    setModeloElegido(null);
    setFantasmaMesa(null);
    setNota(null);
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
  const mesaEncima = mesas.find((m) => m.id === encima) ?? null;
  const plazas = mesas.reduce((suma, m) => suma + m.capacity, 0);

  const tramo = tramoDeEscala(vista.escala);

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
          sentados={Object.keys(asientos).length}
          mesas={mesas.length}
          plazas={plazas}
        />

        <div className="flex min-h-[80dvh] min-w-0 flex-1 flex-col lg:min-h-0">
          <BarraHerramientas
            mesas={mesas.filter((m) => !m.is_head).length}
            todasLasMesas={mesas}
            invitados={invitados}
            asientos={asientos}
            hayPresidencial={presidencial !== null}
            aSentar={aSentar}
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
            etiquetaReparto={etiquetaReparto}
            modeloElegido={modeloElegido?.id ?? null}
            onElegirModelo={(modelo) => {
              setModeloElegido(modelo);
              setFantasmaMesa(null);
            }}
            sala={sala}
            presetSala={presetSala}
            onCambiarSala={cambiarSala}
          />

          <div
            ref={contenedor}
            onPointerDown={empezarPaneo}
            onPointerMove={(e) => {
              moverPaneo(e);
              if (!modeloElegido) return;
              const punto = aPlano(e.clientX, e.clientY);
              if (punto) setFantasmaMesa(punto);
            }}
            onPointerLeave={() => setFantasmaMesa(null)}
            onPointerUp={(e) => {
              if ((e.target as HTMLElement).closest("[data-flotante]")) return;
              if (modeloElegido) {
                colocarModelo(e.clientX, e.clientY);
                return;
              }
              terminarPaneo(e);
            }}
            onPointerCancel={terminarPaneo}
            className="relative flex-1 touch-none overflow-hidden bg-canvas"
          >
            <div
              data-fondo="1"
              style={{
                width: sala.ancho,
                height: sala.alto,
                transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
                transformOrigin: "0 0",
                backgroundSize: "100px 100px",
                backgroundImage:
                  "linear-gradient(to right, color-mix(in oklch, var(--canvas-line) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--canvas-line) 55%, transparent) 1px, transparent 1px)",
                boxShadow: sombraSala(vista.escala),
              }}
              className="absolute left-0 top-0 bg-card"
            >

              {modeloElegido && fantasmaMesa && (
                <div
                  aria-hidden
                  style={{
                    left:
                      fantasmaMesa.x -
                      modeloElegido.medidas(modeloElegido.capacidad).ancho / 2,
                    top:
                      fantasmaMesa.y -
                      modeloElegido.medidas(modeloElegido.capacidad).alto / 2,
                    width: modeloElegido.medidas(modeloElegido.capacidad).ancho,
                    height: modeloElegido.medidas(modeloElegido.capacidad).alto,
                  }}
                  className="pointer-events-none absolute z-40 opacity-60"
                >
                  <MiniaturaModelo modelo={modeloElegido} />
                </div>
              )}

              {mesas.map((mesa) => (
                <MesaEnLienzo
                  key={mesa.id}
                  mesa={mesa}
                  sentados={sentadosPorMesa.get(mesa.id) ?? []}
                  grupoDe={grupoDe}
                  escala={vista.escala}
                  escalaVisual={escalaMesas}
                  halo={separacion / 2}
                  mostrarHalo={moviendoMesa || seleccionada === mesa.id}
                  mostrarSillas={verSillas}
                  resaltada={mesasResaltadas.has(mesa.id)}
                  seleccionada={seleccionada === mesa.id}
                  fijada={mesa.is_locked}
                  fuera={mesasFuera.some((m) => m.id === mesa.id)}
                  conConflicto={roto.mesas.has(mesa.id)}
                  fantasma={fantasmas.get(mesa.id)}
                  alPulsar={(e) => alPulsarMesa(mesa, e)}
                  alEntrar={(e) => {
                    if (e.pointerType !== "touch" && !arrastrado && !moviendoMesa)
                      setEncima(mesa.id);
                  }}
                  alSalir={() => setEncima(null)}
                />
              ))}
            </div>

            {/* Cotas de la sala, como en un plano de verdad. */}
            {mesas.length > 0 && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute text-[11px] font-medium tabular-nums text-muted-foreground"
                  style={{
                    left: vista.x + (sala.ancho * vista.escala) / 2,
                    top: vista.y - 20,
                    transform: "translateX(-50%)",
                  }}
                >
                  {metros(sala.ancho)}
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute text-[11px] font-medium tabular-nums text-muted-foreground"
                  style={{
                    left: vista.x - 8,
                    top: vista.y + (sala.alto * vista.escala) / 2,
                    transform: "translate(-100%, -50%)",
                  }}
                >
                  {metros(sala.alto)}
                </span>
              </>
            )}

            {/* Tarjeta de la mesa bajo el ratón. En táctil se usa el panel lateral. */}
            {mesaEncima && !arrastrado && !moviendoMesa && (
              <TarjetaMesa
                mesa={mesaEncima}
                sentados={ordenarPorFamilia(
                  sentadosPorMesa.get(mesaEncima.id) ?? [],
                  grupoDe,
                )}
                grupoDe={grupoDe}
                x={vista.x + mesaEncima.pos_x * vista.escala}
                arriba={
                  vista.y +
                  (mesaEncima.pos_y -
                    (tamanoMesa(mesaEncima).alto / 2) * escalaMesas -
                    55) *
                    vista.escala
                }
                abajo={
                  vista.y +
                  (mesaEncima.pos_y +
                    (tamanoMesa(mesaEncima).alto / 2) * escalaMesas +
                    55) *
                    vista.escala
                }
                lienzo={lienzo}
              />
            )}

            {/* Escala gráfica */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <span>{metros(tramo)}</span>
              <span
                className="h-1.5 border-x border-b border-foreground/50"
                style={{ width: tramo * vista.escala }}
              />
            </div>

            {/* Zoom y tamaño de las mesas */}
            <div
              data-flotante
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 z-30 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-sm backdrop-blur"
            >
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => ponerEscala(vista.escala / 1.25)}
                aria-label="Alejar"
              >
                <Minus aria-hidden className="size-4" />
              </Button>
              <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(vista.escala * 100)}%
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => ponerEscala(vista.escala * 1.25)}
                aria-label="Acercar"
              >
                <Plus aria-hidden className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={ajustar}
                aria-label="Ver la sala entera"
                title="Ver la sala entera"
              >
                <Maximize2 aria-hidden className="size-4" />
              </Button>

              <span aria-hidden className="mx-1 h-5 w-px bg-border" />

              <label
                htmlFor="escala-mesas"
                className="pl-1 text-xs text-muted-foreground"
              >
                Mesas
              </label>
              <input
                id="escala-mesas"
                type="range"
                min={ESCALA_VISUAL_MIN}
                max={ESCALA_VISUAL_MAX}
                step={0.05}
                value={escalaElegida}
                onChange={(e) => guardarEscala(e.target.value)}
                aria-valuetext={`${Math.round(escalaElegida * 100)} % del tamaño real`}
                className="w-20 accent-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => guardarEscala("auto")}
                aria-pressed={modoEscala === "auto"}
                title="El mayor tamaño que no hace chocar mesas en pantalla"
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  modoEscala === "auto"
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Auto
              </button>
            </div>

            {/* Avisos: flotan sobre el plano en lugar de empujarlo hacia abajo. */}
            <div
              data-flotante
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex flex-col items-center gap-2 px-4"
            >
              {vistaExagerada && (
                <Aviso tono="suave">
                  Las mesas se ven más grandes de lo que caben: la vista no es
                  fiel al montaje.
                </Aviso>
              )}

              {mesasFuera.length > 0 && (
                <Aviso tono="peligro">
                  {mesasFuera.length}{" "}
                  {mesasFuera.length === 1
                    ? "mesa se queda fuera de la sala"
                    : "mesas se quedan fuera de la sala"}
                  . No he movido ni borrado nada.
                  <Button size="sm" variant="secondary" onClick={reubicarDentro}>
                    Meterlas dentro
                  </Button>
                </Aviso>
              )}

              {nota && (
                <Aviso tono="suave" onCerrar={() => setNota(null)}>
                  {nota}
                </Aviso>
              )}

              {modeloElegido && (
                <Aviso tono="fuerte" onCerrar={() => setModeloElegido(null)}>
                  Pulsa en el plano para colocar {modeloElegido.nombre}.
                </Aviso>
              )}

              {seleccion.size > 0 && !propuesta && (
                <Aviso tono="fuerte" onCerrar={() => setSeleccion(new Set())}>
                  {seleccion.size === 1
                    ? "1 marcado"
                    : `${seleccion.size} marcados`}
                  . Pulsa una mesa para sentarlos.
                </Aviso>
              )}

              {propuesta && (
                <Aviso tono="fuerte">
                  {propuesta.resumen}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={aplicarPropuesta}
                  >
                    Aplicar
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPropuesta(null)}
                    className="text-sm underline underline-offset-4"
                  >
                    Descartar
                  </button>
                </Aviso>
              )}
            </div>

            {mesas.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <p className="max-w-sm text-center text-muted-foreground">
                  Aún no hay mesas. Pulsa <b>Plantillas</b> y te monto la sala
                  entera, presidencial incluida.
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

function Aviso({
  tono,
  children,
  onCerrar,
}: {
  tono: "fuerte" | "suave" | "peligro";
  children: React.ReactNode;
  onCerrar?: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-2.5 text-sm shadow-lg",
        tono === "fuerte" && "bg-foreground text-background",
        tono === "suave" && "border border-border bg-card text-foreground",
        tono === "peligro" &&
          "border border-destructive/30 bg-card text-destructive",
      )}
    >
      {children}
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el aviso"
          className="-mr-1 rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Quién se sienta en la mesa, al pasar el ratón por encima. */
function TarjetaMesa({
  mesa,
  sentados,
  grupoDe,
  x,
  arriba,
  abajo,
  lienzo,
}: {
  mesa: Mesa;
  sentados: Invitado[];
  grupoDe: (invitado: Invitado) => GrupoInvitados | undefined;
  x: number;
  arriba: number;
  abajo: number;
  lienzo: { ancho: number; alto: number };
}) {
  const libres = mesa.capacity - sentados.length;
  const visibles = sentados.slice(0, 12);

  // Encima de la mesa si cabe; si no, debajo. Y nunca fuera por los lados.
  const altoTarjeta = 76 + Math.min(sentados.length, 13) * 21;
  const debajo = arriba - altoTarjeta < 8;
  const mitad = 124;
  const izquierda =
    lienzo.ancho > mitad * 2
      ? Math.min(Math.max(x, mitad + 8), lienzo.ancho - mitad - 8)
      : x;

  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-40 w-60 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
        !debajo && "-translate-y-full",
      )}
      style={{ left: izquierda, top: debajo ? abajo : arriba }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-display text-base">{mesa.name}</p>
        <p
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            libres < 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {mesa.capacity === 0 ? "De pie" : `${sentados.length}/${mesa.capacity}`}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {mesa.capacity === 0
          ? "Mesa de cóctel, sin sillas"
          : libres > 0
            ? `${libres} ${libres === 1 ? "sitio libre" : "sitios libres"}`
            : libres === 0
              ? "Completa"
              : `Te has pasado en ${-libres}`}
      </p>

      {sentados.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {visibles.map((invitado) => {
            const bando = grupoDe(invitado)?.side;
            return (
              <li key={invitado.id} className="flex items-center gap-2 text-[13px]">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    bando ? PUNTO_BANDO[bando] : "bg-foreground/25",
                  )}
                />
                <span className="truncate">{invitado.full_name}</span>
              </li>
            );
          })}
          {sentados.length > visibles.length && (
            <li className="text-xs text-muted-foreground">
              y {sentados.length - visibles.length} más
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
