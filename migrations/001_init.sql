-- Daily Trivia database tables.
-- Run with: node scripts/migrate.js

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  session_hash text not null unique,     -- a fingerprint of the browser's sign-in cookie
  time_zone text not null default 'Europe/London',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
-- Display names are unique, ignoring capital letters.
create unique index if not exists players_name_unique on players (lower(display_name));

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  day date not null,                     -- the player's calendar day
  category text not null,
  difficulty text not null,
  question text not null,
  answer text not null,                  -- answer key: never sent to the browser before grading
  accept jsonb not null default '[]',
  partial text not null default '',
  summary text not null default '',
  revealed_at timestamptz not null default now(),
  unique (player_id, day)                -- one question per player per day
);

create table if not exists answers (
  question_id uuid primary key references questions(id) on delete cascade,  -- one answer per question
  player_id uuid not null references players(id) on delete cascade,
  user_answer text not null,
  score integer not null check (score between 0 and 10),
  verdict text not null,
  feedback text not null,
  seconds_taken integer not null,
  submitted_at timestamptz not null default now()
);
create index if not exists answers_player on answers (player_id);

-- Row Level Security on, with no policies: Supabase's public web API can't read or
-- write these tables at all. Only our server, using the database password, can.
alter table players enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
