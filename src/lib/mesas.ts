import type { FormaMesa, Mesa } from "@/lib/tipos";

/**
 * El lienzo mide en centímetros reales. Sin escala real no se puede exigir la
 * separación de protocolo ni imprimir un plano fiable.
 */
export const SALA = { ancho: 2000, alto: 1400 };
export const REJILLA = 10;

/**
 * Separación entre bordes de mesa. El protocolo de banquete pide 1,50 m:
 * 60 cm para retirar la silla en cada mesa más 30 cm de paso. Se puede apretar
 * cuando la sala no da para más.
 */
export const SEPARACIONES = {
  holgado: { cm: 150, etiqueta: "Holgado", pie: "1,50 m · protocolo" },
  ajustado: { cm: 120, etiqueta: "Ajustado", pie: "1,20 m · salas justas" },
  apretado: { cm: 100, etiqueta: "Apretado", pie: "1,00 m · mínimo" },
} as const;

export type NivelSeparacion = keyof typeof SEPARACIONES;

export type MesaNueva = {
  name: string;
  shape: FormaMesa;
  capacity: number;
  pos_x: number;
  pos_y: number;
  rotation: number;
  is_head?: boolean;
};

type Geometria = Pick<Mesa, "shape" | "capacity">;

/**
 * Medidas del mercado español: redonda de 150 cm para 8, de 180 cm para 10.
 * Rectangular de 80 cm de ancho y 60 cm de largo por comensal.
 */
export function tamanoMesa(mesa: Geometria): { ancho: number; alto: number } {
  const plazas = Math.max(1, mesa.capacity);

  switch (mesa.shape) {
    case "redonda": {
      const diametro = Math.max(120, Math.round(plazas * 18));
      return { ancho: diametro, alto: diametro };
    }
    case "rectangular":
      return { ancho: Math.max(180, Math.ceil(plazas / 2) * 60), alto: 80 };
    case "imperial":
      return { ancho: Math.max(300, Math.ceil(plazas / 2) * 65), alto: 100 };
  }
}

// ---------------------------------------------------------------------------
// Colisión: cada mesa se aproxima por discos a lo largo de su eje largo. Así
// la comprobación funciona igual con mesas giradas y sin trigonometría pesada.
// ---------------------------------------------------------------------------

export type Disco = { x: number; y: number; r: number };

export function discosDe(
  mesa: Geometria,
  x: number,
  y: number,
  rotacion: number,
): Disco[] {
  const { ancho, alto } = tamanoMesa(mesa);

  if (mesa.shape === "redonda") return [{ x, y, r: ancho / 2 }];

  const radio = alto / 2;
  const recorrido = Math.max(0, ancho - alto);
  const cuantos = Math.max(2, Math.ceil(ancho / alto) + 1);
  const rad = (rotacion * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);

  return Array.from({ length: cuantos }, (_, i) => {
    const t = cuantos === 1 ? 0 : -recorrido / 2 + (recorrido / (cuantos - 1)) * i;
    return { x: x + t * cos, y: y + t * sen, r: radio };
  });
}

/** Media anchura y media altura del rectángulo que envuelve a la mesa girada. */
export function envolvente(
  mesa: Geometria,
  rotacion: number,
): { mitadAncho: number; mitadAlto: number } {
  const { ancho, alto } = tamanoMesa(mesa);
  if (mesa.shape === "redonda") {
    return { mitadAncho: ancho / 2, mitadAlto: alto / 2 };
  }
  const rad = (rotacion * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sen = Math.abs(Math.sin(rad));
  return {
    mitadAncho: (ancho * cos + alto * sen) / 2,
    mitadAlto: (ancho * sen + alto * cos) / 2,
  };
}

export function ajustarARejilla(valor: number): number {
  return Math.round(valor / REJILLA) * REJILLA;
}

export function encajarEnSala(
  mesa: Geometria,
  rotacion: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const { mitadAncho, mitadAlto } = envolvente(mesa, rotacion);
  const margen = 20;
  return {
    x: Math.min(
      Math.max(x, mitadAncho + margen),
      SALA.ancho - mitadAncho - margen,
    ),
    y: Math.min(Math.max(y, mitadAlto + margen), SALA.alto - mitadAlto - margen),
  };
}

type Vecina = Pick<Mesa, "id" | "shape" | "capacity" | "pos_x" | "pos_y" | "rotation">;

function invasion(
  discos: Disco[],
  vecina: Vecina,
  separacion: number,
): { dx: number; dy: number } | null {
  const otros = discosDe(vecina, vecina.pos_x, vecina.pos_y, vecina.rotation);
  let peor = 0;
  let empuje = { dx: 0, dy: 0 };

  for (const a of discos) {
    for (const b of otros) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distancia = Math.hypot(dx, dy) || 0.01;
      const minima = a.r + b.r + separacion;
      const solape = minima - distancia;
      if (solape > peor) {
        peor = solape;
        empuje = { dx: (dx / distancia) * solape, dy: (dy / distancia) * solape };
      }
    }
  }

  return peor > 0.5 ? empuje : null;
}

export function haySitio(
  mesa: Geometria & { rotation: number },
  x: number,
  y: number,
  vecinas: Vecina[],
  separacion: number,
): boolean {
  const discos = discosDe(mesa, x, y, mesa.rotation);
  return vecinas.every((v) => invasion(discos, v, separacion) === null);
}

/**
 * Busca la posición válida más cercana empujando la mesa fuera de sus vecinas.
 * Devuelve null si tras varios intentos sigue sin caber: entonces la mesa
 * vuelve de donde salió en vez de quedarse encima de otra.
 */
export function resolverPosicion(
  mesa: Geometria & { rotation: number },
  x: number,
  y: number,
  vecinas: Vecina[],
  separacion: number,
): { x: number; y: number } | null {
  // Con margen de una casilla: al redondear a la rejilla se pierden unos
  // centímetros, y la separación no puede quedar por debajo del mínimo.
  const objetivo = separacion + REJILLA;
  let actual = encajarEnSala(mesa, mesa.rotation, x, y);

  for (let intento = 0; intento < 40; intento++) {
    const discos = discosDe(mesa, actual.x, actual.y, mesa.rotation);
    let movida = false;

    for (const vecina of vecinas) {
      const empuje = invasion(discos, vecina, objetivo);
      if (!empuje) continue;
      actual = encajarEnSala(
        mesa,
        mesa.rotation,
        actual.x + empuje.dx,
        actual.y + empuje.dy,
      );
      movida = true;
      break;
    }

    if (!movida) {
      return {
        x: ajustarARejilla(actual.x),
        y: ajustarARejilla(actual.y),
      };
    }
  }

  return null;
}

/** Primer hueco libre en espiral alrededor de un punto. Para duplicar mesas. */
export function buscarHueco(
  mesa: Geometria & { rotation: number },
  desdeX: number,
  desdeY: number,
  vecinas: Vecina[],
  separacion: number,
): { x: number; y: number } | null {
  const objetivo = separacion + REJILLA;
  const { mitadAncho, mitadAlto } = envolvente(mesa, mesa.rotation);
  const paso = Math.max(mitadAncho, mitadAlto) + objetivo;

  for (let anillo = 1; anillo <= 8; anillo++) {
    for (let i = 0; i < anillo * 8; i++) {
      const angulo = (i / (anillo * 8)) * Math.PI * 2;
      const candidata = encajarEnSala(
        mesa,
        mesa.rotation,
        desdeX + Math.cos(angulo) * paso * anillo,
        desdeY + Math.sin(angulo) * paso * anillo,
      );
      if (haySitio(mesa, candidata.x, candidata.y, vecinas, objetivo)) {
        return {
          x: ajustarARejilla(candidata.x),
          y: ajustarARejilla(candidata.y),
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Presidencial
// ---------------------------------------------------------------------------

/**
 * El protocolo clásico son seis: los novios en el centro y los padrinos con
 * sus parejas. Las otras dos son las alternativas que más se ven hoy.
 */
export const FORMATOS_PRESIDENCIAL = [
  {
    plazas: 2,
    shape: "rectangular" as const,
    nombre: "Solo los novios",
    pie: "Mesa dulce, los dos solos",
  },
  {
    plazas: 6,
    shape: "rectangular" as const,
    nombre: "Novios y padrinos",
    pie: "El protocolo clásico",
  },
  {
    plazas: 12,
    shape: "imperial" as const,
    nombre: "Familia al completo",
    pie: "Padres, hermanos y testigos",
  },
];

export const PRESIDENCIAL_POR_DEFECTO = FORMATOS_PRESIDENCIAL[1];

function presidencial(plazas = PRESIDENCIAL_POR_DEFECTO.plazas): MesaNueva {
  const formato =
    FORMATOS_PRESIDENCIAL.find((f) => f.plazas === plazas) ??
    PRESIDENCIAL_POR_DEFECTO;

  return {
    name: "Presidencial",
    shape: formato.shape,
    capacity: formato.plazas,
    pos_x: ajustarARejilla(SALA.ancho / 2),
    pos_y: 190,
    rotation: 0,
    is_head: true,
  };
}

// ---------------------------------------------------------------------------
// Sugerencia y plantillas
// ---------------------------------------------------------------------------

export const CAPACIDAD_POR_DEFECTO = 10;

/** Mesas necesarias sin contar a quien se sienta en la presidencial. */
export function sugerirMesas(
  personas: number,
  capacidad = CAPACIDAD_POR_DEFECTO,
  enPresidencial = PRESIDENCIAL_POR_DEFECTO.plazas,
): number {
  const restantes = Math.max(0, personas - enPresidencial);
  if (restantes === 0) return 0;
  return Math.ceil(restantes / Math.max(1, capacidad));
}

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string;
  generar: (
    cuantas: number,
    capacidad: number,
    enPresidencial: number,
    separacion: number,
  ) => MesaNueva[];
};

function redonda(nombre: string, cap: number, x: number, y: number): MesaNueva {
  return {
    name: nombre,
    shape: "redonda",
    capacity: cap,
    pos_x: ajustarARejilla(x),
    pos_y: ajustarARejilla(y),
    rotation: 0,
  };
}

/** Dónde empieza la zona de invitados: debajo de la presidencial y su paso. */
function bajoPresidencial(cabecera: MesaNueva, altoMesa: number, sep: number) {
  return cabecera.pos_y + tamanoMesa(cabecera).alto / 2 + sep + altoMesa / 2;
}

/** Mesas redondas en rejilla, debajo de la presidencial. */
function enRejilla(cuantas: number, cap: number, enPres: number, sep: number) {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const { ancho } = tamanoMesa({ shape: "redonda", capacity: cap });
  const paso = ancho + sep;
  const columnas = Math.max(
    1,
    Math.min(cuantas, Math.floor((SALA.ancho - 80) / paso)),
  );

  const inicioX = (SALA.ancho - (columnas - 1) * paso) / 2;
  const arriba = bajoPresidencial(cabecera, ancho, sep);

  return [
    cabecera,
    ...Array.from({ length: cuantas }, (_, i) =>
      redonda(
        `Mesa ${i + 1}`,
        cap,
        inicioX + (i % columnas) * paso,
        arriba + Math.floor(i / columnas) * paso,
      ),
    ),
  ];
}

/**
 * Presidencial arriba y el resto abriéndose en U hacia ella. En cuanto no
 * caben en un arco, se abre otro por detrás: una herradura de 15 mesas no
 * entra en una sola fila respetando el metro y medio.
 */
function enHerradura(cuantas: number, cap: number, enPres: number, sep: number) {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const { ancho } = tamanoMesa({ shape: "redonda", capacity: cap });
  const paso = ancho + sep;
  const centroX = SALA.ancho / 2;
  const centroY = bajoPresidencial(cabecera, ancho, sep) - ancho / 2;

  const mesas: MesaNueva[] = [];
  let radio = paso * 0.85;

  while (mesas.length < cuantas && radio < SALA.alto) {
    const arco = (200 * Math.PI) / 180;
    const caben = Math.max(1, Math.floor((arco * radio) / paso) + 1);
    const enEsteAnillo = Math.min(caben, cuantas - mesas.length);

    for (let i = 0; i < enEsteAnillo; i++) {
      const grados =
        enEsteAnillo === 1 ? 0 : -100 + (200 / (enEsteAnillo - 1)) * i;
      const rad = (grados * Math.PI) / 180;
      mesas.push(
        redonda(
          `Mesa ${mesas.length + 1}`,
          cap,
          centroX + Math.sin(rad) * radio,
          centroY + (1 - Math.cos(rad)) * radio * 0.55 + radio * 0.45,
        ),
      );
    }
    radio += paso;
  }

  return [cabecera, ...mesas];
}

/** Imperiales en paralelo, presidiendo la presidencial. */
function enFilas(cuantas: number, cap: number, enPres: number, sep: number) {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const capLarga = Math.max(cap, 12);
  const { ancho, alto } = tamanoMesa({
    shape: "imperial",
    capacity: capLarga,
  });
  const pasoX = ancho + sep;
  const pasoY = alto + sep;
  const columnas = Math.max(
    1,
    Math.min(cuantas, Math.floor((SALA.ancho - 80) / pasoX)),
  );

  const inicioX = (SALA.ancho - (columnas - 1) * pasoX) / 2;
  const arriba = bajoPresidencial(cabecera, alto, sep);

  return [
    cabecera,
    ...Array.from({ length: cuantas }, (_, i) => ({
      name: `Mesa ${i + 1}`,
      shape: "imperial" as const,
      capacity: capLarga,
      pos_x: ajustarARejilla(inicioX + (i % columnas) * pasoX),
      pos_y: ajustarARejilla(arriba + Math.floor(i / columnas) * pasoY),
      rotation: 0,
    })),
  ];
}

/**
 * Red de seguridad: ninguna plantilla puede devolver mesas encima de otras.
 * Coloca una a una respetando la separación y descarta las que no caben en la
 * sala, en vez de amontonarlas.
 */
export function distribuirSinSolapes(
  mesas: MesaNueva[],
  separacion: number,
): { colocadas: MesaNueva[]; descartadas: number } {
  const colocadas: MesaNueva[] = [];
  let descartadas = 0;

  for (const mesa of mesas) {
    const yaPuestas = colocadas.map((m, i) => ({
      id: `p${i}`,
      shape: m.shape,
      capacity: m.capacity,
      pos_x: m.pos_x,
      pos_y: m.pos_y,
      rotation: m.rotation,
    }));

    const destino =
      resolverPosicion(mesa, mesa.pos_x, mesa.pos_y, yaPuestas, separacion) ??
      buscarHueco(mesa, mesa.pos_x, mesa.pos_y, yaPuestas, separacion);

    if (!destino) {
      descartadas++;
      continue;
    }
    colocadas.push({ ...mesa, pos_x: destino.x, pos_y: destino.y });
  }

  return { colocadas, descartadas };
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: "rejilla",
    nombre: "Banquete",
    descripcion: "Redondas en rejilla frente a la presidencial",
    generar: enRejilla,
  },
  {
    id: "herradura",
    nombre: "Herradura",
    descripcion: "Las mesas se abren en U hacia los novios",
    generar: enHerradura,
  },
  {
    id: "filas",
    nombre: "Mesas largas",
    descripcion: "Imperiales en paralelo",
    generar: enFilas,
  },
];
