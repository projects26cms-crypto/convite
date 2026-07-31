/**
 * Importación pegando texto: un invitado por línea, y de forma opcional el
 * grupo detrás de una coma.
 *
 *   Marta Ruiz
 *   Javier Ruiz, Familia Ruiz
 *   Lucía Ortega, Amigos del cole
 */

export type LineaImportada = { nombre: string; grupo: string | null };

export type ResultadoLectura = {
  lineas: LineaImportada[];
  ignoradas: number;
  /** Nombres que aparecen más de una vez en el propio texto pegado. */
  repetidos: string[];
};

/** Tope de seguridad: una boda de 150 invitados cabe de sobra. */
export const MAX_LINEAS = 1000;
const MAX_LARGO_NOMBRE = 120;

function limpiar(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

export function leerPegado(texto: string): ResultadoLectura {
  const lineas: LineaImportada[] = [];
  const vistos = new Map<string, number>();
  let ignoradas = 0;

  for (const cruda of texto.split(/\r?\n/)) {
    if (lineas.length >= MAX_LINEAS) {
      ignoradas++;
      continue;
    }

    const linea = limpiar(cruda);
    if (!linea) continue;

    const coma = linea.indexOf(",");
    const nombre = limpiar(coma === -1 ? linea : linea.slice(0, coma)).slice(
      0,
      MAX_LARGO_NOMBRE,
    );
    const grupo =
      coma === -1 ? null : limpiar(linea.slice(coma + 1)).slice(0, 80) || null;

    if (!nombre) {
      ignoradas++;
      continue;
    }

    const clave = nombre.toLocaleLowerCase("es-ES");
    vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
    lineas.push({ nombre, grupo });
  }

  const repetidos = lineas
    .map((l) => l.nombre)
    .filter((nombre, i, todos) => {
      const clave = nombre.toLocaleLowerCase("es-ES");
      return (
        (vistos.get(clave) ?? 0) > 1 &&
        todos.findIndex(
          (otro) => otro.toLocaleLowerCase("es-ES") === clave,
        ) === i
      );
    });

  return { lineas, ignoradas, repetidos };
}

/** Nombres de grupo distintos que aparecen en el texto, en orden de aparición. */
export function gruposDe(lineas: LineaImportada[]): string[] {
  const vistos = new Set<string>();
  const grupos: string[] = [];

  for (const { grupo } of lineas) {
    if (!grupo) continue;
    const clave = grupo.toLocaleLowerCase("es-ES");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    grupos.push(grupo);
  }

  return grupos;
}
