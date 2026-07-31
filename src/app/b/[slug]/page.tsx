import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { obtenerBodaPorSlug } from "@/lib/datos/bodas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  return {
    title: boda?.name ?? "Boda no encontrada",
    // El slug es una credencial: que no acabe en un buscador.
    robots: { index: false, follow: false },
  };
}

function formatearFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00Z`));
}

const secciones = [
  { nombre: "Invitados", descripcion: "Quién viene y en qué grupo va" },
  { nombre: "Mesas", descripcion: "Colocar la sala y sentar a la gente" },
  { nombre: "Plano", descripcion: "Listados e impresión para el banquete" },
];

export default async function PaginaBoda({ params }: Props) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-24">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Convite
      </p>

      <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
        {boda.name}
      </h1>

      {(boda.event_date || boda.venue) && (
        <p className="mt-3 text-lg text-muted-foreground">
          {[boda.event_date && formatearFecha(boda.event_date), boda.venue]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <ul className="mt-12 divide-y divide-border border-y border-border">
        {secciones.map((seccion) => (
          <li
            key={seccion.nombre}
            className="flex items-baseline justify-between gap-6 py-4"
          >
            <div>
              <p className="font-medium">{seccion.nombre}</p>
              <p className="text-sm text-muted-foreground">
                {seccion.descripcion}
              </p>
            </div>
            <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Pronto
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">
        Guarda este enlace: es la única forma de entrar. Quien lo tenga podrá
        editar la boda.
      </p>
    </main>
  );
}
