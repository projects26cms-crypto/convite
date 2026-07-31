/**
 * Resultado de una acción de servidor.
 *
 * Vive fuera de los módulos `"use server"` a propósito: esos solo pueden
 * exportar funciones asíncronas, y exportar una constante desde ahí rompe el
 * render en el cliente.
 */
export type EstadoAccion = { ok: boolean; mensaje: string };

export const ESTADO_INICIAL: EstadoAccion = { ok: true, mensaje: "" };
