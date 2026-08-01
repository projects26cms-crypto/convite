import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Planificador } from "@/components/mesas/planificador";
import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { listarGrupos, listarInvitados } from "@/lib/datos/invitados";
import {
  listarAsignaciones,
  listarMesas,
  listarReglas,
} from "@/lib/datos/mesas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "Mesas",
  robots: { index: false, follow: false },
};

export default async function PaginaMesas({ params }: Props) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  const [invitados, grupos, mesas, asignaciones, reglas] = await Promise.all([
    listarInvitados(boda.id),
    listarGrupos(boda.id),
    listarMesas(boda.id),
    listarAsignaciones(boda.id),
    listarReglas(boda.id),
  ]);

  return (
    <Planificador
      slug={slug}
      invitados={invitados}
      grupos={grupos}
      mesasIniciales={mesas}
      asignacionesIniciales={asignaciones}
      reglasIniciales={reglas}
      sala={{
        ancho: Number(boda.room_width),
        alto: Number(boda.room_height),
      }}
    />
  );
}
