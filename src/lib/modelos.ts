import type { FormaMesa } from "@/lib/tipos";

/**
 * Catálogo de modelos de mesa.
 *
 * Única fuente de verdad de la geometría: de aquí salen las medidas, el
 * contorno que se dibuja y la posición de cada silla. Lo usan por igual el
 * plano y las miniaturas del selector, así que no pueden desincronizarse.
 *
 * Todo en centímetros reales. Nada de este fichero conoce la escala de render.
 */

/** Separación entre el borde de la mesa y el centro de la silla. */
export const SILLA_FUERA = 34;
export const SILLA_RADIO = 15;

/** Sitio que se reserva por comensal a lo largo del borde. */
const POR_COMENSAL = 60;

export type Lado = "arriba" | "abajo" | "izquierda" | "derecha";

export type Pieza = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Lados de esta pieza donde se sienta gente. */
  lados: Lado[];
};

export type Contorno =
  | { tipo: "circulo"; diametro: number; conSillas: boolean }
  | { tipo: "media_luna"; diametro: number }
  | { tipo: "piezas"; piezas: Pieza[] };

export type ModeloMesa = {
  id: string;
  nombre: string;
  descripcion: string;
  shape: FormaMesa;
  capacidad: number;
  minimo: number;
  maximo: number;
  /** Medidas del rectángulo que envuelve la mesa, en cm. */
  medidas: (capacidad: number) => { ancho: number; alto: number };
  contorno: (capacidad: number) => Contorno;
};

const aDiez = (valor: number) => Math.max(10, Math.round(valor / 10) * 10);

/** Escala lineal desde las medidas de referencia del modelo. */
function escalar(base: number, capacidad: number, capacidadBase: number) {
  return aDiez((base * Math.max(1, capacidad)) / capacidadBase);
}

function redonda(
  id: string,
  nombre: string,
  diametroBase: number,
  capacidadBase: number,
  minimo: number,
  maximo: number,
): ModeloMesa {
  const medidas = (capacidad: number) => {
    const d = escalar(diametroBase, capacidad, capacidadBase);
    return { ancho: d, alto: d };
  };
  return {
    id,
    nombre,
    descripcion: `Redonda de ${(diametroBase / 100).toLocaleString("es-ES")} m`,
    shape: "redonda",
    capacidad: capacidadBase,
    minimo,
    maximo,
    medidas,
    contorno: (capacidad) => ({
      tipo: "circulo",
      diametro: medidas(capacidad).ancho,
      conSillas: true,
    }),
  };
}

function alargada(
  id: string,
  nombre: string,
  descripcion: string,
  shape: FormaMesa,
  largoBase: number,
  fondo: number,
  capacidadBase: number,
  minimo: number,
  maximo: number,
  soloUnLado = false,
): ModeloMesa {
  const medidas = (capacidad: number) => ({
    ancho: Math.max(fondo * 2, escalar(largoBase, capacidad, capacidadBase)),
    alto: fondo,
  });
  return {
    id,
    nombre,
    descripcion,
    shape,
    capacidad: capacidadBase,
    minimo,
    maximo,
    medidas,
    contorno: (capacidad) => {
      const { ancho, alto } = medidas(capacidad);
      return {
        tipo: "piezas",
        piezas: [
          {
            x: 0,
            y: 0,
            ancho,
            alto,
            lados: soloUnLado
              ? ["arriba"]
              : ["arriba", "abajo", "izquierda", "derecha"],
          },
        ],
      };
    },
  };
}

/** Barra superior y dos brazos. La gente se sienta por fuera de la U. */
function enU(): ModeloMesa {
  const fondo = 80;
  const medidas = (capacidad: number) => {
    const porLado = Math.max(1, Math.round(capacidad / 3));
    return {
      ancho: aDiez(Math.max(300, porLado * POR_COMENSAL)),
      alto: aDiez(Math.max(300, porLado * POR_COMENSAL * 1.1)),
    };
  };

  return {
    id: "u",
    nombre: "Mesa en U",
    descripcion: "Barra y dos brazos, la gente por fuera",
    shape: "u",
    capacidad: 18,
    minimo: 12,
    maximo: 30,
    medidas,
    contorno: (capacidad) => {
      const { ancho, alto } = medidas(capacidad);
      return {
        tipo: "piezas",
        piezas: [
          { x: 0, y: 0, ancho, alto: fondo, lados: ["arriba"] },
          {
            x: 0,
            y: fondo,
            ancho: fondo,
            alto: alto - fondo,
            lados: ["izquierda", "abajo"],
          },
          {
            x: ancho - fondo,
            y: fondo,
            ancho: fondo,
            alto: alto - fondo,
            lados: ["derecha", "abajo"],
          },
        ],
      };
    },
  };
}

/** Espina y tres dientes. La gente se sienta a ambos lados de los dientes. */
function enE(): ModeloMesa {
  const fondo = 80;
  const medidas = (capacidad: number) => {
    const porDiente = Math.max(1, Math.round(capacidad / 6));
    return {
      ancho: aDiez(Math.max(300, porDiente * POR_COMENSAL + fondo)),
      alto: aDiez(Math.max(400, fondo * 3 + 2 * 140)),
    };
  };

  return {
    id: "e",
    nombre: "Mesa en E",
    descripcion: "Espina con tres dientes",
    shape: "e",
    capacidad: 26,
    minimo: 18,
    maximo: 40,
    medidas,
    contorno: (capacidad) => {
      const { ancho, alto } = medidas(capacidad);
      const largoDiente = ancho - fondo;
      const separacion = (alto - fondo) / 2;

      return {
        tipo: "piezas",
        piezas: [
          { x: 0, y: 0, ancho: fondo, alto, lados: ["izquierda"] },
          ...[0, 1, 2].map((i) => ({
            x: fondo,
            y: Math.min(alto - fondo, i * separacion),
            ancho: largoDiente,
            alto: fondo,
            lados: ["arriba", "abajo", "derecha"] as Lado[],
          })),
        ],
      };
    },
  };
}

export const MODELOS: ModeloMesa[] = [
  redonda("redonda-8", "Redonda 8", 150, 8, 6, 10),
  redonda("redonda-10", "Redonda 10", 180, 10, 8, 12),
  redonda("redonda-12", "Redonda 12", 200, 12, 10, 14),
  {
    id: "cuadrada-4",
    nombre: "Cuadrada 4",
    descripcion: "Cuadrada de 1 m",
    shape: "cuadrada",
    capacidad: 4,
    minimo: 4,
    maximo: 4,
    medidas: () => ({ ancho: 100, alto: 100 }),
    contorno: () => ({
      tipo: "piezas",
      piezas: [
        {
          x: 0,
          y: 0,
          ancho: 100,
          alto: 100,
          lados: ["arriba", "abajo", "izquierda", "derecha"],
        },
      ],
    }),
  },
  {
    id: "cuadrada-8",
    nombre: "Cuadrada 8",
    descripcion: "Cuadrada de 1,50 m",
    shape: "cuadrada",
    capacidad: 8,
    minimo: 8,
    maximo: 8,
    medidas: () => ({ ancho: 150, alto: 150 }),
    contorno: () => ({
      tipo: "piezas",
      piezas: [
        {
          x: 0,
          y: 0,
          ancho: 150,
          alto: 150,
          lados: ["arriba", "abajo", "izquierda", "derecha"],
        },
      ],
    }),
  },
  alargada(
    "rectangular-8",
    "Rectangular 8",
    "Rectangular de 2 x 1 m",
    "rectangular",
    200,
    100,
    8,
    6,
    10,
  ),
  alargada(
    "imperial",
    "Imperial",
    "Mesa larga de 4 m",
    "imperial",
    400,
    120,
    14,
    10,
    20,
  ),
  alargada(
    "presidencial",
    "Presidencial",
    "Sillas solo en un lado, mirando a la sala",
    "presidencial",
    300,
    80,
    6,
    4,
    12,
    true,
  ),
  enU(),
  enE(),
  {
    id: "media-luna",
    nombre: "Media luna",
    descripcion: "Semicírculo de 1,80 m",
    shape: "media_luna",
    capacidad: 5,
    minimo: 4,
    maximo: 7,
    medidas: (capacidad) => {
      const d = escalar(180, capacidad, 5);
      return { ancho: d, alto: aDiez(d / 2) };
    },
    contorno: (capacidad) => ({
      tipo: "media_luna",
      diametro: escalar(180, capacidad, 5),
    }),
  },
  {
    id: "coctel",
    nombre: "Cóctel alta",
    descripcion: "De pie, sin sillas",
    shape: "coctel",
    capacidad: 0,
    minimo: 0,
    maximo: 0,
    medidas: () => ({ ancho: 80, alto: 80 }),
    contorno: () => ({ tipo: "circulo", diametro: 80, conSillas: false }),
  },
];

const PORID = new Map(MODELOS.map((m) => [m.id, m]));

export function modeloPorId(id: string | null | undefined) {
  return id ? PORID.get(id) : undefined;
}

/** Modelo que mejor casa con una mesa que no lo tiene guardado todavía. */
export function modeloEquivalente(
  shape: FormaMesa,
  capacidad: number,
  esPresidencial = false,
): ModeloMesa {
  if (esPresidencial) return PORID.get("presidencial")!;
  const mismos = MODELOS.filter((m) => m.shape === shape);
  if (mismos.length === 0) return PORID.get("redonda-10")!;
  return mismos.reduce((mejor, actual) =>
    Math.abs(actual.capacidad - capacidad) < Math.abs(mejor.capacidad - capacidad)
      ? actual
      : mejor,
  );
}

// ---------------------------------------------------------------------------
// Sillas
// ---------------------------------------------------------------------------

export type Silla = { x: number; y: number };

const NORMALES: Record<Lado, { x: number; y: number }> = {
  arriba: { x: 0, y: -1 },
  abajo: { x: 0, y: 1 },
  izquierda: { x: -1, y: 0 },
  derecha: { x: 1, y: 0 },
};

function bordeDe(pieza: Pieza, lado: Lado) {
  const { x, y, ancho, alto } = pieza;
  switch (lado) {
    case "arriba":
      return { desde: { x, y }, hasta: { x: x + ancho, y }, largo: ancho };
    case "abajo":
      return {
        desde: { x, y: y + alto },
        hasta: { x: x + ancho, y: y + alto },
        largo: ancho,
      };
    case "izquierda":
      return { desde: { x, y }, hasta: { x, y: y + alto }, largo: alto };
    case "derecha":
      return {
        desde: { x: x + ancho, y },
        hasta: { x: x + ancho, y: y + alto },
        largo: alto,
      };
  }
}

/**
 * Posición de cada silla en coordenadas locales de la mesa, con origen en la
 * esquina superior izquierda de su rectángulo envolvente.
 *
 * Las plazas se reparten entre los bordes que admiten gente, en proporción a
 * su longitud: en una mesa de 2 x 1 m caben más por el lado largo.
 */
export function sillasDe(modelo: ModeloMesa, capacidad: number): Silla[] {
  const plazas = Math.max(0, Math.round(capacidad));
  if (plazas === 0) return [];

  const contorno = modelo.contorno(plazas);
  const { ancho, alto } = modelo.medidas(plazas);

  if (contorno.tipo === "circulo") {
    if (!contorno.conSillas) return [];
    const radio = contorno.diametro / 2 + SILLA_FUERA;
    return Array.from({ length: plazas }, (_, i) => {
      const angulo = (i / plazas) * Math.PI * 2 - Math.PI / 2;
      return {
        x: ancho / 2 + Math.cos(angulo) * radio,
        y: alto / 2 + Math.sin(angulo) * radio,
      };
    });
  }

  if (contorno.tipo === "media_luna") {
    const radio = contorno.diametro / 2 + SILLA_FUERA;
    return Array.from({ length: plazas }, (_, i) => {
      const angulo = Math.PI + ((i + 0.5) / plazas) * Math.PI;
      return {
        x: ancho / 2 + Math.cos(angulo) * radio,
        y: alto + Math.sin(angulo) * radio,
      };
    });
  }

  const bordes = contorno.piezas.flatMap((pieza) =>
    pieza.lados.map((lado) => ({ ...bordeDe(pieza, lado), lado })),
  );
  const total = bordes.reduce((suma, borde) => suma + borde.largo, 0);
  if (total === 0) return [];

  // Reparto proporcional, garantizando que ningún borde se quede sin nadie
  // cuando hay plazas de sobra.
  const reparto = bordes.map((borde) =>
    Math.floor((borde.largo / total) * plazas),
  );
  let sobran = plazas - reparto.reduce((s, n) => s + n, 0);
  const orden = bordes
    .map((borde, i) => ({ i, largo: borde.largo }))
    .sort((a, b) => b.largo - a.largo);
  for (let k = 0; sobran > 0; k++, sobran--) {
    reparto[orden[k % orden.length].i]++;
  }

  const sillas: Silla[] = [];
  bordes.forEach((borde, i) => {
    const cuantas = reparto[i];
    const normal = NORMALES[borde.lado];
    for (let j = 0; j < cuantas; j++) {
      const t = (j + 0.5) / cuantas;
      sillas.push({
        x:
          borde.desde.x +
          (borde.hasta.x - borde.desde.x) * t +
          normal.x * SILLA_FUERA,
        y:
          borde.desde.y +
          (borde.hasta.y - borde.desde.y) * t +
          normal.y * SILLA_FUERA,
      });
    }
  });

  return sillas;
}
