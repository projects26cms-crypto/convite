-- Mesas que el reparto automático no debe tocar, y reglas de convivencia
-- entre invitados. Ejecutar en Supabase → SQL Editor.

alter table event_tables
  add column if not exists is_locked boolean not null default false;

create table if not exists seating_rules (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  kind        text not null check (kind in ('juntos', 'separados')),
  guest_a     uuid not null references guests(id) on delete cascade,
  guest_b     uuid not null references guests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (guest_a <> guest_b)
);

create index if not exists seating_rules_wedding on seating_rules (wedding_id);

-- La pareja no tiene orden: A con B es la misma regla que B con A.
create unique index if not exists seating_rules_pareja
  on seating_rules (
    wedding_id,
    least(guest_a, guest_b),
    greatest(guest_a, guest_b)
  );

alter table seating_rules enable row level security;
