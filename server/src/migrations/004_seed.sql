insert into courses (id, title, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Instruktor Pływania', true)
on conflict do nothing;

insert into course_modules (id, course_id, title, position) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Wprowadzenie', 1),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Bezpieczeństwo', 2),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Technika kraula', 3)
on conflict do nothing;
