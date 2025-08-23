create table if not exists courses (
  id uuid primary key,
  title text not null,
  is_active boolean default true
);

create table if not exists course_modules (
  id uuid primary key,
  course_id uuid references courses(id) on delete cascade,
  title text not null,
  position int not null
);

create table if not exists user_course_access (
  user_id uuid references users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  granted_at timestamptz default now(),
  primary key (user_id, course_id)
);

create table if not exists user_progress (
  user_id uuid references users(id) on delete cascade,
  module_id uuid references course_modules(id) on delete cascade,
  completed_at timestamptz default now(),
  primary key (user_id, module_id)
);
