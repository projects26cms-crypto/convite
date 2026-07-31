import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnadirInvitados } from "@/components/invitados/anadir-invitados";
import { Grupos } from "@/components/invitados/grupos";
import { ListaInvitados } from "@/components/invitados/lista-invitados";
import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { contar, listarGrupos, listarInvitados } from "@/lib/datos/invitados";

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

  const [invitados, grupos] = await Promise.all([
    listarInvitados(boda.id),
    listarGrupos(boda.id),
  ]);

  const recuento = contar(invitados);

  const cuentaPorGrupo: Record<string, number> = {};
  for (const invitado of invitados) {
    if (invitado.group_id) {
      cuentaPorGrupo[invitado.group_id] =
        (cuentaPorGrupo[invitado.group_id] ?? 0) + 1;
    }
  }

  const cifras = [
    { etiqueta: "En la lista", valor: recuento.total, color: null },
    {
      etiqueta: "Confirmados",
      valor: recuento.confirmados,
      color: "bg-confirmado",
    },
    {
      etiqueta: "Pendientes",
      valor: recuento.pendientes,
      color: "bg-pendiente",
    },
    { etiqueta: "Niños", valor: recuento.ninos, color: null },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">Invitados</h1>

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
        {cifras.map((cifra) => (
          <div key={cifra.etiqueta}>
            <dd className="flex items-center gap-2 font-display text-3xl tabular-nums">
              {cifra.color && (
                <span
                  aria-hidden
                  className={`size-2.5 rounded-full ${cifra.color}`}
                />
              )}
              {cifra.valor}
            </dd>
            <dt className="mt-0.5 text-sm text-muted-foreground">
              {cifra.etiqueta}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <AnadirInvitados slug={slug} grupos={grupos} />
      </div>

      <div className="mt-8">
        <ListaInvitados invitados={invitados} grupos={grupos} slug={slug} />
      </div>

      <Grupos grupos={grupos} cuentaPorGrupo={cuentaPorGrupo} slug={slug} />
    </main>
  );
}
