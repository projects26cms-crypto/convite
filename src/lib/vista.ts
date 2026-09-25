import { envolvente, esCircular } from "@/lib/mesas";
import { SILLA_FUERA, SILLA_RADIO } from "@/lib/modelos";
import type { Mesa } from "@/lib/tipos";

/**
 * Solo presentación.
 *
 * La escala visual infla el dibujo de mesas y sillas alrededor de su centro
 * para que se lean sin tanto zoom. No mueve ningún centro ni toca el modelo:
 * nada de este fichero puede usarse para validar, y `mesas.ts` ni `modelos.ts`
 * deben importarlo nunca.
 */
export const ESCALA_VISUAL_MIN = 1;
export const ESCALA_VISUAL_MAX = 1.6;

/** Margen que se reserva de la holgura entre mesas al calcular el automático. */
const RESERVA = 0.3;

type Dibujable = Pick<
  Mesa,
  "shape" | "capacity" | "template_id" | "pos_x" | "pos_y" | "rotation"
>;

/** Media anchura y media altura de mesa más sillas, en centímetros. */
function mitadesConSillas(mesa: Dibujable) {
  const { mitadAncho, mitadAlto } = envolvente(mesa, mesa.rotation);
  const sillas = SILLA_FUERA + SILLA_RADIO;
  return { x: mitadAncho + sillas, y: mitadAlto + sillas };
}

/**
 * Factor con el que dos mesas, infladas alrededor de su centro, justo se
 * tocarían. Dos redondas se comparan como círculos; si alguna no lo es, como
 * cajas, que respeta que una presidencial sea larga y estrecha.
 */
function escalaDelPar(a: Dibujable, b: Dibujable): number {
  const ma = mitadesConSillas(a);
  const mb = mitadesConSillas(b);
  const dx = Math.abs(a.pos_x - b.pos_x);
  const dy = Math.abs(a.pos_y - b.pos_y);

  if (esCircular(a.shape) && esCircular(b.shape)) {
    return Math.hypot(dx, dy) / (ma.x + mb.x);
  }
  // Dos cajas no se solapan si las separa el eje x o el eje y.
  return Math.max(dx / (ma.x + mb.x), dy / (ma.y + mb.y));
}

/** Mayor factor con el que ningún par de mesas llega a tocarse en pantalla. */
export function escalaSinSolape(mesas: Dibujable[]): number {
  let minimo = Infinity;
  for (let i = 0; i < mesas.length; i++) {
    for (let j = i + 1; j < mesas.length; j++) {
      minimo = Math.min(minimo, escalaDelPar(mesas[i], mesas[j]));
    }
  }
  return minimo;
}

export function acotarEscalaVisual(valor: number): number {
  return Math.min(ESCALA_VISUAL_MAX, Math.max(ESCALA_VISUAL_MIN, valor));
}

/**
 * Lo más grande que se puede dibujar sin solapes, guardando un 30 % de la
 * holgura, y dentro de [1,0 – 1,6].
 */
export function escalaVisualAutomatica(mesas: Dibujable[]): number {
  if (mesas.length < 2) return ESCALA_VISUAL_MAX;
  const maxima = escalaSinSolape(mesas);
  if (!Number.isFinite(maxima)) return ESCALA_VISUAL_MAX;
  return acotarEscalaVisual(1 + (maxima - 1) * (1 - RESERVA));
}
