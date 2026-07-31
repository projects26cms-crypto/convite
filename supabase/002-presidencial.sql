-- Marca la mesa presidencial. Solo puede haber una por boda y no se borra.
-- Ejecutar en Supabase → SQL Editor sobre una base ya creada.

alter table event_tables
  add column if not exists is_head boolean not null default false;

create unique index if not exists una_presidencial_por_boda
  on event_tables (wedding_id)
  where is_head;
