-- Kadosh Manager — schema inicial do Supabase
-- Rode este arquivo uma vez no SQL Editor do seu projeto Supabase
-- (https://supabase.com/dashboard/project/_/sql/new) antes de iniciar o servidor.
--
-- Os IDs são texto (não uuid) para casar com o esquema que o app já usa
-- (m1, s1, sch1, etc.). Linhas novas criadas pelo app usam crypto.randomUUID().

create table if not exists musicians (
  id text primary key,
  name text not null,
  role text not null check (role in ('Vocal', 'Instrumento')),
  instrument text not null,
  active boolean not null default true,
  scale_count integer not null default 0,
  gender text not null default 'M' check (gender in ('M', 'F')),
  created_at timestamptz not null default now()
);

create table if not exists songs (
  id text primary key,
  title text not null,
  author text not null,
  tone text not null,
  bpm integer not null default 75,
  theme text not null default 'Geral',
  link text,
  time_signature text default '4/4',
  difficulty text default 'Média',
  count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Renomeada para "kadosh_manager_schedules" para conviver no mesmo projeto Supabase
-- do sistema de Sonoplastia (Next.js), que tem sua própria tabela "schedules" (uuid).
create table if not exists kadosh_manager_schedules (
  id text primary key,
  date date not null,
  title text not null,
  theme text default '',
  coordinator text default 'Coordenador Kadosh',
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Aprovado')),
  vocals jsonb not null default '[]',
  instrumentalists jsonb not null default '[]',
  songs jsonb not null default '[]',
  notes text default '',
  ai_generated boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id text primary key,
  date date not null,
  text text not null,
  category text default 'Outro',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  date timestamptz not null default now(),
  type text not null,
  title text not null,
  message text not null,
  target_musician_id text default 'all',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS habilitado, mas permissivo: o Express é o único cliente do banco
-- (mesma chave anon/publishable para todas as requisições) e a aplicação
-- já exige login real via Supabase Auth no middleware do servidor antes
-- de qualquer chamada chegar até aqui. Sem uma service_role key, esta é
-- a postura correta para este modelo de confiança de backend único.
alter table musicians enable row level security;
alter table songs enable row level security;
alter table kadosh_manager_schedules enable row level security;
alter table reminders enable row level security;
alter table notifications enable row level security;

create policy "allow all - musicians" on musicians for all using (true) with check (true);
create policy "allow all - songs" on songs for all using (true) with check (true);
create policy "allow all - schedules" on kadosh_manager_schedules for all using (true) with check (true);
create policy "allow all - reminders" on reminders for all using (true) with check (true);
create policy "allow all - notifications" on notifications for all using (true) with check (true);

-- =====================================================================
-- Sonoplastia: Técnico de som, Datashow, escala técnica e integração n8n
-- =====================================================================

alter table musicians drop constraint if exists musicians_role_check;
alter table musicians add constraint musicians_role_check
  check (role in ('Vocal', 'Instrumento', 'Técnico de som', 'Datashow'));
alter table musicians add column if not exists phone text;

alter table kadosh_manager_schedules add column if not exists time text default '19:30';
alter table kadosh_manager_schedules add column if not exists technicians jsonb not null default '[]';

create table if not exists app_settings (
  id text primary key,
  setting_key text not null unique,
  setting_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_logs (
  id text primary key,
  schedule_id text references kadosh_manager_schedules(id) on delete cascade,
  automation_type text not null default 'n8n_webhook' check (automation_type in ('n8n_webhook', 'n8n_webhook_technical')),
  webhook_url text,
  payload jsonb,
  status text not null default 'Pendente' check (status in ('Pendente', 'Enviado', 'Erro')),
  response text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists confirmation_logs (
  id text primary key,
  schedule_id text references kadosh_manager_schedules(id) on delete cascade,
  member_id text references musicians(id) on delete cascade,
  phone text,
  message_sent text,
  confirmation_status text not null default 'Pendente' check (confirmation_status in ('Pendente', 'Confirmado', 'Recusado')),
  response_text text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table app_settings enable row level security;
alter table automation_logs enable row level security;
alter table confirmation_logs enable row level security;
create policy "allow all - app_settings" on app_settings for all using (true) with check (true);
create policy "allow all - automation_logs" on automation_logs for all using (true) with check (true);
create policy "allow all - confirmation_logs" on confirmation_logs for all using (true) with check (true);

-- =====================================================================
-- Equipe: foto do integrante e múltiplas funções (ex: canta e toca instrumento)
-- =====================================================================

alter table musicians add column if not exists photo text;
alter table musicians add column if not exists secondary_roles text[] not null default '{}';
alter table musicians add column if not exists secondary_instrument text;

-- Bucket público para as fotos dos integrantes (upload feito direto do navegador)
insert into storage.buckets (id, name, public)
values ('musician-photos', 'musician-photos', true)
on conflict (id) do nothing;

create policy "musician photos - public read" on storage.objects
  for select using (bucket_id = 'musician-photos');
create policy "musician photos - authenticated write" on storage.objects
  for insert to authenticated with check (bucket_id = 'musician-photos');
create policy "musician photos - authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'musician-photos');
create policy "musician photos - authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'musician-photos');

-- =====================================================================
-- Aniversário dos integrantes (lembrete automático via notificações)
-- =====================================================================

alter table musicians add column if not exists birthday date;

-- =====================================================================
-- Múltiplos instrumentos dentro da MESMA função principal
-- (ex: instrumentista que toca Teclado e também Violão)
-- =====================================================================

alter table musicians add column if not exists other_instruments text[] not null default '{}';
