import type { GrupoInvitados, Invitado, Mesa } from "@/lib/tipos";

export type Par = { invitadoId: string; mesaId: string };

export type Reparto = {
  pares: Par[];
  sinSitio: number;
};

/**
 * Reparto automático por familias.
 *
 * Reglas, en este orden:
 *  - la presidencial queda fuera: ahí se sienta uno a mano
 *  - los grupos grandes primero, y a las mesas más cercanas a la presidencial,
 *    que es donde el protocolo coloca a la familia
 *  - nunca se supera la capacidad de una mesa
 *  - un grupo solo se parte si no cabe entero en ninguna mesa
 */
export function repartir({
  invitados,
  grupos,
  mesas,
  asientos,
  porBando = false,
}: {
  invitados: Invitado[];
  grupos: GrupoInvitados[];
  mesas: Mesa[];
  asientos: Record<string, string>;
  porBando?: boolean;
}): Reparto {
  const presidencial = mesas.find((m) => m.is_head);
  const candidatas = mesas.filter((m) => !m.is_head);

  const libres = new Map<string, number>();
  for (const mesa of candidatas) libres.set(mesa.id, mesa.capacity);
  for (const mesaId of Object.values(asientos)) {
    if (libres.has(mesaId)) libres.set(mesaId, (libres.get(mesaId) ?? 0) - 1);
  }

  const ejeX = presidencial?.pos_x ?? 0;
  const ejeY = presidencial?.pos_y ?? 0;
  const cercania = (mesa: Mesa) => Math.hypot(mesa.pos_x - ejeX, mesa.pos_y - ejeY);
  const ordenadas = [...candidatas].sort((a, b) => cercania(a) - cercania(b));

  const bandoDe = new Map(grupos.map((g) => [g.id, g.side]));

  const pendientes = invitados.filter(
    (i) => !asientos[i.id] && i.rsvp_status !== "rechazado",
  );

  // Un cubo por grupo; quien no tiene grupo va suelto.
  const cubos = new Map<string, Invitado[]>();
  for (const invitado of pendientes) {
    const clave = invitado.group_id ?? `suelto:${invitado.id}`;
    const cubo = cubos.get(clave);
    if (cubo) cubo.push(invitado);
    else cubos.set(clave, [invitado]);
  }

  const porTamano = [...cubos.entries()].sort((a, b) => b[1].length - a[1].length);

  const pares: Par[] = [];
  let sinSitio = 0;

  for (const [clave, miembros] of porTamano) {
    const grupoId = clave.startsWith("suelto:") ? null : clave;
    const bando = grupoId ? (bandoDe.get(grupoId) ?? null) : null;

    const permitidas = ordenadas.filter((mesa) => {
      if (!porBando || !bando || bando === "ambos") return true;
      // Desde la presidencial mirando a la sala, la derecha de la novia queda
      // a la izquierda en el plano.
      return bando === "novia" ? mesa.pos_x <= ejeX : mesa.pos_x >= ejeX;
    });

    const donde = permitidas.length > 0 ? permitidas : ordenadas;

    // Entera si cabe; si no, se reparte por las que más sitio tengan.
    const entera = donde.find((m) => (libres.get(m.id) ?? 0) >= miembros.length);

    if (entera) {
      for (const invitado of miembros) {
        pares.push({ invitadoId: invitado.id, mesaId: entera.id });
      }
      libres.set(entera.id, (libres.get(entera.id) ?? 0) - miembros.length);
      continue;
    }

    const restantes = [...miembros];
    const porHueco = [...donde].sort(
      (a, b) => (libres.get(b.id) ?? 0) - (libres.get(a.id) ?? 0),
    );

    for (const mesa of porHueco) {
      if (restantes.length === 0) break;
      const hueco = libres.get(mesa.id) ?? 0;
      if (hueco <= 0) continue;
      const van = restantes.splice(0, hueco);
      for (const invitado of van) {
        pares.push({ invitadoId: invitado.id, mesaId: mesa.id });
      }
      libres.set(mesa.id, hueco - van.length);
    }

    sinSitio += restantes.length;
  }

  return { pares, sinSitio };
}
