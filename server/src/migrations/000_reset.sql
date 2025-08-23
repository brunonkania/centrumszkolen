-- 000_reset.sql
-- 1) pozwól ponownie uruchomić nasze migracje 001-004
delete from _migrations where name in (
  '001_schema.sql',
  '002_auth.sql',
  '003_courses.sql',
  '004_seed.sql'
);

-- 2) usuń tabele w poprawnej kolejności (dzieci -> rodzice)
drop table if exists user_progress cascade;
drop table if exists user_course_access cascade;
drop table if exists course_modules cascade;
drop table if exists courses cascade;
drop table if exists users cascade;
