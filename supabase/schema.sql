-- =====================================================================
--  مخطط قاعدة البيانات — صندوق الركيزة
--  شغّل هذا الملف كاملاً في Supabase ← SQL Editor ← New query ← Run
--  Run this whole file in Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) الفرص الاستثمارية
-- ---------------------------------------------------------------------
create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title_ar      text not null,
  title_en      text not null,
  summary_ar    text not null default '',
  summary_en    text not null default '',
  body_ar       text not null default '',
  body_en       text not null default '',
  sector        text not null check (sector in ('real_estate','equities','ventures','cash')),
  status        text not null default 'open' check (status in ('open','funding','closed','exited')),
  risk          text not null default 'moderate' check (risk in ('low','moderate','high')),
  location_ar   text not null default '',
  location_en   text not null default '',
  target_return numeric not null default 0,
  min_ticket    numeric not null default 0,
  horizon_years int     not null default 5,
  target_raise  numeric not null default 0,
  raised        numeric not null default 0,
  highlights_ar text[]  not null default '{}',
  highlights_en text[]  not null default '{}',
  financials    jsonb   not null default '[]',
  tone          text    not null default 'navy' check (tone in ('navy','gold','teal','plum')),
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) المقالات والتقارير
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  kind            text not null default 'article' check (kind in ('article','report')),
  title_ar        text not null,
  title_en        text not null,
  excerpt_ar      text not null default '',
  excerpt_en      text not null default '',
  body_ar         text not null default '',
  body_en         text not null default '',
  author_ar       text not null default '',
  author_en       text not null default '',
  reading_minutes int  not null default 4,
  file_url        text,
  tone            text not null default 'navy' check (tone in ('navy','gold','teal','plum')),
  published       boolean not null default false,
  published_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) بيانات الأداء
-- ---------------------------------------------------------------------
create table if not exists public.nav_series (
  period text primary key,          -- '2024' أو '2024-Q3'
  value  numeric not null           -- مؤشر يبدأ من 100
);

create table if not exists public.allocation (
  sector text primary key check (sector in ('real_estate','equities','ventures','cash')),
  weight numeric not null           -- نسبة مئوية، مجموعها 100
);

create table if not exists public.annual_returns (
  year       int primary key,
  net_return numeric not null       -- نسبة مئوية، تقبل السالب
);

create table if not exists public.portfolio_kpis (
  id           uuid primary key default gen_random_uuid(),
  nav          numeric not null,
  irr          numeric not null,
  cash_yield   numeric not null,
  max_drawdown numeric not null,
  deals        int not null,
  exits        int not null,
  as_of        timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  initials   text not null default '',
  name_ar    text not null,
  name_en    text not null,
  role_ar    text not null default '',
  role_en    text not null default '',
  bio_ar     text not null default '',
  bio_en     text not null default '',
  sort_order int  not null default 0
);

-- ---------------------------------------------------------------------
-- 4) طلبات الاستثمار الواردة من نموذج التواصل
-- ---------------------------------------------------------------------
create table if not exists public.investment_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  amount     numeric,
  interest   text check (interest in ('real_estate','equities','ventures','cash')),
  message    text not null default '',
  status     text not null default 'new' check (status in ('new','contacted','qualified','archived')),
  locale     text not null default 'ar',
  created_at timestamptz not null default now()
);

create index if not exists investment_requests_created_at_idx
  on public.investment_requests (created_at desc);

-- =====================================================================
--  أمن الصفوف (RLS)
--  المحتوى المنشور مقروء للجميع، والطلبات لا يقرأها إلا مستخدم مسجّل دخول.
-- =====================================================================
alter table public.opportunities        enable row level security;
alter table public.posts                enable row level security;
alter table public.nav_series           enable row level security;
alter table public.allocation           enable row level security;
alter table public.annual_returns       enable row level security;
alter table public.portfolio_kpis       enable row level security;
alter table public.team_members         enable row level security;
alter table public.investment_requests  enable row level security;

-- قراءة عامة للمحتوى المنشور فقط
drop policy if exists "public reads published opportunities" on public.opportunities;
create policy "public reads published opportunities"
  on public.opportunities for select using (published = true);

drop policy if exists "public reads published posts" on public.posts;
create policy "public reads published posts"
  on public.posts for select using (published = true);

-- قراءة عامة لأرقام الأداء (أرقام مجمّعة، لا بيانات شخصية)
drop policy if exists "public reads nav" on public.nav_series;
create policy "public reads nav" on public.nav_series for select using (true);

drop policy if exists "public reads allocation" on public.allocation;
create policy "public reads allocation" on public.allocation for select using (true);

drop policy if exists "public reads annual returns" on public.annual_returns;
create policy "public reads annual returns" on public.annual_returns for select using (true);

drop policy if exists "public reads kpis" on public.portfolio_kpis;
create policy "public reads kpis" on public.portfolio_kpis for select using (true);

drop policy if exists "public reads team" on public.team_members;
create policy "public reads team" on public.team_members for select using (true);

-- الطلبات: أي زائر يستطيع الإرسال، ولا يقرأها إلا مستخدم مسجّل دخول
drop policy if exists "anyone submits a request" on public.investment_requests;
create policy "anyone submits a request"
  on public.investment_requests for insert with check (true);

drop policy if exists "authenticated reads requests" on public.investment_requests;
create policy "authenticated reads requests"
  on public.investment_requests for select
  to authenticated using (true);

drop policy if exists "authenticated updates requests" on public.investment_requests;
create policy "authenticated updates requests"
  on public.investment_requests for update
  to authenticated using (true) with check (true);

-- تحرير المحتوى من لوحة الإدارة (مستخدم مسجّل دخول)
drop policy if exists "authenticated manages opportunities" on public.opportunities;
create policy "authenticated manages opportunities"
  on public.opportunities for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages posts" on public.posts;
create policy "authenticated manages posts"
  on public.posts for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages nav" on public.nav_series;
create policy "authenticated manages nav"
  on public.nav_series for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages allocation" on public.allocation;
create policy "authenticated manages allocation"
  on public.allocation for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages annual returns" on public.annual_returns;
create policy "authenticated manages annual returns"
  on public.annual_returns for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages kpis" on public.portfolio_kpis;
create policy "authenticated manages kpis"
  on public.portfolio_kpis for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manages team" on public.team_members;
create policy "authenticated manages team"
  on public.team_members for all to authenticated using (true) with check (true);

-- =====================================================================
--  بيانات بدء اختيارية — احذفها إذا كنت ستُدخل بياناتك بنفسك
-- =====================================================================
insert into public.allocation (sector, weight) values
  ('real_estate', 52), ('equities', 26), ('ventures', 13), ('cash', 9)
on conflict (sector) do update set weight = excluded.weight;

insert into public.annual_returns (year, net_return) values
  (2018, 9.4), (2019, 11.3), (2020, -3.0), (2021, 16.4),
  (2022, 12.7), (2023, 10.8), (2024, 14.3), (2025, 15.4)
on conflict (year) do update set net_return = excluded.net_return;

insert into public.nav_series (period, value) values
  ('2017', 100), ('2018', 109.4), ('2019', 121.8), ('2020', 118.2),
  ('2021', 137.6), ('2022', 155.1), ('2023', 171.9), ('2024', 196.4),
  ('2025', 226.7), ('2026', 243.5)
on conflict (period) do update set value = excluded.value;
