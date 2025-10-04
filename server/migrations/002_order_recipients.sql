-- 002_order_recipients.sql
create table if not exists order_recipients (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null unique references orders(id) on delete cascade,

  first_name text not null,
  last_name  text not null,
  email      text not null,
  phone      text,

  address_line1 text not null,
  address_line2 text,
  postal_code   text not null,
  city          text not null,
  country       text not null default 'Polska',
  shipping_method text default 'standard',

  company_name text,
  company_nip  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trigger updated_at
drop trigger if exists order_recipients_set_updated on order_recipients;
create trigger order_recipients_set_updated
before update on order_recipients
for each row execute procedure set_updated_at();
