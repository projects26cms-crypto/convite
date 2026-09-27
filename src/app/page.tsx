import Link from "next/link";

/** La boda de ejemplo con la que se enseña la aplicación mientras sea una demo. */
const DEMO = "/b/ines-santi-7k2mq4x9";

const mesas = [
  { cx: 92, cy: 78, r: 30, nombre: "1", lleno: 1 },
  { cx: 210, cy: 62, r: 26, nombre: "2", lleno: 0.75 },
  { cx: 320, cy: 96, r: 30, nombre: "3", lleno: 0.5 },
  { cx: 148, cy: 176, r: 26, nombre: "4", lleno: 0.9 },
  { cx: 272, cy: 190, r: 30, nombre: "5", lleno: 0.3 },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-6 py-16 sm:py-24">
        <header className="flex items-baseline justify-between gap-4">
          <span className="font-display text-xl tracking-tight">Convite</span>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Demo
          </span>
        </header>

        <div className="grid flex-1 items-center gap-12 md:grid-cols-[1fr_auto]">
          <div className="max-w-md">
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Siéntalos
              <br />
              donde toca.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Invitados, mesas y plano de sala en un mismo sitio. Pegas la lista,
              la aplicación sienta a cada familia junta y tú retocas arrastrando.
              Sin hojas de cálculo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={DEMO}
                className="inline-flex h-11 items-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Ver la demo
              </Link>
              <span className="text-sm text-muted-foreground">
                Una boda de ejemplo con 150 invitados.
              </span>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Bando de la novia</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-2.5 rounded-full bg-novia" />
                  Verde
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bando del novio</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-2.5 rounded-full bg-novio" />
                  Granate
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sin confirmar</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full bg-pendiente"
                  />
                  Ámbar
                </dd>
              </div>
            </dl>
          </div>

          <figure className="rounded-xl border border-canvas-line bg-canvas p-4 shadow-sm">
            <svg
              viewBox="0 0 420 260"
              className="h-auto w-full max-w-md"
              role="img"
              aria-label="Boceto de un plano de sala con cinco mesas redondas"
            >
              <defs>
                <pattern
                  id="rejilla"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M20 0H0V20"
                    fill="none"
                    stroke="var(--canvas-line)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="420" height="260" fill="url(#rejilla)" />
              {mesas.map((m) => (
                <g key={m.nombre}>
                  <circle
                    cx={m.cx}
                    cy={m.cy}
                    r={m.r}
                    fill="var(--card)"
                    stroke="var(--foreground)"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={m.cx}
                    cy={m.cy}
                    r={m.r}
                    fill="none"
                    stroke={m.lleno === 1 ? "var(--novia)" : "var(--pendiente)"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * m.r * m.lleno} ${
                      2 * Math.PI * m.r
                    }`}
                    transform={`rotate(-90 ${m.cx} ${m.cy})`}
                  />
                  <text
                    x={m.cx}
                    y={m.cy + 5}
                    textAnchor="middle"
                    className="font-display"
                    fontSize="15"
                    fill="var(--foreground)"
                  >
                    {m.nombre}
                  </text>
                </g>
              ))}
            </svg>
          </figure>
        </div>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          Esto es una demo. Cada boda vive en su propio enlace, y quien lo tiene
          puede editarla.
        </footer>
      </div>
    </main>
  );
}
