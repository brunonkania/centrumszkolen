-- 001_courses_magic_links.sql
-- Schemat bazowy: kursy → zamówienia → magic link → quiz → certyfikat

create extension if not exists "uuid-ossp";

-- ENUM order_status – idempotentnie
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending','paid','cancelled');
  end if;
end$$;

-- COURSES
create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text not null,
  price_gross_cents integer not null check (price_gross_cents >= 0),
  currency text not null default 'PLN',
  image_url text,
  created_at timestamptz not null default now()
);

-- ORDERS
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete restrict,
  email text not null,
  status order_status not null default 'pending',
  payu_order_id text,
  amount_cents integer not null,
  currency text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_payu_idx on orders(payu_order_id);
create index if not exists orders_email_idx on orders(email);

-- MAGIC LINKS
create table if not exists magic_links (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists magic_links_token_idx on magic_links(token);

-- QUIZ: pytania/odpowiedzi/próby
create table if not exists quiz_questions (
  id serial primary key,
  course_id uuid not null references courses(id) on delete cascade,
  text text not null
);

create table if not exists quiz_answers (
  id serial primary key,
  question_id integer not null references quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);

create table if not exists quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  score_percent integer not null check (score_percent between 0 and 100),
  passed boolean not null,
  created_at timestamptz not null default now()
);

-- CERTIFICATES (placeholder)
create table if not exists certificates (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  serial text not null unique,
  created_at timestamptz not null default now()
);

-- TRIGGER updated_at dla orders – idempotentnie
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated on orders;
create trigger orders_set_updated before update on orders
for each row execute procedure set_updated_at();

-- SEED kursu demo (jeśli brak)
insert into courses (slug, title, description, price_gross_cents, currency, image_url)
select 'instruktor-plywania', 'Instruktor Pływania', 'Kompletny kurs z materiałami i egzaminem online.', 19900, 'PLN', null
where not exists (select 1 from courses where slug = 'instruktor-plywania');
