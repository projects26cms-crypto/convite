-- Convite — esquema base.
-- Ejecutar en Supabase → SQL Editor.
-- Diseñado para el producto completo, aunque hoy solo se usen cinco tablas.

create extension if not exists "pgcrypto";

create table weddings (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  event_date  date,
  venue       text,
  owner_id    uuid,                     -- null hoy; punto de anclaje para auth futura
  created_at  timestamptz not null default now()
);

-- Unidad de invitación: familia, pareja, grupo de amigos
create table guest_groups (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  name        text not null,
  side        text check (side in ('novia', 'novio', 'ambos')),
  created_at  timestamptz not null default now()
);

create table guests (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references weddings(id) on delete cascade,
  group_id      uuid references guest_groups(id) on delete set null,
  full_name     text not null,
  rsvp_status   text not null default 'pendiente'
                check (rsvp_status in ('pendiente', 'confirmado', 'rechazado')),
  is_child      boolean not null default false,
  dietary_notes text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table event_tables (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  name        text not null,
  shape       text not null default 'redonda'
              check (shape in ('redonda', 'rectangular', 'imperial')),
  capacity    int  not null default 8 check (capacity between 1 and 40),
  pos_x       numeric not null default 0,
  pos_y       numeric not null default 0,
  rotation    numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table seat_assignments (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  table_id    uuid not null references event_tables(id) on delete cascade,
  guest_id    uuid not null references guests(id) on delete cascade,
  seat_number int,
  unique (guest_id)                     -- un invitado ocupa como mucho un asiento
);

create index on guest_groups     (wedding_id);
create index on guests           (wedding_id);
create index on event_tables     (wedding_id);
create index on seat_assignments (wedding_id);
create index on seat_assignments (table_id);

alter table weddings         enable row level security;
alter table guest_groups     enable row level security;
alter table guests           enable row level security;
alter table event_tables     enable row level security;
alter table seat_assignments enable row level security;

-- Sin políticas: solo la service_role (servidor) puede operar.
