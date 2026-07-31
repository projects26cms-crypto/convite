/** Tipos de las filas de la base de datos. Espejo de `supabase/schema.sql`. */

export type Bando = "novia" | "novio" | "ambos";
export type EstadoRsvp = "pendiente" | "confirmado" | "rechazado";
export type FormaMesa = "redonda" | "rectangular" | "imperial";

export type Boda = {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  owner_id: string | null;
  created_at: string;
};

export type GrupoInvitados = {
  id: string;
  wedding_id: string;
  name: string;
  side: Bando | null;
  created_at: string;
};

export type Invitado = {
  id: string;
  wedding_id: string;
  group_id: string | null;
  full_name: string;
  rsvp_status: EstadoRsvp;
  is_child: boolean;
  dietary_notes: string | null;
  notes: string | null;
  created_at: string;
};

export type Mesa = {
  id: string;
  wedding_id: string;
  name: string;
  shape: FormaMesa;
  capacity: number;
  pos_x: number;
  pos_y: number;
  rotation: number;
  created_at: string;
};

export type Asignacion = {
  id: string;
  wedding_id: string;
  table_id: string;
  guest_id: string;
  seat_number: number | null;
};
