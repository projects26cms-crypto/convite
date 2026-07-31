/**
 * El slug de la URL (`/b/ines-santi-9f3k2p`) es la única credencial de acceso a
 * una boda: quien lo tiene, puede editar. Por eso lleva sufijo aleatorio y por
 * eso se valida siempre antes de tocar la base de datos.
 */

const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LARGO_MIN = 3;
const LARGO_MAX = 80;

/** Marcas diacríticas combinantes que deja `normalize("NFD")`. */
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Alfabeto sin caracteres que se confunden al dictar o leer: 0/O, 1/l/I. */
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";
const LARGO_SUFIJO = 8;

export function esSlugValido(valor: string): boolean {
  return (
    valor.length >= LARGO_MIN &&
    valor.length <= LARGO_MAX &&
    FORMATO_SLUG.test(valor)
  );
}

/** "Inés & Santi" → "ines-santi" */
export function aTextoDeSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function sufijoAleatorio(): string {
  const bytes = new Uint8Array(LARGO_SUFIJO);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/** "Inés & Santi" → "ines-santi-9f3k2pxq" */
export function generarSlug(nombre: string): string {
  const base = aTextoDeSlug(nombre);
  return base ? `${base}-${sufijoAleatorio()}` : `boda-${sufijoAleatorio()}`;
}
