import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Latido diario. Supabase pausa los proyectos gratuitos tras una semana sin
 * actividad, y entonces toda la web deja de funcionar. Vercel llama aquí una
 * vez al día (ver vercel.json) y una consulta mínima basta para mantenerla viva.
 *
 * No devuelve datos: solo si la base contesta.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await supabaseAdmin()
    .from("weddings")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true });
}
