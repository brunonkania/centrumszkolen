-- Kursy (jeśli już masz, tylko dodaj kolumnę slug UNIQUE)
CREATE TABLE IF NOT EXISTS courses (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL, -- np. "instruktor-plywania"
  description  TEXT,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT
);

-- Materiały/Moduły (prosto)
CREATE TABLE IF NOT EXISTS modules (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content_html TEXT,
  position    INTEGER NOT NULL DEFAULT 1
);

-- Pytania/quiz (prosty model)
CREATE TABLE IF NOT EXISTS quiz_questions (
  id         SERIAL PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  text       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_answers (
  id         SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- Zamówienia minimalistycznie (opcjonalnie, pod prawdziwą bramkę płatności)
CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  email       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'paid', -- tu w dev od razu paid; pod bramkę zmień flow
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Magic links do dostępu bez konta
CREATE TABLE IF NOT EXISTS magic_links (
  id            SERIAL PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,     -- base64url, np. 32B
  email         TEXT NOT NULL,
  course_id     INTEGER NOT NULL REFERENCES courses(id),
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  expires_at    TIMESTAMP,                -- np. now()+interval '30 days'
  max_uses      INTEGER NOT NULL DEFAULT 3,
  used_count    INTEGER NOT NULL DEFAULT 0,
  revoked       BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at  TIMESTAMP
);

-- Indeksy użyteczne
CREATE INDEX IF NOT EXISTS idx_magic_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);

-- PRZYKŁADOWY SEED (usuń jeśli masz własny)
INSERT INTO courses (title, slug, description, price_cents, thumbnail_url) VALUES
('Instruktor Pływania — podstawy','instruktor-plywania','Technika stylów, bezpieczeństwo, metodyka.',29900,'https://images.unsplash.com/photo-1508612761958-e931d843bdd2?q=80&w=1200&auto=format&fit=crop')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO modules (course_id, title, content_html, position)
SELECT c.id, 'Wprowadzenie', '<p>Cel kursu i zasady.</p>', 1 FROM courses c WHERE c.slug='instruktor-plywania'
ON CONFLICT DO NOTHING;

INSERT INTO quiz_questions (course_id, text)
SELECT c.id, 'Co jest najważniejsze w nauce pływania początkujących?' FROM courses c WHERE c.slug='instruktor-plywania'
ON CONFLICT DO NOTHING;

INSERT INTO quiz_answers (question_id, text, is_correct)
SELECT q.id, 'Bezpieczeństwo i podstawy oddechu', TRUE
FROM quiz_questions q JOIN courses c ON q.course_id=c.id
WHERE c.slug='instruktor-plywania'
ON CONFLICT DO NOTHING;

INSERT INTO quiz_answers (question_id, text, is_correct)
SELECT q.id, 'Szybkość i bicie rekordów', FALSE
FROM quiz_questions q JOIN courses c ON q.course_id=c.id
WHERE c.slug='instruktor-plywania'
ON CONFLICT DO NOTHING;
