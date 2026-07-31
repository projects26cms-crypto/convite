import Link from "next/link";

export default function BodaNoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-24">
      <h1 className="font-display text-3xl tracking-tight">
        Este enlace no lleva a ninguna boda
      </h1>
      <p className="mt-4 text-muted-foreground">
        Comprueba que lo has copiado entero, hasta el último carácter. Si te lo
        pasaron por mensaje, puede que se cortara al final.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm underline underline-offset-4"
      >
        Volver al principio
      </Link>
    </main>
  );
}
