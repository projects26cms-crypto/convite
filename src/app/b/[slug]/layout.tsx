import Link from "next/link";
import { notFound } from "next/navigation";

import { NavBoda } from "@/components/boda/nav-boda";
import { obtenerBodaPorSlug } from "@/lib/datos/bodas";

export default async function LayoutBoda({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const boda = await obtenerBodaPorSlug(slug);

  if (!boda) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href={`/b/${slug}`}
            className="flex min-w-0 items-baseline gap-3"
          >
            <span className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Convite
            </span>
            <span className="truncate font-display text-lg tracking-tight">
              {boda.name}
            </span>
          </Link>
          <NavBoda slug={slug} />
        </div>
      </header>
      {children}
    </div>
  );
}
