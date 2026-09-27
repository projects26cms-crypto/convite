import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { obtenerBodaPorSlug } from "@/lib/datos/bodas";
import { listarGrupos, listarInvitados } from "@/lib/datos/invitados";
import { listarAsignaciones, listarMesas } from "@/lib/datos/mesas";
import { cn } from "@/lib/utils";

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

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

type Paso = {
  titulo: string;
  explicacion: string;
  estado: string;
  hecho: boolean;
  href: string;
  accion: string;
};

export default async function PaginaBoda({ params }: Props) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  const [invitados, grupos, mesas, asignaciones] = await Promise.all([
    listarInvitados(boda.id),
    listarGrupos(boda.id),
    listarMesas(boda.id),
    listarAsignaciones(boda.id),
  ]);

  const confirmados = invitados.filter((i) => i.rsvp_status === "confirmado").length;
  const vienen = invitados.filter((i) => i.rsvp_status !== "rechazado").length;
  const sinBando = grupos.filter((g) => !g.side).length;
  const plazas = mesas.reduce((suma, m) => suma + m.capacity, 0);
  const sentados = asignaciones.length;

  const pasos: Paso[] = [
    {
      titulo: "Apunta a tus invitados",
      explicacion:
        "Pega la lista entera de una vez y agrúpalos por familias. El grupo decide quién se sienta junto.",
      estado:
        invitados.length === 0
          ? "Aún no hay nadie"
          : [
              plural(invitados.length, "invitado", "invitados"),
              plural(confirmados, "confirmado", "confirmados"),
              sinBando > 0 && plural(sinBando, "grupo sin bando", "grupos sin bando"),
            ]
              .filter(Boolean)
              .join(" · "),
      hecho: invitados.length > 0,
      href: `/b/${slug}/invitados`,
      accion: invitados.length === 0 ? "Añadir invitados" : "Ver la lista",
    },
    {
      titulo: "Monta el salón",
      explicacion:
        "Elige una distribución y se colocan todas las mesas de una vez, presidencial incluida.",
      estado:
        mesas.length === 0
          ? "Aún no hay mesas"
          : `${plural(mesas.length, "mesa", "mesas")} · ${plural(plazas, "plaza", "plazas")}`,
      hecho: mesas.length > 0,
      href: `/b/${slug}/mesas`,
      accion: mesas.length === 0 ? "Montar el salón" : "Ver el salón",
    },
    {
      titulo: "Sienta a la gente",
      explicacion:
        "Un botón reparte por familias; luego arrastras a quien quieras cambiar de sitio.",
      estado:
        vienen === 0
          ? "Primero, los invitados"
          : `${sentados} de ${vienen} sentados`,
      hecho: vienen > 0 && sentados >= vienen,
      href: `/b/${slug}/mesas`,
      accion: sentados === 0 ? "Sentar a la gente" : "Revisar las mesas",
    },
  ];

  const siguiente = pasos.findIndex((p) => !p.hecho);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14 sm:py-20">
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

      <p className="mt-10 text-sm font-medium text-muted-foreground">
        {siguiente === -1
          ? "Todo listo. Puedes seguir retocando cuando quieras."
          : `Paso ${siguiente + 1} de 3`}
      </p>

      <ol className="mt-3 grid gap-3">
        {pasos.map((paso, i) => {
          const esElSiguiente = i === siguiente;
          return (
            <li
              key={paso.titulo}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center",
                esElSiguiente ? "border-foreground shadow-sm" : "border-border",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full font-display text-base",
                  paso.hecho
                    ? "bg-novia text-white"
                    : esElSiguiente
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {paso.hecho ? <Check className="size-4" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">{paso.titulo}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {paso.explicacion}
                </p>
                <p
                  className={cn(
                    "mt-2 text-sm font-medium tabular-nums",
                    paso.hecho ? "text-novia" : "text-foreground",
                  )}
                >
                  <span className="sr-only">
                    {paso.hecho ? "Hecho: " : "Pendiente: "}
                  </span>
                  {paso.estado}
                </p>
              </div>

              <Link
                href={paso.href}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
                  esElSiguiente
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-secondary text-foreground hover:bg-secondary/70",
                )}
              >
                {paso.accion}
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        Guarda este enlace: es la única forma de entrar, y quien lo tenga podrá
        editar la boda.
      </p>
    </main>
  );
}
