-- Boda de prueba, para comprobar que la aplicación lee de la base de datos.
-- Se puede borrar cuando ya no haga falta:
--   delete from weddings where slug = 'ines-santi-7k2mq4x9';

insert into weddings (slug, name, event_date, venue)
values (
  'ines-santi-7k2mq4x9',
  'Inés & Santi',
  '2027-06-12',
  'Finca El Olivar, Toledo'
)
on conflict (slug) do nothing;
