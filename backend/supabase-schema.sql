create table if not exists public.study_notes (
  id bigint generated always as identity primary key,
  titulo text not null default '',
  conteudo text not null,
  tag text not null default 'descoberta',
  projeto text not null default 'geral',
  created_at timestamptz not null default now(),
  constraint chk_study_notes_titulo_len check (char_length(titulo) <= 140),
  constraint chk_study_notes_conteudo_len check (char_length(conteudo) between 1 and 4000),
  constraint chk_study_notes_tag check (tag in ('descoberta','importante','revisao','erro')),
  constraint chk_study_notes_projeto check (projeto in ('geral','proj1','proj2','proj3'))
);

create table if not exists public.checklist_state (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint chk_checklist_user_id_len check (char_length(user_id) between 3 and 64)
);

create index if not exists idx_study_notes_projeto_created_at
  on public.study_notes (projeto, created_at desc);

alter table public.study_notes enable row level security;
alter table public.checklist_state enable row level security;
