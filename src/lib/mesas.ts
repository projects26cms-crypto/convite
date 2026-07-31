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
  let actual = encajarEnSala(mesa, mesa.rotation, x, y);

  for (let intento = 0; intento < 40; intento++) {
    const discos = discosDe(mesa, actual.x, actual.y, mesa.rotation);
    let movida = false;

    for (const vecina of vecinas) {
      const empuje = invasion(discos, vecina, separacion);
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
  const { mitadAncho, mitadAlto } = envolvente(mesa, mesa.rotation);
  const paso = Math.max(mitadAncho, mitadAlto) + separacion;

  for (let anillo = 1; anillo <= 8; anillo++) {
    for (let i = 0; i < anillo * 8; i++) {
      const angulo = (i / (anillo * 8)) * Math.PI * 2;
      const candidata = encajarEnSala(
        mesa,
        mesa.rotation,
        desdeX + Math.cos(angulo) * paso * anillo,
        desdeY + Math.sin(angulo) * paso * anillo,
      );
      if (haySitio(mesa, candidata.x, candidata.y, vecinas, separacion)) {
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
  generar: (cuantas: number, capacidad: number, enPresidencial: number) => MesaNueva[];
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

/** Mesas redondas en rejilla, debajo de la presidencial. */
function enRejilla(cuantas: number, cap: number, enPres: number): MesaNueva[] {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const { ancho } = tamanoMesa({ shape: "redonda", capacity: cap });
  const paso = ancho + SEPARACIONES.holgado.cm;
  const columnas = Math.max(
    1,
    Math.min(Math.floor((SALA.ancho - 100) / paso), Math.ceil(Math.sqrt(cuantas * 1.6))),
  );
  const filas = Math.ceil(cuantas / columnas);

  const inicioX = (SALA.ancho - (columnas - 1) * paso) / 2;
  const arriba = 190 + tamanoMesa(cabecera).alto / 2 + SEPARACIONES.holgado.cm + ancho / 2;
  const disponible = SALA.alto - arriba - ancho / 2 - 40;
  const pasoY = filas > 1 ? Math.min(paso, disponible / (filas - 1)) : 0;

  return [
    cabecera,
    ...Array.from({ length: cuantas }, (_, i) =>
      redonda(
        `Mesa ${i + 1}`,
        cap,
        inicioX + (i % columnas) * paso,
        arriba + Math.floor(i / columnas) * pasoY,
      ),
    ),
  ];
}

/** Presidencial arriba y el resto abriéndose en U hacia ella. */
function enHerradura(cuantas: number, cap: number, enPres: number): MesaNueva[] {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const { ancho } = tamanoMesa({ shape: "redonda", capacity: cap });
  const radioX = Math.min(760, SALA.ancho / 2 - ancho / 2 - 60);
  const radioY = Math.min(430, SALA.alto - 900);
  const centroX = SALA.ancho / 2;
  const centroY = 880;

  const mesas = Array.from({ length: cuantas }, (_, i) => {
    const grados = cuantas === 1 ? 0 : -100 + (200 / (cuantas - 1)) * i;
    const rad = (grados * Math.PI) / 180;
    return redonda(
      `Mesa ${i + 1}`,
      cap,
      centroX + Math.sin(rad) * radioX,
      centroY - Math.cos(rad) * radioY,
    );
  });

  return [cabecera, ...mesas];
}

/** Imperiales en paralelo, presidiendo la presidencial. */
function enFilas(cuantas: number, cap: number, enPres: number): MesaNueva[] {
  const cabecera = presidencial(enPres);
  if (cuantas <= 0) return [cabecera];

  const capLarga = Math.max(cap, 12);
  const { ancho, alto } = tamanoMesa({ shape: "imperial", capacity: capLarga });
  const columnas = Math.max(
    1,
    Math.min(cuantas, Math.floor((SALA.ancho - 100) / (ancho + SEPARACIONES.holgado.cm))),
  );
  const filas = Math.ceil(cuantas / columnas);
  const pasoX = ancho + SEPARACIONES.holgado.cm;
  const pasoY = alto + SEPARACIONES.holgado.cm;

  const inicioX = (SALA.ancho - (columnas - 1) * pasoX) / 2;
  const arriba = 190 + tamanoMesa(cabecera).alto / 2 + SEPARACIONES.holgado.cm + alto / 2;
  const disponible = SALA.alto - arriba - alto / 2 - 40;
  const pasoReal = filas > 1 ? Math.min(pasoY, disponible / (filas - 1)) : 0;

  return [
    cabecera,
    ...Array.from({ length: cuantas }, (_, i) => ({
      name: `Mesa ${i + 1}`,
      shape: "imperial" as const,
      capacity: capLarga,
      pos_x: ajustarARejilla(inicioX + (i % columnas) * pasoX),
      pos_y: ajustarARejilla(arriba + Math.floor(i / columnas) * pasoReal),
      rotation: 0,
    })),
  ];
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
