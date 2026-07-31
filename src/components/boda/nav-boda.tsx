"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECCIONES = [
  { segmento: "invitados", etiqueta: "Invitados", activa: true },
  { segmento: "mesas", etiqueta: "Mesas", activa: true },
  { segmento: "plano", etiqueta: "Plano", activa: false },
];

export function NavBoda({ slug }: { slug: string }) {
  const ruta = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {SECCIONES.map((seccion) => {
        const href = `/b/${slug}/${seccion.segmento}`;
        const aqui = ruta === href;

        if (!seccion.activa) {
          return (
            <span
              key={seccion.segmento}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground/60"
              title="Todavía no disponible"
            >
              {seccion.etiqueta}
            </span>
          );
        }

        return (
          <Link
            key={seccion.segmento}
            href={href}
            aria-current={aqui ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 transition-colors",
              aqui
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {seccion.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
