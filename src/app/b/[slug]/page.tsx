import type { Metadata } from "next";
import Link from "next/link";
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
  {
    segmento: "invitados",
    nombre: "Invitados",
    descripcion: "Quién viene y en qué grupo va",
    lista: true,
  },
  {
    segmento: "mesas",
    nombre: "Mesas",
    descripcion: "Colocar la sala y sentar a la gente",
    lista: true,
  },
  {
    segmento: "plano",
    nombre: "Plano",
    descripcion: "Listados e impresión para el banquete",
    lista: false,
  },
];

export default async function PaginaBoda({ params }: Props) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-20">
      <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
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
          <li key={seccion.segmento}>
            {seccion.lista ? (
              <Link
                href={`/b/${slug}/${seccion.segmento}`}
                className="flex items-baseline justify-between gap-6 py-4 transition-colors hover:bg-secondary/60"
              >
                <span>
                  <span className="block font-medium">{seccion.nombre}</span>
                  <span className="block text-sm text-muted-foreground">
                    {seccion.descripcion}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-muted-foreground">
                  →
                </span>
              </Link>
            ) : (
              <div className="flex items-baseline justify-between gap-6 py-4">
                <span>
                  <span className="block font-medium text-muted-foreground">
                    {seccion.nombre}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {seccion.descripcion}
                  </span>
                </span>
                <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Pronto
                </span>
              </div>
            )}
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
