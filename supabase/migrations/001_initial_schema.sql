-- ============================================================
-- CIT: Claim Intelligence Tracker — Initial Schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('super_admin', 'admin', 'investigator', 'viewer');
create type severity_color as enum ('RED', 'YELLOW', 'BLUE', 'GREY');
create type case_status as enum ('new', 'under_review', 'verified', 'dismissed', 'escalated', 'closed');
create type source_type as enum ('post_owner', 'commenter');
create type verification_status as enum ('publicly_sourced', 'unverified', 'verified');
create type evidence_type as enum ('screenshot', 'video', 'audio', 'document', 'pdf', 'other');
create type version_change_type as enum (
  'original_post', 'edited_post', 'deleted_post', 'new_comment',
  'engagement_update', 'follow_up_post', 'additional_evidence'
);
create type trend_direction as enum ('rising', 'stable', 'falling');
create type formula_type as enum ('claim_seriousness', 'influence', 'overall_risk');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'viewer',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ============================================================
-- PLATFORMS
-- ============================================================

create table platforms (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  icon text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table platforms enable row level security;
create policy "Authenticated can read platforms" on platforms for select using (auth.role() = 'authenticated');
create policy "Admin can manage platforms" on platforms for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

insert into platforms (name, sort_order) values
  ('Facebook', 1), ('Threads', 2), ('WhatsApp', 3), ('X', 4), ('TikTok', 5),
  ('Instagram', 6), ('YouTube', 7), ('Reddit', 8), ('Forum', 9),
  ('Blog', 10), ('News', 11), ('Other', 12);

-- ============================================================
-- TOPICS
-- ============================================================

create table topics (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table topics enable row level security;
create policy "Authenticated can read topics" on topics for select using (auth.role() = 'authenticated');
create policy "Admin can manage topics" on topics for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

insert into topics (name, sort_order) values
  ('Brainy Bunch', 1), ('EPF', 2), ('LHDN', 3), ('Salary', 4), ('Quantum Metal', 5),
  ('QM', 6), ('Malakat Mall', 7), ('Tea Amo', 8), ('Investment', 9), ('Franchise', 10),
  ('DRE Coffee', 11), ('Ahmad''s', 12), ('Eastel', 13), ('Malakat Grocer', 14),
  ('Business Coach', 15), ('License', 16), ('Supplier', 17), ('Contractor', 18),
  ('Refund', 19), ('Scam', 20), ('Fraud', 21), ('Ponzi', 22), ('Police Report', 23),
  ('Court Case', 24), ('Unpaid Salary', 25), ('Debt', 26), ('Breach of Contract', 27),
  ('Defamation', 28);

-- ============================================================
-- SEVERITY LEVELS
-- ============================================================

create table severity_levels (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color severity_color not null,
  description text,
  examples text[],
  min_score int not null default 0,
  max_score int not null default 100,
  sort_order int not null default 0,
  is_active boolean not null default true
);

alter table severity_levels enable row level security;
create policy "Authenticated can read severity" on severity_levels for select using (auth.role() = 'authenticated');
create policy "Admin can manage severity" on severity_levels for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

insert into severity_levels (name, color, description, examples, min_score, max_score, sort_order) values
  ('RED', 'RED', 'Criminal or major allegations',
   array['Scam', 'Fraud', 'Ponzi', 'Theft', 'Misappropriation', 'Fake License', 'Police Report'],
   75, 100, 1),
  ('YELLOW', 'YELLOW', 'Business issues',
   array['Refund', 'Salary', 'Supplier dispute', 'Contractor dispute', 'Service complaint'],
   50, 74, 2),
  ('BLUE', 'BLUE', 'Opinions and low-level claims',
   array['Sarcasm', 'Rumours', 'Personal dislike', 'Memes'],
   25, 49, 3),
  ('GREY', 'GREY', 'Insufficient information',
   array['Unknown', 'Weak signal', 'Unverified'],
   0, 24, 4);

-- ============================================================
-- ACCOUNT TYPES
-- ============================================================

create table account_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

alter table account_types enable row level security;
create policy "Authenticated can read account_types" on account_types for select using (auth.role() = 'authenticated');
create policy "Admin can manage account_types" on account_types for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

insert into account_types (name, sort_order) values
  ('Fake Account', 1), ('Nobody', 2), ('Normal User', 3), ('Influencer', 4),
  ('Public Figure', 5), ('Media', 6), ('Company', 7), ('Government', 8);

-- ============================================================
-- ACCOUNTS (social media accounts being tracked)
-- ============================================================

create table accounts (
  id uuid primary key default uuid_generate_v4(),
  name text,
  username text,
  profile_url text,
  account_type_id uuid references account_types(id),
  followers int,
  following int,
  is_verified boolean not null default false,
  workplace text,
  company text,
  phone_number text,
  address text,
  notes text,
  name_status verification_status not null default 'unverified',
  username_status verification_status not null default 'unverified',
  workplace_status verification_status not null default 'unverified',
  company_status verification_status not null default 'unverified',
  phone_status verification_status not null default 'unverified',
  address_status verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table accounts enable row level security;
create policy "Authenticated can read accounts" on accounts for select using (auth.role() = 'authenticated');
create policy "Investigator+ can manage accounts" on accounts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin', 'investigator'))
);

-- ============================================================
-- CASES
-- ============================================================

create sequence case_number_seq start 1000;

create table cases (
  id uuid primary key default uuid_generate_v4(),
  case_number text not null unique default 'CIT-' || lpad(nextval('case_number_seq')::text, 6, '0'),
  platform_id uuid references platforms(id),
  url text,
  source_type source_type not null default 'post_owner',
  account_id uuid references accounts(id),
  topic_id uuid references topics(id),
  date_found date not null default current_date,
  date_posted date,
  status case_status not null default 'new',
  full_claim_text text,
  ai_summary text,
  claim_category text,
  keywords text[],
  related_case_ids uuid[],
  severity_id uuid references severity_levels(id),
  severity_color severity_color,
  claim_seriousness_score numeric(5,2),
  evidence_strength_score numeric(5,2),
  influence_score numeric(5,2),
  engagement_score numeric(5,2),
  overall_risk_score numeric(5,2),
  influence_level int check (influence_level between 1 and 5),
  assigned_investigator_id uuid references profiles(id),
  initial_notes text,
  ai_evaluated boolean not null default false,
  ai_confirmed boolean not null default false,
  created_by_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cases enable row level security;
create policy "Authenticated can read cases" on cases for select using (auth.role() = 'authenticated');
create policy "Investigator+ can manage cases" on cases for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin', 'investigator'))
);

create index idx_cases_status on cases(status);
create index idx_cases_severity_color on cases(severity_color);
create index idx_cases_platform_id on cases(platform_id);
create index idx_cases_topic_id on cases(topic_id);
create index idx_cases_date_found on cases(date_found);
create index idx_cases_overall_risk_score on cases(overall_risk_score desc);

-- ============================================================
-- POST VERSIONS
-- ============================================================

create table post_versions (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  version_number int not null,
  date_captured timestamptz not null default now(),
  uploaded_by_id uuid references profiles(id),
  change_type version_change_type not null,
  screenshot_url text,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  unique (case_id, version_number)
);

alter table post_versions enable row level security;
create policy "Authenticated can read versions" on post_versions for select using (auth.role() = 'authenticated');
create policy "Investigator+ can manage versions" on post_versions for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin', 'investigator'))
);

-- ============================================================
-- EVIDENCE VAULT
-- ============================================================

create table evidence (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text not null,
  evidence_type evidence_type not null default 'screenshot',
  description text,
  uploaded_by_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table evidence enable row level security;
create policy "Authenticated can read evidence" on evidence for select using (auth.role() = 'authenticated');
create policy "Investigator+ can manage evidence" on evidence for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin', 'investigator'))
);

-- ============================================================
-- ENGAGEMENT
-- ============================================================

create table engagements (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references cases(id) on delete cascade,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  views int not null default 0,
  reposts int not null default 0,
  saves int not null default 0,
  capture_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table engagements enable row level security;
create policy "Authenticated can read engagements" on engagements for select using (auth.role() = 'authenticated');
create policy "Investigator+ can manage engagements" on engagements for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin', 'investigator'))
);

-- ============================================================
-- NARRATIVES
-- ============================================================

create table narratives (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  frequency int not null default 1,
  trend_direction trend_direction not null default 'stable',
  related_case_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table narratives enable row level security;
create policy "Authenticated can read narratives" on narratives for select using (auth.role() = 'authenticated');
create policy "Admin+ can manage narratives" on narratives for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

-- ============================================================
-- SCORING FORMULAS
-- ============================================================

create table scoring_formulas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  formula_type formula_type not null,
  weights jsonb not null default '{}',
  thresholds jsonb not null default '{}',
  is_active boolean not null default true,
  updated_by_id uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table scoring_formulas enable row level security;
create policy "Authenticated can read formulas" on scoring_formulas for select using (auth.role() = 'authenticated');
create policy "Super admin can manage formulas" on scoring_formulas for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
);

insert into scoring_formulas (name, formula_type, weights, thresholds) values
  ('Claim Seriousness Score', 'claim_seriousness',
   '{"severity": 35, "evidence": 25, "influence": 20, "specificity": 10, "repetition": 10}',
   '{"min": 0, "max": 100}'),
  ('Influence Score', 'influence',
   '{"followers": 30, "likes": 20, "shares": 20, "comments": 15, "views": 10, "verified": 5}',
   '{"level_1_max": 20, "level_2_max": 40, "level_3_max": 60, "level_4_max": 80, "level_5_max": 100}'),
  ('Overall Risk Score', 'overall_risk',
   '{"claim_seriousness": 40, "influence": 25, "evidence_strength": 20, "engagement_velocity": 15}',
   '{"red_min": 75, "yellow_min": 50, "blue_min": 25, "grey_min": 0}');

-- ============================================================
-- AI PROMPTS
-- ============================================================

create table ai_prompts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  prompt_type text not null unique,
  system_prompt text not null,
  user_prompt_template text not null,
  is_active boolean not null default true,
  updated_by_id uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table ai_prompts enable row level security;
create policy "Authenticated can read prompts" on ai_prompts for select using (auth.role() = 'authenticated');
create policy "Super admin can manage prompts" on ai_prompts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);

insert into ai_prompts (name, prompt_type, system_prompt, user_prompt_template) values
  ('Case Evaluation', 'case_evaluation',
   'You are an expert intelligence analyst for a professional investigation platform. Your role is to objectively analyze online claims and evidence. You must NEVER determine guilt or innocence. Your job is to extract, classify, score, and summarize information only. Always be factual, neutral, and evidence-based.',
   'Analyze the following post/claim and provide structured output:\n\nURL: {{url}}\nPlatform: {{platform}}\nClaim Text: {{claim_text}}\nInitial Notes: {{notes}}\n\nProvide:\n1. Summary (2-3 sentences)\n2. Claim Category\n3. Suggested Topic\n4. Severity (RED/YELLOW/BLUE/GREY with reasoning)\n5. Evidence Level (E1-E5 with reasoning)\n6. Influence Assessment\n7. Keywords (up to 10)\n8. Duplicate/Similar claim detection notes'),
  ('Narrative Detection', 'narrative_detection',
   'You are an expert in identifying narrative patterns across social media and online platforms. Analyze clusters of claims to identify recurring themes and narrative patterns.',
   'Review these related cases and identify emerging narratives:\n\n{{cases_summary}}\n\nIdentify:\n1. Recurring themes\n2. Narrative patterns\n3. Trend direction\n4. Key actors\n5. Coordination signals');

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references cases(id),
  user_id uuid references profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
create policy "Admin+ can read audit logs" on audit_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
);
create policy "System can insert audit logs" on audit_logs for insert with check (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'viewer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cases_updated_at before update on cases
  for each row execute procedure update_updated_at();
create trigger accounts_updated_at before update on accounts
  for each row execute procedure update_updated_at();
create trigger profiles_updated_at before update on profiles
  for each row execute procedure update_updated_at();
create trigger narratives_updated_at before update on narratives
  for each row execute procedure update_updated_at();

-- Auto-assign version number
create or replace function assign_version_number()
returns trigger language plpgsql as $$
declare
  next_version int;
begin
  select coalesce(max(version_number), 0) + 1
  into next_version
  from post_versions
  where case_id = new.case_id;

  new.version_number = next_version;
  return new;
end;
$$;

create trigger post_versions_version_number
  before insert on post_versions
  for each row execute procedure assign_version_number();

-- Dashboard stats view
create or replace view dashboard_stats as
select
  count(*) as total_cases,
  count(*) filter (where severity_color = 'RED') as red_cases,
  count(*) filter (where severity_color = 'YELLOW') as yellow_cases,
  count(*) filter (where severity_color = 'BLUE') as blue_cases,
  count(*) filter (where severity_color = 'GREY') as grey_cases,
  count(distinct platform_id) as total_platforms,
  count(distinct topic_id) as total_topics
from cases;
