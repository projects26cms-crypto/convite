import type { GrupoInvitados, Invitado, Mesa, Regla } from "@/lib/tipos";

export type Par = { invitadoId: string; mesaId: string };

export type Reparto = {
  pares: Par[];
  sinSitio: number;
  /** Grupos que no cupieron enteros en una mesa y hubo que repartir. */
  partidos: number;
};

/** Quién no puede compartir mesa con quién. */
export function mapaSeparados(reglas: Regla[]): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const regla of reglas) {
    if (regla.kind !== "separados") continue;
    for (const [a, b] of [
      [regla.guest_a, regla.guest_b],
      [regla.guest_b, regla.guest_a],
    ]) {
      const suyos = mapa.get(a) ?? new Set<string>();
      suyos.add(b);
      mapa.set(a, suyos);
    }
  }
  return mapa;
}

/**
 * Parejas que están compartiendo mesa cuando no deberían, o que deberían
 * compartirla y están separadas. Se usa para pintar el aviso en el lienzo.
 */
export function conflictos(
  asientos: Record<string, string>,
  reglas: Regla[],
): { invitados: Set<string>; mesas: Set<string> } {
  const invitadosMal = new Set<string>();
  const mesasMal = new Set<string>();

  for (const regla of reglas) {
    const mesaA = asientos[regla.guest_a];
    const mesaB = asientos[regla.guest_b];
    if (!mesaA || !mesaB) continue;

    const juntos = mesaA === mesaB;
    const mal = regla.kind === "separados" ? juntos : !juntos;
    if (!mal) continue;

    invitadosMal.add(regla.guest_a);
    invitadosMal.add(regla.guest_b);
    mesasMal.add(mesaA);
    mesasMal.add(mesaB);
  }

  return { invitados: invitadosMal, mesas: mesasMal };
}

/**
 * Reparto automático por familias.
 *
 * Reglas, en este orden:
 *  - la presidencial y las mesas fijadas quedan fuera
 *  - quien tiene una regla de «juntos» viaja en el mismo bloque que su familia
 *  - nunca se supera la capacidad de una mesa ni se junta a quien no debe
 *  - los bloques grandes primero, y a las mesas más cercanas a la presidencial,
 *    que es donde el protocolo coloca a la familia
 */
export function repartir({
  invitados,
  grupos,
  mesas,
  asientos,
  reglas = [],
  porBando = false,
  soloIds,
  soloMesaId,
}: {
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  mesas: Mesa[];
  asientos: Record<string, string>;
  reglas?: Regla[];
  porBando?: boolean;
  soloIds?: Set<string>;
  soloMesaId?: string | null;
}): Reparto {
  const presidencial = mesas.find((m) => m.is_head);
  const candidatas = mesas.filter(
    (m) =>
      !m.is_head &&
      !m.is_locked &&
      (soloMesaId ? m.id === soloMesaId : true),
  );

  const libres = new Map<string, number>();
  const dentro = new Map<string, Set<string>>();
  for (const mesa of candidatas) {
    libres.set(mesa.id, mesa.capacity);
    dentro.set(mesa.id, new Set());
  }
  for (const [invitadoId, mesaId] of Object.entries(asientos)) {
    if (!libres.has(mesaId)) continue;
    libres.set(mesaId, (libres.get(mesaId) ?? 0) - 1);
    dentro.get(mesaId)?.add(invitadoId);
  }

  const ejeX = presidencial?.pos_x ?? 0;
  const ejeY = presidencial?.pos_y ?? 0;
  const ordenadas = [...candidatas].sort(
    (a, b) =>
      Math.hypot(a.pos_x - ejeX, a.pos_y - ejeY) -
      Math.hypot(b.pos_x - ejeX, b.pos_y - ejeY),
  );

  const bandoDe = new Map(grupos.map((g) => [g.id, g.side]));
  const separados = mapaSeparados(reglas);

  const pendientes = invitados.filter(
    (i) =>
      !asientos[i.id] &&
      i.rsvp_status !== "rechazado" &&
      (soloIds ? soloIds.has(i.id) : true),
  );

  // Un bloque por grupo; las reglas de «juntos» fusionan bloques.
  const bloqueDe = new Map<string, string>();
  for (const invitado of pendientes) {
    bloqueDe.set(invitado.id, invitado.group_id ?? `suelto:${invitado.id}`);
  }
  for (const regla of reglas) {
    if (regla.kind !== "juntos") continue;
    const a = bloqueDe.get(regla.guest_a);
    const b = bloqueDe.get(regla.guest_b);
    if (!a || !b || a === b) continue;
    for (const [id, clave] of bloqueDe) {
      if (clave === b) bloqueDe.set(id, a);
    }
  }

  const bloques = new Map<string, Invitado[]>();
  for (const invitado of pendientes) {
    const clave = bloqueDe.get(invitado.id)!;
    const lista = bloques.get(clave);
    if (lista) lista.push(invitado);
    else bloques.set(clave, [invitado]);
  }

  const porTamano = [...bloques.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  const pares: Par[] = [];
  let sinSitio = 0;
  let partidos = 0;

  const chocan = (mesaId: string, gente: Invitado[]) => {
    const dentroYa = dentro.get(mesaId);
    if (!dentroYa) return true;
    return gente.some((invitado) => {
      const enemigos = separados.get(invitado.id);
      if (!enemigos) return false;
      for (const otro of dentroYa) if (enemigos.has(otro)) return true;
      return gente.some((companero) => enemigos.has(companero.id));
    });
  };

  const asentar = (mesaId: string, gente: Invitado[]) => {
    for (const invitado of gente) {
      pares.push({ invitadoId: invitado.id, mesaId });
      dentro.get(mesaId)?.add(invitado.id);
    }
    libres.set(mesaId, (libres.get(mesaId) ?? 0) - gente.length);
  };

  for (const [clave, miembros] of porTamano) {
    const grupoId = clave.startsWith("suelto:") ? null : clave;
    const bando = grupoId ? (bandoDe.get(grupoId) ?? null) : null;

    const permitidas = ordenadas.filter((mesa) => {
      if (!porBando || !bando || bando === "ambos") return true;
      return bando === "novia" ? mesa.pos_x <= ejeX : mesa.pos_x >= ejeX;
    });
    const donde = permitidas.length > 0 ? permitidas : ordenadas;

    const entera = donde.find(
      (m) =>
        (libres.get(m.id) ?? 0) >= miembros.length && !chocan(m.id, miembros),
    );

    if (entera) {
      asentar(entera.id, miembros);
      continue;
    }

    if (miembros.length > 1) partidos++;

    const restantes = [...miembros];
    const porHueco = [...donde].sort(
      (a, b) => (libres.get(b.id) ?? 0) - (libres.get(a.id) ?? 0),
    );

    for (const mesa of porHueco) {
      if (restantes.length === 0) break;
      const hueco = libres.get(mesa.id) ?? 0;
      if (hueco <= 0) continue;

      const van: Invitado[] = [];
      for (const invitado of [...restantes]) {
        if (van.length >= hueco) break;
        if (chocan(mesa.id, [...van, invitado])) continue;
        van.push(invitado);
        restantes.splice(restantes.indexOf(invitado), 1);
      }
      if (van.length > 0) asentar(mesa.id, van);
    }

    sinSitio += restantes.length;
  }

  return { pares, sinSitio, partidos };
}
