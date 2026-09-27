"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferencias de quien mira, guardadas en este navegador: el tamaño de las
 * mesas en pantalla, si ya vio los consejos. Nunca datos de la boda.
 *
 * Si el almacenamiento no está disponible (ventana privada, bloqueado), se
 * recuerdan mientras dure la sesión.
 */
const EVENTO = "convite:preferencias";
const memoria = new Map<string, string>();

function leer(clave: string, porDefecto: string): string {
  try {
    return window.localStorage.getItem(clave) ?? memoria.get(clave) ?? porDefecto;
  } catch {
    return memoria.get(clave) ?? porDefecto;
  }
}

export function guardarPreferencia(clave: string, valor: string) {
  memoria.set(clave, valor);
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: vale con la memoria de la sesión.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

/** En el servidor siempre vale el valor por defecto; en el navegador, el guardado. */
export function usePreferencia(
  clave: string,
  porDefecto: string,
): [string, (valor: string) => void] {
  const valor = useSyncExternalStore(
    suscribir,
    () => leer(clave, porDefecto),
    () => porDefecto,
  );
  const cambiar = useCallback(
    (nuevo: string) => guardarPreferencia(clave, nuevo),
    [clave],
  );
  return [valor, cambiar];
}
