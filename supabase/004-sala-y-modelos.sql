-- Sala configurable por boda y catálogo de modelos de mesa.
-- Ejecutar en Supabase → SQL Editor.
--
-- Todas las medidas siguen en centímetros, que es la unidad del modelo.
-- Presets: S = 1000 x 800, M = 1500 x 1200, L = 2200 x 1600.

alter table weddings
  add column if not exists room_width  numeric not null default 1500,
  add column if not exists room_height numeric not null default 1200,
  add column if not exists room_preset text not null default 'M';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_room_preset_check'
  ) then
    alter table weddings add constraint weddings_room_preset_check
      check (room_preset in ('S', 'M', 'L', 'custom'));
  end if;
end $$;

-- Modelo de mesa del catálogo con el que se creó.
alter table event_tables
  add column if not exists template_id text;

-- Formas nuevas: cuadrada, media luna, presidencial (sillas a un lado),
-- mesa en U, mesa en E y mesa de cóctel.
alter table event_tables drop constraint if exists event_tables_shape_check;
alter table event_tables add constraint event_tables_shape_check
  check (shape in (
    'redonda', 'rectangular', 'imperial',
    'cuadrada', 'media_luna', 'presidencial', 'u', 'e', 'coctel'
  ));

-- La mesa de cóctel es de pie: capacidad 0.
alter table event_tables drop constraint if exists event_tables_capacity_check;
alter table event_tables add constraint event_tables_capacity_check
  check (capacity between 0 and 40);

-- ---------------------------------------------------------------------------
-- Migración de lo que ya existe
-- ---------------------------------------------------------------------------

-- Las bodas de antes se montaron sobre un lienzo de 20 x 14 m. Darles la sala M
-- las dejaría con media distribución fuera de perímetro el primer día, así que
-- reciben la L, que sí contiene su plano actual. Las nuevas nacen en M.
update weddings
   set room_width  = 2200,
       room_height = 1600,
       room_preset = 'L'
 where room_preset = 'M'
   and exists (select 1 from event_tables where wedding_id = weddings.id);

-- A cada mesa, el modelo del catálogo que mejor case con lo que ya tiene.
update event_tables
   set template_id = case
     when is_head                       then 'presidencial'
     when shape = 'imperial'            then 'imperial'
     when shape = 'rectangular'         then 'rectangular-8'
     when shape = 'redonda'
      and capacity <= 9                 then 'redonda-8'
     when shape = 'redonda'
      and capacity <= 11                then 'redonda-10'
     when shape = 'redonda'             then 'redonda-12'
     else 'redonda-10'
   end
 where template_id is null;
