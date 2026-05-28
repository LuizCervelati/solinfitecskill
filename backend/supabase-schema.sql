create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_notes'
      and column_name = 'projeto'
  ) then
    if to_regclass('public.study_notes_legacy_backup') is null then
      alter table public.study_notes rename to study_notes_legacy_backup;
    end if;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checklist_state'
      and column_name = 'user_id'
      and udt_name = 'text'
  ) then
    if to_regclass('public.checklist_state_legacy_backup') is null then
      alter table public.checklist_state rename to checklist_state_legacy_backup;
    end if;
  end if;
end
$$;

create table if not exists public.auth_users (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  role text not null default 'user',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_auth_users_nome_len check (char_length(trim(nome)) between 2 and 80),
  constraint chk_auth_users_email_len check (char_length(email) between 6 and 160),
  constraint chk_auth_users_email_format check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  constraint chk_auth_users_role check (role in ('user','admin')),
  constraint chk_auth_users_senha_hash_len check (char_length(senha_hash) between 20 and 255)
);

create table if not exists public.project_types (
  id bigserial primary key,
  nome text not null,
  slug text not null unique,
  descricao text not null default '',
  ativo boolean not null default true,
  criado_por uuid references public.auth_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_project_types_nome_len check (char_length(trim(nome)) between 2 and 80),
  constraint chk_project_types_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  constraint chk_project_types_desc_len check (char_length(descricao) <= 280)
);

insert into public.project_types (nome, slug, descricao)
values
  ('Geral', 'geral', 'Itens gerais'),
  ('Projeto 01', 'proj1', 'API REST de Maquinas'),
  ('Projeto 02', 'proj2', 'Telemetria com Kafka'),
  ('Projeto 03', 'proj3', 'Dashboard Agro IoT')
on conflict (slug) do nothing;

create table if not exists public.study_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.auth_users(id) on delete cascade,
  titulo text not null default '',
  conteudo text not null,
  tag text not null default 'descoberta',
  projeto_slug text not null references public.project_types(slug),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_notes_titulo_len check (char_length(titulo) <= 140),
  constraint chk_study_notes_conteudo_len check (char_length(conteudo) between 1 and 4000),
  constraint chk_study_notes_tag check (tag in ('descoberta','importante','revisao','erro'))
);

create table if not exists public.checklist_state (
  user_id uuid primary key references public.auth_users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint chk_checklist_state_type check (jsonb_typeof(state) = 'object')
);

create index if not exists idx_study_notes_user_project_created_at
  on public.study_notes (user_id, projeto_slug, created_at desc);
create index if not exists idx_project_types_ativo_nome
  on public.project_types (ativo, nome);

alter table public.auth_users enable row level security;
alter table public.project_types enable row level security;
alter table public.study_notes enable row level security;
alter table public.checklist_state enable row level security;

drop policy if exists deny_all_auth_users on public.auth_users;
create policy deny_all_auth_users
on public.auth_users for all
using (false) with check (false);

drop policy if exists deny_all_project_types on public.project_types;
create policy deny_all_project_types
on public.project_types for all
using (false) with check (false);

drop policy if exists deny_all_study_notes on public.study_notes;
create policy deny_all_study_notes
on public.study_notes for all
using (false) with check (false);

drop policy if exists deny_all_checklist_state on public.checklist_state;
create policy deny_all_checklist_state
on public.checklist_state for all
using (false) with check (false);
