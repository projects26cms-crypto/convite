import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnadirInvitados } from "@/components/invitados/anadir-invitados";
import { AsignarBandos } from "@/components/invitados/asignar-bandos";
import { Grupos } from "@/components/invitados/grupos";
import { ListaInvitados } from "@/components/invitados/lista-invitados";
import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { listarGrupos, listarInvitados } from "@/lib/datos/invitados";
import { listarAsignaciones, listarMesas } from "@/lib/datos/mesas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "Invitados",
  robots: { index: false, follow: false },
};

export default async function PaginaInvitados({ params }: Props) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  const [invitados, grupos, mesas, asignaciones] = await Promise.all([
    listarInvitados(boda.id),
    listarGrupos(boda.id),
    listarMesas(boda.id),
    listarAsignaciones(boda.id),
  ]);

  const cuentaPorGrupo: Record<string, number> = {};
  for (const invitado of invitados) {
    if (invitado.group_id) {
      cuentaPorGrupo[invitado.group_id] =
        (cuentaPorGrupo[invitado.group_id] ?? 0) + 1;
    }
  }

  // La lista dice en qué mesa está cada uno: es lo que conecta con el plano.
  const nombreMesa = new Map(mesas.map((m) => [m.id, m.name]));
  const mesaDe: Record<string, string> = {};
  for (const asignacion of asignaciones) {
    const nombre = nombreMesa.get(asignacion.table_id);
    if (nombre) mesaDe[asignacion.guest_id] = nombre;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">Invitados</h1>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <AnadirInvitados slug={slug} grupos={grupos} />
          <AsignarBandos
            grupos={grupos}
            cuentaPorGrupo={cuentaPorGrupo}
            slug={slug}
          />
          <ListaInvitados
            invitados={invitados}
            grupos={grupos}
            mesaDe={mesaDe}
            slug={slug}
          />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Grupos grupos={grupos} cuentaPorGrupo={cuentaPorGrupo} slug={slug} />
        </aside>
      </div>
    </main>
  );
}
