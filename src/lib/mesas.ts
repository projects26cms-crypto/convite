import type { FormaMesa, Mesa } from "@/lib/tipos";

/**
 * El lienzo es un espacio virtual fijo. Las mesas se posicionan por su centro,
 * así que rotar o cambiar de forma no las descoloca.
 */
export const LIENZO = { ancho: 1500, alto: 1000 };
export const REJILLA = 10;

export type MesaNueva = {
  name: string;
  shape: FormaMesa;
  capacity: number;
  pos_x: number;
  pos_y: number;
  rotation: number;
};

/** Tamaño en unidades de lienzo. Una mesa de 12 ocupa más que una de 6. */
export function tamanoMesa(mesa: Pick<Mesa, "shape" | "capacity">): {
  ancho: number;
  alto: number;
} {
  const plazas = Math.max(1, mesa.capacity);

  switch (mesa.shape) {
    case "redonda": {
      const diametro = Math.round(Math.max(140, 110 + plazas * 8));
      return { ancho: diametro, alto: diametro };
    }
    case "rectangular":
      return { ancho: Math.round(100 + plazas * 18), alto: 118 };
    case "imperial":
      return { ancho: Math.round(120 + plazas * 20), alto: 140 };
  }
}

export function ajustarARejilla(valor: number): number {
  return Math.round(valor / REJILLA) * REJILLA;
}

/** Mantiene la mesa dentro del lienzo por muy lejos que se arrastre. */
export function encajarEnLienzo(
  mesa: Pick<Mesa, "shape" | "capacity">,
  x: number,
  y: number,
): { x: number; y: number } {
  const { ancho, alto } = tamanoMesa(mesa);
  const margen = 12;
  return {
    x: Math.min(
      Math.max(x, ancho / 2 + margen),
      LIENZO.ancho - ancho / 2 - margen,
    ),
    y: Math.min(
      Math.max(y, alto / 2 + margen),
      LIENZO.alto - alto / 2 - margen,
    ),
  };
}

// ---------------------------------------------------------------------------
// Sugerencia y plantillas
// ---------------------------------------------------------------------------

export const CAPACIDAD_POR_DEFECTO = 10;

export function sugerirMesas(
  personas: number,
  capacidad = CAPACIDAD_POR_DEFECTO,
): number {
  if (personas <= 0) return 0;
  return Math.ceil(personas / Math.max(1, capacidad));
}

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string;
  generar: (cuantas: number, capacidad: number) => MesaNueva[];
};

function redonda(
  nombre: string,
  capacidad: number,
  x: number,
  y: number,
): MesaNueva {
  return {
    name: nombre,
    shape: "redonda",
    capacity: capacidad,
    pos_x: ajustarARejilla(x),
    pos_y: ajustarARejilla(y),
    rotation: 0,
  };
}

/** Mesas redondas en rejilla, centradas en el lienzo. */
function enRejilla(cuantas: number, capacidad: number): MesaNueva[] {
  if (cuantas <= 0) return [];

  const columnas = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(cuantas))));
  const filas = Math.ceil(cuantas / columnas);
  const { ancho, alto } = tamanoMesa({ shape: "redonda", capacity: capacidad });
  const pasoX = ancho + 70;
  const pasoY = alto + 70;

  const inicioX = (LIENZO.ancho - (columnas - 1) * pasoX) / 2;
  const inicioY = (LIENZO.alto - (filas - 1) * pasoY) / 2;

  return Array.from({ length: cuantas }, (_, i) =>
    redonda(
      `Mesa ${i + 1}`,
      capacidad,
      inicioX + (i % columnas) * pasoX,
      inicioY + Math.floor(i / columnas) * pasoY,
    ),
  );
}

/** Presidencial arriba y el resto de mesas abriéndose en U. */
function enHerradura(cuantas: number, capacidad: number): MesaNueva[] {
  if (cuantas <= 0) return [];

  const presidencial: MesaNueva = {
    name: "Presidencial",
    shape: "rectangular",
    capacity: Math.min(12, Math.max(4, Math.round(capacidad * 0.8))),
    pos_x: ajustarARejilla(LIENZO.ancho / 2),
    pos_y: 140,
    rotation: 0,
  };

  const restantes = cuantas - 1;
  if (restantes <= 0) return [presidencial];

  const { ancho } = tamanoMesa({ shape: "redonda", capacity: capacidad });
  const radioX = Math.min(560, LIENZO.ancho / 2 - ancho / 2 - 40);
  const radioY = 330;
  const centroX = LIENZO.ancho / 2;
  const centroY = 620;

  const mesas = Array.from({ length: restantes }, (_, i) => {
    // De -100° a 100°: abre la U hacia la presidencial.
    const grados = restantes === 1 ? 0 : -100 + (200 / (restantes - 1)) * i;
    const radianes = (grados * Math.PI) / 180;
    return redonda(
      `Mesa ${i + 1}`,
      capacidad,
      centroX + Math.sin(radianes) * radioX,
      centroY - Math.cos(radianes) * radioY,
    );
  });

  return [presidencial, ...mesas];
}

/** Mesas largas en paralelo, al estilo de banquete imperial. */
function enFilas(cuantas: number, capacidad: number): MesaNueva[] {
  if (cuantas <= 0) return [];

  const capacidadLarga = Math.max(capacidad, 12);
  const { ancho, alto } = tamanoMesa({
    shape: "imperial",
    capacity: capacidadLarga,
  });
  const columnas = ancho * 2 + 120 <= LIENZO.ancho ? 2 : 1;
  const filas = Math.ceil(cuantas / columnas);
  const pasoX = ancho + 120;
  const pasoY = alto + 90;

  const inicioX = (LIENZO.ancho - (columnas - 1) * pasoX) / 2;
  const inicioY = (LIENZO.alto - (filas - 1) * pasoY) / 2;

  return Array.from({ length: cuantas }, (_, i) => ({
    name: `Mesa ${i + 1}`,
    shape: "imperial" as const,
    capacity: capacidadLarga,
    pos_x: ajustarARejilla(inicioX + (i % columnas) * pasoX),
    pos_y: ajustarARejilla(inicioY + Math.floor(i / columnas) * pasoY),
    rotation: 0,
  }));
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: "rejilla",
    nombre: "Banquete",
    descripcion: "Mesas redondas repartidas por la sala",
    generar: enRejilla,
  },
  {
    id: "herradura",
    nombre: "Herradura",
    descripcion: "Presidencial y el resto abriéndose en U",
    generar: enHerradura,
  },
  {
    id: "filas",
    nombre: "Mesas largas",
    descripcion: "Imperiales en paralelo",
    generar: enFilas,
  },
];
